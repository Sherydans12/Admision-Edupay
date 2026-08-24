import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { InMemoryAuditSink } from "./audit.js";
import { authorize } from "./authorization.js";
import { getRequiredEnvironment } from "./environment.js";
import { OutboxService } from "./outbox.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { InMemorySecurityEventSink } from "./security-events.js";
import {
  SupportElevationService,
  getElevationContext,
} from "./support-elevation.js";
import {
  assertTenantContext,
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
let tenantId = "";
let userId = "";

async function clearOperationalTables(): Promise<void> {
  await adminPool.query(`TRUNCATE TABLE
    "outbox_messages", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
  const tenant = await prisma.tenant.create({
    data: { name: "Synthetic Operational Tenant" },
  });
  const user = await prisma.platformUser.create({
    data: { emailNormalized: `synthetic-ops-${randomUUID()}@example.invalid` },
  });
  tenantId = tenant.id;
  userId = user.id;
}

function tenantContext(
  overrides: Partial<TenantExecutionContext> = {},
): TenantExecutionContext {
  return {
    actorId: userId,
    contextOrigin: "membership",
    correlationId: "synthetic-operational-correlation",
    purpose: "platform.support",
    source: "trusted_job",
    tenantId,
    ...overrides,
  };
}

function platformContext(
  overrides: Partial<PlatformExecutionContext> = {},
): PlatformExecutionContext {
  return {
    actorId: userId,
    correlationId: "synthetic-operational-correlation",
    globalSuperadmin: true,
    purpose: "platform.support",
    source: "authenticated_request",
    ...overrides,
  };
}

describe.sequential("E4-D operational foundation", () => {
  beforeEach(clearOperationalTables);

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPool.end();
  });

  it("OPS-01 starts and closes a scoped support elevation with audit events", async () => {
    const audit = new InMemoryAuditSink();
    const security = new InMemorySecurityEventSink();
    const service = new SupportElevationService(prisma, audit, security);
    const actorContext = platformContext({
      globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
    });
    const elevation = await service.startSupportElevation({
      actorContext,
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic support verification",
      scopes: ["synthetic.scope"],
      targetTenantId: tenantId,
    });
    await service.closeSupportElevation({
      actorContext,
      elevationId: elevation.id,
      now: new Date(baseNow.getTime() + 1_000),
      targetTenantId: tenantId,
    });

    const stored = await prisma.supportElevation.findUnique({
      where: { id: elevation.id },
    });
    expect(stored?.closedAt).not.toBeNull();
    expect(audit.events.map(({ action }) => action)).toEqual([
      "SUPPORT_ELEVATION_STARTED",
      "SUPPORT_ELEVATION_CLOSED",
    ]);
    expect(security.events).toEqual([]);
  });

  it("OPS-02 rejects unauthorized elevation without writing a row", async () => {
    const security = new InMemorySecurityEventSink();
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      security,
    );
    await expect(
      service.startSupportElevation({
        actorContext: platformContext({ globalCapabilities: [] }),
        categories: ["restricted"],
        expiresAt: new Date(baseNow.getTime() + 60_000),
        now: baseNow,
        purpose: "platform.support",
        reason: "Synthetic denied request",
        scopes: ["synthetic.scope"],
        targetTenantId: tenantId,
      }),
    ).rejects.toThrow("Support elevation denied");
    expect(security.events[0]?.code).toBe("SUPPORT_ELEVATION_DENIED");
    await expect(prisma.supportElevation.count()).resolves.toBe(0);
  });

  it("OPS-03 enqueues, claims and marks a tenant outbox message", async () => {
    const service = new OutboxService(prisma);
    const context = tenantContext({ purpose: "synthetic.job" });
    const created = await runWithTenantContext(context, () =>
      service.enqueue(
        {
          idempotencyKey: "synthetic-idempotency-1",
          payload: { synthetic: true },
          topic: "synthetic.foundation.topic",
        },
        baseNow,
      ),
    );
    expect(created.status).toBe("PENDING");

    const claimed = await runWithTenantContext(context, () =>
      service.claimNext(new Date(baseNow.getTime() + 1_000)),
    );
    expect(claimed?.status).toBe("PROCESSING");
    expect(claimed?.claimedAt).not.toBeNull();
    await runWithTenantContext(context, () =>
      service.markSent(created.id, claimed!.claimedAt!),
    );
    const stored = await runWithTenantContext(context, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.findUnique({ where: { id: created.id } }),
      ),
    );
    expect(stored).toMatchObject({ status: "SENT", attempts: 1 });
  });

  it("OPS-04 keeps elevation context separate and tenant-scoped", async () => {
    const ordinary = platformContext({
      globalCapabilities: [
        PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
        PERMISSIONS.RESTRICTED_READ,
      ],
    });
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: ordinary,
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic context verification",
      scopes: ["synthetic.scope"],
      targetTenantId: tenantId,
    });
    const verified = await service.resolveActiveSupportElevation({
      actorId: userId,
      elevationId: created.id,
      now: baseNow,
      targetTenantId: tenantId,
    });
    expect(verified).not.toBeUndefined();
    const elevated = getElevationContext(ordinary, verified!);
    expect("tenantId" in ordinary).toBe(false);
    expect(elevated.supportElevation?.id).toBe(created.id);
    expect(elevated.tenantId).toBe(tenantId);
  });

  it("PLAT-01 prevents a tenantless platform actor from tenant DB operations", async () => {
    const platform = platformContext({
      globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
    });
    expect(() => assertTenantContext(platform)).toThrow();
    const outbox = new OutboxService(prisma);
    await expect(outbox.claimNext(baseNow)).rejects.toThrow(
      "Tenant execution context is required",
    );
  });

  it("PLAT-02 denies a tenant context to a superadmin without elevation", () => {
    const platform = platformContext({
      globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
    });
    expect(
      authorize(platform, {
        permission: PERMISSIONS.RESTRICTED_READ,
        resourceTenantId: tenantId,
      }),
    ).toMatchObject({
      code: "SUPERADMIN_REQUIRES_ELEVATION",
      decision: "DENY",
    });
  });

  it("PLAT-03 membership resolution produces the only ordinary tenant context", async () => {
    const context = tenantContext({ contextOrigin: "membership" });
    expect(context.contextOrigin).toBe("membership");
    expect(() => assertTenantContext(platformContext())).toThrow();
    expect(() => assertTenantContext(context)).not.toThrow();
  });

  it("ELEV-01 creates and resolves an elevation from a tenantless platform context", async () => {
    const audit = new InMemoryAuditSink();
    const service = new SupportElevationService(
      prisma,
      audit,
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic elevation evidence",
      scopes: ["application.read"],
      targetTenantId: tenantId,
    });
    const verified = await service.resolveActiveSupportElevation({
      actorId: userId,
      elevationId: created.id,
      now: baseNow,
      targetTenantId: tenantId,
    });
    expect(verified?.tenantId).toBe(tenantId);
    expect(
      audit.events.some(
        ({ action, result }) =>
          action === "SUPPORT_ELEVATION_STARTED" && result === "SUCCESS",
      ),
    ).toBe(true);
  });

  it("ELEV-02 does not produce tenant context without an active elevation", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    await expect(
      service.resolveActiveSupportElevation({
        actorId: userId,
        elevationId: "00000000-0000-4000-8000-000000000001",
        now: baseNow,
        targetTenantId: tenantId,
      }),
    ).resolves.toBeUndefined();
  });

  it("ELEV-03 limits an elevation to tenant A", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic tenant boundary",
      scopes: ["application.read"],
      targetTenantId: tenantId,
    });
    const verified = await service.resolveActiveSupportElevation({
      actorId: userId,
      elevationId: created.id,
      now: baseNow,
      targetTenantId: tenantId,
    });
    expect(verified).toBeDefined();
    const elevated = getElevationContext(
      platformContext({ globalCapabilities: [PERMISSIONS.RESTRICTED_READ] }),
      verified!,
    );
    expect(
      authorize(
        elevated,
        {
          permission: PERMISSIONS.RESTRICTED_READ,
          resourceTenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          scope: "application.read",
          sensitivity: "restricted",
        },
        baseNow,
      ),
    ).toMatchObject({ decision: "DENY", code: "TENANT_MISMATCH" });
  });

  it("ELEV-04 closed elevations cannot be resolved", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic close",
      scopes: ["application.read"],
      targetTenantId: tenantId,
    });
    await service.closeSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      elevationId: created.id,
      now: new Date(baseNow.getTime() + 1_000),
      targetTenantId: tenantId,
    });
    await expect(
      service.resolveActiveSupportElevation({
        actorId: userId,
        elevationId: created.id,
        now: new Date(baseNow.getTime() + 2_000),
        targetTenantId: tenantId,
      }),
    ).resolves.toBeUndefined();
  });

  it("ELEV-05 revoked elevations cannot be resolved", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic revoke",
      scopes: ["application.read"],
      targetTenantId: tenantId,
    });
    await service.revokeSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      elevationId: created.id,
      now: new Date(baseNow.getTime() + 1_000),
      targetTenantId: tenantId,
    });
    await expect(
      service.resolveActiveSupportElevation({
        actorId: userId,
        elevationId: created.id,
        now: new Date(baseNow.getTime() + 2_000),
        targetTenantId: tenantId,
      }),
    ).resolves.toBeUndefined();
  });

  it("ELEV-06 rejects close/revoke by another actor", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic ownership",
      scopes: ["application.read"],
      targetTenantId: tenantId,
    });
    const other = platformContext({
      actorId: "00000000-0000-4000-8000-000000000002",
      globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
    });
    await expect(
      service.closeSupportElevation({
        actorContext: other,
        elevationId: created.id,
        now: baseNow,
        targetTenantId: tenantId,
      }),
    ).rejects.toThrow();
  });

  it("ELEV-07 does not audit success when no elevation row is updated", async () => {
    const audit = new InMemoryAuditSink();
    const service = new SupportElevationService(
      prisma,
      audit,
      new InMemorySecurityEventSink(),
    );
    await expect(
      service.closeSupportElevation({
        actorContext: platformContext({
          globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
        }),
        elevationId: "00000000-0000-4000-8000-000000000003",
        now: baseNow,
        targetTenantId: tenantId,
      }),
    ).rejects.toThrow();
    expect(audit.events.some(({ result }) => result === "SUCCESS")).toBe(false);
  });

  it("ELEV-08 denies an expired elevation", async () => {
    const service = new SupportElevationService(
      prisma,
      new InMemoryAuditSink(),
      new InMemorySecurityEventSink(),
    );
    const created = await service.startSupportElevation({
      actorContext: platformContext({
        globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      }),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 1_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic expiry",
      scopes: ["application.read"],
      targetTenantId: tenantId,
    });
    await expect(
      service.resolveActiveSupportElevation({
        actorId: userId,
        elevationId: created.id,
        now: new Date(baseNow.getTime() + 2_000),
        targetTenantId: tenantId,
      }),
    ).resolves.toBeUndefined();
  });
});
