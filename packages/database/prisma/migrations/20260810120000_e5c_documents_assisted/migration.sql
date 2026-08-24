-- E5-C: versioned private documents and assisted application evidence.
-- Forward-only. Synthetic/non-production use; no production storage or AV provider.

CREATE TYPE "ApplicationOrigin" AS ENUM ('SELF_SERVICE', 'ASSISTED');
CREATE TYPE "DocumentRequirementLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "DocumentValidityRule" AS ENUM ('NONE', 'LATEST_AVAILABLE', 'MAX_AGE_DAYS');
CREATE TYPE "DocumentFunctionalStatus" AS ENUM ('PENDIENTE', 'CARGADO', 'EN_REVISION', 'ACEPTADO', 'OBSERVADO', 'EXENTO');
CREATE TYPE "DocumentTechnicalStatus" AS ENUM (
  'UPLOAD_PENDING', 'QUARANTINED', 'PROCESSING', 'READY_FOR_REVIEW',
  'BLOCKED_INVALID', 'BLOCKED_INFECTED', 'BLOCKED_UNSCANNABLE',
  'BLOCKED_SCAN_ERROR', 'UPLOAD_FAILED'
);
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'UNSCANNABLE', 'ERROR');
CREATE TYPE "DocumentOrigin" AS ENUM ('SELF_SERVICE', 'ASSISTED', 'PHYSICAL_DOCUMENT');
CREATE TYPE "DocumentReviewVerdict" AS ENUM ('ACCEPTED', 'OBSERVED', 'EXEMPTED');
CREATE TYPE "AssistanceSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "AssistanceAuthorizationMethod" AS ENUM ('IN_PERSON_CONFIRMED');

CREATE TABLE "document_requirements" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "purpose" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_requirements_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_requirements_text_check" CHECK (
    length(btrim("code")) > 0 AND length(btrim("name")) > 0 AND length(btrim("purpose")) > 0
  )
);
CREATE UNIQUE INDEX "document_requirements_tenant_id_id_key" ON "document_requirements"("tenant_id", "id");
CREATE UNIQUE INDEX "document_requirements_tenant_id_code_key" ON "document_requirements"("tenant_id", "code");
CREATE INDEX "document_requirements_tenant_id_name_idx" ON "document_requirements"("tenant_id", "name");

CREATE TABLE "document_requirement_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "document_requirement_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "lifecycle" "DocumentRequirementLifecycle" NOT NULL DEFAULT 'DRAFT',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "instruction" VARCHAR(1000),
  "sensitivity" VARCHAR(40) NOT NULL,
  "scope_academic_year_id" UUID,
  "scope_process_id" UUID,
  "scope_course_level_id" UUID,
  "scope_offering_id" UUID,
  "condition_form_version_id" UUID,
  "condition_field_id" UUID,
  "condition_operator" "FormConditionOperator",
  "condition_value" JSONB,
  "allows_equivalent" BOOLEAN NOT NULL DEFAULT false,
  "equivalent_options" JSONB,
  "validity_rule" "DocumentValidityRule" NOT NULL DEFAULT 'NONE',
  "max_age_days" INTEGER,
  "allowed_file_types" JSONB NOT NULL,
  "max_file_size_bytes" BIGINT NOT NULL,
  "correction_window_business_days" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(3),
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "document_requirement_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_requirement_versions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_requirement_versions_requirement_fkey" FOREIGN KEY ("tenant_id", "document_requirement_id") REFERENCES "document_requirements"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_requirement_versions_year_fkey" FOREIGN KEY ("tenant_id", "scope_academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_requirement_versions_process_fkey" FOREIGN KEY ("tenant_id", "scope_process_id") REFERENCES "admission_processes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_requirement_versions_course_fkey" FOREIGN KEY ("tenant_id", "scope_course_level_id") REFERENCES "course_levels"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_requirement_versions_offering_fkey" FOREIGN KEY ("tenant_id", "scope_offering_id") REFERENCES "admission_offerings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "doc_req_versions_condition_form_fkey" FOREIGN KEY ("tenant_id", "condition_form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "doc_req_versions_condition_field_fkey" FOREIGN KEY ("tenant_id", "condition_form_version_id", "condition_field_id") REFERENCES "form_fields"("tenant_id", "form_version_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_requirement_versions_number_check" CHECK ("version_number" > 0),
  CONSTRAINT "document_requirement_versions_sensitivity_check" CHECK ("sensitivity" IN ('internal', 'restricted', 'highly_restricted')),
  CONSTRAINT "document_requirement_versions_limits_check" CHECK (
    "max_file_size_bytes" > 0 AND "correction_window_business_days" > 0
  ),
  CONSTRAINT "document_requirement_versions_validity_check" CHECK (
    ("validity_rule" = 'MAX_AGE_DAYS' AND "max_age_days" > 0)
    OR ("validity_rule" <> 'MAX_AGE_DAYS' AND "max_age_days" IS NULL)
  ),
  CONSTRAINT "document_requirement_versions_condition_check" CHECK (
    ("condition_form_version_id" IS NULL AND "condition_field_id" IS NULL AND "condition_operator" IS NULL AND "condition_value" IS NULL)
    OR ("condition_form_version_id" IS NOT NULL AND "condition_field_id" IS NOT NULL AND "condition_operator" IS NOT NULL AND "condition_value" IS NOT NULL AND "scope_offering_id" IS NOT NULL)
  ),
  CONSTRAINT "document_requirement_versions_equivalent_check" CHECK (
    ("allows_equivalent" AND "equivalent_options" IS NOT NULL)
    OR (NOT "allows_equivalent" AND "equivalent_options" IS NULL)
  ),
  CONSTRAINT "document_requirement_versions_lifecycle_check" CHECK (
    ("lifecycle" = 'DRAFT' AND "published_at" IS NULL AND "archived_at" IS NULL)
    OR ("lifecycle" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "archived_at" IS NULL)
    OR ("lifecycle" = 'ARCHIVED' AND "published_at" IS NOT NULL AND "archived_at" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "document_requirement_versions_tenant_id_id_key" ON "document_requirement_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "doc_req_versions_tenant_requirement_id_key" ON "document_requirement_versions"("tenant_id", "document_requirement_id", "id");
CREATE UNIQUE INDEX "doc_req_versions_tenant_requirement_number_key" ON "document_requirement_versions"("tenant_id", "document_requirement_id", "version_number");
CREATE UNIQUE INDEX "document_requirement_versions_one_published_key" ON "document_requirement_versions"("tenant_id", "document_requirement_id") WHERE "lifecycle" = 'PUBLISHED';
CREATE INDEX "document_requirement_versions_tenant_offering_idx" ON "document_requirement_versions"("tenant_id", "lifecycle", "scope_offering_id");
CREATE INDEX "document_requirement_versions_tenant_scope_idx" ON "document_requirement_versions"("tenant_id", "lifecycle", "scope_process_id", "scope_course_level_id");

CREATE TABLE "assistance_sessions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "operator_user_id" UUID NOT NULL,
  "operator_role_snapshot" VARCHAR(120) NOT NULL,
  "family_profile_id" UUID NOT NULL,
  "adult_responsible_user_id" UUID NOT NULL,
  "adult_present_confirmed" BOOLEAN NOT NULL,
  "authorization_confirmed" BOOLEAN NOT NULL,
  "authorization_method" "AssistanceAuthorizationMethod" NOT NULL,
  "authorization_recorded_at" TIMESTAMPTZ(3),
  "started_at" TIMESTAMPTZ(3) NOT NULL,
  "ended_at" TIMESTAMPTZ(3),
  "status" "AssistanceSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "correlation_id" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistance_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistance_sessions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assistance_sessions_family_fkey" FOREIGN KEY ("family_profile_id") REFERENCES "family_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assistance_sessions_authorization_check" CHECK (
    ("adult_present_confirmed" AND "authorization_confirmed" AND "authorization_recorded_at" IS NOT NULL)
    OR (NOT "adult_present_confirmed" OR NOT "authorization_confirmed") AND "authorization_recorded_at" IS NULL
  ),
  CONSTRAINT "assistance_sessions_status_check" CHECK (
    ("status" = 'ACTIVE' AND "ended_at" IS NULL) OR ("status" = 'CLOSED' AND "ended_at" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "assistance_sessions_tenant_id_id_key" ON "assistance_sessions"("tenant_id", "id");
CREATE INDEX "assistance_sessions_tenant_operator_status_idx" ON "assistance_sessions"("tenant_id", "operator_user_id", "status");

ALTER TABLE "applications"
  ADD COLUMN "origin" "ApplicationOrigin" NOT NULL DEFAULT 'SELF_SERVICE',
  ADD COLUMN "assistance_session_id" UUID,
  ADD COLUMN "document_requirements_pinned_at" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "applications_tenant_assistance_session_key" ON "applications"("tenant_id", "assistance_session_id");
ALTER TABLE "applications" ADD CONSTRAINT "applications_assistance_session_fkey"
  FOREIGN KEY ("tenant_id", "assistance_session_id") REFERENCES "assistance_sessions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_origin_assistance_check" CHECK (
  ("origin" = 'SELF_SERVICE' AND "assistance_session_id" IS NULL)
  OR ("origin" = 'ASSISTED' AND "assistance_session_id" IS NOT NULL)
);

CREATE TABLE "document_submissions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "document_requirement_id" UUID NOT NULL,
  "requirement_version_id" UUID NOT NULL,
  "status" "DocumentFunctionalStatus" NOT NULL DEFAULT 'PENDIENTE',
  "current_document_version_id" UUID,
  "correction_due_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_submissions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_submissions_application_fkey" FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_submissions_requirement_fkey" FOREIGN KEY ("tenant_id", "document_requirement_id") REFERENCES "document_requirements"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_submissions_version_fkey" FOREIGN KEY ("tenant_id", "document_requirement_id", "requirement_version_id") REFERENCES "document_requirement_versions"("tenant_id", "document_requirement_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_submissions_correction_check" CHECK (
    ("status" = 'OBSERVADO' AND "correction_due_at" IS NOT NULL) OR "status" <> 'OBSERVADO'
  )
);
CREATE UNIQUE INDEX "document_submissions_tenant_id_id_key" ON "document_submissions"("tenant_id", "id");
CREATE UNIQUE INDEX "document_submissions_application_requirement_key" ON "document_submissions"("tenant_id", "application_id", "document_requirement_id");
CREATE UNIQUE INDEX "document_submissions_current_version_key" ON "document_submissions"("tenant_id", "current_document_version_id");
CREATE INDEX "document_submissions_application_status_idx" ON "document_submissions"("tenant_id", "application_id", "status");

CREATE TABLE "document_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "document_submission_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "display_name_sanitized" VARCHAR(180) NOT NULL,
  "declared_mime" VARCHAR(80) NOT NULL,
  "detected_mime" VARCHAR(80),
  "size_bytes" BIGINT NOT NULL,
  "sha256" CHAR(64),
  "quarantine_object_key" VARCHAR(160) NOT NULL,
  "approved_object_key" VARCHAR(160),
  "technical_status" "DocumentTechnicalStatus" NOT NULL,
  "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  "scan_provider" VARCHAR(80),
  "scan_engine_version" VARCHAR(80),
  "scan_signature_version" VARCHAR(120),
  "origin" "DocumentOrigin" NOT NULL,
  "uploaded_by" UUID NOT NULL,
  "document_issued_on" DATE,
  "equivalent_option_code" VARCHAR(80),
  "replaces_version_id" UUID,
  "replaced_at" TIMESTAMPTZ(3),
  "safe_error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMPTZ(3),
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_versions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_versions_submission_fkey" FOREIGN KEY ("tenant_id", "document_submission_id") REFERENCES "document_submissions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_versions_number_size_check" CHECK ("version_number" > 0 AND "size_bytes" >= 0),
  CONSTRAINT "document_versions_sha_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "document_versions_ready_check" CHECK (
    ("technical_status" = 'READY_FOR_REVIEW' AND "scan_status" = 'CLEAN' AND "approved_object_key" IS NOT NULL AND "detected_mime" IS NOT NULL AND "sha256" IS NOT NULL AND "ready_at" IS NOT NULL)
    OR "technical_status" <> 'READY_FOR_REVIEW'
  )
);
CREATE UNIQUE INDEX "document_versions_tenant_id_id_key" ON "document_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "document_versions_submission_number_key" ON "document_versions"("tenant_id", "document_submission_id", "version_number");
CREATE INDEX "document_versions_submission_status_idx" ON "document_versions"("tenant_id", "document_submission_id", "technical_status");
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_replaces_fkey"
  FOREIGN KEY ("tenant_id", "replaces_version_id") REFERENCES "document_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_submissions" ADD CONSTRAINT "document_submissions_current_version_fkey"
  FOREIGN KEY ("tenant_id", "current_document_version_id") REFERENCES "document_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "document_reviews" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "document_submission_id" UUID NOT NULL,
  "document_version_id" UUID,
  "verdict" "DocumentReviewVerdict" NOT NULL,
  "reason" VARCHAR(1000),
  "correction_due_at" TIMESTAMPTZ(3),
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_reviews_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_reviews_submission_fkey" FOREIGN KEY ("tenant_id", "document_submission_id") REFERENCES "document_submissions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_reviews_version_fkey" FOREIGN KEY ("tenant_id", "document_version_id") REFERENCES "document_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_reviews_verdict_check" CHECK (
    ("verdict" = 'ACCEPTED' AND "document_version_id" IS NOT NULL AND "reason" IS NULL AND "correction_due_at" IS NULL)
    OR ("verdict" = 'OBSERVED' AND "document_version_id" IS NOT NULL AND length(btrim("reason")) > 0 AND "correction_due_at" IS NOT NULL)
    OR ("verdict" = 'EXEMPTED' AND length(btrim("reason")) > 0 AND "correction_due_at" IS NULL)
  )
);
CREATE UNIQUE INDEX "document_reviews_tenant_id_id_key" ON "document_reviews"("tenant_id", "id");
CREATE INDEX "document_reviews_submission_created_idx" ON "document_reviews"("tenant_id", "document_submission_id", "created_at");

ALTER TABLE "application_snapshots" DROP CONSTRAINT "application_snapshots_schema_version_check";
ALTER TABLE "application_snapshots" ADD CONSTRAINT "application_snapshots_schema_version_check" CHECK ("schema_version" IN (1, 2));

CREATE OR REPLACE FUNCTION admission_guard_document_requirement_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."lifecycle" <> 'DRAFT' THEN
    RAISE EXCEPTION 'published document requirement version cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."lifecycle" IN ('PUBLISHED', 'ARCHIVED') THEN
    IF NOT (
      OLD."lifecycle" = 'PUBLISHED' AND NEW."lifecycle" = 'ARCHIVED'
      AND NEW."archived_at" IS NOT NULL
      AND NEW."id" = OLD."id" AND NEW."tenant_id" = OLD."tenant_id"
      AND NEW."document_requirement_id" = OLD."document_requirement_id"
      AND NEW."version_number" = OLD."version_number"
      AND NEW."required" = OLD."required"
      AND NEW."instruction" IS NOT DISTINCT FROM OLD."instruction"
      AND NEW."sensitivity" = OLD."sensitivity"
      AND NEW."scope_academic_year_id" IS NOT DISTINCT FROM OLD."scope_academic_year_id"
      AND NEW."scope_process_id" IS NOT DISTINCT FROM OLD."scope_process_id"
      AND NEW."scope_course_level_id" IS NOT DISTINCT FROM OLD."scope_course_level_id"
      AND NEW."scope_offering_id" IS NOT DISTINCT FROM OLD."scope_offering_id"
      AND NEW."condition_form_version_id" IS NOT DISTINCT FROM OLD."condition_form_version_id"
      AND NEW."condition_field_id" IS NOT DISTINCT FROM OLD."condition_field_id"
      AND NEW."condition_operator" IS NOT DISTINCT FROM OLD."condition_operator"
      AND NEW."condition_value" IS NOT DISTINCT FROM OLD."condition_value"
      AND NEW."allows_equivalent" = OLD."allows_equivalent"
      AND NEW."equivalent_options" IS NOT DISTINCT FROM OLD."equivalent_options"
      AND NEW."validity_rule" = OLD."validity_rule"
      AND NEW."max_age_days" IS NOT DISTINCT FROM OLD."max_age_days"
      AND NEW."allowed_file_types" = OLD."allowed_file_types"
      AND NEW."max_file_size_bytes" = OLD."max_file_size_bytes"
      AND NEW."correction_window_business_days" = OLD."correction_window_business_days"
      AND NEW."created_at" = OLD."created_at" AND NEW."published_at" = OLD."published_at"
    ) THEN
      RAISE EXCEPTION 'published document requirement version is immutable' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "document_requirement_versions_history_immutable"
  BEFORE UPDATE OR DELETE ON "document_requirement_versions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_document_requirement_history();

CREATE OR REPLACE FUNCTION admission_guard_document_current_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."current_document_version_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "document_versions" v
    WHERE v."tenant_id" = NEW."tenant_id"
      AND v."document_submission_id" = NEW."id"
      AND v."id" = NEW."current_document_version_id"
      AND v."technical_status" = 'READY_FOR_REVIEW'
  ) THEN
    RAISE EXCEPTION 'current document version must be ready and belong to submission' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "document_submissions_current_version_guard"
  BEFORE INSERT OR UPDATE OF "current_document_version_id" ON "document_submissions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_document_current_version();

CREATE OR REPLACE FUNCTION admission_guard_document_review_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION 'document review is append-only' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "document_reviews_immutable"
  BEFORE UPDATE OR DELETE ON "document_reviews"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_document_review_immutable();

CREATE OR REPLACE FUNCTION admission_list_active_tenant_ids_for_worker()
RETURNS TABLE (tenant_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM tenants WHERE status = 'ACTIVE' ORDER BY id
$$;

ALTER TABLE "document_requirements" OWNER TO admission_migrator;
ALTER TABLE "document_requirement_versions" OWNER TO admission_migrator;
ALTER TABLE "document_submissions" OWNER TO admission_migrator;
ALTER TABLE "document_versions" OWNER TO admission_migrator;
ALTER TABLE "document_reviews" OWNER TO admission_migrator;
ALTER TABLE "assistance_sessions" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_document_requirement_history() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_document_current_version() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_document_review_immutable() OWNER TO admission_migrator;
ALTER FUNCTION admission_list_active_tenant_ids_for_worker() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "document_requirements", "document_requirement_versions", "document_submissions", "document_versions", "document_reviews", "assistance_sessions" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "document_requirements", "document_requirement_versions", "document_submissions", "document_versions", "assistance_sessions" TO admission_app;
GRANT SELECT, INSERT ON TABLE "document_reviews" TO admission_app;
REVOKE ALL ON FUNCTION admission_list_active_tenant_ids_for_worker() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admission_list_active_tenant_ids_for_worker() TO admission_app;

ALTER TABLE "document_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_requirements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "document_requirements_tenant_isolation" ON "document_requirements" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "document_requirement_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_requirement_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "document_requirement_versions_tenant_isolation" ON "document_requirement_versions" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "document_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "document_submissions_tenant_isolation" ON "document_submissions" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "document_versions_tenant_isolation" ON "document_versions" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "document_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY "document_reviews_tenant_isolation" ON "document_reviews" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "assistance_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assistance_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "assistance_sessions_tenant_isolation" ON "assistance_sessions" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
