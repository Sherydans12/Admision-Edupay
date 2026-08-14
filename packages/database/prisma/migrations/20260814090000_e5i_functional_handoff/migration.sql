-- E5-I: local functional boundary only. No external integration contract is created.

CREATE UNIQUE INDEX "offer_acceptances_tenant_id_id_application_id_key"
  ON "offer_acceptances"("tenant_id", "id", "application_id");

CREATE TABLE "integration_handoffs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "offer_acceptance_id" UUID NOT NULL,
  "requested_by_actor_id" UUID NOT NULL,
  "requested_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_handoffs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_handoffs_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "integration_handoffs_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id")
    REFERENCES "applications"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "integration_handoffs_offer_acceptance_fkey"
    FOREIGN KEY ("tenant_id", "offer_acceptance_id", "application_id")
    REFERENCES "offer_acceptances"("tenant_id", "id", "application_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "integration_handoffs_tenant_id_key"
  ON "integration_handoffs"("tenant_id", "id");
CREATE UNIQUE INDEX "integration_handoffs_tenant_offer_acceptance_key"
  ON "integration_handoffs"("tenant_id", "offer_acceptance_id");
CREATE UNIQUE INDEX "integration_handoffs_offer_acceptance_application_key"
  ON "integration_handoffs"("tenant_id", "offer_acceptance_id", "application_id");
CREATE INDEX "integration_handoffs_application_created_idx"
  ON "integration_handoffs"("tenant_id", "application_id", "created_at");

CREATE OR REPLACE FUNCTION admission_guard_e5i_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "integration_handoffs_append_only"
  BEFORE UPDATE OR DELETE ON "integration_handoffs"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_e5i_append_only();

ALTER TABLE "integration_handoffs" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_e5i_append_only() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "integration_handoffs" FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE "integration_handoffs" TO admission_app;

ALTER TABLE "integration_handoffs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_handoffs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "integration_handoffs_tenant_isolation"
  ON "integration_handoffs"
  AS PERMISSIVE
  FOR ALL
  TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  );
