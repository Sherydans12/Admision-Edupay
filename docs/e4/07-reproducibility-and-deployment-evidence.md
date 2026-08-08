# E4-E — Reproducibilidad y deployment evidence

## Control del paquete

| Campo | Valor |
| --- | --- |
| Alcance | E4-E — G4 readiness |
| Rama | `feat/e4-technical-foundation` |
| Base main | `6b2549333e25b65a44c97423a718b70a8d38937f` |
| PR | #7 — E4: Establish technical foundation and G4 readiness |
| Evidencia commit | `dc59f4ae529f66a0a13530f9feb7238ac86d28db` |
| Estado | `PASS_WITH_DEFERRED` para readiness; G4 `NO APROBADA` |

Esta evidencia demuestra una corrida local/development desde un volumen PostgreSQL
limpio. No aprovisiona infraestructura productiva, no contiene datos reales y no
autoriza E5, producción, piloto ni integración técnica EduPay.

## Clasificación de la evidencia

- **Hechos confirmados:** los comandos y resultados PASS de las tablas siguientes se
  ejecutaron en este workspace; las versiones se registran para reproducibilidad.
- **Decisiones aprobadas:** stack, runtime containerizado futuro, separación de roles,
  shared schema + RLS condicionada a PoC y límites de G4 según G1/G2/G3 y ADR-0001..0005.
- **Supuestos de trabajo:** Docker Desktop local es el entorno autorizado para el smoke;
  los puertos del smoke se eligen dinámicamente para evitar colisiones.
- **Preguntas abiertas:** proveedor de backup, retención, TLS, secretos, observabilidad,
  incident response productivo, datos reales, C-013 y Q-301..Q-309 permanecen diferidos.

## Baseline verificada

| Componente | Versión observada | Resultado |
| --- | --- | --- |
| Node.js | `22.18.0` | PASS |
| Corepack | `0.33.0` | PASS |
| pnpm | `10.19.0` | PASS |
| Docker Engine | `28.3.2` | PASS |
| Docker Compose | `2.39.1-desktop.1` | PASS |
| PostgreSQL | `15.14-alpine` / servidor `15.14` | PASS |
| Prisma | `7.9.1` | PASS |

## Corrida desde estado limpio

| Comando | Resultado observado | Evidencia | Estado |
| --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | Lockfile vigente; instalación completa | workspace raíz | PASS |
| `pnpm db:reset` | volumen local sintético recreado y PostgreSQL iniciado | Compose base | PASS |
| `pnpm db:generate` | Prisma Client generado | Prisma `7.9.1` | PASS |
| `pnpm db:migrate` | 3/3 migraciones forward aplicadas desde cero | `packages/database/prisma/migrations` | PASS |
| `pnpm format:check` | todos los archivos con formato válido | Prettier | PASS |
| `pnpm lint` | sin warnings ni errores | ESLint | PASS |
| `pnpm typecheck` | 4/4 proyectos compilados sin errores | TypeScript | PASS |
| `pnpm test` | 10 archivos; 62/62 tests PASS | suite raíz, RLS excluida | PASS |
| `pnpm test:rls` | 1 archivo; 8/8 tests PASS | PostgreSQL real | PASS |
| `pnpm build` | web/API/worker/database compilados | build de workspace | PASS |
| `pnpm security:secrets` | 165 archivos tracked inspeccionados; sin secretos | scan de secretos | PASS |
| `pnpm security:deps` | sin vulnerabilidades conocidas en nivel high | pnpm audit | PASS |
| `docker compose config` | configuración base válida; PostgreSQL conserva `127.0.0.1:55439` | Compose base | PASS |
| `docker compose -f compose.yaml -f compose.e4-readiness.yaml config` | overlay válido; puertos públicos sólo para API/web en localhost | Compose readiness | PASS |
| `docker compose -f compose.e4-recovery.yaml config` | dos bases aisladas y volumen separado válidos | Compose recovery | PASS |
| `git diff --check` | sin errores de whitespace | Git | PASS |

## Deployment smoke de development

Comando reproducible: `pnpm e4:deploy:smoke`.

| Control | Resultado observado | Estado |
| --- | --- | --- |
| PostgreSQL sintético saludable | `POSTGRES=PASS` | PASS |
| bootstrap/migrations | `MIGRATIONS=PASS`, migrator exit `0` | PASS |
| API liveness | `API_LIVE=PASS (200)` | PASS |
| API readiness | `API_READY=PASS (200)` con DB accesible | PASS |
| web HTTP | `WEB_HTTP_200=PASS (200)` | PASS |
| worker inicia | `WORKER_START=PASS` | PASS |
| worker persiste | `WORKER_PERSISTENCE=PASS` | PASS |
| servicios necesarios vivos | `SERVICES_ALIVE=PASS` | PASS |
| SIGTERM worker | `WORKER_SIGTERM=PASS (exit 0)` | PASS |
| limpieza | Compose dedicado baja volúmenes/procesos del ejercicio | PASS |

La corrida observó puertos locales `api:3310` y `web:3320`. Las imágenes de API, web,
worker y migrator están etiquetadas `DEVELOPMENT READINESS IMAGE`; no se etiquetan ni
presentan como `PRODUCTION READY`.

## Health y límites de runtime

Liveness sólo demuestra que el proceso API responde. Readiness ejecuta `SELECT 1` con la
configuración runtime `DATABASE_APP_URL`, usando el rol de aplicación; no usa el rol de
migraciones ni el superuser de bootstrap. La respuesta no expone connection string,
host privado, schema, credenciales ni secretos.

## Migraciones y recuperación

La estrategia actual es forward-only: Prisma aplica migraciones versionadas y no se crean
down migrations ficticias. Para cambios no destructivos se espera forward-fix; para una
recuperación destructiva se usa backup/restore según `docs/e4/08-recovery-evidence.md`.
El smoke de esta ronda demuestra una restauración lógica `pg_dump` + `psql` en una base
aislada, no un backup administrado por un proveedor.

La corrida fresh verificó 3/3 migraciones. No se declara aquí una prueba adicional de una
ruta incremental separada; las migraciones existentes permanecen cubiertas por CI y por
la aplicación forward desde una base limpia.

## CI

CI debe volver a verificarse sobre el commit final después del push. La workflow canónica
`.github/workflows/e4-foundation.yml` cubre instalación congelada, bootstrap, generate,
migrate, formato, lint, typecheck, tests, build, scans y RLS. El deployment y recovery
smoke de este paquete son pruebas locales/development explícitas y no crean infraestructura
productiva.

## Criterio de salida de esta evidencia

Los controles técnicos necesarios para solicitar revisión humana de G4 tienen evidencia
PASS. Los límites de E5, producción, legal/privacy y EduPay quedan explícitamente
`PASS_WITH_DEFERRED`, por lo que el resultado es readiness para revisión, no aprobación.
