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

function createSessionService(
  overrides: Partial<
    Pick<
      ConstructorParameters<typeof SessionService>[1],
      "auditSink" | "securityEvents"
    >
  > = {},
): SessionService {
  return new SessionService(prisma, {
    auditSink: overrides.auditSink ?? new InMemoryAuditSink(),
    securityEvents: overrides.securityEvents ?? new InMemorySecurityEventSink(),
    sessionConfig,
  });
}

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
    const audit = new InMemoryAuditSink();
    const service = createSessionService({ auditSink: audit });
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
    expect(audit.events[0]?.action).toBe("SESSION_ISSUED");
  });

  it("SES-02 resolves a valid opaque token to its user", async () => {
    const user = await createSyntheticUser();
    const service = createSessionService();
    const issued = await service.issueSession(user.id, baseNow);

    await expect(
      service.resolveSession(issued.token, new Date(baseNow.getTime() + 1_000)),
    ).resolves.toMatchObject({ userId: user.id, sessionId: issued.sessionId });
  });

  it("SES-03 treats an unknown token as unauthenticated", async () => {
    const service = createSessionService();
    await expect(
      service.resolveSession("synthetic-token-does-not-exist", baseNow),
    ).resolves.toBeUndefined();
  });

  it("SES-04 treats a revoked token as unauthenticated", async () => {
    const user = await createSyntheticUser();
    const service = createSessionService();
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
    const service = createSessionService();
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
    const service = createSessionService();
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
    const audit = new InMemoryAuditSink();
    const service = createSessionService({ auditSink: audit });
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
    expect(audit.events.map(({ action }) => action)).toContain(
      "SESSION_ROTATED",
    );
  });

  it("SES-08 revoke-all invalidates every session for the user", async () => {
    const user = await createSyntheticUser();
    const audit = new InMemoryAuditSink();
    const security = new InMemorySecurityEventSink();
    const service = createSessionService({
      auditSink: audit,
      securityEvents: security,
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

  it("SES-13 permits exactly one concurrent rotation successor", async () => {
    const user = await createSyntheticUser();
    const service = createSessionService();
    const issued = await service.issueSession(user.id, baseNow);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        service.rotateSession(
          issued.token,
          new Date(baseNow.getTime() + 1_000),
        ),
      ),
    );
    const successors = results.filter((result) => result !== undefined);
    expect(successors).toHaveLength(1);
    const rows = await adminPool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM platform_sessions WHERE rotated_from_session_id = $1",
      [issued.sessionId],
    );
    expect(rows.rows[0]?.count).toBe("1");
  });

  it("SES-14 invalidates the old token after rotation", async () => {
    const user = await createSyntheticUser();
    const service = createSessionService();
    const issued = await service.issueSession(user.id, baseNow);
    const rotated = await service.rotateSession(issued.token, baseNow);
    expect(rotated).toBeDefined();
    await expect(
      service.resolveSession(issued.token, baseNow),
    ).resolves.toBeUndefined();
  });

  it("SES-15 stores exactly one successor link", async () => {
    const user = await createSyntheticUser();
    const service = createSessionService();
    const issued = await service.issueSession(user.id, baseNow);
    const rotated = await service.rotateSession(issued.token, baseNow);
    const rows = await adminPool.query<{ count: string; successor: string }>(
      "SELECT count(*)::text AS count, (array_agg(id))[1]::text AS successor FROM platform_sessions WHERE rotated_from_session_id = $1",
      [issued.sessionId],
    );
    expect(rows.rows[0]?.count).toBe("1");
    expect(rows.rows[0]?.successor).toBe(rotated?.sessionId);
  });

  it("SES-16 keeps a concurrently revoked session invalid after the race", async () => {
    const user = await createSyntheticUser();
    const service = createSessionService();
    const issued = await service.issueSession(user.id, baseNow);
    await Promise.all([
      service.revokeSession(issued.token, new Date(baseNow.getTime() + 1_000)),
      ...Array.from({ length: 20 }, () =>
        service.resolveSession(
          issued.token,
          new Date(baseNow.getTime() + 1_000),
        ),
      ),
    ]);
    await expect(
      service.resolveSession(issued.token, new Date(baseNow.getTime() + 2_000)),
    ).resolves.toBeUndefined();
  });

  it("AUD-04 awaits an asynchronous audit sink before returning", async () => {
    let completed = false;
    const service = createSessionService({
      auditSink: {
        record: async () => {
          await Promise.resolve();
          completed = true;
        },
      },
    });
    const user = await createSyntheticUser();
    await service.issueSession(user.id, baseNow);
    expect(completed).toBe(true);
  });
});
