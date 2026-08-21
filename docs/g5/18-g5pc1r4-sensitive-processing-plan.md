# G5-PC1-R4 — Plan de implementación: categorías de procesamiento sensible

## Alcance

PC1-R4 implementa el diseño humano aprobado PC1-R4A: separar sensibilidad técnica de
un dato (`sensitivity`) de su categoría semántica/de procesamiento
(`processingCategory`). Cubre campos configurables (`FormField`), requisitos
documentales (`DocumentRequirementVersion`), política tenant de habilitación por
categoría, clasificación documental institucional (`PERSONALITY_DEVELOPMENT_REPORT`) y
guards fail-closed en builder, publicación, documentos y familia.

R4 aborda exclusivamente:

- `PC1-TECH-003` — gating de tratamiento sensible;
- `PC1-TECH-010` — health disabled by default;
- `PC1-TECH-011` — PIE/NEE diagnosis/clinical disabled by default;
- `PC1-TECH-012` — personality report disabled/configurable by course.

## Estado de entrada

| Elemento | Estado canónico |
| --- | --- |
| Branch | `feat/e5-mvp` |
| Starting HEAD | `bd268321e746731ba27d13ef0fb73bdc5058f563` |
| PR #8 | `OPEN / DRAFT / NO MERGE` |
| Migration 17 | `ACCEPTED / IMMUTABLE` (`20260816070000_g5pc1r12_authority_core`) |
| Migration 18 | `ABSENT` |
| Migration 19 | `ABSENT / NOT AUTHORIZED` |
| PC1-R12 | `COMPLETE / TECHNICALLY_ACCEPTED` |
| PC1-R12H | `COMPLETE / CI_GREEN` |
| PC1-TECH-003 | `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4` |
| PC1-TECH-010 | `PARTIAL` |
| PC1-TECH-011 | `PARTIAL` |
| PC1-TECH-012 | `PARTIAL` |
| G5-EXIT-10..12 | `BLOCKED` |
| G5 | `NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |

## Mapping PC1-TECH → implementación

| ID canónico | Definición (resumen exacto de PC1D) | Implementación R4 |
| --- | --- | --- |
| `PC1-TECH-003` | Gating de tratamiento sensible: no existe guard para tratamiento sensible no verificado; `FormField.sensitivity` controla sensibilidad técnica, no authority | ProcessingCategory enum, policy table, publish guards, submission guards, authority integration |
| `PC1-TECH-010` | Health disabled by default: no hay catálogo de salud; no existe policy-level disabled-by-default | `HEALTH` processing category con `enabled = false` por defecto; publish deny si disabled |
| `PC1-TECH-011` | PIE/NEE diagnosis/clinical disabled by default: no hay catálogo PIE/NEE ni guard de diagnóstico clínico | `PIE_NEE_DIAGNOSTIC` processing category con `enabled = false` por defecto; publish deny si disabled |
| `PC1-TECH-012` | Personality report disabled/configurable by course: `DocumentRequirement` soporta scope pero no `DOC-03` ni activation flag | `DocumentClassification` enum con `PERSONALITY_DEVELOPMENT_REPORT`; policy disabled by default; activation explícita per scope |

No existen discrepancias entre las definiciones canónicas y este prompt. R4 no toca
PC1-TECH-001/002/004/005/006 (ya cerrados por R12/R12H) ni 007..009/013..015 (fuera de
alcance).

## Schema previsto

### Enums nuevos

```sql
-- Categoría semántica/de procesamiento del dato (R4-001, R4-002).
CREATE TYPE "ProcessingCategory" AS ENUM (
  'ORDINARY_ADMISSION',
  'SUPPORT_ACCOMMODATION',
  'PIE_NEE_DIAGNOSTIC',
  'HEALTH'
);

-- Clasificación documental institucional (R4-010).
CREATE TYPE "DocumentClassification" AS ENUM (
  'GENERIC',
  'PERSONALITY_DEVELOPMENT_REPORT'
);
```

### Columnas nuevas en modelos existentes

```sql
-- FormField: processing category nullable (R4-007).
ALTER TABLE "form_fields" ADD COLUMN "processing_category" "ProcessingCategory";

-- DocumentRequirementVersion: processing category nullable + document classification.
ALTER TABLE "document_requirement_versions"
  ADD COLUMN "processing_category" "ProcessingCategory",
  ADD COLUMN "document_classification" "DocumentClassification" NOT NULL DEFAULT 'GENERIC';
```

### Tabla nueva: sensitive_processing_policies

```sql
CREATE TABLE "sensitive_processing_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "category" "ProcessingCategory" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "purpose" VARCHAR(200),
  "activated_by" UUID,
  "activated_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sensitive_processing_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sensitive_processing_policies_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sensitive_processing_policies_actor_fkey"
    FOREIGN KEY ("activated_by") REFERENCES "platform_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sensitive_processing_policies_tenant_category_key"
  ON "sensitive_processing_policies"("tenant_id", "category");
```

Política inicial efectiva (fail-closed): ausencia de fila = disabled para HEALTH y
PIE_NEE_DIAGNOSTIC. ORDINARY_ADMISSION y SUPPORT_ACCOMMODATION no requieren fila
(por diseño siempre habilitados).

## Invariantes

1. **R4-006:** `AUTHORITY_VERIFIED` ≠ `HEALTH_PROCESSING_AUTHORIZED` ni
   `PIE_NEE_DIAGNOSTIC_PROCESSING_AUTHORIZED`. Authority es condición adicional,
   no habilita categoría deshabilitada.
2. **R4-007:** Todo campo family-facing `HIGHLY_RESTRICTED` debe tener
   `processingCategory` explícita y válida. `PUBLISH = DENY` si falta.
3. **R4-008:** Si `FormField.processingCategory = HEALTH` y tenant tiene
   `HEALTH.enabled = false`, entonces `PUBLISH = DENY`. Igual para
   `PIE_NEE_DIAGNOSTIC`.
4. **R4-009:** Mismas reglas para `DocumentRequirementVersion`:
   HIGHLY_RESTRICTED + missing category = deny; HEALTH/PIE disabled = deny.
5. **R4-010:** `PERSONALITY_DEVELOPMENT_REPORT` es clasificación separada de
   HEALTH y PIE. `enabled = false` por defecto. Activación explícita per scope.
6. **R4-011:** No NLP, no regex, no scanning semántico, no LLM. Clasificación
   estructurada/configurada por operador autorizado.
7. **R4-012:** Activación de categoría sensible requiere capability específica,
   propósito, actor, auditoría, before/after, timestamp y tenant.

## Matriz de autorización

| Acción | Capability requerida | Notas |
| --- | --- | --- |
| Read policy | `admission.config.read` | Cualquier miembro tenant activo |
| Update category enabled/disabled | `admission.config.manage` + capability check | Requiere `SENSITIVE_PROCESSING_CONFIGURE` |
| Set field processing category | `form.manage` | En DRAFT solamente |
| Set doc requirement processing category | `document.requirement.manage` | En DRAFT solamente |
| Publish form version | `form.publish` | + R4 guards |
| Publish doc requirement version | `document.requirement.publish` | + R4 guards |
| Submit sensitive answer | `application.submit` | + authority check + category enabled |

### Nueva capability

```
SENSITIVE_PROCESSING_CONFIGURE = "admission.sensitive_processing.configure"
```

Deny default. No asignada implícitamente a todos los admins. Debe añadirse
explícitamente al role assignment del operador autorizado.

## Matriz fail-closed

| Condición | Resultado |
| --- | --- |
| HIGHLY_RESTRICTED field + NULL processingCategory | PUBLISH = DENY |
| HEALTH field + HEALTH disabled | PUBLISH = DENY |
| PIE_NEE_DIAGNOSTIC field + PIE disabled | PUBLISH = DENY |
| HEALTH doc requirement + HEALTH disabled | PUBLISH = DENY |
| PIE doc requirement + PIE disabled | PUBLISH = DENY |
| HIGHLY_RESTRICTED doc requirement + NULL processingCategory | PUBLISH = DENY |
| PERSONALITY_DEVELOPMENT_REPORT doc + not enabled for scope | PUBLISH = DENY |
| Sensitive answer submission + category disabled | SUBMIT = DENY |
| Sensitive answer + authority required + authority not VERIFIED | SUBMIT = DENY |
| Sensitive answer + valid authority + category enabled | SUBMIT = ALLOW |
| Missing policy row for HEALTH/PIE | = DISABLED (fail closed) |
| Published immutable version | Cannot reclassify; create new version |

## Pruebas requeridas

### Suite dedicada R4

| ID | Descripción | Tipo |
| --- | --- | --- |
| R4-MIG-01 | Fresh 0→18 PASS | migration smoke |
| R4-MIG-02 | Incremental 17→18 PASS | migration smoke |
| R4-MIG-03 | Migration 17 unchanged | migration smoke |
| R4-MIG-04 | Migration 19 absent | migration smoke |
| R4-CAT-01..05 | Persistencia de categorías e independencia de sensitivity | integration |
| R4-POL-01..05 | Default policy (OA=on, SA=on, PIE=off, HEALTH=off, missing=off) | integration |
| R4-PUB-01..07 | Builder publication guards | integration + HTTP |
| R4-AUTH-01..07 | Authority + category integration | integration |
| R4-DOC-01..05 | Document requirement guards | integration + HTTP |
| R4-PER-01..06 | Personality report classification | integration |
| R4-SEC-01..04 | Authorization / capability / tenant | integration |
| R4-AUD-01..03 | Audit evidence | integration |
| R4-RLS-* | New table RLS coverage | integration |
| R4-HTTP-* | Direct HTTP evidence (8+ scenarios) | HTTP |

### Regresión obligatoria

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:rls`,
`pnpm build`, `pnpm security:secrets`, `pnpm security:deps`, `git diff --check`.

## Deferred/out-of-scope

- Real pilot, production, real data (`NOT AUTHORIZED`).
- EduPay technical integration.
- Q-301..Q-309.
- Productive providers (email, storage, malware, Grafana).
- Final legal basis, DPA, privacy notice.
- Numeric retention matrix, DSR full module.
- Arbitrary health consent flow, generic medical record, full PIE module.
- AI classification, NLP, OCR semantic classification.
- Payment, enrollment.
- Migration 19.
- C-013, G5-EXIT-10..12, G5.
- PC1-TECH-007..009, 013..015.
