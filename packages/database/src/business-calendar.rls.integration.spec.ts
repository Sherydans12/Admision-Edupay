import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
    capabilities: ["admission.config.read", "admission.config.manage"],
    contextOrigin: "synthetic_test",
    correlationId: `r3-rls-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "R3_RLS_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

describe.sequential(
  "G5-PC1-R3 business_calendar PostgreSQL RLS Isolation (R3-RLS-*)",
  () => {
    beforeAll(async () => {
      await prisma.tenant.create({
        data: { id: tenantA, name: "Synthetic R3 RLS Tenant A" },
      });
      await prisma.tenant.create({
        data: { id: tenantB, name: "Synthetic R3 RLS Tenant B" },
      });
      await prisma.platformUser.create({
        data: { emailNormalized: `user-a-${tenantA}@example.cl`, id: userA },
      });
      await prisma.platformUser.create({
        data: { emailNormalized: `user-b-${tenantB}@example.cl`, id: userB },
      });

      // Insert baseline calendar and excluded date for Tenant A via tenant context
      const ctxA = context(tenantA, userA);
      await runWithTenantContext(ctxA, async () => {
        await withTenantTransaction(prisma, async (tx) => {
          await tx.tenantBusinessCalendar.create({
            data: {
              concurrencyVersion: 1,
              createdAt: new Date(),
              tenantId: tenantA,
              timezone: "America/Santiago",
              updatedAt: new Date(),
            },
          });
          await tx.businessCalendarExcludedDate.create({
            data: {
              calendarDate: new Date(Date.UTC(2026, 8, 18)),
              createdAt: new Date(),
              createdBy: userA,
              reason: "Fiestas Patrias Tenant A",
              tenantId: tenantA,
            },
          });
        });
      });

      // Insert baseline calendar and excluded date for Tenant B via tenant context
      const ctxB = context(tenantB, userB);
      await runWithTenantContext(ctxB, async () => {
        await withTenantTransaction(prisma, async (tx) => {
          await tx.tenantBusinessCalendar.create({
            data: {
              concurrencyVersion: 1,
              createdAt: new Date(),
              tenantId: tenantB,
              timezone: "America/Punta_Arenas",
              updatedAt: new Date(),
            },
          });
          await tx.businessCalendarExcludedDate.create({
            data: {
              calendarDate: new Date(Date.UTC(2026, 11, 25)),
              createdAt: new Date(),
              createdBy: userB,
              reason: "Navidad Tenant B",
              tenantId: tenantB,
            },
          });
        });
      });
    });

    afterAll(async () => {
      await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.businessCalendarExcludedDate.deleteMany({
            where: { tenantId: tenantA },
          });
          await tx.tenantBusinessCalendar.deleteMany({
            where: { tenantId: tenantA },
          });
        }),
      );
      await runWithTenantContext(context(tenantB, userB), () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.businessCalendarExcludedDate.deleteMany({
            where: { tenantId: tenantB },
          });
          await tx.tenantBusinessCalendar.deleteMany({
            where: { tenantId: tenantB },
          });
        }),
      );
      await admin.query(
        "DELETE FROM platform_users WHERE id = ANY($1::uuid[])",
        [[userA, userB]],
      );
      await admin.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
        [tenantA, tenantB],
      ]);
      await prisma.$disconnect();
      await admin.end();
    });

    it("R3-RLS-01: own tenant reads own calendar and excluded dates", async () => {
      const cals = await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.tenantBusinessCalendar.findMany(),
        ),
      );
      expect(cals).toHaveLength(1);
      expect(cals[0]?.tenantId).toBe(tenantA);
      expect(cals[0]?.timezone).toBe("America/Santiago");

      const dates = await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.businessCalendarExcludedDate.findMany(),
        ),
      );
      expect(dates).toHaveLength(1);
      expect(dates[0]?.tenantId).toBe(tenantA);
      expect(dates[0]?.reason).toBe("Fiestas Patrias Tenant A");
    });

    it("R3-RLS-02: missing tenant context cannot read calendars or excluded dates", async () => {
      await expect(prisma.tenantBusinessCalendar.findMany()).resolves.toEqual(
        [],
      );
      await expect(
        prisma.businessCalendarExcludedDate.findMany(),
      ).resolves.toEqual([]);
    });

    it("R3-RLS-03: cross-tenant read is empty/denied", async () => {
      const cals = await runWithTenantContext(context(tenantB, userB), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.tenantBusinessCalendar.findMany({
            where: { tenantId: tenantA },
          }),
        ),
      );
      expect(cals).toEqual([]);

      const dates = await runWithTenantContext(context(tenantB, userB), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.businessCalendarExcludedDate.findMany({
            where: { tenantId: tenantA },
          }),
        ),
      );
      expect(dates).toEqual([]);
    });

    it("R3-RLS-04: cross-tenant insert is denied by RLS", async () => {
      await expect(
        runWithTenantContext(context(tenantA, userA), () =>
          withTenantTransaction(prisma, (tx) =>
            tx.tenantBusinessCalendar.create({
              data: {
                concurrencyVersion: 1,
                tenantId: tenantB,
                timezone: "America/Punta_Arenas",
              },
            }),
          ),
        ),
      ).rejects.toThrow();

      await expect(
        runWithTenantContext(context(tenantA, userA), () =>
          withTenantTransaction(prisma, (tx) =>
            tx.businessCalendarExcludedDate.create({
              data: {
                calendarDate: new Date(Date.UTC(2026, 5, 20)),
                createdBy: userA,
                reason: "Illegal cross-tenant insert",
                tenantId: tenantB,
              },
            }),
          ),
        ),
      ).rejects.toThrow();
    });

    it("R3-RLS-05: cross-tenant update is denied / matches 0 rows", async () => {
      const updated = await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.tenantBusinessCalendar.updateMany({
            data: { timezone: "UTC" },
            where: { tenantId: tenantB },
          }),
        ),
      );
      expect(updated.count).toBe(0);
    });

    it("R3-RLS-06: cross-tenant delete is denied / matches 0 rows", async () => {
      const deleted = await runWithTenantContext(context(tenantA, userA), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.businessCalendarExcludedDate.deleteMany({
            where: { tenantId: tenantB },
          }),
        ),
      );
      expect(deleted.count).toBe(0);
    });

    it("R3-RLS-07: pooled connection does not leak previous tenant context", async () => {
      await Promise.all(
        Array.from({ length: 24 }, async (_, index) => {
          const isA = index % 2 === 0;
          const tenantId = isA ? tenantA : tenantB;
          const expectedTz = isA ? "America/Santiago" : "America/Punta_Arenas";
          const rows = await runWithTenantContext(
            context(tenantId, isA ? userA : userB),
            () =>
              withTenantTransaction(prisma, (tx) =>
                tx.tenantBusinessCalendar.findMany(),
              ),
          );
          expect(rows).toHaveLength(1);
          expect(rows[0]?.tenantId).toBe(tenantId);
          expect(rows[0]?.timezone).toBe(expectedTz);
        }),
      );
    });

    it("R3-RLS-08: application DB role remains distinct from migration role and tables have forced RLS", async () => {
      const role = await prisma.$queryRaw<
        Array<{ current_user: string; rolbypassrls: boolean }>
      >`SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      const calTable = await admin.query<{
        relforcerowsecurity: boolean;
        relowner: string;
        relrowsecurity: boolean;
      }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS relowner
         FROM pg_class c WHERE c.oid = 'tenant_business_calendars'::regclass`,
      );
      const datesTable = await admin.query<{
        relforcerowsecurity: boolean;
        relowner: string;
        relrowsecurity: boolean;
      }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS relowner
         FROM pg_class c WHERE c.oid = 'business_calendar_excluded_dates'::regclass`,
      );
      expect(role[0]).toEqual({
        current_user: "admission_app",
        rolbypassrls: false,
      });
      expect(calTable.rows[0]).toEqual({
        relforcerowsecurity: true,
        relowner: "admission_migrator",
        relrowsecurity: true,
      });
      expect(datesTable.rows[0]).toEqual({
        relforcerowsecurity: true,
        relowner: "admission_migrator",
        relrowsecurity: true,
      });
    });
  },
);
