import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createAppPrismaClient } from "./prisma-client.js";
import {
  INITIAL_TENANT_ADMIN_PERMISSIONS,
  TenantBootstrapError,
  TenantBootstrapService,
  normalizeTenantCode,
} from "./tenant-bootstrap.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 1,
});
const createdTenantIds: string[] = [];
const createdUserIds: string[] = [];

async function createVerifiedSyntheticAdmin(email: string) {
  const user = await prisma.platformUser.create({
    data: {
      emailNormalized: email,
      emailVerifiedAt: new Date("2026-08-25T12:00:00.000Z"),
      status: "ACTIVE",
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe.sequential("tenant administrator bootstrap", () => {
  beforeAll(async () => {
    await migrationPool.query("SELECT 1");
  });

  afterEach(async () => {
    for (const tenantId of createdTenantIds.splice(0)) {
      await migrationPool.query("DELETE FROM tenants WHERE id = $1", [
        tenantId,
      ]);
    }
    for (const userId of createdUserIds.splice(0)) {
      await migrationPool.query("DELETE FROM platform_users WHERE id = $1", [
        userId,
      ]);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("BOOTSTRAP-01 creates one tenant, membership, least-privilege role and audit event idempotently", async () => {
    const email = `bootstrap-${randomUUID()}@example.invalid`;
    const admin = await createVerifiedSyntheticAdmin(email);
    const service = new TenantBootstrapService(
      prisma,
      () => new Date("2026-08-25T13:00:00.000Z"),
    );
    const input = {
      adminEmail: email,
      tenantCode: `synthetic-${randomUUID()}`,
      tenantName: "Synthetic Bootstrap School",
    };

    const first = await service.bootstrap(input);
    createdTenantIds.push(first.tenantId);
    const second = await service.bootstrap(input);

    expect(first.created).toEqual({
      auditEvent: true,
      membership: true,
      roleAssignment: true,
      tenant: true,
    });
    expect(second).toEqual({
      ...first,
      created: {
        auditEvent: false,
        membership: false,
        roleAssignment: false,
        tenant: false,
      },
    });

    const inspected = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT set_config('admission.tenant_id', ${first.tenantId}, true)
      `;
      return {
        assignments: await transaction.roleAssignment.findMany({
          where: { tenantId: first.tenantId },
        }),
        auditCount: await transaction.auditEvent.count({
          where: {
            action: "TENANT_ADMIN_BOOTSTRAPPED",
            id: first.auditEventId,
          },
        }),
        membershipCount: await transaction.membership.count({
          where: { tenantId: first.tenantId, userId: admin.id },
        }),
      };
    });
    expect(inspected.membershipCount).toBe(1);
    expect(inspected.assignments).toHaveLength(1);
    expect(inspected.assignments[0]?.roleKey).toBe(
      "institution_admin.bootstrap",
    );
    expect(inspected.assignments[0]?.permissions.sort()).toEqual(
      [...INITIAL_TENANT_ADMIN_PERMISSIONS].sort(),
    );
    expect(inspected.assignments[0]?.permissions).not.toContain(
      "application.decide",
    );
    expect(inspected.assignments[0]?.permissions).not.toContain(
      "platform.support.elevate",
    );
    expect(inspected.assignments[0]?.scopes).toEqual(["*"]);
    expect(inspected.auditCount).toBe(1);
  });

  it("BOOTSTRAP-02 rejects a missing or unverified administrator without creating a tenant", async () => {
    const tenantCode = `synthetic-${randomUUID()}`;
    const service = new TenantBootstrapService(prisma);

    await expect(
      service.bootstrap({
        adminEmail: `missing-${randomUUID()}@example.invalid`,
        tenantCode,
        tenantName: "Synthetic Missing Admin School",
      }),
    ).rejects.toMatchObject({ code: "ADMIN_ACCOUNT_NOT_FOUND" });

    const unverified = await prisma.platformUser.create({
      data: {
        emailNormalized: `unverified-${randomUUID()}@example.invalid`,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(unverified.id);
    await expect(
      service.bootstrap({
        adminEmail: unverified.emailNormalized,
        tenantCode,
        tenantName: "Synthetic Unverified Admin School",
      }),
    ).rejects.toMatchObject({ code: "ADMIN_EMAIL_NOT_VERIFIED" });

    const tenantCount = await migrationPool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM tenants WHERE name LIKE 'Synthetic % Admin School'",
    );
    expect(tenantCount.rows[0]?.count).toBe("0");
  });

  it("BOOTSTRAP-03 fails closed when a repeated tenantCode presents a different name", async () => {
    const email = `conflict-${randomUUID()}@example.invalid`;
    await createVerifiedSyntheticAdmin(email);
    const service = new TenantBootstrapService(prisma);
    const tenantCode = `synthetic-${randomUUID()}`;
    const first = await service.bootstrap({
      adminEmail: email,
      tenantCode,
      tenantName: "Synthetic Stable School",
    });
    createdTenantIds.push(first.tenantId);

    await expect(
      service.bootstrap({
        adminEmail: email,
        tenantCode,
        tenantName: "Synthetic Renamed School",
      }),
    ).rejects.toBeInstanceOf(TenantBootstrapError);
    await expect(
      service.bootstrap({
        adminEmail: email,
        tenantCode,
        tenantName: "Synthetic Renamed School",
      }),
    ).rejects.toMatchObject({ code: "BOOTSTRAP_STATE_CONFLICT" });
  });

  it("BOOTSTRAP-04 normalizes tenantCode and rejects unsafe identifiers", () => {
    expect(normalizeTenantCode("  SYNTHETIC-SCHOOL  ")).toBe(
      "synthetic-school",
    );
    expect(() => normalizeTenantCode("synthetic_school")).toThrow(
      TenantBootstrapError,
    );
    expect(() => normalizeTenantCode("a")).toThrow(TenantBootstrapError);
  });
});
