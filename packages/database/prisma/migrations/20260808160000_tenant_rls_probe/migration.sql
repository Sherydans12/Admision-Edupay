-- E4-B: persistencia mínima y exclusivamente sintética para probar tenant/RLS.
CREATE TABLE "tenant_probe_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_probe_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_probe_records_tenant_id_idx"
    ON "tenant_probe_records"("tenant_id");

REVOKE ALL ON TABLE "tenant_probe_records" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE "tenant_probe_records"
    TO admission_app;

ALTER TABLE "tenant_probe_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_probe_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_probe_isolation"
    ON "tenant_probe_records"
    AS PERMISSIVE
    FOR ALL
    TO admission_app
    USING (
        "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    )
    WITH CHECK (
        "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    );

-- El rol runtime no necesita inspeccionar el historial de migraciones.
REVOKE ALL ON TABLE "_prisma_migrations" FROM admission_app;
