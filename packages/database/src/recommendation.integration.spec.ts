import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CapacityOfferService,
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
const capacityService = new CapacityOfferService(prisma);
const tenantId = randomUUID();
const admissionUserId = randomUUID();
const directionUserId = randomUUID();
const familyProfileId = randomUUID();
const studentId = randomUUID();
const sodStudentId = randomUUID();
const concurrencyStudentId = randomUUID();
let offeringId = "";
let applicationId = "";
let publishedFormVersionId = "";
let applicationSnapshotId = "";

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
    PERMISSIONS.CAPACITY_MANAGE,
    PERMISSIONS.RESTRICTED_READ,
  ]);

async function createSubmittedApplication(
  applicationStudentId = studentId,
): Promise<{
  applicationId: string;
  formVersionId: string;
  snapshotId: string;
}> {
  return runWithTenantContext(admission(), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const offering = await transaction.admissionOffering.findUniqueOrThrow({
        where: { id: offeringId },
      });
      let formVersionId = publishedFormVersionId;
      if (formVersionId === "") {
        const formDefinition = await transaction.formDefinition.create({
          data: {
            name: "Formulario E5-E sintético",
            purpose: "admission_application",
            tenantId,
          },
        });
        const formVersion = await transaction.formVersion.create({
          data: {
            formDefinitionId: formDefinition.id,
            lifecycle: "PUBLISHED",
            publishedAt: new Date(),
            tenantId,
            versionNumber: 1,
          },
        });
        await transaction.admissionOffering.update({
          data: { formVersionId: formVersion.id },
          where: { id: offering.id },
        });
        formVersionId = formVersion.id;
      }
      const boundOffering =
        await transaction.admissionOffering.findUniqueOrThrow({
          where: { id: offeringId },
        });
      if (boundOffering.formVersionId !== formVersionId) {
        throw new Error("E5-E offering is not bound to the published form");
      }
      const submittedAt = new Date();
      const application = await transaction.application.create({
        data: {
          academicYearId: boundOffering.academicYearId,
          draftData: { acknowledgedNoGuarantee: true, currentStep: "REVIEW" },
          familyProfileId,
          offeringId,
          formVersionId,
          processId: boundOffering.processId,
          status: "SUBMITTED",
          studentId: applicationStudentId,
          submittedAt,
          tenantId,
        },
      });
      const snapshot = await transaction.applicationSnapshot.create({
        data: {
          applicationId: application.id,
          formVersionId,
          payload: {
            answers: {},
            fixture: "synthetic-e5e",
            formVersionId,
          },
          schemaVersion: 1,
          submittedAt,
          submittedBy: admissionUserId,
          tenantId,
        },
      });
      return {
        applicationId: application.id,
        formVersionId,
        snapshotId: snapshot.id,
      };
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
      "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)",
      [
        studentId,
        familyProfileId,
        "Estudiante",
        "E5-E",
        sodStudentId,
        familyProfileId,
        "Estudiante SoD",
        "E5-E",
        concurrencyStudentId,
        familyProfileId,
        "Estudiante Concurrencia",
        "E5-E",
      ],
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
        await transaction.tenantBusinessCalendar.create({
          data: {
            concurrencyVersion: 1,
            tenantId,
            timezone: "America/Santiago",
          },
        });
      }),
    );
    const submittedFixture = await createSubmittedApplication();
    applicationId = submittedFixture.applicationId;
    publishedFormVersionId = submittedFixture.formVersionId;
    applicationSnapshotId = submittedFixture.snapshotId;

    const submittedApplication = await runWithTenantContext(admission(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.application.findUniqueOrThrow({
          where: { id: applicationId },
        }),
      ),
    );
    const snapshot = await runWithTenantContext(admission(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationSnapshot.findUniqueOrThrow({
          where: { id: applicationSnapshotId },
        }),
      ),
    );
    expect(submittedApplication.status).toBe("SUBMITTED");
    expect(submittedApplication.formVersionId).toBe(publishedFormVersionId);
    expect(submittedApplication.submittedAt).not.toBeNull();
    expect(snapshot.applicationId).toBe(submittedApplication.id);
    expect(snapshot.formVersionId).toBe(submittedApplication.formVersionId);
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
    expect(submitted.evidenceManifest.applicationSnapshotId).toBe(
      applicationSnapshotId,
    );
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

  it("E5EE-DEC-01..08: returns to review and records non-capacity final decisions", async () => {
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
    const otherApplicationId = (await createSubmittedApplication(sodStudentId))
      .applicationId;
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
    await runWithTenantContext(direction(), () =>
      capacityService.createCapacity(direction(), offeringId, {
        configuredCapacity: 1,
      }),
    );
    const concurrentApplicationId = (
      await createSubmittedApplication(concurrencyStudentId)
    ).applicationId;
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
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(20);
    expect(new Set(fulfilled.map((result) => result.value.id)).size).toBe(1);
    const versions = await runWithTenantContext(direction(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.directionDecisionVersion.count({
          where: { applicationId: concurrentApplicationId },
        }),
      ),
    );
    expect(versions).toBe(1);
    const effects = await runWithTenantContext(direction(), () =>
      withTenantTransaction(prisma, async (transaction) => ({
        offers: await transaction.admissionOffer.count({
          where: { applicationId: concurrentApplicationId },
        }),
        reservations: await transaction.seatReservation.count({
          where: { applicationId: concurrentApplicationId },
        }),
      })),
    );
    expect(effects).toEqual({ offers: 1, reservations: 1 });
  });

  async function awaitCurrentRecommendationId(): Promise<string> {
    const workspace = await runWithTenantContext(direction(), () =>
      service.getDirectionWorkspace(direction(), applicationId),
    );
    return workspace.recommendation.currentSubmitted?.id ?? "";
  }

  afterAll(async () => {
    await prisma.$disconnect();
    await migrationPool.end();
  });
});
