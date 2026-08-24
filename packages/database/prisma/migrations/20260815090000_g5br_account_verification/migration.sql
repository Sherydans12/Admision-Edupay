-- G5-BR: global control-plane account registration and email verification.
-- This table is intentionally not tenant-owned: registration precedes membership.

ALTER TYPE "PlatformUserStatus" ADD VALUE 'PENDING_VERIFICATION';

ALTER TABLE "platform_users"
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(3);

CREATE TYPE "AccountVerificationPurpose" AS ENUM ('ACCOUNT_REGISTRATION');

CREATE TABLE "account_verification_challenges" (
    "id" UUID NOT NULL,
    "platform_user_id" UUID NOT NULL,
    "normalized_channel_hash" CHAR(64) NOT NULL,
    "verifier_hash" CHAR(64) NOT NULL,
    "purpose" "AccountVerificationPurpose" NOT NULL DEFAULT 'ACCOUNT_REGISTRATION',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "superseded_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_verification_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_verification_challenges_platform_user_fkey"
      FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_verification_challenges_attempts_check"
      CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "account_verification_challenges_verifier_hash_key"
  ON "account_verification_challenges"("verifier_hash");
CREATE INDEX "account_verification_challenges_platform_user_created_idx"
  ON "account_verification_challenges"("platform_user_id", "created_at");
CREATE INDEX "account_verification_challenges_expires_at_idx"
  ON "account_verification_challenges"("expires_at");
CREATE UNIQUE INDEX "account_verification_challenges_one_active_per_user_key"
  ON "account_verification_challenges"("platform_user_id")
  WHERE "consumed_at" IS NULL AND "superseded_at" IS NULL;

ALTER TABLE "account_verification_challenges" OWNER TO admission_migrator;

REVOKE ALL ON TABLE "account_verification_challenges" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "account_verification_challenges" TO admission_app;

-- Extend the existing platform-global audit allowlist without weakening tenant checks.
ALTER TABLE "audit_events"
  DROP CONSTRAINT "audit_events_platform_global_action_check",
  ADD CONSTRAINT "audit_events_platform_global_action_check"
  CHECK (
    "scope" = 'TENANT'
    OR "action" IN (
      'FAMILY_PROFILE_CREATED',
      'FAMILY_PROFILE_UPDATED',
      'STUDENT_CREATED',
      'STUDENT_UPDATED',
      'SESSION_ISSUED',
      'SESSION_ROTATED',
      'SESSION_REVOKED',
      'ALL_USER_SESSIONS_REVOKED',
      'ACCOUNT_REGISTRATION_REQUESTED',
      'ACCOUNT_VERIFICATION_SUCCEEDED',
      'ACCOUNT_ACTIVATED',
      'ACCOUNT_VERIFICATION_REJECTED',
      'ACCOUNT_VERIFICATION_EXPIRED',
      'ACCOUNT_VERIFICATION_REPLAYED'
    )
  );
