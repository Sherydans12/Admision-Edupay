# G5-OR1 — Plan operacional y contrato de señales

## Alcance y límites

Este paquete demuestra mecánica local/CI con datos sintéticos. `SCHEMA_CHANGE = NO`;
Migration 16 permanece intacta y Migration 17 no existe. No selecciona proveedor,
destino de alertas, owner permanente, retención, residencia ni infraestructura productiva.

`PRODUCTIVE_MONITORING_PROVIDER = REQUIRED_NOT_SELECTED` y
`PRODUCTIVE_ALERT_DESTINATION = REQUIRED_NOT_SELECTED`. Un candidato in-memory o stdout
es evidencia de evaluación, no alerting productivo. `AuditEvent` durable y `SecurityEvent`
continúan siendo contratos distintos; no se reutiliza AuditEvent como sink de seguridad.

## Baseline audit

| Control | Current implementation | Direct evidence | Gap | Technical or human | Action G5-OR1 |
| --- | --- | --- | --- | --- | --- |
| API liveness/readiness | `/health/live`; `/health/ready` usa `SELECT 1` con rol app | health service, E4 deploy smoke | No monitor externo | Human/provider | Semántica y smoke |
| Worker health | primitive `STARTING -> READY`, sin endpoint de negocio | worker health spec | No supervisor productivo | Human/provider | transición probada |
| Logs/correlation | JSON sanitizado; ID sólo correlaciona | structured logger | destino/retención abiertos | Human/provider | contrato sanitizado |
| AuditEvent | durable y tenant-aware | E5-H suites | legal access/retention | Human/legal | sin cambio |
| SecurityEvent | contratos/in-memory; API compone Noop en desarrollo | `security-events.ts`, AppModule | sink/destino/retención productivos | Human/provider/legal | signal candidates separados |
| Outbox/jobs | PostgreSQL, lease/retry/idempotencia | `outbox.ts`, worker suites | alert threshold externo | Technical + provider | evaluación determinista |
| Email/scanner/storage | adapters development, fallo controlado/quarantine | E5-C/E5-G suites | proveedores productivos | Human/provider | señales sin cambiar estado negocio |
| PostgreSQL/object recovery | E4 DB recovery previo | E4 REC-01..08 | objetos coordinados faltaban | Technical | G5OR-REC-01..15 |
| Runbooks/ownership | documentación parcial; owner productivo no asignado | G5 blocker register | on-call/escalation | Human | runbook con roles no asignados |

## Contract

`packages/database/src/operational-signals.ts` define las 16 señales requeridas. Cada una
incluye `signalId`, categoría, severidad, fuente, condición, dimensiones sanitizadas,
acción y referencia de runbook. Las dimensiones se redaccionan antes de salir del proceso:
no cookies, Authorization, CSRF, passwords, challenges, session tokens, DATABASE_URL,
contenido documental ni PII innecesaria. Un tenant ID sólo puede ser opaco cuando hace
falta para correlación. Correlation ID no concede tenant, auth ni permiso.

| Señales | Semántica resumida |
| --- | --- |
| OP-API-AVAILABILITY, OP-API-ERROR-RATE, OP-API-READINESS | proceso, tasa local evaluable y dependencia DB |
| OP-WORKER-HEALTH, OP-JOB-STALE, OP-OUTBOX-DEPTH | worker no-ready, edad y profundidad de outbox |
| OP-BACKUP-FAILURE, OP-DB-SATURATION | exercise fallido y saturación por umbral |
| OP-SCANNER-FAILURE, OP-SCANNER-BACKLOG, OP-OBJECT-STORAGE-FAILURE | ERROR/UNSCANNABLE, backlog, operación storage fallida |
| OP-EMAIL-DEGRADATION | intento técnico fallido; portal sigue oficial |
| SEC-CROSS-TENANT, SEC-ELEVATION-DENIED, SEC-REPEATED-CREDENTIAL-FAILURE, SEC-SENSITIVE-PERMISSION-DENIED | candidatos de seguridad sanitizados |

## Recovery exercise

`pnpm g5or:recovery:smoke` usa dos PostgreSQL aislados del proyecto Compose
`admission-g5or-recovery`, volúmenes nuevos y un filesystem temporal. Migra source y
recovery hasta Migration 16, crea fixture A/B sintético y las cadenas E5-C reales
`DocumentVersion → DocumentSubmission → Application` para APPROVED y QUARANTINE. El
primero está `READY_FOR_REVIEW/CLEAN` con key approved; el segundo `QUARANTINED/PENDING`
sin objeto approved. Crea backup lógico y un manifiesto con referencia lógica opaca, área,
key, SHA-256 y tamaño. Restaura solamente a la base y filesystem recovery. Comprueba
fingerprints, bytes, RLS y rol app; además prueba
controladamente objeto faltante y objeto extra. Siempre baja containers/volúmenes y borra
el directorio temporal.

`RPO_1H = INITIAL_TECHNICAL_TARGET / NOT_SLA`; `RTO_4H = INITIAL_TECHNICAL_TARGET /
NOT_SLA`; duración observada no demuestra RTO.

## Ownership

Roles requeridos: `TECHNICAL_INCIDENT_OWNER`, `INSTITUTIONAL_ESCALATION_OWNER`,
`PRIVACY_LEGAL_OWNER`, `RECOVERY_OPERATOR`. Para operación productiva, todos permanecen
`HUMAN_DECISION_REQUIRED`; esta etapa no asigna personas ni entidades.
