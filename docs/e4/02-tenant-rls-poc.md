# E4-B — PoC tenant / PostgreSQL RLS / Prisma

## Resultado ejecutado

| Campo | Evidencia real |
| --- | --- |
| Fecha | `2026-08-08` |
| PostgreSQL | `15.14` (`postgres:15.14-alpine`) |
| Prisma | `7.9.1` + `@prisma/adapter-pg@7.9.1` + `pg@8.23.0` |
| Comando | `pnpm test:rls` |
| Resultado | `1` archivo, `8` tests, `8 PASS`, `0 FAIL` |
| Datos | UUID y labels exclusivamente sintéticos |

## Matriz ADR-0003

| ID | Objetivo | Test / archivo | Comando | Resultado real y evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| POC-01 | Request con tenant A sólo ve A | `tenant-rls.integration.spec.ts` — `request context tenant A only sees tenant A` | `pnpm test:rls` | Contexto `authenticated_request` vio sólo `request-a`; el registro B no fue proyectado | `PASS` |
| POC-02 | Job con tenant B sólo ve B | mismo archivo — `trusted job context tenant B only sees tenant B` | `pnpm test:rls` | Metadata interna sintética `trusted_job` vio sólo labels y UUID del tenant B | `PASS` |
| POC-03 | Ausencia de contexto deniega | mismo archivo — `absence of context denies application and database access` | `pnpm test:rls` | La primitive lanzó `TenantContextMissingError`; SELECT directo devolvió cero e INSERT directo falló por RLS | `PASS` |
| POC-04 | Tenant A no lee/escribe B | mismo archivo — `tenant A cannot read, update, or insert tenant B records` | `pnpm test:rls` | SELECT ocultó B, UPDATE afectó 0 filas e INSERT A→B fue denegado por `WITH CHECK` | `PASS` |
| POC-05 | Pooling sin contaminación | mismo archivo — `alternating and concurrent pooled transactions never leak tenants` | `pnpm test:rls` | 40 transacciones A/B alternadas y concurrentes sobre pool `max=4`; cada resultado fue del tenant efectivo y luego SELECT sin contexto devolvió cero | `PASS` |
| POC-06 | Prisma + transacción + RLS | mismo archivo — `Prisma operations work inside a context-setting transaction` | `pnpm test:rls` | CREATE y SELECT Prisma funcionaron en la misma interactive transaction después de `set_config(..., true)` | `PASS` |
| POC-07 | Roles runtime/migración separados | mismo archivo — `runtime and migration roles are distinct and runtime cannot bypass RLS` | `pnpm test:rls` | Runtime=`admission_app`, migración=`admission_migrator`; ambos no-superuser/sin BYPASSRLS; tabla owned por migrator con RLS y FORCE RLS activos | `PASS` |
| POC-08 | Error siempre fail-closed | mismo archivo — `errors roll back and cannot degrade later operations to global access` | `pnpm test:rls` | Error sintético revirtió INSERT; la operación posterior sin contexto vio cero y el registro no persistió | `PASS` |

Ruta completa del test: `packages/database/src/tenant-rls.integration.spec.ts`.

## Implementación

`TenantExecutionContext` usa `AsyncLocalStorage`. `runWithTenantContext(...)` valida y
congela un contexto interno; `getRequiredTenantContext()` falla cerrado si no existe. Los
harnesses de request/job están marcados `TEST / SYNTHETIC CONTEXT`: simulan membership
resuelta o metadata trusted y no exponen un header público ni aceptan tenant del cliente
como autoridad.

`withTenantTransaction(...)` obtiene el tenant requerido y abre una interactive
transaction Prisma. Dentro ejecuta:

```sql
SELECT set_config('admission.tenant_id', <tenant interno>, true)
```

El tercer argumento `true` limita el valor a la transacción. Al commit/rollback PostgreSQL
lo descarta; por eso una conexión reutilizada por `pg` no conserva el tenant. La prueba
POC-05 fuerza reutilización mediante 40 operaciones concurrentes/alternadas y confirma
otra lectura sin contexto después del cierre.

La política `tenant_probe_isolation` aplica `USING` y `WITH CHECK` a `admission_app`. La
tabla tiene RLS y `FORCE ROW LEVEL SECURITY`; el runtime no es dueño, superuser ni
`BYPASSRLS`. RLS complementa —no sustituye— contexto aplicativo, autorización futura,
constraints same-tenant y pruebas negativas.

## Límite

`TenantProbeRecord` es infraestructura de PoC, no modelo funcional definitivo. E4-C debe
alimentar la primitive desde sesión/membership server-side y autorización deny-by-default.
Este PASS satisface la condición técnica ADR-0003 para E4-B, pero no aprueba G4.
