-- E5-F: admission capacity, reservations, waitlist, offers and withdrawal.
-- Forward-only. Admission-owned data only; no Communication, EduPay or handoff.

ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

-- A withdrawal preserves the immutable submission timestamp and pinned form.
ALTER TABLE "applications"
  DROP CONSTRAINT "applications_submission_coherence_check";
ALTER TABLE "applications"
  ADD CONSTRAINT "applications_submission_coherence_check" CHECK (
    ("status" = 'DRAFT' AND "submitted_at" IS NULL)
    OR ("status" <> 'DRAFT' AND "submitted_at" IS NOT NULL AND "form_version_id" IS NOT NULL)
  );

CREATE TYPE "SeatReservationState" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED');
CREATE TYPE "WaitlistEntryState" AS ENUM ('ACTIVE', 'PROMOTED', 'WITHDRAWN');
CREATE TYPE "AdmissionOfferOrigin" AS ENUM ('NORMAL', 'WAITLIST');
CREATE TYPE "AdmissionOfferLifecycle" AS ENUM ('ACTIVE', 'ACCEPTED', 'DECLINED', 'EXPIRED');
CREATE TYPE "AdmissionOfferTerminalReason" AS ENUM (
  'FAMILY_ACCEPTED', 'FAMILY_DECLINED', 'DEADLINE_EXPIRED', 'APPLICATION_WITHDRAWN'
);

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_tenant_id_offering_id_key"
  UNIQUE ("tenant_id", "id", "offering_id");

ALTER TABLE "direction_decision_versions"
  ADD CONSTRAINT "direction_decision_versions_application_id_key"
  UNIQUE ("tenant_id", "application_id", "id");

CREATE TABLE "admission_capacities" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "configured_capacity" INTEGER NOT NULL,
  "offer_validity_business_days" INTEGER NOT NULL DEFAULT 3,
  "concurrency_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_capacities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_capacities_root_offering_key"
    UNIQUE ("tenant_id", "id", "offering_id"),
  CONSTRAINT "admission_capacities_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_capacities_offering_fkey"
    FOREIGN KEY ("tenant_id", "offering_id") REFERENCES "admission_offerings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_capacities_values_check"
    CHECK ("configured_capacity" >= 0
      AND "offer_validity_business_days" BETWEEN 1 AND 30
      AND "concurrency_version" > 0)
);
CREATE UNIQUE INDEX "admission_capacities_tenant_id_key"
  ON "admission_capacities"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_capacities_offering_id_key"
  ON "admission_capacities"("tenant_id", "offering_id");
CREATE INDEX "admission_capacities_offering_version_idx"
  ON "admission_capacities"("tenant_id", "offering_id", "concurrency_version");

CREATE TABLE "admission_capacity_adjustments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "capacity_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "previous_value" INTEGER NOT NULL,
  "new_value" INTEGER NOT NULL,
  "actor_id" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_capacity_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_capacity_adjustments_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_capacity_adjustments_capacity_fkey"
    FOREIGN KEY ("tenant_id", "capacity_id", "offering_id")
    REFERENCES "admission_capacities"("tenant_id", "id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_capacity_adjustments_values_check"
    CHECK ("previous_value" >= 0 AND "new_value" >= 0 AND length(btrim("reason")) > 0)
);
CREATE UNIQUE INDEX "admission_capacity_adjustments_tenant_id_key"
  ON "admission_capacity_adjustments"("tenant_id", "id");
CREATE INDEX "admission_capacity_adjustments_history_idx"
  ON "admission_capacity_adjustments"("tenant_id", "capacity_id", "created_at", "id");

CREATE TABLE "seat_reservations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "capacity_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "state" "SeatReservationState" NOT NULL DEFAULT 'ACTIVE',
  "reserved_at" TIMESTAMPTZ(3) NOT NULL,
  "committed_at" TIMESTAMPTZ(3),
  "released_at" TIMESTAMPTZ(3),
  "release_reason" VARCHAR(80),
  CONSTRAINT "seat_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seat_reservations_resource_key"
    UNIQUE ("tenant_id", "id", "application_id", "offering_id"),
  CONSTRAINT "seat_reservations_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "seat_reservations_capacity_fkey"
    FOREIGN KEY ("tenant_id", "capacity_id", "offering_id")
    REFERENCES "admission_capacities"("tenant_id", "id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seat_reservations_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id", "offering_id")
    REFERENCES "applications"("tenant_id", "id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seat_reservations_state_check"
    CHECK (("state" = 'ACTIVE' AND "committed_at" IS NULL AND "released_at" IS NULL AND "release_reason" IS NULL)
      OR ("state" = 'COMMITTED' AND "committed_at" IS NOT NULL AND "released_at" IS NULL AND "release_reason" IS NULL)
      OR ("state" = 'RELEASED' AND "committed_at" IS NULL AND "released_at" IS NOT NULL AND "release_reason" IS NOT NULL))
);
CREATE UNIQUE INDEX "seat_reservations_tenant_id_key"
  ON "seat_reservations"("tenant_id", "id");
CREATE UNIQUE INDEX "seat_reservations_one_consuming_per_application_key"
  ON "seat_reservations"("tenant_id", "application_id", "offering_id")
  WHERE "state" IN ('ACTIVE', 'COMMITTED');
CREATE INDEX "seat_reservations_capacity_consumption_idx"
  ON "seat_reservations"("tenant_id", "capacity_id", "state");

CREATE TABLE "waitlist_entries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "direction_decision_version_id" UUID NOT NULL,
  "state" "WaitlistEntryState" NOT NULL DEFAULT 'ACTIVE',
  "concurrency_version" INTEGER NOT NULL DEFAULT 1,
  "entered_at" TIMESTAMPTZ(3) NOT NULL,
  "promoted_at" TIMESTAMPTZ(3),
  "promoted_by" UUID,
  "withdrawn_at" TIMESTAMPTZ(3),
  CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "waitlist_entries_resource_key"
    UNIQUE ("tenant_id", "id", "application_id", "offering_id"),
  CONSTRAINT "waitlist_entries_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "waitlist_entries_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id", "offering_id")
    REFERENCES "applications"("tenant_id", "id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "waitlist_entries_decision_fkey"
    FOREIGN KEY ("tenant_id", "application_id", "direction_decision_version_id")
    REFERENCES "direction_decision_versions"("tenant_id", "application_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "waitlist_entries_state_check"
    CHECK ("concurrency_version" > 0 AND
      (("state" = 'ACTIVE' AND "promoted_at" IS NULL AND "promoted_by" IS NULL AND "withdrawn_at" IS NULL)
      OR ("state" = 'PROMOTED' AND "promoted_at" IS NOT NULL AND "promoted_by" IS NOT NULL AND "withdrawn_at" IS NULL)
      OR ("state" = 'WITHDRAWN' AND "promoted_at" IS NULL AND "promoted_by" IS NULL AND "withdrawn_at" IS NOT NULL)))
);
CREATE UNIQUE INDEX "waitlist_entries_tenant_id_key"
  ON "waitlist_entries"("tenant_id", "id");
CREATE UNIQUE INDEX "waitlist_entries_one_active_per_application_key"
  ON "waitlist_entries"("tenant_id", "application_id", "offering_id") WHERE "state" = 'ACTIVE';
CREATE INDEX "waitlist_entries_default_order_idx"
  ON "waitlist_entries"("tenant_id", "offering_id", "state", "entered_at", "id");

CREATE TABLE "admission_offers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "origin" "AdmissionOfferOrigin" NOT NULL,
  "current_version_id" UUID,
  "concurrency_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_offers_resource_key"
    UNIQUE ("tenant_id", "id", "application_id", "offering_id"),
  CONSTRAINT "admission_offers_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_offers_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id", "offering_id")
    REFERENCES "applications"("tenant_id", "id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_offers_version_check" CHECK ("concurrency_version" > 0)
);
CREATE UNIQUE INDEX "admission_offers_tenant_id_key"
  ON "admission_offers"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_offers_application_id_key"
  ON "admission_offers"("tenant_id", "application_id");
CREATE INDEX "admission_offers_current_idx"
  ON "admission_offers"("tenant_id", "offering_id", "current_version_id");

CREATE TABLE "admission_offer_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "offer_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "previous_version_id" UUID,
  "origin" "AdmissionOfferOrigin" NOT NULL,
  "lifecycle" "AdmissionOfferLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "issued_at" TIMESTAMPTZ(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "issued_by" UUID NOT NULL,
  "reopen_reason" VARCHAR(1000),
  "terminal_at" TIMESTAMPTZ(3),
  "terminal_reason" "AdmissionOfferTerminalReason",
  CONSTRAINT "admission_offer_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_offer_versions_root_id_key"
    UNIQUE ("tenant_id", "offer_id", "id"),
  CONSTRAINT "admission_offer_versions_application_id_key"
    UNIQUE ("tenant_id", "offer_id", "id", "application_id"),
  CONSTRAINT "admission_offer_versions_acceptance_resource_key"
    UNIQUE ("tenant_id", "offer_id", "id", "application_id", "reservation_id", "offering_id"),
  CONSTRAINT "admission_offer_versions_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admission_offer_versions_offer_fkey"
    FOREIGN KEY ("tenant_id", "offer_id", "application_id", "offering_id")
    REFERENCES "admission_offers"("tenant_id", "id", "application_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_offer_versions_reservation_fkey"
    FOREIGN KEY ("tenant_id", "reservation_id", "application_id", "offering_id")
    REFERENCES "seat_reservations"("tenant_id", "id", "application_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admission_offer_versions_values_check"
    CHECK ("version_number" > 0 AND "expires_at" > "issued_at"
      AND ("previous_version_id" IS NULL OR "previous_version_id" <> "id")
      AND (("version_number" = 1 AND "previous_version_id" IS NULL AND "reopen_reason" IS NULL)
        OR ("version_number" > 1 AND "previous_version_id" IS NOT NULL AND length(btrim("reopen_reason")) > 0))),
  CONSTRAINT "admission_offer_versions_lifecycle_check"
    CHECK (("lifecycle" = 'ACTIVE' AND "terminal_at" IS NULL AND "terminal_reason" IS NULL)
      OR ("lifecycle" = 'ACCEPTED' AND "terminal_at" IS NOT NULL AND "terminal_reason" = 'FAMILY_ACCEPTED')
      OR ("lifecycle" = 'DECLINED' AND "terminal_at" IS NOT NULL AND "terminal_reason" IN ('FAMILY_DECLINED', 'APPLICATION_WITHDRAWN'))
      OR ("lifecycle" = 'EXPIRED' AND "terminal_at" IS NOT NULL AND "terminal_reason" = 'DEADLINE_EXPIRED'))
);
CREATE UNIQUE INDEX "admission_offer_versions_tenant_id_key"
  ON "admission_offer_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "admission_offer_versions_number_key"
  ON "admission_offer_versions"("tenant_id", "offer_id", "version_number");
CREATE UNIQUE INDEX "admission_offer_versions_reservation_key"
  ON "admission_offer_versions"("tenant_id", "reservation_id");
CREATE UNIQUE INDEX "admission_offer_versions_one_active_key"
  ON "admission_offer_versions"("tenant_id", "offer_id") WHERE "lifecycle" = 'ACTIVE';
CREATE INDEX "admission_offer_versions_due_idx"
  ON "admission_offer_versions"("tenant_id", "lifecycle", "expires_at", "id");

ALTER TABLE "admission_offer_versions"
  ADD CONSTRAINT "admission_offer_versions_previous_same_root_fkey"
  FOREIGN KEY ("tenant_id", "offer_id", "previous_version_id")
  REFERENCES "admission_offer_versions"("tenant_id", "offer_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admission_offers"
  ADD CONSTRAINT "admission_offers_current_version_fkey"
  FOREIGN KEY ("tenant_id", "id", "current_version_id")
  REFERENCES "admission_offer_versions"("tenant_id", "offer_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "offer_acceptances" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "offer_id" UUID NOT NULL,
  "offer_version_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "accepted_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "offer_acceptances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offer_acceptances_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "offer_acceptances_offer_version_fkey"
    FOREIGN KEY ("tenant_id", "offer_id", "offer_version_id", "application_id", "reservation_id", "offering_id")
    REFERENCES "admission_offer_versions"("tenant_id", "offer_id", "id", "application_id", "reservation_id", "offering_id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "offer_acceptances_tenant_id_key"
  ON "offer_acceptances"("tenant_id", "id");
CREATE UNIQUE INDEX "offer_acceptances_one_per_offer_key"
  ON "offer_acceptances"("tenant_id", "offer_id");
CREATE UNIQUE INDEX "offer_acceptances_one_per_version_key"
  ON "offer_acceptances"("tenant_id", "offer_version_id");
CREATE INDEX "offer_acceptances_application_idx"
  ON "offer_acceptances"("tenant_id", "application_id", "accepted_at");

CREATE TABLE "application_withdrawals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "offering_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(3) NOT NULL,
  "offer_id" UUID,
  "offer_version_id" UUID,
  "reservation_id" UUID,
  "waitlist_entry_id" UUID,
  CONSTRAINT "application_withdrawals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_withdrawals_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_withdrawals_application_fkey"
    FOREIGN KEY ("tenant_id", "application_id", "offering_id")
    REFERENCES "applications"("tenant_id", "id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_withdrawals_offer_fkey"
    FOREIGN KEY ("tenant_id", "offer_id", "application_id", "offering_id")
    REFERENCES "admission_offers"("tenant_id", "id", "application_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_withdrawals_offer_version_fkey"
    FOREIGN KEY ("tenant_id", "offer_id", "offer_version_id", "application_id")
    REFERENCES "admission_offer_versions"("tenant_id", "offer_id", "id", "application_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_withdrawals_reservation_fkey"
    FOREIGN KEY ("tenant_id", "reservation_id", "application_id", "offering_id")
    REFERENCES "seat_reservations"("tenant_id", "id", "application_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_withdrawals_waitlist_fkey"
    FOREIGN KEY ("tenant_id", "waitlist_entry_id", "application_id", "offering_id")
    REFERENCES "waitlist_entries"("tenant_id", "id", "application_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "application_withdrawals_optional_refs_check"
    CHECK (("offer_id" IS NULL) = ("offer_version_id" IS NULL))
);
CREATE UNIQUE INDEX "application_withdrawals_tenant_id_key"
  ON "application_withdrawals"("tenant_id", "id");
CREATE UNIQUE INDEX "application_withdrawals_application_id_key"
  ON "application_withdrawals"("tenant_id", "application_id");
CREATE INDEX "application_withdrawals_confirmed_idx"
  ON "application_withdrawals"("tenant_id", "confirmed_at", "id");

CREATE OR REPLACE FUNCTION admission_guard_e5f_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'admission_app' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "admission_capacity_adjustments_append_only"
  BEFORE UPDATE OR DELETE ON "admission_capacity_adjustments"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_e5f_append_only();
CREATE TRIGGER "offer_acceptances_append_only"
  BEFORE UPDATE OR DELETE ON "offer_acceptances"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_e5f_append_only();
CREATE TRIGGER "application_withdrawals_append_only"
  BEFORE UPDATE OR DELETE ON "application_withdrawals"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_e5f_append_only();

CREATE OR REPLACE FUNCTION admission_guard_seat_reservation_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'admission_app' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'seat reservations preserve history' USING ERRCODE = '55000';
  END IF;
  IF OLD.id <> NEW.id OR OLD.tenant_id <> NEW.tenant_id OR OLD.capacity_id <> NEW.capacity_id
    OR OLD.application_id <> NEW.application_id OR OLD.offering_id <> NEW.offering_id
    OR OLD.reserved_at <> NEW.reserved_at
  THEN RAISE EXCEPTION 'seat reservation identity is immutable' USING ERRCODE = '55000'; END IF;
  IF OLD.state <> 'ACTIVE' OR NEW.state NOT IN ('COMMITTED', 'RELEASED') THEN
    RAISE EXCEPTION 'invalid seat reservation transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "seat_reservations_history_guard"
  BEFORE UPDATE OR DELETE ON "seat_reservations"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_seat_reservation_history();

CREATE OR REPLACE FUNCTION admission_guard_waitlist_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'admission_app' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'waitlist entries preserve history' USING ERRCODE = '55000';
  END IF;
  IF OLD.id <> NEW.id OR OLD.tenant_id <> NEW.tenant_id OR OLD.application_id <> NEW.application_id
    OR OLD.offering_id <> NEW.offering_id OR OLD.direction_decision_version_id <> NEW.direction_decision_version_id
    OR OLD.entered_at <> NEW.entered_at
  THEN RAISE EXCEPTION 'waitlist entry identity is immutable' USING ERRCODE = '55000'; END IF;
  IF OLD.state <> 'ACTIVE' OR NEW.state NOT IN ('PROMOTED', 'WITHDRAWN')
    OR NEW.concurrency_version <> OLD.concurrency_version + 1
  THEN RAISE EXCEPTION 'invalid waitlist entry transition' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "waitlist_entries_history_guard"
  BEFORE UPDATE OR DELETE ON "waitlist_entries"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_waitlist_history();

CREATE OR REPLACE FUNCTION admission_guard_offer_version_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'admission_app' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'admission offer versions preserve history' USING ERRCODE = '55000';
  END IF;
  IF OLD.id <> NEW.id OR OLD.tenant_id <> NEW.tenant_id OR OLD.offer_id <> NEW.offer_id
    OR OLD.application_id <> NEW.application_id OR OLD.offering_id <> NEW.offering_id
    OR OLD.reservation_id <> NEW.reservation_id OR OLD.version_number <> NEW.version_number
    OR OLD.previous_version_id IS DISTINCT FROM NEW.previous_version_id OR OLD.origin <> NEW.origin
    OR OLD.issued_at <> NEW.issued_at OR OLD.expires_at <> NEW.expires_at
    OR OLD.issued_by <> NEW.issued_by OR OLD.reopen_reason IS DISTINCT FROM NEW.reopen_reason
  THEN RAISE EXCEPTION 'admission offer version identity is immutable' USING ERRCODE = '55000'; END IF;
  IF OLD.lifecycle <> 'ACTIVE' OR NEW.lifecycle NOT IN ('ACCEPTED', 'DECLINED', 'EXPIRED') THEN
    RAISE EXCEPTION 'invalid admission offer transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "admission_offer_versions_history_guard"
  BEFORE UPDATE OR DELETE ON "admission_offer_versions"
  FOR EACH ROW EXECUTE FUNCTION admission_guard_offer_version_history();

ALTER TABLE "admission_capacities" OWNER TO admission_migrator;
ALTER TABLE "admission_capacity_adjustments" OWNER TO admission_migrator;
ALTER TABLE "seat_reservations" OWNER TO admission_migrator;
ALTER TABLE "waitlist_entries" OWNER TO admission_migrator;
ALTER TABLE "admission_offers" OWNER TO admission_migrator;
ALTER TABLE "admission_offer_versions" OWNER TO admission_migrator;
ALTER TABLE "offer_acceptances" OWNER TO admission_migrator;
ALTER TABLE "application_withdrawals" OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_e5f_append_only() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_seat_reservation_history() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_waitlist_history() OWNER TO admission_migrator;
ALTER FUNCTION admission_guard_offer_version_history() OWNER TO admission_migrator;

REVOKE ALL ON TABLE "admission_capacities", "admission_capacity_adjustments", "seat_reservations",
  "waitlist_entries", "admission_offers", "admission_offer_versions", "offer_acceptances",
  "application_withdrawals" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "admission_capacities", "seat_reservations", "waitlist_entries",
  "admission_offers", "admission_offer_versions" TO admission_app;
GRANT SELECT, INSERT ON TABLE "admission_capacity_adjustments", "offer_acceptances",
  "application_withdrawals" TO admission_app;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admission_capacities', 'admission_capacity_adjustments', 'seat_reservations',
    'waitlist_entries', 'admission_offers', 'admission_offer_versions',
    'offer_acceptances', 'application_withdrawals'
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
