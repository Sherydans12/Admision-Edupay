import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRequiredEnvironment } from "./environment.js";
import { DevelopmentBusinessCalendar, DocumentService } from "./documents.js";
import { FormService } from "./forms.js";
import {
  InMemoryObjectStorage,
  SyntheticDevelopmentMalwareScanner,
} from "./operational-adapters.js";
import {
  DOCUMENT_CLASSIFICATIONS,
  PERMISSIONS,
  PROCESSING_CATEGORIES,
  type ProcessingCategoryValue,
  type Sensitivity,
} from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  SensitiveProcessingService,
  isCategoryEffectivelyEnabled,
} from "./sensitive-processing.js";
import { ApplicationAuthorityService } from "./application-authority.js";
import { AssistanceService } from "./assistance.js";
import { IntakeService } from "./intake.js";
import {
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

function createDocService() {
  return new DocumentService(
    prisma,
    new InMemoryObjectStorage(),
    new SyntheticDevelopmentMalwareScanner("test"),
    20 * 1024 * 1024,
    new DevelopmentBusinessCalendar(),
  );
}

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 4,
});

const tenantAId = randomUUID();
const tenantBId = randomUUID();
const actorA = randomUUID();

function ctx(
  tenantId: string,
  permissions: readonly string[],
): TenantExecutionContext {
  return {
    actorId: actorA,
    capabilities: permissions,
    contextOrigin: "synthetic_test",
    correlationId: `r4-${randomUUID()}`,
    purpose: "g5-pc1-r4-test",
    source: "trusted_job",
    tenantId,
  };
}

const adminCtx = (tenantId = tenantAId) =>
  ctx(tenantId, [
    PERMISSIONS.ADMISSION_CONFIG_READ,
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
    PERMISSIONS.FORM_MANAGE,
    PERMISSIONS.FORM_PUBLISH,
    PERMISSIONS.FORM_READ,
    PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE,
    PERMISSIONS.DOCUMENT_REQUIREMENT_PUBLISH,
    PERMISSIONS.DOCUMENT_REQUIREMENT_READ,
  ]);

const readCtx = (tenantId = tenantAId) =>
  ctx(tenantId, [PERMISSIONS.ADMISSION_CONFIG_READ]);

beforeAll(async () => {
  await migrationPool.query(
    `TRUNCATE TABLE
      sensitive_processing_policies, audit_events,
      application_authority_evidence, application_authority_reviews,
      application_authorities, document_reviews, document_versions,
      document_submissions, document_requirement_versions,
      document_requirements, application_draft_answers,
      application_snapshots, form_fields, form_sections,
      form_versions, form_definitions, application_withdrawals,
      integration_handoffs, offer_acceptances, admission_offer_versions,
      admission_offers, waitlist_entries, seat_reservations,
      admission_capacity_adjustments, admission_capacities,
      direction_decision_versions, direction_decisions,
      admission_recommendation_versions, admission_recommendations,
      activity_results, activity_attempts, activity_reschedule_requests,
      activity_appointments, application_activities,
      activity_definition_versions, activity_definitions,
      communications, communication_attempts, operational_tasks,
      manual_contacts, assistance_sessions, applications,
      admission_offerings, admission_processes, course_levels,
      academic_years, campuses, students, family_profiles,
      outbox_messages, role_assignments, memberships,
      support_elevations, tenants, platform_sessions,
      account_verification_challenges, platform_users
      CASCADE`,
  );
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, status)
     VALUES ($1, 'r4-test@example.com', 'ACTIVE')`,
    [actorA],
  );
  await migrationPool.query(
    `INSERT INTO tenants (id, name) VALUES ($1, 'R4-A'), ($2, 'R4-B')`,
    [tenantAId, tenantBId],
  );
});

afterAll(async () => {
  try {
    await migrationPool.query(`DELETE FROM sensitive_processing_policies`);
    await migrationPool.query(`DELETE FROM platform_users WHERE id = $1`, [
      actorA,
    ]);
  } catch {
    // Cleanup is best-effort; rows may already be cleaned by other suites
  }
  await migrationPool.end();
});

// ─── Classification ──────────────────────────────────────────────────────────

describe("R4-CAT — Classification persistence", () => {
  const categories: ProcessingCategoryValue[] = [
    PROCESSING_CATEGORIES.ORDINARY_ADMISSION,
    PROCESSING_CATEGORIES.SUPPORT_ACCOMMODATION,
    PROCESSING_CATEGORIES.PIE_NEE_DIAGNOSTIC,
    PROCESSING_CATEGORIES.HEALTH,
  ];

  for (const category of categories) {
    it(`R4-CAT: ${category} persists on form field`, async () => {
      const c = adminCtx();
      const def = await runWithTenantContext(c, () =>
        new FormService(prisma).createDefinition(c, {
          name: `R4-cat-${category}`,
          purpose: "admission",
        }),
      );
      const ver = await runWithTenantContext(c, () =>
        new FormService(prisma).createDraftVersion(c, def.id),
      );
      const sec = await runWithTenantContext(c, () =>
        new FormService(prisma).createSection(c, ver.id, {
          order: 1,
          title: "Section",
        }),
      );
      const field = await runWithTenantContext(c, () =>
        new FormService(prisma).createField(c, ver.id, {
          key: `f_${category.toLowerCase()}`,
          label: category,
          order: 1,
          processingCategory: category,
          purpose: "test",
          required: false,
          sectionId: sec.id,
          sensitivity: "internal" as const,
          type: "TEXT",
        }),
      );
      expect(field.processingCategory).toBe(category);
    });
  }

  it("R4-CAT-05: sensitivity and processing category remain independent", async () => {
    const c = adminCtx();
    const forms = new FormService(prisma);
    const def = await runWithTenantContext(c, () =>
      forms.createDefinition(c, {
        name: "R4-independent",
        purpose: "admission",
      }),
    );
    const ver = await runWithTenantContext(c, () =>
      forms.createDraftVersion(c, def.id),
    );
    const sec = await runWithTenantContext(c, () =>
      forms.createSection(c, ver.id, { order: 1, title: "S" }),
    );
    const field = await runWithTenantContext(c, () =>
      forms.createField(c, ver.id, {
        key: "restricted_ordinary",
        label: "Restricted ordinary",
        order: 1,
        processingCategory: "ORDINARY_ADMISSION",
        purpose: "test",
        required: false,
        sectionId: sec.id,
        sensitivity: "restricted" as const,
        type: "TEXT",
      }),
    );
    expect(field.sensitivity).toBe("restricted");
    expect(field.processingCategory).toBe("ORDINARY_ADMISSION");
  });
});

// ─── Default policy ──────────────────────────────────────────────────────────

describe("R4-POL — Default policy", () => {
  it("R4-POL-01/02: ordinary and support enabled by default", () => {
    expect(isCategoryEffectivelyEnabled("ORDINARY_ADMISSION", [])).toBe(true);
    expect(isCategoryEffectivelyEnabled("SUPPORT_ACCOMMODATION", [])).toBe(
      true,
    );
  });

  it("R4-POL-03/04: PIE and HEALTH disabled by default", () => {
    expect(isCategoryEffectivelyEnabled("PIE_NEE_DIAGNOSTIC", [])).toBe(false);
    expect(isCategoryEffectivelyEnabled("HEALTH", [])).toBe(false);
  });

  it("R4-POL-05: missing sensitive policy is disabled / fail closed", async () => {
    const c = readCtx();
    const sp = new SensitiveProcessingService(prisma);
    const policies = await runWithTenantContext(c, () =>
      sp.readEffectivePolicies(c),
    );
    const pie = policies.find((p) => p.category === "PIE_NEE_DIAGNOSTIC");
    const health = policies.find((p) => p.category === "HEALTH");
    expect(pie?.enabled).toBe(false);
    expect(health?.enabled).toBe(false);
  });
});

// ─── Builder publication guards ──────────────────────────────────────────────

describe("R4-PUB — Builder publication guards", () => {
  async function createPublishableForm(
    sensitivity: string,
    processingCategory: ProcessingCategoryValue | null,
  ) {
    const c = adminCtx();
    const forms = new FormService(prisma);
    const def = await runWithTenantContext(c, () =>
      forms.createDefinition(c, {
        name: `R4-pub-${randomUUID()}`,
        purpose: "admission",
      }),
    );
    const ver = await runWithTenantContext(c, () =>
      forms.createDraftVersion(c, def.id),
    );
    const sec = await runWithTenantContext(c, () =>
      forms.createSection(c, ver.id, { order: 1, title: "S" }),
    );
    await runWithTenantContext(c, () =>
      forms.createField(c, ver.id, {
        key: "field1",
        label: "Field 1",
        order: 1,
        processingCategory,
        purpose: "test",
        required: false,
        sectionId: sec.id,
        sensitivity: sensitivity as Sensitivity,
        type: "TEXT",
      }),
    );
    return { c, forms, versionId: ver.id };
  }

  it("R4-PUB-01: ordinary valid field publishes", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "internal",
      "ORDINARY_ADMISSION",
    );
    const result = await runWithTenantContext(c, () =>
      forms.publishVersion(c, versionId),
    );
    expect(result.lifecycle).toBe("PUBLISHED");
  });

  it("R4-PUB-02: support valid field publishes", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      "SUPPORT_ACCOMMODATION",
    );
    const result = await runWithTenantContext(c, () =>
      forms.publishVersion(c, versionId),
    );
    expect(result.lifecycle).toBe("PUBLISHED");
  });

  it("R4-PUB-03: HEALTH disabled → publish denied", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      "HEALTH",
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, versionId)),
    ).rejects.toThrow(/HEALTH.*disabled/i);
  });

  it("R4-PUB-04: PIE disabled → publish denied", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      "PIE_NEE_DIAGNOSTIC",
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, versionId)),
    ).rejects.toThrow(/PIE_NEE_DIAGNOSTIC.*disabled/i);
  });

  it("R4-PUB-05: HIGHLY_RESTRICTED without semantic category → deny", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      null,
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, versionId)),
    ).rejects.toThrow(/processing category/i);
  });

  it("R4-PUB-07: backend rejects bypass even with non-HIGHLY sensitivity", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "restricted",
      null,
    );
    // non-HIGHLY_RESTRICTED + null category → allowed (category only required for HIGHLY_RESTRICTED)
    const result = await runWithTenantContext(c, () =>
      forms.publishVersion(c, versionId),
    );
    expect(result.lifecycle).toBe("PUBLISHED");
  });
});

// ─── Policy update + audit ───────────────────────────────────────────────────

describe("R4-POL-UPD — Policy update and audit", () => {
  it("R4-SEC-01: actor without capability denied", async () => {
    const c = ctx(tenantAId, [PERMISSIONS.ADMISSION_CONFIG_READ]);
    const sp = new SensitiveProcessingService(prisma);
    await expect(
      runWithTenantContext(c, () =>
        sp.updatePolicy(c, {
          category: "HEALTH",
          enabled: true,
          purpose: "test",
        }),
      ),
    ).rejects.toThrow();
  });

  it("R4-AUD-01: enable HEALTH produces policy change with audit", async () => {
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    const policy = await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "HEALTH",
        enabled: true,
        purpose: "R4 audit test",
      }),
    );
    expect(policy.enabled).toBe(true);
    expect(policy.category).toBe("HEALTH");
    expect(policy.activatedBy).toBe(actorA);
    expect(policy.activatedAt).not.toBeNull();
  });

  it("R4-AUD-02: disable HEALTH produces policy change", async () => {
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    const policy = await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
    expect(policy.enabled).toBe(false);
  });
});

// ─── Authority & Sensitive Capture Integration ───────────────────────────────

async function createSensitiveApplicationFixture(options?: {
  enableHealth?: boolean;
  enablePie?: boolean;
  healthPurpose?: string;
  piePurpose?: string;
  studentDob?: Date;
  tenantId?: `${string}-${string}-${string}-${string}-${string}`;
}) {
  const tenantId = options?.tenantId ?? tenantAId;
  const admin = adminCtx(tenantId);
  const sp = new SensitiveProcessingService(prisma);
  const forms = new FormService(prisma);
  const authorities = new ApplicationAuthorityService(prisma);
  const intake = new IntakeService(prisma);

  if (options?.enableHealth) {
    await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "HEALTH",
        enabled: true,
        purpose: options.healthPurpose ?? "Valid health purpose",
      }),
    );
  }
  if (options?.enablePie) {
    await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "PIE_NEE_DIAGNOSTIC",
        enabled: true,
        purpose: options.piePurpose ?? "Valid pie purpose",
      }),
    );
  }

  const userId = randomUUID();
  const familyProfileId = randomUUID();
  const studentId = randomUUID();
  const dob = options?.studentDob ?? new Date("2015-05-10");

  await prisma.platformUser.create({
    data: {
      emailNormalized: `fam-${userId}@example.invalid`,
      emailVerifiedAt: new Date(),
      id: userId,
    },
  });

  await prisma.familyProfile.create({
    data: {
      displayName: "Familia Perez",
      id: familyProfileId,
      userId,
    },
  });

  await prisma.student.create({
    data: {
      dateOfBirth: dob,
      familyProfileId,
      familyName: "Perez",
      givenName: "Juan",
      id: studentId,
    },
  });

  const { campus, level, process, year } = await runWithTenantContext(
    admin,
    () =>
      withTenantTransaction(prisma, async (tx) => {
        const cmp = await tx.campus.create({
          data: {
            code: `CMP-${randomUUID().slice(0, 6)}`,
            name: "Campus Test",
            tenantId,
          },
        });
        const yr = await tx.academicYear.create({
          data: {
            code: `YR-${randomUUID().slice(0, 6)}`,
            label: "2026",
            status: "OPEN",
            tenantId,
          },
        });
        const lvl = await tx.courseLevel.create({
          data: {
            code: `LVL-${randomUUID().slice(0, 6)}`,
            name: "Level 1",
            tenantId,
          },
        });
        const prc = await tx.admissionProcess.create({
          data: {
            academicYearId: yr.id,
            code: `PRC-${randomUUID().slice(0, 6)}`,
            name: "Process 2026",
            status: "PUBLISHED",
            tenantId,
          },
        });
        return { campus: cmp, level: lvl, process: prc, year: yr };
      }),
  );

  const formDef = await runWithTenantContext(admin, () =>
    forms.createDefinition(admin, {
      name: `Form-${randomUUID()}`,
      purpose: "admission",
    }),
  );
  const formVer = await runWithTenantContext(admin, () =>
    forms.createDraftVersion(admin, formDef.id),
  );
  const section = await runWithTenantContext(admin, () =>
    forms.createSection(admin, formVer.id, {
      order: 1,
      title: "Datos Médicos",
    }),
  );
  const healthField = await runWithTenantContext(admin, () =>
    forms.createField(admin, formVer.id, {
      key: "health_allergies",
      label: "Alergias",
      order: 1,
      processingCategory: "HEALTH",
      purpose: "medical_records",
      required: false,
      sectionId: section.id,
      sensitivity: "highly_restricted",
      type: "TEXT",
    }),
  );
  const pieField = await runWithTenantContext(admin, () =>
    forms.createField(admin, formVer.id, {
      key: "pie_nee",
      label: "Diagnóstico PIE",
      order: 2,
      processingCategory: "PIE_NEE_DIAGNOSTIC",
      purpose: "pie_support",
      required: false,
      sectionId: section.id,
      sensitivity: "highly_restricted",
      type: "TEXT",
    }),
  );
  const ordinaryField = await runWithTenantContext(admin, () =>
    forms.createField(admin, formVer.id, {
      key: "ordinary_comments",
      label: "Comentarios",
      order: 3,
      processingCategory: "ORDINARY_ADMISSION",
      purpose: "general_info",
      required: false,
      sectionId: section.id,
      sensitivity: "internal",
      type: "TEXT",
    }),
  );

  // If health or pie were disabled, temporarily enable to publish form version
  if (!options?.enableHealth) {
    await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "HEALTH",
        enabled: true,
        purpose: "Publish enable",
      }),
    );
  }
  if (!options?.enablePie) {
    await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "PIE_NEE_DIAGNOSTIC",
        enabled: true,
        purpose: "Publish enable",
      }),
    );
  }
  await runWithTenantContext(admin, () =>
    forms.publishVersion(admin, formVer.id),
  );
  if (!options?.enableHealth) {
    await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
  }
  if (!options?.enablePie) {
    await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "PIE_NEE_DIAGNOSTIC",
        enabled: false,
        purpose: null,
      }),
    );
  }

  const offering = await runWithTenantContext(admin, () =>
    withTenantTransaction(prisma, async (tx) => {
      const createdOffering = await tx.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: campus.id,
          code: `OFF-${randomUUID().slice(0, 6)}`,
          courseLevelId: level.id,
          formVersionId: formVer.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId,
          title: "Offering 2026",
        },
      });
      await tx.admissionCapacity.create({
        data: {
          configuredCapacity: 10,
          offeringId: createdOffering.id,
          tenantId,
        },
      });
      return createdOffering;
    }),
  );

  const familyCtx: FamilyExecutionContext = {
    actorId: userId,
    contextOrigin: "synthetic_test",
    correlationId: `fam-${randomUUID()}`,
    familyCapabilities: [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_WRITE,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.FAMILY_PROFILE_READ,
      PERMISSIONS.FAMILY_PROFILE_WRITE,
      PERMISSIONS.STUDENT_READ,
      PERMISSIONS.STUDENT_WRITE,
    ],
    purpose: "family_admission",
    source: "authenticated_request",
  };

  const publicApplicantCtx: TenantExecutionContext = {
    actorId: userId,
    capabilities: [
      PERMISSIONS.OFFERING_PUBLIC_READ,
      PERMISSIONS.APPLICATION_CREATE,
    ],
    contextOrigin: "public_admission",
    correlationId: `pub-${randomUUID()}`,
    purpose: "family_admission",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };

  const applicantCtx: TenantExecutionContext = {
    actorId: userId,
    capabilities: [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_WRITE,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
    ],
    contextOrigin: "family_application",
    correlationId: `app-${randomUUID()}`,
    purpose: "family_admission",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };

  const application = await runWithFamilyContext(familyCtx, () =>
    runWithTenantContext(publicApplicantCtx, () =>
      intake.createApplicationDraft(familyCtx, publicApplicantCtx, {
        offeringId: offering.id,
        studentId,
      }),
    ),
  );

  return {
    admin,
    applicantCtx,
    application,
    authorities,
    dob,
    familyCtx,
    familyProfileId,
    forms,
    healthField,
    offering,
    ordinaryField,
    pieField,
    sp,
    studentId,
    tenantId,
    userId,
  };
}

async function verifyAuthority(
  fixture: Awaited<ReturnType<typeof createSensitiveApplicationFixture>>,
  options?: {
    basis?: "PARENT" | "LEGAL_REPRESENTATIVE";
    mode?: "MINOR_REPRESENTATIVE" | "ADULT_STUDENT_SELF";
    relationship?: "MOTHER" | "FATHER" | "SELF";
  },
) {
  const staffCtx = ctx(fixture.tenantId, [
    PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
  ]);
  const isAdult = options?.mode === "ADULT_STUDENT_SELF";
  const declared = await runWithFamilyContext(fixture.familyCtx, () =>
    runWithTenantContext(fixture.applicantCtx, () =>
      fixture.authorities.declareApplicationAuthority(
        fixture.familyCtx,
        fixture.applicantCtx,
        fixture.application.id,
        {
          authorityBasis: isAdult ? "SELF" : (options?.basis ?? "PARENT"),
          relationship: isAdult ? "SELF" : (options?.relationship ?? "MOTHER"),
          subjectMode: options?.mode ?? "MINOR_REPRESENTATIVE",
        },
        new Date(),
      ),
    ),
  );

  await runWithTenantContext(staffCtx, () =>
    fixture.authorities.reviewApplicationAuthority(
      staffCtx,
      fixture.application.id,
      {
        expectedConcurrencyVersion: declared.concurrencyVersion!,
        reason: "Reviewing for test",
        toStatus: "UNDER_REVIEW",
      },
      new Date(),
    ),
  );

  const underReview = await runWithTenantContext(staffCtx, () =>
    fixture.authorities.getStaffAuthority(staffCtx, fixture.application.id),
  );

  const verified = await runWithTenantContext(staffCtx, () =>
    fixture.authorities.reviewApplicationAuthority(
      staffCtx,
      fixture.application.id,
      {
        expectedConcurrencyVersion: underReview.concurrencyVersion!,
        reason: "Verified for test",
        toStatus: "VERIFIED",
      },
      new Date(),
    ),
  );

  return verified;
}

describe("R4-AUTH — Direct Sensitive Capture Authority Guards", () => {
  it("R4-AUTH-01: email verified but no VERIFIED authority → saving HEALTH answer denied", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    await expect(
      runWithFamilyContext(fixture.familyCtx, () =>
        runWithTenantContext(fixture.applicantCtx, () =>
          fixture.forms.saveAnswers(
            fixture.familyCtx,
            fixture.applicantCtx,
            fixture.application.id,
            [{ fieldId: fixture.healthField.id, value: "Asma leve" }],
          ),
        ),
      ),
    ).rejects.toThrow();

    const answers = await prisma.applicationDraftAnswer.findMany({
      where: {
        applicationId: fixture.application.id,
        fieldId: fixture.healthField.id,
      },
    });
    expect(answers).toHaveLength(0);
  });

  it("R4-AUTH-02: DECLARED authority → sensitive save denied", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.authorities.declareApplicationAuthority(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
          {
            authorityBasis: "PARENT",
            relationship: "MOTHER",
            subjectMode: "MINOR_REPRESENTATIVE",
          },
          new Date(),
        ),
      ),
    );

    await expect(
      runWithFamilyContext(fixture.familyCtx, () =>
        runWithTenantContext(fixture.applicantCtx, () =>
          fixture.forms.saveAnswers(
            fixture.familyCtx,
            fixture.applicantCtx,
            fixture.application.id,
            [{ fieldId: fixture.healthField.id, value: "Alergia penicilina" }],
          ),
        ),
      ),
    ).rejects.toThrow();

    const answers = await prisma.applicationDraftAnswer.findMany({
      where: {
        applicationId: fixture.application.id,
        fieldId: fixture.healthField.id,
      },
    });
    expect(answers).toHaveLength(0);
  });

  it("R4-AUTH-03: VERIFIED authority + category disabled → sensitive save denied", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: false,
    });
    await verifyAuthority(fixture);

    await expect(
      runWithFamilyContext(fixture.familyCtx, () =>
        runWithTenantContext(fixture.applicantCtx, () =>
          fixture.forms.saveAnswers(
            fixture.familyCtx,
            fixture.applicantCtx,
            fixture.application.id,
            [{ fieldId: fixture.healthField.id, value: "Alergia polen" }],
          ),
        ),
      ),
    ).rejects.toThrow(/disabled/i);

    const answers = await prisma.applicationDraftAnswer.findMany({
      where: {
        applicationId: fixture.application.id,
        fieldId: fixture.healthField.id,
      },
    });
    expect(answers).toHaveLength(0);
  });

  it("R4-AUTH-04: VERIFIED authority + category enabled → sensitive answer persists successfully", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    await verifyAuthority(fixture);

    const saved = await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.forms.saveAnswers(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
          [
            {
              fieldId: fixture.healthField.id,
              value: "Sin alergias conocidas",
            },
          ],
        ),
      ),
    );

    expect(
      saved.answers.find((a) => a.fieldId === fixture.healthField.id)?.value,
    ).toBe("Sin alergias conocidas");

    const reloaded = await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.forms.getFamilyForm(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
        ),
      ),
    );
    expect(
      reloaded.answers.find((a) => a.fieldId === fixture.healthField.id)?.value,
    ).toBe("Sin alergias conocidas");
  });

  it("R4-AUTH-05: adult >=18 VERIFIED SELF → sensitive save succeeds when category enabled", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
      studentDob: new Date("2000-01-01"),
    });
    await verifyAuthority(fixture, { mode: "ADULT_STUDENT_SELF" });

    const saved = await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.forms.saveAnswers(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
          [
            {
              fieldId: fixture.healthField.id,
              value: "Tratamiento activo adulto",
            },
          ],
        ),
      ),
    );

    expect(
      saved.answers.find((a) => a.fieldId === fixture.healthField.id)?.value,
    ).toBe("Tratamiento activo adulto");

    const reloaded = await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.forms.getFamilyForm(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
        ),
      ),
    );
    expect(
      reloaded.answers.find((a) => a.fieldId === fixture.healthField.id)?.value,
    ).toBe("Tratamiento activo adulto");
  });

  it("R4-AUTH-06: authority belonging to another application cannot authorize sensitive save", async () => {
    const fixture1 = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    const fixture2 = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    await verifyAuthority(fixture1);

    await expect(
      runWithFamilyContext(fixture2.familyCtx, () =>
        runWithTenantContext(fixture2.applicantCtx, () =>
          fixture2.forms.saveAnswers(
            fixture2.familyCtx,
            fixture2.applicantCtx,
            fixture2.application.id,
            [{ fieldId: fixture2.healthField.id, value: "Dato no autorizado" }],
          ),
        ),
      ),
    ).rejects.toThrow();
  });

  it("R4-AUTH-07: authority from another tenant cannot authorize sensitive save", async () => {
    const fixtureA = await createSensitiveApplicationFixture({
      enableHealth: true,
      tenantId: tenantAId,
    });
    const fixtureB = await createSensitiveApplicationFixture({
      enableHealth: true,
      tenantId: tenantBId,
    });
    await verifyAuthority(fixtureA);

    await expect(
      runWithFamilyContext(fixtureB.familyCtx, () =>
        runWithTenantContext(fixtureB.applicantCtx, () =>
          fixtureB.forms.saveAnswers(
            fixtureB.familyCtx,
            fixtureB.applicantCtx,
            fixtureB.application.id,
            [{ fieldId: fixtureB.healthField.id, value: "Dato cross tenant" }],
          ),
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("R4-ASSISTED — Assisted sensitive capture guards", () => {
  it("R4-ASSISTED-01: staff operator + verified family authority allows sensitive save; staff operator alone without family authority is denied", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    const staffId = randomUUID();
    const staffCtx: TenantExecutionContext = {
      actorId: staffId,
      capabilities: [
        PERMISSIONS.APPLICATION_ASSIST,
        PERMISSIONS.APPLICATION_AUTHORITY_READ,
        PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_WRITE,
      ],
      contextOrigin: "synthetic_test",
      correlationId: `assist-${randomUUID()}`,
      purpose: "assisted_capture",
      scopes: ["*"],
      source: "authenticated_request",
      tenantId: fixture.tenantId,
    };

    // Create assisted session and application
    const assistanceService = new AssistanceService(
      prisma,
      fixture.forms,
      createDocService(),
    );
    const session = await runWithTenantContext(staffCtx, () =>
      assistanceService.startSession(staffCtx, {
        adultPresentConfirmed: true,
        authorizationConfirmed: true,
        familyProfileId: fixture.familyProfileId,
      }),
    );

    const student2Res = await migrationPool.query(
      `INSERT INTO students (id, family_profile_id, given_name, family_name, date_of_birth)
       VALUES ($1, $2, 'Hermano', 'Perez', DATE '2015-05-10') RETURNING id`,
      [randomUUID(), fixture.familyProfileId],
    );
    const student2Id = student2Res.rows[0].id as string;

    const assistedApp = await runWithTenantContext(staffCtx, () =>
      assistanceService.createAssistedApplicationDraft(staffCtx, session.id, {
        offeringId: fixture.offering.id,
        studentId: student2Id,
      }),
    );

    // Attempting to save sensitive answer without family authority is denied
    await expect(
      runWithTenantContext(staffCtx, () =>
        fixture.forms.saveAssistedAnswers(
          staffCtx,
          fixture.familyProfileId,
          session.id,
          assistedApp.id,
          [{ fieldId: fixture.healthField.id, value: "Assisted health data" }],
        ),
      ),
    ).rejects.toThrow();

    // Verify authority for the assisted application
    const declared = await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.authorities.declareApplicationAuthority(
          fixture.familyCtx,
          fixture.applicantCtx,
          assistedApp.id,
          {
            authorityBasis: "PARENT",
            relationship: "MOTHER",
            subjectMode: "MINOR_REPRESENTATIVE",
          },
          new Date(),
        ),
      ),
    );

    await runWithTenantContext(staffCtx, () =>
      fixture.authorities.reviewApplicationAuthority(
        staffCtx,
        assistedApp.id,
        {
          expectedConcurrencyVersion: declared.concurrencyVersion!,
          reason: "Verify assisted",
          toStatus: "UNDER_REVIEW",
        },
        new Date(),
      ),
    );
    const underReview = await runWithTenantContext(staffCtx, () =>
      fixture.authorities.getStaffAuthority(staffCtx, assistedApp.id),
    );
    await runWithTenantContext(staffCtx, () =>
      fixture.authorities.reviewApplicationAuthority(
        staffCtx,
        assistedApp.id,
        {
          expectedConcurrencyVersion: underReview.concurrencyVersion!,
          reason: "Verify assisted final",
          toStatus: "VERIFIED",
        },
        new Date(),
      ),
    );

    // Now saveAssistedAnswers succeeds
    const saved = await runWithTenantContext(staffCtx, () =>
      fixture.forms.saveAssistedAnswers(
        staffCtx,
        fixture.familyProfileId,
        session.id,
        assistedApp.id,
        [{ fieldId: fixture.healthField.id, value: "Assisted health data" }],
      ),
    );

    expect(
      saved.answers.find((a) => a.fieldId === fixture.healthField.id)?.value,
    ).toBe("Assisted health data");

    // Assert operator was NOT made authority principal
    const authority = await runWithTenantContext(staffCtx, () =>
      fixture.authorities.getStaffAuthority(staffCtx, assistedApp.id),
    );
    expect(authority.authorityUserId).toBe(fixture.userId);
    expect(authority.authorityUserId).not.toBe(staffId);
  });
});

describe("R4-POLICY-REGRESSION — Policy disabled after publish regression", () => {
  it("R4-REG-01: enable HEALTH → publish → draft → verify authority → disable HEALTH → saveAnswer denied fail-closed", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    await verifyAuthority(fixture);

    // Now tenant disables HEALTH policy
    await runWithTenantContext(fixture.admin, () =>
      fixture.sp.updatePolicy(fixture.admin, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );

    // Attempting to save HEALTH answer now fails-closed
    await expect(
      runWithFamilyContext(fixture.familyCtx, () =>
        runWithTenantContext(fixture.applicantCtx, () =>
          fixture.forms.saveAnswers(
            fixture.familyCtx,
            fixture.applicantCtx,
            fixture.application.id,
            [
              {
                fieldId: fixture.healthField.id,
                value: "Post-disable attempt",
              },
            ],
          ),
        ),
      ),
    ).rejects.toThrow(/disabled/i);

    const answers = await prisma.applicationDraftAnswer.findMany({
      where: {
        applicationId: fixture.application.id,
        fieldId: fixture.healthField.id,
      },
    });
    expect(answers).toHaveLength(0);
  });

  it("R4-REG-02: enable PIE → publish → draft → verify authority → disable PIE → saveAnswer denied fail-closed", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enablePie: true,
    });
    await verifyAuthority(fixture);

    // Tenant disables PIE policy
    await runWithTenantContext(fixture.admin, () =>
      fixture.sp.updatePolicy(fixture.admin, {
        category: "PIE_NEE_DIAGNOSTIC",
        enabled: false,
        purpose: null,
      }),
    );

    // Attempting to save PIE answer now fails-closed
    await expect(
      runWithFamilyContext(fixture.familyCtx, () =>
        runWithTenantContext(fixture.applicantCtx, () =>
          fixture.forms.saveAnswers(
            fixture.familyCtx,
            fixture.applicantCtx,
            fixture.application.id,
            [{ fieldId: fixture.pieField.id, value: "PIE diag post-disable" }],
          ),
        ),
      ),
    ).rejects.toThrow(/disabled/i);

    const answers = await prisma.applicationDraftAnswer.findMany({
      where: {
        applicationId: fixture.application.id,
        fieldId: fixture.pieField.id,
      },
    });
    expect(answers).toHaveLength(0);
  });
});

describe("R4-PURPOSE — Purpose validation invariants", () => {
  it("R4-PUR-01: enable HEALTH with null purpose is denied", async () => {
    const admin = adminCtx(tenantAId);
    const sp = new SensitiveProcessingService(prisma);
    await expect(
      runWithTenantContext(admin, () =>
        sp.updatePolicy(admin, {
          category: "HEALTH",
          enabled: true,
          purpose: null,
        }),
      ),
    ).rejects.toThrow(/purpose/i);
  });

  it("R4-PUR-02: enable HEALTH with empty purpose is denied", async () => {
    const admin = adminCtx(tenantAId);
    const sp = new SensitiveProcessingService(prisma);
    await expect(
      runWithTenantContext(admin, () =>
        sp.updatePolicy(admin, {
          category: "HEALTH",
          enabled: true,
          purpose: "   ",
        }),
      ),
    ).rejects.toThrow(/purpose/i);
  });

  it("R4-PUR-03: enable PIE with null purpose is denied", async () => {
    const admin = adminCtx(tenantAId);
    const sp = new SensitiveProcessingService(prisma);
    await expect(
      runWithTenantContext(admin, () =>
        sp.updatePolicy(admin, {
          category: "PIE_NEE_DIAGNOSTIC",
          enabled: true,
          purpose: null,
        }),
      ),
    ).rejects.toThrow(/purpose/i);
  });

  it("R4-PUR-04: enable HEALTH with valid purpose passes", async () => {
    const admin = adminCtx(tenantAId);
    const sp = new SensitiveProcessingService(prisma);
    const res = await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "HEALTH",
        enabled: true,
        purpose: "Valid medical purpose",
      }),
    );
    expect(res.enabled).toBe(true);
    expect(res.purpose).toBe("Valid medical purpose");
  });

  it("R4-PUR-05: disable HEALTH with null purpose passes", async () => {
    const admin = adminCtx(tenantAId);
    const sp = new SensitiveProcessingService(prisma);
    const res = await runWithTenantContext(admin, () =>
      sp.updatePolicy(admin, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
    expect(res.enabled).toBe(false);
  });
});

describe("R4-NULL-CLEAR — Clearing sensitive answers", () => {
  it("R4-CLR-01: null value clears sensitive answer even if category subsequently disabled", async () => {
    const fixture = await createSensitiveApplicationFixture({
      enableHealth: true,
    });
    await verifyAuthority(fixture);

    // Save answer while enabled
    await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.forms.saveAnswers(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
          [{ fieldId: fixture.healthField.id, value: "Alergia mariscos" }],
        ),
      ),
    );

    // Disable HEALTH category
    await runWithTenantContext(fixture.admin, () =>
      fixture.sp.updatePolicy(fixture.admin, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );

    // Clear answer with null value
    const result = await runWithFamilyContext(fixture.familyCtx, () =>
      runWithTenantContext(fixture.applicantCtx, () =>
        fixture.forms.saveAnswers(
          fixture.familyCtx,
          fixture.applicantCtx,
          fixture.application.id,
          [{ fieldId: fixture.healthField.id, value: null }],
        ),
      ),
    );

    const cleared = result.answers.find(
      (a) => a.fieldId === fixture.healthField.id,
    );
    expect(cleared).toBeUndefined();

    const inDb = await prisma.applicationDraftAnswer.findMany({
      where: {
        applicationId: fixture.application.id,
        fieldId: fixture.healthField.id,
      },
    });
    expect(inDb).toHaveLength(0);
  });
});

// ─── Personality report classification ────────────────────────────────────────

describe("R4-PER — Personality report", () => {
  it("R4-PER-01: PERSONALITY_DEVELOPMENT_REPORT distinct from HEALTH", () => {
    expect(DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT).not.toBe(
      PROCESSING_CATEGORIES.HEALTH,
    );
  });

  it("R4-PER-02: PERSONALITY_DEVELOPMENT_REPORT distinct from PIE", () => {
    expect(DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT).not.toBe(
      PROCESSING_CATEGORIES.PIE_NEE_DIAGNOSTIC,
    );
  });

  it("R4-PER-03: GENERIC is the default classification", () => {
    expect(DOCUMENT_CLASSIFICATIONS.GENERIC).toBe("GENERIC");
  });

  it("R4-PER-04: PERSONALITY_DEVELOPMENT_REPORT without narrow scope offering is rejected on publish", async () => {
    const c = adminCtx();
    const docs = createDocService();
    const req = await runWithTenantContext(c, () =>
      docs.createRequirement(c, {
        code: `R4-PER04-${randomUUID().slice(0, 8)}`,
        name: "Informe Personalidad Global",
        purpose: "Evaluacion formativa",
      }),
    );
    const draft = await runWithTenantContext(c, () =>
      docs.createRequirementVersion(c, req.id, {
        allowedFileTypes: ["PDF"],
        correctionWindowBusinessDays: 5,
        documentClassification:
          DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT,
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowsEquivalent: false,
        required: true,
        validityRule: "NONE",
        processingCategory: "ORDINARY_ADMISSION",
        sensitivity: "restricted",
      }),
    );
    // Attempting to publish without scopeOfferingId fails closed
    await expect(
      runWithTenantContext(c, () =>
        docs.publishRequirementVersion(c, draft.id),
      ),
    ).rejects.toThrow();
  });

  it("R4-PER-05: PERSONALITY_DEVELOPMENT_REPORT with valid offering scope succeeds", async () => {
    const c = adminCtx();
    const docs = createDocService();

    // Create an offering for scoping inside tenant context
    const { offeringId } = await runWithTenantContext(c, () =>
      withTenantTransaction(prisma, async (tx) => {
        const campus = await tx.campus.create({
          data: {
            code: `CAMP-${randomUUID().slice(0, 6)}`,
            name: "Campus Per",
            tenantId: tenantAId,
          },
        });
        const year = await tx.academicYear.create({
          data: {
            code: `YR-${randomUUID().slice(0, 6)}`,
            label: "2026",
            status: "OPEN",
            tenantId: tenantAId,
          },
        });
        const level = await tx.courseLevel.create({
          data: {
            code: `LVL-${randomUUID().slice(0, 6)}`,
            name: "Level",
            tenantId: tenantAId,
          },
        });
        const process = await tx.admissionProcess.create({
          data: {
            academicYearId: year.id,
            code: `PRC-${randomUUID().slice(0, 6)}`,
            name: "Process",
            status: "PUBLISHED",
            tenantId: tenantAId,
          },
        });
        const formDef = await tx.formDefinition.create({
          data: { name: "Form", purpose: "admission", tenantId: tenantAId },
        });
        const formVer = await tx.formVersion.create({
          data: {
            formDefinitionId: formDef.id,
            lifecycle: "PUBLISHED",
            publishedAt: new Date(),
            tenantId: tenantAId,
            versionNumber: 1,
          },
        });
        const offering = await tx.admissionOffering.create({
          data: {
            academicYearId: year.id,
            availabilityCategory: "LIMITED_CAPACITY",
            campusId: campus.id,
            code: `OFF-${randomUUID().slice(0, 6)}`,
            courseLevelId: level.id,
            formVersionId: formVer.id,
            processId: process.id,
            status: "PUBLISHED",
            tenantId: tenantAId,
            title: "Offering for Per Report",
          },
        });
        return { offeringId: offering.id };
      }),
    );

    const req = await runWithTenantContext(c, () =>
      docs.createRequirement(c, {
        code: `R4-PER05-${randomUUID().slice(0, 8)}`,
        name: "Informe Personalidad Acotado",
        purpose: "Evaluacion acotada",
      }),
    );
    const draft = await runWithTenantContext(c, () =>
      docs.createRequirementVersion(c, req.id, {
        allowedFileTypes: ["PDF"],
        correctionWindowBusinessDays: 5,
        documentClassification:
          DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT,
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowsEquivalent: false,
        required: true,
        validityRule: "NONE",
        processingCategory: "ORDINARY_ADMISSION",
        scope: { offeringId },
        sensitivity: "restricted",
      }),
    );
    const published = await runWithTenantContext(c, () =>
      docs.publishRequirementVersion(c, draft.id),
    );
    expect(published.lifecycle).toBe("PUBLISHED");
  });

  it("R4-PER-06: PERSONALITY_DEVELOPMENT_REPORT with cross-tenant offering scope fails", async () => {
    const cA = adminCtx(tenantAId);
    const docs = createDocService();

    const req = await runWithTenantContext(cA, () =>
      docs.createRequirement(cA, {
        code: `R4-PER06-${randomUUID().slice(0, 8)}`,
        name: "Informe Personalidad Cross",
        purpose: "Evaluacion cross",
      }),
    );
    await expect(
      runWithTenantContext(cA, () =>
        docs.createRequirementVersion(cA, req.id, {
          allowedFileTypes: ["PDF"],
          allowsEquivalent: false,
          correctionWindowBusinessDays: 5,
          documentClassification:
            DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT,
          maxFileSizeBytes: 5 * 1024 * 1024,
          processingCategory: "ORDINARY_ADMISSION",
          required: true,
          scope: { offeringId: randomUUID() }, // Nonexistent or cross-tenant offering
          sensitivity: "restricted",
          validityRule: "NONE",
        }),
      ),
    ).rejects.toThrow();
  });
});

// ─── Documents sensitive processing guards ────────────────────────────────────

describe("R4-DOC — Document sensitive processing guards", () => {
  it("R4-DOC-01: Document Requirement with HEALTH disabled is denied on publish", async () => {
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
    const docs = createDocService();
    const req = await runWithTenantContext(c, () =>
      docs.createRequirement(c, {
        code: `R4-DOC01-${randomUUID().slice(0, 8)}`,
        name: "Certificado Médico",
        purpose: "Salud",
      }),
    );
    const draft = await runWithTenantContext(c, () =>
      docs.createRequirementVersion(c, req.id, {
        allowedFileTypes: ["PDF"],
        correctionWindowBusinessDays: 5,
        documentClassification: "GENERIC",
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowsEquivalent: false,
        required: true,
        validityRule: "NONE",
        processingCategory: "HEALTH",
        sensitivity: "highly_restricted",
      }),
    );
    await expect(
      runWithTenantContext(c, () =>
        docs.publishRequirementVersion(c, draft.id),
      ),
    ).rejects.toThrow(/HEALTH.*disabled/i);
  });

  it("R4-DOC-02: Document Requirement with PIE_NEE_DIAGNOSTIC disabled is denied on publish", async () => {
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "PIE_NEE_DIAGNOSTIC",
        enabled: false,
        purpose: null,
      }),
    );
    const docs = createDocService();
    const req = await runWithTenantContext(c, () =>
      docs.createRequirement(c, {
        code: `R4-DOC02-${randomUUID().slice(0, 8)}`,
        name: "Informe PIE Diagnóstico",
        purpose: "PIE",
      }),
    );
    const draft = await runWithTenantContext(c, () =>
      docs.createRequirementVersion(c, req.id, {
        allowedFileTypes: ["PDF"],
        correctionWindowBusinessDays: 5,
        documentClassification: "GENERIC",
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowsEquivalent: false,
        required: true,
        validityRule: "NONE",
        processingCategory: "PIE_NEE_DIAGNOSTIC",
        sensitivity: "highly_restricted",
      }),
    );
    await expect(
      runWithTenantContext(c, () =>
        docs.publishRequirementVersion(c, draft.id),
      ),
    ).rejects.toThrow(/PIE_NEE_DIAGNOSTIC.*disabled/i);
  });

  it("R4-DOC-03: Document Requirement with HIGHLY_RESTRICTED sensitivity without processingCategory is denied on publish", async () => {
    const c = adminCtx();
    const docs = createDocService();
    const req = await runWithTenantContext(c, () =>
      docs.createRequirement(c, {
        code: `R4-DOC03-${randomUUID().slice(0, 8)}`,
        name: "Doc Crítico Sin Categoría",
        purpose: "Critico",
      }),
    );
    const draft = await runWithTenantContext(c, () =>
      docs.createRequirementVersion(c, req.id, {
        allowedFileTypes: ["PDF"],
        correctionWindowBusinessDays: 5,
        documentClassification: "GENERIC",
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowsEquivalent: false,
        required: true,
        validityRule: "NONE",
        processingCategory: null,
        sensitivity: "highly_restricted",
      }),
    );
    await expect(
      runWithTenantContext(c, () =>
        docs.publishRequirementVersion(c, draft.id),
      ),
    ).rejects.toThrow(/processing category/i);
  });

  it("R4-DOC-04: Document Requirement with SUPPORT_ACCOMMODATION category is allowed on publish", async () => {
    const c = adminCtx();
    const docs = createDocService();
    const req = await runWithTenantContext(c, () =>
      docs.createRequirement(c, {
        code: `R4-DOC04-${randomUUID().slice(0, 8)}`,
        name: "Informe Ajustes Razonables",
        purpose: "Ajustes",
      }),
    );
    const draft = await runWithTenantContext(c, () =>
      docs.createRequirementVersion(c, req.id, {
        allowedFileTypes: ["PDF"],
        correctionWindowBusinessDays: 5,
        documentClassification: "GENERIC",
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowsEquivalent: false,
        required: true,
        validityRule: "NONE",
        processingCategory: "SUPPORT_ACCOMMODATION",
        sensitivity: "restricted",
      }),
    );
    const published = await runWithTenantContext(c, () =>
      docs.publishRequirementVersion(c, draft.id),
    );
    expect(published.lifecycle).toBe("PUBLISHED");
  });

  it("R4-DOC-05: Document storage remains tenant isolated and private", async () => {
    const cA = adminCtx(tenantAId);
    const cB = adminCtx(tenantBId);
    const docs = createDocService();
    const listA = await runWithTenantContext(cA, () =>
      docs.listRequirements(cA),
    );
    const listB = await runWithTenantContext(cB, () =>
      docs.listRequirements(cB),
    );
    const aIds = new Set(listA.items.map((r) => r.id));
    for (const item of listB.items) {
      expect(aIds.has(item.id)).toBe(false);
    }
  });
});

// ─── Cross-tenant isolation ──────────────────────────────────────────────────

describe("R4-SEC — Cross-tenant isolation", () => {
  it("R4-SEC-01: default policies apply independently per tenant", async () => {
    const sp = new SensitiveProcessingService(prisma);
    const cA = readCtx(tenantAId);
    const cB = readCtx(tenantBId);
    const polA = await runWithTenantContext(cA, () =>
      sp.readEffectivePolicies(cA),
    );
    const polB = await runWithTenantContext(cB, () =>
      sp.readEffectivePolicies(cB),
    );
    expect(polA).toHaveLength(4);
    expect(polB).toHaveLength(4);
  });

  it("R4-SEC-02: tenant B cannot read tenant A policies", async () => {
    const freshTenantB = randomUUID();
    const cA = adminCtx(tenantAId);
    const cB = readCtx(freshTenantB);
    const sp = new SensitiveProcessingService(prisma);

    // Enable HEALTH on tenant A
    await runWithTenantContext(cA, () =>
      sp.updatePolicy(cA, {
        category: "HEALTH",
        enabled: true,
        purpose: "tenant-A-only",
      }),
    );

    // Tenant B should not see tenant A's policy
    const policiesB = await runWithTenantContext(cB, () => sp.readPolicies(cB));
    expect(policiesB).toHaveLength(0);

    // Reset tenant A HEALTH policy
    await runWithTenantContext(cA, () =>
      sp.updatePolicy(cA, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
  });

  it("R4-SEC-03: tenant B cannot update tenant A policies", async () => {
    const cB = adminCtx(tenantBId);
    const sp = new SensitiveProcessingService(prisma);
    // Context cB has tenantBId, trying to pass input in cB will only ever affect tenant B
    const updated = await runWithTenantContext(cB, () =>
      sp.updatePolicy(cB, {
        category: "HEALTH",
        enabled: true,
        purpose: "tenant-B-only",
      }),
    );
    expect(updated.tenantId).toBe(tenantBId);

    // Reset tenant B
    await runWithTenantContext(cB, () =>
      sp.updatePolicy(cB, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
  });
});
