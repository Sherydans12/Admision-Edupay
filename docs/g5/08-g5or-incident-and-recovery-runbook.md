# G5-OR1 — Runbook de incidente y recuperación

## Ciclo y severidad

Detectar, reconocer, triage, contener, recuperar, verificar, comunicar, cerrar y realizar
post-incident review. `SEV-1`, `SEV-2` y `SEV-3` expresan impacto técnico relativo; no
implican SLA, plazo contractual ni canal legal. El operador documenta sólo IDs opacos,
correlation IDs y códigos sanitizados.

No continuar ante manifest mismatch, objeto requerido faltante, objeto extra no explicado,
fallo RLS, visibilidad cross-tenant, migration mismatch, procedencia de backup desconocida,
credencial expuesta, o necesidad de datos reales/proveedor/decisión legal. Escalar a los
roles requeridos: `TECHNICAL_INCIDENT_OWNER`, `INSTITUTIONAL_ESCALATION_OWNER`,
`PRIVACY_LEGAL_OWNER`, `RECOVERY_OPERATOR` — todos `HUMAN_DECISION_REQUIRED` para
producción.

## Runbooks de señal

| Señal/caso | Triage y contención | Recuperación/verificación |
| --- | --- | --- |
| API unavailable / DB unavailable | separar live de ready; no exponer conexión | revisar dependencia y repetir readiness sanitizado |
| Worker stopped / jobs stale | detener reclamaciones duplicadas si es necesario | verificar lease, edad, outbox y fencing |
| Backup or restore failed | preservar evidencia, no sobrescribir source | aislar target, verificar manifest y repetir desde backup conocido |
| Object inconsistency | no promover ni reconstruir silenciosamente | comparar manifest/hash/área; escalar si persiste |
| Scanner unavailable | mantener quarantine/fail-closed | reintentar scanner aprobado; nunca auto-approve |
| Email degraded | crear/revisar tarea interna | portal sigue fuente oficial; no revertir decision/offer/acceptance |
| Suspected cross-tenant/security event | contener acceso, preservar eventos sanitizados | comprobar RLS, scopes/elevation y revisar mediante owner autorizado |

## Procedimiento de recovery

1. Confirmar autorización, procedencia y que target es aislado; no restaurar sobre source.
2. Seleccionar backup con manifest verificable y registrar evidencia sanitizada.
3. Crear base y object storage recovery aislados; aplicar migrations compatibles.
4. Restaurar DB y objetos APPROVED/QUARANTINE por separado.
5. Verificar manifest (key, área, hash, tamaño), fingerprint DB, RLS, no-context fail-closed
   y que app role no tiene superuser/BYPASSRLS.
6. Verificar aplicación sin leer contenido personal. Decidir rollback/failback sólo con owner
   humano autorizado.
7. Capturar startedAt/completedAt/elapsedMs, resultado y cleanup; borrar artefactos temporales.

Privacidad: mínimo acceso, logs sanitizados, sin credenciales ni raw applicant content en
tickets. Una elevación explícita con propósito/scope sigue siendo requisito para contenido
tenant. C-013 determina futuras obligaciones/notificaciones; este runbook no inventa plazos,
canales, retención ni procedimientos de derechos.
