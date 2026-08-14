import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  getRequiredTenantContext,
  runWithTenantContext,
  TenantContextMissingError,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";

const appPrisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
  max: 4,
});

function context(tenantId: string): TenantExecutionContext {
  return {
    actorId: randomUUID(),
    capabilities: [],
    contextOrigin: "synthetic_test",
    correlationId: `e5i-rls-${randomUUID()}`,
    effectiveActorId: randomUUID(),
    purpose: "E5I_RLS_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function seed(): Promise<{
  applicationId: string;
  handoffId: string;
  tenantA: string;
  tenantB: string;
}> {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userId = randomUUID();
  const profileId = randomUUID();
  const studentId = randomUUID();
  await migrationPool.query(
    "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
    [tenantA, "E5I RLS A sintético", tenantB, "E5I RLS B sintético"],
  );
  await migrationPool.query(
    "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
    [userId, `e5i-rls-${userId}@example.invalid`],
  );
  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [profileId, userId, "Familia E5-I RLS sintética"],
  );
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [studentId, profileId, "Estudiante", "RLS"],
  );
  const tenantContext = context(tenantA);
  const row = await runWithTenantContext(tenantContext, () =>
    withTenantTransaction(appPrisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: { code: "E5I-RLS-CAMPUS", name: "Sede RLS", tenantId: tenantA },
      });
      const year = await transaction.academicYear.create({
        data: {
          code: "E5I-RLS-YEAR",
          label: "Año RLS",
          status: "OPEN",
          tenantId: tenantA,
        },
      });
      const level = await transaction.courseLevel.create({
        data: { code: "E5I-RLS-LEVEL", name: "Nivel RLS", tenantId: tenantA },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: "E5I-RLS-PROCESS",
          name: "Proceso RLS",
          status: "PUBLISHED",
          tenantId: tenantA,
        },
      });
      const form = await transaction.formDefinition.create({
        data: {
          name: "Formulario RLS",
          purpose: "admission_application",
          tenantId: tenantA,
        },
      });
      const formVersion = await transaction.formVersion.create({
        data: {
          formDefinitionId: form.id,
          lifecycle: "PUBLISHED",
          publishedAt: new Date(),
          tenantId: tenantA,
          versionNumber: 1,
        },
      });
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: campus.id,
          code: "E5I-RLS-OFFER",
          courseLevelId: level.id,
          formVersionId: formVersion.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId: tenantA,
          title: "Oferta RLS",
        },
      });
      const application = await transaction.application.create({
        data: {
          academicYearId: year.id,
          draftData: {},
          familyProfileId: profileId,
          formVersionId: formVersion.id,
          offeringId: offering.id,
          processId: process.id,
          status: "SUBMITTED",
          studentId,
          submittedAt: new Date(),
          tenantId: tenantA,
        },
      });
      const capacity = await transaction.admissionCapacity.create({
        data: {
          configuredCapacity: 1,
          offeringId: offering.id,
          tenantId: tenantA,
        },
      });
      const reservation = await transaction.seatReservation.create({
        data: {
          applicationId: application.id,
          capacityId: capacity.id,
          committedAt: new Date(),
          offeringId: offering.id,
          reservedAt: new Date(),
          state: "COMMITTED",
          tenantId: tenantA,
        },
      });
      const offer = await transaction.admissionOffer.create({
        data: {
          applicationId: application.id,
          offeringId: offering.id,
          origin: "NORMAL",
          tenantId: tenantA,
        },
      });
      const version = await transaction.admissionOfferVersion.create({
        data: {
          applicationId: application.id,
          expiresAt: new Date(Date.now() + 86_400_000),
          issuedAt: new Date(Date.now() - 60_000),
          issuedBy: userId,
          lifecycle: "ACCEPTED",
          offerId: offer.id,
          offeringId: offering.id,
          origin: "NORMAL",
          reservationId: reservation.id,
          terminalAt: new Date(),
          terminalReason: "FAMILY_ACCEPTED",
          tenantId: tenantA,
          versionNumber: 1,
        },
      });
      await transaction.admissionOffer.update({
        data: { currentVersionId: version.id },
        where: { id: offer.id },
      });
      const acceptance = await transaction.offerAcceptance.create({
        data: {
          acceptedAt: new Date(),
          actorId: userId,
          applicationId: application.id,
          offerId: offer.id,
          offerVersionId: version.id,
          offeringId: offering.id,
          reservationId: reservation.id,
          tenantId: tenantA,
        },
      });
      const handoff = await transaction.integrationHandoff.create({
        data: {
          applicationId: application.id,
          offerAcceptanceId: acceptance.id,
          requestedAt: new Date(),
          requestedByActorId: userId,
          tenantId: tenantA,
        },
      });
      return { applicationId: application.id, handoffId: handoff.id };
    }),
  );
  return { ...row, tenantA, tenantB };
}

describe.sequential("E5-I IntegrationHandoff PostgreSQL RLS", () => {
  afterAll(async () => {
    // Fixtures remain synthetic and uniquely named; immutable historical rows are not deleted.
    await appPrisma.$disconnect();
    await migrationPool.end();
  });

  it("RLS-01: same tenant reads the handoff", async () => {
    const fixture = await seed();
    const rows = await runWithTenantContext(context(fixture.tenantA), () =>
      withTenantTransaction(appPrisma, (transaction) =>
        transaction.integrationHandoff.findMany(),
      ),
    );
    expect(rows.map((row) => row.id)).toEqual([fixture.handoffId]);
  });

  it("RLS-02: tenant B cannot read or insert tenant A handoff", async () => {
    const fixture = await seed();
    const visible = await runWithTenantContext(context(fixture.tenantB), () =>
      withTenantTransaction(appPrisma, (transaction) =>
        transaction.integrationHandoff.findMany(),
      ),
    );
    expect(visible).toEqual([]);
    await expect(
      runWithTenantContext(context(fixture.tenantB), () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.integrationHandoff.create({
            data: {
              applicationId: fixture.applicationId,
              offerAcceptanceId: randomUUID(),
              requestedAt: new Date(),
              requestedByActorId: randomUUID(),
              tenantId: fixture.tenantA,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("RLS-03: no tenant context denies access", async () => {
    await expect(
      withTenantTransaction(appPrisma, async () => undefined),
    ).rejects.toBeInstanceOf(TenantContextMissingError);
    await expect(appPrisma.integrationHandoff.findMany()).resolves.toEqual([]);
  });

  it("RLS-04: pooled contexts alternate without tenant leakage", async () => {
    const fixture = await seed();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => {
        const tenantId = index % 2 === 0 ? fixture.tenantA : fixture.tenantB;
        return runWithTenantContext(context(tenantId), () =>
          withTenantTransaction(appPrisma, (transaction) =>
            transaction.integrationHandoff.findMany(),
          ),
        );
      }),
    );
    expect(results.filter((rows) => rows.length === 1)).toHaveLength(10);
    expect(results.filter((rows) => rows.length === 0)).toHaveLength(10);
    expect(getRequiredTenantContext).toBeDefined();
  });

  it("RLS-05: runtime role is not migration role and table is RLS/FORCE owned by migrator", async () => {
    const role = await appPrisma.$queryRaw<
      Array<{ current_user: string; rolbypassrls: boolean }>
    >`SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    const table = await migrationPool.query<{
      relforcerowsecurity: boolean;
      relowner: string;
      relrowsecurity: boolean;
    }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS relowner
       FROM pg_class c WHERE c.oid = 'integration_handoffs'::regclass`,
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

  it("RLS-06: runtime grants are append-only", async () => {
    const privileges = await migrationPool.query<{
      can_delete: boolean;
      can_insert: boolean;
      can_select: boolean;
      can_update: boolean;
    }>(
      `SELECT
        has_table_privilege('admission_app', 'integration_handoffs', 'SELECT') AS can_select,
        has_table_privilege('admission_app', 'integration_handoffs', 'INSERT') AS can_insert,
        has_table_privilege('admission_app', 'integration_handoffs', 'UPDATE') AS can_update,
        has_table_privilege('admission_app', 'integration_handoffs', 'DELETE') AS can_delete`,
    );
    expect(privileges.rows[0]).toEqual({
      can_delete: false,
      can_insert: true,
      can_select: true,
      can_update: false,
    });
  });
});
