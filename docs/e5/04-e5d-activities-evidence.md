# E5-D — Evidencia de actividades y agenda

Estado de la ronda: `E5-D COMPLETE`. E5 queda en `IN PROGRESS / E5-A+B+C+D
COMPLETE — READY FOR E5-E REVIEW`; E5-E no se inicia y G5 permanece `NO
APROBADA`.

## Alcance y trazabilidad

Esta ronda mantiene el alcance de BL-008 y BL-009, con AC-017..AC-021 y
E2E-005..E2E-008. Sólo endurece autorización, proyección, concurrencia,
integridad histórica, RLS y evidencia del slice E5-D.

Quedan fuera E5-E, G5, EduPay, proveedores de pago, correo/SMS/WhatsApp,
datos reales, integraciones externas, Q-106, C-013 y Q-301..Q-309. Admisión y
EduPay siguen desacoplados.

## Hechos, decisiones y supuestos

### Hechos confirmados

- La modalidad MVP es `IN_PERSON`.
- La familia solicita reprogramación con el body exacto `{ reason: string }`.
- La familia no envía slot, fecha, hora, assignedUser ni free slot.
- Los resultados canónicos son `FAVORABLE`, `NO_FAVORABLE` e `INCONCLUSO`.
- El actor efectivo debe coincidir con `assignedUserId` para ejecutar
  `activity.perform`.

### Decisiones de esta ronda

- `activity.result.read` se evalúa de forma independiente de `activity.repeat`,
  `activity.close`, `activity.schedule`, `activity.read` y
  `activity.perform`.
- La evidencia sensible exige permiso, tenant, propósito, scope derivado,
  `highly_restricted` y sensibilidad válida: `restricted.read` para contexto
  tenant o categoría `highly_restricted` para una elevación de soporte válida.
- Los scopes de actividad se derivan de la aplicación persistida: `application`,
  `offering`, `process` y `campus`; no se aceptan scopes del request.
- Un executor asignable debe ser `PlatformUser ACTIVE` y tener `Membership
  ACTIVE` vigente en el tenant. La compatibilidad de `activity.perform` se
  valida en el boundary de ejecución mediante el actor efectivo.
- `expectedAppointmentId` es obligatorio para repeat y para la ruta familiar
  de solicitud de reprogramación.

### Supuestos temporales

- Fixtures usan UUID, nombres y correos sintéticos.
- Las fechas se transportan con ISO-8601 y se almacenan conceptualmente en UTC.
- No existe una operación UI/API de corrección de `ActivityResult` en E5-D. El
  schema conserva estructura append-only preparada para versionado; la
  corrección operativa de un resultado no forma parte de E5-D.

## Cambios implementados

### Proyección y autorización

- `repeat` y `closeActivityAfterNoShows` ya no fuerzan
  `mapStaffActivity(result, true)`.
- Todas las mutaciones devuelven evidencia redactada cuando el actor sólo está
  autorizado para la operación operacional.
- `recordOutcome` tampoco expone evidencia por ser el executor asignado.
- `authorizeActivityResource` cubre list/get, schedule, reprogram, outcome,
  repeat, close y result read con scopes server-side completos.
- Support elevation usa exclusivamente scopes y categorías de su elevación
  verificada; scope incorrecto deniega y scope correcto sin
  `highly_restricted` redacta.

### Citas familiares y fencing

La ruta es:

`POST /family/tenants/:tenantId/applications/:applicationId/activities/:activityId/appointments/:expectedAppointmentId/reschedule-requests`

La comparación de la cita actual ocurre bajo lock de `ApplicationActivity`.
Una cita stale devuelve `409 ACTIVITY_APPOINTMENT_CHANGED` y no crea
`ActivityRescheduleRequest`. La ruta anterior insegura no se conserva.

Repeat exige `expectedAppointmentId` en tipo, schema y servicio; la comparación
es siempre bajo el mismo lock.

### Executors

Schedule, reprogram y repeat resuelven el executor contra datos persistidos y
rechazan usuario inexistente, usuario de otro tenant, membership suspendida o
revocada y ventanas fuera de vigencia. La migration 10 agrega la FK
`activity_appointments.assigned_user_id -> platform_users.id`.

### Migration 10 y sellos de historia

`20260810190000_e5d_activity_boundary_hardening` es forward-only y no modifica
migrations 1..9. Incluye:

- FK de `previous_appointment_id` en
  `(tenant_id, application_activity_id, previous_appointment_id)` hacia la
  misma actividad.
- FK de `previous_result_id` en
  `(tenant_id, application_activity_id, attempt_id, previous_result_id)` hacia
  el mismo attempt.
- Unique compatible para historia de resultados por attempt.
- Checks anti-self para appointment y result.

Las siete tablas E5-D mantienen RLS y `FORCE ROW LEVEL SECURITY`, grants
separados y triggers append-only existentes.

## Pruebas dirigidas

- Actividades de dominio: `5/5`.
- Hardening E5-D: `9/9`.
- HTTP real de actividades: `6/6`, incluyendo repeat/close redactados,
  repeat sin token obligatorio y stale/current familiar.
- RLS de actividades: `3/3`, incluyendo reutilización de conexión pooled
  tenant A → sin contexto → tenant B.
- Concurrencia real PostgreSQL: `5` pruebas con 20 operaciones concurrentes
  para schedule, reprogram, repeat, outcome y close vs schedule/reprogram.
- Sellos DB PostgreSQL: `5` escenarios cubiertos en la prueba de historia:
  cross-activity appointment rechazado, same-activity aceptado, cross-attempt
  result rechazado, same-attempt aceptado y self-reference rechazado.
- Suite completa: `19 archivos, 270/270 tests PASS` en la ejecución más reciente
  con `pnpm test -- --hookTimeout=60000`. El margen explícito sólo evita que la
  preparación sintética de una suite paralela expire el hook de 10 segundos;
  no omite ni modifica aserciones.
- RLS global: `22/22 PASS`.

## Validación reproducible

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm db:generate`: PASS.
- `pnpm db:migrate`: PASS, 10 migrations aplicadas localmente.
- `pnpm e5d:migration:smoke`: `FRESH_0_TO_10=PASS`,
  `INCREMENTAL_9_TO_10=PASS`, `E5D_DB_SEALS=PASS`.
- `pnpm e5c:documents:smoke`: `1/1 PASS`.
- `pnpm e4:deploy:smoke`: PASS; API live/ready, web 200, PostgreSQL healthy,
  migrator, worker persistente y SIGTERM limpio.
- `pnpm format:check`: PASS.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS.
- `pnpm security:secrets`: PASS; `229` archivos tracked inspeccionados en el
  HEAD final de esta ronda.
- `pnpm security:deps`: sin vulnerabilidades conocidas de severidad alta.
- `docker compose config`: PASS.
- `git diff --check`: PASS.

## Datos, riesgos y compuerta

Todos los fixtures, logs de prueba y artefactos de esta ronda son sintéticos.
No se usaron datos reales, proveedores productivos ni integración EduPay.

El mínimo obligatorio de executor es membership tenant activa; una validación
adicional de RoleAssignment específica por actividad queda documentada como
refuerzo posterior, sin ampliar esta ronda. La próxima acción humana es revisar
la evidencia y decidir el inicio de E5-E. Q-106 permanece diferida, C-013 en
`LEGAL_VALIDATION_PENDING` y Q-301..Q-309 en `FUTURE_INTEGRATION_PENDING`.
