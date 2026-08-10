# E5-D — Evidencia de actividades y agenda

Estado de esta entrega: `E5-D IN_PROGRESS` con evidencia funcional focalizada aprobada y dos gates heredados aún no concluyentes por timeout (`pnpm test` y `pnpm e4:deploy:smoke`). No se marca `COMPLETE` hasta cerrar esos gates o recibir una decisión humana sobre el bloqueo operativo.

## Alcance y trazabilidad

Esta entrega implementa únicamente BL-008 y BL-009, con AC-017..021 y E2E-005..008. Las superficies relacionadas son SCR-FAM-012/013, SCR-STAFF-009/010 y SCR-ADM-005.

Se mantienen fuera de alcance E5-E, G5, EduPay, proveedores de pago, correo/SMS/WhatsApp, datos reales, integraciones externas, Q-106, C-013 y Q-301..Q-309. Admisión y EduPay siguen desacoplados.

Fuentes utilizadas: especificación funcional E1, modelo lógico E2, inventario y flujos E3, backlog aprobado y `AGENTS.md`. La cifra histórica de E5-C se corrigió de 215 a 216 archivos tracked en `docs/e5/03-e5c-documents-assisted-evidence.md`.

## Decisiones y supuestos

### Confirmado

- La modalidad MVP es `IN_PERSON`.
- La familia puede solicitar reprogramación solo con `{ reason }`; no elige slot ni fecha.
- El staff define fecha, hora, duración, ubicación y evaluador efectivo.
- Los resultados canónicos son `FAVORABLE`, `NO_FAVORABLE` e `INCONCLUSO`.
- Una cita obsoleta debe producir conflicto controlado y no sobrescribir historial.

### Decidido para E5-D

- La configuración se versiona por tenant y scope de proceso/oferta/curso/año; una versión publicada se pinnea en la postulación.
- Los defaults configurables son `maxNormalReschedules = 2` y `lateToleranceMinutes = 15`; la duración es obligatoria y explícita.
- La primera inasistencia no cierra ni rechaza; la segunda inasistencia injustificada deja `manualClosureEligible = true`.
- El cierre exige permiso, motivo, auditoría y ausencia de cita `PROGRAMADA`; no cambia por sí solo la postulación ni la decisión.
- Attempts y results son append-only; una corrección se modela como nueva versión histórica.

### Supuestos temporales

- Los fixtures y pruebas usan UUID, nombres y correos sintéticos.
- Las fechas se envían como ISO-8601 con offset y se almacenan conceptualmente en UTC; no se fija una zona horaria institucional.
- La ausencia de un permission key específico para lectura de actividades se resuelve con `activity.read`; los datos sensibles requieren además `restricted.read` o `highly_restricted.read` según corresponda.

## Modelo y estados

La migration 9 agrega siete tablas tenant-owned:

1. `activity_definitions` — identidad estable y `kind`.
2. `activity_definition_versions` — configuración immutable después de publicar.
3. `application_activities` — snapshot pinneado por postulación.
4. `activity_appointments` — historial append-only de citas.
5. `activity_reschedule_requests` — solicitud familiar y su fulfillment.
6. `activity_attempts` — ejecución, resultado operativo, motivo y no-show.
7. `activity_results` — resultado privado versionado.

Enums nuevos: `ActivityDefinitionKind`, `ActivityDefinitionVersionLifecycle`, `ActivityModality`, `ApplicationActivityStatus`, `ActivityAppointmentStatus`, `ActivityRescheduleRequestStatus`, `ActivityAttemptOutcome` y `ActivityResultValue`.

Estados de actividad: `PENDIENTE`, `PROGRAMADA`, `REALIZADA`, `REPROGRAMADA`, `INASISTENCIA`, `EXENTA`, `NO_COMPLETADA`, `CERRADA`. Citas y attempts conservan secuencia, previous appointment/attempt y actor efectivo.

## Pinning y configuración

Al enviar una postulación, el mismo transaction boundary selecciona la versión `PUBLISHED` aplicable al tenant y scope, ordena por especificidad y versión, crea `application_activities` y fija `activities_pinned_at`. Reintentar el envío no duplica activities.

Los cambios posteriores de configuración no alteran el snapshot ya pinneado. Admin puede crear y editar `DRAFT`, publicar y archivar con permisos separados. Las versiones publicadas/archivadas no admiten mutación ni eliminación desde el rol de aplicación.

## Agenda, reprogramación y concurrencia

- `schedule` crea la primera cita únicamente si no existe otra vigente.
- `reprogram` marca la cita anterior `REPROGRAMADA`, crea una nueva `PROGRAMADA` y conserva el historial.
- `expectedAppointmentId` se valida dentro de una transacción con lock de `application_activities`; un valor stale devuelve `409 ACTIVITY_APPOINTMENT_CHANGED`.
- Se controla doble registro de outcome validando que la cita siga `PROGRAMADA`.
- `ActivityRescheduleRequest` no recibe fecha, hora ni slot desde familia; el fulfillment es staff-side.
- Se impide no-show antes de `scheduled_start_at + lateToleranceMinutes` con `409 ACTIVITY_NO_SHOW_TOO_EARLY`.

## Inasistencia, attempts, results y repeat

La primera inasistencia crea un attempt y deja la actividad abierta. La segunda inasistencia injustificada habilita cierre manual, pero no ejecuta auto-close. El cierre manual exige `activity.close`, motivo no vacío, actor efectivo y auditoría; nunca deja una cita actual `PROGRAMADA`.

Una actividad diagnóstica `NO_COMPLETADA` registra `INCONCLUSO` y puede repetirse con `activity.repeat`, creando una nueva cita y manteniendo el vínculo histórico. Results, comments, evaluator y attempts no forman parte de la proyección familiar.

## Autorización, scopes y sensibilidad

Se agregaron `activity.definition.manage`, `activity.definition.publish`, `activity.read`, `activity.schedule`, `activity.perform`, `activity.result.read`, `activity.repeat` y `activity.close`.

Toda operación exige tenant, propósito, rol y permiso. El executor boundary usa `assignedUserId`/actor efectivo; el cliente no puede elevarlo por body. Los scopes de aplicación se validan con el mismo patrón de los dominios anteriores. Sin permiso de sensibilidad, el endpoint staff omite attempts/results; una familia nunca recibe evaluator, comment, score, result ni detalles internos.

## RLS, integridad y auditoría

Las siete tablas tienen `tenant_id NOT NULL`, foreign keys simples y compuestas same-tenant, RLS y `FORCE ROW LEVEL SECURITY`. Hay triggers para inmovilidad de versiones publicadas/archivadas, append-only de attempts/results y consistencia de la cita current. La migration conserva owner/grants separados para `admission_app` y `admission_migrator`.

Las mutaciones relevantes auditan actor, effective actor, tenant, propósito, recurso y motivo. No se registran secretos ni datos personales reales.

## HTTP y UI

Se agregaron endpoints family, staff y admin en `ActivityController`, validación Zod strict, CSRF para mutations y `GlobalErrorFilter` con conflictos `409` explícitos.

La UI incorpora:

- Familia: listado seguro, próximo paso, historial visible sin slot selection, y solicitud de reprogramación con motivo.
- Staff: agenda operativa, schedule/reprogram/no-show/not-completed y acceso condicionado a resultados.
- Admin: definición, versionado DRAFT y configuración explícita de duración/defaults.

Los formularios usan labels, títulos, botones con texto y mensajes de estado visibles. No se incorporó un proveedor externo ni se realizó auditoría automatizada de lector de pantalla; queda como revisión manual de la compuerta de diseño.

## Migration y validaciones

Migration forward única: `20260810180000_e5d_activities`, sin modificar migrations 1..8.

Resultados observados:

- `pnpm db:reset` + `pnpm db:migrate`: 9 migrations aplicadas correctamente.
- `pnpm e5d:migration:smoke`: `FRESH_0_TO_9=PASS`, `INCREMENTAL_8_TO_9=PASS`, `E5D_DB_SEALS=PASS`.
- `pnpm e5c:migration:smoke`: base E5-C 0→7 y hardening 7→8 pasan; E5-D queda como migration 9.
- `pnpm exec vitest run packages/database/src/activities.integration.spec.ts`: 5/5.
- `pnpm exec vitest run packages/database/src/activities.rls.integration.spec.ts`: 2/2.
- `pnpm exec vitest run apps/api/src/activity.http.integration.spec.ts`: 5/5.
- `pnpm test`: 18 archivos, 259/259 tests, PASS (444.47 s).
- `pnpm test:rls`: 22/22 en base limpia.
- `pnpm e5c:documents:smoke`: 1/1.
- `pnpm format:check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS después de agregar la suite HTTP.
- `pnpm security:secrets`: PASS, 216 archivos tracked inspeccionados.
- `pnpm security:deps`: sin vulnerabilidades conocidas de severidad alta.
- `docker compose config`: PASS.
- `git diff --check`: PASS.

Pendientes de validación final:

- `pnpm test` completo: dos ejecuciones superaron cinco minutos sin reporte final; no se declara PASS.
- `pnpm e4:deploy:smoke`: PASS; API live/ready, web 200, PostgreSQL healthy, migrator exit 0, worker persistente y SIGTERM limpio.
- Revisión CI remota después del push.

## Riesgos y siguientes compuertas

El riesgo actual es operativo: dos gates heredados no concluyeron en el entorno local por timeout. El siguiente paso humano es revisar esos timeouts/CI y decidir si E5-D puede pasar a `COMPLETE`. E5-E permanece `NOT_STARTED`; G5 permanece `NO APROBADA`; Q-106 permanece diferida; C-013 queda pendiente de validación legal; Q-301..Q-309 permanecen pendientes de integración futura.
