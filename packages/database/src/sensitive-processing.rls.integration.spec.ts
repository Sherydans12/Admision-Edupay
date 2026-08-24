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

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    capabilities: [
      "admission.config.read",
      "admission.config.manage",
      "admission.sensitive_processing.configure",
    ],
    contextOrigin: "synthetic_test",
    correlationId: `r4-rls-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "R4_RLS_TEST",
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

describe.sequential(
  "G5-PC1-R4 sensitive_processing_policies PostgreSQL RLS",
  () => {
    beforeAll(async () => {
      await prisma.tenant.create({
        data: { id: tenantA, name: "Synthetic R4 RLS Tenant A" },
      });
      await prisma.tenant.create({
        data: { id: tenantB, name: "Synthetic R4 RLS Tenant B" },
      });
      await prisma.platformUser.create({
        data: {
          emailNormalized: `r4-rls-a-${userA}@example.invalid`,
          id: userA,
        },
      });
      await prisma.platformUser.create({
        data: {
          emailNormalized: `r4-rls-b-${userB}@example.invalid`,
          id: userB,
        },
      });

      // Seed policy row for Tenant A
      const ctxA = context(tenantA, userA);
      await runWithTenantContext(ctxA, () =>
        withTenantTransaction(prisma, async (transaction) => {
          await transaction.sensitiveProcessingPolicy.create({
            data: {
              activatedAt: new Date(),
              activatedBy: userA,
              category: "HEALTH",
              enabled: true,
              purpose: "R4 RLS Tenant A Health Policy",
              tenantId: tenantA,
            },
          });
        }),
      );

      // Seed policy row for Tenant B
      const ctxB = context(tenantB, userB);
      await runWithTenantContext(ctxB, () =>
        withTenantTransaction(prisma, async (transaction) => {
          await transaction.sensitiveProcessingPolicy.create({
            data: {
              activatedAt: new Date(),
              activatedBy: userB,
              category: "PIE_NEE_DIAGNOSTIC",
              enabled: true,
              purpose: "R4 RLS Tenant B PIE Policy",
              tenantId: tenantB,
            },
          });
        }),
      );
    });

    afterAll(async () => {
      await admin.query(
        "DELETE FROM sensitive_processing_policies WHERE tenant_id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await admin.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
        [tenantA, tenantB],
      ]);
      await admin.query(
        "DELETE FROM platform_users WHERE id = ANY($1::uuid[])",
        [[userA, userB]],
      );
      await prisma.$disconnect();
      await admin.end();
    });

    it("R4-RLS-01: own tenant reads own policy", async () => {
      const rows = await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.sensitiveProcessingPolicy.findMany(),
        ),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tenantId).toBe(tenantA);
      expect(rows[0]?.category).toBe("HEALTH");
      expect(rows[0]?.enabled).toBe(true);
    });

    it("R4-RLS-02: missing tenant context cannot read", async () => {
      await expect(
        prisma.sensitiveProcessingPolicy.findMany(),
      ).resolves.toEqual([]);
    });

    it("R4-RLS-03: cross-tenant read is empty/denied", async () => {
      const rows = await runWithTenantContext(context(tenantB, userB), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.sensitiveProcessingPolicy.findMany({
            where: { tenantId: tenantA },
          }),
        ),
      );
      expect(rows).toEqual([]);
    });

    it("R4-RLS-04: cross-tenant insert is denied by RLS", async () => {
      await expect(
        runWithTenantContext(context(tenantA, userA), () =>
          withTenantTransaction(prisma, (transaction) =>
            transaction.sensitiveProcessingPolicy.create({
              data: {
                category: "PIE_NEE_DIAGNOSTIC",
                enabled: true,
                purpose: "Illegal cross-tenant insert",
                tenantId: tenantB,
              },
            }),
          ),
        ),
      ).rejects.toThrow();
    });

    it("R4-RLS-05: cross-tenant update is denied / matches 0 rows", async () => {
      const updated = await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.sensitiveProcessingPolicy.updateMany({
            data: { enabled: false },
            where: { tenantId: tenantB },
          }),
        ),
      );
      expect(updated.count).toBe(0);
    });

    it("R4-RLS-06: pooled connection does not leak previous tenant context", async () => {
      await Promise.all(
        Array.from({ length: 24 }, async (_, index) => {
          const isA = index % 2 === 0;
          const tenantId = isA ? tenantA : tenantB;
          const expectedCategory = isA ? "HEALTH" : "PIE_NEE_DIAGNOSTIC";
          const rows = await runWithTenantContext(
            context(tenantId, isA ? userA : userB),
            () =>
              withTenantTransaction(prisma, (transaction) =>
                transaction.sensitiveProcessingPolicy.findMany(),
              ),
          );
          expect(rows).toHaveLength(1);
          expect(rows[0]?.tenantId).toBe(tenantId);
          expect(rows[0]?.category).toBe(expectedCategory);
        }),
      );
    });

    it("R4-RLS-07: application DB role remains distinct from migration role and table has forced RLS", async () => {
      const role = await prisma.$queryRaw<
        Array<{ current_user: string; rolbypassrls: boolean }>
      >`SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      const table = await admin.query<{
        relforcerowsecurity: boolean;
        relowner: string;
        relrowsecurity: boolean;
      }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS relowner
       FROM pg_class c WHERE c.oid = 'sensitive_processing_policies'::regclass`,
      );
      expect(role[0]).toEqual({
        current_user: "admission_app",
        rolbypassrls: false,
      });
      expect(table.rows[0]).toEqual({
        relforcerowsecurity: true,
        relowner: "admission_migrator",
        relrowsecurity: true,
      });
    });

    it("R4-RLS-08: global/support user has no ambient tenant policy access without valid tenant/elevation context", async () => {
      const count = await platformProbe(async (transaction) =>
        transaction.sensitiveProcessingPolicy.count({
          where: { tenantId: tenantA },
        }),
      );
      expect(count).toBe(0);
    });
  },
);
