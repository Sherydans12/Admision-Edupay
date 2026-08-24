# E5-G — Communications, Proyecciones y Dashboard — Evidence Log

## Fecha de ejecución

2026-08-11

## Estado

**COMPLETE**

## Resumen

Implementación completa del vertical slice E5-G que incluye:

- **BL-015**: Comunicaciones (preparar, confirmar, enviar, reintentar, evidencia de entrega, contacto manual)
- **BL-016**: Portal Familiar (proyección segura de aplicación, privacidad de datos internos)
- **BL-017**: Dashboard Operativo (métricas por tenant con aislamiento RLS)

## Validaciones ejecutadas

### Validación local

#### 1. Format / Lint / Typecheck

| Verificación | Resultado |
|---|---|
| `pnpm format:check` | ✅ PASS |
| `pnpm lint` | ✅ PASS |
| `pnpm typecheck` | ✅ PASS |

#### 2. Build completo (`pnpm build`)

| Proyecto | Resultado |
|---|---|
| `@admission/database` | ✅ PASS |
| `apps/web` | ✅ PASS |
| `apps/api` | ✅ PASS |
| `apps/worker` | ✅ PASS |

#### 3. Tests unitarios e integración (`pnpm test`)

- **332 tests passed** / 0 failed
- **27 test files** / 0 failed

Spec files E5-G relevantes:
- `packages/database/src/communications.integration.spec.ts` — 11/11 ✅
- `apps/api/src/communications-dashboard.http.integration.spec.ts` — 7/7 ✅
- `apps/worker/src/communication-worker.integration.spec.ts` — 4/4 ✅

#### 4. Tests RLS (`pnpm test:rls`)

- **33 tests passed** / 0 failed
- **3 test files** / 0 failed
- `communications.rls.integration.spec.ts` — 3/3 ✅

#### 5. Migration smoke (`pnpm e5g:migration:smoke`)

| Escenario | Resultado |
|---|---|
| `FRESH_0_TO_13` | ✅ PASS |
| `INCREMENTAL_12_TO_13` | ✅ PASS |
| `E5G_DB_SEALS` | ✅ PASS |

#### 6. Seguridad

| Verificación | Resultado |
|---|---|
| `pnpm security:secrets` | ✅ PASS (269 archivos) |
| `pnpm security:deps` | ✅ PASS (0 vulnerabilidades) |
| `git diff --check` | ✅ PASS |

### Validación GitHub Actions

| Verificación | Resultado |
|---|---|
| HEAD validado | `9d44a46d24fc7a791d43efd91be236d9f35568f8` |
| Run | `31545007981` |
| Job | `validate` / `93955501044` |
| Conclusion | `success` |
| `pnpm format:check` | ✅ PASS |
| `pnpm lint` | ✅ PASS |
| `pnpm typecheck` | ✅ PASS |
| `pnpm test` | ✅ 332/332 |
| `pnpm build` | ✅ PASS |
| secret scan | ✅ PASS (269 archivos) |
| dependency audit | ✅ PASS (0 vulnerabilidades) |
| `pnpm test:rls` | ✅ 33/33 |
| `FRESH_0_TO_12` | ✅ PASS |
| `INCREMENTAL_11_TO_12` | ✅ PASS |
| `E5F_DB_SEALS` | ✅ PASS |
| `FRESH_0_TO_13` | ✅ PASS |
| `INCREMENTAL_12_TO_13` | ✅ PASS |
| `E5G_DB_SEALS` | ✅ PASS |

## Cobertura de criterios de aceptación

### AC-040..AC-043 (Communication)

- AC-040: `prepareDecisionCommunication` crea PREPARED sin auto-envío ✅
- AC-041: `confirmCommunication` requiere `communication.confirm` capability ✅
- AC-042: Confirm → CONFIRMED + outbox send idempotente ✅
- AC-043: `processOutboxSend` → SENT con attempt y evidence ✅

### AC-044..AC-046 (Dashboard)

- AC-044: Métricas calculadas server-side con aislamiento por tenant ✅
- AC-045: Capability `dashboard.read` requerido ✅
- AC-046: Wrong tenant → 403 ✅

### AC-025..AC-027 (Disposición de Dirección — efectos downstream en E5-G)

E5-G completa los efectos downstream de comunicación y proyección segura
derivados de las disposiciones de Dirección:

- AC-025: Comunicación de disposición preparada correctamente según tipo de decisión ✅
- AC-026: Proyección familiar omite datos internos (score, recommendation, foundation, rank, capacity) ✅
- AC-027: Familia extranjera denegada → 403 (ForbiddenError) ✅

Nota: los criterios AC-025..AC-027 se refieren a Disposición de Dirección
(slice E5-E). E5-G documenta la cobertura de sus efectos downstream
(comunicación y proyección segura), no la cobertura primaria de dichos criterios.

## Archivos modificados (E5-G session)

### Nuevos

- `packages/database/prisma/migrations/20260811190000_e5g_communications_projections/migration.sql`
- `packages/database/src/communications.ts`
- `packages/database/src/communications.integration.spec.ts`
- `packages/database/src/communications.rls.integration.spec.ts`
- `packages/database/src/family-projection.ts`
- `packages/database/src/dashboard.ts`
- `packages/database/src/email-adapter.ts`
- `apps/api/src/communications.controller.ts`
- `apps/api/src/communications.service.ts`
- `apps/api/src/family-portal.controller.ts`
- `apps/api/src/family-portal.service.ts`
- `apps/api/src/dashboard.controller.ts`
- `apps/api/src/dashboard.service.ts`
- `apps/api/src/communications-dashboard.http.integration.spec.ts`
- `apps/worker/src/communication-worker.integration.spec.ts`
- `apps/web/app/communications-dashboard-workflows.tsx`
- `scripts/e5g-migration-smoke.mjs`

### Modificados

- `packages/database/src/prisma-client.ts` — Pool max 25
- `packages/database/src/tenant-execution-context.ts` — Export `getTenantContext`
- `packages/database/src/tenant-transaction.ts` — Transaction isolation helpers
- `packages/database/src/index.ts` — Exports E5-G
- `packages/database/src/permission-catalog.ts` — Communication/dashboard/manual_contact permissions
- `packages/database/prisma/schema.prisma` — Communication, CommunicationAttempt, ManualContact, OperationalTask models
- `apps/api/src/app.module.ts` — Register E5-G controllers/services
- `apps/worker/src/worker.ts` — CommunicationWorker
- `.github/workflows/e4-foundation.yml` — E5-G migration smoke step

## Restricciones respetadas

- ✅ Solo datos sintéticos / dominios `.invalid`
- ✅ Infraestructura local/development
- ✅ Zero EduPay / Zero IntegrationHandoff
- ✅ `DevelopmentEmailAdapter` sin proveedor real
- ✅ Q-106 DEFERRED
- ✅ C-013 LEGAL_VALIDATION_PENDING
- ✅ Q-301..Q-309 FUTURE_INTEGRATION_PENDING
- ✅ PR #8 OPEN / DRAFT / NO MERGE

## Compuerta

- E5-G → `COMPLETE`
- E5-H → `NOT_STARTED`
- E5-I → `NOT_STARTED`
- G5 → `NO APROBADA`

Siguiente acción humana: revisar E5-G y decidir explícitamente si autoriza iniciar E5-H.
