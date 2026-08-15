import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import { InMemoryAuditSink } from "./audit.js";
import {
  createTestAccountRegistrationService,
  type AccountRegistrationService,
} from "./account-registration.js";
import { DevelopmentIdentityEmailAdapter } from "./identity-email-adapter.js";
import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { InMemorySecurityEventSink } from "./security-events.js";
import { SessionService } from "./session-service.js";

const prisma = createAppPrismaClient();
const adminPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 4,
});
const baseNow = new Date("2026-08-15T12:00:00.000Z");
let now = baseNow;

async function clearIdentityTables(): Promise<void> {
  await adminPool.query(`TRUNCATE TABLE
    "account_verification_challenges", "audit_events", "outbox_messages",
    "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
}

function createFixture(): {
  adapter: DevelopmentIdentityEmailAdapter;
  audit: InMemoryAuditSink;
  security: InMemorySecurityEventSink;
  service: AccountRegistrationService;
} {
  const adapter = new DevelopmentIdentityEmailAdapter();
  const audit = new InMemoryAuditSink();
  const security = new InMemorySecurityEventSink();
  const sessions = new SessionService(prisma, {
    auditSink: audit,
    securityEvents: security,
    sessionConfig: { absoluteTtlSeconds: 300, idleTtlSeconds: 60 },
  });
  const service = createTestAccountRegistrationService(
    prisma,
    sessions,
    audit,
    security,
    adapter,
    {
      challengeTtlSeconds: 60,
      clock: () => now,
      maxAttempts: 5,
      registrationCooldownMs: 0,
    },
  );
  return { adapter, audit, security, service };
}

async function findUser(email: string) {
  return prisma.platformUser.findUnique({
    include: { memberships: true },
    where: { emailNormalized: email.toLowerCase() },
  });
}

async function activeChallengeCount(userId: string): Promise<number> {
  return prisma.accountVerificationChallenge.count({
    where: { consumedAt: null, platformUserId: userId, supersededAt: null },
  });
}

describe.sequential("G5-BR account registration and verification", () => {
  beforeEach(async () => {
    now = baseNow;
    vi.restoreAllMocks();
    await clearIdentityTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPool.end();
  });

  it("G5BR-ID-01: new email creates one pending account and challenge", async () => {
    const { service } = createFixture();
    await service.register({ email: "  Adulto.Nuevo@Example.Invalid " });

    const user = await findUser("adulto.nuevo@example.invalid");
    expect(user?.status).toBe("PENDING_VERIFICATION");
    expect(user?.memberships).toHaveLength(0);
    expect(await activeChallengeCount(user?.id ?? "")).toBe(1);
  });

  it("G5BR-ID-02: identity email adapter captures a verification challenge", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "delivery@example.invalid" });

    expect(adapter.deliveries).toHaveLength(1);
    expect(adapter.deliveries[0]?.challenge).toHaveLength(43);
    expect(adapter.deliveries[0]?.recipientEmail).toBe(
      "delivery@example.invalid",
    );
  });

  it("G5BR-ID-03: valid challenge activates exactly one account and issues a session", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "verified@example.invalid" });
    const result = await service.verify({
      challenge: adapter.deliveries[0]?.challenge ?? "",
    });

    const user = await findUser("verified@example.invalid");
    expect(result.activated).toBe(true);
    expect(result.userId).toBe(user?.id);
    expect(user?.status).toBe("ACTIVE");
    expect(user?.emailVerifiedAt).toEqual(now);
    expect(
      await prisma.platformSession.count({ where: { userId: user?.id ?? "" } }),
    ).toBe(1);
  });

  it("G5BR-ID-04: invalid challenge is denied with a security event", async () => {
    const { security, service } = createFixture();

    await expect(
      service.verify({ challenge: "invalid-synthetic-challenge" }),
    ).rejects.toThrow("Verification failed");
    expect(security.events[0]?.code).toBe(
      "ACCOUNT_VERIFICATION_INVALID_ATTEMPT",
    );
  });

  it("G5BR-ID-05: expired challenge is denied", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "expired@example.invalid" });
    now = new Date(baseNow.getTime() + 61_000);

    await expect(
      service.verify({ challenge: adapter.deliveries[0]?.challenge ?? "" }),
    ).rejects.toThrow("Verification failed");
  });

  it("G5BR-ID-06: consumed challenge cannot be replayed", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "replay@example.invalid" });
    const challenge = adapter.deliveries[0]?.challenge ?? "";
    await service.verify({ challenge });

    await expect(service.verify({ challenge })).rejects.toThrow(
      "Verification failed",
    );
  });

  it("G5BR-ID-07: existing email registration remains a safe idempotent operation", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "existing@example.invalid" });
    await service.verify({ challenge: adapter.deliveries[0]?.challenge ?? "" });
    const before = await prisma.platformUser.count();

    await service.register({ email: "EXISTING@example.invalid" });

    expect(await prisma.platformUser.count()).toBe(before);
    expect(
      await activeChallengeCount(
        (await findUser("existing@example.invalid"))?.id ?? "",
      ),
    ).toBe(1);
  });

  it("G5BR-ID-08: pending resend is externally safe and leaves one current challenge", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "pending@example.invalid" });
    const previous = adapter.deliveries[0]?.challenge ?? "";
    await service.register({ email: "pending@example.invalid" });
    const current = adapter.deliveries[1]?.challenge ?? "";

    expect(adapter.deliveries).toHaveLength(2);
    await expect(service.verify({ challenge: previous })).rejects.toThrow(
      "Verification failed",
    );
    await expect(service.verify({ challenge: current })).resolves.toMatchObject(
      { activated: true },
    );
  });

  it("G5BR-ID-09: registration never creates tenant membership", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "no-membership@example.invalid" });
    await service.verify({ challenge: adapter.deliveries[0]?.challenge ?? "" });

    expect(await prisma.membership.count()).toBe(0);
    expect(await prisma.tenant.count()).toBe(0);
  });

  it("G5BR-ID-10: email verification does not assert guardian relationship or Q-106", async () => {
    const { adapter, audit, service } = createFixture();
    await service.register({ email: "channel-only@example.invalid" });
    await service.verify({ challenge: adapter.deliveries[0]?.challenge ?? "" });

    expect(await prisma.familyProfile.count()).toBe(0);
    expect(
      audit.events.every(
        (event) =>
          event.purpose === "identity.account_registration" ||
          event.purpose === "identity.session",
      ),
    ).toBe(true);
  });

  it("G5BR-ID-11: raw challenge is absent from durable challenge storage", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "hash-only@example.invalid" });
    const raw = adapter.deliveries[0]?.challenge ?? "";
    const row = await prisma.accountVerificationChallenge.findFirstOrThrow();

    expect(row.verifierHash).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
    expect(JSON.stringify(row)).not.toContain(raw);
  });

  it("G5BR-ID-12: raw challenge is absent from logs and audit metadata", async () => {
    const lines: string[] = [];
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation((line: string) => {
        lines.push(line);
      });
    const { adapter, audit, service } = createFixture();
    await service.register({ email: "redaction@example.invalid" });
    const raw = adapter.deliveries[0]?.challenge ?? "";

    logSpy.mockRestore();
    expect(lines.join("\n")).not.toContain(raw);
    expect(JSON.stringify(audit.events)).not.toContain(raw);
  });

  it("G5BR-ID-13: concurrent registrations converge to one account identity", async () => {
    const fixture = createFixture();
    await Promise.all(
      Array.from({ length: 2 }, () =>
        fixture.service.register({ email: "race@example.invalid" }),
      ),
    );

    const user = await findUser("race@example.invalid");
    expect(await prisma.platformUser.count()).toBe(1);
    expect(await activeChallengeCount(user?.id ?? "")).toBe(1);
  });

  it("G5BR-ID-14: twenty concurrent verifies consume one challenge successfully", async () => {
    const { adapter, audit, service } = createFixture();
    await service.register({ email: "verify-race@example.invalid" });
    const challenge = adapter.deliveries[0]?.challenge ?? "";
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => service.verify({ challenge })),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      audit.events.filter(
        (event) => event.action === "ACCOUNT_VERIFICATION_SUCCEEDED",
      ),
    ).toHaveLength(1);
    expect(
      await prisma.accountVerificationChallenge.count({
        where: { consumedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it("G5BR-ID-15: resend supersedes the prior challenge", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "supersede@example.invalid" });
    const oldChallenge = adapter.deliveries[0]?.challenge ?? "";
    await service.register({ email: "supersede@example.invalid" });
    const oldHash = createHash("sha256").update(oldChallenge).digest("hex");
    const oldRow = await prisma.accountVerificationChallenge.findUniqueOrThrow({
      where: { verifierHash: oldHash },
    });

    expect(oldRow.supersededAt).toEqual(now);
    expect(await activeChallengeCount(oldRow.platformUserId)).toBe(1);
  });

  it("G5BR-ID-16: superseded challenge cannot activate the account", async () => {
    const { adapter, service } = createFixture();
    await service.register({ email: "old-challenge@example.invalid" });
    const oldChallenge = adapter.deliveries[0]?.challenge ?? "";
    await service.register({ email: "old-challenge@example.invalid" });

    await expect(service.verify({ challenge: oldChallenge })).rejects.toThrow(
      "Verification failed",
    );
    expect((await findUser("old-challenge@example.invalid"))?.status).toBe(
      "PENDING_VERIFICATION",
    );
  });

  it("G5BR-ID-17: normalized duplicate email cannot create a second identity", async () => {
    const { service } = createFixture();
    await service.register({ email: " Duplicate@Example.Invalid " });
    await service.register({ email: "duplicate@example.invalid" });

    expect(await prisma.platformUser.count()).toBe(1);
  });

  it("G5BR-ID-18: tenant or privilege injection is ignored by the registration boundary", async () => {
    const { service } = createFixture();
    await service.register({
      email: "injection@example.invalid",
      tenantId: randomUUID(),
      userId: randomUUID(),
      status: "ACTIVE",
    } as never);

    expect(await prisma.membership.count()).toBe(0);
    expect((await findUser("injection@example.invalid"))?.status).toBe(
      "PENDING_VERIFICATION",
    );
  });

  it("G5BR-ID-19: account creation is server-owned and does not accept a platform user id", async () => {
    const { service } = createFixture();
    await service.register({ email: "server-owned@example.invalid" });
    const user = await findUser("server-owned@example.invalid");

    expect(user?.id).not.toBe(randomUUID());
    expect(user?.status).toBe("PENDING_VERIFICATION");
    expect(user?.memberships).toHaveLength(0);
  });

  it("G5BR-ID-20: the service exposes no account existence result to the caller", async () => {
    const { service } = createFixture();
    await expect(
      service.register({ email: "new-public@example.invalid" }),
    ).resolves.toBeUndefined();
    await expect(
      service.register({ email: "new-public@example.invalid" }),
    ).resolves.toBeUndefined();
  });
});
