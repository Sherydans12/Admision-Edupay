# E5-C — Evidencia de documentos y postulación asistida

## Control

| Campo | Valor |
| --- | --- |
| Slice | E5-C — Documentos y postulación asistida |
| Estado | `COMPLETE_WITH_DEFERRED_Q106` |
| Base de hardening | `d5ad33f62ad740dd3a29f0b9151543365ff4141a` en `feat/e5-mvp` |
| Alcance principal | `BL-006`, `BL-007`; soporte transversal de `BL-019` y `BL-020` |
| Criterios | `AC-010..AC-016` |
| Escenarios | `E2E-002`, `E2E-003`, `E2E-004` |
| Datos | Sólo fixtures sintéticos y dominios `.invalid` |
| Compuerta | G4 `APPROVED / CLOSED`; G5 `NO APROBADA` |

## Resultado implementado

E5-C incorpora un catálogo documental versionado por tenant, fija la versión
exacta aplicable al crear cada borrador, recibe archivos privados mediante
`multipart/form-data`, los mantiene en cuarentena y delega la inspección a un
worker tenant-aware. Sólo los archivos que superan firma, tipo, tamaño y scan se
promueven al área aprobada y pueden descargarse con autorización y auditoría.

La revisión separa recepción/carga de aceptación, observación y exención. Las
observaciones conservan motivo, plazo visible e historia append-only; el
vencimiento nunca produce rechazo automático. Una versión de reemplazo no
elimina la evidencia previa. El submit reevalúa aplicabilidad, obligatoriedad,
vigencia, estado funcional, estado técnico y binding tenant dentro de la misma
transacción bloqueada que crea el snapshot.

El hardening de revisión exige `expectedDocumentVersionId`: bajo lock de
`DocumentSubmission`, la decisión sólo se registra si sigue siendo exactamente
la versión current visualizada y no existe un reemplazo activo posterior. Un
token stale responde `409 / DOCUMENT_VERSION_CHANGED`. Una exención entra en
conflicto con cualquier versión `UPLOAD_PENDING`, `QUARANTINED` o `PROCESSING`.

La postulación asistida exige permiso independiente, adulto responsable
presente y autorización registrada. La sesión queda ligada a tenant, operador,
adulto, rol/capacidades, correlation id y horario. Formulario, documentos,
validación y submit reutilizan los mismos servicios del recorrido familiar. Un
documento físico se digitaliza con origen `PHYSICAL_DOCUMENT` dentro del mismo
expediente; no existe un expediente paralelo. Asistir no concede capacidades de
revisión, recomendación ni decisión.

La validación definitiva de una submission `ASSISTED` ocurre dentro de su misma
transacción. El orden de locks canónico es `AssistanceSession → Application`;
se vuelven a comprobar tenant, sesión `ACTIVE`, operador efectivo, presencia y
autorización del adulto, perfil, responsable, vínculo y origen antes de crear el
snapshot o cambiar a `SUBMITTED`.

## Clasificación de información

### Hechos confirmados

- G4 está cerrada y E5 puede construir sólo el MVP local/development aprobado.
- G5, producción, piloto, proveedores reales, datos reales e integración EduPay
  no están autorizados.
- `BL-006`, `BL-007`, `AC-010..AC-016` y `E2E-002..004` son las fuentes
  funcionales canónicas de este slice.
- La base aprobada de este hardening es `d5ad33f62ad740dd3a29f0b9151543365ff4141a`.
  La migración E5-C original no se modifica; se agrega únicamente la forward
  `20260810150000_e5c_review_job_assistance_hardening` como migración 8.

### Decisiones aprobadas aplicadas

- Aislamiento tenant mediante `tenant_id NOT NULL`, claves compuestas, RLS,
  `FORCE ROW LEVEL SECURITY`, grants explícitos y contexto server-side.
- Estados funcionales visibles separados de estados técnicos internos.
- Versiones publicadas inmutables; los nuevos borradores fijan la versión
  publicada aplicable y los existentes no cambian al publicar otra.
- Descarga privada sólo desde almacenamiento aprobado; nunca se expone una key,
  ruta, cuarentena, hash o detalle de scanner a la familia.
- Submission idempotente con snapshot `schemaVersion = 2`; lectura histórica de
  snapshots `schemaVersion = 1` preservada.
- Asistencia presencial sin suplantar cookie o identidad de la familia.
- Autorización documental institucional por permiso, tenant/recurso, scope,
  sensibilidad y purpose; RLS permanece sólo como segunda barrera.
- Lease de outbox de 60.000 ms, máximo 5 intentos y backoff exponencial desde
  1.000 ms, acotado a 24 horas.

### Supuestos de trabajo explícitos

- `DevelopmentBusinessCalendar` cuenta lunes a viernes y no inventa feriados
  institucionales. El calendario institucional definitivo queda diferido.
- El adapter de filesystem y el scanner por marcadores existen sólo para
  local/development y fallan si se intentan usar como proveedor productivo.
- La atención asistida recibe identificadores exactos conocidos en el contexto
  operativo; no habilita discovery o búsqueda global de familias.
- El hard cap local es 10 MiB y cada versión de requisito puede imponer un
  límite menor.

### Preguntas y compuertas abiertas

- `Q-106`: verificación definitiva de identidad, relación y excepciones
  familiares. E5-C sólo permite resolución estrecha por identificador exacto y
  no declara esta pregunta cerrada.
- `C-013`: conserva `LEGAL_VALIDATION_PENDING` antes de cualquier dato real o
  piloto productivo, incluyendo retención, eliminación, derechos y matriz legal.
- Proveedor productivo de object storage, malware scanning, lifecycle/retención,
  calendario de feriados y operación de colas quedan fuera de este slice.

## Modelo y controles

La migración agrega las tablas tenant-owned `document_requirements`,
`document_requirement_versions`, `document_submissions`, `document_versions`,
`document_reviews` y `assistance_sessions`. `applications` recibe origen,
sesión asistida y timestamp de fijación de requisitos.

| Control | Implementación y evidencia |
| --- | --- |
| Catálogo y versiones | `DRAFT → PUBLISHED → ARCHIVED`; publicación separada, edición sólo en draft y snapshot exacto por postulación |
| Alcance | Tenant, año, proceso, oferta, curso y condición controlada contra un field de la versión de formulario exacta |
| Equivalencia | Catálogo de códigos/etiquetas controlado; no texto libre que cambie el significado del requisito |
| Vigencia | `NONE`, `LATEST_AVAILABLE` genérico o `MAX_AGE_DAYS` con fecha no futura y reevaluación al submit |
| Upload | Multipart acotado, filename visible sanitizado, key opaca, cuarentena privada y outbox idempotente |
| Inspección | Magic bytes, allowlist PDF/JPEG/PNG, PDF cifrado bloqueado, tamaño declarado/real, scan fail-closed y SHA-256 sobre bytes efectivos |
| Worker | Descubre tenants activos mediante función `SECURITY DEFINER` acotada, reclama sólo el topic documental y procesa cada mensaje bajo contexto del tenant dueño |
| Descarga | Sólo `READY_FOR_REVIEW`, área aprobada, ownership/permiso/sensibilidad y auditoría; headers `private, no-store` y `nosniff` |
| Revisión | Capacidades independientes `document.review` y `document.exempt`; motivo obligatorio; reviews append-only |
| Readiness | Documento requerido aplicable satisfecho sólo por `EXENTO` o por versión actual `READY_FOR_REVIEW` en `EN_REVISION/ACEPTADO` y vigencia válida |
| Asistencia | `application.assist`, membresía tenant, operador efectivo, adulto presente, autorización, sesión activa operator-bound y origen explícito |
| Anti-enumeración | Recursos ajenos o no autorizados se proyectan como 404; nunca se acepta un tenant enviado por cliente como autorización |

### Autorización de recurso documental

`authorizeDocumentResource` recibe el permiso, la `Application`, la versión del
requisito, su sensibilidad y el purpose server-side. La primitiva comprueba
tenant, capacidad explícita, recurso, scope, clasificación y purpose; nunca
autoriza por nombre de rol ni acepta scopes del request.

`RoleAssignment.scopes` ya era la fuente canónica de scopes, pero no tenía un
encoding de recursos. E5-C materializa sólo la representación mínima compatible
con E2:

- `*`;
- `application:<uuid>`;
- `offering:<uuid>`;
- `process:<uuid>`;
- `campus:<uuid>`.

El recurso documental deriva sus cuatro identificadores desde filas
persistidas. Basta que coincida uno de los scopes efectivos; un scope de otra
postulación, oferta, proceso o sede no concede acceso. Para elevación de soporte,
los scopes y categorías se toman exclusivamente de la elevación verificada.

La lista staff evalúa cada `DocumentSubmission` y omite por completo los no
autorizados, evitando revelar nombre, clasificación, reviews, razón, metadata o
historia. La proyección asistida es separada y family-safe: conserva sólo lo
necesario para explicar qué cargar, estado comunicable, corrección accionable y
captura; omite clasificación, MIME detectado, scanner, hash, origen interno,
metadata del revisor e historia técnica. Capturar exige simultáneamente
`application.assist` y `document.upload`; asistir nunca concede
`restricted.read` ni `document.review`.

### Lease, retry y finalización monotónica

`claimNext` usa `FOR UPDATE SKIP LOCKED` y reclama mensajes `PENDING` disponibles
o `PROCESSING` cuyo `claimedAt` venció el lease. Cada claim/reclaim fija
`PROCESSING`, renueva `claimedAt` e incrementa `attempts`. `claimedAt` también
actúa como token de ownership al marcar `SENT`, reencolar o fallar, por lo que un
worker antiguo no puede cerrar el lease nuevo.

`INVALID_DOCUMENT_JOB_PAYLOAD` es permanente. Un error inesperado de
DB/storage/handler se reencola como `PENDING` con `availableAt` futuro mientras
queden intentos; al alcanzar 5 termina `FAILED`. `INFECTED`, `UNSCANNABLE` y
`SCAN_ERROR` son resultados funcionales durables `BLOCKED_*`, por lo que el job
termina exitosamente como `SENT`.

La finalización bloquea `DocumentVersion` y sólo transiciona desde `PROCESSING`.
`READY_FOR_REVIEW` y cualquier `BLOCKED_*` son terminales monotónicos: un worker
stale devuelve el estado durable y nunca lo cambia. La promoción local es
idempotente. Una carrera excepcional podría dejar un objeto aprobado huérfano
para cleanup técnico diferido, pero jamás queda descargable si la DB conserva
`BLOCKED_*`.

### Sellos de pertenencia en DB

La migración 8 agrega el unique
`document_versions(tenant_id, document_submission_id, id)`, convierte la FK de
review a `(tenant_id, document_submission_id, document_version_id)` y convierte
la FK de replacement a
`(tenant_id, document_submission_id, replaces_version_id)`. El check adicional
impide que una versión se reemplace a sí misma. `EXEMPTED` conserva
`document_version_id NULL`.

## API y experiencia

- Administración: catálogo, versiones, lectura, publicación y archivo de
  requisitos.
- Familia: lista aplicable, etapa `Documentos`, equivalentes, fecha de emisión,
  upload accesible, polling de procesamiento, estado funcional/técnico seguro,
  observaciones, plazo, historial y descarga de la versión actual aprobada.
- Revisión final: resumen documental y submit deshabilitado hasta que formulario
  y documentos cumplan readiness; el servidor vuelve a validar todo.
- Atención: apertura por application id exacto, descarga y decisiones separadas.
- Modo asistido: banner persistente, confirmaciones de adulto/autorización,
  creación por ids exactos, formulario compartido, carga asistida/física,
  readiness, submit compartido y cierre explícito de sesión. La vista no presenta
  botones de revisión o decisión durante la asistencia.

## Trazabilidad funcional

| Requisito | Cobertura E5-C | Estado |
| --- | --- | --- |
| `BL-006` | Catálogo, aplicabilidad, upload privado, procesamiento, revisión, observación, corrección, equivalencia, exención, historia y readiness | `COVERED` |
| `BL-007` | Sesión asistida, trazabilidad de operador/adulto, mismo pipeline, origen físico y no elevación | `COVERED_WITH_Q106_DEFERRED` |
| `AC-010` | `CARGADO/EN_REVISION` antes de resolución humana | `COVERED` |
| `AC-011` | Secretaría carga pero no acepta/observa/exime sin capacidad independiente | `COVERED` |
| `AC-012` | Plazo en días hábiles visible; vencimiento queda pendiente humano | `COVERED_WITH_DEVELOPMENT_CALENDAR` |
| `AC-013` | Reemplazo e historia; equivalente/exención con actor, fecha, motivo y binding | `COVERED` |
| `AC-014` | Tenant, operador, rol, adulto, autorización, horario y acciones | `COVERED_WITH_Q106_DEFERRED` |
| `AC-015` | `PHYSICAL_DOCUMENT` entra al expediente oficial y al pipeline común | `COVERED` |
| `AC-016` | `application.assist` no concede review/exemption/recommend/decision | `COVERED` |
| `E2E-002` | Observación, reemplazo y conservación de historial | `COVERED` |
| `E2E-003` | Equivalencia/exención y readiness | `COVERED` |
| `E2E-004` | Atención asistida y documento físico sin suplantación | `COVERED_WITH_Q106_DEFERRED` |

## Evidencia ejecutable

| Grupo | Identificadores |
| --- | --- |
| Catálogo | `E5C-REQ-01..10` |
| Archivos | `E5C-FILE-01..16`, `E5C-SMOKE-01` |
| Revisión | `E5C-REV-01..10` |
| Reemplazo | `E5C-REP-01..06` |
| Submission | `E5C-SUB-01..14` |
| Asistencia | `E5C-AST-01..14` |
| Worker | `E5C-WRK-01..08` |
| Tenant/RLS | `E5C-TEN-01..08` |
| HTTP | `E5C-HTTP-01..14` |
| Storage local | `E5C-STO-01..06` |
| Autorización endurecida | `E5C-AUTH-01..10` |
| Concurrencia de review | `E5C-CON-01..06` |
| Pertenencia DB | `E5C-DB-01..03` |
| Lease/retry | `E5C-LEASE-01..09` |
| Concurrencia asistida | `E5C-AST-CON-01..03` |
| HTTP endurecido | `E5C-HTTP-15..18` |

### Matrices de hardening

| ID | Control demostrado |
| --- | --- |
| `E5C-AUTH-01` | `document.read` sin `restricted.read` omite requirement restricted |
| `E5C-AUTH-02` | permiso sensible y scope válidos proyectan el requirement |
| `E5C-AUTH-03..05` | accept, observe y exempt deniegan sensibilidad no autorizada |
| `E5C-AUTH-06..07` | scopes de application/offering no cruzan a otro recurso del tenant |
| `E5C-AUTH-08` | `application.assist` no equivale a read/review |
| `E5C-AUTH-09` | captura asistida con assist+upload permanece operativa y family-safe |
| `E5C-AUTH-10` | elevación sólo habilita categorías y scopes persistidos |
| `E5C-CON-01..03` | accept/observe stale dan conflict; current exacto pasa |
| `E5C-CON-04..05` | exemption colisiona con processing y pasa sin upload activo |
| `E5C-CON-06` | ningún review se registra sobre versión distinta del token esperado |
| `E5C-DB-01..03` | FKs deniegan review/replacement cruzado y aceptan replacement válido |
| `E5C-LEASE-01..03` | lease impide reclaim temprano y recupera crash tras expiración |
| `E5C-LEASE-04..07` | requeue futuro, backoff, máximo de intentos y payload permanente |
| `E5C-LEASE-08..09` | scanner terminal marca `SENT`; CLEAN reclaimed promueve una vez |
| `E5C-AST-CON-01..03` | close-first deniega; submit-first crea un snapshot; no hay bypass del core |
| `E5C-HTTP-15..18` | token requerido, stale 409, sensibilidad 403 y lista sin filtración |

El smoke `pnpm e5c:documents:smoke` comprueba un recorrido limpio de bytes
`upload → quarantine → process/scan → approved → authorized download` y compara
la descarga con el contenido sintético original. `pnpm e5c:migration:smoke`
crea una base temporal, aplica las primeras siete migraciones y luego la octava;
verifica el unique, ambas FKs compuestas y el check de self-replacement, y
elimina la base temporal. El reset normal valida adicionalmente el recorrido
fresh `0→8`.

## Seguridad y datos

- No se almacenan archivos en PostgreSQL ni en URLs; sólo metadatos y referencias
  opacas.
- No se persiste un nombre original confiable: la proyección usa un display name
  sanitizado y las keys son UUID opacos.
- Cuarentena y aprobados son espacios privados distintos. Los estados
  `BLOCKED_*` nunca se hacen descargables; un objeto aprobado huérfano por una
  carrera de worker queda fuera de la proyección y pendiente de cleanup.
- Logs y respuestas usan códigos seguros; no incluyen paths, contenido, nombres
  sensibles, scanner output ni credenciales.
- Todos los tests usan identidades, documentos y tenants sintéticos.

## Fuera de alcance

E5-C no implementa E5-D, actividades, agenda institucional, diagnóstico,
recomendación, decisión, cupos, waitlist, oferta, comunicaciones productivas,
proveedores reales, infraestructura productiva, malware scanner real, S3/Blob,
datos reales, piloto, matrícula, pagos ni integración EduPay.

## Estado de compuerta

La validación local final quedó completa:

- instalación con lockfile congelado: `PASS`;
- migración fresh `0→8`: `PASS`, 8 migraciones aplicadas;
- migración incremental `7→8`: `PASS`, unique, dos FKs compuestas y check
  verificados;
- regresión: 247/247 pruebas `PASS` en 15 suites;
- RLS: 22/22 pruebas `PASS`; total combinado 269 pruebas;
- formato, lint, typecheck y build: `PASS`;
- secret scan: `PASS`, 216 archivos tracked inspeccionados;
- dependency audit: `PASS`, sin vulnerabilidades conocidas en el umbral
  configurado (`high`);
- `docker compose config`: `PASS`;
- deploy smoke, document pipeline smoke y migration smoke: `PASS`;
- `git diff --check`: `PASS`.

Con estos controles, E5-C queda `COMPLETE_WITH_DEFERRED_Q106` y E5 queda
`IN PROGRESS / E5-A+B+C COMPLETE — READY FOR E5-D REVIEW`. Este estado no
inicia E5-D ni aprueba G5.

El cambio permanece en el PR #8 como draft y no solicita merge. E5-D sigue
`NOT_STARTED`; G5 permanece `NO APROBADA` y no se autoriza piloto, producción,
datos reales, proveedores productivos ni integración EduPay.
