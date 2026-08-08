# E4 — Evidencia de seguridad

Resultados registrados tras la validación local de esta entrega. Comando base:
`pnpm test` (37 tests), `pnpm test:rls` (8 tests) y los checks raíz descritos en
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

## PostgreSQL RLS

| ID | Test/archivo | Resultado | Estado |
| --- | --- | --- | --- |
| POC-01..POC-08 | `tenant-rls.integration.spec.ts` | 8/8 contra PostgreSQL 15.14 real | PASS |

La matriz se actualizará si una ejecución posterior cambia el resultado; no se declaran
aprobaciones productivas ni G4 con esta evidencia.
