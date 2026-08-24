import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAppPrismaClient,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { getRequiredEnvironment } from "./environment.js";

const prisma = createAppPrismaClient();
const pool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});

const tenantA = randomUUID();
const tenantB = randomUUID();
const actorA = randomUUID();
const actorB = randomUUID();
const primaryA = randomUUID();
const backupA = randomUUID();
const primaryB = randomUUID();
const backupB = randomUUID();

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `r5-policy-rls-${tenantId}-${randomUUID()}`,
    purpose: "R5_POLICY_RLS_TEST",
    source: "authenticated_request",
    tenantId,
  };
}

async function seedTenant(
  tenantId: string,
  actorId: string,
  primaryMembershipId: string,
  backupMembershipId: string,
  suffix: string,
): Promise<void> {
  const primaryUserId = randomUUID();
  const backupUserId = randomUUID();
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    `R5 Policy RLS ${suffix}`,
  ]);
  await pool.query(
    `INSERT INTO platform_users (id, email_normalized) VALUES
      ($1, $2), ($3, $4), ($5, $6)`,
    [
      actorId,
      `r5-policy-actor-${suffix}-${actorId}@example.invalid`,
      primaryUserId,
      `r5-policy-primary-${suffix}-${primaryUserId}@example.invalid`,
      backupUserId,
      `r5-policy-backup-${suffix}-${backupUserId}@example.invalid`,
    ],
  );
  const c = context(tenantId, actorId);
  await runWithTenantContext(c, () =>
    withTenantTransaction(prisma, async (transaction) => {
      await transaction.membership.createMany({
        data: [
          {
            id: primaryMembershipId,
            startsAt: new Date(Date.now() - 60_000),
            tenantId,
            userId: primaryUserId,
          },
          {
            id: backupMembershipId,
            startsAt: new Date(Date.now() - 60_000),
            tenantId,
            userId: backupUserId,
          },
        ],
      });
      await transaction.tenantActivityPolicy.create({
        data: {
          backupMembershipId,
          createdBy: actorId,
          defaultDurationMinutes: suffix === "A" ? 30 : 60,
          kind: suffix === "A" ? "GUARDIAN_INTERVIEW" : "DIAGNOSTIC_EVALUATION",
          primaryMembershipId,
          tenantId,
          updatedBy: actorId,
        },
      });
    }),
  );
}

describe.sequential("R5 tenant activity policy RLS", () => {
  beforeAll(async () => {
    await seedTenant(tenantA, actorA, primaryA, backupA, "A");
    await seedTenant(tenantB, actorB, primaryB, backupB, "B");
  });

  it("R5-RLS-01..02: context sees only own policy and no context sees zero", async () => {
    await expect(prisma.tenantActivityPolicy.findMany()).resolves.toEqual([]);
    const visibleA = await runWithTenantContext(context(tenantA, actorA), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.tenantActivityPolicy.findMany(),
      ),
    );
    expect(visibleA).toHaveLength(1);
    expect(visibleA[0]).toMatchObject({
      defaultDurationMinutes: 30,
      kind: "GUARDIAN_INTERVIEW",
      tenantId: tenantA,
    });
  });

  it("R5-RLS-03..05: cross-tenant mutations and membership FKs fail closed", async () => {
    const c = context(tenantA, actorA);
    await expect(
      runWithTenantContext(c, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.tenantActivityPolicy.create({
            data: {
              backupMembershipId: backupB,
              createdBy: actorA,
              defaultDurationMinutes: 30,
              kind: "DIAGNOSTIC_EVALUATION",
              primaryMembershipId: primaryB,
              tenantId: tenantA,
              updatedBy: actorA,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    const mutationCounts = await runWithTenantContext(c, () =>
      withTenantTransaction(prisma, async (transaction) => ({
        deleted: (
          await transaction.tenantActivityPolicy.deleteMany({
            where: { tenantId: tenantB },
          })
        ).count,
        updated: (
          await transaction.tenantActivityPolicy.updateMany({
            data: { defaultDurationMinutes: 99 },
            where: { tenantId: tenantB },
          })
        ).count,
      })),
    );
    expect(mutationCounts).toEqual({ deleted: 0, updated: 0 });
  });

  it("R5-RLS-06: concurrent pool reuse never leaks another tenant policy", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => {
        const useA = index % 2 === 0;
        const tenantId = useA ? tenantA : tenantB;
        const actorId = useA ? actorA : actorB;
        return runWithTenantContext(context(tenantId, actorId), () =>
          withTenantTransaction(prisma, (transaction) =>
            transaction.tenantActivityPolicy.findMany({
              select: { tenantId: true },
            }),
          ),
        );
      }),
    );
    results.forEach((rows, index) => {
      expect(rows).toEqual([{ tenantId: index % 2 === 0 ? tenantA : tenantB }]);
    });
    await expect(prisma.tenantActivityPolicy.count()).resolves.toBe(0);
  });

  it("R5-RLS-07..08: FORCE RLS and least-privilege grants are sealed", async () => {
    const seal = await pool.query<{
      relforcerowsecurity: boolean;
      relrowsecurity: boolean;
    }>(
      `SELECT relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE oid = 'tenant_activity_policies'::regclass`,
    );
    expect(seal.rows[0]).toEqual({
      relforcerowsecurity: true,
      relrowsecurity: true,
    });
    const grants = await pool.query<{ privilege_type: string }>(
      `SELECT privilege_type
       FROM information_schema.role_table_grants
       WHERE grantee = 'admission_app'
         AND table_schema = 'public'
         AND table_name = 'tenant_activity_policies'
       ORDER BY privilege_type`,
    );
    expect(grants.rows.map((row) => row.privilege_type)).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
    const role = await pool.query<{ rolbypassrls: boolean; rolsuper: boolean }>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'admission_app'",
    );
    expect(role.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
      [tenantA, tenantB],
    ]);
    await pool.query(
      "DELETE FROM platform_users WHERE email_normalized LIKE 'r5-policy-%@example.invalid'",
    );
    await prisma.$disconnect();
    await pool.end();
  });
});
