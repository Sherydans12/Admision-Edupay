# G5-OR1 — Evidencia operacional y recovery

## Resultado técnico

HEAD de entrada: `c2d18133d7e2eb904a79a6d1246423337b31bc39`. Esta evidencia se completa
con datos sintéticos, PostgreSQL y filesystem locales. `SCHEMA_CHANGE = NO`; Migration 16
intacta; Migration 17 ausente. Los HEAD final, commits y CI exactos se registran después
del commit/push final; no se usa un run de SHA anterior.

### Direct evidence

`pnpm g5or:recovery:smoke`: `G5OR-REC-01..15 = PASS`; observación local:
`elapsedMs=33829`. La prueba incluye migrations 16, fixture control-plane y tenant A/B,
objects APPROVED/QUARANTINE, manifest DB+objetos/hash/tamaño, restore aislado, fingerprint,
RLS/role, missing/extra object detection, separación de áreas y cleanup.

`G5OR-REC-03 = PASS / DIRECT_EVIDENCE`: un `DocumentVersion` E5-C real pertenece al
tenant A mediante `DocumentSubmission → Application`, está en `READY_FOR_REVIEW/CLEAN`,
y su `approved_object_key`, `sha256` y `size_bytes` coinciden byte por byte con el objeto
en el área `approved` antes y después de restore.

`G5OR-REC-04 = PASS / DIRECT_EVIDENCE`: otro `DocumentVersion` E5-C real pertenece al
mismo chain, está en `QUARANTINED/PENDING`, y su `quarantine_object_key`, hash y tamaño
coinciden con el objeto de cuarentena. No existe objeto físico `approved` para su key de
promoción, por lo que no se promueve automáticamente tras restore.

`pnpm g5or:operations:smoke`: `G5OR-OPS-01..14 = PASS`. La librería y spec prueban
evaluación determinista y sanitización. `WorkerHealthTracker` prueba STARTING→READY.

`LOCAL_FOCUSED_VALIDATION = PASS`: cuatro tests focalizados. Formato, lint, typecheck,
build, secrets, dependency audit, G5-BR smoke, E5-I boundary y Compose config: `PASS`.
`pnpm test:rls = PASS (46/46)`. `pnpm test = INCONCLUSIVE_DUE_AGENT_TIMEOUT`: no hubo
assertion ni exit distinto antes del timeout del agente. CI del SHA publicado será la
autoridad para la regresión general; no se declara PASS localmente.

### Derived evidence

Health/readiness, outbox leases, scanner fail-closed, email failure task y contratos de
SecurityEvent son respaldados por runtime/suites existentes revisados en fuentes G5/E4/E2.
El recovery coordinado demuestra mecánica/coherencia, no backup productivo.

### Declarative only / missing

`PRODUCTIVE_MONITORING_PROVIDER = REQUIRED_NOT_SELECTED`;
`PRODUCTIVE_ALERT_DESTINATION = REQUIRED_NOT_SELECTED`;
`SECURITY_EVENT_PRODUCTIVE_SINK = HUMAN_PROVIDER_DECISION_REQUIRED`;
`INCIDENT_OWNER = HUMAN_DECISION_REQUIRED`; `RECOVERY_OWNER = HUMAN_DECISION_REQUIRED`.
Provider, región, encryption-at-rest, retention, lifecycle, alert route y ownership
permanecen sin decidir. No se afirma S3, production backup, RPO o RTO alcanzados.

## Clasificación propuesta

`G5-EXIT-07 = PASS_WITH_RESIDUAL`: recovery sintético coordinado es directo; operación
autorizada/productiva, provider y owner no lo son.

`G5-EXIT-10 = BLOCKED / HUMAN_DECISION_REQUIRED`: la deuda técnica se reduce con señales,
smokes y runbooks, pero el blocker canónico exige provider de monitoring/alert route y
owner humano. Esta etapa no los puede cerrar.

`G5 = NO APROBADA / NOT REQUESTED`; datos reales, piloto, producción y EduPay técnico:
`NOT AUTHORIZED`.

## CI full regression

`CI_FULL_REGRESSION = PENDING_EXACT_HEAD`. Esta sección se completa únicamente con un run
completed/success del SHA final publicado; no se usa un run anterior como evidencia.
