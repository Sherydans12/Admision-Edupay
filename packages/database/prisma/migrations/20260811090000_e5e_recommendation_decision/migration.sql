-- E5-E: versioned admission recommendations and direction decisions.
-- Forward-only. Synthetic/local development data only; no E5-F/E5-G effects.

CREATE TYPE "AdmissionRecommendationOption" AS ENUM (
  'RECOMENDAR_ADMISION', 'NO_RECOMENDAR_ADMISION', 'DEVOLVER_A_REVISION'
);
CREATE TYPE "RecommendationVersionLifecycle" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "DirectionDisposition" AS ENUM (
  'APROBADO', 'LISTA_DE_ESPERA', 'RECHAZADO', 'DEVUELTO_A_REVISION'
);

CREATE TABLE "admission_recommendations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "current_version_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_recommendations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_recommendations_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_recommendations_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admission_recommendations_tenant_id_key"
  ON "admission_recommendations"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_recommendations_application_id_key"
  ON "admission_recommendations"("tenant_id", "application_id");
CREATE UNIQUE INDEX "admission_recommendations_root_application_key"
  ON "admission_recommendations"("tenant_id", "id", "application_id");
CREATE INDEX "admission_recommendations_application_current_idx"
  ON "admission_recommendations"("tenant_id", "application_id", "current_version_id");

CREATE TABLE "admission_recommendation_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "recommendation_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "previous_version_id" UUID,
  "option" "AdmissionRecommendationOption" NOT NULL,
  "foundation" VARCHAR(2000) NOT NULL,
  "lifecycle" "RecommendationVersionLifecycle" NOT NULL DEFAULT 'DRAFT',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_by" UUID,
  "submitted_at" TIMESTAMPTZ(3),
  "evidence_manifest" JSONB NOT NULL,
  CONSTRAINT "admission_recommendation_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_recommendation_versions_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_recommendation_versions_recommendation_fkey"
    FOREIGN KEY ("tenant_id", "recommendation_id", "application_id")
    REFERENCES "admission_recommendations"("tenant_id", "id", "application_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_recommendation_versions_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_recommendation_versions_previous_same_root_fkey"
    FOREIGN KEY ("tenant_id", "recommendation_id", "previous_version_id")
    REFERENCES "admission_recommendation_versions"("tenant_id", "recommendation_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_recommendation_versions_version_check"
    CHECK ("version_number" > 0 AND length(btrim("foundation")) > 0),
  CONSTRAINT "admission_recommendation_versions_lifecycle_check"
    CHECK (("lifecycle" = 'DRAFT' AND "submitted_by" IS NULL AND "submitted_at" IS NULL)
      OR ("lifecycle" = 'SUBMITTED' AND "submitted_by" IS NOT NULL AND "submitted_at" IS NOT NULL)),
  CONSTRAINT "admission_recommendation_versions_previous_not_self_check"
    CHECK ("previous_version_id" IS NULL OR "previous_version_id" <> "id")
);
CREATE UNIQUE INDEX "admission_recommendation_versions_tenant_id_key"
  ON "admission_recommendation_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_recommendation_versions_root_id_key"
  ON "admission_recommendation_versions"("tenant_id", "recommendation_id", "id");
CREATE UNIQUE INDEX "admission_recommendation_versions_number_key"
  ON "admission_recommendation_versions"("tenant_id", "recommendation_id", "version_number");
CREATE UNIQUE INDEX "admission_recommendation_versions_application_id_key"
  ON "admission_recommendation_versions"("tenant_id", "application_id", "id");
CREATE INDEX "admission_recommendation_versions_application_lifecycle_idx"
  ON "admission_recommendation_versions"("tenant_id", "application_id", "lifecycle");

ALTER TABLE "admission_recommendations"
  ADD CONSTRAINT "admission_recommendations_current_version_fkey"
  FOREIGN KEY ("tenant_id", "id", "current_version_id")
  REFERENCES "admission_recommendation_versions"("tenant_id", "recommendation_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "direction_decisions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "current_version_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direction_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direction_decisions_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direction_decisions_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "direction_decisions_tenant_id_key"
  ON "direction_decisions"("tenant_id", "id");
CREATE UNIQUE INDEX "direction_decisions_application_id_key"
  ON "direction_decisions"("tenant_id", "application_id");
CREATE UNIQUE INDEX "direction_decisions_root_application_key"
  ON "direction_decisions"("tenant_id", "id", "application_id");
CREATE INDEX "direction_decisions_application_current_idx"
  ON "direction_decisions"("tenant_id", "application_id", "current_version_id");

CREATE TABLE "direction_decision_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "direction_decision_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "previous_version_id" UUID,
  "recommendation_version_id" UUID NOT NULL,
  "disposition" "DirectionDisposition" NOT NULL,
  "foundation" VARCHAR(2000),
  "reason" VARCHAR(2000),
  "decided_by" UUID NOT NULL,
  "decided_at" TIMESTAMPTZ(3) NOT NULL,
  "evidence_manifest" JSONB NOT NULL,
  CONSTRAINT "direction_decision_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direction_decision_versions_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direction_decision_versions_decision_fkey"
    FOREIGN KEY ("tenant_id", "direction_decision_id", "application_id")
    REFERENCES "direction_decisions"("tenant_id", "id", "application_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direction_decision_versions_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id") REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direction_decision_versions_recommendation_fkey"
    FOREIGN KEY ("tenant_id", "application_id", "recommendation_version_id")
    REFERENCES "admission_recommendation_versions"("tenant_id", "application_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direction_decision_versions_previous_same_root_fkey"
    FOREIGN KEY ("tenant_id", "direction_decision_id", "previous_version_id")
    REFERENCES "direction_decision_versions"("tenant_id", "direction_decision_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direction_decision_versions_version_check"
    CHECK ("version_number" > 0 AND ("foundation" IS NULL OR length(btrim("foundation")) > 0)
      AND ("reason" IS NULL OR length(btrim("reason")) > 0)),
  CONSTRAINT "direction_decision_versions_disposition_check"
    CHECK ((("disposition" <> 'RECHAZADO') OR ("foundation" IS NOT NULL AND length(btrim("foundation")) > 0))
      AND (("disposition" <> 'DEVUELTO_A_REVISION') OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))),
  CONSTRAINT "direction_decision_versions_previous_not_self_check"
    CHECK ("previous_version_id" IS NULL OR "previous_version_id" <> "id")
);
CREATE UNIQUE INDEX "direction_decision_versions_tenant_id_key"
  ON "direction_decision_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "direction_decision_versions_root_id_key"
  ON "direction_decision_versions"("tenant_id", "direction_decision_id", "id");
CREATE UNIQUE INDEX "direction_decision_versions_number_key"
  ON "direction_decision_versions"("tenant_id", "direction_decision_id", "version_number");
CREATE INDEX "direction_decision_versions_application_recommendation_idx"
  ON "direction_decision_versions"("tenant_id", "application_id", "recommendation_version_id");

ALTER TABLE "direction_decisions"
  ADD CONSTRAINT "direction_decisions_current_version_fkey"
  FOREIGN KEY ("tenant_id", "id", "current_version_id")
  REFERENCES "direction_decision_versions"("tenant_id", "direction_decision_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION admission_guard_recommendation_version_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'admission recommendation versions are append-only' USING ERRCODE = '55000';
  END IF;

  IF OLD.lifecycle = 'SUBMITTED' THEN
    RAISE EXCEPTION 'submitted admission recommendation versions are immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD.id <> NEW.id
    OR OLD.tenant_id <> NEW.tenant_id
    OR OLD.recommendation_id <> NEW.recommendation_id
    OR OLD.application_id <> NEW.application_id
    OR OLD.version_number <> NEW.version_number
    OR OLD.previous_version_id IS DISTINCT FROM NEW.previous_version_id
    OR OLD.created_by <> NEW.created_by
    OR OLD.created_at <> NEW.created_at
  THEN
    RAISE EXCEPTION 'recommendation version identity is immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD.lifecycle = 'DRAFT' AND NEW.lifecycle = 'SUBMITTED'
    AND (NEW.submitted_by IS NULL OR NEW.submitted_at IS NULL)
  THEN
    RAISE EXCEPTION 'submitted admission recommendation versions require submit metadata' USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle = 'DRAFT' AND NEW.lifecycle NOT IN ('DRAFT', 'SUBMITTED') THEN
    RAISE EXCEPTION 'invalid admission recommendation version lifecycle transition' USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "admission_recommendation_versions_append_only"
  BEFORE UPDATE OR DELETE ON "admission_recommendation_versions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_recommendation_version_append_only();

CREATE OR REPLACE FUNCTION admission_guard_direction_decision_version_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION 'direction decision versions are append-only' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "direction_decision_versions_append_only"
  BEFORE UPDATE OR DELETE ON "direction_decision_versions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_direction_decision_version_append_only();

ALTER TABLE "admission_recommendations" OWNER TO admission_migrator;
ALTER TABLE "admission_recommendation_versions" OWNER TO admission_migrator;
ALTER TABLE "direction_decisions" OWNER TO admission_migrator;
ALTER TABLE "direction_decision_versions" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_recommendation_version_append_only() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_direction_decision_version_append_only() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "admission_recommendations", "admission_recommendation_versions",
  "direction_decisions", "direction_decision_versions" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "admission_recommendations", "direction_decisions" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "admission_recommendation_versions" TO admission_app;
GRANT SELECT, INSERT ON TABLE "direction_decision_versions" TO admission_app;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admission_recommendations', 'admission_recommendation_versions',
    'direction_decisions', 'direction_decision_versions'
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
