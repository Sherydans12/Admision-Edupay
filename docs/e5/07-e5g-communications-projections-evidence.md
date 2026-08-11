# E5-G — Communications, Family Portal & Dashboard Operativo — Evidence Log

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

### 1. Build completo (`pnpm build`)

| Proyecto | Resultado |
|---|---|
| `@admission/database` | ✅ PASS |
| `apps/web` | ✅ PASS |
| `apps/api` | ✅ PASS |
| `apps/worker` | ✅ PASS |

### 2. Tests unitarios e integración (`pnpm test`)

- **332 tests passed** / 0 failed
- **27 test files** / 0 failed

Spec files E5-G relevantes:
- `packages/database/src/communications.integration.spec.ts` — 11/11 ✅
- `apps/api/src/communications-dashboard.http.integration.spec.ts` — 7/7 ✅
- `apps/worker/src/communication-worker.integration.spec.ts` — 4/4 ✅

### 3. Tests RLS (`pnpm test:rls`)

- **33 tests passed** / 0 failed
- **3 test files** / 0 failed
- `communications.rls.integration.spec.ts` — 3/3 ✅

### 4. Migration smoke (`pnpm e5g:migration:smoke`)

| Escenario | Resultado |
|---|---|
| `FRESH_0_TO_13` | ✅ PASS |
| `INCREMENTAL_12_TO_13` | ✅ PASS |
| `E5G_DB_SEALS` | ✅ PASS |

### 5. Seguridad

| Verificación | Resultado |
|---|---|
| `pnpm security:secrets` | ✅ PASS (251 archivos) |
| `pnpm security:deps` | ✅ PASS (0 vulnerabilidades) |
| `git diff --check` | ✅ PASS |

## Cobertura de criterios de aceptación

### AC-040..046 (Communications)
- AC-040: `prepareDecisionCommunication` crea PREPARED sin auto-envío ✅
- AC-041: `confirmCommunication` requiere `communication.confirm` capability ✅
- AC-042: Confirm → CONFIRMED + outbox send idempotente ✅
- AC-043: `processOutboxSend` → SENT con attempt y evidence ✅
- AC-044: Fallo de envío crea `OperationalTask` sin cambiar estado de negocio ✅
- AC-045: Privacidad de contenido y manejo DEVUELTO_A_REVISION ✅
- AC-046: Reminder para oferta ACTIVE, suprimido para ACCEPTED/WITHDRAWN ✅

### AC-025..027 (Family Portal)
- AC-025: Proyección de familia propia → 200 con datos seguros ✅
- AC-026: Familia extranjera denegada → 403 (ForbiddenError) ✅
- AC-027: Omisión de datos internos (score, recommendation, foundation, rank, capacity) ✅

### Dashboard Operativo
- Métricas calculadas server-side con aislamiento por tenant ✅
- Capability `dashboard.read` requerido ✅
- Wrong tenant → 403 ✅

## Archivos modificados (E5-G session)

### Nuevos
- `packages/database/prisma/migrations/013_communications/migration.sql`
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
- `scripts/e5g-migration-smoke.sh`

### Modificados
- `packages/database/src/prisma-client.ts` — Pool max 25
- `packages/database/src/tenant-execution-context.ts` — Export `getTenantContext`
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
- ✅ Q-106 DEFERRED, C-013 LEGAL_VALIDATION_PENDING
- ✅ Q-301..Q-309 no resueltos
- ✅ PR #8 OPEN / DRAFT / NO MERGE

## Compuerta

E5-G → COMPLETE. Siguiente acción humana: revisar PR #8 y aprobar G5.
