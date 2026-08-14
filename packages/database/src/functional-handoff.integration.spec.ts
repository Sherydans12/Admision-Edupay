import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authorize,
  CapacityOfferService,
  FunctionalHandoffConflictError,
  FunctionalHandoffService,
  ForbiddenError,
  IntakeNotFoundError,
  PERMISSIONS,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});
const handoffs = new FunctionalHandoffService(prisma);
const capacityOffers = new CapacityOfferService(prisma);

interface Scenario {
  acceptanceId: string | null;
  applicationId: string;
  familyUserId: string;
  offerId: string;
  offerVersionId: string;
  offeringId: string;
  processId: string;
  tenantId: string;
}

type ScenarioOptions = {
  applicationStatus?: "SUBMITTED" | "WITHDRAWN";
  lifecycle?: "ACTIVE" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  origin?: "NORMAL" | "WAITLIST";
};

function tenantContext(
  tenantId: string,
  actorId: string,
  capabilities: readonly string[] = [PERMISSIONS.APPLICATION_HANDOFF_REQUEST],
  scopes: readonly string[] = ["*"],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5i-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5I_TEST",
    scopes,
    source: "authenticated_request",
    tenantId,
  };
}

function familyContext(actorId: string): FamilyExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `e5i-family-${randomUUID()}`,
    effectiveActorId: actorId,
    familyCapabilities: [PERMISSIONS.APPLICATION_READ],
    purpose: "E5I_FAMILY_TEST",
    source: "authenticated_request",
  };
}

async function seedScenario(options: ScenarioOptions = {}): Promise<Scenario> {
  const tenantId = randomUUID();
  const staffUserId = randomUUID();
  const familyUserId = randomUUID();
  const familyProfileId = randomUUID();
  const studentId = randomUUID();
  const now = new Date();
  const lifecycle = options.lifecycle ?? "ACCEPTED";
  const accepted = lifecycle === "ACCEPTED";
  const applicationStatus = options.applicationStatus ?? "SUBMITTED";

  await migrationPool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    `E5I synthetic tenant ${tenantId}`,
  ]);
  await migrationPool.query(
    "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2), ($3, $4)",
    [
      staffUserId,
      `e5i-staff-${staffUserId}@example.invalid`,
      familyUserId,
      `e5i-family-${familyUserId}@example.invalid`,
    ],
  );
  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [familyProfileId, familyUserId, "Familia E5-I sintética"],
  );
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [studentId, familyProfileId, "Estudiante", "E5-I"],
  );

  const context = tenantContext(tenantId, staffUserId);
  return runWithTenantContext(context, () =>
    withTenantTransaction(prisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: {
          code: `E5I-${tenantId.slice(0, 8)}`,
          name: "Sede sintética",
          tenantId,
        },
      });
      const year = await transaction.academicYear.create({
        data: {
          code: `E5I-${tenantId.slice(0, 8)}`,
          label: "Año E5-I sintético",
          status: "OPEN",
          tenantId,
        },
      });
      const level = await transaction.courseLevel.create({
        data: {
          code: `E5I-${tenantId.slice(0, 8)}`,
          name: "Nivel sintético",
          tenantId,
        },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: `E5I-${tenantId.slice(0, 8)}`,
          name: "Proceso E5-I sintético",
          status: "PUBLISHED",
          tenantId,
        },
      });
      const form = await transaction.formDefinition.create({
        data: {
          name: "Formulario E5-I sintético",
          purpose: "admission_application",
          tenantId,
        },
      });
      const formVersion = await transaction.formVersion.create({
        data: {
          formDefinitionId: form.id,
          lifecycle: "PUBLISHED",
          publishedAt: now,
          tenantId,
          versionNumber: 1,
        },
      });
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: campus.id,
          code: `E5I-${tenantId.slice(0, 8)}`,
          courseLevelId: level.id,
          formVersionId: formVersion.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId,
          title: "Oferta E5-I sintética",
        },
      });
      const application = await transaction.application.create({
        data: {
          academicYearId: year.id,
          draftData: { acknowledgedNoGuarantee: true, currentStep: "REVIEW" },
          familyProfileId,
          formVersionId: formVersion.id,
          offeringId: offering.id,
          processId: process.id,
          status: applicationStatus,
          studentId,
          submittedAt: now,
          tenantId,
        },
      });
      const capacity = await transaction.admissionCapacity.create({
        data: {
          configuredCapacity: 1,
          offeringId: offering.id,
          tenantId,
        },
      });
      const reservation = await transaction.seatReservation.create({
        data: {
          applicationId: application.id,
          capacityId: capacity.id,
          committedAt: accepted ? now : null,
          offeringId: offering.id,
          releasedAt: accepted ? null : lifecycle === "ACTIVE" ? null : now,
          releaseReason:
            accepted || lifecycle === "ACTIVE"
              ? null
              : lifecycle === "EXPIRED"
                ? "DEADLINE_EXPIRED"
                : "FAMILY_DECLINED",
          reservedAt: now,
          state: accepted
            ? "COMMITTED"
            : lifecycle === "ACTIVE"
              ? "ACTIVE"
              : "RELEASED",
          tenantId,
        },
      });
      const offer = await transaction.admissionOffer.create({
        data: {
          applicationId: application.id,
          offeringId: offering.id,
          origin: options.origin ?? "NORMAL",
          tenantId,
        },
      });
      const offerVersion = await transaction.admissionOfferVersion.create({
        data: {
          applicationId: application.id,
          expiresAt: new Date(now.getTime() + 86_400_000),
          issuedAt: new Date(now.getTime() - 60_000),
          issuedBy: staffUserId,
          lifecycle,
          offerId: offer.id,
          offeringId: offering.id,
          origin: options.origin ?? "NORMAL",
          reservationId: reservation.id,
          terminalAt: accepted || lifecycle !== "ACTIVE" ? now : null,
          terminalReason: accepted
            ? "FAMILY_ACCEPTED"
            : lifecycle === "EXPIRED"
              ? "DEADLINE_EXPIRED"
              : lifecycle === "DECLINED"
                ? "FAMILY_DECLINED"
                : null,
          tenantId,
          versionNumber: 1,
        },
      });
      await transaction.admissionOffer.update({
        data: { currentVersionId: offerVersion.id },
        where: { id: offer.id },
      });
      let acceptanceId: string | null = null;
      if (accepted) {
        const acceptance = await transaction.offerAcceptance.create({
          data: {
            acceptedAt: now,
            actorId: familyUserId,
            applicationId: application.id,
            offerId: offer.id,
            offerVersionId: offerVersion.id,
            offeringId: offering.id,
            reservationId: reservation.id,
            tenantId,
          },
        });
        acceptanceId = acceptance.id;
      }
      return {
        acceptanceId,
        applicationId: application.id,
        familyUserId,
        offerId: offer.id,
        offerVersionId: offerVersion.id,
        offeringId: offering.id,
        processId: process.id,
        tenantId,
      };
    }),
  );
}

async function countHandoffs(scenario: Scenario): Promise<number> {
  const context = tenantContext(scenario.tenantId, randomUUID());
  return runWithTenantContext(context, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.integrationHandoff.count({
        where: { applicationId: scenario.applicationId },
      }),
    ),
  );
}

async function request(scenario: Scenario, context?: TenantExecutionContext) {
  const effectiveContext =
    context ?? tenantContext(scenario.tenantId, randomUUID());
  return runWithTenantContext(effectiveContext, () =>
    handoffs.requestFunctionalHandoff(effectiveContext, scenario.applicationId),
  );
}

describe.sequential("E5-I functional handoff boundary", () => {
  beforeAll(async () => {
    await migrationPool.query("SELECT 1");
  });

  afterAll(async () => {
    // Fixtures remain synthetic and uniquely named; immutable historical rows are not deleted.
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("HND-01: favorable offer without acceptance is a business conflict and creates zero rows", async () => {
    const scenario = await seedScenario({ lifecycle: "ACTIVE" });
    await expect(request(scenario)).rejects.toBeInstanceOf(
      FunctionalHandoffConflictError,
    );
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-02: accepted current offer creates one local handoff", async () => {
    const scenario = await seedScenario();
    const result = await request(scenario);
    expect(result).toMatchObject({
      applicationId: scenario.applicationId,
      offerAcceptanceId: scenario.acceptanceId,
      status: "REQUESTED",
    });
    expect(await countHandoffs(scenario)).toBe(1);
  });

  it("HND-03: duplicate request returns the same durable handoff", async () => {
    const scenario = await seedScenario();
    const first = await request(scenario);
    const second = await request(scenario);
    expect(second.id).toBe(first.id);
    expect(await countHandoffs(scenario)).toBe(1);
  });

  it("HND-04: twenty concurrent valid requests produce exactly one row", async () => {
    const scenario = await seedScenario();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => request(scenario)),
    );
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(await countHandoffs(scenario)).toBe(1);
  });

  it("HND-05: expired unaccepted offer is denied", async () => {
    const scenario = await seedScenario({ lifecycle: "EXPIRED" });
    await expect(request(scenario)).rejects.toBeInstanceOf(
      FunctionalHandoffConflictError,
    );
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-06: declined offer is denied", async () => {
    const scenario = await seedScenario({ lifecycle: "DECLINED" });
    await expect(request(scenario)).rejects.toBeInstanceOf(
      FunctionalHandoffConflictError,
    );
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-07: withdrawn application is denied", async () => {
    const scenario = await seedScenario({
      applicationStatus: "WITHDRAWN",
      lifecycle: "ACTIVE",
    });
    await expect(request(scenario)).rejects.toBeInstanceOf(
      FunctionalHandoffConflictError,
    );
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-08: waitlist without an accepted promoted offer is denied", async () => {
    const scenario = await seedScenario({
      lifecycle: "ACTIVE",
      origin: "WAITLIST",
    });
    await expect(request(scenario)).rejects.toBeInstanceOf(
      FunctionalHandoffConflictError,
    );
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-09: promoted waitlist offer after acceptance is allowed", async () => {
    const scenario = await seedScenario({ origin: "WAITLIST" });
    expect((await request(scenario)).status).toBe("REQUESTED");
  });

  it("HND-10: tenant A cannot access or request tenant B application", async () => {
    const scenario = await seedScenario();
    const foreignTenantId = randomUUID();
    await migrationPool.query(
      "INSERT INTO tenants (id, name) VALUES ($1, $2)",
      [foreignTenantId, `E5I foreign tenant ${foreignTenantId}`],
    );
    await expect(
      request(scenario, tenantContext(foreignTenantId, randomUUID())),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-11: capability omission returns forbidden and creates zero rows", async () => {
    const scenario = await seedScenario();
    await expect(
      request(
        scenario,
        tenantContext(scenario.tenantId, randomUUID(), [
          PERMISSIONS.APPLICATION_READ,
        ]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-12: family context cannot invoke the institutional service", async () => {
    const scenario = await seedScenario();
    const family = familyContext(scenario.familyUserId);
    await expect(
      runWithFamilyContext(family, () =>
        handoffs.requestFunctionalHandoff(
          family as unknown as TenantExecutionContext,
          scenario.applicationId,
        ),
      ),
    ).rejects.toThrow();
    expect(await countHandoffs(scenario)).toBe(0);
  });

  it("HND-13: global superadmin without tenant elevation is denied", () => {
    const decision = authorize(
      {
        actorId: randomUUID(),
        correlationId: "e5i-superadmin",
        globalCapabilities: [PERMISSIONS.APPLICATION_HANDOFF_REQUEST],
        globalSuperadmin: true,
        purpose: "staff.application.handoff.request",
        source: "authenticated_request",
      },
      {
        permission: PERMISSIONS.APPLICATION_HANDOFF_REQUEST,
        purpose: "staff.application.handoff.request",
        resourceTenantId: randomUUID(),
      },
    );
    expect(decision).toEqual({
      code: "SUPERADMIN_REQUIRES_ELEVATION",
      decision: "DENY",
    });
  });

  it("HND-14: support elevation works only inside its exact resource scope", async () => {
    const scenario = await seedScenario();
    const elevation = {
      categories: ["internal"],
      expiresAt: new Date(Date.now() + 60_000),
      id: randomUUID(),
      purpose: "platform.support",
      scopes: [`offering:${scenario.offeringId}`],
      tenantId: scenario.tenantId,
    };
    const elevated = {
      ...tenantContext(
        scenario.tenantId,
        randomUUID(),
        [PERMISSIONS.APPLICATION_HANDOFF_REQUEST],
        elevation.scopes,
      ),
      contextOrigin: "support_elevation" as const,
      purpose: "platform.support",
      supportElevation: elevation,
    } as unknown as TenantExecutionContext;
    expect((await request(scenario, elevated)).status).toBe("REQUESTED");
    const outsideScope = {
      ...elevated,
      scopes: ["offering:00000000-0000-4000-8000-000000000000"],
      supportElevation: {
        ...elevation,
        scopes: ["offering:00000000-0000-4000-8000-000000000000"],
      },
    } as unknown as TenantExecutionContext;
    await expect(request(scenario, outsideScope)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("HND-15: success writes one minimized durable audit event", async () => {
    const scenario = await seedScenario();
    const result = await request(scenario);
    const context = tenantContext(scenario.tenantId, randomUUID());
    const events = await runWithTenantContext(context, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.auditEvent.findMany({
          where: {
            action: "INTEGRATION_HANDOFF_REQUESTED",
            resourceId: result.id,
          },
        }),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      resourceType: "IntegrationHandoff",
      result: "SUCCESS",
      tenantId: scenario.tenantId,
    });
  });

  it("HND-16: handoff and audit contain only minimized internal references", async () => {
    const scenario = await seedScenario();
    const result = await request(scenario);
    const context = tenantContext(scenario.tenantId, randomUUID());
    const handoff = await runWithTenantContext(context, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.integrationHandoff.findUniqueOrThrow({
          where: { id: result.id },
        }),
      ),
    );
    expect(Object.keys(handoff).sort()).toEqual(
      [
        "applicationId",
        "createdAt",
        "id",
        "offerAcceptanceId",
        "requestedAt",
        "requestedByActorId",
        "tenantId",
      ].sort(),
    );
    expect(JSON.stringify(handoff)).not.toMatch(
      /document|health|pie|nee|payment|obligation/i,
    );
  });

  it("HND-17: no enrollment, obligation, or payment mutation exists", async () => {
    const scenario = await seedScenario();
    await request(scenario);
    const tables = await migrationPool.query<{ name: string | null }>(
      "SELECT to_regclass(name) AS name FROM unnest($1::text[]) AS name",
      [["enrollments", "obligations", "payments"]],
    );
    expect(tables.rows.every((row) => row.name === null)).toBe(true);
  });

  it("HND-18: PostgreSQL transaction path returns the real happy-path DTO", async () => {
    const scenario = await seedScenario();
    const result = await request(scenario);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.requestedAt).toBeTruthy();
  });

  it("HND-19: PostgreSQL transaction path rejects without acceptance", async () => {
    const scenario = await seedScenario({ lifecycle: "ACTIVE" });
    await expect(request(scenario)).rejects.toMatchObject({
      code: "HANDOFF_NOT_ENABLED",
    });
  });

  it("HND-20: body-controlled authority is not part of the service input", async () => {
    const scenario = await seedScenario();
    const result = await request(scenario);
    expect(result.offerAcceptanceId).toBe(scenario.acceptanceId);
  });

  it("HND-21: unknown application is anti-enumerative not-found", async () => {
    const scenario = await seedScenario();
    await expect(
      request({ ...scenario, applicationId: randomUUID() }),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
  });

  it("HND-22: existing acceptance service reaches the local boundary", async () => {
    const scenario = await seedScenario({ lifecycle: "ACTIVE" });
    const applicant = tenantContext(scenario.tenantId, scenario.familyUserId, [
      PERMISSIONS.APPLICATION_READ,
    ]);
    await runWithTenantContext(applicant, () =>
      capacityOffers.acceptOffer(
        familyContext(scenario.familyUserId),
        applicant,
        scenario.offerId,
        { expectedOfferVersionId: scenario.offerVersionId },
      ),
    );
    const result = await request(scenario);
    expect(result.status).toBe("REQUESTED");
    expect(await countHandoffs(scenario)).toBe(1);
  });

  it("HND-23: runtime handoff source has no network/provider call", async () => {
    const source = await readFile(
      new URL("./functional-handoff.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /fetch\s*\(|axios|http\.request|https\.request|webhook/i,
    );
  });

  it("HND-24: deferred boundary and Q-310 remain explicitly documented", async () => {
    const source = await readFile(
      new URL(
        "../../../docs/e1/15-deferred-and-out-of-scope.md",
        import.meta.url,
      ),
      "utf8",
    );
    for (const id of [
      "Q-301",
      "Q-302",
      "Q-303",
      "Q-304",
      "Q-305",
      "Q-306",
      "Q-307",
      "Q-308",
      "Q-309",
    ]) {
      expect(source).toContain(id);
    }
    expect(source).toContain("Q-310");
  });
});
