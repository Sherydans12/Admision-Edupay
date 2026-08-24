-- CreateEnum
CREATE TYPE "CommunicationPurpose" AS ENUM ('ADMISSION_APPROVED', 'ADMISSION_REJECTED', 'WAITLIST_STATUS', 'OFFER_AVAILABLE', 'DOCUMENT_CORRECTION', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_RESCHEDULED', 'OFFER_REMINDER');

-- CreateEnum
CREATE TYPE "CommunicationAudience" AS ENUM ('FAMILY', 'STAFF');

-- CreateEnum
CREATE TYPE "CommunicationLifecycle" AS ENUM ('PREPARED', 'CONFIRMED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommunicationAttemptStatus" AS ENUM ('SENT', 'FAILED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "OperationalTaskType" AS ENUM ('COMMUNICATION_FAILED');

-- CreateEnum
CREATE TYPE "OperationalTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "communications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "purpose" "CommunicationPurpose" NOT NULL,
    "audience" "CommunicationAudience" NOT NULL DEFAULT 'FAMILY',
    "template_key" VARCHAR(120) NOT NULL,
    "template_version" INTEGER NOT NULL,
    "lifecycle" "CommunicationLifecycle" NOT NULL DEFAULT 'PREPARED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prepared_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(3),
    "confirmed_by" UUID,
    "recipient_email" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(240) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "payload_snapshot" JSONB NOT NULL,
    "direction_decision_version_id" UUID,
    "offer_version_id" UUID,
    "document_submission_id" UUID,
    "activity_appointment_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "communications_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "communications_application_fkey" FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "communications_decision_fkey" FOREIGN KEY ("tenant_id", "application_id", "direction_decision_version_id") REFERENCES "direction_decision_versions"("tenant_id", "application_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "communications_offer_fkey" FOREIGN KEY ("tenant_id", "offer_version_id") REFERENCES "admission_offer_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "communications_document_fkey" FOREIGN KEY ("tenant_id", "document_submission_id") REFERENCES "document_submissions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "communications_appointment_fkey" FOREIGN KEY ("tenant_id", "activity_appointment_id") REFERENCES "activity_appointments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "communications_tenant_id_key" ON "communications"("tenant_id", "id");
CREATE UNIQUE INDEX "communications_application_id_key" ON "communications"("tenant_id", "application_id", "id");
CREATE INDEX "communications_app_purpose_lifecycle_idx" ON "communications"("tenant_id", "application_id", "purpose", "lifecycle");

-- CreateTable
CREATE TABLE "communication_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "communication_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "technical_status" "CommunicationAttemptStatus" NOT NULL,
    "provider_reference" VARCHAR(160),
    "attempted_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "sanitized_error_code" VARCHAR(120),
    "delivery_evidence" JSONB,

    CONSTRAINT "communication_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "communication_attempts_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "communication_attempts_comm_fkey" FOREIGN KEY ("tenant_id", "communication_id") REFERENCES "communications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "communication_attempts_tenant_id_key" ON "communication_attempts"("tenant_id", "id");
CREATE UNIQUE INDEX "communication_attempts_comm_seq_key" ON "communication_attempts"("tenant_id", "communication_id", "sequence");
CREATE INDEX "communication_attempts_comm_attempted_idx" ON "communication_attempts"("tenant_id", "communication_id", "attempted_at");

-- CreateTable
CREATE TABLE "operational_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "communication_id" UUID,
    "type" "OperationalTaskType" NOT NULL,
    "status" "OperationalTaskStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by" UUID,

    CONSTRAINT "operational_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_tasks_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "operational_tasks_application_fkey" FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "operational_tasks_comm_fkey" FOREIGN KEY ("tenant_id", "communication_id") REFERENCES "communications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "operational_tasks_tenant_id_key" ON "operational_tasks"("tenant_id", "id");
CREATE UNIQUE INDEX "operational_tasks_comm_type_key" ON "operational_tasks"("tenant_id", "communication_id", "type");
CREATE INDEX "operational_tasks_status_created_idx" ON "operational_tasks"("tenant_id", "status", "created_at");

-- CreateTable
CREATE TABLE "manual_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "purpose" VARCHAR(120) NOT NULL,
    "contacted_at" TIMESTAMPTZ(3) NOT NULL,
    "outcome" VARCHAR(120) NOT NULL,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_contacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "manual_contacts_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "manual_contacts_application_fkey" FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "manual_contacts_tenant_id_key" ON "manual_contacts"("tenant_id", "id");
CREATE INDEX "manual_contacts_app_contacted_idx" ON "manual_contacts"("tenant_id", "application_id", "contacted_at");

-- Triggers
CREATE OR REPLACE FUNCTION admission_guard_e5g_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "communication_attempts_append_only"
  BEFORE UPDATE OR DELETE ON "communication_attempts"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_e5g_append_only();

-- Ownership and permissions
ALTER TABLE "communications" OWNER TO admission_migrator;
ALTER TABLE "communication_attempts" OWNER TO admission_migrator;
ALTER TABLE "operational_tasks" OWNER TO admission_migrator;
ALTER TABLE "manual_contacts" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_e5g_append_only() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "communications", "communication_attempts", "operational_tasks", "manual_contacts" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "communications", "operational_tasks", "manual_contacts" TO admission_app;
GRANT SELECT, INSERT ON TABLE "communication_attempts" TO admission_app;

-- RLS
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'communications', 'communication_attempts', 'operational_tasks', 'manual_contacts'
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
