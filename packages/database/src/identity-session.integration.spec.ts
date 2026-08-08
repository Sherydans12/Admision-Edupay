import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { InMemoryAuditSink } from "./audit.js";
import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { InMemorySecurityEventSink } from "./security-events.js";
import { SessionService } from "./session-service.js";

const prisma = createAppPrismaClient();
const adminPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 2,
});
const baseNow = new Date("2026-08-08T20:00:00.000Z");
const sessionConfig = { absoluteTtlSeconds: 300, idleTtlSeconds: 60 } as const;

async function clearIdentityTables(): Promise<void> {
  await adminPool.query(`TRUNCATE TABLE
    "outbox_messages", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function createSyntheticUser() {
  return prisma.platformUser.create({
    data: { emailNormalized: `synthetic-${randomUUID()}@example.invalid` },
  });
}

describe.sequential("E4-C opaque session lifecycle", () => {
  beforeEach(clearIdentityTables);

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPool.end();
  });

  it("SES-01 persists only a SHA-256 verifier, never the raw token", async () => {
    const user = await createSyntheticUser();
    const service = new SessionService(prisma, { sessionConfig });
    const issued = await service.issueSession(user.id, baseNow);
    const row = await adminPool.query<{ token_hash: string }>(
      "SELECT token_hash FROM platform_sessions WHERE id = $1",
      [issued.sessionId],
    );

    expect(row.rows[0]?.token_hash).toHaveLength(64);
    expect(row.rows[0]?.token_hash).not.toBe(issued.token);
    expect(row.rows[0]?.token_hash).toBe(
      createHash("sha256").update(issued.token).digest("hex"),
    );
  });

  it("SES-02 resolves a valid opaque token to its user", async () => {
    const user = await createSyntheticUser();
    const service = new SessionService(prisma, { sessionConfig });
    const issued = await service.issueSession(user.id, baseNow);

    await expect(
      service.resolveSession(issued.token, new Date(baseNow.getTime() + 1_000)),
    ).resolves.toMatchObject({ userId: user.id, sessionId: issued.sessionId });
  });

  it("SES-03 treats an unknown token as unauthenticated", async () => {
    const service = new SessionService(prisma, { sessionConfig });
    await expect(
      service.resolveSession("synthetic-token-does-not-exist", baseNow),
    ).resolves.toBeUndefined();
  });

  it("SES-04 treats a revoked token as unauthenticated", async () => {
    const user = await createSyntheticUser();
    const service = new SessionService(prisma, { sessionConfig });
    const issued = await service.issueSession(user.id, baseNow);
    await service.revokeSession(
      issued.token,
      new Date(baseNow.getTime() + 1_000),
    );

    await expect(
      service.resolveSession(issued.token, new Date(baseNow.getTime() + 2_000)),
    ).resolves.toBeUndefined();
  });

  it("SES-05 rejects a token after idle expiration", async () => {
    const user = await createSyntheticUser();
    const service = new SessionService(prisma, { sessionConfig });
    const issued = await service.issueSession(user.id, baseNow);

    await expect(
      service.resolveSession(
        issued.token,
        new Date(baseNow.getTime() + 61_000),
      ),
    ).resolves.toBeUndefined();
  });

  it("SES-06 rejects a token after absolute expiration even if idle was refreshed", async () => {
    const user = await createSyntheticUser();
    const service = new SessionService(prisma, { sessionConfig });
    const issued = await service.issueSession(user.id, baseNow);
    await expect(
      service.resolveSession(
        issued.token,
        new Date(baseNow.getTime() + 50_000),
      ),
    ).resolves.toMatchObject({ userId: user.id });
    await expect(
      service.resolveSession(
        issued.token,
        new Date(baseNow.getTime() + 301_000),
      ),
    ).resolves.toBeUndefined();
  });

  it("SES-07 rotation invalidates the previous token", async () => {
    const user = await createSyntheticUser();
    const service = new SessionService(prisma, { sessionConfig });
    const issued = await service.issueSession(user.id, baseNow);
    const rotated = await service.rotateSession(
      issued.token,
      new Date(baseNow.getTime() + 1_000),
    );

    expect(rotated?.token).not.toBe(issued.token);
    await expect(
      service.resolveSession(issued.token, new Date(baseNow.getTime() + 2_000)),
    ).resolves.toBeUndefined();
    await expect(
      service.resolveSession(
        rotated?.token ?? "",
        new Date(baseNow.getTime() + 2_000),
      ),
    ).resolves.toMatchObject({ userId: user.id });
  });

  it("SES-08 revoke-all invalidates every session for the user", async () => {
    const user = await createSyntheticUser();
    const audit = new InMemoryAuditSink();
    const security = new InMemorySecurityEventSink();
    const service = new SessionService(prisma, {
      auditSink: audit,
      securityEvents: security,
      sessionConfig,
    });
    const first = await service.issueSession(user.id, baseNow);
    const second = await service.issueSession(
      user.id,
      new Date(baseNow.getTime() + 1_000),
    );

    await expect(
      service.revokeAllUserSessions(
        user.id,
        new Date(baseNow.getTime() + 2_000),
      ),
    ).resolves.toBe(2);
    await expect(
      service.resolveSession(first.token, new Date(baseNow.getTime() + 3_000)),
    ).resolves.toBeUndefined();
    await expect(
      service.resolveSession(second.token, new Date(baseNow.getTime() + 3_000)),
    ).resolves.toBeUndefined();
    expect(
      audit.events.some(({ action }) => action === "ALL_USER_SESSIONS_REVOKED"),
    ).toBe(true);
    expect(security.events.length).toBeGreaterThan(0);
  });
});
