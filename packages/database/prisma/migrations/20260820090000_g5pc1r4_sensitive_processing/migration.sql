-- G5-PC1-R4: sensitive processing categories, fail-closed builder/documents,
-- personality report classification, and tenant processing policy.
-- No sensitive data is backfilled. No existing classification is guessed.

-- 1. Processing category enum (R4-001, R4-002).
CREATE TYPE "ProcessingCategory" AS ENUM (
  'ORDINARY_ADMISSION',
  'SUPPORT_ACCOMMODATION',
  'PIE_NEE_DIAGNOSTIC',
  'HEALTH'
);

-- 2. Document classification enum (R4-010).
CREATE TYPE "DocumentClassification" AS ENUM (
  'GENERIC',
  'PERSONALITY_DEVELOPMENT_REPORT'
);

-- 3. Processing category on form fields (nullable, R4-007).
ALTER TABLE "form_fields" ADD COLUMN "processing_category" "ProcessingCategory";

-- 4. Processing category and document classification on document requirement versions
--    (R4-009, R4-010).
ALTER TABLE "document_requirement_versions"
  ADD COLUMN "processing_category" "ProcessingCategory",
  ADD COLUMN "document_classification" "DocumentClassification" NOT NULL DEFAULT 'GENERIC';

-- 5. Tenant-scoped sensitive processing policy (R4-003..R4-005, R4-012).
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
CREATE UNIQUE INDEX "sensitive_processing_policies_tenant_id_key"
  ON "sensitive_processing_policies"("tenant_id", "id");
CREATE UNIQUE INDEX "sensitive_processing_policies_tenant_category_key"
  ON "sensitive_processing_policies"("tenant_id", "category");

-- 6. Ownership: all new objects owned by admission_migrator.
ALTER TABLE "sensitive_processing_policies" OWNER TO admission_migrator;

-- 7. Grants: admission_app gets SELECT, INSERT, UPDATE; no DELETE on policy.
REVOKE ALL ON TABLE "sensitive_processing_policies" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "sensitive_processing_policies" TO admission_app;

-- 8. RLS: enable and force on new tenant-scoped table.
ALTER TABLE "sensitive_processing_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sensitive_processing_policies" FORCE ROW LEVEL SECURITY;

CREATE POLICY "sensitive_processing_policies_tenant_isolation"
  ON "sensitive_processing_policies"
  AS PERMISSIVE
  FOR ALL
  TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  );
