-- E5-B: controlled versioned forms, draft answers, immutable submission snapshot.
-- Synthetic/non-production data only. This is a forward-only migration.

DROP INDEX "applications_active_duplicate_key";
CREATE TYPE "ApplicationStatusE5B" AS ENUM ('DRAFT', 'SUBMITTED');
ALTER TABLE "applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "applications" ALTER COLUMN "status" TYPE "ApplicationStatusE5B"
  USING ("status"::text::"ApplicationStatusE5B");
DROP TYPE "ApplicationStatus";
ALTER TYPE "ApplicationStatusE5B" RENAME TO "ApplicationStatus";
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
CREATE TYPE "FormVersionLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'SELECT', 'RADIO', 'BOOLEAN', 'DATE');
CREATE TYPE "FormConditionOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'IN');

CREATE TABLE "form_definitions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "purpose" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "form_definitions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "form_definitions_text_check" CHECK (length(btrim("name")) > 0 AND length(btrim("purpose")) > 0)
);
CREATE UNIQUE INDEX "form_definitions_tenant_id_id_key" ON "form_definitions"("tenant_id", "id");
CREATE INDEX "form_definitions_tenant_purpose_name_idx" ON "form_definitions"("tenant_id", "purpose", "name");

CREATE TABLE "form_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "form_definition_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "lifecycle" "FormVersionLifecycle" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(3),
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "form_versions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "form_versions_definition_fkey" FOREIGN KEY ("tenant_id", "form_definition_id") REFERENCES "form_definitions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "form_versions_number_check" CHECK ("version_number" > 0),
  CONSTRAINT "form_versions_lifecycle_dates_check" CHECK (
    ("lifecycle" = 'DRAFT' AND "published_at" IS NULL AND "archived_at" IS NULL)
    OR ("lifecycle" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "archived_at" IS NULL)
    OR ("lifecycle" = 'ARCHIVED' AND "published_at" IS NOT NULL AND "archived_at" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "form_versions_tenant_id_id_key" ON "form_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "form_versions_tenant_definition_number_key" ON "form_versions"("tenant_id", "form_definition_id", "version_number");
CREATE INDEX "form_versions_tenant_definition_lifecycle_idx" ON "form_versions"("tenant_id", "form_definition_id", "lifecycle");

CREATE TABLE "form_sections" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "form_version_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "order" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "form_sections_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "form_sections_version_fkey" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "form_sections_order_check" CHECK ("order" > 0),
  CONSTRAINT "form_sections_title_check" CHECK (length(btrim("title")) > 0)
);
CREATE UNIQUE INDEX "form_sections_tenant_version_id_key" ON "form_sections"("tenant_id", "form_version_id", "id");
CREATE UNIQUE INDEX "form_sections_tenant_version_order_key" ON "form_sections"("tenant_id", "form_version_id", "order");
CREATE INDEX "form_sections_tenant_version_idx" ON "form_sections"("tenant_id", "form_version_id");

CREATE TABLE "form_fields" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "form_version_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "help_text" VARCHAR(500),
  "type" "FormFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "sensitivity" VARCHAR(40) NOT NULL,
  "purpose" VARCHAR(160) NOT NULL,
  "order" INTEGER NOT NULL,
  "options" JSONB,
  "validation_config" JSONB,
  "condition_operator" "FormConditionOperator",
  "condition_field_id" UUID,
  "condition_value" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "form_fields_tenant_version_id_key" UNIQUE ("tenant_id", "form_version_id", "id"),
  CONSTRAINT "form_fields_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "form_fields_version_fkey" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "form_fields_section_fkey" FOREIGN KEY ("tenant_id", "form_version_id", "section_id") REFERENCES "form_sections"("tenant_id", "form_version_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "form_fields_condition_field_fkey" FOREIGN KEY ("tenant_id", "form_version_id", "condition_field_id") REFERENCES "form_fields"("tenant_id", "form_version_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "form_fields_key_check" CHECK ("key" ~ '^[A-Za-z][A-Za-z0-9_]{0,79}$'),
  CONSTRAINT "form_fields_text_check" CHECK (length(btrim("label")) > 0 AND length(btrim("purpose")) > 0),
  CONSTRAINT "form_fields_order_check" CHECK ("order" > 0),
  CONSTRAINT "form_fields_sensitivity_check" CHECK ("sensitivity" IN ('internal', 'restricted', 'highly_restricted')),
  CONSTRAINT "form_fields_condition_coherence_check" CHECK (
    ("condition_operator" IS NULL AND "condition_field_id" IS NULL AND "condition_value" IS NULL)
    OR ("condition_operator" IS NOT NULL AND "condition_field_id" IS NOT NULL AND "condition_value" IS NOT NULL)
  ),
  CONSTRAINT "form_fields_no_self_condition_check" CHECK ("condition_field_id" IS NULL OR "condition_field_id" <> "id")
);
CREATE UNIQUE INDEX "form_fields_tenant_version_key_key" ON "form_fields"("tenant_id", "form_version_id", "key");
CREATE UNIQUE INDEX "form_fields_tenant_version_section_order_key" ON "form_fields"("tenant_id", "form_version_id", "section_id", "order");
CREATE INDEX "form_fields_tenant_version_section_idx" ON "form_fields"("tenant_id", "form_version_id", "section_id");

ALTER TABLE "admission_offerings" ADD COLUMN "form_version_id" UUID;
ALTER TABLE "admission_offerings" ADD CONSTRAINT "admission_offerings_form_version_fkey"
  FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "applications"
  ADD COLUMN "form_version_id" UUID,
  ADD COLUMN "submitted_at" TIMESTAMPTZ(3);
ALTER TABLE "applications" ADD CONSTRAINT "applications_form_version_fkey"
  FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "applications_tenant_id_id_form_version_id_key" ON "applications"("tenant_id", "id", "form_version_id");
ALTER TABLE "applications" ADD CONSTRAINT "applications_submission_coherence_check" CHECK (
  ("status" = 'DRAFT' AND "submitted_at" IS NULL)
  OR ("status" = 'SUBMITTED' AND "submitted_at" IS NOT NULL AND "form_version_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "applications_active_duplicate_key"
  ON "applications"("tenant_id", "academic_year_id", "process_id", "student_id", "offering_id")
  WHERE "status" IN ('DRAFT', 'SUBMITTED');

CREATE TABLE "application_draft_answers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "form_version_id" UUID NOT NULL,
  "field_id" UUID NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_draft_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_draft_answers_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_draft_answers_application_fkey" FOREIGN KEY ("tenant_id", "application_id", "form_version_id") REFERENCES "applications"("tenant_id", "id", "form_version_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_draft_answers_version_fkey" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_draft_answers_field_fkey" FOREIGN KEY ("tenant_id", "form_version_id", "field_id") REFERENCES "form_fields"("tenant_id", "form_version_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "application_draft_answers_tenant_application_field_key" ON "application_draft_answers"("tenant_id", "application_id", "field_id");
CREATE INDEX "application_draft_answers_tenant_application_version_idx" ON "application_draft_answers"("tenant_id", "application_id", "form_version_id");

CREATE TABLE "application_snapshots" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "form_version_id" UUID NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "submitted_by" UUID NOT NULL,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_snapshots_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_snapshots_application_fkey" FOREIGN KEY ("tenant_id", "application_id", "form_version_id") REFERENCES "applications"("tenant_id", "id", "form_version_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_snapshots_version_fkey" FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_snapshots_schema_version_check" CHECK ("schema_version" = 1)
);
CREATE UNIQUE INDEX "application_snapshots_application_id_key" ON "application_snapshots"("application_id");
CREATE UNIQUE INDEX "application_snapshots_tenant_id_id_key" ON "application_snapshots"("tenant_id", "id");
CREATE UNIQUE INDEX "application_snapshots_tenant_application_version_key" ON "application_snapshots"("tenant_id", "application_id", "form_version_id");
CREATE INDEX "application_snapshots_tenant_application_idx" ON "application_snapshots"("tenant_id", "application_id");

CREATE OR REPLACE FUNCTION admission_guard_published_form_content() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND EXISTS (
    SELECT 1 FROM "form_versions"
    WHERE "tenant_id" = OLD."tenant_id" AND "id" = OLD."form_version_id"
      AND "lifecycle" IN ('PUBLISHED', 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'published form content is immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP <> 'DELETE' AND EXISTS (
    SELECT 1 FROM "form_versions"
    WHERE "tenant_id" = NEW."tenant_id" AND "id" = NEW."form_version_id"
      AND "lifecycle" IN ('PUBLISHED', 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'published form content is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "form_sections_published_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "form_sections"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_published_form_content();
CREATE TRIGGER "form_fields_published_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "form_fields"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_published_form_content();

CREATE OR REPLACE FUNCTION admission_guard_form_version_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."lifecycle" <> 'DRAFT' THEN
    RAISE EXCEPTION 'published form version cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."lifecycle" IN ('PUBLISHED', 'ARCHIVED') THEN
    IF NOT (
      OLD."lifecycle" = 'PUBLISHED' AND NEW."lifecycle" = 'ARCHIVED'
      AND NEW."archived_at" IS NOT NULL
      AND NEW."id" = OLD."id"
      AND NEW."tenant_id" = OLD."tenant_id"
      AND NEW."form_definition_id" = OLD."form_definition_id"
      AND NEW."version_number" = OLD."version_number"
      AND NEW."created_at" = OLD."created_at"
      AND NEW."published_at" = OLD."published_at"
    ) THEN
      RAISE EXCEPTION 'published form version is immutable' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "form_versions_history_immutable"
  BEFORE UPDATE OR DELETE ON "form_versions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_form_version_history();

CREATE OR REPLACE FUNCTION admission_require_published_offering_form() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."form_version_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "form_versions" v
      WHERE v."tenant_id" = NEW."tenant_id" AND v."id" = NEW."form_version_id" AND v."lifecycle" = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'offering requires a published form version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "admission_offerings_published_form_only"
  BEFORE INSERT OR UPDATE OF "tenant_id", "form_version_id" ON "admission_offerings"
  FOR EACH ROW EXECUTE FUNCTION admission_require_published_offering_form();

CREATE OR REPLACE FUNCTION admission_guard_draft_answers() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE application_state "ApplicationStatus";
BEGIN
  SELECT "status" INTO application_state FROM "applications"
    WHERE "tenant_id" = COALESCE(OLD."tenant_id", NEW."tenant_id")
      AND "id" = COALESCE(OLD."application_id", NEW."application_id");
  IF application_state <> 'DRAFT' THEN
    RAISE EXCEPTION 'submitted application answers are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "application_draft_answers_draft_only"
  BEFORE INSERT OR UPDATE OR DELETE ON "application_draft_answers"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_draft_answers();

CREATE OR REPLACE FUNCTION admission_guard_snapshot_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION 'application snapshot is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "application_snapshots_immutable"
  BEFORE UPDATE OR DELETE ON "application_snapshots"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_snapshot_immutable();

ALTER TABLE "form_definitions" OWNER TO admission_migrator;
ALTER TABLE "form_versions" OWNER TO admission_migrator;
ALTER TABLE "form_sections" OWNER TO admission_migrator;
ALTER TABLE "form_fields" OWNER TO admission_migrator;
ALTER TABLE "application_draft_answers" OWNER TO admission_migrator;
ALTER TABLE "application_snapshots" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_published_form_content() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_form_version_history() OWNER TO admission_migrator;
ALTER FUNCTION admission_require_published_offering_form() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_draft_answers() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_snapshot_immutable() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "form_definitions", "form_versions", "form_sections", "form_fields", "application_draft_answers", "application_snapshots" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "form_definitions", "form_versions" TO admission_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "form_sections", "form_fields" TO admission_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "application_draft_answers" TO admission_app;
GRANT SELECT, INSERT ON TABLE "application_snapshots" TO admission_app;

ALTER TABLE "form_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_definitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "form_definitions_tenant_isolation" ON "form_definitions" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "form_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "form_versions_tenant_isolation" ON "form_versions" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "form_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_sections" FORCE ROW LEVEL SECURITY;
CREATE POLICY "form_sections_tenant_isolation" ON "form_sections" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "form_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_fields" FORCE ROW LEVEL SECURITY;
CREATE POLICY "form_fields_tenant_isolation" ON "form_fields" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "application_draft_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_draft_answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "application_draft_answers_tenant_isolation" ON "application_draft_answers" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "application_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "application_snapshots_tenant_isolation" ON "application_snapshots" FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
