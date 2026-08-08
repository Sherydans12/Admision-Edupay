# E4 — Desarrollo local

## Alcance

Esta guía levanta exclusivamente la fundación técnica E4-A/B/C/D con datos sintéticos. No
crea infraestructura productiva, funcionalidades del MVP ni integración con EduPay.

## Requisitos verificados

| Herramienta | Versión usada |
| --- | --- |
| Node.js | `22.18.0` LTS |
| Corepack | `0.33.0` |
| pnpm | `10.19.0` |
| Docker Engine | `28.3.2` |
| Docker Compose | `2.39.1-desktop.1` |

Node debe cumplir `>=22.12.0 <23`. El repositorio fija `pnpm@10.19.0` mediante
`packageManager`; Corepack debe estar habilitado.

## Instalación

```bash
corepack enable
corepack prepare pnpm@10.19.0 --activate
pnpm install --frozen-lockfile
```

Copiar `.env.example` como `.env`. Sus valores son credenciales sintéticas locales y
no deben reutilizarse en otros ambientes. `.env` está ignorado por Git.

## PostgreSQL local

```bash
pnpm db:up
docker compose ps
```

Compose usa `postgres:15.14-alpine`, publica el servicio local en `localhost:55439` y
crea tres fronteras de rol:

- `admission_bootstrap`: administración exclusiva del contenedor local durante init;
- `admission_migrator`: dueño no-superuser para migraciones;
- `admission_app`: runtime no-superuser, sin `BYPASSRLS`, con DML mínimo.

El bootstrap vive en `infrastructure/postgres/init/001-bootstrap.sql` y sólo se ejecuta
cuando PostgreSQL inicializa un volumen vacío. Si el script cambia, se debe recrear el
volumen sintético local con `pnpm db:reset`; este comando elimina únicamente el volumen
Compose de este proyecto y vuelve a levantar PostgreSQL.

Para detener sin eliminar el volumen:

```bash
pnpm db:down
```

## Prisma y migraciones

Con PostgreSQL saludable y `.env` creado:

```bash
pnpm db:generate
pnpm db:migrate
```

Prisma CLI usa exclusivamente `DATABASE_MIGRATION_URL`. El runtime y las pruebas de
aislamiento usan `DATABASE_APP_URL`; no deben intercambiarse.

## Procesos de desarrollo

Ejecutar cada proceso en una terminal independiente:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

- web: pantalla sintética Next.js en `http://localhost:3000`;
- API: `GET http://localhost:3001/health`, sin datos sensibles;
- worker: proceso independiente con heartbeat sintético, sin jobs funcionales.

## Calidad y pruebas

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:rls
pnpm security:secrets
pnpm security:deps
```

`pnpm test` ejecuta tests unitarios y de integración contra PostgreSQL real (excepto la
suite RLS separada). `pnpm test:rls` requiere PostgreSQL real,
bootstrap y migración aplicada; no utiliza mocks para afirmar aislamiento.

## Recuperación del entorno sintético

Si las migraciones o roles locales quedan desalineados:

```bash
pnpm db:reset
pnpm db:generate
pnpm db:migrate
pnpm test:rls
```

No usar `db:reset` sobre datos que deban conservarse. E4-A/B no autoriza datos reales.
