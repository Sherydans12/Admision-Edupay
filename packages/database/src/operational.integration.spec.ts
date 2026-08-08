import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { InMemoryAuditSink } from "./audit.js";
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
    correlationId: "synthetic-operational-correlation",
    purpose: "platform.support",
    source: "trusted_job",
    tenantId,
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
    const actorContext = tenantContext({
      capabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
      globalSuperadmin: true,
    });
    const elevation = await service.startSupportElevation({
      actorContext,
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic support verification",
      scopes: ["synthetic.scope"],
      tenantId,
    });
    await service.closeSupportElevation(
      actorContext,
      elevation.id,
      new Date(baseNow.getTime() + 1_000),
    );

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
    const service = new SupportElevationService(prisma, undefined, security);
    await expect(
      service.startSupportElevation({
        actorContext: tenantContext(),
        categories: ["restricted"],
        expiresAt: new Date(baseNow.getTime() + 60_000),
        now: baseNow,
        purpose: "platform.support",
        reason: "Synthetic denied request",
        scopes: ["synthetic.scope"],
        tenantId,
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
    await runWithTenantContext(context, () =>
      service.markSent(created.id, new Date(baseNow.getTime() + 2_000)),
    );
    const stored = await runWithTenantContext(context, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.findUnique({ where: { id: created.id } }),
      ),
    );
    expect(stored).toMatchObject({ status: "SENT", attempts: 1 });
  });

  it("OPS-04 keeps elevation context separate and tenant-scoped", () => {
    const ordinary = tenantContext({
      capabilities: [PERMISSIONS.APPLICATION_READ],
    });
    const elevated = getElevationContext(ordinary, {
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      id: "synthetic-elevation",
      purpose: "platform.support",
      scopes: ["synthetic.scope"],
      tenantId,
    });
    expect(ordinary.supportElevation).toBeUndefined();
    expect(elevated.supportElevation?.id).toBe("synthetic-elevation");
    expect(elevated.tenantId).toBe(tenantId);
  });
});
