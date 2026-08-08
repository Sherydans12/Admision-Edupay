# G4 — Aprobación de construcción MVP (DRAFT)

> **Estado: DRAFT / NOT APPROVED**

Este registro es un borrador para decisión humana. No constituye aprobación por haber sido
creado, revisado, commiteado, enviado al PR o mantenido en draft.

## Identificación de evidencia

| Campo | Valor |
| --- | --- |
| PR | #7 — E4: Establish technical foundation and G4 readiness |
| Rama | `feat/e4-technical-foundation` |
| Base main | `6b2549333e25b65a44c97423a718b70a8d38937f` |
| Commit de evidencia | `dc59f4ae529f66a0a13530f9feb7238ac86d28db` |
| E4-A | `COMPLETE` |
| E4-B | `COMPLETE` |
| E4-C | `COMPLETE` |
| E4-D | `COMPLETE` |
| E4-E | `COMPLETE` |
| E4 | `IN PROGRESS / READY FOR G4 REVIEW` |
| G4 | `NO APROBADA` |
| E5 | `NO AUTORIZADA` |

## Baseline y validación

- Node `22.18.0`, Corepack `0.33.0`, pnpm `10.19.0`.
- Docker Engine `28.3.2`, Docker Compose `2.39.1-desktop.1`.
- PostgreSQL `15.14`, Prisma `7.9.1`.
- `pnpm install --frozen-lockfile`, format, lint, typecheck y build: PASS.
- `pnpm test`: 10 archivos, 62/62 PASS.
- `pnpm test:rls`: 1 archivo, 8/8 PASS.
- `pnpm security:secrets`: 165 archivos tracked inspeccionados, PASS.
- `pnpm security:deps`: sin vulnerabilidades conocidas en nivel high, PASS.
- fresh database: 3/3 migrations forward aplicadas, PASS.
- `git diff --check`: PASS.

## Evidencia de controles

| Área | Evidencia | Resultado |
| --- | --- | --- |
| SES | `SES-01..SES-16` | PASS |
| AUTH | `AUTH-01..AUTH-12` | PASS |
| PLAT | `PLAT-01..PLAT-03` | PASS |
| ELEV | `ELEV-01..ELEV-08` | PASS |
| AUD | `AUD-01..AUD-05` | PASS |
| TRUST | `TRUST-01..TRUST-08` | PASS |
| POC | `POC-01..POC-08` | PASS |
| Tenancy/RLS post-restore | `REC-04`, `REC-05`, `REC-06`, `REC-07` | PASS |

## Deployment y recovery

`pnpm e4:deploy:smoke` demostró en local/development:

- PostgreSQL saludable y migrations aplicadas;
- API liveness 200 y readiness 200 contra DB con app role;
- web HTTP 200;
- worker iniciado, persistente y terminado limpiamente con SIGTERM;
- servicios necesarios vivos y limpieza automática.

Las imágenes están etiquetadas `DEVELOPMENT READINESS IMAGE`, no `PRODUCTION READY`.

`pnpm e4:recovery:smoke` demostró backup lógico y restore en una base aislada:

- `REC-01..REC-08`: PASS;
- dump observado: `27723` bytes;
- tiempo observado: `31807 ms` (`31.807 s`);
- `admission_app` continúa sin superuser/BYPASSRLS;
- cross-tenant y ausencia de contexto permanecen DENY.

El tiempo no demuestra RTO. RPO `1 hora` y RTO `4 horas` son objetivos técnicos iniciales
pendientes de revalidación con infraestructura/proveedor real.

## Alcance que G4 autorizaría

Si la decisión humana aprueba G4, autorizaría construir E5 dentro de `BL-001..BL-022`,
`AC-001..AC-058` y `E2E-001..E2E-022`: schemas/migrations funcionales, API, UI,
worker/jobs, adapters seguros de almacenamiento/documentos, pruebas funcionales y la
infraestructura local/development necesaria, usando sólo datos sintéticos/non-production.

G4 no autorizaría por sí sola datos reales, piloto, producción, secretos productivos,
aceptación legal C-013, integración EduPay/Q-301..Q-309 ni G5.

## Riesgos residuales y diferidos

- `BLOCKING_G4`: ninguno identificado.
- `BLOCKING_G5`: C-013/legal privacy, real-data authorization, P0 funcional y controles
  operacionales productivos antes de piloto.
- `DEFERRED_TO_E5`: MVP funcional, email, object storage/malware adapters, sinks durables,
  documentos privados, concurrencia, accesibilidad y comunicaciones.
- `PRODUCTION_READINESS`: secretos, TLS/reverse proxy, CSRF multi-instancia, monitoring,
  alerting, backup provider/retención, RPO/RTO, escala, proveedor/región, deployment,
  incident response y Q-301..Q-309.
- `ACCEPTED_TECHNICAL_DEBT`: migrations forward-only, credenciales sintéticas locales,
  heartbeat sin jobs de negocio y límites de smoke local.

## Owners

El owner funcional/técnico está identificado en las fuentes aprobadas
(`docs/00-vision-scope.md` y `docs/01-source-analysis.md`) y cubre desarrollo técnico,
seguridad técnica, PostgreSQL/migrations, CI, cambio y incident response de
local/development durante E4. El nombre no se duplica aquí por minimización de datos
personales. Owner legal/production incident response y backup productivo requieren
`OWNER_CONFIRMATION_REQUIRED` (`Q-205`); no es bloqueo G4 para construir E5 con datos
sintéticos.

## Decisión humana solicitada

Texto sugerido:

> **G4 — APPROVED / CONSTRUCTION AUTHORIZED**, sobre el commit de evidencia indicado y
> dentro del alcance `BL-001..BL-022`, `AC-001..AC-058` y `E2E-001..E2E-022`, autoriza
> iniciar E5 para construir el MVP funcional de Admisión con datos exclusivamente
> sintéticos/non-production y sólo infraestructura local/development necesaria. Esta
> aprobación no autoriza datos reales, piloto, producción, secretos productivos,
> aceptación legal C-013, integración técnica EduPay/Q-301..Q-309 ni G5. Las condiciones
> diferidas y los criterios de salida para solicitar G5 permanecen vigentes.

La aprobación debe ser fechada, identificar aprobador(es), commit revisado, excepciones y
condiciones. Hasta que se complete ese registro, G4 permanece `NO APROBADA` y PR #7
permanece `DRAFT / NO MERGE`.
