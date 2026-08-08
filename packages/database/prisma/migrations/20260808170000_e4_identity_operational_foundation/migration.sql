-- E4-C/D: control-plane identity/session + tenant memberships + operational outbox.
CREATE TYPE "PlatformUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "RoleAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "OutboxMessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "status" "PlatformUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_users_email_normalized_key" ON "platform_users"("email_normalized");

CREATE TABLE "platform_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "rotated_from_session_id" UUID,
    CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "platform_sessions_token_hash_key" ON "platform_sessions"("token_hash");
CREATE UNIQUE INDEX "platform_sessions_rotated_from_session_id_key" ON "platform_sessions"("rotated_from_session_id");
CREATE INDEX "platform_sessions_user_id_revoked_at_idx" ON "platform_sessions"("user_id", "revoked_at");
CREATE INDEX "platform_sessions_idle_expires_at_absolute_expires_at_idx" ON "platform_sessions"("idle_expires_at", "absolute_expires_at");

CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships"("user_id", "tenant_id");
CREATE INDEX "memberships_tenant_id_status_idx" ON "memberships"("tenant_id", "status");

CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_key" VARCHAR(80) NOT NULL,
    "permissions" TEXT[] NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "role_assignments_membership_fkey" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "role_assignments_tenant_id_id_key" ON "role_assignments"("tenant_id", "id");
CREATE INDEX "role_assignments_tenant_id_membership_id_status_idx" ON "role_assignments"("tenant_id", "membership_id", "status");

CREATE TABLE "support_elevations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "purpose" VARCHAR(120) NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "categories" TEXT[] NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_elevations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_elevations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "support_elevations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "support_elevations_tenant_id_expires_at_closed_at_revoked_at_idx" ON "support_elevations"("tenant_id", "expires_at", "closed_at", "revoked_at");
CREATE INDEX "support_elevations_actor_user_id_started_at_idx" ON "support_elevations"("actor_user_id", "started_at");

CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "topic" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxMessageStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(160) NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "outbox_messages_tenant_id_idempotency_key_key" ON "outbox_messages"("tenant_id", "idempotency_key");
CREATE INDEX "outbox_messages_tenant_id_status_available_at_idx" ON "outbox_messages"("tenant_id", "status", "available_at");

-- Ownership explícito: sólo el migrator crea/modifica estructura.
ALTER TABLE "platform_users" OWNER TO admission_migrator;
ALTER TABLE "platform_sessions" OWNER TO admission_migrator;
ALTER TABLE "tenants" OWNER TO admission_migrator;
ALTER TABLE "memberships" OWNER TO admission_migrator;
ALTER TABLE "role_assignments" OWNER TO admission_migrator;
ALTER TABLE "support_elevations" OWNER TO admission_migrator;
ALTER TABLE "outbox_messages" OWNER TO admission_migrator;

-- Privilegios explícitos por migración; no se usan default privileges.
REVOKE ALL ON TABLE "platform_users", "platform_sessions", "tenants", "memberships", "role_assignments", "support_elevations", "outbox_messages" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "platform_users" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "platform_sessions" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "tenants" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "memberships" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "role_assignments" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "support_elevations" TO admission_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "outbox_messages" TO admission_app;

-- RLS en todas las tablas tenant-owned nuevas.
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memberships_tenant_isolation" ON "memberships" AS PERMISSIVE FOR ALL TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    OR (
      "tenant_id" = NULLIF(current_setting('admission.candidate_tenant_id', true), '')::UUID
      AND "user_id" = NULLIF(current_setting('admission.actor_id', true), '')::UUID
    )
  )
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "role_assignments_tenant_isolation" ON "role_assignments" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);

ALTER TABLE "support_elevations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_elevations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "support_elevations_tenant_isolation" ON "support_elevations" AS PERMISSIVE FOR ALL TO admission_app
  USING (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    OR (
      current_setting('admission.platform_operation', true) = 'support_elevation'
      AND "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
      AND "actor_user_id" = NULLIF(current_setting('admission.actor_id', true), '')::UUID
    )
  )
  WITH CHECK (
    "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
    OR (
      current_setting('admission.platform_operation', true) = 'support_elevation'
      AND "tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID
      AND "actor_user_id" = NULLIF(current_setting('admission.actor_id', true), '')::UUID
    )
  );

ALTER TABLE "outbox_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY "outbox_messages_tenant_isolation" ON "outbox_messages" AS PERMISSIVE FOR ALL TO admission_app
  USING ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('admission.tenant_id', true), '')::UUID);
