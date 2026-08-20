import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ApplicationAuthorityService,
  assertApplicationAuthorityForCriticalAction,
  type ApplicationAuthorityDeclarationInput,
} from "./application-authority.js";
import { ForbiddenError } from "./authorization.js";
import { CapacityOfferService } from "./capacity-offer.js";
import {
  ApplicationAuthorityConflictError,
  ApplicationAuthorityValidationError,
  FunctionalHandoffConflictError,
  IntakeNotFoundError,
} from "./domain-errors.js";
import { getRequiredEnvironment } from "./environment.js";
import { FormService } from "./forms.js";
import { FunctionalHandoffService } from "./functional-handoff.js";
import { IntakeService } from "./intake.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 4,
});

const BASE_NOW = new Date("2026-08-16T12:00:00.000Z");

type AuthorityFixture = {
  adminReviewerA: TenantExecutionContext;
  adminReaderOnlyA: TenantExecutionContext;
  adminStaffB: TenantExecutionContext;
  handoffAdminA: TenantExecutionContext;
  applicantA: TenantExecutionContext;
  applicantAAdult: TenantExecutionContext;
  applicantB: TenantExecutionContext;
  familyA: FamilyExecutionContext;
  familyAAdult: FamilyExecutionContext;
  familyB: FamilyExecutionContext;
  tenantA: string;
  tenantB: string;
  userAId: string;
  userAAdultId: string;
  userBId: string;
  studentMinorAId: string;
  studentAdultAId: string;
  studentMinorBId: string;
  processAId: string;
  offeringAId: string;
  processBId: string;
  offeringBId: string;
  formVersionAId: string;
};

let fixture: AuthorityFixture;
let authorities: ApplicationAuthorityService;
let forms: FormService;
let capacityOffer: CapacityOfferService;
let handoffService: FunctionalHandoffService;
let intake: IntakeService;

function tenantContext(
  actorId: string,
  tenantId: string,
  capabilities: readonly string[],
  origin: TenantExecutionContext["contextOrigin"] = "synthetic_test",
  effectiveActorId?: string,
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: origin,
    correlationId: `synthetic-r12h-${randomUUID()}`,
    effectiveActorId: effectiveActorId ?? actorId,
    purpose: "r12h.authority.test",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

function familyContext(
  actorId: string,
  effectiveActorId?: string,
): FamilyExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `synthetic-r12h-family-${randomUUID()}`,
    effectiveActorId: effectiveActorId ?? actorId,
    familyCapabilities: [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
      PERMISSIONS.FAMILY_PROFILE_READ,
      PERMISSIONS.FAMILY_PROFILE_WRITE,
      PERMISSIONS.STUDENT_READ,
      PERMISSIONS.STUDENT_WRITE,
      "offer.accept",
      "offer.decline",
      PERMISSIONS.OFFER_READ,
    ],
    purpose: "r12h.family.authority.test",
    source: "authenticated_request",
  };
}

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "integration_handoffs", "offer_acceptances", "admission_offer_versions", "admission_offers",
    "waitlist_entries", "seat_reservations", "admission_capacity_adjustments", "admission_capacities",
    "application_authority_evidence", "application_authority_reviews", "application_authorities",
    "application_withdrawals", "direction_decision_versions", "direction_decisions",
    "admission_recommendation_versions", "admission_recommendations", "assistance_sessions",
    "document_reviews", "document_versions", "document_submissions", "document_requirement_versions", "document_requirements",
    "application_snapshots", "application_draft_answers", "applications",
    "form_fields", "form_sections", "form_versions", "form_definitions",
    "admission_offerings", "admission_processes", "course_levels", "academic_years", "campuses",
    "students", "family_profiles", "role_assignments", "memberships", "platform_users", "tenants" CASCADE`);
}

async function createPublishedForm(
  context: TenantExecutionContext,
  name: string,
): Promise<{ formDefId: string; versionId: string }> {
  return runWithTenantContext(context, async () => {
    const definition = await forms.createDefinition(context, {
      name,
      purpose: "admission_application",
    });
    const version = await forms.createDraftVersion(context, definition.id);
    const section = await forms.createSection(context, version.id, {
      description: "Datos sintéticos mínimos.",
      order: 1,
      title: "Antecedentes sintéticos",
    });
    await forms.createField(context, version.id, {
      key: "confirmed_info",
      label: "Confirmo la información",
      order: 1,
      purpose: "Confirmar datos",
      required: false,
      sectionId: section.id,
      sensitivity: "restricted",
      type: "BOOLEAN",
    });
    await forms.publishVersion(context, version.id);
    return { formDefId: definition.id, versionId: version.id };
  });
}

async function seedFixture(): Promise<AuthorityFixture> {
  await clearTables();

  const tenantA = randomUUID();
  const tenantB = randomUUID();

  const userAId = randomUUID();
  const userAAdultId = randomUUID();
  const userBId = randomUUID();
  const reviewerAId = randomUUID();
  const readerOnlyAId = randomUUID();
  const staffBId = randomUUID();
  const handoffAdminId = randomUUID();

  const profileAId = randomUUID();
  const profileAAdultId = randomUUID();
  const profileBId = randomUUID();

  const studentMinorAId = randomUUID();
  const studentAdultAId = randomUUID();
  const studentMinorBId = randomUUID();

  // Create global entities (Tenants, PlatformUsers, FamilyProfiles, Students)
  await prisma.tenant.createMany({
    data: [
      { id: tenantA, name: "Colegio San R12-A" },
      { id: tenantB, name: "Colegio San R12-B" },
    ],
  });

  await prisma.platformUser.createMany({
    data: [
      {
        emailNormalized: `family-minor-a-${userAId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: userAId,
        status: "ACTIVE",
      },
      {
        emailNormalized: `family-adult-a-${userAAdultId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: userAAdultId,
        status: "ACTIVE",
      },
      {
        emailNormalized: `family-b-${userBId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: userBId,
        status: "ACTIVE",
      },
      {
        emailNormalized: `staff-reviewer-a-${reviewerAId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: reviewerAId,
        status: "ACTIVE",
      },
      {
        emailNormalized: `staff-reader-a-${readerOnlyAId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: readerOnlyAId,
        status: "ACTIVE",
      },
      {
        emailNormalized: `staff-b-${staffBId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: staffBId,
        status: "ACTIVE",
      },
      {
        emailNormalized: `staff-handoff-a-${handoffAdminId}@example.invalid`,
        emailVerifiedAt: BASE_NOW,
        id: handoffAdminId,
        status: "ACTIVE",
      },
    ],
  });

  await prisma.familyProfile.createMany({
    data: [
      { displayName: "Familia Minor A", id: profileAId, userId: userAId },
      {
        displayName: "Estudiante Adulto A",
        id: profileAAdultId,
        userId: userAAdultId,
      },
      { displayName: "Familia B", id: profileBId, userId: userBId },
    ],
  });

  await prisma.student.createMany({
    data: [
      {
        dateOfBirth: new Date("2012-05-10T00:00:00.000Z"),
        familyProfileId: profileAId,
        familyName: "Menor A",
        givenName: "Estudiante",
        id: studentMinorAId,
      },
      {
        dateOfBirth: new Date("2005-03-15T00:00:00.000Z"),
        familyProfileId: profileAAdultId,
        familyName: "Adulto A",
        givenName: "Estudiante",
        id: studentAdultAId,
      },
      {
        dateOfBirth: new Date("2012-05-10T00:00:00.000Z"),
        familyProfileId: profileBId,
        familyName: "Menor B",
        givenName: "Estudiante",
        id: studentMinorBId,
      },
    ],
  });

  const reviewerPerms = [
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.ADMISSION_CONFIG_READ,
    PERMISSIONS.FORM_MANAGE,
    PERMISSIONS.FORM_PUBLISH,
    PERMISSIONS.FORM_READ,
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
    PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_REVIEW,
    PERMISSIONS.CAPACITY_MANAGE,
    PERMISSIONS.CAPACITY_READ,
    PERMISSIONS.OFFER_READ,
    PERMISSIONS.APPLICATION_HANDOFF_REQUEST,
  ];
  const readerPerms = [
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.ADMISSION_CONFIG_READ,
  ];
  const handoffPerms = [
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
    PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.APPLICATION_HANDOFF_REQUEST,
  ];

  const adminReviewerA = tenantContext(
    reviewerAId,
    tenantA,
    reviewerPerms,
    "synthetic_test",
  );
  const adminReaderOnlyA = tenantContext(
    readerOnlyAId,
    tenantA,
    readerPerms,
    "synthetic_test",
  );
  const adminStaffB = tenantContext(
    staffBId,
    tenantB,
    reviewerPerms,
    "synthetic_test",
  );
  const handoffAdminA = tenantContext(
    handoffAdminId,
    tenantA,
    handoffPerms,
    "synthetic_test",
  );

  const applicantA = tenantContext(
    userAId,
    tenantA,
    [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
      PERMISSIONS.OFFER_READ,
    ],
    "family_application",
  );
  const applicantAAdult = tenantContext(
    userAAdultId,
    tenantA,
    [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
      PERMISSIONS.OFFER_READ,
    ],
    "family_application",
  );
  const applicantB = tenantContext(
    userBId,
    tenantB,
    [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
    ],
    "family_application",
  );

  // Setup Tenant A Catalog via IntakeService + FormService
  const formA = await createPublishedForm(adminReviewerA, "Formulario A");
  const yearA = await runWithTenantContext(adminReviewerA, () =>
    intake.createAcademicYear(adminReviewerA, {
      code: "AY-2027-A",
      label: "2027",
      status: "OPEN",
    }),
  );
  const campusA = await runWithTenantContext(adminReviewerA, () =>
    intake.createCampus(adminReviewerA, {
      code: "CMP-A",
      name: "Sede Central A",
    }),
  );
  const levelA = await runWithTenantContext(adminReviewerA, () =>
    intake.createCourseLevel(adminReviewerA, {
      code: "LVL-1-A",
      name: "1 Básico",
    }),
  );
  const processA = await runWithTenantContext(adminReviewerA, () =>
    intake.createAdmissionProcess(adminReviewerA, {
      academicYearId: yearA.id,
      closesAt: new Date("2026-12-31T23:59:59.000Z"),
      code: "PROC-2027-A",
      name: "Admisión 2027 A",
      opensAt: new Date("2026-08-01T00:00:00.000Z"),
      status: "PUBLISHED",
    }),
  );
  const offeringA = await runWithTenantContext(adminReviewerA, () =>
    intake.createOffering(adminReviewerA, {
      academicYearId: yearA.id,
      availabilityCategory: "POSTULATIONS_OPEN",
      campusId: campusA.id,
      code: "OFF-2027-1B-A",
      courseLevelId: levelA.id,
      processId: processA.id,
      status: "PUBLISHED",
      title: "Oferta A 1 Básico",
    }),
  );
  await runWithTenantContext(adminReviewerA, () =>
    forms.assignOfferingVersion(adminReviewerA, offeringA.id, formA.versionId),
  );

  // Setup Tenant B Catalog via IntakeService + FormService
  const formB = await createPublishedForm(adminStaffB, "Formulario B");
  const yearB = await runWithTenantContext(adminStaffB, () =>
    intake.createAcademicYear(adminStaffB, {
      code: "AY-2027-B",
      label: "2027",
      status: "OPEN",
    }),
  );
  const campusB = await runWithTenantContext(adminStaffB, () =>
    intake.createCampus(adminStaffB, {
      code: "CMP-B",
      name: "Sede Central B",
    }),
  );
  const levelB = await runWithTenantContext(adminStaffB, () =>
    intake.createCourseLevel(adminStaffB, {
      code: "LVL-1-B",
      name: "1 Básico",
    }),
  );
  const processB = await runWithTenantContext(adminStaffB, () =>
    intake.createAdmissionProcess(adminStaffB, {
      academicYearId: yearB.id,
      closesAt: new Date("2026-12-31T23:59:59.000Z"),
      code: "PROC-2027-B",
      name: "Admisión 2027 B",
      opensAt: new Date("2026-08-01T00:00:00.000Z"),
      status: "PUBLISHED",
    }),
  );
  const offeringB = await runWithTenantContext(adminStaffB, () =>
    intake.createOffering(adminStaffB, {
      academicYearId: yearB.id,
      availabilityCategory: "POSTULATIONS_OPEN",
      campusId: campusB.id,
      code: "OFF-2027-1B-B",
      courseLevelId: levelB.id,
      processId: processB.id,
      status: "PUBLISHED",
      title: "Oferta B 1 Básico",
    }),
  );
  await runWithTenantContext(adminStaffB, () =>
    forms.assignOfferingVersion(adminStaffB, offeringB.id, formB.versionId),
  );

  return {
    adminReaderOnlyA,
    adminReviewerA,
    adminStaffB,
    applicantA,
    applicantAAdult,
    applicantB,
    familyA: familyContext(userAId),
    familyAAdult: familyContext(userAAdultId),
    familyB: familyContext(userBId),
    formVersionAId: formA.versionId,
    handoffAdminA,
    offeringAId: offeringA.id,
    offeringBId: offeringB.id,
    processAId: processA.id,
    processBId: processB.id,
    studentAdultAId,
    studentMinorAId,
    studentMinorBId,
    tenantA,
    tenantB,
    userAAdultId,
    userAId,
    userBId,
  };
}

async function createDraftApplication(
  applicant: TenantExecutionContext,
  family: FamilyExecutionContext,
  studentId: string,
  offeringId: string,
): Promise<string> {
  const publicCtx = tenantContext(
    applicant.actorId,
    applicant.tenantId,
    [PERMISSIONS.OFFERING_PUBLIC_READ],
    "public_admission",
  );
  return runWithFamilyContext(family, async () => {
    const draft = await intake.createApplicationDraft(
      family,
      publicCtx,
      { offeringId, studentId },
      BASE_NOW,
    );
    return draft.id;
  });
}

async function createAndVerifyAuthority(
  appId: string,
  applicant: TenantExecutionContext,
  family: FamilyExecutionContext,
  declaration: ApplicationAuthorityDeclarationInput,
  now = BASE_NOW,
) {
  const dec = await runWithFamilyContext(family, () =>
    runWithTenantContext(applicant, () =>
      authorities.declareApplicationAuthority(
        family,
        applicant,
        appId,
        declaration,
        now,
      ),
    ),
  );
  const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
    authorities.reviewApplicationAuthority(
      fixture.adminReviewerA,
      appId,
      {
        expectedConcurrencyVersion: dec.concurrencyVersion!,
        reason: "Revisando",
        toStatus: "UNDER_REVIEW",
      },
      now,
    ),
  );
  return runWithTenantContext(fixture.adminReviewerA, () =>
    authorities.reviewApplicationAuthority(
      fixture.adminReviewerA,
      appId,
      {
        expectedConcurrencyVersion: ur.concurrencyVersion!,
        reason: "Verificado",
        toStatus: "VERIFIED",
      },
      now,
    ),
  );
}

async function createDocumentVersionFixture(input: {
  applicationId: string;
  scanStatus?: "CLEAN" | "INFECTED" | "UNSCANNABLE" | "PENDING";
  technicalStatus?: "READY_FOR_REVIEW" | "QUARANTINED" | "BLOCKED_INVALID";
  tenantId: string;
  uploaderUserId: string;
}): Promise<string> {
  const requirementId = randomUUID();
  const reqVersionId = randomUUID();
  const submissionId = randomUUID();
  const versionId = randomUUID();

  const adminCtx = tenantContext(
    input.uploaderUserId,
    input.tenantId,
    [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_REVIEW],
    "synthetic_test",
  );

  await runWithTenantContext(adminCtx, () =>
    withTenantTransaction(prisma, async (tx) => {
      await tx.documentRequirement.create({
        data: {
          code: `REQ-${randomUUID().slice(0, 8)}`,
          id: requirementId,
          name: "Documento Requisito",
          purpose: "Requisito de prueba sintética",
          tenantId: input.tenantId,
        },
      });

      await tx.documentRequirementVersion.create({
        data: {
          allowedFileTypes: ["application/pdf"],
          allowsEquivalent: false,
          correctionWindowBusinessDays: 5,
          documentRequirementId: requirementId,
          id: reqVersionId,
          lifecycle: "PUBLISHED",
          maxFileSizeBytes: 10485760n,
          publishedAt: BASE_NOW,
          required: true,
          sensitivity: "restricted",
          tenantId: input.tenantId,
          validityRule: "NONE",
          versionNumber: 1,
        },
      });

      await tx.documentSubmission.create({
        data: {
          applicationId: input.applicationId,
          currentDocumentVersionId: null,
          documentRequirementId: requirementId,
          id: submissionId,
          requirementVersionId: reqVersionId,
          status: "CARGADO",
          tenantId: input.tenantId,
        },
      });

      const isReady =
        (input.technicalStatus ?? "READY_FOR_REVIEW") === "READY_FOR_REVIEW";
      await tx.documentVersion.create({
        data: {
          approvedObjectKey: isReady ? "synthetic/approved" : null,
          declaredMime: "application/pdf",
          detectedMime: "application/pdf",
          displayNameSanitized: "synthetic.pdf",
          documentSubmissionId: submissionId,
          id: versionId,
          origin: "SELF_SERVICE",
          quarantineObjectKey: "synthetic/quarantine",
          readyAt: isReady ? BASE_NOW : null,
          scanStatus: input.scanStatus ?? "CLEAN",
          sha256:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          sizeBytes: 1024n,
          technicalStatus: input.technicalStatus ?? "READY_FOR_REVIEW",
          tenantId: input.tenantId,
          uploadedBy: input.uploaderUserId,
          versionNumber: 1,
        },
      });

      if (isReady) {
        await tx.documentSubmission.update({
          data: { currentDocumentVersionId: versionId },
          where: { id: submissionId },
        });
      }
    }),
  );

  return versionId;
}

describe("G5-PC1-R12H Dedicated Application Authority Core Integration Suite", () => {
  beforeAll(async () => {
    authorities = new ApplicationAuthorityService(prisma);
    forms = new FormService(prisma);
    capacityOffer = new CapacityOfferService(prisma);
    handoffService = new FunctionalHandoffService(prisma);
    intake = new IntakeService(prisma);
  });

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await migrationPool.end();
  });

  // =========================================================================
  // 4. DIRECT AUTHORITY TESTS (R12-AUTH-01..18)
  // =========================================================================
  describe("4. Direct Authority Tests (R12-AUTH-01..18)", () => {
    it("R12-AUTH-01: verified email != verified authority (declaration produces DECLARED, not VERIFIED)", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const authority = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      expect(authority.status).toBe("DECLARED");
      expect(authority.verifiedAt).toBeNull();
      expect(authority.concurrencyVersion).toBe(1);
    });

    it("R12-AUTH-02: minor PARENT declaration results in DECLARED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const res = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "FATHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      expect(res.status).toBe("DECLARED");
      expect(res.authorityBasis).toBe("PARENT");
      expect(res.relationship).toBe("FATHER");
      expect(res.subjectMode).toBe("MINOR_REPRESENTATIVE");
    });

    it("R12-AUTH-03: minor SELF declaration rejected", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            authorities.declareApplicationAuthority(
              fixture.familyA,
              fixture.applicantA,
              appId,
              {
                authorityBasis: "SELF",
                relationship: "SELF",
                subjectMode: "ADULT_STUDENT_SELF",
              },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(ApplicationAuthorityValidationError);
    });

    it("R12-AUTH-04: adult representative declaration rejected", async () => {
      const appId = await createDraftApplication(
        fixture.applicantAAdult,
        fixture.familyAAdult,
        fixture.studentAdultAId,
        fixture.offeringAId,
      );

      await expect(
        runWithFamilyContext(fixture.familyAAdult, () =>
          runWithTenantContext(fixture.applicantAAdult, () =>
            authorities.declareApplicationAuthority(
              fixture.familyAAdult,
              fixture.applicantAAdult,
              appId,
              {
                authorityBasis: "PARENT",
                relationship: "MOTHER",
                subjectMode: "MINOR_REPRESENTATIVE",
              },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(ApplicationAuthorityValidationError);
    });

    it("R12-AUTH-05: adult SELF declaration accepted as DECLARED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantAAdult,
        fixture.familyAAdult,
        fixture.studentAdultAId,
        fixture.offeringAId,
      );

      const res = await runWithFamilyContext(fixture.familyAAdult, () =>
        runWithTenantContext(fixture.applicantAAdult, () =>
          authorities.declareApplicationAuthority(
            fixture.familyAAdult,
            fixture.applicantAAdult,
            appId,
            {
              authorityBasis: "SELF",
              relationship: "SELF",
              subjectMode: "ADULT_STUDENT_SELF",
            },
            BASE_NOW,
          ),
        ),
      );

      expect(res.status).toBe("DECLARED");
      expect(res.subjectMode).toBe("ADULT_STUDENT_SELF");
      expect(res.authorityBasis).toBe("SELF");
      expect(res.relationship).toBe("SELF");
      expect(res.studentAgeCategory).toBe("ADULT");
    });

    it("R12-AUTH-06: family cannot directly set VERIFIED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      // Declaration only accepts subjectMode, relationship, authorityBasis, expectedConcurrencyVersion
      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      expect(declared.status).toBe("DECLARED");

      // Attempting to review as family context throws ForbiddenError
      await expect(
        runWithTenantContext(fixture.applicantA, () =>
          authorities.reviewApplicationAuthority(
            fixture.applicantA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Family attempting review",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("R12-AUTH-07: staff without application.authority.review denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      await expect(
        runWithTenantContext(fixture.adminReaderOnlyA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReaderOnlyA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Review attempt without permission",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("R12-AUTH-08: authorized reviewer: DECLARED → UNDER_REVIEW → VERIFIED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Iniciando revisión de certificado",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );
      expect(underReview.status).toBe("UNDER_REVIEW");

      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificado parentesco madre",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );
      expect(verified.status).toBe("VERIFIED");
      expect(verified.verifiedAt).not.toBeNull();
    });

    it("R12-AUTH-09: non-PARENT representation cannot VERIFY without valid evidence, but succeeds with valid linked evidence", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "LEGAL_REPRESENTATIVE",
              relationship: "OTHER_RELATIVE",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Iniciando revisión de tutor legal",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      // Attempting to VERIFY without evidence throws AUTHORITY_EVIDENCE_REQUIRED
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: underReview.concurrencyVersion!,
              reason: "Intentando verificar sin evidencia",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_REQUIRED",
        }),
      );

      // Create valid document version and link it during verification
      const validDocVerId = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "CLEAN",
        technicalStatus: "READY_FOR_REVIEW",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });

      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            evidenceDocumentVersionIds: [validDocVerId],
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificado con sentencia judicial de tutela",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      expect(verified.status).toBe("VERIFIED");
      expect(verified.evidence).toHaveLength(1);
      expect(verified.evidence?.[0]?.documentVersionId).toBe(validDocVerId);
    });

    it("R12-AUTH-10: DISPUTED causes critical authority guard denial", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Iniciando revisión",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Se reporta disputa sobre la tuición",
            toStatus: "DISPUTED",
          },
          BASE_NOW,
        ),
      );

      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: BASE_NOW,
              tenantId: fixture.tenantA,
            }),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-AUTH-11: history is append-only and preserves transitions", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando antecedentes",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Aprobado por secretaría",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      expect(verified.history).toHaveLength(3);
      expect(verified.history[0]).toMatchObject({
        fromStatus: "NOT_DECLARED",
        sequenceNumber: 1,
        toStatus: "DECLARED",
      });
      expect(verified.history[1]).toMatchObject({
        fromStatus: "DECLARED",
        reason: "Revisando antecedentes",
        sequenceNumber: 2,
        toStatus: "UNDER_REVIEW",
      });
      expect(verified.history[2]).toMatchObject({
        fromStatus: "UNDER_REVIEW",
        reason: "Aprobado por secretaría",
        sequenceNumber: 3,
        toStatus: "VERIFIED",
      });
    });

    it("R12-AUTH-12: stale expectedConcurrencyVersion rejected", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: 999,
              reason: "Stale version review",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_VERSION_CHANGED",
        }),
      );
    });

    it("R12-AUTH-13: cross-tenant authority inaccessible", async () => {
      const appIdA = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      await expect(
        runWithTenantContext(fixture.adminStaffB, () =>
          authorities.getStaffAuthority(fixture.adminStaffB, appIdA),
        ),
      ).rejects.toThrow(IntakeNotFoundError);

      await expect(
        runWithTenantContext(fixture.adminStaffB, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminStaffB,
            appIdA,
            {
              expectedConcurrencyVersion: 1,
              reason: "Cross tenant review",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(IntakeNotFoundError);
    });

    it("R12-AUTH-14: Student DOB change after verification causes AUTHORITY_STUDENT_DATA_CHANGED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisión",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificación",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      // Now alter student's DOB in family profile
      await prisma.student.update({
        data: { dateOfBirth: new Date("2012-08-20T00:00:00.000Z") },
        where: { id: fixture.studentMinorAId },
      });

      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: BASE_NOW,
              tenantId: fixture.tenantA,
            }),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_STUDENT_DATA_CHANGED",
        }),
      );
    });

    it("R12-AUTH-15: missing Student DOB prevents declaration and critical flow", async () => {
      // Create student with NULL date_of_birth
      const noDobStudent = await prisma.student.create({
        data: {
          dateOfBirth: null,
          familyProfileId: (
            await prisma.familyProfile.findFirstOrThrow({
              where: { userId: fixture.userAId },
            })
          ).id,
          familyName: "DOB",
          givenName: "Sin",
        },
      });

      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        noDobStudent.id,
        fixture.offeringAId,
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            authorities.declareApplicationAuthority(
              fixture.familyA,
              fixture.applicantA,
              appId,
              {
                authorityBasis: "PARENT",
                relationship: "MOTHER",
                subjectMode: "MINOR_REPRESENTATIVE",
              },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "STUDENT_DATE_OF_BIRTH_REQUIRED",
        }),
      );

      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: BASE_NOW,
              tenantId: fixture.tenantA,
            }),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "STUDENT_DATE_OF_BIRTH_REQUIRED",
        }),
      );
    });

    it("R12-AUTH-16: re-declaration from VERIFIED returns to DECLARED and previous history remains", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificado",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );
      expect(verified.status).toBe("VERIFIED");

      // Re-declare as FATHER
      const redeclared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              expectedConcurrencyVersion: verified.concurrencyVersion!,
              relationship: "FATHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      expect(redeclared.status).toBe("DECLARED");
      expect(redeclared.verifiedAt).toBeNull();
      expect(redeclared.concurrencyVersion).toBe(
        verified.concurrencyVersion! + 1,
      );

      const staffView = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.getStaffAuthority(fixture.adminReviewerA, appId),
      );
      expect(staffView.history).toHaveLength(4);
      expect(staffView.history[3]).toMatchObject({
        fromStatus: "VERIFIED",
        sequenceNumber: 4,
        toStatus: "DECLARED",
      });
    });

    it("R12-AUTH-17: REJECTED authority does NOT automatically reject/withdraw the Application", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const rejectedAuth = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: underReview.concurrencyVersion!,
              reason: "Documentación no coincide",
              toStatus: "REJECTED",
            },
            BASE_NOW,
          ),
      );
      expect(rejectedAuth.status).toBe("REJECTED");

      const appRow = await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.application.findUnique({
            where: { id: appId },
          }),
        ),
      );
      expect(appRow?.status).toBe("DRAFT");
    });

    it("R12-AUTH-18: assisted staff operator is not substituted for authorityUserId", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );

      // Assisted family context (actorId is family user, effectiveActorId is staff operator)
      const assistedFamily = familyContext(
        fixture.userAId,
        fixture.adminReviewerA.actorId,
      );
      const assistedApplicant = tenantContext(
        fixture.userAId,
        fixture.tenantA,
        fixture.applicantA.capabilities ?? [],
        "family_application",
        fixture.adminReviewerA.actorId,
      );

      const declared = await runWithFamilyContext(assistedFamily, () =>
        runWithTenantContext(assistedApplicant, () =>
          authorities.declareApplicationAuthority(
            assistedFamily,
            assistedApplicant,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      const staffView = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.getStaffAuthority(fixture.adminReviewerA, appId),
      );

      expect(staffView.authorityUserId).toBe(fixture.userAId);
      expect(staffView.authorityUserId).not.toBe(
        fixture.adminReviewerA.actorId,
      );
    });
  });

  // =========================================================================
  // 5. STATE MACHINE TESTS
  // =========================================================================
  describe("5. State Machine Tests (Allowed and Invalid Transitions)", () => {
    async function setupDeclared(appId: string) {
      return runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
    }

    it("proves DECLARED → EVIDENCE_PENDING", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: declared.concurrencyVersion!,
            reason: "Solicitando certificado adicional",
            toStatus: "EVIDENCE_PENDING",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("EVIDENCE_PENDING");
    });

    it("proves DECLARED → UNDER_REVIEW", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: declared.concurrencyVersion!,
            reason: "Revisando antecedentes",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("UNDER_REVIEW");
    });

    it("proves EVIDENCE_PENDING → UNDER_REVIEW", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const evPending = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: declared.concurrencyVersion!,
            reason: "Falta documento",
            toStatus: "EVIDENCE_PENDING",
          },
          BASE_NOW,
        ),
      );

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: evPending.concurrencyVersion!,
            reason: "Documento subido, retomando revisión",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("UNDER_REVIEW");
    });

    it("proves UNDER_REVIEW → VERIFIED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificado",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("VERIFIED");
    });

    it("proves UNDER_REVIEW → EVIDENCE_PENDING", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Evidencia insuficiente",
            toStatus: "EVIDENCE_PENDING",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("EVIDENCE_PENDING");
    });

    it("proves UNDER_REVIEW → DISPUTED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Disputa legal notificada",
            toStatus: "DISPUTED",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("DISPUTED");
    });

    it("proves UNDER_REVIEW → REJECTED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Declaración rechazada por documento falso",
            toStatus: "REJECTED",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("REJECTED");
    });

    it("proves VERIFIED → DISPUTED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );
      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificado",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      const res = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: verified.concurrencyVersion!,
            reason: "Llega oposición de otro progenitor",
            toStatus: "DISPUTED",
          },
          BASE_NOW,
        ),
      );
      expect(res.status).toBe("DISPUTED");
    });

    it("proves DISPUTED → UNDER_REVIEW, DISPUTED → VERIFIED, DISPUTED → REJECTED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );
      const disputed = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Disputa inicial",
            toStatus: "DISPUTED",
          },
          BASE_NOW,
        ),
      );

      // DISPUTED -> UNDER_REVIEW
      const backUnderReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: disputed.concurrencyVersion!,
              reason: "Reabriendo revisión de disputa",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );
      expect(backUnderReview.status).toBe("UNDER_REVIEW");

      // UNDER_REVIEW -> DISPUTED again
      const redisputed = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: backUnderReview.concurrencyVersion!,
              reason: "Disputa reiterada",
              toStatus: "DISPUTED",
            },
            BASE_NOW,
          ),
      );

      // DISPUTED -> VERIFIED
      const verifiedFromDispute = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: redisputed.concurrencyVersion!,
              reason: "Disputa resuelta a favor del postulante",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
      );
      expect(verifiedFromDispute.status).toBe("VERIFIED");

      // VERIFIED -> DISPUTED -> REJECTED
      const disputed2 = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: verifiedFromDispute.concurrencyVersion!,
            reason: "Nueva disputa",
            toStatus: "DISPUTED",
          },
          BASE_NOW,
        ),
      );
      const rejectedFromDispute = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: disputed2.concurrencyVersion!,
              reason: "Disputa concluye en rechazo",
              toStatus: "REJECTED",
            },
            BASE_NOW,
          ),
      );
      expect(rejectedFromDispute.status).toBe("REJECTED");
    });

    it("proves REJECTED → DECLARED via explicit redeclaration", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );
      const rejected = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Rechazado",
            toStatus: "REJECTED",
          },
          BASE_NOW,
        ),
      );

      const redeclared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              expectedConcurrencyVersion: rejected.concurrencyVersion!,
              relationship: "FATHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      expect(redeclared.status).toBe("DECLARED");
    });

    it("rejects representative invalid transitions", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const declared = await setupDeclared(appId);

      // DECLARED -> VERIFIED directly is invalid
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Skipping under review",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_INVALID_TRANSITION",
        }),
      );

      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
      );
      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: underReview.concurrencyVersion!,
            reason: "Verificado",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      // VERIFIED -> UNDER_REVIEW directly is invalid
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: verified.concurrencyVersion!,
              reason: "Invalid transition from verified",
              toStatus: "UNDER_REVIEW",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_INVALID_TRANSITION",
        }),
      );
    });
  });

  // =========================================================================
  // 6. AGE TRANSITION INTEGRATION PROOF
  // =========================================================================
  describe("6. Age Transition Integration Proof", () => {
    it("proves boundary transition when student turns 18: minor representative VERIFIED at 17 -> reaches 18 -> critical guard denies -> redeclare ADULT_STUDENT_SELF -> review & verify -> allowed", async () => {
      // Create student who is 17 on 2026-08-15 and turns 18 on 2026-08-16 (DOB: 2008-08-16)
      const turningStudent = await prisma.student.create({
        data: {
          dateOfBirth: new Date("2008-08-16T00:00:00.000Z"),
          familyProfileId: (
            await prisma.familyProfile.findFirstOrThrow({
              where: { userId: fixture.userAId },
            })
          ).id,
          familyName: "Dieciocho",
          givenName: "Cumple",
        },
      });

      const age17Date = new Date("2026-08-15T12:00:00.000Z");
      const age18Date = new Date("2026-08-16T12:00:00.000Z");

      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        turningStudent.id,
        fixture.offeringAId,
      );

      // 1. Minor representative declared at age 17
      const declared = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            age17Date,
          ),
        ),
      );

      // 2. Staff reviews and VERIFIES at age 17
      const underReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: declared.concurrencyVersion!,
              reason: "Revisando representante de menor",
              toStatus: "UNDER_REVIEW",
            },
            age17Date,
          ),
      );

      const verifiedMinor = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: underReview.concurrencyVersion!,
              reason: "Verificado parentesco para menor de 17",
              toStatus: "VERIFIED",
            },
            age17Date,
          ),
      );
      expect(verifiedMinor.status).toBe("VERIFIED");

      // 3. At age 17 (2026-08-15), critical guard allows representative
      const allowedAt17 = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: age17Date,
              tenantId: fixture.tenantA,
            }),
          ),
      );
      expect(allowedAt17.subjectMode).toBe("MINOR_REPRESENTATIVE");

      // 4. Reference / action date moves to 18th birthday (2026-08-16) -> critical guard denies
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: age18Date,
              tenantId: fixture.tenantA,
            }),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_MODE_INVALID",
        }),
      );

      // 5. Explicit redeclaration as ADULT_STUDENT_SELF / SELF / SELF
      const redeclaredAdult = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "SELF",
              expectedConcurrencyVersion: verifiedMinor.concurrencyVersion!,
              relationship: "SELF",
              subjectMode: "ADULT_STUDENT_SELF",
            },
            age18Date,
          ),
        ),
      );
      expect(redeclaredAdult.status).toBe("DECLARED");
      expect(redeclaredAdult.subjectMode).toBe("ADULT_STUDENT_SELF");
      expect(redeclaredAdult.studentAgeCategory).toBe("ADULT");

      // 6. Critical guard still denies while in DECLARED status
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: age18Date,
              tenantId: fixture.tenantA,
            }),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );

      // 7. Manual review: DECLARED -> UNDER_REVIEW -> VERIFIED
      const adultUnderReview = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: redeclaredAdult.concurrencyVersion!,
              reason: "Revisando auto-declaración de mayor de edad",
              toStatus: "UNDER_REVIEW",
            },
            age18Date,
          ),
      );
      const adultVerified = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              expectedConcurrencyVersion: adultUnderReview.concurrencyVersion!,
              reason: "Verificada identidad y mayoría de edad",
              toStatus: "VERIFIED",
            },
            age18Date,
          ),
      );
      expect(adultVerified.status).toBe("VERIFIED");

      // 8. Critical guard allows now for adult student on 2026-08-16
      const allowedAt18 = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          withTenantTransaction(prisma, (tx) =>
            assertApplicationAuthorityForCriticalAction(tx, {
              applicationId: appId,
              now: age18Date,
              tenantId: fixture.tenantA,
            }),
          ),
      );
      expect(allowedAt18.subjectMode).toBe("ADULT_STUDENT_SELF");
    });
  });

  // =========================================================================
  // 7. SUBMISSION DIRECT TESTS (R12-SUB-01..10)
  // =========================================================================
  describe("7. Submission Direct Tests (R12-SUB-01..10)", () => {
    it("R12-SUB-01: minor VERIFIED representative → allowed", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      await createAndVerifyAuthority(
        appId,
        fixture.applicantA,
        fixture.familyA,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );

      const submitted = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          forms.submitApplication(
            fixture.familyA,
            fixture.applicantA,
            appId,
            BASE_NOW,
          ),
        ),
      );
      expect(submitted.status).toBe("SUBMITTED");
    });

    it("R12-SUB-02: DECLARED → APPLICATION_AUTHORITY_NOT_VERIFIED", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            forms.submitApplication(
              fixture.familyA,
              fixture.applicantA,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-SUB-03: UNDER_REVIEW → denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            forms.submitApplication(
              fixture.familyA,
              fixture.applicantA,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-SUB-04: DISPUTED → denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );
      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: ur.concurrencyVersion!,
            reason: "Disputa",
            toStatus: "DISPUTED",
          },
          BASE_NOW,
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            forms.submitApplication(
              fixture.familyA,
              fixture.applicantA,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-SUB-05: REJECTED → denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );
      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: ur.concurrencyVersion!,
            reason: "Rechazado",
            toStatus: "REJECTED",
          },
          BASE_NOW,
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            forms.submitApplication(
              fixture.familyA,
              fixture.applicantA,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-SUB-06: adult VERIFIED SELF → allowed", async () => {
      const appId = await createDraftApplication(
        fixture.applicantAAdult,
        fixture.familyAAdult,
        fixture.studentAdultAId,
        fixture.offeringAId,
      );
      await createAndVerifyAuthority(
        appId,
        fixture.applicantAAdult,
        fixture.familyAAdult,
        {
          authorityBasis: "SELF",
          relationship: "SELF",
          subjectMode: "ADULT_STUDENT_SELF",
        },
      );

      const submitted = await runWithFamilyContext(fixture.familyAAdult, () =>
        runWithTenantContext(fixture.applicantAAdult, () =>
          forms.submitApplication(
            fixture.familyAAdult,
            fixture.applicantAAdult,
            appId,
            BASE_NOW,
          ),
        ),
      );
      expect(submitted.status).toBe("SUBMITTED");
    });

    it("R12-SUB-07: adult representative mode → denied", async () => {
      // Force database into inconsistent representative state for adult
      const appId = await createDraftApplication(
        fixture.applicantAAdult,
        fixture.familyAAdult,
        fixture.studentAdultAId,
        fixture.offeringAId,
      );
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.applicationAuthority.create({
            data: {
              applicationId: appId,
              authorityBasis: "PARENT",
              authorityUserId: fixture.userAAdultId,
              dateOfBirthSnapshot: new Date("2005-03-15T00:00:00.000Z"),
              declaredAt: BASE_NOW,
              relationship: "MOTHER",
              status: "VERIFIED",
              subjectMode: "MINOR_REPRESENTATIVE",
              tenantId: fixture.tenantA,
              verifiedAt: BASE_NOW,
            },
          }),
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyAAdult, () =>
          runWithTenantContext(fixture.applicantAAdult, () =>
            forms.submitApplication(
              fixture.familyAAdult,
              fixture.applicantAAdult,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_MODE_INVALID",
        }),
      );
    });

    it("R12-SUB-08: DOB snapshot mismatch → denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      await createAndVerifyAuthority(
        appId,
        fixture.applicantA,
        fixture.familyA,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );

      // Mutate student DOB
      await prisma.student.update({
        data: { dateOfBirth: new Date("2012-06-01T00:00:00.000Z") },
        where: { id: fixture.studentMinorAId },
      });

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            forms.submitApplication(
              fixture.familyA,
              fixture.applicantA,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_STUDENT_DATA_CHANGED",
        }),
      );
    });

    it("R12-SUB-09: assisted submission uses family principal, not operator", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      await createAndVerifyAuthority(
        appId,
        fixture.applicantA,
        fixture.familyA,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );

      const sessionId = randomUUID();
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, async (tx) => {
          const prof = await tx.familyProfile.findFirstOrThrow({
            where: { userId: fixture.userAId },
          });
          await tx.assistanceSession.create({
            data: {
              adultPresentConfirmed: true,
              adultResponsibleUserId: fixture.userAId,
              authorizationConfirmed: true,
              authorizationMethod: "IN_PERSON_CONFIRMED",
              authorizationRecordedAt: BASE_NOW,
              correlationId: "synthetic-assist-r12h",
              familyProfileId: prof.id,
              id: sessionId,
              operatorRoleSnapshot: "OPERATOR",
              operatorUserId: fixture.adminReviewerA.actorId,
              startedAt: BASE_NOW,
              status: "ACTIVE",
              tenantId: fixture.tenantA,
            },
          });
          await tx.application.update({
            data: {
              assistanceSessionId: sessionId,
              origin: "ASSISTED",
            },
            where: { id: appId },
          });
        }),
      );

      const assistedApplicant = tenantContext(
        fixture.userAId,
        fixture.tenantA,
        [
          ...(fixture.applicantA.capabilities ?? []),
          PERMISSIONS.APPLICATION_ASSIST,
        ],
        "family_application",
        fixture.adminReviewerA.actorId,
      );

      const submitted = await runWithTenantContext(assistedApplicant, () =>
        forms.submitAssistedApplication(
          assistedApplicant,
          {
            applicationId: appId,
            assistanceSessionId: sessionId,
          },
          BASE_NOW,
        ),
      );
      expect(submitted.status).toBe("SUBMITTED");
    });

    it("R12-SUB-10: existing form/document/activity readiness still remains required", async () => {
      // Create mandatory document requirement that is not fulfilled
      const reqId = randomUUID();
      const reqVerId = randomUUID();
      await runWithTenantContext(adminReviewerACtx(fixture), () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.documentRequirement.create({
            data: {
              code: "REQ-MANDATORY",
              id: reqId,
              name: "Doc Obligatorio",
              purpose: "Validación requerida",
              tenantId: fixture.tenantA,
            },
          });
          await tx.documentRequirementVersion.create({
            data: {
              allowedFileTypes: ["application/pdf"],
              allowsEquivalent: false,
              correctionWindowBusinessDays: 5,
              documentRequirementId: reqId,
              id: reqVerId,
              lifecycle: "PUBLISHED",
              maxFileSizeBytes: 10485760n,
              publishedAt: BASE_NOW,
              required: true,
              sensitivity: "restricted",
              tenantId: fixture.tenantA,
              validityRule: "NONE",
              versionNumber: 1,
            },
          });
        }),
      );

      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      await createAndVerifyAuthority(
        appId,
        fixture.applicantA,
        fixture.familyA,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            forms.submitApplication(
              fixture.familyA,
              fixture.applicantA,
              appId,
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        "Required applicable documents are not ready for submission",
      );
    });
  });

  // =========================================================================
  // 8. OFFER ACCEPTANCE DIRECT TESTS (R12-OFFER-01..08)
  // =========================================================================
  describe("8. Offer Acceptance Direct Tests (R12-OFFER-01..08)", () => {
    async function createSubmittedAppWithOffer(input: {
      adult?: boolean;
      applicant: TenantExecutionContext;
      expired?: boolean;
      family: FamilyExecutionContext;
      studentId: string;
    }): Promise<{
      applicationId: string;
      offerId: string;
      offerVersionId: string;
    }> {
      const appId = await createDraftApplication(
        input.applicant,
        input.family,
        input.studentId,
        fixture.offeringAId,
      );

      // Verify authority
      const dec = await runWithFamilyContext(input.family, () =>
        runWithTenantContext(input.applicant, () =>
          authorities.declareApplicationAuthority(
            input.family,
            input.applicant,
            appId,
            input.adult
              ? {
                  authorityBasis: "SELF",
                  relationship: "SELF",
                  subjectMode: "ADULT_STUDENT_SELF",
                }
              : {
                  authorityBasis: "PARENT",
                  relationship: "MOTHER",
                  subjectMode: "MINOR_REPRESENTATIVE",
                },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );
      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: ur.concurrencyVersion!,
            reason: "Verificado",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      // Submit
      await runWithFamilyContext(input.family, () =>
        runWithTenantContext(input.applicant, () =>
          forms.submitApplication(
            input.family,
            input.applicant,
            appId,
            BASE_NOW,
          ),
        ),
      );

      // Create capacity, reservation and offer directly via withTenantTransaction
      const capacityId = randomUUID();
      const reservationId = randomUUID();
      const offerId = randomUUID();
      const offerVersionId = randomUUID();

      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, async (tx) => {
          const cap = await tx.admissionCapacity.upsert({
            create: {
              configuredCapacity: 30,
              id: capacityId,
              offerValidityBusinessDays: 3,
              offeringId: fixture.offeringAId,
              tenantId: fixture.tenantA,
            },
            update: {},
            where: {
              tenantId_offeringId: {
                offeringId: fixture.offeringAId,
                tenantId: fixture.tenantA,
              },
            },
          });
          await tx.seatReservation.create({
            data: {
              applicationId: appId,
              capacityId: cap.id,
              id: reservationId,
              offeringId: fixture.offeringAId,
              reservedAt: BASE_NOW,
              state: "ACTIVE",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOffer.create({
            data: {
              applicationId: appId,
              id: offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOfferVersion.create({
            data: {
              applicationId: appId,
              expiresAt: input.expired
                ? new Date(BASE_NOW.getTime() - 3600_000)
                : new Date(BASE_NOW.getTime() + 5 * 86400_000),
              id: offerVersionId,
              issuedAt: input.expired
                ? new Date(BASE_NOW.getTime() - 7200_000)
                : BASE_NOW,
              issuedBy: fixture.adminReviewerA.actorId,
              lifecycle: "ACTIVE",
              offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              reservationId,
              tenantId: fixture.tenantA,
              versionNumber: 1,
            },
          });
          await tx.admissionOffer.update({
            data: { currentVersionId: offerVersionId },
            where: { id: offerId },
          });
        }),
      );

      return { applicationId: appId, offerId, offerVersionId };
    }

    it("R12-OFFER-01: verified minor representative ACCEPT succeeds", async () => {
      const { offerId, offerVersionId } = await createSubmittedAppWithOffer({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      const accepted = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          capacityOffer.acceptOffer(
            fixture.familyA,
            fixture.applicantA,
            offerId,
            { expectedOfferVersionId: offerVersionId },
            BASE_NOW,
          ),
        ),
      );
      expect(accepted.current.lifecycle).toBe("ACCEPTED");
    });

    it("R12-OFFER-02: DECLARED / unverified cannot ACCEPT", async () => {
      const { applicationId, offerId, offerVersionId } =
        await createSubmittedAppWithOffer({
          applicant: fixture.applicantA,
          family: fixture.familyA,
          studentId: fixture.studentMinorAId,
        });

      // Set authority back to DECLARED
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.applicationAuthority.updateMany({
            data: { status: "DECLARED", verifiedAt: null },
            where: { applicationId },
          }),
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            capacityOffer.acceptOffer(
              fixture.familyA,
              fixture.applicantA,
              offerId,
              { expectedOfferVersionId: offerVersionId },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-OFFER-03: DISPUTED cannot ACCEPT", async () => {
      const { applicationId, offerId, offerVersionId } =
        await createSubmittedAppWithOffer({
          applicant: fixture.applicantA,
          family: fixture.familyA,
          studentId: fixture.studentMinorAId,
        });

      // Set authority to DISPUTED
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.applicationAuthority.updateMany({
            data: { status: "DISPUTED" },
            where: { applicationId },
          }),
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            capacityOffer.acceptOffer(
              fixture.familyA,
              fixture.applicantA,
              offerId,
              { expectedOfferVersionId: offerVersionId },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-OFFER-04: adult VERIFIED SELF accepts", async () => {
      const { offerId, offerVersionId } = await createSubmittedAppWithOffer({
        adult: true,
        applicant: fixture.applicantAAdult,
        family: fixture.familyAAdult,
        studentId: fixture.studentAdultAId,
      });

      const accepted = await runWithFamilyContext(fixture.familyAAdult, () =>
        runWithTenantContext(fixture.applicantAAdult, () =>
          capacityOffer.acceptOffer(
            fixture.familyAAdult,
            fixture.applicantAAdult,
            offerId,
            { expectedOfferVersionId: offerVersionId },
            BASE_NOW,
          ),
        ),
      );
      expect(accepted.current.lifecycle).toBe("ACCEPTED");
    });

    it("R12-OFFER-05: adult representative mode cannot accept", async () => {
      const { applicationId, offerId, offerVersionId } =
        await createSubmittedAppWithOffer({
          adult: true,
          applicant: fixture.applicantAAdult,
          family: fixture.familyAAdult,
          studentId: fixture.studentAdultAId,
        });

      // Set authority to MINOR_REPRESENTATIVE
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.applicationAuthority.updateMany({
            data: {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            where: { applicationId },
          }),
        ),
      );

      await expect(
        runWithFamilyContext(fixture.familyAAdult, () =>
          runWithTenantContext(fixture.applicantAAdult, () =>
            capacityOffer.acceptOffer(
              fixture.familyAAdult,
              fixture.applicantAAdult,
              offerId,
              { expectedOfferVersionId: offerVersionId },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_MODE_INVALID",
        }),
      );
    });

    it("R12-OFFER-06: OfferAcceptance.actorId equals authority principal", async () => {
      const { applicationId, offerId, offerVersionId } =
        await createSubmittedAppWithOffer({
          applicant: fixture.applicantA,
          family: fixture.familyA,
          studentId: fixture.studentMinorAId,
        });

      await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          capacityOffer.acceptOffer(
            fixture.familyA,
            fixture.applicantA,
            offerId,
            { expectedOfferVersionId: offerVersionId },
            BASE_NOW,
          ),
        ),
      );

      const acceptance = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          withTenantTransaction(prisma, (tx) =>
            tx.offerAcceptance.findFirst({
              where: { applicationId },
            }),
          ),
      );
      expect(acceptance?.actorId).toBe(fixture.userAId);
    });

    it("R12-OFFER-07: idempotent repeated ACCEPT still works", async () => {
      const { offerId, offerVersionId } = await createSubmittedAppWithOffer({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      const first = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          capacityOffer.acceptOffer(
            fixture.familyA,
            fixture.applicantA,
            offerId,
            { expectedOfferVersionId: offerVersionId },
            BASE_NOW,
          ),
        ),
      );
      expect(first.current.lifecycle).toBe("ACCEPTED");

      const second = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          capacityOffer.acceptOffer(
            fixture.familyA,
            fixture.applicantA,
            offerId,
            { expectedOfferVersionId: offerVersionId },
            BASE_NOW,
          ),
        ),
      );
      expect(second.current.lifecycle).toBe("ACCEPTED");
    });

    it("R12-OFFER-08: existing expiry semantics remain unchanged", async () => {
      const { offerId, offerVersionId } = await createSubmittedAppWithOffer({
        applicant: fixture.applicantA,
        expired: true,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          runWithTenantContext(fixture.applicantA, () =>
            capacityOffer.acceptOffer(
              fixture.familyA,
              fixture.applicantA,
              offerId,
              { expectedOfferVersionId: offerVersionId },
              BASE_NOW,
            ),
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "OFFER_EXPIRED",
        }),
      );
    });
  });

  // =========================================================================
  // 9. HANDOFF DIRECT TESTS (R12-HANDOFF-01..08)
  // =========================================================================
  describe("9. Handoff Direct Tests (R12-HANDOFF-01..08)", () => {
    async function setupAcceptedApplication(input: {
      adult?: boolean;
      applicant: TenantExecutionContext;
      family: FamilyExecutionContext;
      studentId: string;
    }): Promise<{ applicationId: string; acceptanceId: string }> {
      const appId = await createDraftApplication(
        input.applicant,
        input.family,
        input.studentId,
        fixture.offeringAId,
      );

      // Verify authority
      const dec = await runWithFamilyContext(input.family, () =>
        runWithTenantContext(input.applicant, () =>
          authorities.declareApplicationAuthority(
            input.family,
            input.applicant,
            appId,
            input.adult
              ? {
                  authorityBasis: "SELF",
                  relationship: "SELF",
                  subjectMode: "ADULT_STUDENT_SELF",
                }
              : {
                  authorityBasis: "PARENT",
                  relationship: "MOTHER",
                  subjectMode: "MINOR_REPRESENTATIVE",
                },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );
      await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: ur.concurrencyVersion!,
            reason: "Verificado",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      // Submit
      await runWithFamilyContext(input.family, () =>
        runWithTenantContext(input.applicant, () =>
          forms.submitApplication(
            input.family,
            input.applicant,
            appId,
            BASE_NOW,
          ),
        ),
      );

      // Offer & Acceptance
      const capacityId = randomUUID();
      const reservationId = randomUUID();
      const offerId = randomUUID();
      const offerVersionId = randomUUID();

      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, async (tx) => {
          const cap = await tx.admissionCapacity.upsert({
            create: {
              configuredCapacity: 30,
              id: capacityId,
              offerValidityBusinessDays: 3,
              offeringId: fixture.offeringAId,
              tenantId: fixture.tenantA,
            },
            update: {},
            where: {
              tenantId_offeringId: {
                offeringId: fixture.offeringAId,
                tenantId: fixture.tenantA,
              },
            },
          });
          await tx.seatReservation.create({
            data: {
              applicationId: appId,
              capacityId: cap.id,
              id: reservationId,
              offeringId: fixture.offeringAId,
              reservedAt: BASE_NOW,
              state: "ACTIVE",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOffer.create({
            data: {
              applicationId: appId,
              id: offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOfferVersion.create({
            data: {
              applicationId: appId,
              expiresAt: new Date(BASE_NOW.getTime() + 5 * 86400_000),
              id: offerVersionId,
              issuedAt: BASE_NOW,
              issuedBy: fixture.adminReviewerA.actorId,
              lifecycle: "ACTIVE",
              offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              reservationId,
              tenantId: fixture.tenantA,
              versionNumber: 1,
            },
          });
          await tx.admissionOffer.update({
            data: { currentVersionId: offerVersionId },
            where: { id: offerId },
          });
        }),
      );

      await runWithFamilyContext(input.family, () =>
        runWithTenantContext(input.applicant, () =>
          capacityOffer.acceptOffer(
            input.family,
            input.applicant,
            offerId,
            { expectedOfferVersionId: offerVersionId },
            BASE_NOW,
          ),
        ),
      );

      const acceptance = await runWithTenantContext(
        fixture.adminReviewerA,
        () =>
          withTenantTransaction(prisma, (tx) =>
            tx.offerAcceptance.findFirstOrThrow({
              where: { applicationId: appId },
            }),
          ),
      );
      return { acceptanceId: acceptance.id, applicationId: appId };
    }

    it("R12-HANDOFF-01: submitted + accepted + verified authority → allowed", async () => {
      const { applicationId } = await setupAcceptedApplication({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      const handoff = await runWithTenantContext(fixture.handoffAdminA, () =>
        handoffService.requestFunctionalHandoff(
          fixture.handoffAdminA,
          applicationId,
          BASE_NOW,
        ),
      );
      expect(handoff.applicationId).toBe(applicationId);
      expect(handoff.status).toBe("REQUESTED");
    });

    it("R12-HANDOFF-02: authority absent → denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const capacityId = randomUUID();
      const reservationId = randomUUID();
      const offerId = randomUUID();
      const offerVersionId = randomUUID();

      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.application.update({
            data: { status: "SUBMITTED", submittedAt: BASE_NOW },
            where: { id: appId },
          });
          const cap = await tx.admissionCapacity.upsert({
            create: {
              configuredCapacity: 30,
              id: capacityId,
              offerValidityBusinessDays: 3,
              offeringId: fixture.offeringAId,
              tenantId: fixture.tenantA,
            },
            update: {},
            where: {
              tenantId_offeringId: {
                offeringId: fixture.offeringAId,
                tenantId: fixture.tenantA,
              },
            },
          });
          await tx.seatReservation.create({
            data: {
              applicationId: appId,
              capacityId: cap.id,
              id: reservationId,
              offeringId: fixture.offeringAId,
              reservedAt: BASE_NOW,
              state: "ACTIVE",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOffer.create({
            data: {
              applicationId: appId,
              id: offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOfferVersion.create({
            data: {
              applicationId: appId,
              expiresAt: new Date(BASE_NOW.getTime() + 5 * 86400_000),
              id: offerVersionId,
              issuedAt: BASE_NOW,
              issuedBy: fixture.adminReviewerA.actorId,
              lifecycle: "ACCEPTED",
              offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              reservationId,
              tenantId: fixture.tenantA,
              terminalAt: BASE_NOW,
              terminalReason: "FAMILY_ACCEPTED",
              versionNumber: 1,
            },
          });
          await tx.admissionOffer.update({
            data: { currentVersionId: offerVersionId },
            where: { id: offerId },
          });
          await tx.offerAcceptance.create({
            data: {
              acceptedAt: BASE_NOW,
              actorId: fixture.userAId,
              applicationId: appId,
              offerId,
              offeringId: fixture.offeringAId,
              offerVersionId,
              reservationId,
              tenantId: fixture.tenantA,
            },
          });
        }),
      );

      await expect(
        runWithTenantContext(fixture.handoffAdminA, () =>
          handoffService.requestFunctionalHandoff(
            fixture.handoffAdminA,
            appId,
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_DECLARED",
        }),
      );
    });

    it("R12-HANDOFF-03: DISPUTED → denied", async () => {
      const { applicationId } = await setupAcceptedApplication({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      // Set authority to DISPUTED
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.applicationAuthority.updateMany({
            data: { status: "DISPUTED" },
            where: { applicationId },
          }),
        ),
      );

      await expect(
        runWithTenantContext(fixture.handoffAdminA, () =>
          handoffService.requestFunctionalHandoff(
            fixture.handoffAdminA,
            applicationId,
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_NOT_VERIFIED",
        }),
      );
    });

    it("R12-HANDOFF-04: adult wrong subject mode → denied", async () => {
      const { applicationId } = await setupAcceptedApplication({
        adult: true,
        applicant: fixture.applicantAAdult,
        family: fixture.familyAAdult,
        studentId: fixture.studentAdultAId,
      });

      // Alter authority to MINOR_REPRESENTATIVE
      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, (tx) =>
          tx.applicationAuthority.updateMany({
            data: {
              authorityBasis: "PARENT",
              relationship: "MOTHER",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            where: { applicationId },
          }),
        ),
      );

      await expect(
        runWithTenantContext(fixture.handoffAdminA, () =>
          handoffService.requestFunctionalHandoff(
            fixture.handoffAdminA,
            applicationId,
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "APPLICATION_AUTHORITY_MODE_INVALID",
        }),
      );
    });

    it("R12-HANDOFF-05: acceptance principal mismatch → denied", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      await createAndVerifyAuthority(
        appId,
        fixture.applicantA,
        fixture.familyA,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );

      const capacityId = randomUUID();
      const reservationId = randomUUID();
      const offerId = randomUUID();
      const offerVersionId = randomUUID();

      await runWithTenantContext(fixture.adminReviewerA, () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.application.update({
            data: { status: "SUBMITTED", submittedAt: BASE_NOW },
            where: { id: appId },
          });
          const cap = await tx.admissionCapacity.upsert({
            create: {
              configuredCapacity: 30,
              id: capacityId,
              offerValidityBusinessDays: 3,
              offeringId: fixture.offeringAId,
              tenantId: fixture.tenantA,
            },
            update: {},
            where: {
              tenantId_offeringId: {
                offeringId: fixture.offeringAId,
                tenantId: fixture.tenantA,
              },
            },
          });
          await tx.seatReservation.create({
            data: {
              applicationId: appId,
              capacityId: cap.id,
              id: reservationId,
              offeringId: fixture.offeringAId,
              reservedAt: BASE_NOW,
              state: "ACTIVE",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOffer.create({
            data: {
              applicationId: appId,
              id: offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              tenantId: fixture.tenantA,
            },
          });
          await tx.admissionOfferVersion.create({
            data: {
              applicationId: appId,
              expiresAt: new Date(BASE_NOW.getTime() + 5 * 86400_000),
              id: offerVersionId,
              issuedAt: BASE_NOW,
              issuedBy: fixture.adminReviewerA.actorId,
              lifecycle: "ACCEPTED",
              offerId,
              offeringId: fixture.offeringAId,
              origin: "NORMAL",
              reservationId,
              tenantId: fixture.tenantA,
              terminalAt: BASE_NOW,
              terminalReason: "FAMILY_ACCEPTED",
              versionNumber: 1,
            },
          });
          await tx.admissionOffer.update({
            data: { currentVersionId: offerVersionId },
            where: { id: offerId },
          });
          await tx.offerAcceptance.create({
            data: {
              acceptedAt: BASE_NOW,
              actorId: fixture.userBId, // Mismatched principal
              applicationId: appId,
              offerId,
              offeringId: fixture.offeringAId,
              offerVersionId,
              reservationId,
              tenantId: fixture.tenantA,
            },
          });
        }),
      );

      await expect(
        runWithTenantContext(fixture.handoffAdminA, () =>
          handoffService.requestFunctionalHandoff(
            fixture.handoffAdminA,
            appId,
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_PRINCIPAL_MISMATCH",
        }),
      );
    });

    it("R12-HANDOFF-06: application.handoff.request remains mandatory", async () => {
      const { applicationId } = await setupAcceptedApplication({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      await expect(
        runWithTenantContext(fixture.adminReaderOnlyA, () =>
          handoffService.requestFunctionalHandoff(
            fixture.adminReaderOnlyA,
            applicationId,
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it("R12-HANDOFF-07: tenant isolation remains enforced", async () => {
      const { applicationId } = await setupAcceptedApplication({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      await expect(
        runWithTenantContext(fixture.adminStaffB, () =>
          handoffService.requestFunctionalHandoff(
            fixture.adminStaffB,
            applicationId,
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(IntakeNotFoundError);
    });

    it("R12-HANDOFF-08: source remains free of executable external EduPay/network integration", async () => {
      const { applicationId } = await setupAcceptedApplication({
        applicant: fixture.applicantA,
        family: fixture.familyA,
        studentId: fixture.studentMinorAId,
      });

      const handoff = await runWithTenantContext(fixture.handoffAdminA, () =>
        handoffService.requestFunctionalHandoff(
          fixture.handoffAdminA,
          applicationId,
          BASE_NOW,
        ),
      );
      // IntegrationHandoff record is created locally, pure database state transition
      expect(handoff.id).toBeDefined();
      expect(handoff.status).toBe("REQUESTED");
    });
  });

  // =========================================================================
  // 10. EVIDENCE DIRECT TESTS
  // =========================================================================
  describe("10. Evidence Direct Tests", () => {
    it("proves clean READY_FOR_REVIEW same-application DocumentVersion can link", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "LEGAL_REPRESENTATIVE",
              relationship: "OTHER_RELATIVE",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando tutor",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );

      const validDocId = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "CLEAN",
        technicalStatus: "READY_FOR_REVIEW",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });

      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            evidenceDocumentVersionIds: [validDocId],
            expectedConcurrencyVersion: ur.concurrencyVersion!,
            reason: "Verificado con sentencia de tutela",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );
      expect(verified.status).toBe("VERIFIED");
      expect(verified.evidence.map((e) => e.documentVersionId)).toContain(
        validDocId,
      );
    });

    it("rejects another application's DocumentVersion", async () => {
      const appId1 = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const student2 = await prisma.student.create({
        data: {
          dateOfBirth: new Date("2012-05-10T00:00:00.000Z"),
          familyProfileId: (
            await prisma.familyProfile.findFirstOrThrow({
              where: { userId: fixture.userAId },
            })
          ).id,
          familyName: "Segundo",
          givenName: "Hijo",
        },
      });
      const appId2 = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        student2.id,
        fixture.offeringAId,
      );

      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId1,
            {
              authorityBasis: "LEGAL_REPRESENTATIVE",
              relationship: "OTHER_RELATIVE",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId1,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );

      const docForApp2 = await createDocumentVersionFixture({
        applicationId: appId2,
        scanStatus: "CLEAN",
        technicalStatus: "READY_FOR_REVIEW",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });

      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId1,
            {
              evidenceDocumentVersionIds: [docForApp2],
              expectedConcurrencyVersion: ur.concurrencyVersion!,
              reason: "Intentando vincular doc de otra app",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_INVALID",
        }),
      );
    });

    it("rejects another tenant's DocumentVersion", async () => {
      const appIdA = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const appIdB = await createDraftApplication(
        fixture.applicantB,
        fixture.familyB,
        fixture.studentMinorBId,
        fixture.offeringBId,
      );

      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appIdA,
            {
              authorityBasis: "LEGAL_REPRESENTATIVE",
              relationship: "OTHER_RELATIVE",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appIdA,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );

      const docTenantB = await createDocumentVersionFixture({
        applicationId: appIdB,
        scanStatus: "CLEAN",
        technicalStatus: "READY_FOR_REVIEW",
        tenantId: fixture.tenantB,
        uploaderUserId: fixture.userBId,
      });

      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appIdA,
            {
              evidenceDocumentVersionIds: [docTenantB],
              expectedConcurrencyVersion: ur.concurrencyVersion!,
              reason: "Doc de tenant B",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_INVALID",
        }),
      );
    });

    it("rejects QUARANTINED, BLOCKED_INVALID, INFECTED, and UNSCANNABLE document versions", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "LEGAL_REPRESENTATIVE",
              relationship: "OTHER_RELATIVE",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );

      // QUARANTINED
      const quarantinedDoc = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "PENDING",
        technicalStatus: "QUARANTINED",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              evidenceDocumentVersionIds: [quarantinedDoc],
              expectedConcurrencyVersion: ur.concurrencyVersion!,
              reason: "Quarantined doc",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_INVALID",
        }),
      );

      // BLOCKED_INVALID
      const blockedDoc = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "CLEAN",
        technicalStatus: "BLOCKED_INVALID",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              evidenceDocumentVersionIds: [blockedDoc],
              expectedConcurrencyVersion: ur.concurrencyVersion!,
              reason: "Blocked doc",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_INVALID",
        }),
      );

      // INFECTED
      const infectedDoc = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "INFECTED",
        technicalStatus: "QUARANTINED",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              evidenceDocumentVersionIds: [infectedDoc],
              expectedConcurrencyVersion: ur.concurrencyVersion!,
              reason: "Infected doc",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_INVALID",
        }),
      );

      // UNSCANNABLE
      const unscannableDoc = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "UNSCANNABLE",
        technicalStatus: "BLOCKED_INVALID",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });
      await expect(
        runWithTenantContext(fixture.adminReviewerA, () =>
          authorities.reviewApplicationAuthority(
            fixture.adminReviewerA,
            appId,
            {
              evidenceDocumentVersionIds: [unscannableDoc],
              expectedConcurrencyVersion: ur.concurrencyVersion!,
              reason: "Unscannable doc",
              toStatus: "VERIFIED",
            },
            BASE_NOW,
          ),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "AUTHORITY_EVIDENCE_INVALID",
        }),
      );
    });

    it("duplicate evidence link is idempotent or deterministically handled", async () => {
      const appId = await createDraftApplication(
        fixture.applicantA,
        fixture.familyA,
        fixture.studentMinorAId,
        fixture.offeringAId,
      );
      const dec = await runWithFamilyContext(fixture.familyA, () =>
        runWithTenantContext(fixture.applicantA, () =>
          authorities.declareApplicationAuthority(
            fixture.familyA,
            fixture.applicantA,
            appId,
            {
              authorityBasis: "LEGAL_REPRESENTATIVE",
              relationship: "OTHER_RELATIVE",
              subjectMode: "MINOR_REPRESENTATIVE",
            },
            BASE_NOW,
          ),
        ),
      );
      const ur = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            expectedConcurrencyVersion: dec.concurrencyVersion!,
            reason: "Revisando",
            toStatus: "UNDER_REVIEW",
          },
          BASE_NOW,
        ),
      );

      const validDocId = await createDocumentVersionFixture({
        applicationId: appId,
        scanStatus: "CLEAN",
        technicalStatus: "READY_FOR_REVIEW",
        tenantId: fixture.tenantA,
        uploaderUserId: fixture.userAId,
      });

      // Pass same doc ID multiple times in array
      const verified = await runWithTenantContext(fixture.adminReviewerA, () =>
        authorities.reviewApplicationAuthority(
          fixture.adminReviewerA,
          appId,
          {
            evidenceDocumentVersionIds: [validDocId, validDocId],
            expectedConcurrencyVersion: ur.concurrencyVersion!,
            reason: "Verificando con evidencia duplicada en input",
            toStatus: "VERIFIED",
          },
          BASE_NOW,
        ),
      );

      expect(verified.status).toBe("VERIFIED");
      expect(verified.evidence).toHaveLength(1);
    });
  });
});

function adminReviewerACtx(f: AuthorityFixture): TenantExecutionContext {
  return f.adminReviewerA;
}
