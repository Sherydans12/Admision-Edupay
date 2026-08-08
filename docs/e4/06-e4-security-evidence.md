# E4 — Evidencia de seguridad

Resultados registrados tras la validación local de esta entrega. Comando base:
`pnpm test` (54 tests), `pnpm test:rls` (8 tests) y los checks raíz descritos en
`docs/e4/01-local-development.md`.

## Sesión y CSRF

| ID | Test/archivo | Resultado | Estado |
| --- | --- | --- | --- |
| SES-01 | `identity-session.integration.spec.ts` | hash DB distinto del raw | PASS |
| SES-02 | `identity-session.integration.spec.ts` | token válido resuelve usuario | PASS |
| SES-03 | `identity-session.integration.spec.ts` | token inexistente no autentica | PASS |
| SES-04 | `identity-session.integration.spec.ts` | token revocado no autentica | PASS |
| SES-05 | `identity-session.integration.spec.ts` | idle expiry no autentica | PASS |
| SES-06 | `identity-session.integration.spec.ts` | absolute expiry no autentica | PASS |
| SES-07 | `identity-session.integration.spec.ts` | rotation invalida token anterior | PASS |
| SES-08 | `identity-session.integration.spec.ts` | revoke-all invalida sesiones | PASS |
| SES-09 | `identity-authorization.integration.spec.ts` | tenant candidato sin membership = DENY | PASS |
| SES-10 | `identity-authorization.integration.spec.ts` | membership A no concede B | PASS |
| SES-11 | `identity-authorization.integration.spec.ts` | sesión sola no concede permiso | PASS |
| SES-12 | `operational-foundation.spec.ts` | CSRF inválido rechazado | PASS |
| SES-13 | `identity-session.integration.spec.ts` | 20 rotations concurrentes producen un solo sucesor | PASS |
| SES-14 | `identity-session.integration.spec.ts` | old token queda inválido después de rotation | PASS |
| SES-15 | `identity-session.integration.spec.ts` | exactamente un `rotated_from_session_id` en DB | PASS |
| SES-16 | `identity-session.integration.spec.ts` | revoke/resolve concurrente termina inválido | PASS |

## Autorización

| ID | Test/archivo | Resultado | Estado |
| --- | --- | --- | --- |
| AUTH-01 | `identity-authorization.integration.spec.ts` | sin permission = DENY | PASS |
| AUTH-02 | `identity-authorization.integration.spec.ts` | permission + tenant correctos = ALLOW | PASS |
| AUTH-03 | `identity-authorization.integration.spec.ts` | tenant incorrecto = DENY | PASS |
| AUTH-04 | `identity-authorization.integration.spec.ts` | scope incorrecto = DENY | PASS |
| AUTH-05 | `identity-authorization.integration.spec.ts` | sensitivity sin permiso = DENY | PASS |
| AUTH-06 | `identity-authorization.integration.spec.ts` | purpose incompatible = DENY | PASS |
| AUTH-07 | `identity-authorization.integration.spec.ts` | Secretaría no recomienda | PASS |
| AUTH-08 | `identity-authorization.integration.spec.ts` | Secretaría no decide | PASS |
| AUTH-09 | `identity-authorization.integration.spec.ts` | recommender = decider = DENY | PASS |
| AUTH-10 | `identity-authorization.integration.spec.ts` | superadmin sin elevation = DENY | PASS |
| AUTH-11 | `operational.integration.spec.ts` | elevation correcta sólo en scope = ALLOW | PASS |
| AUTH-12 | `operational.integration.spec.ts` | elevation expirada/otro tenant = DENY | PASS |

## Platform context y SELF-ELEVATION

| ID | Test/archivo | Resultado | Estado |
| --- | --- | --- | --- |
| PLAT-01 | `operational.integration.spec.ts` | contexto platform tenantless no ejecuta operación tenant-owned | PASS |
| PLAT-02 | `operational.integration.spec.ts` | superadmin sin elevation no obtiene tenant context | PASS |
| PLAT-03 | `operational.integration.spec.ts` | membership produce contexto tenant válido | PASS |
| ELEV-01 | `operational.integration.spec.ts` | superadmin tenantless crea/resuelve elevation | PASS |
| ELEV-02 | `operational.integration.spec.ts` | sin elevation no se produce contexto tenant | PASS |
| ELEV-03 | `operational.integration.spec.ts` | elevation A no concede B | PASS |
| ELEV-04 | `operational.integration.spec.ts` | elevation cerrada no resuelve | PASS |
| ELEV-05 | `operational.integration.spec.ts` | elevation revocada no resuelve | PASS |
| ELEV-06 | `operational.integration.spec.ts` | actor distinto no puede cerrar/revocar | PASS |
| ELEV-07 | `operational.integration.spec.ts` | update inexistente no audita SUCCESS | PASS |
| ELEV-08 | `operational.integration.spec.ts` | expiry produce DENY | PASS |

## Audit y security sinks

| ID | Test/archivo | Resultado | Estado |
| --- | --- | --- | --- |
| AUD-01 | `identity-session.integration.spec.ts` | issue emite `SESSION_ISSUED` | PASS |
| AUD-02 | `identity-session.integration.spec.ts` | rotation emite `SESSION_ROTATED` | PASS |
| AUD-03 | `operational.integration.spec.ts` | start/close elevation emite eventos correctos | PASS |
| AUD-04 | `identity-session.integration.spec.ts` | sink async es awaited antes de retornar | PASS |
| AUD-05 | `session-service.ts`, `support-elevation.ts`, `typecheck` | constructores exigen AuditSink/SecurityEventSink; Noop no es default | PASS |

## PostgreSQL RLS

| ID | Test/archivo | Resultado | Estado |
| --- | --- | --- | --- |
| POC-01..POC-08 | `tenant-rls.integration.spec.ts` | 8/8 contra PostgreSQL 15.14 real | PASS |

La matriz se actualizará si una ejecución posterior cambia el resultado; no se declaran
aprobaciones productivas ni G4 con esta evidencia.
