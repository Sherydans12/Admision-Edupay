# E5-B — Evidencia de formulario versionado y submission

## Control de alcance

| Campo | Resultado |
| --- | --- |
| Estado | `COMPLETE` |
| Rama | `feat/e5-mvp` |
| HEAD de entrada | `fcb81ca856e01d27523e13bc0c1b87e661257627` |
| HEAD de entrada al hardening final | `a76822ff6261740b00ca3c84e6e6fb4c45b64c7b` |
| Base | `main` en `8990bed13622c70d42c54263f2abc45c8849fcbd` |
| Compuerta | G4 `APPROVED / CLOSED`; G5 `NO APROBADA` |
| Datos | Sólo sintéticos/non-production |
| EduPay | Sin llamadas, eventos, adapters ni tablas compartidas |
| Siguiente incremento | E5-C `NOT_STARTED`; requiere aprobación humana separada |

## Resultado

E5-B entrega un formulario institucional versionado y controlado. Un
administrador con permisos separados puede construir una versión `DRAFT`,
previsualizarla, publicarla y asignarla a una oferta. Una postulación fija esa
versión al crearse; la familia guarda respuestas por campo, revisa los datos
aplicables y envía una sola vez. El envío crea en la misma transacción el
estado `SUBMITTED`, el snapshot inmutable y el evento de auditoría.

No se inventó una política de campos para una institución. Cada campo exige
propósito y sensibilidad explícitos, pero `Q-104` y las decisiones legales de
finalidad/obligatoriedad continúan abiertas. Todos los ejemplos y fixtures son
sintéticos.

## Trazabilidad

| Fuente | Implementación E5-B | Estado |
| --- | --- | --- |
| `BL-001`, `NFR-TEN-001..004` | Seis tablas nuevas tenant-owned con `tenantId NOT NULL`, FK compuestas same-tenant, RLS/FORCE RLS y grants explícitos | COVERED para recursos E5-B |
| `BL-004`, `FR-FRM-001..012`, `FR-ADM-008` | Definición, versión, secciones, campos controlados, opciones, condición a campo previo, preview, publicación y archivo | PARTIAL — `FR-FRM-007` no incluye enmiendas posteriores y `FR-FRM-010` no demuestra todavía lectura diferenciada por clasificación |
| `NFR-SEC-013/014`, `AC-009` | Sin HTML/JavaScript ejecutable; allowlists estrictas de tipos, operadores, opciones y validaciones; permiso de publicación separado | COVERED |
| `AC-007` | `Application.formVersionId` fija la versión; versiones publicadas no se editan; nuevas revisiones crean filas nuevas | COVERED |
| `AC-008` | El builder no trae campos institucionales predefinidos, pero admite etiquetas y propósitos configurables | NOT ASSERTED — pendiente `Q-104`/`C-013`; E5-B no inventa una política institucional |
| `BL-005`, `FR-APP-003..009` | Inicio, guardado, lectura, revisión y envío; duplicado activo incluye `DRAFT/SUBMITTED`; retry idempotente | PARTIAL — desistimiento fuera de E5-B |
| `AC-002/003` | Ownership de familia/estudiante y anti-enumeración se conservan desde E5-A | COVERED para submission |
| `E2E-001` | Recorrido cubierto hasta `SUBMITTED`; etapas posteriores no se simulan | PARTIAL |
| `E2E-018`, `AC-050` | Denegación cross-tenant en definitions, versions, sections, fields, answers y snapshots | COVERED para recursos E5-B |

## Modelo, lifecycle e inmutabilidad

La migration forward `20260809150000_e5b_form_submission` agrega:

- `FormDefinition`: identidad estable del formulario tenant-owned;
- `FormVersion`: revisión numerada con lifecycle `DRAFT → PUBLISHED → ARCHIVED`;
- `FormSection` y `FormField`: estructura ordenada de una versión;
- `ApplicationDraftAnswer`: respuesta editable sólo mientras la postulación está `DRAFT`;
- `ApplicationSnapshot`: copia final única e inmutable por postulación;
- `Application.formVersionId`, `Application.submittedAt` y estado `SUBMITTED`;
- `AdmissionOffering.formVersionId` para asignar sólo una versión publicada.

No se usa un booleano de versión vigente. Cada revisión es una fila nueva y la
postulación conserva una FK a la versión exacta. Triggers de base impiden
insertar, modificar o eliminar contenido de versiones publicadas/archivadas, escribir
respuestas sobre una postulación no `DRAFT`, asignar una versión no publicada y
actualizar/eliminar snapshots desde el rol runtime `admission_app`. Ese rol sólo
recibe `SELECT/INSERT` sobre snapshots; no recibe `UPDATE/DELETE`. Las
respuestas de borrador admiten `DELETE` para que la familia pueda retirar un
valor antes del envío; RLS y el trigger de estado lo bloquean después de
`SUBMITTED`. El owner de migración conserva autoridad operacional y no se
presenta como un actor de producto.

## Builder controlado

El catálogo cerrado admite `TEXT`, `TEXTAREA`, `SELECT`, `RADIO`, `BOOLEAN` y
`DATE`; condiciones `EQUALS`, `NOT_EQUALS` e `IN`; y validaciones de longitud
para texto. Las opciones tienen valor estable allowlisted, orden y etiqueta.
Una condición sólo puede depender de un campo previo de la misma versión. La
publicación vuelve a comprobar referencias, ciclos, claves, órdenes, opciones,
contenido activo y estructura no vacía. La primitive única
`validateConditionAgainstSourceField` valida además cada operando contra el
tipo y configuración del field origen tanto al crear/editar como al publicar:
boolean real para `BOOLEAN`, pertenencia exacta al catálogo para
`SELECT/RADIO`, string compatible para texto y fecha calendario estricta para
`DATE`. `IN` valida cada elemento; `EQUALS/NOT_EQUALS` admiten sólo un valor.
No se interpretan expresiones ni se agregan operadores.

Las respuestas `DATE` conservan `YYYY-MM-DD`, pero no dependen de la
normalización permisiva de `Date.parse`: se validan año, mes, día, bisiesto y
cantidad real de días del mes de forma determinista.

Permisos separados:

- `form.read`: listar, recuperar y previsualizar;
- `form.manage`: definición, draft, estructura, reordenamiento y asignación;
- `form.publish`: publicar y archivar.

Todas las mutaciones API exigen sesión opaca válida, contexto server-side,
CSRF y allowlist Zod `.strict()`. La UI no interpreta código ni genera schema
desde texto arbitrario.

## Respuestas, revisión y submission

La familia sólo opera sobre una postulación propia. El guardado es por
`fieldId` de la versión fijada y valida tipo, opciones y límites. Las reglas de
visibilidad se recalculan en servidor; un valor enviado para un campo no
aplicable no entra al snapshot. La revisión devuelve secciones aplicables y un
resumen de obligatorios faltantes.

`submitApplication` adquiere un lock de fila en PostgreSQL y, dentro de una
sola transacción:

1. verifica ownership, tenant, versión y estado;
2. vuelve a validar vigencia de oferta/proceso/año y categoría pública;
3. permite la versión histórica fijada aunque haya pasado a `ARCHIVED`;
4. revalida cada respuesta durable contra application, versión fijada, field,
   tipo, catálogo, límites de texto y fecha calendario;
5. recalcula aplicabilidad y obligatorios usando sólo valores revalidados;
6. crea `ApplicationSnapshot` con oferta, estudiante, perfil, formulario
   exacto, reglas aplicadas y respuestas aplicables;
7. cambia `Application` a `SUBMITTED` y fija `submittedAt`;
8. registra `APPLICATION_SUBMITTED` con metadatos mínimos.

Un retry posterior retorna el mismo `snapshotId`; la restricción única impide
duplicar snapshots. No se usan locks en memoria. Un error deja la postulación
en `DRAFT` sin snapshot parcial ni evento `APPLICATION_SUBMITTED` exitoso. El
hito no confía en que un guardado anterior haya validado el valor: vuelve a
validar el estado persistido completo inmediatamente antes del snapshot.

El snapshot contiene las respuestas porque es la evidencia funcional del
envío, pero la auditoría no replica texto ni valores de respuestas: conserva
sólo IDs, conteos, estado, actor, propósito y correlación.

## API

Rutas administrativas principales:

- `GET/POST /admin/tenants/:tenantId/forms`;
- `POST /admin/tenants/:tenantId/forms/:definitionId/versions`;
- `GET /admin/tenants/:tenantId/form-versions/:versionId` y `/preview`;
- `POST/PATCH` de secciones y campos, más acciones `/move`;
- `POST .../publish` y `POST .../archive`;
- `PUT /admin/tenants/:tenantId/offerings/:offeringId/form-version`.

Rutas familiares:

- `GET .../applications/:applicationId/form`;
- `PUT .../applications/:applicationId/answers`;
- `GET .../applications/:applicationId/review`;
- `POST .../applications/:applicationId/submit`.

Los recursos ajenos se proyectan como `404`; falta de capacidad propia como
`403`; payload o estructura inválidos como `400`; duplicados como `409`.

El discovery público conserva la disponibilidad categórica, pero una oferta
para nueva postulación sólo aparece cuando está vigente, tiene
`formVersionId` y esa versión continúa `PUBLISHED`. El DTO no expone lifecycle
ni estructura interna del formulario. Si V1 se archiva, una postulación ya
fijada a V1 conserva lectura, revisión y submission; la oferta deja de ser
iniciable hasta asignar una V2 publicada.

## UI y accesibilidad

La experiencia familiar incluye progreso por sección, guardado explícito,
guardar y salir, campos condicionales, resumen de faltantes con foco,
revisión, confirmación modal antes del envío y estado final `SUBMITTED`. Enter
no ejecuta el envío final: requiere el botón y una segunda confirmación.

La administración incluye definición, revisión nueva, secciones, campos,
opciones, condición, sensibilidad, propósito, reordenamiento con botones,
preview marcado, confirmación de publicación y asignación a oferta. Las
versiones publicadas se presentan como inmutables.

Se verificaron escritorio `1280×800` y móvil `390×844` en el navegador local
integrado, mediante snapshot DOM y captura renderizada de la ruta Next local.
El control confirmó jerarquía, foco visible, reflujo y navegación móvil sin
scroll horizontal; el estado sin sesión mostró el error de autorización
esperado. La UI conserva headings semánticos, labels, fieldset/legend, skip
link, mensajes `aria-live`, touch targets y `prefers-reduced-motion`. No se
usaron datos reales para la inspección.

## Evidencia ejecutable específica

| Suite | Cobertura | Resultado |
| --- | --- | --- |
| `packages/database/src/forms.integration.spec.ts` | `FORM-01..10`, `ANS-01..08`, `VER-01..04`, `SUB-01..10`, `INTEGRITY-01..14` | PASS — 50/50 |
| `apps/api/src/intake.http.integration.spec.ts` | E5-A regresión + `E5B-HTTP-01..10` sobre Nest real | PASS — 22/22 |
| `packages/database/src/tenant-rls.integration.spec.ts` | POC E4 + `E5B-TEN-01..06` | PASS — 14/14 |

La cobertura incluye permisos manage/publish separados, contenido activo,
cross-tenant, respuestas inválidas/no aplicables, version pinning,
inmutabilidad, reintento idempotente, snapshot durable, legado E5-A legible y
ausencia de grants de mutación sobre snapshots.

### E5B-INTEGRITY-01..14

| IDs | Evidencia | Resultado |
| --- | --- | --- |
| `E5B-INTEGRITY-01` | Un harness raw interno persiste `RADIO=OUTSIDE_CATALOG`; el servicio normal rechaza submit y conserva `DRAFT`, 0 snapshots y 0 eventos success | PASS |
| `E5B-INTEGRITY-02` | FK compuesta niega asociar un field/version V2 a una application fijada en V1 | PASS |
| `E5B-INTEGRITY-03..07` | Dominio RADIO/BOOLEAN, `IN`, casos válidos y defensa final de publish frente a configuración durable corrupta | PASS |
| `E5B-INTEGRITY-08..10` | `2026-02-31` y `2026-02-29` rechazadas; `2024-02-29` aceptada hasta submission | PASS |
| `E5B-INTEGRITY-11..12` | Offering vigente con versión publicada es descubrible; al archivar la versión desaparece y no permite nuevo draft | PASS |
| `E5B-INTEGRITY-13..14` | Application histórica V1 archivada sigue leyendo/revisando/enviando; V2 publicada restaura discovery y sólo nuevas applications fijan V2 | PASS |

## Migrations y validaciones

- Upgrade incremental comprobado: aplicar las 5 migrations existentes y luego
  `20260809150000_e5b_form_submission` como sexta migration: PASS.
- Fresh comprobado con las 6 migrations desde volumen limpio: PASS.
- No se modificaron migrations ya publicadas.
- El cierre de integridad no cambia schema ni constraints: no agrega migration;
  reutiliza las FK compuestas E5-B y endurece service/domain/tests.
- `admission_app` permanece `NOSUPERUSER`, `NOBYPASSRLS`; ownership de
  estructura permanece en `admission_migrator`.

| Control de cierre | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 13 archivos, 154/154 |
| `pnpm test:rls` | PASS — 14/14 |
| `pnpm build` | PASS — database, API, web y worker |
| `pnpm security:secrets` | PASS; 201 archivos versionados inspeccionados |
| `pnpm security:deps` | PASS — sin vulnerabilidades high conocidas |
| `docker compose config` | PASS |
| `pnpm e4:deploy:smoke` | PASS — migrator, PostgreSQL, API, web y worker |
| `git diff --check` | PASS; sólo avisos de conversión CRLF de Windows |

El cierre de integridad agregó 14 pruebas y la corrida limpia serial actual
terminó `154/154`, más `14/14` en la suite RLS separada. En el cierre anterior,
una primera corrida global iniciada mientras seguían vivos procesos locales de
inspección visual produjo una colisión de fixtures (`139/140`); esa corrida no
se clasificó como PASS y quedó sustituida por las repeticiones limpias
documentadas.

## Supuestos, riesgos y fuera de alcance

**Hechos confirmados:** G4 está `APPROVED / CLOSED`; E5-B sólo opera con datos
sintéticos; permanecen exactamente seis migrations y el hardening no modificó
ninguna; las suites y controles enumerados tienen resultados ejecutados en esta
rama.

**Decisiones aprobadas aplicadas:** lifecycle explícito; versión exacta fijada al crear
la postulación; snapshot inmutable; autorización por tenant, propósito y rol;
no se comparte tabla con EduPay.

**Supuestos de trabajo:** ninguno se convierte en política institucional. Se
usa UTC para persistencia según la convención provisional; la decisión técnica
global de zona horaria sigue pendiente.

**Preguntas abiertas preservadas:** `Q-104` y decisiones legales/institucionales sobre
catálogo de datos; retención, eliminación, exportación y consentimientos; login
y verificación completos; `Q-301..Q-309`.

**Fuera de alcance:** documentos, postulación asistida, actividades, agenda,
diagnóstico, recomendación, decisión, cupos, reserva, waitlist operacional,
oferta final, emails, reportes, desistimiento y toda integración EduPay.

## Compuerta

E5-B queda `COMPLETE` dentro del alcance anterior. E5 continúa `IN PROGRESS`,
E5-C permanece `NOT_STARTED` y G5 permanece `NO APROBADA`. La siguiente acción
humana es revisar este incremento y decidir si se aprueba avanzar a E5-C; este
documento no solicita merge, piloto, producción, datos reales ni EduPay.
