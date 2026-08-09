# E4 — Fundación técnica

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E4 — Fundación técnica |
| Estado | `CLOSED / TECHNICAL FOUNDATION APPROVED` |
| Inicio autorizado | `2026-08-08T15:30:00-04:00` |
| Cierre aprobado | `2026-08-08T20:25:00-04:00` |
| Base inicial | `main` en `6b2549333e25b65a44c97423a718b70a8d38937f` |
| Rama | `feat/e4-technical-foundation` |
| Commit técnico aprobado | `cb5d4be14fd9149a20e1acd36b5dfad563c2836a` |
| Dependencia | G3 `APPROVED / CLOSED` |
| G4 | `APPROVED / CLOSED` |
| Resultado | `PASS_WITH_DEFERRED` |
| Datos permitidos durante E4/E5 | Sólo sintéticos/non-production |
| Infraestructura productiva | No autorizada |
| Integración técnica EduPay | No autorizada |
| Registro | `docs/approvals/G4-mvp-construction-approval-2026-08-08.md` |

## Estado de incrementos

| Incremento | Estado | Evidencia |
| --- | --- | --- |
| E4-A — Repository and toolchain foundation | `COMPLETE` | Monorepo pnpm instalable, lintable, typecheckable, testeable y compilable; web/API/worker separados |
| E4-B — PostgreSQL, Prisma y PoC tenant/RLS | `COMPLETE` | PostgreSQL 15.14 real, Prisma 7.9.1 y `POC-01..POC-08` con 8/8 tests `PASS` |
| E4-C — Identity/session/authorization foundation | `COMPLETE` | Sesión opaca, tenant resolution, deny-by-default, SoD, SELF-ELEVATION y frontera platform/RLS endurecida |
| E4-D — Operational foundation | `COMPLETE` | Correlación, logs sanitizados, errores, health/readiness, auditoría, outbox, adapters y CI |
| E4-E — G4 readiness | `COMPLETE` | Deployment/recovery/reproducibilidad, ownership, alcance E5 y checklist `PASS_WITH_DEFERRED` |

La evidencia reproducible está en `docs/e4/01-local-development.md`,
`docs/e4/02-tenant-rls-poc.md`, `docs/e4/04-identity-session-authorization.md`,
`docs/e4/05-operational-foundation.md`, `docs/e4/06-e4-security-evidence.md`,
`docs/e4/07-reproducibility-and-deployment-evidence.md`,
`docs/e4/08-recovery-evidence.md`, `docs/e4/09-residual-risks-and-operational-ownership.md`,
`docs/e4/10-g4-mvp-scope-and-exit.md` y `docs/e4/11-g4-readiness-checklist.md`.

G4 fue aprobada explícitamente sobre el commit técnico `cb5d4be14fd9149a20e1acd36b5dfad563c2836a`. E4 queda cerrada y E5 queda autorizada dentro del alcance y límites registrados en el acta G4.

## Objetivo cumplido

E4 creó una base técnica mínima, segura, testeable y reversible para construir el MVP sin introducir todavía datos reales ni integración técnica con EduPay.

## Arquitectura materializada

- modular monolith;
- monorepo independiente de EduPay;
- TypeScript;
- Next.js para web;
- NestJS para API;
- worker separado;
- pnpm workspaces;
- PostgreSQL y Prisma;
- shared schema con `tenantId` obligatorio para datos tenant-owned;
- RLS/FORCE RLS como defensa en profundidad;
- opaque server-side sessions para web MVP;
- autorización deny-by-default;
- separación Platform/Tenant execution context;
- SELF-ELEVATION explícita, temporal y auditable;
- jobs/outbox PostgreSQL;
- object storage, email y malware detrás de contratos/adapters;
- runtime Linux containerizado como dirección productiva futura, probado sólo en local/development.

## Evidencia principal

- `pnpm test`: `62/62 PASS`;
- `pnpm test:rls`: `8/8 PASS`;
- `SES-01..SES-16`: PASS;
- `AUTH-01..AUTH-12`: PASS;
- `PLAT-01..PLAT-03`: PASS;
- `ELEV-01..ELEV-08`: PASS;
- `AUD-01..AUD-05`: PASS;
- `TRUST-01..TRUST-08`: PASS;
- `POC-01..POC-08`: PASS;
- fresh migrations `3/3`: PASS;
- secret scan final: `180` archivos tracked, PASS;
- dependency audit: sin vulnerabilidades conocidas en nivel high;
- deployment smoke local/development: PASS;
- recovery smoke `REC-01..REC-08`: PASS;
- recovery observado: `31.807 s`, sin convertirlo en RTO productivo;
- CI final sobre el commit aprobado: PASS.

## Condiciones y diferidos

RPO `1 hora` y RTO `4 horas` siguen siendo objetivos técnicos iniciales, no SLA. C-013, datos reales, piloto, producción, secretos productivos, proveedores productivos, incident response productivo e integración EduPay/Q-301..Q-309 permanecen fuera de la autorización G4.

## Autorización resultante

G4 autoriza iniciar E5 para construir el MVP funcional dentro de:

- `BL-001..BL-022`;
- `AC-001..AC-058`;
- `E2E-001..E2E-022`.

Durante E5 sólo se permiten datos sintéticos/non-production e infraestructura local/development necesaria hasta que una compuerta posterior autorice algo adicional.

## Próxima etapa

E5 — construcción del MVP funcional. G5 permanece no aprobada y será la compuerta para cualquier piloto/datos reales conforme a sus requisitos.