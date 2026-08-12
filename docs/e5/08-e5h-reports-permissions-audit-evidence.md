# E5-H — Reportes, permisos, configuración y auditoría — evidencia

## Control

| Campo | Valor |
| --- | --- |
| Fecha | 2026-08-11 |
| Entry HEAD | `9d44a46d24fc7a791d43efd91be236d9f35568f8` |
| Rama | `feat/e5-mvp` |
| PR | `#8`, `OPEN`, `DRAFT`, sin merge |
| Estado | `COMPLETE` |
| Datos | Sólo sintéticos/non-production |
| Schema change | `YES`, migration 14 |

## Alcance y fuentes

**HECHO CONFIRMADO.** El incremento cubre exclusivamente `BL-018` y el cierre
P0 de `BL-019`, `BL-020` y `BL-021`. No implementa E5-I, integración EduPay,
handoff, P1 (`BL-023..BL-028`), piloto ni producción.

Se revisaron como fuentes canónicas `docs/e1/11..14`,
`docs/e2/03-logical-data-model.md`,
`docs/e2/04-multitenancy-authorization-architecture.md`,
`docs/e2/07-audit-observability-recovery.md`,
`docs/e3/02-screen-inventory.md` y la evidencia E5-A..G.

## Catálogo cerrado de reportes

**DECISIÓN DE IMPLEMENTACIÓN.** `REPORT_CATALOG` es una allowlist cerrada; no
acepta SQL, expresiones, joins, plantillas ni columnas arbitrarias.

| Report key | Columnas por defecto | Columnas adicionales permitidas |
| --- | --- | --- |
| `APPLICATIONS_BY_COURSE_STATUS` | applicationId, offering, courseLevel, campus, status, createdAt | process, studentGivenName, studentFamilyName |
| `PENDING_DOCUMENTS` | applicationId, courseLevel, documentRequirement, status, dueAt | offering, campus, process, studentGivenName, studentFamilyName |
| `ACTIVITIES` | applicationId, courseLevel, activity, status, scheduledAt | offering, campus, process, studentGivenName, studentFamilyName |
| `DECISIONS` | applicationId, courseLevel, decision, decidedAt | offering, campus, process, studentGivenName, studentFamilyName |
| `WAITLIST` | applicationId, offering, courseLevel, waitlistState, enteredAt | campus, process, studentGivenName, studentFamilyName |
| `CAPACITY_RESERVATIONS` | applicationId, offering, courseLevel, capacity, reservationState, reservedAt | campus, process, studentGivenName, studentFamilyName |
| `OFFERS` | applicationId, offering, courseLevel, offerOrigin, offerLifecycle, issuedAt, expiresAt | campus, process, studentGivenName, studentFamilyName |

Los filtros permitidos son una combinación controlada de `campusId`,
`processId`, `offeringId`, `courseLevelId`, `dateFrom`, `dateTo` y, sólo donde
corresponde, `applicationStatus`. La propiedad de cada identificador se valida
en PostgreSQL dentro del tenant antes de consultar. Los scopes
`application:<uuid>`, `offering:<uuid>`, `process:<uuid>` y `campus:<uuid>` se
aplican server-side; `*` sólo funciona si fue otorgado explícitamente.

### Sensibilidad y exclusiones

- `studentGivenName` y `studentFamilyName` son `restricted` y exigen además
  `restricted.read`.
- No existe ninguna columna `highly_restricted` en el catálogo P0.
- Se excluyen siempre archivos, bytes, object keys, hashes documentales,
  PIE/NEE/salud, resultados de actividad, comentarios internos, fundamentos de
  recomendación/Dirección, posición de waitlist, cuerpo de comunicaciones,
  respuestas completas y evidencia documental.
- `roleKey` sólo describe una asignación; nunca autoriza un reporte.

## CSV y límite técnico

**DECISIÓN DE IMPLEMENTACIÓN.** El CSV usa CRLF, quoting RFC-compatible para
comas/comillas/saltos y duplica comillas. Antes del quoting neutraliza con un
apóstrofo valores cuyo primer carácter significativo sea `=`, `+`, `-`, `@`,
tab, CR o LF, incluso después de espacios iniciales. Hay pruebas específicas
para `=1+1`, `+SUM(A1:A2)`, `-2+3`, `@cmd`, espacios iniciales y combinación
coma/comilla/CRLF.

**LÍMITE TÉCNICO DE SEGURIDAD.** `REPORT_EXPORT_MAX_ROWS=5000` en development;
acepta sólo enteros `1..100000`. La consulta pide `limit + 1`; si excede,
responde `REPORT_EXPORT_LIMIT_EXCEEDED`/409, no genera CSV y no trunca.
El archivo se genera en memoria, se entrega con nombre server-side y
`Cache-Control: private, no-store`; no se persiste artifact u object key.

## Permisos y administración de RoleAssignment

Permisos mínimos agregados:

- `report.read`
- `report.export`
- `role_assignment.read`
- `role_assignment.manage`
- `audit.read`

`RoleAssignmentAdminService` lista memberships/assignments del tenant y permite
crear, actualizar, suspender/reactivar y revocar. Las mutaciones:

- requieren capability explícita, tenant y CSRF/Origin en HTTP;
- aceptan sólo permisos existentes en `PERMISSIONS`;
- aceptan sólo scopes controlados y verifican recursos tenant-owned;
- impiden delegar una capability o scope que el actor no posee;
- impiden otorgar `*` si el actor no tiene `*`;
- usan `expectedUpdatedAt`; un stale write responde
  `ROLE_ASSIGNMENT_CHANGED`/409;
- auditan create/update/revoke en la misma transacción de negocio;
- deniegan de forma anti-enumerativa un membership/assignment de otro tenant.

**HECHO CONFIRMADO.** La SoD previa entre recomendador y decisor usa actor
efectivo y no fue reemplazada. Los nuevos permisos no incluyen comodines como
`admin.*`, `superadmin.all` o bypass tenant.

## SupportElevation

Se reutilizaron `SupportElevationService`, sus GUCs estrechos y
`getElevationContext`; no se creó un segundo modelo ni bypass. Una identidad
global configurada sólo en local/development:

1. no obtiene membership ni contenido tenant por su rol global;
2. debe iniciar self-elevation con target tenant, motivo, purpose
   `platform.support`, scopes, categorías y expiración;
3. presenta el ID de elevación en la solicitud tenant;
4. queda limitada a tenant, actor, scopes, categorías, vigencia y estado no
   cerrado/revocado;
5. puede cerrarla explícitamente y cada transición queda auditada.

`ADMISSION_PLATFORM_SUPPORT_USER_IDS` sólo habilita IDs sintéticos en
local/development y se ignora en `NODE_ENV=production`. Esto no es un mecanismo
productivo de identidad global.

## Auditoría

### Cobertura

| Capability/acción | Evento esperado | Implementado | Prueba |
| --- | --- | --- | --- |
| configuración base create/change | `ADMISSION_*_CREATED/UPDATED` | Sí, E5-A | regresión 377/377 |
| publicar/versionar forms | eventos `FORM_*` | Sí, E5-B | regresión |
| requisitos documentales | `DOCUMENT_REQUIREMENT_*` | Sí, E5-C | regresión |
| descarga documental | `DOCUMENT_DOWNLOADED` | Sí, E5-C | regresión |
| publicar/versionar actividad | `ACTIVITY_DEFINITION_*` | Sí, E5-D | regresión |
| lectura autorizada de resultado altamente restringido | `ACTIVITY_SENSITIVE_RESULTS_READ` sin contenido | Sí, E5-H | `activities.integration.spec.ts` |
| recomendación/Dirección y SoD | eventos transaccionales existentes | Sí, E5-E | regresión |
| ajuste de cupo | `ADMISSION_CAPACITY_ADJUSTED` | Sí, E5-F | regresión |
| promoción waitlist | `WAITLIST_ENTRY_PROMOTED` | Sí, E5-F | regresión |
| offer/reopen/accept | `ADMISSION_OFFER_*` y asiento | Sí, E5-F | regresión |
| comunicaciones | `communication.*` / `manual_contact.recorded` | Sí, E5-G | regresión |
| export solicitado/generado | `REPORT_EXPORT_REQUESTED`, `REPORT_EXPORT_GENERATED` | Sí | E5H-REP/HTTP |
| export denegado por capability/policy/scope/límite | `REPORT_EXPORT_DENIED` | Sí | E5H-REP/HTTP |
| RoleAssignment create/change/revoke | `ROLE_ASSIGNMENT_CREATED/UPDATED/REVOKED` | Sí | E5H-RBAC/HTTP |
| soporte start/access/close/expiry | eventos existentes de elevation y actor efectivo | Sí | E5H-HTTP-17/18 + regresión TRUST |
| sesión fuera de transacción de negocio | `SESSION_ISSUED/ROTATED/REVOKED`, `ALL_USER_SESSIONS_REVOKED` | Sí, sink durable | migration smoke + regresión session |

Las lecturas sensibles sin permiso son deny-by-default aunque el caso general
sea visible; las pruebas E5-D/E5-H comprueban omisión/403. Las lecturas
autorizadas de resultados de actividad ahora generan un evento mínimo con
actor, actor efectivo, tenant, purpose, correlation y recurso, nunca el
resultado ni comentario leído.

### PrismaAuditSink y separación de señales

**DECISIÓN DE IMPLEMENTACIÓN.** `PrismaAuditSink` cierra la brecha de
`SessionService` y de servicios de plataforma fuera de una transacción de
negocio. Sólo inserta `AuditEvent`: usa la frontera platform-global existente
para eventos de sesión o una transacción tenant especializada. No reemplaza ni
duplica los `tx.auditEvent.create()` que deben confirmar junto con el negocio,
no usa migration role y no expone un cliente privilegiado general.

**DEFERRED.** `SecurityEventSink` continúa separado y el AppModule conserva el
sink de seguridad no durable aprobado para local/development. No se guardan
SecurityEvents como AuditEvents. El provider durable/productivo, alertas,
retención y monitoreo pertenecen al paquete posterior de producción/G5.

### Política de metadata y append-only

`sanitizeAuditMetadata` es allowlist, profundidad máxima 3, arrays máximos 50,
strings máximos 500 y payload máximo 8192 bytes. Elimina claves asociadas a
password, token, cookie, authorization, CSRF, document/file, salud, PIE/NEE,
secret, SQL, stack y bodies. Export audit guarda report key, filtros,
columnas, scopes y conteo, pero nunca filas o CSV.

Migration 14 mantiene `audit_events` con RLS/FORCE. `admission_app` posee sólo
SELECT/INSERT; UPDATE y DELETE están revocados. La allowlist global se amplió
únicamente con los cuatro eventos de sesión ya definidos, sin tabla ni bypass.
Las pruebas reales verifican aislamiento, cross-tenant insert deny, ausencia de
contexto, pooling, append-only y que los GUC de soporte no desbloquean
AuditEvent ni RoleAssignment ordinarios. No se afirma inmutabilidad
criptográfica.

## Consulta de auditoría

`audit.read` permite filtros exactos por tenant, scope, purpose, resource,
action y rango de fechas, con cursor y límite 1..100. El rango máximo de 93 días
es un **límite técnico**, no una política legal de retención. No hay búsqueda
libre ni full-text sobre metadata. La respuesta conserva actor, actor efectivo
y correlation y vuelve a sanitizar metadata.

## Matriz de cierre de configuración P0

| Configuración | Paths y permisos | Aislamiento/auditoría | Versionado, stale y UI |
| --- | --- | --- | --- |
| Campus | configuration GET; campus POST/PATCH; `admission.config.read/manage` | tenant transaction, RLS; created/updated | entidad mutable controlada; panel Sede |
| AcademicYear | configuration GET; POST; `admission.config.read/manage` | tenant/RLS; created | estado controlado; panel Año |
| AdmissionProcess | configuration GET; POST/PATCH; `admission.config.read/manage` | tenant/RLS; created/updated | ventanas y estado validados; panel Proceso |
| CourseLevel | configuration GET; POST; `admission.config.read/manage` | tenant/RLS; created | catálogo acotado; panel Curso |
| AdmissionOffering | configuration GET; POST/PATCH; `admission.config.read/manage` | tenant/RLS; created/updated | disponibilidad/ventana controlada; panel Oferta |
| FormDefinition/FormVersion | CRUD/publish/archive; `form.read/manage/publish` | tenant/RLS; audit | published immutable y pin exacto; Formularios |
| DocumentRequirement | CRUD/publish/archive; `document.requirement.*` | tenant/RLS; audit | published immutable, stale/replacement; Documentos |
| ActivityDefinition | CRUD/publish/archive; `activity.definition.*` | tenant/RLS; audit | versiones publicadas/pinned; Actividades |
| Capacity | GET/POST/PATCH; `capacity.read/manage` | tenant/RLS; adjustment audit | version/fencing/concurrencia; Cupos |
| Offer expiry/deadline | configurado por días hábiles en capacity/offer | tenant/RLS; offer audit | cada offer preserva expiry y versión; Cupos/ofertas |
| Comunicación/reminder | catálogo de template key/version controlado en código y offer vigente | tenant/RLS; lifecycle audit | sin template ejecutable ni UI arbitraria; ampliación es BL-028 fuera de P0 |
| RoleAssignment/scopes | access GET; assignment POST/PATCH/revoke; `role_assignment.*` | tenant/RLS; create/update/revoke audit | `updatedAt` fencing; panel Accesos |

No se creó un generic settings JSON store, `eval`, JavaScript, HTML activo,
SQL o imports dinámicos desde configuración. Colegio Conquistadores no aparece
hardcodeado; todos los tests usan tenants y personas sintéticos.

## UI y accesibilidad

Se incorporaron:

- `SCR-STAFF-017`: catálogo, filtros/columnas y exportación; el botón no aparece
  sin `report.export`, estados idle/loading/success/forbidden/validation/limit;
- `SCR-STAFF-018`: consulta de auditoría con filtros controlados y tabla;
- `SCR-ADM-004`: tabla de memberships/assignments, create,
  suspend/reactivate/revoke y fencing;
- `SCR-ADM-005`: se preservan superficies existentes de configuración, cupos,
  plazos y definiciones;
- `SCR-ADM-006`: self-elevation con motivo, scope, expiración e indicador
  activo/cierre.

Los controles tienen labels, fieldsets/legends y `aria-live`; las tablas usan
semántica nativa y overflow horizontal. La verificación visual local se realizó
en desktop y viewport móvil 390×844. El detector manual de interfaz devolvió
`[]`. No se agregó ninguna superficie familiar de reportes o administración.

## HTTP, tests y validación local

| Control | Resultado |
| --- | --- |
| E5-H unit CSV/catalog/metadata | 13/13 PASS |
| E5-H DB reporting/RBAC/audit | 13/13 PASS |
| E5-H HTTP Nest/PostgreSQL | 19/19 PASS |
| E5-H RLS específico | 7/7 PASS |
| `pnpm test` | 377/377, 30 files, PASS |
| `pnpm test:rls` | 40/40, 4 files, PASS |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm security:secrets` | PASS, 283 tracked files |
| `pnpm security:deps` | PASS, 0 known vulnerabilities |
| `docker compose config --quiet` | PASS |
| `git diff --check` | PASS |
| `FRESH_0_TO_14` | PASS |
| `INCREMENTAL_13_TO_14` | PASS |
| `E5H_AUDIT_SEALS` | PASS |
| GitHub Actions sobre `2fcfcf7ca4ff16d99e5a9c4cb5eb51ac2bc22807` | run `31552081281`, job `93976724073`, `success` |

El primer intento de la cadena completa de smokes históricos alcanzó el timeout
de 15 minutos porque `e4:deploy:smoke` quedó esperando que Docker Desktop
terminara `compose down --volumes --remove-orphans`; el daemon dejó de responder
incluso a `docker version`. No se forzó ni amplió la eliminación. E5-H fresh,
incremental y seals ya habían pasado en una ejecución aislada anterior. Los
smokes E4/E5-C..G conservan además su evidencia verde en el HEAD E5-G definitivo
`9d44a46d24fc7a791d43efd91be236d9f35568f8`, run `31545007981`, job
`93955501044`. GitHub Actions run `31552081281` revalidó en un runner limpio la
suite completa, RLS y los smokes E5-F, E5-G y E5-H; migration 14 pasó fresh
0→14, incremental 13→14 y `E5H_AUDIT_SEALS`.

## Trazabilidad

| ID | Estado | Evidencia principal |
| --- | --- | --- |
| BL-018 | `COVERED` | catálogo cerrado, export CSV, UI, audit |
| BL-019 | `COVERED_P0` | permisos, scopes, RoleAssignment, elevation |
| BL-020 | `COVERED_P0` | sink durable, append-only, audit read/matrix |
| BL-021 | `COVERED_P0` | matriz de configuración existente y UI admin |
| AC-047 | `COVERED` | export mínimo + requested/generated audit |
| AC-048 | `COVERED` | Secretaría 403, cero CSV/artifact, denied audit |
| AC-049 | `COVERED` | columnas allowlisted, restricted explícito, highly absent |
| AC-050 | `COVERED` | filtros/resources cross-tenant y RLS deny |
| AC-052 | `COVERED` | sensitive deny + read autorizado auditado |
| AC-053 | `COVERED` | superadmin global sin elevation 403 |
| AC-054 | `COVERED` | elevation acotada y auditada |
| AC-011/016/023/028/034 | `REGRESSION_COVERED` | suite 377/377 + SoD/sensibilidad previa |
| E2E-019 | `COVERED` | lectura sensible no amplía acceso |
| E2E-020 | `COVERED` | deny inicial + self-elevation temporal |
| E2E-021 | `COVERED` | export autorizado minimizado/auditado |
| E2E-022 | `COVERED` | Secretaría denegada sin archivo |

## Diferidos, supuestos y compuerta

**SUPUESTO DE TRABAJO.** Los límites de 5000 filas y 93 días son defensas
técnicas configurables, no cifras de capacidad, SLA, retención ni política
institucional.

**DEFERRED / LEGAL:**

- `Q-106 = DEFERRED`;
- `C-013 = LEGAL_VALIDATION_PENDING`;
- `Q-301..Q-309 = FUTURE_INTEGRATION_PENDING`;
- retención/exportación/consentimientos y SecurityEventSink productivo se
  resolverán antes de producción/G5;
- `BL-023..BL-028`, E5-I, handoff técnico y EduPay no fueron implementados.

E5-H queda `COMPLETE`. E5-I permanece `NOT_STARTED` y G5 `NO APROBADA`; no se
declara `READY FOR G5`.
