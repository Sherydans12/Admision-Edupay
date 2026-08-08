# E4-A/B/C/D — Baseline técnica

## Versiones exactas

| Componente | Versión fijada/usada |
| --- | --- |
| Node.js | `22.18.0` |
| pnpm | `10.19.0` |
| TypeScript | `5.9.3` |
| Next.js | `16.3.0` |
| React / React DOM | `19.2.8` |
| NestJS | `11.1.28` |
| Prisma CLI / Client | `7.9.1` |
| Prisma PostgreSQL adapter | `@prisma/adapter-pg@7.9.1` |
| PostgreSQL driver | `pg@8.23.0` |
| PostgreSQL local/CI | `15.14-alpine` |
| Tailwind CSS | `4.3.3` |
| ESLint | `9.39.2` |
| Prettier | `3.9.6` |
| Vitest | `4.1.10` |

Node 22.18.0 cumple Next 16 (`>=20.9`), Nest 11 (`>=20`) y Prisma 7.9.1
(`^20.19 || ^22.12 || >=24`). TypeScript permanece en 5.9.3 por compatibilidad declarada
de Prisma 7 y `typescript-eslint`; no se anticipa TypeScript 7.

## Estructura materializada

```text
apps/
  web/       Next.js App Router + React + Tailwind; pantalla sintética
  api/       NestJS; GET /health mínimo
  worker/    proceso Node TypeScript separado; sin jobs funcionales
  packages/
  database/  Prisma 7, identidad/sesión/authz, RLS, outbox y tests reales
infrastructure/
  postgres/init/  bootstrap local de roles/base/grants
.github/workflows/  CI mínima E4-A/B con PostgreSQL 15
```

El monorepo usa sólo pnpm workspaces y scripts raíz. No se añadieron Nx ni Turborepo. No
existe un paquete `shared` de dominio.

## Decisiones menores de implementación

- Todo el código Node propio usa ESM, requerido por Prisma 7.
- Prisma usa `prisma.config.ts`, generator `prisma-client` con output explícito ignorado por
  Git y el adapter oficial `@prisma/adapter-pg`; no se usó configuración legacy de Prisma 6.
- `DATABASE_MIGRATION_URL` y `DATABASE_APP_URL` están separados; runtime nunca recibe el
  rol bootstrap/migrator.
- La tabla PoC es owned por `admission_migrator`, mientras `admission_app` tiene sólo DML,
  no-superuser, sin `BYPASSRLS` y sin acceso a `_prisma_migrations`.
- RLS usa un custom setting PostgreSQL transaction-local y `FORCE ROW LEVEL SECURITY`.
- El puerto host local es `55439` para no interferir con PostgreSQL existentes; el puerto
  interno y el servicio CI permanecen en `5432`.
- CI instala frozen, genera Prisma, aplica migración, ejecuta formato/lint/typecheck/tests/
  build y luego la PoC RLS real.
- Las tablas de identidad control-plane (`PlatformUser`, `PlatformSession`, `Tenant`) están
  separadas de tablas tenant-owned (`Membership`, `RoleAssignment`, `SupportElevation`,
  `OutboxMessage`). No hay DML en default privileges; cada migración entrega grants explícitos.
- La sesión es opaque server-side: CSPRNG de 256 bits, hash SHA-256, expiración idle/absolute,
  rotación y revocación. La autorización es deny-by-default y la elevación de soporte es
  temporal, tenant-scoped y auditable.
- E4-D añade correlación, logging JSON con redacción, errores uniformes, health/readiness,
  AuditEvent/SecurityEvent, outbox PostgreSQL y adapters no-op/fake sin proveedores externos.

## Clasificación de la información

- **Hechos confirmados:** versiones y resultados de ejecución descritos; PostgreSQL 15.14
  saludable; migración aplicada; `POC-01..POC-08` pasan.
- **Decisiones aprobadas:** stack ADR-0001, modular monolith ADR-0002 y shared-schema + RLS
  condicionado ADR-0003.
- **Supuestos de trabajo:** puerto local `55439` y pool PoC `max=4`; son reversibles y no
  constituyen decisiones productivas.
- **Preguntas abiertas:** Q-301..Q-309 permanecen sin resolver y fuera de alcance.

## Riesgos y deuda explícita

- Las primitivas de identidad reciben fixtures internos sintéticos; el login y onboarding
  funcional siguen diferidos a etapas posteriores.
- La política cubre sólo `TenantProbeRecord`; cada futura tabla tenant-owned necesita RLS,
  constraints same-tenant y regresiones propias.
- El puerto local puede requerir ajuste coordinado si `55439` se ocupa en otro equipo.
- El cliente Prisma generado no se versiona: todo ambiente debe ejecutar `pnpm db:generate`.
- La CI incluye formato, calidad, tests, build, RLS, escaneo de secretos y auditoría de
  dependencias; los actions externos aún usan tags versionados como deuda de hardening.
- Las credenciales Compose son públicas, sintéticas y exclusivas de desarrollo; no son un
  patrón para secretos ni infraestructura productiva.

## Diferidos y fuera de alcance

No se implementaron login UI, registro familiar ni módulos funcionales, documentos, actividades,
decisiones, cupos, waitlist, ofertas, comunicaciones, Redis/BullMQ, S3, email, malware ni
integración técnica EduPay. Tampoco se creó infraestructura productiva ni se resolvieron
Q-301..Q-309. G4 permanece `NO APROBADA`.
