-- E5-A review hardening: explicit global audit scope and relational invariants.

CREATE TYPE "AuditEventScope" AS ENUM ('TENANT', 'PLATFORM_GLOBAL');

ALTER TABLE "audit_events"
  ADD COLUMN "scope" "AuditEventScope" NOT NULL DEFAULT 'TENANT',
  ALTER COLUMN "tenant_id" DROP NOT NULL;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_scope_tenant_coherence"
  CHECK (
    ("scope" = 'TENANT' AND "tenant_id" IS NOT NULL)
    OR ("scope" = 'PLATFORM_GLOBAL' AND "tenant_id" IS NULL)
  ),
  ADD CONSTRAINT "audit_events_platform_global_action_check"
  CHECK (
    "scope" = 'TENANT'
    OR "action" IN (
      'FAMILY_PROFILE_CREATED',
      'FAMILY_PROFILE_UPDATED',
      'STUDENT_CREATED',
      'STUDENT_UPDATED'
    )
  );

CREATE UNIQUE INDEX "admission_processes_tenant_id_id_academic_year_id_key"
  ON "admission_processes"("tenant_id", "id", "academic_year_id");

CREATE UNIQUE INDEX "admission_offerings_tenant_id_id_process_id_academic_year_id_key"
  ON "admission_offerings"("tenant_id", "id", "process_id", "academic_year_id");

ALTER TABLE "admission_offerings"
  DROP CONSTRAINT "admission_offerings_tenant_process_fkey",
  ADD CONSTRAINT "admission_offerings_tenant_process_year_fkey"
  FOREIGN KEY ("tenant_id", "process_id", "academic_year_id")
  REFERENCES "admission_processes"("tenant_id", "id", "academic_year_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "applications"
  DROP CONSTRAINT "applications_tenant_offering_fkey",
  ADD CONSTRAINT "applications_tenant_offering_process_year_fkey"
  FOREIGN KEY ("tenant_id", "offering_id", "process_id", "academic_year_id")
  REFERENCES "admission_offerings"("tenant_id", "id", "process_id", "academic_year_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE POLICY "audit_events_platform_global_insert" ON "audit_events"
  AS PERMISSIVE FOR INSERT TO admission_app
  WITH CHECK (
    "scope" = 'PLATFORM_GLOBAL'
    AND "tenant_id" IS NULL
    AND NULLIF(current_setting('admission.audit_scope', true), '') = 'platform_global'
  );

-- The migration/inspection role may verify global audit evidence, never tenant audit rows.
CREATE POLICY "audit_events_platform_global_migration_read" ON "audit_events"
  AS PERMISSIVE FOR SELECT TO admission_migrator
  USING ("scope" = 'PLATFORM_GLOBAL');
