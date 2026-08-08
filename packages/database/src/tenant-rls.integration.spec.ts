import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  getRequiredTenantContext,
  runWithTenantContext,
  TenantContextMissingError,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";
import {
  SYNTHETIC_TENANTS,
  syntheticAuthenticatedRequestContext,
  syntheticTrustedJobContext,
} from "./testing/synthetic-tenant-fixtures.js";

const appPrisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
  max: 2,
});

async function clearProbeRecords(): Promise<void> {
  await migrationPool.query('TRUNCATE TABLE "tenant_probe_records"');
}

async function createForCurrentTenant(label: string) {
  return withTenantTransaction(appPrisma, async (transaction) => {
    const { tenantId } = getRequiredTenantContext();

    return transaction.tenantProbeRecord.create({
      data: { label, tenantId },
    });
  });
}

async function listForCurrentTenant() {
  return withTenantTransaction(appPrisma, (transaction) =>
    transaction.tenantProbeRecord.findMany({ orderBy: { label: "asc" } }),
  );
}

describe.sequential("ADR-0003 PostgreSQL/Prisma tenant RLS PoC", () => {
  beforeAll(clearProbeRecords);

  afterAll(async () => {
    await appPrisma.$disconnect();
    await migrationPool.end();
  });

  it("POC-01 request context tenant A only sees tenant A", async () => {
    await runWithTenantContext(syntheticAuthenticatedRequestContext("A"), () =>
      createForCurrentTenant("request-a"),
    );
    await runWithTenantContext(syntheticTrustedJobContext("B"), () =>
      createForCurrentTenant("job-b-seed"),
    );

    const records = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      listForCurrentTenant,
    );

    expect(records.map(({ label }) => label)).toEqual(["request-a"]);
    expect(
      records.every(({ tenantId }) => tenantId === SYNTHETIC_TENANTS.A),
    ).toBe(true);
  });

  it("POC-02 trusted job context tenant B only sees tenant B", async () => {
    const records = await runWithTenantContext(
      syntheticTrustedJobContext("B"),
      listForCurrentTenant,
    );

    expect(records.map(({ label }) => label)).toEqual(["job-b-seed"]);
    expect(
      records.every(({ tenantId }) => tenantId === SYNTHETIC_TENANTS.B),
    ).toBe(true);
  });

  it("POC-03 absence of context denies application and database access", async () => {
    await expect(
      withTenantTransaction(appPrisma, async () => undefined),
    ).rejects.toBeInstanceOf(TenantContextMissingError);
    await expect(appPrisma.tenantProbeRecord.findMany()).resolves.toEqual([]);
    await expect(
      appPrisma.tenantProbeRecord.create({
        data: {
          label: "unauthorized-no-context",
          tenantId: SYNTHETIC_TENANTS.A,
        },
      }),
    ).rejects.toThrow();
  });

  it("POC-04 tenant A cannot read, update, or insert tenant B records", async () => {
    const tenantBRecord = await runWithTenantContext(
      syntheticTrustedJobContext("B"),
      () => createForCurrentTenant("tenant-b-private"),
    );

    await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      async () => {
        const visible = await listForCurrentTenant();
        expect(visible.some(({ id }) => id === tenantBRecord.id)).toBe(false);

        const update = await withTenantTransaction(appPrisma, (transaction) =>
          transaction.tenantProbeRecord.updateMany({
            data: { label: "cross-tenant-update" },
            where: { id: tenantBRecord.id },
          }),
        );
        expect(update.count).toBe(0);

        await expect(
          withTenantTransaction(appPrisma, (transaction) =>
            transaction.tenantProbeRecord.create({
              data: {
                id: randomUUID(),
                label: "cross-tenant-insert",
                tenantId: SYNTHETIC_TENANTS.B,
              },
            }),
          ),
        ).rejects.toThrow();
      },
    );
  });

  it("POC-05 alternating and concurrent pooled transactions never leak tenants", async () => {
    await Promise.all(
      Array.from({ length: 40 }, async (_, index) => {
        const tenant = index % 2 === 0 ? "A" : "B";
        const context =
          tenant === "A"
            ? syntheticAuthenticatedRequestContext(tenant)
            : syntheticTrustedJobContext(tenant);

        const records = await runWithTenantContext(
          context,
          listForCurrentTenant,
        );
        expect(records.length).toBeGreaterThan(0);
        expect(
          records.every(
            ({ tenantId }) => tenantId === SYNTHETIC_TENANTS[tenant],
          ),
        ).toBe(true);
      }),
    );

    await expect(appPrisma.tenantProbeRecord.findMany()).resolves.toEqual([]);
  });

  it("POC-06 Prisma operations work inside a context-setting transaction", async () => {
    const created = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, async (transaction) => {
          const record = await transaction.tenantProbeRecord.create({
            data: {
              label: "prisma-transaction",
              tenantId: SYNTHETIC_TENANTS.A,
            },
          });
          const loaded = await transaction.tenantProbeRecord.findUnique({
            where: { id: record.id },
          });

          expect(loaded).toEqual(record);
          return record;
        }),
    );

    expect(created.tenantId).toBe(SYNTHETIC_TENANTS.A);
  });

  it("POC-07 runtime and migration roles are distinct and runtime cannot bypass RLS", async () => {
    const [appRole] = await appPrisma.$queryRaw<
      Array<{ current_user: string; rolbypassrls: boolean; rolsuper: boolean }>
    >`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `;
    const migrationRole = await migrationPool.query<{
      current_user: string;
      rolbypassrls: boolean;
      rolsuper: boolean;
    }>(`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const tableSecurity = await migrationPool.query<{
      relforcerowsecurity: boolean;
      relowner: string;
      relrowsecurity: boolean;
    }>(`
      SELECT
        c.relrowsecurity,
        c.relforcerowsecurity,
        pg_get_userbyid(c.relowner) AS relowner
      FROM pg_class c
      WHERE c.oid = 'tenant_probe_records'::regclass
    `);

    expect(appRole).toEqual({
      current_user: "admission_app",
      rolbypassrls: false,
      rolsuper: false,
    });
    expect(migrationRole.rows[0]).toEqual({
      current_user: "admission_migrator",
      rolbypassrls: false,
      rolsuper: false,
    });
    expect(appRole?.current_user).not.toBe(migrationRole.rows[0]?.current_user);
    expect(tableSecurity.rows[0]).toEqual({
      relforcerowsecurity: true,
      relowner: "admission_migrator",
      relrowsecurity: true,
    });
  });

  it("POC-08 errors roll back and cannot degrade later operations to global access", async () => {
    await expect(
      runWithTenantContext(syntheticAuthenticatedRequestContext("A"), () =>
        withTenantTransaction(appPrisma, async (transaction) => {
          await transaction.tenantProbeRecord.create({
            data: {
              label: "must-roll-back",
              tenantId: SYNTHETIC_TENANTS.A,
            },
          });
          throw new Error("synthetic rollback");
        }),
      ),
    ).rejects.toThrow("synthetic rollback");

    await expect(appPrisma.tenantProbeRecord.findMany()).resolves.toEqual([]);
    const tenantARecords = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      listForCurrentTenant,
    );
    expect(tenantARecords.some(({ label }) => label === "must-roll-back")).toBe(
      false,
    );
  });
});
