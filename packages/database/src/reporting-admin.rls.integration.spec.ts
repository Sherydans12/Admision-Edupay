import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "./generated/prisma/client.js";

import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const admin = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 2,
});
const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const membershipA = randomUUID();
const membershipB = randomUUID();
const roleA = randomUUID();
const roleB = randomUUID();
const auditA = randomUUID();
const auditB = randomUUID();

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    capabilities: [
      "audit.read",
      "role_assignment.read",
      "role_assignment.manage",
    ],
    contextOrigin: "synthetic_test",
    correlationId: `e5h-rls-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5H_RLS_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function platformProbe<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT
      set_config('admission.platform_operation', 'support_elevation', true),
      set_config('admission.platform_actor_id', ${userA}, true),
      set_config('admission.platform_target_tenant_id', ${tenantA}, true)`;
    return operation(transaction);
  });
}

describe.sequential("E5-H AuditEvent and RoleAssignment RLS boundary", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: { id: tenantA, name: "Synthetic E5-H RLS A" },
    });
    await prisma.tenant.create({
      data: { id: tenantB, name: "Synthetic E5-H RLS B" },
    });
    await prisma.platformUser.create({
      data: {
        emailNormalized: `e5h-rls-a-${userA}@example.invalid`,
        id: userA,
      },
    });
    await prisma.platformUser.create({
      data: {
        emailNormalized: `e5h-rls-b-${userB}@example.invalid`,
        id: userB,
      },
    });
    for (const seed of [
      {
        auditId: auditA,
        membershipId: membershipA,
        roleId: roleA,
        roleKey: "synthetic-a",
        tenantId: tenantA,
        userId: userA,
      },
      {
        auditId: auditB,
        membershipId: membershipB,
        roleId: roleB,
        roleKey: "synthetic-b",
        tenantId: tenantB,
        userId: userB,
      },
    ]) {
      const seedContext = context(seed.tenantId, seed.userId);
      await runWithTenantContext(seedContext, () =>
        withTenantTransaction(prisma, async (transaction) => {
          await transaction.membership.create({
            data: {
              id: seed.membershipId,
              startsAt: new Date(),
              tenantId: seed.tenantId,
              userId: seed.userId,
            },
          });
          await transaction.roleAssignment.create({
            data: {
              id: seed.roleId,
              membershipId: seed.membershipId,
              permissions: ["audit.read"],
              roleKey: seed.roleKey,
              scopes: ["*"],
              startsAt: new Date(),
              tenantId: seed.tenantId,
            },
          });
          await transaction.auditEvent.create({
            data: {
              action: `E5H_SYNTHETIC_${seed.tenantId === tenantA ? "A" : "B"}`,
              actorId: seed.userId,
              correlationId: `e5h-${seed.roleKey}`,
              effectiveActorId: seed.userId,
              id: seed.auditId,
              occurredAt: new Date(),
              purpose: "E5H_RLS_TEST",
              resourceId: seed.roleId,
              resourceType: "RoleAssignment",
              result: "SUCCESS",
              scope: "TENANT",
              tenantId: seed.tenantId,
            },
          });
        }),
      );
    }
  });

  afterAll(async () => {
    await admin.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
      [tenantA, tenantB],
    ]);
    await admin.query("DELETE FROM platform_users WHERE id = ANY($1::uuid[])", [
      [userA, userB],
    ]);
    await prisma.$disconnect();
    await admin.end();
  });

  it("E5H-RLS-01: AuditEvent reads are tenant isolated", async () => {
    const rows = await runWithTenantContext(context(tenantA, userA), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.auditEvent.findMany(),
      ),
    );
    expect(rows.map((row) => row.id)).toContain(auditA);
    expect(rows.map((row) => row.id)).not.toContain(auditB);
  });

  it("E5H-RLS-02: AuditEvent cross-tenant insert is denied", async () => {
    await expect(
      runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.auditEvent.create({
            data: {
              action: "E5H_CROSS_TENANT",
              actorId: userA,
              correlationId: "e5h-cross",
              effectiveActorId: userA,
              occurredAt: new Date(),
              purpose: "E5H_RLS_TEST",
              resourceType: "RoleAssignment",
              result: "DENY",
              scope: "TENANT",
              tenantId: tenantB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("E5H-RLS-03: AuditEvent is append-only for the runtime role", async () => {
    await expect(
      runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.auditEvent.updateMany({
            data: { result: "DENY" },
            where: { id: auditA },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.auditEvent.deleteMany({ where: { id: auditA } }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("E5H-RLS-04: RoleAssignment reads and mutations are tenant isolated", async () => {
    const result = await runWithTenantContext(context(tenantA, userA), () =>
      withTenantTransaction(prisma, async (transaction) => ({
        count: await transaction.roleAssignment
          .updateMany({
            data: { roleKey: "cross-tenant" },
            where: { id: roleB },
          })
          .then((value) => value.count),
        rows: await transaction.roleAssignment.findMany(),
      })),
    );
    expect(result.count).toBe(0);
    expect(result.rows.map((row) => row.id)).toContain(roleA);
    expect(result.rows.map((row) => row.id)).not.toContain(roleB);
  });

  it("E5H-RLS-05: absence of tenant context yields no reads and no writes", async () => {
    await expect(prisma.auditEvent.findMany()).resolves.toEqual([]);
    await expect(prisma.roleAssignment.findMany()).resolves.toEqual([]);
    await expect(
      prisma.roleAssignment.updateMany({
        data: { roleKey: "no-context" },
        where: { id: roleA },
      }),
    ).resolves.toMatchObject({ count: 0 });
  });

  it("E5H-RLS-06: alternating pooled transactions do not leak either table", async () => {
    await Promise.all(
      Array.from({ length: 24 }, async (_, index) => {
        const isA = index % 2 === 0;
        const tenantId = isA ? tenantA : tenantB;
        const expectedAudit = isA ? auditA : auditB;
        const expectedRole = isA ? roleA : roleB;
        const result = await runWithTenantContext(
          context(tenantId, isA ? userA : userB),
          () =>
            withTenantTransaction(prisma, async (transaction) => ({
              audits: await transaction.auditEvent.findMany(),
              roles: await transaction.roleAssignment.findMany(),
            })),
        );
        expect(result.audits.map((row) => row.id)).toContain(expectedAudit);
        expect(result.roles.map((row) => row.id)).toContain(expectedRole);
        expect(result.audits.every((row) => row.tenantId === tenantId)).toBe(
          true,
        );
        expect(result.roles.every((row) => row.tenantId === tenantId)).toBe(
          true,
        );
      }),
    );
  });

  it("E5H-RLS-07: platform support GUCs do not unlock audit or role data", async () => {
    const counts = await platformProbe(async (transaction) => ({
      audits: await transaction.auditEvent.count({
        where: { tenantId: tenantA },
      }),
      roles: await transaction.roleAssignment.count({
        where: { tenantId: tenantA },
      }),
    }));
    expect(counts).toEqual({ audits: 0, roles: 0 });
  });
});
