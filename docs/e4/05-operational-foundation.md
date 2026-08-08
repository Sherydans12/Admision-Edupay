# E4-D — Fundación operacional

## Correlación y logs

`CorrelationContext` acepta un identificador externo limitado sólo como correlación; si
es inválido genera UUID. Nunca es autoridad de autenticación, tenant o permisos. API y
worker propagan el contexto internamente.

Los loggers emiten JSON con `timestamp`, `level`, `service`, `eventCode`,
`correlationId` y `result`. La sanitización elimina tokens, cookies, passwords, CSRF,
Authorization, URLs de base de datos, secretos y contenido sensible. `AuditEvent` y
`SecurityEvent` son contratos separados del log operacional y usan metadata allowlisted.

## Errores y health

El filtro global de API clasifica internamente autenticación, autorización, validación,
not found, conflict e internal; al cliente entrega respuesta uniforme sin stack trace ni
enumeración, junto al correlation ID. `GET /health/live` sólo demuestra proceso vivo.
`GET /health/ready` comprueba `SELECT 1` con el rol de aplicación y no revela connection
strings, versiones ni datos tenant.

## Jobs y adapters

`OutboxService` persiste mensajes PostgreSQL tenant-owned, reclama con
`FOR UPDATE SKIP LOCKED`, mantiene estado, intentos, disponibilidad e idempotency key.
No hay topics funcionales ni Redis/BullMQ. `EmailSender`, `ObjectStorage` y
`MalwareScanner` tienen interfaces y fakes/no-op explícitamente no productivos; no hay
SDKs ni network calls.

## CI y seguridad

CI instala frozen, genera/aplica migraciones, ejecuta format/lint/typecheck/test/build,
la PoC RLS real, escaneo de secretos de alta confianza y `pnpm audit --audit-level=high`.
Los datos y credenciales del pipeline son sintéticos. Vulnerabilidades HIGH/CRITICAL se
reportan y no se silencian.
