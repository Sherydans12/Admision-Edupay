import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  PERMISSIONS,
  RecommendationService,
  runWithTenantContext,
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
const service = new RecommendationService(prisma);
const tenantId = randomUUID();
const admissionUserId = randomUUID();
const directionUserId = randomUUID();
const familyProfileId = randomUUID();
const studentId = randomUUID();
let offeringId = "";
let applicationId = "";

function context(
  actorId: string,
  capabilities: readonly string[],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5e-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5E_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

const admission = () =>
  context(admissionUserId, [
    PERMISSIONS.APPLICATION_RECOMMEND,
    PERMISSIONS.RESTRICTED_READ,
  ]);
const direction = (actorId = directionUserId) =>
  context(actorId, [
    PERMISSIONS.APPLICATION_DECIDE,
    PERMISSIONS.RESTRICTED_READ,
  ]);

async function createSubmittedApplication(): Promise<string> {
  return runWithTenantContext(admission(), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const application = await transaction.application.create({
        data: {
          academicYearId: (
            await transaction.admissionOffering.findUniqueOrThrow({
              where: { id: offeringId },
            })
          ).academicYearId,
          draftData: { acknowledgedNoGuarantee: true, currentStep: "REVIEW" },
          familyProfileId,
          offeringId,
          processId: (
            await transaction.admissionOffering.findUniqueOrThrow({
              where: { id: offeringId },
            })
          ).processId,
          status: "SUBMITTED",
          studentId,
          submittedAt: new Date(),
          tenantId,
        },
      });
      return application.id;
    }),
  );
}

describe.sequential("E5-E recommendation and direction", () => {
  beforeAll(async () => {
    await migrationPool.query(
      "INSERT INTO tenants (id, name) VALUES ($1, $2)",
      [tenantId, "E5-E tenant sintético"],
    );
    await migrationPool.query(
      "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2), ($3, $4)",
      [
        admissionUserId,
        `e5e-admission-${admissionUserId}@example.invalid`,
        directionUserId,
        `e5e-direction-${directionUserId}@example.invalid`,
      ],
    );
    await migrationPool.query(
      "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
      [familyProfileId, admissionUserId, "Familia E5-E sintética"],
    );
    await migrationPool.query(
      "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
      [studentId, familyProfileId, "Estudiante", "E5-E"],
    );
    await runWithTenantContext(admission(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        const campus = await transaction.campus.create({
          data: { code: "E5E-CAMPUS", name: "Sede E5-E sintética", tenantId },
        });
        const year = await transaction.academicYear.create({
          data: {
            code: "E5E-YEAR",
            label: "Año E5-E",
            status: "OPEN",
            tenantId,
          },
        });
        const level = await transaction.courseLevel.create({
          data: { code: "E5E-LEVEL", name: "Nivel E5-E", tenantId },
        });
        const process = await transaction.admissionProcess.create({
          data: {
            academicYearId: year.id,
            code: "E5E-PROCESS",
            name: "Proceso E5-E",
            status: "PUBLISHED",
            tenantId,
          },
        });
        const offering = await transaction.admissionOffering.create({
          data: {
            academicYearId: year.id,
            availabilityCategory: "POSTULATIONS_OPEN",
            campusId: campus.id,
            code: "E5E-OFFER",
            courseLevelId: level.id,
            processId: process.id,
            status: "PUBLISHED",
            tenantId,
            title: "Oferta E5-E sintética",
          },
        });
        offeringId = offering.id;
      }),
    );
    applicationId = await createSubmittedApplication();
  });

  it("E5EE-REC-01..08: creates a DRAFT, submits once, and preserves history", async () => {
    const draft = await runWithTenantContext(admission(), () =>
      service.createDraft(admission(), applicationId, {
        foundation: "Fundamento sintético de revisión documental.",
        option: "RECOMENDAR_ADMISION",
      }),
    );
    expect(draft.lifecycle).toBe("DRAFT");
    const updatedDraft = await runWithTenantContext(admission(), () =>
      service.updateDraft(admission(), draft.id, {
        foundation: "Fundamento sintético actualizado antes del envío.",
        option: "RECOMENDAR_ADMISION",
      }),
    );
    expect(updatedDraft.lifecycle).toBe("DRAFT");
    const submitted = await runWithTenantContext(admission(), () =>
      service.submitRecommendation(admission(), updatedDraft.id),
    );
    expect(submitted.lifecycle).toBe("SUBMITTED");
    expect(submitted.evidenceManifest).toHaveProperty("applicationSnapshotId");
    await expect(
      runWithTenantContext(admission(), () =>
        service.submitRecommendation(admission(), draft.id),
      ),
    ).resolves.toMatchObject({ id: draft.id, lifecycle: "SUBMITTED" });
    await expect(
      runWithTenantContext(admission(), () =>
        service.updateDraft(admission(), draft.id, {
          foundation: "No se debe sobrescribir.",
          option: "NO_RECOMENDAR_ADMISION",
        }),
      ),
    ).rejects.toThrow();
  });

  it("E5EE-DEC-01..08: returns to review and records final decisions without downstream rows", async () => {
    const currentRecommendationId = await awaitCurrentRecommendationId();
    const returned = await runWithTenantContext(direction(), () =>
      service.recordDirectionDecision(direction(), applicationId, {
        disposition: "DEVUELTO_A_REVISION",
        expectedRecommendationVersionId: currentRecommendationId,
        reason: "Falta una revisión sintética adicional.",
      }),
    );
    expect(returned.disposition).toBe("DEVUELTO_A_REVISION");
    const v2 = await runWithTenantContext(admission(), () =>
      service.createDraft(admission(), applicationId, {
        foundation: "Fundamento corregido y versionado.",
        option: "NO_RECOMENDAR_ADMISION",
      }),
    );
    const submittedV2 = await runWithTenantContext(admission(), () =>
      service.submitRecommendation(admission(), v2.id),
    );
    expect(submittedV2.previousVersionId).toBe(currentRecommendationId);
    await expect(
      runWithTenantContext(direction(), () =>
        service.recordDirectionDecision(direction(), applicationId, {
          disposition: "RECHAZADO",
          expectedRecommendationVersionId: returned.recommendationVersionId,
          foundation: "Decisión stale sintética.",
        }),
      ),
    ).rejects.toMatchObject({ code: "RECOMMENDATION_VERSION_CHANGED" });
    const rejected = await runWithTenantContext(direction(), () =>
      service.recordDirectionDecision(direction(), applicationId, {
        disposition: "RECHAZADO",
        expectedRecommendationVersionId: submittedV2.id,
        foundation: "Fundamento de disposición negativa sintética.",
      }),
    );
    expect(rejected.disposition).toBe("RECHAZADO");
    const rows = await runWithTenantContext(direction(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.directionDecisionVersion.count({
          where: { applicationId },
        }),
      ),
    );
    expect(rows).toBe(2);
  });

  it("E5EE-SOD-01 and PRIV-01..06: same effective actor is denied and family has no internal surface", async () => {
    const otherApplicationId = await createSubmittedApplication();
    const draft = await runWithTenantContext(admission(), () =>
      service.createDraft(admission(), otherApplicationId, {
        foundation: "Fundamento SoD sintético.",
        option: "RECOMENDAR_ADMISION",
      }),
    );
    const submitted = await runWithTenantContext(admission(), () =>
      service.submitRecommendation(admission(), draft.id),
    );
    await expect(
      runWithTenantContext(
        { ...direction(admissionUserId), effectiveActorId: admissionUserId },
        () =>
          service.recordDirectionDecision(
            direction(admissionUserId),
            otherApplicationId,
            {
              disposition: "APROBADO",
              expectedRecommendationVersionId: submitted.id,
            },
          ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const decisionRows = await runWithTenantContext(admission(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.directionDecisionVersion.count({
          where: { applicationId: otherApplicationId },
        }),
      ),
    );
    expect(decisionRows).toBe(0);
  });

  it("E5EE-CON-02: twenty decisions fence to one final disposition", async () => {
    const concurrentApplicationId = await createSubmittedApplication();
    const draft = await runWithTenantContext(admission(), () =>
      service.createDraft(admission(), concurrentApplicationId, {
        foundation: "Fundamento de concurrencia sintético.",
        option: "RECOMENDAR_ADMISION",
      }),
    );
    const submitted = await runWithTenantContext(admission(), () =>
      service.submitRecommendation(admission(), draft.id),
    );
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        runWithTenantContext(direction(), () =>
          service.recordDirectionDecision(
            direction(),
            concurrentApplicationId,
            {
              disposition: "APROBADO",
              expectedRecommendationVersionId: submitted.id,
            },
          ),
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const versions = await runWithTenantContext(direction(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.directionDecisionVersion.count({
          where: { applicationId: concurrentApplicationId },
        }),
      ),
    );
    expect(versions).toBe(1);
  });

  async function awaitCurrentRecommendationId(): Promise<string> {
    const workspace = await runWithTenantContext(direction(), () =>
      service.getDirectionWorkspace(direction(), applicationId),
    );
    return workspace.recommendation.currentSubmitted?.id ?? "";
  }

  afterAll(async () => {
    await migrationPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await prisma.$disconnect();
    await migrationPool.end();
  });
});
