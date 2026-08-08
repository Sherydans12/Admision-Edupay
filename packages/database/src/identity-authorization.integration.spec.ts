import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { authorize } from "./authorization.js";
import { InMemoryAuditSink } from "./audit.js";
import { getRequiredEnvironment } from "./environment.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { resolveEffectiveTenantContext } from "./tenant-resolution.js";
import {
  getElevationContext,
  SupportElevationService,
} from "./support-elevation.js";
import { InMemorySecurityEventSink } from "./security-events.js";
import {
  type PlatformExecutionContext,
  runWithTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const adminPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 2,
});
const baseNow = new Date("2026-08-08T20:00:00.000Z");
let fixture: {
  tenantA: string;
  tenantB: string;
  userId: string;
  contextA: TenantExecutionContext;
};

async function clearIdentityTables(): Promise<void> {
  await adminPool.query(`TRUNCATE TABLE
    "outbox_messages", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function seedFixture(): Promise<void> {
  const user = await prisma.platformUser.create({
    data: { emailNormalized: `synthetic-auth-${randomUUID()}@example.invalid` },
  });
  const tenantA = await prisma.tenant.create({
    data: { name: "Synthetic Tenant A" },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: "Synthetic Tenant B" },
  });
  const contextA: TenantExecutionContext = {
    actorId: user.id,
    contextOrigin: "membership",
    correlationId: "synthetic-auth-fixture",
    purpose: "synthetic.fixture",
    source: "trusted_job",
    tenantId: tenantA.id,
  };
  await runWithTenantContext(contextA, () =>
    withTenantTransaction(prisma, async (transaction) => {
      const membership = await transaction.membership.create({
        data: { startsAt: baseNow, tenantId: tenantA.id, userId: user.id },
      });
      await transaction.roleAssignment.create({
        data: {
          membershipId: membership.id,
          permissions: [
            PERMISSIONS.APPLICATION_READ,
            PERMISSIONS.APPLICATION_RECOMMEND,
          ],
          roleKey: "synthetic-admission",
          scopes: ["application.read"],
          startsAt: baseNow,
          tenantId: tenantA.id,
        },
      });
    }),
  );
  fixture = {
    contextA,
    tenantA: tenantA.id,
    tenantB: tenantB.id,
    userId: user.id,
  };
}

describe.sequential("E4-C tenant resolution and authorization", () => {
  beforeEach(async () => {
    await clearIdentityTables();
    await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPool.end();
  });

  it("SES-09 denies a tenant candidate without membership", async () => {
    await expect(
      resolveEffectiveTenantContext({
        authenticatedUserId: fixture.userId,
        correlationId: "synthetic-resolution",
        prisma,
        purpose: "application.read",
        requestedTenantCandidate: fixture.tenantB,
        now: baseNow,
      }),
    ).resolves.toEqual({
      decision: "DENY",
      reasonCode: "NO_ACTIVE_MEMBERSHIP",
    });
  });

  it("SES-10 membership in tenant A does not grant tenant B", async () => {
    const resolved = await resolveEffectiveTenantContext({
      authenticatedUserId: fixture.userId,
      correlationId: "synthetic-resolution",
      prisma,
      purpose: "application.read",
      requestedTenantCandidate: fixture.tenantA,
      now: baseNow,
    });
    expect(resolved.decision).toBe("ALLOW");
    if (resolved.decision === "ALLOW") {
      expect(resolved.context.tenantId).toBe(fixture.tenantA);
      expect(resolved.context.tenantId).not.toBe(fixture.tenantB);
    }
  });

  it("SES-11 a session identity without capabilities cannot authorize", () => {
    expect(
      authorize(
        { ...fixture.contextA, capabilities: [] },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          resourceTenantId: fixture.tenantA,
        },
      ),
    ).toEqual({ decision: "DENY", code: "MISSING_PERMISSION" });
  });

  it("AUTH-01 denies without an explicit permission", () => {
    expect(
      authorize(
        { ...fixture.contextA, capabilities: [] },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          resourceTenantId: fixture.tenantA,
        },
      ),
    ).toMatchObject({ decision: "DENY" });
  });

  it("AUTH-02 allows a permission in the correct tenant", () => {
    expect(
      authorize(
        {
          ...fixture.contextA,
          capabilities: [PERMISSIONS.APPLICATION_READ],
          scopes: ["application.read"],
        },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          resourceTenantId: fixture.tenantA,
          scope: "application.read",
          purpose: fixture.contextA.purpose,
        },
      ),
    ).toEqual({ decision: "ALLOW" });
  });

  it("AUTH-03 denies a correct permission against another tenant", () => {
    expect(
      authorize(
        { ...fixture.contextA, capabilities: [PERMISSIONS.APPLICATION_READ] },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          resourceTenantId: fixture.tenantB,
        },
      ),
    ).toMatchObject({ decision: "DENY", code: "TENANT_MISMATCH" });
  });

  it("AUTH-04 denies an incorrect scope", () => {
    expect(
      authorize(
        {
          ...fixture.contextA,
          capabilities: [PERMISSIONS.APPLICATION_READ],
          scopes: ["application.read"],
        },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          resourceTenantId: fixture.tenantA,
          scope: "capacity.manage",
        },
      ),
    ).toMatchObject({ decision: "DENY", code: "MISSING_SCOPE" });
  });

  it("AUTH-05 denies sensitive data without restricted permission", () => {
    expect(
      authorize(
        { ...fixture.contextA, capabilities: [PERMISSIONS.APPLICATION_READ] },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          resourceTenantId: fixture.tenantA,
          sensitivity: "restricted",
        },
      ),
    ).toMatchObject({ decision: "DENY", code: "SENSITIVITY_NOT_ALLOWED" });
  });

  it("AUTH-06 denies an incompatible purpose", () => {
    expect(
      authorize(
        { ...fixture.contextA, capabilities: [PERMISSIONS.APPLICATION_READ] },
        {
          permission: PERMISSIONS.APPLICATION_READ,
          purpose: "support",
          resourceTenantId: fixture.tenantA,
        },
      ),
    ).toMatchObject({ decision: "DENY", code: "PURPOSE_MISMATCH" });
  });

  it("AUTH-07 and AUTH-08 deny synthetic Secretaría recommendation and decision", () => {
    const secretary = {
      ...fixture.contextA,
      capabilities: [PERMISSIONS.APPLICATION_READ],
    };
    expect(
      authorize(secretary, {
        permission: PERMISSIONS.APPLICATION_RECOMMEND,
        resourceTenantId: fixture.tenantA,
      }),
    ).toMatchObject({ decision: "DENY" });
    expect(
      authorize(secretary, {
        permission: PERMISSIONS.APPLICATION_DECIDE,
        resourceTenantId: fixture.tenantA,
      }),
    ).toMatchObject({ decision: "DENY" });
  });

  it("AUTH-09 denies recommender deciding the same synthetic resource", () => {
    expect(
      authorize(
        {
          ...fixture.contextA,
          capabilities: [PERMISSIONS.APPLICATION_DECIDE],
          effectiveActorId: "synthetic-recommender",
        },
        {
          permission: PERMISSIONS.APPLICATION_DECIDE,
          resourceTenantId: fixture.tenantA,
          separationOfDuties: { recommenderActorId: "synthetic-recommender" },
        },
      ),
    ).toMatchObject({ decision: "DENY", code: "SEPARATION_OF_DUTIES" });
  });

  it("AUTH-10 denies a global superadmin without elevation", () => {
    const platform: PlatformExecutionContext = {
      actorId: fixture.userId,
      correlationId: "synthetic-platform",
      globalCapabilities: [PERMISSIONS.APPLICATION_READ],
      globalSuperadmin: true,
      purpose: "platform.support",
      source: "authenticated_request",
    };
    expect(
      authorize(platform, {
        permission: PERMISSIONS.APPLICATION_READ,
        resourceTenantId: fixture.tenantA,
      }),
    ).toMatchObject({
      decision: "DENY",
      code: "SUPERADMIN_REQUIRES_ELEVATION",
    });
  });

  it("AUTH-11 allows an active elevation only inside its scope", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const platform: PlatformExecutionContext = {
      actorId: fixture.userId,
      correlationId: "synthetic-platform-elevation",
      globalCapabilities: [
        PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
        PERMISSIONS.RESTRICTED_READ,
      ],
      globalSuperadmin: true,
      purpose: "platform.support",
      source: "authenticated_request",
    };
    const created = await service.startSupportElevation({
      actorContext: platform,
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic authz elevation",
      scopes: ["application.read"],
      targetTenantId: fixture.tenantA,
    });
    const verified = await service.resolveActiveSupportElevation({
      actorId: fixture.userId,
      elevationId: created.id,
      now: baseNow,
      targetTenantId: fixture.tenantA,
    });
    const elevated = getElevationContext(platform, verified!);
    expect(
      authorize(
        elevated,
        {
          permission: PERMISSIONS.RESTRICTED_READ,
          resourceTenantId: fixture.tenantA,
          scope: "application.read",
          sensitivity: "restricted",
        },
        baseNow,
      ),
    ).toEqual({ decision: "ALLOW" });
    expect(
      authorize(
        elevated,
        {
          permission: PERMISSIONS.RESTRICTED_READ,
          resourceTenantId: fixture.tenantB,
          scope: "application.read",
          sensitivity: "restricted",
        },
        baseNow,
      ),
    ).toMatchObject({ decision: "DENY" });
  });

  it("AUTH-12 denies expired or closed elevations", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const platform: PlatformExecutionContext = {
      actorId: fixture.userId,
      correlationId: "synthetic-platform-expiry",
      globalCapabilities: [
        PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
        PERMISSIONS.RESTRICTED_READ,
      ],
      globalSuperadmin: true,
      purpose: "platform.support",
      source: "authenticated_request",
    };
    const created = await service.startSupportElevation({
      actorContext: platform,
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 1_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic authz expiry",
      scopes: ["application.read"],
      targetTenantId: fixture.tenantA,
    });
    const verified = await service.resolveActiveSupportElevation({
      actorId: fixture.userId,
      elevationId: created.id,
      now: baseNow,
      targetTenantId: fixture.tenantA,
    });
    const expired = getElevationContext(platform, verified!);
    expect(
      authorize(
        expired,
        {
          permission: PERMISSIONS.RESTRICTED_READ,
          resourceTenantId: fixture.tenantA,
          scope: "application.read",
          sensitivity: "restricted",
        },
        new Date(baseNow.getTime() + 2_000),
      ),
    ).toMatchObject({ decision: "DENY", code: "ELEVATION_EXPIRED" });
  });
});
