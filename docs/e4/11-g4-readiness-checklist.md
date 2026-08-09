# E4-E — G4 readiness checklist

## Resultado

| Campo | Resultado |
| --- | --- |
| Readiness | `PASS_WITH_DEFERRED` |
| E4-E | `COMPLETE` |
| E4 | `IN PROGRESS / READY FOR G4 REVIEW` |
| G4 | `NO APROBADA` |
| E5 | `NO AUTORIZADA` |
| BLOCKING_G4 | Ninguno identificado |

Los únicos estados de esta checklist son `PASS`, `PASS_WITH_DEFERRED` y `BLOCKED`.
`blocking?` indica si la fila impediría solicitar revisión G4; los diferidos corresponden
a E5, G5, legal/privacy o producción y no se maquillan como controles implementados.

| Sección | status | evidence | blocking? | notes |
| --- | --- | --- | --- | --- |
| A. Repository/toolchain | PASS | `pnpm install --frozen-lockfile`; Node `22.18.0`; pnpm `10.19.0`; lockfile vigente | No | monorepo reproducible |
| B. Build | PASS | `pnpm build`; web/API/worker/database PASS | No | imágenes separadas para smoke |
| C. Testing | PASS | `pnpm test` 62/62 y `pnpm test:rls` 8/8 | No | tests RLS contra PostgreSQL real |
| D. PostgreSQL/Prisma | PASS | PostgreSQL `15.14`; Prisma `7.9.1`; 3/3 migrations desde base limpia | No | roles bootstrap/migrator/app separados |
| E. Tenancy/RLS | PASS | PoC `POC-01..POC-08`; recovery REC-04/06/07 | No | cross-tenant y sin contexto DENY |
| F. Platform boundary | PASS | `TRUST-01..TRUST-08` en `docs/e4/06-e4-security-evidence.md` | No | platform GUCs no sustituyen contexto tenant |
| G. Sessions | PASS | `SES-01..SES-16` | No | rotation, revoke y expiración cubiertas |
| H. Authorization | PASS | `AUTH-01..AUTH-12` | No | deny-by-default, tenant, scope, purpose y sensitivity |
| I. SELF-ELEVATION | PASS | `ELEV-01..ELEV-08` | No | elevación explícita, acotada, auditable y revocable |
| J. CSRF | PASS_WITH_DEFERRED | `SES-12`; validación operacional local | No | estrategia multi-instancia productiva queda diferida |
| K. Audit/security events | PASS | `AUD-01..AUD-05`; sinks requeridos por constructores | No | sinks durables productivos quedan en E5/producción |
| L. Outbox/worker | PASS | smoke: worker inicia, persiste y termina con SIGTERM `exit 0` | No | no se implementan jobs de negocio |
| M. Logging/errors/health | PASS | logs sanitizados, errores y `API_LIVE`/`API_READY` 200 | No | readiness consulta DB con app role sin revelar secretos |
| N. Secret/dependency security | PASS | secret scan: 165 archivos; dependency audit: sin vulnerabilidades high | No | sólo credenciales sintéticas locales |
| O. Development deployment | PASS | `pnpm e4:deploy:smoke`; web/API/worker/PostgreSQL PASS | No | sólo local/development; imágenes no productivas |
| P. Recovery | PASS | `pnpm e4:recovery:smoke`; REC-01..REC-08 PASS; 31.807 s observado | No | base recovery separada; RPO/RTO no son SLA |
| Q. Reproducibility | PASS | `docs/e4/07-reproducibility-and-deployment-evidence.md` | No | desde instalación y volumen limpio |
| R. MVP scope | PASS_WITH_DEFERRED | `BL-001..BL-022`, `AC-001..AC-058`, `E2E-001..E2E-022` | No | alcance confirmado; capacidades aún no construidas |
| S. Exit criteria | PASS_WITH_DEFERRED | `docs/e4/10-g4-mvp-scope-and-exit.md` | No | criterios para G5 definidos, no ejecutados |
| T. Operational ownership | PASS_WITH_DEFERRED | ownership técnico trazado a fuentes aprobadas | No | owner productivo/legal requiere confirmación (`Q-205`) |
| U. Deferred/legal/production boundaries | PASS_WITH_DEFERRED | `docs/e4/09-residual-risks-and-operational-ownership.md` | No | C-013, real data, producción, EduPay y G5 continúan bloqueados por alcance |

## Lectura para G4

No existe `BLOCKED` técnico material para construir E5 con datos sintéticos en local/
development. La salida recomendada es `PASS_WITH_DEFERRED`, sujeta a revisión y decisión
humana. Esta checklist no aprueba G4, no autoriza E5 por sí sola y no autoriza producción.
