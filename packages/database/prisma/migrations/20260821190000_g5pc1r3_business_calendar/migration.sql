-- G5-PC1-R3: institutional business calendar, deadlines & offer reminders.
-- Migration 19: tenant business calendar configuration and excluded dates.
-- No calendar rows or holidays are auto-seeded (fail-closed, R3-001..R3-005).

-- 1. Tenant business calendar table (R3-001, R3-002, R3-013).
CREATE TABLE "tenant_business_calendars" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "timezone" VARCHAR(80) NOT NULL,
  "concurrency_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_business_calendars_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_business_calendars_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tenant_business_calendars_tenant_id_key"
  ON "tenant_business_calendars"("tenant_id");

-- 2. Excluded dates table (R3-004, R3-005).
CREATE TABLE "business_calendar_excluded_dates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "calendar_date" DATE NOT NULL,
  "reason" VARCHAR(200) NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_calendar_excluded_dates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_calendar_excluded_dates_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_calendar_excluded_dates_calendar_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant_business_calendars"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_calendar_excluded_dates_creator_fkey"
    FOREIGN KEY ("created_by") REFERENCES "platform_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "business_calendar_excluded_dates_tenant_calendar_date_key"
  ON "business_calendar_excluded_dates"("tenant_id", "calendar_date");
CREATE INDEX "business_calendar_excluded_dates_tenant_id_calendar_date_idx"
  ON "business_calendar_excluded_dates"("tenant_id", "calendar_date");

-- 3. Ownership: all new objects owned by admission_migrator.
ALTER TABLE "tenant_business_calendars" OWNER TO admission_migrator;
ALTER TABLE "business_calendar_excluded_dates" OWNER TO admission_migrator;

-- 4. Grants: admission_app gets full CRUD on calendar & excluded dates.
REVOKE ALL ON TABLE "tenant_business_calendars" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenant_business_calendars" TO admission_app;

REVOKE ALL ON TABLE "business_calendar_excluded_dates" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "business_calendar_excluded_dates" TO admission_app;

-- 5. RLS: enable and force on both tenant-scoped tables.
ALTER TABLE "tenant_business_calendars" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_business_calendars" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_business_calendars_tenant_isolation"
  ON "tenant_business_calendars"
  AS PERMISSIVE
  FOR ALL
  TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  );

ALTER TABLE "business_calendar_excluded_dates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_calendar_excluded_dates" FORCE ROW LEVEL SECURITY;

CREATE POLICY "business_calendar_excluded_dates_tenant_isolation"
  ON "business_calendar_excluded_dates"
  AS PERMISSIVE
  FOR ALL
  TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
  );
