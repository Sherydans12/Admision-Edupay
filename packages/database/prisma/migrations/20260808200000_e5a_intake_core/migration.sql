-- E5-A: intake core. Only synthetic/non-production data is authorized.
CREATE TYPE "CampusStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
CREATE TYPE "AdmissionProcessStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "AdmissionOfferingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "AvailabilityCategory" AS ENUM (
  'POSTULATIONS_OPEN',
  'LIMITED_CAPACITY',
  'WAITLIST',
  'PROCESS_CLOSED'
);
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT');

-- Global/control-plane family data. Tenant context is derived by the application.
CREATE TABLE "family_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "family_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "family_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "family_profiles_user_id_key" ON "family_profiles"("user_id");

CREATE TABLE "students" (
  "id" UUID NOT NULL,
  "family_profile_id" UUID NOT NULL,
  "given_name" VARCHAR(120) NOT NULL,
  "family_name" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "students_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "students_family_profile_id_fkey" FOREIGN KEY ("family_profile_id") REFERENCES "family_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "students_family_profile_id_family_name_given_name_idx"
  ON "students"("family_profile_id", "family_name", "given_name");

-- Tenant-owned institutional configuration.
CREATE TABLE "campuses" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "CampusStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campuses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "campuses_tenant_id_id_key" ON "campuses"("tenant_id", "id");
CREATE UNIQUE INDEX "campuses_tenant_id_code_key" ON "campuses"("tenant_id", "code");
CREATE INDEX "campuses_tenant_id_status_idx" ON "campuses"("tenant_id", "status");

CREATE TABLE "academic_years" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "academic_years_tenant_id_id_key" ON "academic_years"("tenant_id", "id");
CREATE UNIQUE INDEX "academic_years_tenant_id_code_key" ON "academic_years"("tenant_id", "code");
CREATE INDEX "academic_years_tenant_id_status_idx" ON "academic_years"("tenant_id", "status");

CREATE TABLE "course_levels" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_levels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "course_levels_tenant_id_id_key" ON "course_levels"("tenant_id", "id");
CREATE UNIQUE INDEX "course_levels_tenant_id_code_key" ON "course_levels"("tenant_id", "code");

CREATE TABLE "admission_processes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "AdmissionProcessStatus" NOT NULL DEFAULT 'DRAFT',
  "opens_at" TIMESTAMPTZ(3),
  "closes_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_processes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_processes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_processes_tenant_year_fkey" FOREIGN KEY ("tenant_id", "academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admission_processes_tenant_id_id_key" ON "admission_processes"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_processes_tenant_year_code_key" ON "admission_processes"("tenant_id", "academic_year_id", "code");
CREATE INDEX "admission_processes_tenant_id_status_academic_year_id_idx"
  ON "admission_processes"("tenant_id", "status", "academic_year_id");

CREATE TABLE "admission_offerings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "process_id" UUID NOT NULL,
  "course_level_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" "AdmissionOfferingStatus" NOT NULL DEFAULT 'DRAFT',
  "availability_category" "AvailabilityCategory" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_offerings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_offerings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_offerings_tenant_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_offerings_tenant_year_fkey" FOREIGN KEY ("tenant_id", "academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_offerings_tenant_process_fkey" FOREIGN KEY ("tenant_id", "process_id") REFERENCES "admission_processes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_offerings_tenant_course_fkey" FOREIGN KEY ("tenant_id", "course_level_id") REFERENCES "course_levels"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admission_offerings_tenant_id_id_key" ON "admission_offerings"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_offerings_tenant_process_course_code_key"
  ON "admission_offerings"("tenant_id", "process_id", "course_level_id", "code");
CREATE INDEX "admission_offerings_tenant_status_category_idx"
  ON "admission_offerings"("tenant_id", "status", "availability_category");

CREATE TABLE "applications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "family_profile_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "process_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "draft_data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "applications_family_profile_id_fkey" FOREIGN KEY ("family_profile_id") REFERENCES "family_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "applications_tenant_year_fkey" FOREIGN KEY ("tenant_id", "academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "applications_tenant_process_fkey" FOREIGN KEY ("tenant_id", "process_id") REFERENCES "admission_processes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "applications_tenant_offering_fkey" FOREIGN KEY ("tenant_id", "offering_id") REFERENCES "admission_offerings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "applications_tenant_id_id_key" ON "applications"("tenant_id", "id");
CREATE INDEX "applications_tenant_family_status_updated_idx"
  ON "applications"("tenant_id", "family_profile_id", "status", "updated_at");
CREATE INDEX "applications_tenant_student_status_idx"
  ON "applications"("tenant_id", "student_id", "status");
CREATE UNIQUE INDEX "applications_active_duplicate_key"
  ON "applications"("tenant_id", "academic_year_id", "process_id", "student_id", "offering_id")
  WHERE "status" = 'DRAFT';

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "effective_actor_id" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "purpose" VARCHAR(120) NOT NULL,
  "resource_type" VARCHAR(120) NOT NULL,
  "resource_id" UUID,
  "result" VARCHAR(40) NOT NULL,
  "reason_code" VARCHAR(80),
  "correlation_id" VARCHAR(120) NOT NULL,
  "metadata" JSONB,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events"("tenant_id", "occurred_at");
CREATE INDEX "audit_events_tenant_resource_idx" ON "audit_events"("tenant_id", "resource_type", "resource_id");

ALTER TABLE "family_profiles" OWNER TO admission_migrator;
ALTER TABLE "students" OWNER TO admission_migrator;
ALTER TABLE "campuses" OWNER TO admission_migrator;
ALTER TABLE "academic_years" OWNER TO admission_migrator;
ALTER TABLE "course_levels" OWNER TO admission_migrator;
ALTER TABLE "admission_processes" OWNER TO admission_migrator;
ALTER TABLE "admission_offerings" OWNER TO admission_migrator;
ALTER TABLE "applications" OWNER TO admission_migrator;
ALTER TABLE "audit_events" OWNER TO admission_migrator;

REVOKE ALL ON TABLE
  "family_profiles", "students", "campuses", "academic_years", "course_levels",
  "admission_processes", "admission_offerings", "applications", "audit_events"
  FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "family_profiles", "students" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE
  "campuses", "academic_years", "course_levels", "admission_processes", "admission_offerings", "applications"
  TO admission_app;
GRANT SELECT, INSERT ON TABLE "audit_events" TO admission_app;

-- RLS for every new tenant-owned table. No context means no rows and no writes.
ALTER TABLE "campuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campuses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "campuses_tenant_isolation" ON "campuses" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY "academic_years_tenant_isolation" ON "academic_years" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "course_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_levels" FORCE ROW LEVEL SECURITY;
CREATE POLICY "course_levels_tenant_isolation" ON "course_levels" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "admission_processes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_processes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "admission_processes_tenant_isolation" ON "admission_processes" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "admission_offerings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_offerings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "admission_offerings_tenant_isolation" ON "admission_offerings" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "applications_tenant_isolation" ON "applications" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

