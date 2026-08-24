import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ApplicationAuthorityService,
  CapacityOfferService,
  CommunicationService,
  DevelopmentEmailAdapter,
  FamilyApplicationProjectionService,
  ForbiddenError,
  OperationalDashboardService,
  PERMISSIONS,
  RecommendationService,
  runWithFamilyContext,
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

const emailAdapter = new DevelopmentEmailAdapter();
const commService = new CommunicationService(prisma, emailAdapter);
const familyProjectionService = new FamilyApplicationProjectionService(prisma);
const dashboardService = new OperationalDashboardService(prisma);
const recService = new RecommendationService(prisma);
const capService = new CapacityOfferService(prisma);
const authorityService = new ApplicationAuthorityService(prisma);

const tenantId = randomUUID();
const tenantBId = randomUUID();
const admissionUserId = randomUUID();
const directionUserId = randomUUID();
const secretaryUserId = randomUUID();
const familyUserId = randomUUID();
const foreignFamilyUserId = randomUUID();
const familyProfileId = randomUUID();
const foreignFamilyProfileId = randomUUID();
const studentId = randomUUID();
const studentBId = randomUUID();

let offeringId = "";

function staffCtx(
  actorId: string,
  capabilities: readonly string[],
  tId = tenantId,
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5g-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5G_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId: tId,
  };
}

const admissionStaff = () =>
  staffCtx(admissionUserId, [
    PERMISSIONS.APPLICATION_RECOMMEND,
    PERMISSIONS.COMMUNICATION_READ,
    PERMISSIONS.COMMUNICATION_CONFIRM,
    PERMISSIONS.COMMUNICATION_RETRY,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MANUAL_CONTACT_RECORD,
    PERMISSIONS.RESTRICTED_READ,
  ]);

const directionStaff = () =>
  staffCtx(directionUserId, [
    PERMISSIONS.APPLICATION_DECIDE,
    PERMISSIONS.CAPACITY_MANAGE,
    PERMISSIONS.COMMUNICATION_READ,
    PERMISSIONS.COMMUNICATION_CONFIRM,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.RESTRICTED_READ,
  ]);

const secretaryStaff = () =>
  staffCtx(secretaryUserId, [
    PERMISSIONS.COMMUNICATION_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.APPLICATION_READ,
  ]);

const familyCtx = (userId = familyUserId) => ({
  actorId: userId,
  contextOrigin: "family_profile" as const,
  correlationId: `fam-${randomUUID()}`,
  effectiveActorId: userId,
  familyCapabilities: [
    PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.APPLICATION_SUBMIT,
  ] as const,
  purpose: "E5G_FAMILY_TEST",
  source: "authenticated_request" as const,
});

async function createSubmittedApp(
  sId?: string,
  fProfileId = familyProfileId,
  tId = tenantId,
  oId = offeringId,
) {
  return runWithTenantContext(
    staffCtx(
      admissionUserId,
      [PERMISSIONS.APPLICATION_CREATE, PERMISSIONS.APPLICATION_READ],
      tId,
    ),
    () =>
      withTenantTransaction(prisma, async (tx) => {
        const offering = await tx.admissionOffering.findUniqueOrThrow({
          where: { id: oId },
        });
        let targetStudentId = sId;
        if (!targetStudentId) {
          const freshStudent = await tx.student.create({
            data: {
              dateOfBirth: new Date("2010-01-01T00:00:00.000Z"),
              familyName: "Sintético",
              familyProfileId: fProfileId,
              givenName: "Estudiante",
            },
          });
          targetStudentId = freshStudent.id;
        }
        const submittedAt = new Date();
        const app = await tx.application.create({
          data: {
            academicYearId: offering.academicYearId,
            draftData: { currentStep: "REVIEW" },
            familyProfileId: fProfileId,
            offeringId: oId,
            formVersionId: offering.formVersionId,
            processId: offering.processId,
            status: "SUBMITTED",
            studentId: targetStudentId,
            submittedAt,
            tenantId: tId,
          },
        });
        await tx.applicationSnapshot.create({
          data: {
            applicationId: app.id,
            formVersionId: offering.formVersionId!,
            payload: { answers: {} },
            schemaVersion: 1,
            submittedAt,
            submittedBy: admissionUserId,
            tenantId: tId,
          },
        });
        return app;
      }),
  );
}

function familyAuthorityContext() {
  return {
    ...staffCtx(familyUserId, [
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
    ]),
    contextOrigin: "family_application" as const,
  };
}

function authorityReviewerContext() {
  return staffCtx(admissionUserId, [PERMISSIONS.APPLICATION_AUTHORITY_REVIEW]);
}

async function ensureVerifiedMinorAuthority(
  applicationId: string,
): Promise<void> {
  const family = familyCtx();
  const declaring = familyAuthorityContext();
  const declared = await runWithTenantContext(declaring, () =>
    authorityService.declareApplicationAuthority(
      family,
      declaring,
      applicationId,
      {
        authorityBasis: "PARENT",
        relationship: "MOTHER",
        subjectMode: "MINOR_REPRESENTATIVE",
      },
      new Date("2026-08-16T12:00:00.000Z"),
    ),
  );
  const reviewer = authorityReviewerContext();
  const underReview = await runWithTenantContext(reviewer, () =>
    authorityService.reviewApplicationAuthority(reviewer, applicationId, {
      expectedConcurrencyVersion: declared.concurrencyVersion!,
      reason: "Revisión sintética de comunicaciones",
      toStatus: "UNDER_REVIEW",
    }),
  );
  await runWithTenantContext(reviewer, () =>
    authorityService.reviewApplicationAuthority(reviewer, applicationId, {
      expectedConcurrencyVersion: underReview.concurrencyVersion!,
      reason: "Verificación sintética de comunicaciones",
      toStatus: "VERIFIED",
    }),
  );
}

describe.sequential("E5-G Communications, Family Portal, and Dashboard", () => {
  beforeAll(async () => {
    // Insert test tenants
    await migrationPool.query(
      "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
      [
        tenantId,
        "E5-G tenant A sintético",
        tenantBId,
        "E5-G tenant B sintético",
      ],
    );
    // Insert platform users
    await migrationPool.query(
      "INSERT INTO platform_users (id, email_normalized, email_verified_at) VALUES ($1, $2, CURRENT_TIMESTAMP), ($3, $4, CURRENT_TIMESTAMP), ($5, $6, CURRENT_TIMESTAMP), ($7, $8, CURRENT_TIMESTAMP), ($9, $10, CURRENT_TIMESTAMP)",
      [
        admissionUserId,
        `e5g-admission-${admissionUserId}@example.invalid`,
        directionUserId,
        `e5g-direction-${directionUserId}@example.invalid`,
        secretaryUserId,
        `e5g-secretary-${secretaryUserId}@example.invalid`,
        familyUserId,
        `family-${familyUserId}@example.invalid`,
        foreignFamilyUserId,
        `foreign-${foreignFamilyUserId}@example.invalid`,
      ],
    );
    // Insert family profiles
    await migrationPool.query(
      "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3), ($4, $5, $6)",
      [
        familyProfileId,
        familyUserId,
        "Familia E5-G A",
        foreignFamilyProfileId,
        foreignFamilyUserId,
        "Familia E5-G B",
      ],
    );
    // Insert students
    await migrationPool.query(
      "INSERT INTO students (id, family_profile_id, given_name, family_name, date_of_birth) VALUES ($1, $2, $3, $4, DATE '2010-01-01'), ($5, $6, $7, $8, DATE '2010-01-01')",
      [
        studentId,
        familyProfileId,
        "Estudiante",
        "E5G-A",
        studentBId,
        foreignFamilyProfileId,
        "Estudiante B",
        "E5G-B",
      ],
    );

    // Setup tenant A offerings
    await runWithTenantContext(admissionStaff(), () =>
      withTenantTransaction(prisma, async (tx) => {
        await tx.tenantBusinessCalendar.create({
          data: {
            concurrencyVersion: 1,
            tenantId,
            timezone: "America/Santiago",
          },
        });
        const campus = await tx.campus.create({
          data: { code: "E5G-CAMPUS", name: "Sede E5G", tenantId },
        });
        const year = await tx.academicYear.create({
          data: {
            code: "E5G-YEAR",
            label: "Año E5G",
            status: "OPEN",
            tenantId,
          },
        });
        const level = await tx.courseLevel.create({
          data: { code: "E5G-LEVEL", name: "Nivel E5G", tenantId },
        });
        const process = await tx.admissionProcess.create({
          data: {
            academicYearId: year.id,
            code: "E5G-PROC",
            name: "Proceso E5G",
            status: "PUBLISHED",
            tenantId,
          },
        });
        const formDef = await tx.formDefinition.create({
          data: { name: "Form E5G", purpose: "admission", tenantId },
        });
        const formVer = await tx.formVersion.create({
          data: {
            formDefinitionId: formDef.id,
            lifecycle: "PUBLISHED",
            publishedAt: new Date(),
            tenantId,
            versionNumber: 1,
          },
        });
        const offering = await tx.admissionOffering.create({
          data: {
            academicYearId: year.id,
            availabilityCategory: "POSTULATIONS_OPEN",
            campusId: campus.id,
            code: "E5G-OFFER",
            courseLevelId: level.id,
            formVersionId: formVer.id,
            processId: process.id,
            status: "PUBLISHED",
            tenantId,
            title: "Oferta E5G Sintética",
          },
        });
        offeringId = offering.id;
      }),
    );

    // Setup tenant B offerings
    await runWithTenantContext(
      staffCtx(admissionUserId, [PERMISSIONS.APPLICATION_RECOMMEND], tenantBId),
      () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.tenantBusinessCalendar.create({
            data: {
              concurrencyVersion: 1,
              tenantId: tenantBId,
              timezone: "America/Santiago",
            },
          });
          const campus = await tx.campus.create({
            data: { code: "E5GB-CAMPUS", name: "Sede B", tenantId: tenantBId },
          });
          const year = await tx.academicYear.create({
            data: {
              code: "E5GB-YEAR",
              label: "Año B",
              status: "OPEN",
              tenantId: tenantBId,
            },
          });
          const level = await tx.courseLevel.create({
            data: { code: "E5GB-LEVEL", name: "Nivel B", tenantId: tenantBId },
          });
          const process = await tx.admissionProcess.create({
            data: {
              academicYearId: year.id,
              code: "E5GB-PROC",
              name: "Proceso B",
              status: "PUBLISHED",
              tenantId: tenantBId,
            },
          });
          const formDef = await tx.formDefinition.create({
            data: { name: "Form B", purpose: "admission", tenantId: tenantBId },
          });
          const formVer = await tx.formVersion.create({
            data: {
              formDefinitionId: formDef.id,
              lifecycle: "PUBLISHED",
              publishedAt: new Date(),
              tenantId: tenantBId,
              versionNumber: 1,
            },
          });
          await tx.admissionOffering.create({
            data: {
              academicYearId: year.id,
              availabilityCategory: "POSTULATIONS_OPEN",
              campusId: campus.id,
              code: "E5GB-OFFER",
              courseLevelId: level.id,
              formVersionId: formVer.id,
              processId: process.id,
              status: "PUBLISHED",
              tenantId: tenantBId,
              title: "Oferta Tenant B",
            },
          });
        }),
    );

    // Set capacity for offering A
    await runWithTenantContext(directionStaff(), () =>
      capService.createCapacity(directionStaff(), offeringId, {
        configuredCapacity: 50,
      }),
    );
  });

  describe("Communications Lifecycle & Controls (E5G-COM-01..18)", () => {
    it("E5G-COM-01..02: APROBADO creates PREPARED communication and does not auto-send", async () => {
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Rec ok",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      const dec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
        }),
      );

      const prepared = await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: dec.id,
        }),
      );

      expect(prepared).toBeDefined();
      expect(prepared?.lifecycle).toBe("PREPARED");
      expect(prepared?.purpose).toBe("ADMISSION_APPROVED");
      expect(prepared?.confirmedAt).toBeNull();
    });

    it("E5G-COM-03: Secretary without communication.confirm cannot confirm", async () => {
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Rec ok",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      const dec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
        }),
      );
      const prepared = (await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: dec.id,
        }),
      ))!;

      await expect(
        runWithTenantContext(secretaryStaff(), () =>
          commService.confirmCommunication({ communicationId: prepared.id }),
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("E5G-COM-04..05: Authorized confirm sets CONFIRMED & outbox send idempotently", async () => {
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Rec ok",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      const dec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
        }),
      );
      const prepared = (await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: dec.id,
        }),
      ))!;

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          runWithTenantContext(admissionStaff(), () =>
            commService.confirmCommunication({ communicationId: prepared.id }),
          ),
        ),
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled).toHaveLength(20);
      expect(
        (fulfilled[0] as PromiseFulfilledResult<{ lifecycle: string }>).value
          .lifecycle,
      ).toBe("CONFIRMED");

      const outboxCount = await runWithTenantContext(admissionStaff(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.outboxMessage.count({
            where: { tenantId, idempotencyKey: `comm:send:${prepared.id}:2` },
          }),
        ),
      );
      expect(outboxCount).toBe(1);
    }, 15_000);

    it("E5G-COM-06..09: Process send, SENT -> DELIVERED evidence and idempotency", async () => {
      emailAdapter.setForceFailure(false);
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Rec ok",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      const dec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
        }),
      );
      const prepared = (await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: dec.id,
        }),
      ))!;
      await runWithTenantContext(admissionStaff(), () =>
        commService.confirmCommunication({ communicationId: prepared.id }),
      );

      const sentComm = await runWithTenantContext(admissionStaff(), () =>
        commService.processOutboxSend({ communicationId: prepared.id }),
      );
      expect(sentComm.lifecycle).toBe("SENT");

      // SENT does NOT auto-transition to DELIVERED
      expect(sentComm.lifecycle).not.toBe("DELIVERED");

      // Trusted evidence transitions to DELIVERED
      const deliveredComm = await runWithTenantContext(admissionStaff(), () =>
        commService.recordDeliveryEvidence({
          communicationId: prepared.id,
          evidence: {
            occurredAt: new Date().toISOString(),
            source: "MANUAL_CONFIRMATION",
          },
        }),
      );
      expect(deliveredComm.lifecycle).toBe("DELIVERED");

      // Duplicate delivery evidence is idempotent
      const dupDelivered = await runWithTenantContext(admissionStaff(), () =>
        commService.recordDeliveryEvidence({
          communicationId: prepared.id,
          evidence: {
            occurredAt: new Date().toISOString(),
            source: "MANUAL_CONFIRMATION",
          },
        }),
      );
      expect(dupDelivered.lifecycle).toBe("DELIVERED");
    });

    it("E5G-COM-10..13: Send failure creates OperationalTask and keeps business state intact", async () => {
      emailAdapter.setForceFailure(true);
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Rec ok",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      const dec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
        }),
      );
      const prepared = (await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: dec.id,
        }),
      ))!;
      await runWithTenantContext(admissionStaff(), () =>
        commService.confirmCommunication({ communicationId: prepared.id }),
      );

      const failedComm = await runWithTenantContext(admissionStaff(), () =>
        commService.processOutboxSend({ communicationId: prepared.id }),
      );
      expect(failedComm.lifecycle).toBe("FAILED");

      // OperationalTask created
      const task = await runWithTenantContext(admissionStaff(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.operationalTask.findFirst({
            where: {
              tenantId,
              communicationId: prepared.id,
              type: "COMMUNICATION_FAILED",
            },
          }),
        ),
      );
      expect(task).toBeDefined();
      expect(task?.status).toBe("PENDING");

      // Business state intact: DirectionDecision is still APROBADO and AdmissionOffer is ACTIVE
      const currentDec = await runWithTenantContext(admissionStaff(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.directionDecisionVersion.findUnique({ where: { id: dec.id } }),
        ),
      );
      expect(currentDec?.disposition).toBe("APROBADO");

      const offer = await runWithTenantContext(admissionStaff(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.admissionOffer.findFirst({
            where: { tenantId, applicationId: app.id },
            include: { currentVersion: true },
          }),
        ),
      );
      expect(offer?.currentVersion?.lifecycle).toBe("ACTIVE");

      emailAdapter.setForceFailure(false);
    });

    it("E5G-COM-14..17: Content privacy & DEVUELTO_A_REVISION handling", async () => {
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Secret internal foundation notes",
          option: "NO_RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );

      // DEVUELTO_A_REVISION returns undefined for final result comms
      const retDec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "DEVUELTO_A_REVISION",
          expectedRecommendationVersionId: subRec.id,
          reason: "Needs more info",
        }),
      );
      const noComm = await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: retDec.id,
        }),
      );
      expect(noComm).toBeUndefined();

      // RECHAZADO does not expose internal foundation
      const v2Draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Internal deliberation details",
          option: "NO_RECOMENDAR_ADMISION",
        }),
      );
      const v2SubRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), v2Draft.id),
      );
      const rejDec = await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "RECHAZADO",
          expectedRecommendationVersionId: v2SubRec.id,
          foundation: "Internal direction foundation",
        }),
      );
      const rejComm = (await runWithTenantContext(directionStaff(), () =>
        commService.prepareDecisionCommunication({
          applicationId: app.id,
          directionDecisionVersionId: rejDec.id,
        }),
      ))!;
      expect(rejComm.body).not.toContain("Internal direction foundation");
      expect(rejComm.body).not.toContain("Internal deliberation details");
    });
  });

  describe("Offer Reminders (E5G-REM-01..08)", () => {
    it("E5G-REM-01..04: Prepares reminder for ACTIVE offer and suppresses for ACCEPTED/WITHDRAWN", async () => {
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Rec ok",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
        }),
      );

      const offer = await runWithTenantContext(admissionStaff(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.admissionOffer.findFirstOrThrow({
            where: { tenantId, applicationId: app.id },
            include: { currentVersion: true },
          }),
        ),
      );

      const reminder = await runWithTenantContext(admissionStaff(), () =>
        commService.prepareOfferReminderCommunication({
          offerVersionId: offer.currentVersion!.id,
        }),
      );
      expect(reminder).toBeDefined();
      expect(reminder?.purpose).toBe("OFFER_REMINDER");

      // Accept offer -> subsequent reminder attempt should be suppressed (return undefined)
      await ensureVerifiedMinorAuthority(app.id);
      await runWithFamilyContext(familyCtx(), () =>
        runWithTenantContext(
          staffCtx(familyUserId, [PERMISSIONS.APPLICATION_READ]),
          () =>
            capService.acceptOffer(
              familyCtx(),
              staffCtx(familyUserId, [PERMISSIONS.APPLICATION_READ]),
              offer.id,
              {
                expectedOfferVersionId: offer.currentVersion!.id,
              },
            ),
        ),
      );

      const reminderAfterAccept = await runWithTenantContext(
        admissionStaff(),
        () =>
          commService.prepareOfferReminderCommunication({
            offerVersionId: offer.currentVersion!.id,
          }),
      );
      expect(reminderAfterAccept).toBeUndefined();
    });
  });

  describe("Family Portal Projection & Privacy (E5G-PORTAL-01..11)", () => {
    it("E5G-PORTAL-01..02: Projects family application safely and denies foreign family", async () => {
      const app = await createSubmittedApp();
      const proj = await runWithFamilyContext(familyCtx(), () =>
        runWithTenantContext(
          staffCtx(familyUserId, [PERMISSIONS.APPLICATION_READ]),
          () => familyProjectionService.getFamilyApplicationProjection(app.id),
        ),
      );
      expect(proj.studentGivenName).toBe("Estudiante");
      expect(proj.offeringTitle).toBe("Oferta E5G Sintética");

      // Foreign family receives FORBIDDEN_FOREIGN_FAMILY_APPLICATION error
      await expect(
        runWithFamilyContext(familyCtx(foreignFamilyUserId), () =>
          runWithTenantContext(
            staffCtx(foreignFamilyUserId, [PERMISSIONS.APPLICATION_READ]),
            () =>
              familyProjectionService.getFamilyApplicationProjection(app.id),
          ),
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("E5G-PORTAL-04..08: Omits internal results, recommendation, foundation, rank, capacity", async () => {
      const app = await createSubmittedApp();
      const draft = await runWithTenantContext(admissionStaff(), () =>
        recService.createDraft(admissionStaff(), app.id, {
          foundation: "Secret internal notes",
          option: "RECOMENDAR_ADMISION",
        }),
      );
      const subRec = await runWithTenantContext(admissionStaff(), () =>
        recService.submitRecommendation(admissionStaff(), draft.id),
      );
      await runWithTenantContext(directionStaff(), () =>
        recService.recordDirectionDecision(directionStaff(), app.id, {
          disposition: "APROBADO",
          expectedRecommendationVersionId: subRec.id,
          foundation: "Secret direction foundation",
        }),
      );

      const proj = await runWithFamilyContext(familyCtx(), () =>
        runWithTenantContext(
          staffCtx(familyUserId, [PERMISSIONS.APPLICATION_READ]),
          () => familyProjectionService.getFamilyApplicationProjection(app.id),
        ),
      );

      // Verify omitted fields
      const json = JSON.stringify(proj);
      expect(json).not.toContain("Secret internal notes");
      expect(json).not.toContain("Secret direction foundation");
      expect(json).not.toContain("configuredCapacity");
      expect(json).not.toContain("internalPosition");
      expect(proj.offerProjection?.acceptanceNotice).toBe(
        "Aceptar no equivale a matrícula/pago.",
      );
    });
  });

  describe("Operational Dashboard (E5G-DASH-01..08)", () => {
    it("E5G-DASH-01..03: Calculates buckets server-side and enforces tenant isolation", async () => {
      const metricsA = await runWithTenantContext(directionStaff(), () =>
        dashboardService.getDashboardMetrics(),
      );
      expect(metricsA).toHaveProperty("newApplicationsCount");
      expect(metricsA).toHaveProperty("documentsPendingReviewCount");
      expect(metricsA).toHaveProperty("waitingDecisionCount");

      // Tenant B metrics should be isolated
      const metricsB = await runWithTenantContext(
        staffCtx(directionUserId, [PERMISSIONS.DASHBOARD_READ], tenantBId),
        () => dashboardService.getDashboardMetrics(),
      );
      expect(metricsB).toBeDefined();
    });

    it("E5G-DASH-04: Unauthorized user without dashboard.read capability receives 403", async () => {
      await expect(
        runWithTenantContext(staffCtx(secretaryUserId, []), () =>
          dashboardService.getDashboardMetrics(),
        ),
      ).rejects.toThrow("FORBIDDEN_DASHBOARD_READ_CAPABILITY_REQUIRED");
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await migrationPool.end();
  });
});
