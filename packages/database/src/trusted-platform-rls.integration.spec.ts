import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "./generated/prisma/client.js";

import { InMemoryAuditSink } from "./audit.js";
import { getRequiredEnvironment } from "./environment.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { InMemorySecurityEventSink } from "./security-events.js";
import {
  getElevationContext,
  SupportElevationService,
} from "./support-elevation.js";
import { runWithTenantContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const adminPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 2,
});
const baseNow = new Date("2026-08-08T20:00:00.000Z");
let tenantA = "";
let tenantB = "";
let actorA = "";
let actorB = "";

async function clearAndSeed(): Promise<void> {
  await adminPool.query(`TRUNCATE TABLE
    "outbox_messages", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
  const [tenantARecord, tenantBRecord, actorARecord, actorBRecord] =
    await Promise.all([
      prisma.tenant.create({ data: { name: "Synthetic Trust Tenant A" } }),
      prisma.tenant.create({ data: { name: "Synthetic Trust Tenant B" } }),
      prisma.platformUser.create({
        data: {
          emailNormalized: `synthetic-trust-a-${randomUUID()}@example.invalid`,
        },
      }),
      prisma.platformUser.create({
        data: {
          emailNormalized: `synthetic-trust-b-${randomUUID()}@example.invalid`,
        },
      }),
    ]);
  tenantA = tenantARecord.id;
  tenantB = tenantBRecord.id;
  actorA = actorARecord.id;
  actorB = actorBRecord.id;
}

async function runPlatformGucTransaction<T>(
  actorId: string,
  targetTenantId: string,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT
        set_config('admission.platform_operation', 'support_elevation', true),
        set_config('admission.platform_actor_id', ${actorId}, true),
        set_config('admission.platform_target_tenant_id', ${targetTenantId}, true)
    `;
    return operation(transaction);
  });
}

function platformContext(actorId: string) {
  return {
    actorId,
    correlationId: "synthetic-trust-correlation",
    globalCapabilities: [PERMISSIONS.PLATFORM_SUPPORT_ELEVATE],
    globalSuperadmin: true,
    purpose: "platform.support",
    source: "authenticated_request" as const,
  };
}

function service(audit = new InMemoryAuditSink()) {
  return new SupportElevationService(
    prisma,
    audit,
    new InMemorySecurityEventSink(),
  );
}

describe.sequential("trusted platform support RLS boundary", () => {
  beforeEach(clearAndSeed);

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPool.end();
  });

  it("TRUST-01 denies membership reads inside platform support GUCs", async () => {
    const rows = await runPlatformGucTransaction(
      actorA,
      tenantA,
      (transaction) =>
        transaction.membership.findMany({ where: { tenantId: tenantA } }),
    );
    expect(rows).toHaveLength(0);
  });

  it("TRUST-02 denies outbox insert/update inside platform support GUCs", async () => {
    await expect(
      runPlatformGucTransaction(actorA, tenantA, (transaction) =>
        transaction.outboxMessage.create({
          data: {
            availableAt: baseNow,
            idempotencyKey: "synthetic-trust-outbox",
            payload: { synthetic: true },
            tenantId: tenantA,
            topic: "synthetic.trust.boundary",
          },
        }),
      ),
    ).rejects.toThrow(/row-level security|RLS/i);
    const updated = await runPlatformGucTransaction(
      actorA,
      tenantA,
      (transaction) =>
        transaction.outboxMessage
          .updateMany({
            data: { lastErrorCode: "synthetic-denied" },
            where: { tenantId: tenantA },
          })
          .then((result) => result.count),
    );
    expect(updated).toBe(0);
  });

  it("TRUST-03 denies role assignment reads for the target tenant", async () => {
    const rows = await runPlatformGucTransaction(
      actorA,
      tenantA,
      (transaction) =>
        transaction.roleAssignment.findMany({ where: { tenantId: tenantA } }),
    );
    expect(rows).toHaveLength(0);
  });

  it("TRUST-04 isolates elevations by platform actor", async () => {
    const created = await service().startSupportElevation({
      actorContext: platformContext(actorA),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic actor isolation",
      scopes: ["application.read"],
      targetTenantId: tenantA,
    });
    const rows = await runPlatformGucTransaction(
      actorB,
      tenantA,
      (transaction) =>
        transaction.supportElevation.findMany({ where: { id: created.id } }),
    );
    expect(rows).toHaveLength(0);
  });

  it("TRUST-05 prevents actor B from updating actor A elevation directly", async () => {
    const created = await service().startSupportElevation({
      actorContext: platformContext(actorA),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic direct update",
      scopes: ["application.read"],
      targetTenantId: tenantA,
    });
    const count = await runPlatformGucTransaction(
      actorB,
      tenantA,
      (transaction) =>
        transaction.supportElevation
          .updateMany({
            data: { closedAt: new Date(baseNow.getTime() + 1_000) },
            where: { id: created.id },
          })
          .then((result) => result.count),
    );
    expect(count).toBe(0);
  });

  it("TRUST-06 keeps legitimate start/resolve/close/revoke working", async () => {
    const support = service();
    const first = await support.startSupportElevation({
      actorContext: platformContext(actorA),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic close",
      scopes: ["application.read"],
      targetTenantId: tenantA,
    });
    await expect(
      support.resolveActiveSupportElevation({
        actorId: actorA,
        elevationId: first.id,
        now: baseNow,
        targetTenantId: tenantA,
      }),
    ).resolves.toBeDefined();
    await support.closeSupportElevation({
      actorContext: platformContext(actorA),
      elevationId: first.id,
      now: new Date(baseNow.getTime() + 1_000),
      targetTenantId: tenantA,
    });
    await expect(
      support.resolveActiveSupportElevation({
        actorId: actorA,
        elevationId: first.id,
        now: new Date(baseNow.getTime() + 2_000),
        targetTenantId: tenantA,
      }),
    ).resolves.toBeUndefined();

    const second = await support.startSupportElevation({
      actorContext: platformContext(actorA),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic revoke",
      scopes: ["application.read"],
      targetTenantId: tenantA,
    });
    await support.revokeSupportElevation({
      actorContext: platformContext(actorA),
      elevationId: second.id,
      now: new Date(baseNow.getTime() + 1_000),
      targetTenantId: tenantA,
    });
    await expect(
      support.resolveActiveSupportElevation({
        actorId: actorA,
        elevationId: second.id,
        now: new Date(baseNow.getTime() + 2_000),
        targetTenantId: tenantA,
      }),
    ).resolves.toBeUndefined();
  });

  it("TRUST-07 verified elevation produces a normal tenant context", async () => {
    const support = service();
    const created = await support.startSupportElevation({
      actorContext: platformContext(actorA),
      categories: ["restricted"],
      expiresAt: new Date(baseNow.getTime() + 60_000),
      now: baseNow,
      purpose: "platform.support",
      reason: "Synthetic tenant context",
      scopes: ["application.read"],
      targetTenantId: tenantA,
    });
    const verified = await support.resolveActiveSupportElevation({
      actorId: actorA,
      elevationId: created.id,
      now: baseNow,
      targetTenantId: tenantA,
    });
    const context = getElevationContext(platformContext(actorA), verified!);
    const rows = await runWithTenantContext(context, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.findMany({ where: { tenantId: tenantA } }),
      ),
    );
    expect(rows).toHaveLength(0);
  });

  it("TRUST-08 platform GUCs do not unlock any ordinary tenant table", async () => {
    const result = await runPlatformGucTransaction(
      actorA,
      tenantA,
      async (transaction) => ({
        memberships: await transaction.membership.count({
          where: { tenantId: tenantA },
        }),
        outbox: await transaction.outboxMessage.count({
          where: { tenantId: tenantA },
        }),
        probes: await transaction.tenantProbeRecord.count({
          where: { tenantId: tenantA },
        }),
        roles: await transaction.roleAssignment.count({
          where: { tenantId: tenantA },
        }),
      }),
    );
    expect(result).toEqual({ memberships: 0, outbox: 0, probes: 0, roles: 0 });
    expect(tenantB).not.toBe(tenantA);
  });
});
