-- E5-D: tenant-scoped, versioned activity scheduling and attendance.
-- Forward-only. Synthetic/non-production data only; no calendar or EduPay integration.

CREATE TYPE "ActivityDefinitionKind" AS ENUM ('GUARDIAN_INTERVIEW', 'DIAGNOSTIC_EVALUATION');
CREATE TYPE "ActivityDefinitionVersionLifecycle" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ActivityModality" AS ENUM ('IN_PERSON');
CREATE TYPE "ApplicationActivityStatus" AS ENUM (
  'PENDIENTE', 'PROGRAMADA', 'REALIZADA', 'REPROGRAMADA',
  'INASISTENCIA', 'EXENTA', 'NO_COMPLETADA', 'CERRADA'
);
CREATE TYPE "ActivityAppointmentStatus" AS ENUM (
  'PROGRAMADA', 'REALIZADA', 'INASISTENCIA', 'NO_COMPLETADA', 'REPROGRAMADA'
);
CREATE TYPE "ActivityRescheduleRequestStatus" AS ENUM ('PENDING', 'FULFILLED');
CREATE TYPE "ActivityAttemptOutcome" AS ENUM ('REALIZADA', 'INASISTENCIA', 'NO_COMPLETADA');
CREATE TYPE "ActivityResultValue" AS ENUM ('FAVORABLE', 'NO_FAVORABLE', 'INCONCLUSO');

ALTER TABLE "applications" ADD COLUMN "activities_pinned_at" TIMESTAMPTZ(3);

CREATE TABLE "activity_definitions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "kind" "ActivityDefinitionKind" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_definitions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_definitions_text_check" CHECK (length(btrim("code")) > 0 AND length(btrim("name")) > 0 AND "code" ~ '^[A-Za-z][A-Za-z0-9_.-]{0,79}$')
);
CREATE UNIQUE INDEX "activity_definitions_tenant_id_key" ON "activity_definitions"("tenant_id", "id");
CREATE UNIQUE INDEX "activity_definitions_tenant_code_key" ON "activity_definitions"("tenant_id", "code");
CREATE INDEX "activity_definitions_tenant_kind_idx" ON "activity_definitions"("tenant_id", "kind");

CREATE TABLE "activity_definition_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "activity_definition_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "lifecycle" "ActivityDefinitionVersionLifecycle" NOT NULL DEFAULT 'DRAFT',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "modality" "ActivityModality" NOT NULL DEFAULT 'IN_PERSON',
  "duration_minutes" INTEGER NOT NULL,
  "max_normal_reschedules" INTEGER NOT NULL DEFAULT 2,
  "late_tolerance_minutes" INTEGER NOT NULL DEFAULT 15,
  "instructions" VARCHAR(1000),
  "scope_academic_year_id" UUID,
  "scope_process_id" UUID,
  "scope_course_level_id" UUID,
  "scope_offering_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(3),
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "activity_definition_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_definition_versions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_definition_versions_definition_fkey" FOREIGN KEY ("tenant_id", "activity_definition_id") REFERENCES "activity_definitions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_definition_versions_year_fkey" FOREIGN KEY ("tenant_id", "scope_academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_definition_versions_process_fkey" FOREIGN KEY ("tenant_id", "scope_process_id") REFERENCES "admission_processes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_definition_versions_course_fkey" FOREIGN KEY ("tenant_id", "scope_course_level_id") REFERENCES "course_levels"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_definition_versions_offering_fkey" FOREIGN KEY ("tenant_id", "scope_offering_id") REFERENCES "admission_offerings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_definition_versions_number_check" CHECK ("version_number" > 0),
  CONSTRAINT "activity_definition_versions_config_check" CHECK (
    "duration_minutes" > 0 AND "duration_minutes" <= 1440
    AND "max_normal_reschedules" >= 0 AND "max_normal_reschedules" <= 100
    AND "late_tolerance_minutes" >= 0 AND "late_tolerance_minutes" <= 1440
  ),
  CONSTRAINT "activity_definition_versions_lifecycle_dates_check" CHECK (
    ("lifecycle" = 'DRAFT' AND "published_at" IS NULL AND "archived_at" IS NULL)
    OR ("lifecycle" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "archived_at" IS NULL)
    OR ("lifecycle" = 'ARCHIVED' AND "published_at" IS NOT NULL AND "archived_at" IS NOT NULL)
  ),
  CONSTRAINT "activity_definition_versions_scope_coherence_check" CHECK (
    NOT ("scope_offering_id" IS NOT NULL AND "scope_process_id" IS NULL)
  )
);
CREATE UNIQUE INDEX "activity_definition_versions_tenant_id_key" ON "activity_definition_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "activity_definition_versions_definition_id_key" ON "activity_definition_versions"("tenant_id", "activity_definition_id", "id");
CREATE UNIQUE INDEX "activity_definition_versions_number_key" ON "activity_definition_versions"("tenant_id", "activity_definition_id", "version_number");
CREATE INDEX "activity_definition_versions_tenant_lifecycle_offering_idx" ON "activity_definition_versions"("tenant_id", "lifecycle", "scope_offering_id");
CREATE INDEX "activity_definition_versions_tenant_lifecycle_scope_idx" ON "activity_definition_versions"("tenant_id", "lifecycle", "scope_process_id", "scope_course_level_id");

CREATE TABLE "application_activities" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "activity_definition_id" UUID NOT NULL,
  "activity_definition_version_id" UUID NOT NULL,
  "status" "ApplicationActivityStatus" NOT NULL DEFAULT 'PENDIENTE',
  "current_appointment_id" UUID,
  "pinned_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_activities_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_activities_application_fkey" FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_activities_definition_fkey" FOREIGN KEY ("tenant_id", "activity_definition_id") REFERENCES "activity_definitions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_activities_version_fkey" FOREIGN KEY ("tenant_id", "activity_definition_id", "activity_definition_version_id") REFERENCES "activity_definition_versions"("tenant_id", "activity_definition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "application_activities_tenant_id_key" ON "application_activities"("tenant_id", "id");
CREATE UNIQUE INDEX "application_activities_application_definition_key" ON "application_activities"("tenant_id", "application_id", "activity_definition_id");
CREATE INDEX "application_activities_application_status_idx" ON "application_activities"("tenant_id", "application_id", "status");

CREATE TABLE "activity_appointments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_activity_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "scheduled_start_at" TIMESTAMPTZ(3) NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "location" VARCHAR(240) NOT NULL,
  "assigned_user_id" UUID NOT NULL,
  "status" "ActivityAppointmentStatus" NOT NULL DEFAULT 'PROGRAMADA',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reprogram_reason" VARCHAR(1000),
  "previous_appointment_id" UUID,
  CONSTRAINT "activity_appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_appointments_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_appointments_activity_fkey" FOREIGN KEY ("tenant_id", "application_activity_id") REFERENCES "application_activities"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_appointments_sequence_check" CHECK ("sequence" > 0 AND "duration_minutes" > 0 AND length(btrim("location")) > 0)
);
CREATE UNIQUE INDEX "activity_appointments_tenant_id_key" ON "activity_appointments"("tenant_id", "id");
CREATE UNIQUE INDEX "activity_appointments_activity_id_key" ON "activity_appointments"("tenant_id", "application_activity_id", "id");
CREATE UNIQUE INDEX "activity_appointments_sequence_key" ON "activity_appointments"("tenant_id", "application_activity_id", "sequence");
CREATE INDEX "activity_appointments_activity_status_idx" ON "activity_appointments"("tenant_id", "application_activity_id", "status");
ALTER TABLE "activity_appointments" ADD CONSTRAINT "activity_appointments_previous_fkey"
  FOREIGN KEY ("tenant_id", "previous_appointment_id") REFERENCES "activity_appointments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "activity_reschedule_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_activity_id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "status" "ActivityRescheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
  "fulfilled_appointment_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilled_at" TIMESTAMPTZ(3),
  CONSTRAINT "activity_reschedule_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_reschedule_requests_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_reschedule_requests_requested_by_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_reschedule_requests_activity_fkey" FOREIGN KEY ("tenant_id", "application_activity_id") REFERENCES "application_activities"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_reschedule_requests_appointment_fkey" FOREIGN KEY ("tenant_id", "application_activity_id", "appointment_id") REFERENCES "activity_appointments"("tenant_id", "application_activity_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_reschedule_requests_fulfilled_fkey" FOREIGN KEY ("tenant_id", "application_activity_id", "fulfilled_appointment_id") REFERENCES "activity_appointments"("tenant_id", "application_activity_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_reschedule_requests_reason_check" CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "activity_reschedule_requests_status_check" CHECK (
    ("status" = 'PENDING' AND "fulfilled_appointment_id" IS NULL AND "fulfilled_at" IS NULL)
    OR ("status" = 'FULFILLED' AND "fulfilled_appointment_id" IS NOT NULL AND "fulfilled_at" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "activity_reschedule_requests_tenant_id_key" ON "activity_reschedule_requests"("tenant_id", "id");
CREATE INDEX "activity_reschedule_requests_activity_status_idx" ON "activity_reschedule_requests"("tenant_id", "application_activity_id", "status");

CREATE TABLE "activity_attempts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_activity_id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "previous_attempt_id" UUID,
  "recorded_by" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "operational_outcome" "ActivityAttemptOutcome" NOT NULL,
  "reason" VARCHAR(1000),
  "no_show_justified" BOOLEAN,
  CONSTRAINT "activity_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_attempts_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_attempts_activity_fkey" FOREIGN KEY ("tenant_id", "application_activity_id") REFERENCES "application_activities"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_attempts_appointment_fkey" FOREIGN KEY ("tenant_id", "application_activity_id", "appointment_id") REFERENCES "activity_appointments"("tenant_id", "application_activity_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_attempts_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "activity_attempts_no_show_justified_check" CHECK (
    ("operational_outcome" = 'INASISTENCIA' AND "no_show_justified" IS NOT NULL)
    OR ("operational_outcome" <> 'INASISTENCIA' AND "no_show_justified" IS NULL)
  )
);
CREATE UNIQUE INDEX "activity_attempts_tenant_id_key" ON "activity_attempts"("tenant_id", "id");
CREATE UNIQUE INDEX "activity_attempts_activity_id_key" ON "activity_attempts"("tenant_id", "application_activity_id", "id");
CREATE UNIQUE INDEX "activity_attempts_sequence_key" ON "activity_attempts"("tenant_id", "application_activity_id", "sequence");
CREATE INDEX "activity_attempts_activity_outcome_idx" ON "activity_attempts"("tenant_id", "application_activity_id", "operational_outcome");
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_previous_fkey"
  FOREIGN KEY ("tenant_id", "application_activity_id", "previous_attempt_id") REFERENCES "activity_attempts"("tenant_id", "application_activity_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "activity_results" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_activity_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "previous_result_id" UUID,
  "result" "ActivityResultValue" NOT NULL,
  "comment" VARCHAR(1000),
  "recorded_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_results_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_results_activity_fkey" FOREIGN KEY ("tenant_id", "application_activity_id") REFERENCES "application_activities"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_results_attempt_fkey" FOREIGN KEY ("tenant_id", "application_activity_id", "attempt_id") REFERENCES "activity_attempts"("tenant_id", "application_activity_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_results_version_check" CHECK ("version_number" > 0 AND ("comment" IS NULL OR length(btrim("comment")) > 0))
);
CREATE UNIQUE INDEX "activity_results_tenant_id_key" ON "activity_results"("tenant_id", "id");
CREATE UNIQUE INDEX "activity_results_attempt_version_key" ON "activity_results"("tenant_id", "application_activity_id", "attempt_id", "version_number");
CREATE UNIQUE INDEX "activity_results_activity_id_key" ON "activity_results"("tenant_id", "application_activity_id", "id");
CREATE INDEX "activity_results_activity_attempt_idx" ON "activity_results"("tenant_id", "application_activity_id", "attempt_id");
ALTER TABLE "activity_results" ADD CONSTRAINT "activity_results_previous_fkey"
  FOREIGN KEY ("tenant_id", "application_activity_id", "previous_result_id") REFERENCES "activity_results"("tenant_id", "application_activity_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application_activities" ADD CONSTRAINT "application_activities_current_appointment_fkey"
  FOREIGN KEY ("tenant_id", "current_appointment_id") REFERENCES "activity_appointments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
CREATE TRIGGER "activity_definition_versions_history_immutable"
  BEFORE UPDATE OR DELETE ON "activity_definition_versions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_activity_definition_version_history();

CREATE OR REPLACE FUNCTION admission_guard_activity_current_appointment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."current_appointment_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "activity_appointments" a
    WHERE a."tenant_id" = NEW."tenant_id"
      AND a."id" = NEW."current_appointment_id"
      AND a."application_activity_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'current appointment must belong to application activity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "application_activities_current_appointment_guard"
  BEFORE INSERT OR UPDATE OF "tenant_id", "id", "current_appointment_id" ON "application_activities"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_activity_current_appointment();

CREATE OR REPLACE FUNCTION admission_guard_activity_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION 'activity evidence is append-only' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "activity_attempts_append_only" BEFORE UPDATE OR DELETE ON "activity_attempts"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_activity_append_only();
CREATE TRIGGER "activity_results_append_only" BEFORE UPDATE OR DELETE ON "activity_results"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_activity_append_only();
CREATE TRIGGER "activity_appointments_no_delete" BEFORE DELETE ON "activity_appointments"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_activity_append_only();

ALTER TABLE "activity_definitions" OWNER TO admission_migrator;
ALTER TABLE "activity_definition_versions" OWNER TO admission_migrator;
ALTER TABLE "application_activities" OWNER TO admission_migrator;
ALTER TABLE "activity_appointments" OWNER TO admission_migrator;
ALTER TABLE "activity_reschedule_requests" OWNER TO admission_migrator;
ALTER TABLE "activity_attempts" OWNER TO admission_migrator;
ALTER TABLE "activity_results" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_activity_definition_version_history() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_activity_current_appointment() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_activity_append_only() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "activity_definitions", "activity_definition_versions", "application_activities",
  "activity_appointments", "activity_reschedule_requests", "activity_attempts", "activity_results" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "activity_definitions", "activity_definition_versions",
  "application_activities", "activity_appointments", "activity_reschedule_requests" TO admission_app;
GRANT SELECT, INSERT ON TABLE "activity_attempts", "activity_results" TO admission_app;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'activity_definitions', 'activity_definition_versions', 'application_activities',
    'activity_appointments', 'activity_reschedule_requests', 'activity_attempts', 'activity_results'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO admission_app USING (tenant_id = NULLIF(current_setting(''admission.tenant_id'', true), '''')::UUID) WITH CHECK (tenant_id = NULLIF(current_setting(''admission.tenant_id'', true), '''')::UUID)',
      table_name || '_tenant_isolation', table_name
    );
  END LOOP;
END;
$$;
