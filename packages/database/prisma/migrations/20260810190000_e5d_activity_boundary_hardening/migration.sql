-- E5-D hardening: preserve tenant + aggregate boundaries in activity history.
-- Forward-only. Synthetic/non-production data only; no calendar or EduPay integration.

ALTER TABLE "activity_appointments"
  ADD CONSTRAINT "activity_appointments_assigned_user_fkey"
  FOREIGN KEY ("assigned_user_id") REFERENCES "platform_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_appointments"
  DROP CONSTRAINT "activity_appointments_previous_fkey";

ALTER TABLE "activity_appointments"
  ADD CONSTRAINT "activity_appointments_previous_same_activity_fkey"
  FOREIGN KEY ("tenant_id", "application_activity_id", "previous_appointment_id")
  REFERENCES "activity_appointments"("tenant_id", "application_activity_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_appointments"
  ADD CONSTRAINT "activity_appointments_previous_not_self_check"
  CHECK ("previous_appointment_id" IS NULL OR "previous_appointment_id" <> "id");

ALTER TABLE "activity_results"
  DROP CONSTRAINT "activity_results_previous_fkey";

CREATE UNIQUE INDEX "activity_results_attempt_id_key"
  ON "activity_results"("tenant_id", "application_activity_id", "attempt_id", "id");

ALTER TABLE "activity_results"
  ADD CONSTRAINT "activity_results_previous_same_attempt_fkey"
  FOREIGN KEY ("tenant_id", "application_activity_id", "attempt_id", "previous_result_id")
  REFERENCES "activity_results"("tenant_id", "application_activity_id", "attempt_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_results"
  ADD CONSTRAINT "activity_results_previous_not_self_check"
  CHECK ("previous_result_id" IS NULL OR "previous_result_id" <> "id");
