-- G5-PC1-R12: tenant/application-scoped authority core and adult-student DOB.
-- No authority, DOB, relationship, basis, evidence, or verification is backfilled.

ALTER TABLE "students" ADD COLUMN "date_of_birth" DATE;

CREATE TYPE "ApplicationAuthoritySubjectMode" AS ENUM (
  'MINOR_REPRESENTATIVE',
  'ADULT_STUDENT_SELF'
);
CREATE TYPE "ApplicationAuthorityRelationship" AS ENUM (
  'MOTHER',
  'FATHER',
  'OTHER_RELATIVE',
  'OTHER',
  'SELF'
);
CREATE TYPE "ApplicationAuthorityBasis" AS ENUM (
  'PARENT',
  'LEGAL_REPRESENTATIVE',
  'PERSONAL_CARE_HOLDER',
  'AUTHORIZED_BY_AUTHORITY_HOLDER',
  'SELF'
);
CREATE TYPE "ApplicationAuthorityStatus" AS ENUM (
  'NOT_DECLARED',
  'DECLARED',
  'EVIDENCE_PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'DISPUTED',
  'REJECTED'
);

CREATE TABLE "application_authorities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "authority_user_id" UUID NOT NULL,
  "subject_mode" "ApplicationAuthoritySubjectMode" NOT NULL,
  "relationship" "ApplicationAuthorityRelationship" NOT NULL,
  "authority_basis" "ApplicationAuthorityBasis" NOT NULL,
  "status" "ApplicationAuthorityStatus" NOT NULL DEFAULT 'DECLARED',
  "date_of_birth_snapshot" DATE NOT NULL,
  "declared_at" TIMESTAMPTZ(3) NOT NULL,
  "verified_at" TIMESTAMPTZ(3),
  "disputed_at" TIMESTAMPTZ(3),
  "rejected_at" TIMESTAMPTZ(3),
  "concurrency_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_authorities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_authorities_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_authorities_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_authorities_user_fkey"
    FOREIGN KEY ("authority_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_authorities_concurrency_version_check"
    CHECK ("concurrency_version" > 0),
  CONSTRAINT "application_authorities_mode_combination_check"
    CHECK (
      (
        "subject_mode" = 'MINOR_REPRESENTATIVE'
        AND "relationship" <> 'SELF'
        AND "authority_basis" <> 'SELF'
      )
      OR (
        "subject_mode" = 'ADULT_STUDENT_SELF'
        AND "relationship" = 'SELF'
        AND "authority_basis" = 'SELF'
      )
    )
);
CREATE UNIQUE INDEX "application_authorities_resource_key"
  ON "application_authorities"("tenant_id", "id", "application_id");
CREATE UNIQUE INDEX "application_authorities_tenant_application_key"
  ON "application_authorities"("tenant_id", "application_id");
CREATE INDEX "application_authorities_tenant_status_application_idx"
  ON "application_authorities"("tenant_id", "status", "application_id");

CREATE TABLE "application_authority_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "authority_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "from_status" "ApplicationAuthorityStatus" NOT NULL,
  "to_status" "ApplicationAuthorityStatus" NOT NULL,
  "subject_mode" "ApplicationAuthoritySubjectMode" NOT NULL,
  "relationship" "ApplicationAuthorityRelationship" NOT NULL,
  "authority_basis" "ApplicationAuthorityBasis" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "reason" VARCHAR(1000),
  "evidence_manifest" JSONB,
  "concurrency_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_authority_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_authority_reviews_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_authority_reviews_authority_fkey"
    FOREIGN KEY ("tenant_id", "authority_id", "application_id")
    REFERENCES "application_authorities"("tenant_id", "id", "application_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_authority_reviews_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_authority_reviews_sequence_number_check" CHECK ("sequence_number" > 0),
  CONSTRAINT "application_authority_reviews_concurrency_version_check" CHECK ("concurrency_version" > 0)
);
CREATE UNIQUE INDEX "application_authority_reviews_tenant_id_key"
  ON "application_authority_reviews"("tenant_id", "id");
CREATE UNIQUE INDEX "application_authority_reviews_authority_sequence_key"
  ON "application_authority_reviews"("tenant_id", "authority_id", "sequence_number");
CREATE INDEX "application_authority_reviews_application_created_idx"
  ON "application_authority_reviews"("tenant_id", "application_id", "created_at");

CREATE TABLE "application_authority_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "authority_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "linked_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_authority_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_authority_evidence_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_authority_evidence_authority_fkey"
    FOREIGN KEY ("tenant_id", "authority_id", "application_id")
    REFERENCES "application_authorities"("tenant_id", "id", "application_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_authority_evidence_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_authority_evidence_document_version_fkey"
    FOREIGN KEY ("tenant_id", "document_version_id") REFERENCES "document_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "application_authority_evidence_tenant_id_key"
  ON "application_authority_evidence"("tenant_id", "id");
CREATE UNIQUE INDEX "application_authority_evidence_authority_document_version_key"
  ON "application_authority_evidence"("tenant_id", "authority_id", "document_version_id");
CREATE INDEX "application_authority_evidence_application_authority_idx"
  ON "application_authority_evidence"("tenant_id", "application_id", "authority_id");

CREATE OR REPLACE FUNCTION admission_guard_application_authority_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "application_authority_reviews_append_only"
  BEFORE UPDATE OR DELETE ON "application_authority_reviews"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_application_authority_append_only();
CREATE TRIGGER "application_authority_evidence_append_only"
  BEFORE UPDATE OR DELETE ON "application_authority_evidence"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_application_authority_append_only();

ALTER TABLE "application_authorities" OWNER TO admission_migrator;
ALTER TABLE "application_authority_reviews" OWNER TO admission_migrator;
ALTER TABLE "application_authority_evidence" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_application_authority_append_only() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "application_authorities" FROM PUBLIC;
REVOKE ALL ON TABLE "application_authority_reviews" FROM PUBLIC;
REVOKE ALL ON TABLE "application_authority_evidence" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "application_authorities" TO admission_app;
GRANT SELECT, INSERT ON TABLE "application_authority_reviews" TO admission_app;
GRANT SELECT, INSERT ON TABLE "application_authority_evidence" TO admission_app;

ALTER TABLE "application_authorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_authorities" FORCE ROW LEVEL SECURITY;
ALTER TABLE "application_authority_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_authority_reviews" FORCE ROW LEVEL SECURITY;
ALTER TABLE "application_authority_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_authority_evidence" FORCE ROW LEVEL SECURITY;

CREATE POLICY "application_authorities_tenant_isolation" ON "application_authorities"
  AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
CREATE POLICY "application_authority_reviews_tenant_isolation" ON "application_authority_reviews"
  AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
CREATE POLICY "application_authority_evidence_tenant_isolation" ON "application_authority_evidence"
  AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
