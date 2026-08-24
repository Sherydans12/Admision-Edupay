-- G5-P2: verified email delivery events and tenant-scoped recipient suppression.
-- Forward-only, additive and intentionally empty: no tenant or institutional seed data.

CREATE TYPE "CommunicationWebhookEventType" AS ENUM ('DELIVERED', 'BOUNCED', 'COMPLAINED');
CREATE TYPE "CommunicationSuppressionReason" AS ENUM ('BOUNCE', 'COMPLAINT');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM communication_attempts
    WHERE provider_reference IS NOT NULL
    GROUP BY provider, provider_reference
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'M21 cannot seal duplicate communication provider references';
  END IF;
END $$;

CREATE UNIQUE INDEX "communication_attempts_provider_reference_key"
  ON "communication_attempts"("provider", "provider_reference")
  WHERE "provider_reference" IS NOT NULL;

CREATE TABLE "communication_webhook_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "communication_attempt_id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "provider_event_id" VARCHAR(160) NOT NULL,
  "event_type" "CommunicationWebhookEventType" NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "communication_webhook_events_provider_check" CHECK (length(btrim("provider")) > 0),
  CONSTRAINT "communication_webhook_events_provider_event_check" CHECK (length(btrim("provider_event_id")) > 0),
  CONSTRAINT "communication_webhook_events_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "communication_webhook_events_attempt_fkey"
    FOREIGN KEY ("tenant_id", "communication_attempt_id")
    REFERENCES "communication_attempts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "communication_webhook_events_tenant_id_key"
  ON "communication_webhook_events"("tenant_id", "id");
CREATE UNIQUE INDEX "communication_webhook_events_provider_event_key"
  ON "communication_webhook_events"("provider", "provider_event_id");
CREATE INDEX "communication_webhook_events_attempt_occurred_idx"
  ON "communication_webhook_events"("tenant_id", "communication_attempt_id", "occurred_at");

CREATE TABLE "communication_suppressions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "channel_hash" CHAR(64) NOT NULL,
  "hash_key_version" INTEGER NOT NULL DEFAULT 1,
  "reason" "CommunicationSuppressionReason" NOT NULL,
  "source_webhook_event_id" UUID NOT NULL,
  "suppressed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_suppressions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "communication_suppressions_hash_check" CHECK ("channel_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "communication_suppressions_hash_version_check" CHECK ("hash_key_version" > 0),
  CONSTRAINT "communication_suppressions_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "communication_suppressions_source_event_fkey"
    FOREIGN KEY ("tenant_id", "source_webhook_event_id")
    REFERENCES "communication_webhook_events"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "communication_suppressions_tenant_id_key"
  ON "communication_suppressions"("tenant_id", "id");
CREATE UNIQUE INDEX "communication_suppressions_channel_key"
  ON "communication_suppressions"("tenant_id", "hash_key_version", "channel_hash");
CREATE INDEX "communication_suppressions_created_idx"
  ON "communication_suppressions"("tenant_id", "suppressed_at");

CREATE OR REPLACE FUNCTION admission_guard_g5p2_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "communication_webhook_events_append_only"
  BEFORE UPDATE OR DELETE ON "communication_webhook_events"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_g5p2_append_only();
CREATE TRIGGER "communication_suppressions_append_only"
  BEFORE UPDATE OR DELETE ON "communication_suppressions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_g5p2_append_only();

ALTER TABLE "communication_webhook_events" OWNER TO admission_migrator;
ALTER TABLE "communication_suppressions" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_g5p2_append_only() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "communication_webhook_events", "communication_suppressions" FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE "communication_webhook_events", "communication_suppressions" TO admission_app;

ALTER TABLE "communication_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_webhook_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "communication_webhook_events_tenant_isolation"
  ON "communication_webhook_events" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
ALTER TABLE "communication_suppressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_suppressions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "communication_suppressions_tenant_isolation"
  ON "communication_suppressions" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
