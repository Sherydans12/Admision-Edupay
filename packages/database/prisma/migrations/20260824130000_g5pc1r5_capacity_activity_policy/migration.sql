-- G5-PC1-R5 (PC1-TECH-013..015): explicit publication concurrency and tenant activity policy.
-- Forward-only and additive. No tenant, capacity, membership, executor, or policy seed is created.

CREATE TYPE "ActivityDurationSource" AS ENUM ('TENANT_KIND_DEFAULT', 'VERSION_OVERRIDE');

ALTER TABLE "admission_offerings"
  ADD COLUMN "concurrency_version" INTEGER NOT NULL DEFAULT 1;

-- All pre-R5 entry points required an explicit duration. A temporary default performs
-- the compatibility backfill without mutating the immutable historical rows through
-- their UPDATE trigger; new writes must always resolve and provide the source.
ALTER TABLE "activity_definition_versions"
  ADD COLUMN "duration_source" "ActivityDurationSource" NOT NULL DEFAULT 'VERSION_OVERRIDE';
ALTER TABLE "activity_definition_versions"
  ALTER COLUMN "duration_source" DROP DEFAULT;

CREATE TABLE "tenant_activity_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "kind" "ActivityDefinitionKind" NOT NULL,
  "default_duration_minutes" INTEGER NOT NULL,
  "primary_membership_id" UUID NOT NULL,
  "backup_membership_id" UUID NOT NULL,
  "concurrency_version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_activity_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_activity_policies_duration_check"
    CHECK ("default_duration_minutes" BETWEEN 1 AND 1440),
  CONSTRAINT "tenant_activity_policies_executors_differ_check"
    CHECK ("primary_membership_id" <> "backup_membership_id"),
  CONSTRAINT "tenant_activity_policies_version_check"
    CHECK ("concurrency_version" > 0),
  CONSTRAINT "tenant_activity_policies_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tenant_activity_policies_primary_membership_fkey"
    FOREIGN KEY ("tenant_id", "primary_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_activity_policies_backup_membership_fkey"
    FOREIGN KEY ("tenant_id", "backup_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_activity_policies_tenant_id_key"
  ON "tenant_activity_policies"("tenant_id", "id");
CREATE UNIQUE INDEX "tenant_activity_policies_tenant_kind_key"
  ON "tenant_activity_policies"("tenant_id", "kind");
CREATE INDEX "tenant_activity_policies_primary_membership_idx"
  ON "tenant_activity_policies"("tenant_id", "primary_membership_id");
CREATE INDEX "tenant_activity_policies_backup_membership_idx"
  ON "tenant_activity_policies"("tenant_id", "backup_membership_id");

ALTER TABLE "tenant_activity_policies" OWNER TO admission_migrator;
REVOKE ALL ON TABLE "tenant_activity_policies" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenant_activity_policies" TO admission_app;

ALTER TABLE "tenant_activity_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_activity_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_activity_policies_tenant_isolation"
  ON "tenant_activity_policies" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

-- Extend the existing immutable-history guard so the newly added source is protected
-- alongside the effective duration for every published or archived version.
CREATE OR REPLACE FUNCTION admission_guard_activity_definition_version_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."lifecycle" <> 'DRAFT' AND current_user = 'admission_app' THEN
    RAISE EXCEPTION 'published activity definition version cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."lifecycle" IN ('PUBLISHED', 'ARCHIVED') THEN
    IF NOT (
      OLD."lifecycle" = 'PUBLISHED' AND NEW."lifecycle" = 'ARCHIVED'
      AND NEW."archived_at" IS NOT NULL
      AND NEW."id" = OLD."id" AND NEW."tenant_id" = OLD."tenant_id"
      AND NEW."activity_definition_id" = OLD."activity_definition_id"
      AND NEW."version_number" = OLD."version_number"
      AND NEW."required" = OLD."required" AND NEW."modality" = OLD."modality"
      AND NEW."duration_minutes" = OLD."duration_minutes"
      AND NEW."duration_source" = OLD."duration_source"
      AND NEW."max_normal_reschedules" = OLD."max_normal_reschedules"
      AND NEW."late_tolerance_minutes" = OLD."late_tolerance_minutes"
      AND NEW."instructions" IS NOT DISTINCT FROM OLD."instructions"
      AND NEW."scope_academic_year_id" IS NOT DISTINCT FROM OLD."scope_academic_year_id"
      AND NEW."scope_process_id" IS NOT DISTINCT FROM OLD."scope_process_id"
      AND NEW."scope_course_level_id" IS NOT DISTINCT FROM OLD."scope_course_level_id"
      AND NEW."scope_offering_id" IS NOT DISTINCT FROM OLD."scope_offering_id"
      AND NEW."created_at" = OLD."created_at" AND NEW."published_at" = OLD."published_at"
    ) THEN
      RAISE EXCEPTION 'published activity definition version is immutable' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION admission_guard_activity_definition_version_history() OWNER TO admission_migrator;
