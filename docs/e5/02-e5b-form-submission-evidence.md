# E5-B — Evidencia de formulario versionado y submission

## Control de alcance

| Campo | Resultado |
| --- | --- |
| Estado | `COMPLETE` |
| Rama | `feat/e5-mvp` |
| HEAD de entrada | `fcb81ca856e01d27523e13bc0c1b87e661257627` |
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
contenido activo y estructura no vacía.

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
4. recalcula aplicabilidad y obligatorios;
5. crea `ApplicationSnapshot` con oferta, estudiante, perfil, formulario
   exacto, reglas aplicadas y respuestas aplicables;
6. cambia `Application` a `SUBMITTED` y fija `submittedAt`;
7. registra `APPLICATION_SUBMITTED` con metadatos mínimos.

Un retry posterior retorna el mismo `snapshotId`; la restricción única impide
duplicar snapshots. No se usan locks en memoria. Un error deja la postulación
en `DRAFT` sin snapshot parcial.

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
| `packages/database/src/forms.integration.spec.ts` | `FORM-01..10`, `ANS-01..08`, `VER-01..04`, `SUB-01..10` | PASS — 36/36 |
| `apps/api/src/intake.http.integration.spec.ts` | E5-A regresión + `E5B-HTTP-01..10` sobre Nest real | PASS — 22/22 |
| `packages/database/src/tenant-rls.integration.spec.ts` | POC E4 + `E5B-TEN-01..06` | PASS — 14/14 |

La cobertura incluye permisos manage/publish separados, contenido activo,
cross-tenant, respuestas inválidas/no aplicables, version pinning,
inmutabilidad, reintento idempotente, snapshot durable, legado E5-A legible y
ausencia de grants de mutación sobre snapshots.

## Migrations y validaciones

- Upgrade incremental comprobado: aplicar las 5 migrations existentes y luego
  `20260809150000_e5b_form_submission` como sexta migration: PASS.
- Fresh comprobado con las 6 migrations desde volumen limpio: PASS.
- No se modificaron migrations ya publicadas.
- `admission_app` permanece `NOSUPERUSER`, `NOBYPASSRLS`; ownership de
  estructura permanece en `admission_migrator`.

| Control de cierre | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 13 archivos, 140/140 |
| `pnpm test:rls` | PASS — 14/14 |
| `pnpm build` | PASS — database, API, web y worker |
| `pnpm security:secrets` | PASS; 201 archivos versionados inspeccionados |
| `pnpm security:deps` | PASS — sin vulnerabilidades high conocidas |
| `docker compose config` | PASS |
| `pnpm e4:deploy:smoke` | PASS — migrator, PostgreSQL, API, web y worker |
| `git diff --check` | PASS; sólo avisos de conversión CRLF de Windows |

Una primera corrida global, iniciada mientras seguían vivos procesos locales de
la inspección visual, produjo una colisión de fixtures (`139/140`). Los procesos
creados por esta tarea se cerraron de forma acotada y la repetición limpia
serial terminó `140/140`; no se ocultó ni se clasificó esa corrida como PASS.

## Supuestos, riesgos y fuera de alcance

**Hechos confirmados:** G4 está `APPROVED / CLOSED`; E5-B sólo opera con datos
sintéticos; la migration es la sexta y pasó fresh/incremental; las suites y
controles enumerados tienen resultados ejecutados en esta rama.

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
