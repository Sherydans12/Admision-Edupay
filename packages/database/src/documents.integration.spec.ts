import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AssistanceService } from "./assistance.js";
import { ApplicationAuthorityService } from "./application-authority.js";
import { authorize, ForbiddenError } from "./authorization.js";
import {
  DevelopmentBusinessCalendar,
  DocumentService,
  type DocumentRequirementVersionInput,
} from "./documents.js";
import {
  IntakeConflictError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./domain-errors.js";
import { FormService } from "./forms.js";
import { getLocalDate } from "./business-calendar.js";
import { IntakeService } from "./intake.js";
import {
  InMemoryObjectStorage,
  SyntheticDevelopmentMalwareScanner,
} from "./operational-adapters.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  createVerifiedSupportElevation,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 4,
});
const NOW = new Date("2026-08-10T15:00:00.000Z");
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

type Fixture = Awaited<ReturnType<typeof seedFixture>>;
let fixture: Fixture;
let storage: InMemoryObjectStorage;
let documents: DocumentService;
let forms: FormService;
let intake: IntakeService;
let assistance: AssistanceService;
let authorities: ApplicationAuthorityService;

const allDocumentPermissions = [
  PERMISSIONS.APPLICATION_ASSIST,
  PERMISSIONS.DOCUMENT_EXEMPT,
  PERMISSIONS.DOCUMENT_READ,
  PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE,
  PERMISSIONS.DOCUMENT_REQUIREMENT_PUBLISH,
  PERMISSIONS.DOCUMENT_REQUIREMENT_READ,
  PERMISSIONS.DOCUMENT_REVIEW,
  PERMISSIONS.DOCUMENT_UPLOAD,
  PERMISSIONS.RESTRICTED_READ,
] as const;

function tenantContext(
  actorId: string,
  tenantId: string,
  capabilities: readonly string[],
  origin: TenantExecutionContext["contextOrigin"] = "synthetic_test",
  scopes: readonly string[] = ["*"],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: origin,
    correlationId: `synthetic-e5c-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "e5c.documents.test",
    scopes,
    source: origin === "trusted_job" ? "trusted_job" : "authenticated_request",
    tenantId,
  };
}

function familyContext(actorId: string): FamilyExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `synthetic-e5c-family-${randomUUID()}`,
    effectiveActorId: actorId,
    familyCapabilities: [
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_UPLOAD,
    ],
    purpose: "e5c.documents.test",
    source: "authenticated_request",
  };
}

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "business_calendar_excluded_dates", "tenant_business_calendars",
    "application_snapshots", "application_draft_answers", "document_reviews",
    "document_versions", "document_submissions", "applications", "assistance_sessions",
    "document_requirement_versions", "document_requirements", "audit_events",
    "admission_offerings", "form_fields", "form_sections", "form_versions",
    "form_definitions", "admission_processes", "course_levels", "academic_years",
    "campuses", "students", "family_profiles", "tenant_probe_records",
    "outbox_messages", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function seedFixture() {
  const ids = {
    adminA: randomUUID(),
    adminB: randomUUID(),
    campusA: randomUUID(),
    campusB: randomUUID(),
    fieldA: randomUUID(),
    fieldB: randomUUID(),
    formDefinitionA: randomUUID(),
    formDefinitionB: randomUUID(),
    formSectionA: randomUUID(),
    formSectionB: randomUUID(),
    formVersionA: randomUUID(),
    formVersionB: randomUUID(),
    levelA: randomUUID(),
    levelB: randomUUID(),
    offeringA: randomUUID(),
    offeringB: randomUUID(),
    processA: randomUUID(),
    processB: randomUUID(),
    profileA: randomUUID(),
    profileB: randomUUID(),
    studentA: randomUUID(),
    studentA2: randomUUID(),
    studentA3: randomUUID(),
    studentB: randomUUID(),
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    yearA: randomUUID(),
    yearB: randomUUID(),
  };
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO platform_users (id, email_normalized, email_verified_at) VALUES
       ($1,$2,CURRENT_TIMESTAMP),($3,$4,CURRENT_TIMESTAMP),($5,$6,CURRENT_TIMESTAMP),($7,$8,CURRENT_TIMESTAMP)`,
      [
        ids.userA,
        `synthetic-e5c-family-a-${ids.userA}@example.invalid`,
        ids.userB,
        `synthetic-e5c-family-b-${ids.userB}@example.invalid`,
        ids.adminA,
        `synthetic-e5c-admin-a-${ids.adminA}@example.invalid`,
        ids.adminB,
        `synthetic-e5c-admin-b-${ids.adminB}@example.invalid`,
      ],
    );
    await client.query(
      `INSERT INTO tenants (id, name) VALUES ($1,$2),($3,$4)`,
      [
        ids.tenantA,
        "Synthetic E5C Tenant A",
        ids.tenantB,
        "Synthetic E5C Tenant B",
      ],
    );
    await client.query(
      `INSERT INTO family_profiles (id,user_id,display_name) VALUES ($1,$2,$3),($4,$5,$6)`,
      [
        ids.profileA,
        ids.userA,
        "Synthetic Family A",
        ids.profileB,
        ids.userB,
        "Synthetic Family B",
      ],
    );
    await client.query(
      `INSERT INTO students (id,family_profile_id,given_name,family_name,date_of_birth) VALUES
       ($1,$2,$3,$4,DATE '2010-01-01'),($5,$2,$6,$4,DATE '2010-01-01'),($7,$2,$8,$4,DATE '2010-01-01'),($9,$10,$11,$12,DATE '2010-01-01')`,
      [
        ids.studentA,
        ids.profileA,
        "Student A1",
        "Synthetic",
        ids.studentA2,
        "Student A2",
        ids.studentA3,
        "Student A3",
        ids.studentB,
        ids.profileB,
        "Student B",
        "Synthetic",
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  for (const suffix of ["A", "B"] as const) {
    const tenant = ids[`tenant${suffix}`];
    const campus = ids[`campus${suffix}`];
    const year = ids[`year${suffix}`];
    const level = ids[`level${suffix}`];
    const processId = ids[`process${suffix}`];
    const definition = ids[`formDefinition${suffix}`];
    const version = ids[`formVersion${suffix}`];
    const section = ids[`formSection${suffix}`];
    const field = ids[`field${suffix}`];
    const offering = ids[`offering${suffix}`];
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${tenant}, true)`;
      await transaction.$executeRaw`INSERT INTO tenant_business_calendars (id,tenant_id,timezone,concurrency_version) VALUES (${randomUUID()},${tenant},'America/Santiago',1)`;
      await transaction.$executeRaw`INSERT INTO campuses (id,tenant_id,code,name) VALUES (${campus},${tenant},${`CAMPUS-${suffix}`},${`Campus ${suffix}`})`;
      await transaction.$executeRaw`INSERT INTO academic_years (id,tenant_id,code,label,status) VALUES (${year},${tenant},${`YEAR-${suffix}`},${`Year ${suffix}`},'OPEN')`;
      await transaction.$executeRaw`INSERT INTO course_levels (id,tenant_id,code,name) VALUES (${level},${tenant},${`LEVEL-${suffix}`},${`Level ${suffix}`})`;
      await transaction.$executeRaw`INSERT INTO admission_processes (id,tenant_id,academic_year_id,code,name,status) VALUES (${processId},${tenant},${year},${`PROCESS-${suffix}`},${`Process ${suffix}`},'PUBLISHED')`;
      await transaction.$executeRaw`INSERT INTO form_definitions (id,tenant_id,name,purpose) VALUES (${definition},${tenant},${`Synthetic form ${suffix}`},'admission_application')`;
      await transaction.$executeRaw`INSERT INTO form_versions (id,tenant_id,form_definition_id,version_number,lifecycle) VALUES (${version},${tenant},${definition},1,'DRAFT')`;
      await transaction.$executeRaw`INSERT INTO form_sections (id,tenant_id,form_version_id,title,"order") VALUES (${section},${tenant},${version},${`Section ${suffix}`},1)`;
      await transaction.$executeRaw`INSERT INTO form_fields (id,tenant_id,form_version_id,section_id,key,label,type,required,sensitivity,purpose,"order") VALUES (${field},${tenant},${version},${section},'needs_document','Synthetic document confirmation','BOOLEAN',true,'restricted','Synthetic E5-C validation',1)`;
      await transaction.$executeRaw`UPDATE form_versions SET lifecycle='PUBLISHED',published_at=${NOW} WHERE id=${version}`;
      await transaction.$executeRaw`INSERT INTO admission_offerings (id,tenant_id,campus_id,academic_year_id,process_id,course_level_id,code,title,status,availability_category,form_version_id) VALUES (${offering},${tenant},${campus},${year},${processId},${level},${`OFFER-${suffix}`},${`Offering ${suffix}`},'PUBLISHED','POSTULATIONS_OPEN',${version})`;
      await transaction.$executeRaw`INSERT INTO admission_capacities (id,tenant_id,offering_id,configured_capacity) VALUES (${randomUUID()},${tenant},${offering},2)`;
    });
  }

  return {
    ...ids,
    adminContextA: tenantContext(
      ids.adminA,
      ids.tenantA,
      allDocumentPermissions,
    ),
    adminContextB: tenantContext(
      ids.adminB,
      ids.tenantB,
      allDocumentPermissions,
    ),
    applicantA: tenantContext(
      ids.userA,
      ids.tenantA,
      [
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
        PERMISSIONS.APPLICATION_AUTHORITY_READ,
        PERMISSIONS.APPLICATION_SUBMIT,
        PERMISSIONS.APPLICATION_WRITE,
        PERMISSIONS.DOCUMENT_READ,
        PERMISSIONS.DOCUMENT_UPLOAD,
      ],
      "family_application",
    ),
    assistOnlyA: tenantContext(ids.adminA, ids.tenantA, [
      PERMISSIONS.APPLICATION_ASSIST,
      PERMISSIONS.DOCUMENT_UPLOAD,
    ]),
    familyA: familyContext(ids.userA),
    familyB: familyContext(ids.userB),
    managerA: tenantContext(ids.adminA, ids.tenantA, [
      PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE,
      PERMISSIONS.DOCUMENT_REQUIREMENT_READ,
    ]),
    publicA: tenantContext(
      ids.userA,
      ids.tenantA,
      [PERMISSIONS.OFFERING_PUBLIC_READ],
      "public_admission",
    ),
    reviewerA: tenantContext(ids.adminA, ids.tenantA, [
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_REVIEW,
      PERMISSIONS.RESTRICTED_READ,
      PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    ]),
    secretaryA: tenantContext(ids.adminA, ids.tenantA, [
      PERMISSIONS.APPLICATION_ASSIST,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_UPLOAD,
      PERMISSIONS.RESTRICTED_READ,
    ]),
    workerA: tenantContext(ids.adminA, ids.tenantA, [], "trusted_job"),
  };
}

function versionInput(
  overrides: Partial<DocumentRequirementVersionInput> = {},
): DocumentRequirementVersionInput {
  const sensitivity = overrides.sensitivity ?? "restricted";
  const processingCategory =
    sensitivity === "highly_restricted" ? "ORDINARY_ADMISSION" : null;
  return {
    allowedFileTypes: ["PDF"],
    allowsEquivalent: false,
    correctionWindowBusinessDays: 3,
    maxFileSizeBytes: 1024 * 1024,
    processingCategory,
    required: true,
    sensitivity,
    validityRule: "NONE",
    ...overrides,
  };
}

async function createPublishedRequirement(
  input: DocumentRequirementVersionInput = versionInput(),
  context = fixture.adminContextA,
) {
  return runWithTenantContext(context, async () => {
    const requirement = await documents.createRequirement(context, {
      code: `DOC-${randomUUID()}`,
      name: "Synthetic document",
      purpose: "Synthetic E5-C verification",
    });
    const version = await documents.createRequirementVersion(
      context,
      requirement.id,
      input,
    );
    const published = await documents.publishRequirementVersion(
      context,
      version.id,
      NOW,
    );
    return { published, requirement };
  });
}

async function createDraft(studentId = fixture.studentA) {
  return runWithFamilyContext(fixture.familyA, () =>
    intake.createApplicationDraft(
      fixture.familyA,
      fixture.publicA,
      { offeringId: fixture.offeringA, studentId },
      NOW,
    ),
  );
}

async function submissionFor(applicationId: string) {
  const result = await runWithTenantContext(fixture.applicantA, () =>
    documents.listFamilyDocuments(
      fixture.familyA,
      fixture.applicantA,
      applicationId,
      NOW,
    ),
  );
  const item = result.items[0];
  if (item === undefined)
    throw new Error("Synthetic requirement was not pinned");
  return item;
}

async function upload(
  applicationId: string,
  submissionId: string,
  bytes = PDF,
  declaredMime = "application/pdf",
  overrides: { documentIssuedOn?: string; equivalentOptionCode?: string } = {},
) {
  return runWithTenantContext(fixture.applicantA, () =>
    documents.uploadFamilyDocument(
      fixture.familyA,
      fixture.applicantA,
      applicationId,
      submissionId,
      {
        bytes,
        declaredMime,
        originalFilename: "synthetic-document.pdf",
        ...overrides,
      },
    ),
  );
}

async function processDocument(versionId: string) {
  return runWithTenantContext(fixture.workerA, () =>
    documents.processDocument(fixture.workerA, versionId),
  );
}

function inTenant<T>(
  operation: Parameters<typeof withTenantTransaction<T>>[1],
  context: TenantExecutionContext = fixture.adminContextA,
): Promise<T> {
  return runWithTenantContext(context, () =>
    withTenantTransaction(prisma, operation),
  );
}

async function saveRequiredAnswer(applicationId: string, value = true) {
  return runWithTenantContext(fixture.applicantA, () =>
    forms.saveAnswers(fixture.familyA, fixture.applicantA, applicationId, [
      { fieldId: fixture.fieldA, value },
    ]),
  );
}

async function submit(applicationId: string) {
  await ensureVerifiedAuthority(applicationId);
  return runWithTenantContext(fixture.applicantA, () =>
    forms.submitApplication(
      fixture.familyA,
      fixture.applicantA,
      applicationId,
      NOW,
    ),
  );
}

async function ensureVerifiedAuthority(applicationId: string): Promise<void> {
  const current = await runWithTenantContext(fixture.applicantA, () =>
    authorities.getFamilyAuthority(
      fixture.familyA,
      fixture.applicantA,
      applicationId,
      NOW,
    ),
  );
  if (current.status === "VERIFIED") return;
  const declared = await runWithTenantContext(fixture.applicantA, () =>
    authorities.declareApplicationAuthority(
      fixture.familyA,
      fixture.applicantA,
      applicationId,
      {
        authorityBasis: "PARENT",
        relationship: "MOTHER",
        subjectMode: "MINOR_REPRESENTATIVE",
      },
      NOW,
    ),
  );
  const reviewing = await runWithTenantContext(fixture.reviewerA, () =>
    authorities.reviewApplicationAuthority(
      fixture.reviewerA,
      applicationId,
      {
        expectedConcurrencyVersion: declared.concurrencyVersion!,
        reason: "Base sintética de prueba",
        toStatus: "UNDER_REVIEW",
      },
      NOW,
    ),
  );
  await runWithTenantContext(fixture.reviewerA, () =>
    authorities.reviewApplicationAuthority(
      fixture.reviewerA,
      applicationId,
      {
        expectedConcurrencyVersion: reviewing.concurrencyVersion!,
        reason: "Verificación sintética de prueba",
        toStatus: "VERIFIED",
      },
      NOW,
    ),
  );
}

beforeEach(async () => {
  await clearTables();
  fixture = await seedFixture();
  storage = new InMemoryObjectStorage();
  documents = new DocumentService(
    prisma,
    storage,
    new SyntheticDevelopmentMalwareScanner("test"),
    2 * 1024 * 1024,
    new DevelopmentBusinessCalendar(),
  );
  forms = new FormService(prisma);
  intake = new IntakeService(prisma);
  authorities = new ApplicationAuthorityService(prisma);
  assistance = new AssistanceService(prisma, forms, documents);
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe.sequential("E5-C document requirement catalog", () => {
  it("E5C-REQ-01: DRAFT is editable", async () => {
    await runWithTenantContext(fixture.adminContextA, async () => {
      const requirement = await documents.createRequirement(
        fixture.adminContextA,
        {
          code: "EDITABLE",
          name: "Editable synthetic",
          purpose: "Edit draft",
        },
      );
      const draft = await documents.createRequirementVersion(
        fixture.adminContextA,
        requirement.id,
        versionInput(),
      );
      const updated = await documents.updateRequirementVersion(
        fixture.adminContextA,
        draft.id,
        versionInput({ instruction: "Updated safely" }),
      );
      expect(updated.instruction).toBe("Updated safely");
      expect(updated.lifecycle).toBe("DRAFT");
    });
  });

  it("E5C-REQ-02/03: PUBLISHED is immutable and V2 preserves archived V1", async () => {
    const first = await createPublishedRequirement();
    await expect(
      runWithTenantContext(fixture.adminContextA, () =>
        documents.updateRequirementVersion(
          fixture.adminContextA,
          first.published.id,
          versionInput({ required: false }),
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
    const second = await runWithTenantContext(
      fixture.adminContextA,
      async () => {
        const draft = await documents.createRequirementVersion(
          fixture.adminContextA,
          first.requirement.id,
          versionInput({ required: false }),
        );
        return documents.publishRequirementVersion(
          fixture.adminContextA,
          draft.id,
          NOW,
        );
      },
    );
    const records = await inTenant((transaction) =>
      transaction.documentRequirementVersion.findMany({
        orderBy: { versionNumber: "asc" },
        select: { lifecycle: true, versionNumber: true },
        where: { documentRequirementId: first.requirement.id },
      }),
    );
    expect(second.versionNumber).toBe(2);
    expect(records).toEqual([
      { lifecycle: "ARCHIVED", versionNumber: 1 },
      { lifecycle: "PUBLISHED", versionNumber: 2 },
    ]);
  });

  it("E5C-REQ-04/05/06: cross-tenant and invalid controlled conditions fail closed", async () => {
    await runWithTenantContext(fixture.adminContextA, async () => {
      const requirement = await documents.createRequirement(
        fixture.adminContextA,
        {
          code: "CONDITION",
          name: "Condition synthetic",
          purpose: "Validate controlled references",
        },
      );
      await expect(
        documents.createRequirementVersion(
          fixture.adminContextA,
          requirement.id,
          versionInput({ scope: { offeringId: fixture.offeringB } }),
        ),
      ).rejects.toBeInstanceOf(IntakeValidationError);
      await expect(
        documents.createRequirementVersion(
          fixture.adminContextA,
          requirement.id,
          versionInput({
            condition: {
              fieldId: fixture.fieldB,
              formVersionId: fixture.formVersionA,
              operator: "EQUALS",
              value: true,
            },
            scope: { offeringId: fixture.offeringA },
          }),
        ),
      ).rejects.toBeInstanceOf(IntakeValidationError);
      await expect(
        documents.createRequirementVersion(
          fixture.adminContextA,
          requirement.id,
          versionInput({
            condition: {
              fieldId: fixture.fieldA,
              formVersionId: fixture.formVersionA,
              operator: "EQUALS",
              value: "not-boolean",
            },
            scope: { offeringId: fixture.offeringA },
          }),
        ),
      ).rejects.toBeInstanceOf(IntakeValidationError);
    });
  });

  it("E5C-REQ-07/08: equivalent catalog is enforced and LATEST_AVAILABLE is generic", async () => {
    await createPublishedRequirement(
      versionInput({ validityRule: "LATEST_AVAILABLE" }),
    );
    const draft = await createDraft();
    const item = await submissionFor(draft.id);
    await expect(
      upload(draft.id, item.id, PDF, "application/pdf", {
        equivalentOptionCode: "FREE_TEXT",
      }),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    expect(item.requirement.version.validityRule).toBe("LATEST_AVAILABLE");
    expect(item.requirement.version.maxAgeDays).toBeNull();
    expect(item.requirement.version.scope).toEqual({
      academicYearId: null,
      courseLevelId: null,
      offeringId: null,
      processId: null,
    });
  });

  it("E5C-REQ-09: manage without publish cannot publish", async () => {
    await runWithTenantContext(fixture.managerA, async () => {
      const requirement = await documents.createRequirement(fixture.managerA, {
        code: "MANAGE-ONLY",
        name: "Manage only",
        purpose: "Permission separation",
      });
      const draft = await documents.createRequirementVersion(
        fixture.managerA,
        requirement.id,
        versionInput(),
      );
      await expect(
        documents.publishRequirementVersion(fixture.managerA, draft.id),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  it("E5C-REQ-10: existing application pins V1 and a later application pins V2", async () => {
    const first = await createPublishedRequirement();
    const applicationA = await createDraft(fixture.studentA);
    await runWithTenantContext(fixture.adminContextA, async () => {
      const v2 = await documents.createRequirementVersion(
        fixture.adminContextA,
        first.requirement.id,
        versionInput({ instruction: "V2" }),
      );
      await documents.publishRequirementVersion(
        fixture.adminContextA,
        v2.id,
        NOW,
      );
    });
    const applicationB = await createDraft(fixture.studentA2);
    const firstBinding = await submissionFor(applicationA.id);
    const secondBinding = await submissionFor(applicationB.id);
    expect(firstBinding.requirement.version.versionNumber).toBe(1);
    expect(secondBinding.requirement.version.versionNumber).toBe(2);
  });
});

describe.sequential("E5-C private upload and processing pipeline", () => {
  it("E5C-FILE-01/02/11/12 and E5C-WRK-01/08: upload quarantines, enqueues once and clean processing promotes and hashes actual bytes", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(application.id, item.id);
    expect(uploaded).toMatchObject({
      functionalStatus: "CARGADO",
      technicalStatus: "QUARANTINED",
    });
    const before = await inTenant(async (transaction) => ({
      messages: await transaction.outboxMessage.findMany({
        where: {
          idempotencyKey: `document.process:${uploaded.documentVersionId}`,
        },
      }),
      version: await transaction.documentVersion.findUniqueOrThrow({
        where: { id: uploaded.documentVersionId },
      }),
    }));
    expect(before.messages).toHaveLength(1);
    expect(before.version.quarantineObjectKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(before.version.quarantineObjectKey).not.toContain(
      "synthetic-document",
    );
    await processDocument(uploaded.documentVersionId);
    const persisted = await inTenant((transaction) =>
      transaction.documentVersion.findUniqueOrThrow({
        select: { sha256: true, technicalStatus: true },
        where: { id: uploaded.documentVersionId },
      }),
    );
    expect(persisted).toEqual({
      sha256: createHash("sha256").update(PDF).digest("hex"),
      technicalStatus: "READY_FOR_REVIEW",
    });
    expect((await submissionFor(application.id)).status).toBe("EN_REVISION");
  });

  it("E5C-FILE-03/04: MIME/signature mismatch and content outside requirement are blocked", async () => {
    await createPublishedRequirement(
      versionInput({ allowedFileTypes: ["PNG"] }),
    );
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(application.id, item.id, PDF, "image/png");
    await expect(
      processDocument(uploaded.documentVersionId),
    ).resolves.toMatchObject({ technicalStatus: "BLOCKED_INVALID" });
  });

  it("E5C-FILE-05/06: requirement and runtime hard caps reject oversized bytes", async () => {
    documents = new DocumentService(
      prisma,
      storage,
      new SyntheticDevelopmentMalwareScanner("test"),
      64,
    );
    await createPublishedRequirement(versionInput({ maxFileSizeBytes: 32 }));
    const application = await createDraft();
    const item = await submissionFor(application.id);
    await expect(
      upload(application.id, item.id, new Uint8Array(33)),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    await expect(
      upload(application.id, item.id, new Uint8Array(65)),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it.each([
    ["E5C-FILE-07", "SYNTHETIC_MALWARE_TEST_CONTROL", "BLOCKED_INFECTED"],
    [
      "E5C-FILE-08/E5C-WRK-07",
      "SYNTHETIC_SCAN_ERROR_CONTROL",
      "BLOCKED_SCAN_ERROR",
    ],
    ["E5C-FILE-09", "SYNTHETIC_UNSCANNABLE_CONTROL", "BLOCKED_UNSCANNABLE"],
  ])(
    "%s: synthetic scanner result %s fails closed",
    async (_id, marker, expected) => {
      await createPublishedRequirement();
      const application = await createDraft();
      const item = await submissionFor(application.id);
      const bytes = new TextEncoder().encode(`%PDF-1.4\n${marker}\n%%EOF`);
      const uploaded = await upload(application.id, item.id, bytes);
      await expect(
        processDocument(uploaded.documentVersionId),
      ).resolves.toMatchObject({ technicalStatus: expected });
      const row = await inTenant((transaction) =>
        transaction.documentVersion.findUniqueOrThrow({
          where: { id: uploaded.documentVersionId },
        }),
      );
      expect(await storage.exists("approved", row.approvedObjectKey!)).toBe(
        false,
      );
    },
  );

  it("E5C-FILE-10: password-protected PDF is blocked", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(
      application.id,
      item.id,
      new TextEncoder().encode("%PDF-1.4\n/Encrypt 1 0 R\n%%EOF"),
    );
    await expect(
      processDocument(uploaded.documentVersionId),
    ).resolves.toMatchObject({ technicalStatus: "BLOCKED_INVALID" });
  });

  it("E5C-FILE-13/14/15: only an authorized READY approved version downloads", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const quarantined = await upload(application.id, item.id);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        documents.downloadFamilyDocument(
          fixture.familyA,
          fixture.applicantA,
          application.id,
          quarantined.documentVersionId,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
    await processDocument(quarantined.documentVersionId);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        documents.downloadFamilyDocument(
          fixture.familyA,
          fixture.applicantA,
          application.id,
          quarantined.documentVersionId,
        ),
      ),
    ).resolves.toMatchObject({ contentType: "application/pdf" });

    const second = await upload(
      application.id,
      item.id,
      new TextEncoder().encode(
        "%PDF-1.4\nSYNTHETIC_MALWARE_TEST_CONTROL\n%%EOF",
      ),
    );
    await processDocument(second.documentVersionId);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        documents.downloadFamilyDocument(
          fixture.familyA,
          fixture.applicantA,
          application.id,
          second.documentVersionId,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
  });

  it("E5C-SMOKE-01: clean upload moves from quarantine through processing to an authorized byte-identical download", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(application.id, item.id);
    expect(uploaded.technicalStatus).toBe("QUARANTINED");
    await expect(
      processDocument(uploaded.documentVersionId),
    ).resolves.toMatchObject({
      technicalStatus: "READY_FOR_REVIEW",
    });
    const downloaded = await runWithTenantContext(fixture.applicantA, () =>
      documents.downloadFamilyDocument(
        fixture.familyA,
        fixture.applicantA,
        application.id,
        uploaded.documentVersionId,
      ),
    );
    expect(downloaded.bytes).toEqual(PDF);
    expect(downloaded.contentType).toBe("application/pdf");
  });

  it("E5C-FILE-16, E5C-WRK-05/08 and E5C-LEASE-09: reclaimed clean processing is terminal-idempotent and promotes exactly one current version", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(application.id, item.id);
    const first = await processDocument(uploaded.documentVersionId);
    const second = await processDocument(uploaded.documentVersionId);
    expect(second).toEqual(first);
    const row = await inTenant((transaction) =>
      transaction.documentVersion.findUniqueOrThrow({
        where: { id: uploaded.documentVersionId },
      }),
    );
    expect(await storage.exists("approved", row.approvedObjectKey!)).toBe(true);
    const submission = await inTenant((transaction) =>
      transaction.documentSubmission.findUniqueOrThrow({
        where: { id: item.id },
      }),
    );
    expect(submission.currentDocumentVersionId).toBe(
      uploaded.documentVersionId,
    );
  });

  it("stale document workers never flip a durable BLOCKED terminal state to READY", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(
      application.id,
      item.id,
      new TextEncoder().encode(
        "%PDF-1.4\nSYNTHETIC_MALWARE_TEST_CONTROL\n%%EOF",
      ),
    );
    await expect(
      processDocument(uploaded.documentVersionId),
    ).resolves.toMatchObject({ technicalStatus: "BLOCKED_INFECTED" });
    documents = new DocumentService(prisma, storage, {
      async scan() {
        return { provider: "synthetic-clean-retry", status: "CLEAN" as const };
      },
    });
    await expect(
      processDocument(uploaded.documentVersionId),
    ).resolves.toMatchObject({ technicalStatus: "BLOCKED_INFECTED" });
    const row = await inTenant((transaction) =>
      transaction.documentVersion.findUniqueOrThrow({
        where: { id: uploaded.documentVersionId },
      }),
    );
    expect(row.technicalStatus).toBe("BLOCKED_INFECTED");
    expect(await storage.exists("approved", row.approvedObjectKey!)).toBe(
      false,
    );
  });
});

describe.sequential("E5-C document resource authorization", () => {
  async function readyRestrictedDocument() {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(application.id, item.id);
    await processDocument(uploaded.documentVersionId);
    return { application, item, uploaded };
  }

  it("E5C-AUTH-01: document.read without restricted.read omits restricted requirements", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const reader = tenantContext(fixture.adminA, fixture.tenantA, [
      PERMISSIONS.DOCUMENT_READ,
    ]);
    const result = await runWithTenantContext(reader, () =>
      documents.listStaffDocuments(reader, application.id, NOW),
    );
    expect(result.items).toEqual([]);
  });

  it("E5C-AUTH-02: document.read plus restricted.read sees an authorized restricted requirement", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const result = await runWithTenantContext(fixture.reviewerA, () =>
      documents.listStaffDocuments(fixture.reviewerA, application.id, NOW),
    );
    expect(result.items).toHaveLength(1);
  });

  it("E5C-AUTH-03: document.review without sensitivity permission cannot accept", async () => {
    const { item, uploaded } = await readyRestrictedDocument();
    const reviewer = tenantContext(fixture.adminA, fixture.tenantA, [
      PERMISSIONS.DOCUMENT_REVIEW,
    ]);
    await expect(
      runWithTenantContext(reviewer, () =>
        documents.acceptDocument(reviewer, item.id, uploaded.documentVersionId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("E5C-AUTH-04: document.review without sensitivity permission cannot observe", async () => {
    const { item, uploaded } = await readyRestrictedDocument();
    const reviewer = tenantContext(fixture.adminA, fixture.tenantA, [
      PERMISSIONS.DOCUMENT_REVIEW,
    ]);
    await expect(
      runWithTenantContext(reviewer, () =>
        documents.observeDocument(
          reviewer,
          item.id,
          uploaded.documentVersionId,
          "Synthetic correction",
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("E5C-AUTH-05: document.exempt without sensitivity permission cannot exempt", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const actor = tenantContext(fixture.adminA, fixture.tenantA, [
      PERMISSIONS.DOCUMENT_EXEMPT,
    ]);
    await expect(
      runWithTenantContext(actor, () =>
        documents.exemptDocument(actor, item.id, "Synthetic exception"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("E5C-AUTH-06: application A scope cannot access application B in the same tenant", async () => {
    await createPublishedRequirement();
    const applicationA = await createDraft();
    const applicationB = await createDraft(fixture.studentA2);
    const reader = tenantContext(
      fixture.adminA,
      fixture.tenantA,
      [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.RESTRICTED_READ],
      "synthetic_test",
      [`application:${applicationA.id}`],
    );
    const allowed = await runWithTenantContext(reader, () =>
      documents.listStaffDocuments(reader, applicationA.id, NOW),
    );
    const denied = await runWithTenantContext(reader, () =>
      documents.listStaffDocuments(reader, applicationB.id, NOW),
    );
    expect(allowed.items).toHaveLength(1);
    expect(denied.items).toEqual([]);
  });

  it("E5C-AUTH-07: offering A scope cannot access offering B", async () => {
    await createPublishedRequirement();
    const offeringB = randomUUID();
    await inTenant(async (transaction) => {
      await transaction.admissionOffering.create({
        data: {
          academicYearId: fixture.yearA,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: fixture.campusA,
          code: `OFFER-B-${randomUUID()}`,
          courseLevelId: fixture.levelA,
          formVersionId: fixture.formVersionA,
          id: offeringB,
          processId: fixture.processA,
          status: "PUBLISHED",
          tenantId: fixture.tenantA,
          title: "Synthetic same-tenant offering B",
        },
      });
      await transaction.admissionCapacity.create({
        data: {
          configuredCapacity: 2,
          offeringId: offeringB,
          tenantId: fixture.tenantA,
        },
      });
    });
    const applicationA = await createDraft();
    const applicationB = await runWithFamilyContext(fixture.familyA, () =>
      intake.createApplicationDraft(
        fixture.familyA,
        fixture.publicA,
        { offeringId: offeringB, studentId: fixture.studentA2 },
        NOW,
      ),
    );
    const reader = tenantContext(
      fixture.adminA,
      fixture.tenantA,
      [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.RESTRICTED_READ],
      "synthetic_test",
      [`offering:${fixture.offeringA}`],
    );
    expect(
      (
        await runWithTenantContext(reader, () =>
          documents.listStaffDocuments(reader, applicationA.id, NOW),
        )
      ).items,
    ).toHaveLength(1);
    expect(
      (
        await runWithTenantContext(reader, () =>
          documents.listStaffDocuments(reader, applicationB.id, NOW),
        )
      ).items,
    ).toEqual([]);
  });

  it("E5C-AUTH-08: application.assist alone is not document read or review", async () => {
    const { application, item, uploaded } = await readyRestrictedDocument();
    const assistOnly = tenantContext(fixture.adminA, fixture.tenantA, [
      PERMISSIONS.APPLICATION_ASSIST,
    ]);
    await expect(
      runWithTenantContext(assistOnly, () =>
        documents.listStaffDocuments(assistOnly, application.id, NOW),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runWithTenantContext(assistOnly, () =>
        documents.acceptDocument(
          assistOnly,
          item.id,
          uploaded.documentVersionId,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(
      authorize(assistOnly, {
        permission: PERMISSIONS.DOCUMENT_REVIEW,
        resourceTenantId: fixture.tenantA,
      }).decision,
    ).toBe("DENY");
    const session = await runWithTenantContext(assistOnly, () =>
      assistance.startSession(
        assistOnly,
        {
          adultPresentConfirmed: true,
          authorizationConfirmed: true,
          familyProfileId: fixture.profileA,
        },
        NOW,
      ),
    );
    const assistedApplication = await runWithTenantContext(assistOnly, () =>
      assistance.createAssistedApplicationDraft(
        assistOnly,
        session.id,
        { offeringId: fixture.offeringA, studentId: fixture.studentA2 },
        NOW,
      ),
    );
    const safeProjection = await runWithTenantContext(assistOnly, () =>
      documents.listAssistedDocuments(assistOnly, assistedApplication.id, NOW),
    );
    expect(safeProjection.items).toHaveLength(1);
    expect(JSON.stringify(safeProjection)).not.toMatch(
      /sensitivity|detectedMime|scanProvider|actorId/i,
    );
    await expect(
      runWithTenantContext(assistOnly, () =>
        documents.uploadStaffDocument(
          assistOnly,
          assistedApplication.id,
          safeProjection.items[0]!.id,
          {
            bytes: PDF,
            declaredMime: "application/pdf",
            origin: "ASSISTED",
            originalFilename: "synthetic-assist-only.pdf",
          },
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("E5C-AUTH-10: support elevation is bounded by its categories and resource scopes", async () => {
    await createPublishedRequirement();
    await createPublishedRequirement(
      versionInput({ sensitivity: "highly_restricted" }),
    );
    const applicationA = await createDraft();
    const applicationB = await createDraft(fixture.studentA2);
    const elevation = createVerifiedSupportElevation({
      categories: ["restricted"],
      expiresAt: new Date(Date.now() + 60_000),
      id: randomUUID(),
      purpose: "e5c.documents.test",
      scopes: [`application:${applicationA.id}`],
      tenantId: fixture.tenantA,
    });
    const support: TenantExecutionContext = {
      actorId: fixture.adminA,
      capabilities: [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.RESTRICTED_READ],
      contextOrigin: "support_elevation",
      correlationId: `synthetic-support-${randomUUID()}`,
      effectiveActorId: fixture.adminA,
      purpose: elevation.purpose,
      scopes: elevation.scopes,
      source: "authenticated_request",
      supportElevation: elevation,
      tenantId: fixture.tenantA,
    };
    const allowed = await runWithTenantContext(support, () =>
      documents.listStaffDocuments(support, applicationA.id, NOW),
    );
    const outsideScope = await runWithTenantContext(support, () =>
      documents.listStaffDocuments(support, applicationB.id, NOW),
    );
    expect(allowed.items).toHaveLength(1);
    expect(allowed.items[0]?.requirement.version.sensitivity).toBe(
      "restricted",
    );
    expect(outsideScope.items).toEqual([]);
  });
});

describe.sequential("E5-C review, replacement and readiness", () => {
  async function readyDocument() {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await upload(application.id, item.id);
    await processDocument(uploaded.documentVersionId);
    return { application, item, uploaded };
  }

  it("E5C-REV-01/02/03/04: secretary uploads but cannot accept, observe or exempt", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    const uploaded = await runWithTenantContext(fixture.secretaryA, () =>
      documents.uploadStaffDocument(
        fixture.secretaryA,
        application.id,
        item.id,
        {
          bytes: PDF,
          declaredMime: "application/pdf",
          origin: "ASSISTED",
          originalFilename: "synthetic.pdf",
        },
      ),
    );
    await processDocument(uploaded.documentVersionId);
    await expect(
      runWithTenantContext(fixture.secretaryA, () =>
        documents.acceptDocument(
          fixture.secretaryA,
          item.id,
          uploaded.documentVersionId,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runWithTenantContext(fixture.secretaryA, () =>
        documents.observeDocument(
          fixture.secretaryA,
          item.id,
          uploaded.documentVersionId,
          "Correction",
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runWithTenantContext(fixture.secretaryA, () =>
        documents.exemptDocument(fixture.secretaryA, item.id, "Exception"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("E5C-REV-05/06/07/08: reviewer accepts or observes with weekday deadline and overdue never auto-rejects", async () => {
    const { application, item, uploaded } = await readyDocument();
    await expect(
      runWithTenantContext(fixture.reviewerA, () =>
        documents.observeDocument(
          fixture.reviewerA,
          item.id,
          uploaded.documentVersionId,
          "   ",
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    const observed = await runWithTenantContext(fixture.reviewerA, () =>
      documents.observeDocument(
        fixture.reviewerA,
        item.id,
        uploaded.documentVersionId,
        "Please replace synthetic evidence",
        new Date("2026-08-14T15:00:00Z"),
      ),
    );
    expect(
      getLocalDate(new Date(observed.correctionDueAt), "America/Santiago"),
    ).toBe("2026-08-19");
    const overdue = await runWithTenantContext(fixture.applicantA, () =>
      documents.listFamilyDocuments(
        fixture.familyA,
        fixture.applicantA,
        application.id,
        new Date("2026-08-21T00:00:00Z"),
      ),
    );
    expect(overdue.items[0]?.correctionOverdue).toBe(true);
    const persisted = await inTenant((transaction) =>
      transaction.application.findUniqueOrThrow({
        where: { id: application.id },
      }),
    );
    expect(persisted.status).toBe("DRAFT");

    const replacement = await upload(application.id, item.id);
    await processDocument(replacement.documentVersionId);
    await expect(
      runWithTenantContext(fixture.reviewerA, () =>
        documents.acceptDocument(
          fixture.reviewerA,
          item.id,
          replacement.documentVersionId,
        ),
      ),
    ).resolves.toMatchObject({ status: "ACEPTADO" });
  });

  it("E5C-REV-09/10 and E5C-SUB-05: exemption needs permission/reason and satisfies required submit", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    await saveRequiredAnswer(application.id);
    await expect(
      runWithTenantContext(fixture.secretaryA, () =>
        documents.exemptDocument(
          fixture.secretaryA,
          item.id,
          "Approved exception",
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runWithTenantContext(fixture.adminContextA, () =>
        documents.exemptDocument(fixture.adminContextA, item.id, ""),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    await runWithTenantContext(fixture.adminContextA, () =>
      documents.exemptDocument(
        fixture.adminContextA,
        item.id,
        "Synthetic explicit exception",
      ),
    );
    await expect(submit(application.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });
  });

  it("E5C-REP-01..06: observed replacement preserves history, blocked V2 and append-only reviews", async () => {
    const { application, item, uploaded: v1 } = await readyDocument();
    await runWithTenantContext(fixture.reviewerA, () =>
      documents.observeDocument(
        fixture.reviewerA,
        item.id,
        v1.documentVersionId,
        "Replace",
        NOW,
      ),
    );
    const v2 = await upload(
      application.id,
      item.id,
      new TextEncoder().encode(
        "%PDF-1.4\nSYNTHETIC_MALWARE_TEST_CONTROL\n%%EOF",
      ),
    );
    expect(v2.versionNumber).toBe(2);
    await processDocument(v2.documentVersionId);
    let projected = await submissionFor(application.id);
    expect(projected.currentDocumentVersion?.id).toBe(v1.documentVersionId);
    expect(projected.history).toHaveLength(2);
    const v3 = await upload(application.id, item.id);
    await processDocument(v3.documentVersionId);
    projected = await submissionFor(application.id);
    expect(projected.currentDocumentVersion?.id).toBe(v3.documentVersionId);
    expect(projected.status).toBe("EN_REVISION");
    expect(
      projected.history.find((version) => version.id === v1.documentVersionId)
        ?.projectedStatus,
    ).toBe("REEMPLAZADO");
    const review = await inTenant((transaction) =>
      transaction.documentReview.findFirstOrThrow({
        where: { documentSubmissionId: item.id },
      }),
    );
    await expect(
      runWithTenantContext(fixture.adminContextA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.documentReview.update({
            data: { reason: "Mutated" },
            where: { id: review.id },
          }),
        ),
      ),
    ).rejects.toThrow();
    const unchanged = await inTenant((transaction) =>
      transaction.documentReview.findUniqueOrThrow({
        where: { id: review.id },
      }),
    );
    expect(unchanged.reason).toBe("Replace");
  });

  it("E5C-SUB-01/02/06: pending, processing and observed required documents block submit", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    await saveRequiredAnswer(application.id);
    await expect(submit(application.id)).rejects.toBeInstanceOf(
      IntakeValidationError,
    );
    const uploaded = await upload(application.id, item.id);
    await expect(submit(application.id)).rejects.toBeInstanceOf(
      IntakeValidationError,
    );
    await processDocument(uploaded.documentVersionId);
    await runWithTenantContext(fixture.reviewerA, () =>
      documents.observeDocument(
        fixture.reviewerA,
        item.id,
        uploaded.documentVersionId,
        "Correction",
        NOW,
      ),
    );
    await expect(submit(application.id)).rejects.toBeInstanceOf(
      IntakeValidationError,
    );
  });

  it.each([
    ["E5C-SUB-03", "EN_REVISION"],
    ["E5C-SUB-04", "ACEPTADO"],
  ])("%s: required %s allows submit", async (_id, target) => {
    const { application, item, uploaded } = await readyDocument();
    await saveRequiredAnswer(application.id);
    if (target === "ACEPTADO") {
      await runWithTenantContext(fixture.reviewerA, () =>
        documents.acceptDocument(
          fixture.reviewerA,
          item.id,
          uploaded.documentVersionId,
        ),
      );
    }
    await expect(submit(application.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });
  });

  it("E5C-SUB-07: optional absent allows submit", async () => {
    await createPublishedRequirement(versionInput({ required: false }));
    const application = await createDraft();
    await saveRequiredAnswer(application.id);
    await expect(submit(application.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });
  });

  it("E5C-SUB-14: MAX_AGE_DAYS rejects expired evidence and accepts current evidence", async () => {
    await createPublishedRequirement(
      versionInput({ maxAgeDays: 30, validityRule: "MAX_AGE_DAYS" }),
    );
    const expiredApplication = await createDraft();
    const expiredItem = await submissionFor(expiredApplication.id);
    const expiredUpload = await upload(
      expiredApplication.id,
      expiredItem.id,
      PDF,
      "application/pdf",
      { documentIssuedOn: "2026-07-01" },
    );
    await processDocument(expiredUpload.documentVersionId);
    await saveRequiredAnswer(expiredApplication.id);
    await expect(submit(expiredApplication.id)).rejects.toBeInstanceOf(
      IntakeValidationError,
    );

    const currentApplication = await createDraft(fixture.studentA2);
    const currentItem = await submissionFor(currentApplication.id);
    const currentUpload = await upload(
      currentApplication.id,
      currentItem.id,
      PDF,
      "application/pdf",
      { documentIssuedOn: "2026-08-01" },
    );
    await processDocument(currentUpload.documentVersionId);
    await saveRequiredAnswer(currentApplication.id);
    await expect(submit(currentApplication.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });
  });

  it("E5C-SUB-08/09/10: applicability is reevaluated and never deletes history", async () => {
    await createPublishedRequirement(
      versionInput({
        condition: {
          fieldId: fixture.fieldA,
          formVersionId: fixture.formVersionA,
          operator: "EQUALS",
          value: true,
        },
        scope: { offeringId: fixture.offeringA },
      }),
    );
    const application = await createDraft();
    const item = await submissionFor(application.id);
    await saveRequiredAnswer(application.id, false);
    await expect(submit(application.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });

    const application2 = await createDraft(fixture.studentA2);
    await saveRequiredAnswer(application2.id, false);
    await saveRequiredAnswer(application2.id, true);
    await expect(submit(application2.id)).rejects.toBeInstanceOf(
      IntakeValidationError,
    );

    const item2 = await submissionFor(application2.id);
    const uploaded = await upload(application2.id, item2.id);
    await processDocument(uploaded.documentVersionId);
    await saveRequiredAnswer(application2.id, false);
    await expect(submit(application2.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });
    expect((await submissionFor(application2.id)).history).toHaveLength(1);
    void item;
  });

  it("E5C-SUB-11: snapshot v2 contains safe document evidence references only", async () => {
    const { application } = await readyDocument();
    await saveRequiredAnswer(application.id);
    await submit(application.id);
    const row = await inTenant((transaction) =>
      transaction.applicationSnapshot.findUniqueOrThrow({
        where: { applicationId: application.id },
      }),
    );
    expect(row.schemaVersion).toBe(2);
    const serialized = JSON.stringify(row.payload);
    expect(serialized).toContain("documentSubmissionId");
    expect(serialized).toContain("sha256");
    expect(serialized).not.toMatch(/quarantine|approvedObjectKey|storage/i);
  });

  it("E5C-SUB-12: historical schema v1 remains readable", async () => {
    await createPublishedRequirement(versionInput({ required: false }));
    const application = await createDraft();
    await inTenant((transaction) =>
      transaction.application.update({
        data: { status: "SUBMITTED", submittedAt: NOW },
        where: { id: application.id },
      }),
    );
    const snapshotId = randomUUID();
    await inTenant((transaction) =>
      transaction.applicationSnapshot.create({
        data: {
          applicationId: application.id,
          formVersionId: fixture.formVersionA,
          id: snapshotId,
          payload: { schemaVersion: 1, synthetic: true },
          schemaVersion: 1,
          submittedAt: NOW,
          submittedBy: fixture.userA,
          tenantId: fixture.tenantA,
        },
      }),
    );
    const row = await inTenant((transaction) =>
      transaction.applicationSnapshot.findUniqueOrThrow({
        where: { id: snapshotId },
      }),
    );
    expect(row.schemaVersion).toBe(1);
  });

  it("E5C-SUB-13: 20 concurrent submits still create one snapshot", async () => {
    await createPublishedRequirement(versionInput({ required: false }));
    const application = await createDraft();
    await saveRequiredAnswer(application.id);
    await ensureVerifiedAuthority(application.id);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => submit(application.id)),
    );
    expect(new Set(results.map((result) => result.snapshotId)).size).toBe(1);
    const count = await inTenant((transaction) =>
      transaction.applicationSnapshot.count({
        where: { applicationId: application.id },
      }),
    );
    expect(count).toBe(1);
  });

  it("E5C-CON-01: accept rejects V1 after replacement V2 becomes current", async () => {
    const { application, item, uploaded: v1 } = await readyDocument();
    const v2 = await upload(application.id, item.id);
    await processDocument(v2.documentVersionId);
    await expect(
      runWithTenantContext(fixture.reviewerA, () =>
        documents.acceptDocument(
          fixture.reviewerA,
          item.id,
          v1.documentVersionId,
        ),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_VERSION_CHANGED" });
    const persisted = await inTenant((transaction) =>
      transaction.documentSubmission.findUniqueOrThrow({
        include: { reviews: true },
        where: { id: item.id },
      }),
    );
    expect(persisted.currentDocumentVersionId).toBe(v2.documentVersionId);
    expect(persisted.status).toBe("EN_REVISION");
    expect(persisted.reviews).toEqual([]);
  });

  it("E5C-CON-02: observe rejects V1 after replacement V2 becomes current", async () => {
    const { application, item, uploaded: v1 } = await readyDocument();
    const v2 = await upload(application.id, item.id);
    await processDocument(v2.documentVersionId);
    await expect(
      runWithTenantContext(fixture.reviewerA, () =>
        documents.observeDocument(
          fixture.reviewerA,
          item.id,
          v1.documentVersionId,
          "Stale synthetic observation",
          NOW,
        ),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_VERSION_CHANGED" });
    const persisted = await inTenant((transaction) =>
      transaction.documentSubmission.findUniqueOrThrow({
        include: { reviews: true },
        where: { id: item.id },
      }),
    );
    expect(persisted.currentDocumentVersionId).toBe(v2.documentVersionId);
    expect(persisted.status).toBe("EN_REVISION");
    expect(persisted.reviews).toEqual([]);
  });

  it("E5C-CON-03: accept succeeds for the exact current V2 token", async () => {
    const { application, item } = await readyDocument();
    const v2 = await upload(application.id, item.id);
    await processDocument(v2.documentVersionId);
    await expect(
      runWithTenantContext(fixture.reviewerA, () =>
        documents.acceptDocument(
          fixture.reviewerA,
          item.id,
          v2.documentVersionId,
        ),
      ),
    ).resolves.toMatchObject({
      documentVersionId: v2.documentVersionId,
      status: "ACEPTADO",
    });
  });

  it("E5C-CON-04: exemption conflicts while a replacement is processing", async () => {
    const { application, item } = await readyDocument();
    const replacement = await upload(application.id, item.id);
    await inTenant((transaction) =>
      transaction.documentVersion.update({
        data: { technicalStatus: "PROCESSING" },
        where: { id: replacement.documentVersionId },
      }),
    );
    await expect(
      runWithTenantContext(fixture.adminContextA, () =>
        documents.exemptDocument(
          fixture.adminContextA,
          item.id,
          "Synthetic processing conflict",
        ),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_PROCESSING_IN_PROGRESS" });
  });

  it("E5C-CON-05: exemption succeeds when no upload is active", async () => {
    await createPublishedRequirement();
    const application = await createDraft();
    const item = await submissionFor(application.id);
    await expect(
      runWithTenantContext(fixture.adminContextA, () =>
        documents.exemptDocument(
          fixture.adminContextA,
          item.id,
          "Synthetic controlled exception",
        ),
      ),
    ).resolves.toMatchObject({ status: "EXENTO" });
  });

  it("E5C-CON-06: no stale review operation creates evidence for a version other than expected", async () => {
    const { application, item, uploaded: v1 } = await readyDocument();
    const v2 = await upload(application.id, item.id);
    await processDocument(v2.documentVersionId);
    for (const operation of ["accept", "observe"] as const) {
      await expect(
        runWithTenantContext(fixture.reviewerA, () =>
          operation === "accept"
            ? documents.acceptDocument(
                fixture.reviewerA,
                item.id,
                v1.documentVersionId,
              )
            : documents.observeDocument(
                fixture.reviewerA,
                item.id,
                v1.documentVersionId,
                "Synthetic stale review",
                NOW,
              ),
        ),
      ).rejects.toBeInstanceOf(IntakeConflictError);
    }
    const reviews = await inTenant((transaction) =>
      transaction.documentReview.findMany({
        where: { documentSubmissionId: item.id },
      }),
    );
    expect(reviews).toEqual([]);
  });
});

describe.sequential(
  "E5-C document same-submission database constraints",
  () => {
    it("E5C-DB-01: raw review insert cannot pair submission A with version B", async () => {
      await createPublishedRequirement();
      const applicationA = await createDraft();
      const applicationB = await createDraft(fixture.studentA2);
      const itemA = await submissionFor(applicationA.id);
      const itemB = await submissionFor(applicationB.id);
      const versionB = await upload(applicationB.id, itemB.id);
      await expect(
        inTenant((transaction) =>
          transaction.$executeRawUnsafe(
            `INSERT INTO document_reviews
          (id, tenant_id, document_submission_id, document_version_id, verdict, actor_id)
         VALUES ($1, $2, $3, $4, 'ACCEPTED', $5)`,
            randomUUID(),
            fixture.tenantA,
            itemA.id,
            versionB.documentVersionId,
            fixture.adminA,
          ),
        ),
      ).rejects.toThrow(/foreign key|document_reviews_version_fkey/i);
    });

    it("E5C-DB-02: raw replacement insert cannot reference another submission", async () => {
      await createPublishedRequirement();
      const applicationA = await createDraft();
      const applicationB = await createDraft(fixture.studentA2);
      const itemA = await submissionFor(applicationA.id);
      const itemB = await submissionFor(applicationB.id);
      const versionB = await upload(applicationB.id, itemB.id);
      await expect(
        inTenant((transaction) =>
          transaction.$executeRawUnsafe(
            `INSERT INTO document_versions
          (id, tenant_id, document_submission_id, version_number,
           display_name_sanitized, declared_mime, size_bytes,
           quarantine_object_key, technical_status, origin, uploaded_by,
           replaces_version_id)
         VALUES ($1, $2, $3, 1, 'synthetic-cross.pdf', 'application/pdf', 0,
           $4, 'UPLOAD_PENDING', 'SELF_SERVICE', $5, $6)`,
            randomUUID(),
            fixture.tenantA,
            itemA.id,
            randomUUID(),
            fixture.userA,
            versionB.documentVersionId,
          ),
        ),
      ).rejects.toThrow(/foreign key|document_versions_replaces_fkey/i);
    });

    it("E5C-DB-03: raw replacement insert within the same submission succeeds", async () => {
      await createPublishedRequirement();
      const application = await createDraft();
      const item = await submissionFor(application.id);
      const version1 = await upload(application.id, item.id);
      await expect(
        inTenant((transaction) =>
          transaction.$executeRawUnsafe(
            `INSERT INTO document_versions
          (id, tenant_id, document_submission_id, version_number,
           display_name_sanitized, declared_mime, size_bytes,
           quarantine_object_key, technical_status, origin, uploaded_by,
           replaces_version_id)
         VALUES ($1, $2, $3, 2, 'synthetic-valid.pdf', 'application/pdf', 0,
           $4, 'UPLOAD_PENDING', 'SELF_SERVICE', $5, $6)`,
            randomUUID(),
            fixture.tenantA,
            item.id,
            randomUUID(),
            fixture.userA,
            version1.documentVersionId,
          ),
        ),
      ).resolves.toBe(1);
    });
  },
);

describe.sequential("E5-C assisted application without impersonation", () => {
  async function readyAssistedApplication() {
    await createPublishedRequirement(versionInput({ required: false }));
    const session = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.startSession(
        fixture.assistOnlyA,
        {
          adultPresentConfirmed: true,
          authorizationConfirmed: true,
          familyProfileId: fixture.profileA,
        },
        NOW,
      ),
    );
    const application = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.createAssistedApplicationDraft(
        fixture.assistOnlyA,
        session.id,
        { offeringId: fixture.offeringA, studentId: fixture.studentA },
        NOW,
      ),
    );
    await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.saveAssistedAnswers(
        fixture.assistOnlyA,
        session.id,
        application.id,
        [{ fieldId: fixture.fieldA, value: true }],
      ),
    );
    await ensureVerifiedAuthority(application.id);
    return { application, session };
  }

  it("E5C-AST-01/02/03: assist permission, adult presence and authorization are mandatory", async () => {
    const denied = tenantContext(fixture.adminA, fixture.tenantA, []);
    await expect(
      runWithTenantContext(denied, () =>
        assistance.startSession(
          denied,
          {
            adultPresentConfirmed: true,
            authorizationConfirmed: true,
            familyProfileId: fixture.profileA,
          },
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runWithTenantContext(fixture.assistOnlyA, () =>
        assistance.startSession(
          fixture.assistOnlyA,
          {
            adultPresentConfirmed: false,
            authorizationConfirmed: true,
            familyProfileId: fixture.profileA,
          },
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    await expect(
      runWithTenantContext(fixture.assistOnlyA, () =>
        assistance.startSession(
          fixture.assistOnlyA,
          {
            adultPresentConfirmed: true,
            authorizationConfirmed: false,
            familyProfileId: fixture.profileA,
          },
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5C-AST-04/05/06: assisted draft keeps operator identity, pins same versions and reuses form validation", async () => {
    const requirement = await createPublishedRequirement();
    const session = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.startSession(
        fixture.assistOnlyA,
        {
          adultPresentConfirmed: true,
          authorizationConfirmed: true,
          familyProfileId: fixture.profileA,
        },
        NOW,
      ),
    );
    const assisted = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.createAssistedApplicationDraft(
        fixture.assistOnlyA,
        session.id,
        { offeringId: fixture.offeringA, studentId: fixture.studentA },
        NOW,
      ),
    );
    const self = await createDraft(fixture.studentA2);
    const bindings = await inTenant((transaction) =>
      transaction.documentSubmission.findMany({
        select: { applicationId: true, requirementVersionId: true },
        where: { applicationId: { in: [assisted.id, self.id] } },
      }),
    );
    expect(bindings).toHaveLength(2);
    expect(
      new Set(bindings.map((binding) => binding.requirementVersionId)),
    ).toEqual(new Set([requirement.published.id]));
    await expect(
      runWithTenantContext(fixture.assistOnlyA, () =>
        assistance.saveAssistedAnswers(
          fixture.assistOnlyA,
          session.id,
          assisted.id,
          [{ fieldId: fixture.fieldA, value: "invalid" }],
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    const audit = await inTenant((transaction) =>
      transaction.auditEvent.findFirstOrThrow({
        where: {
          action: "ASSISTED_APPLICATION_CREATED",
          resourceId: assisted.id,
        },
      }),
    );
    expect(audit.actorId).toBe(fixture.adminA);
  });

  it("E5C-AST-07/08/09 and E5C-AUTH-09: assisted upload remains authorized through the same fail-closed quarantine pipeline", async () => {
    await createPublishedRequirement();
    const session = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.startSession(
        fixture.assistOnlyA,
        {
          adultPresentConfirmed: true,
          authorizationConfirmed: true,
          familyProfileId: fixture.profileA,
        },
        NOW,
      ),
    );
    const application = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.createAssistedApplicationDraft(
        fixture.assistOnlyA,
        session.id,
        { offeringId: fixture.offeringA, studentId: fixture.studentA },
        NOW,
      ),
    );
    const submission = await inTenant((transaction) =>
      transaction.documentSubmission.findFirstOrThrow({
        where: { applicationId: application.id },
      }),
    );
    const uploaded = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.uploadAssistedDocument(
        fixture.assistOnlyA,
        session.id,
        application.id,
        submission.id,
        {
          bytes: new TextEncoder().encode(
            "%PDF-1.4\nSYNTHETIC_MALWARE_TEST_CONTROL\n%%EOF",
          ),
          declaredMime: "application/pdf",
          origin: "PHYSICAL_DOCUMENT",
          originalFilename: "synthetic-paper.pdf",
        },
      ),
    );
    const assistedProjection = await runWithTenantContext(
      fixture.assistOnlyA,
      () =>
        documents.listAssistedDocuments(fixture.assistOnlyA, application.id),
    );
    expect(assistedProjection.items[0]?.history).toEqual([]);
    expect(JSON.stringify(assistedProjection)).not.toMatch(
      /detectedMime|scanProvider|scanEngine|sha256|sensitivity|actorId/i,
    );
    const origin = await inTenant((transaction) =>
      transaction.documentVersion.findUniqueOrThrow({
        where: { id: uploaded.documentVersionId },
      }),
    );
    expect(origin.origin).toBe("PHYSICAL_DOCUMENT");
    await expect(
      processDocument(uploaded.documentVersionId),
    ).resolves.toMatchObject({ technicalStatus: "BLOCKED_INFECTED" });
  });

  it("E5C-AST-10/11/12: assistance capabilities do not grant review, recommend or decide", () => {
    expect(
      authorize(fixture.assistOnlyA, {
        permission: PERMISSIONS.DOCUMENT_REVIEW,
        purpose: fixture.assistOnlyA.purpose,
        resourceTenantId: fixture.tenantA,
      }).decision,
    ).toBe("DENY");
    expect(
      authorize(fixture.assistOnlyA, {
        permission: PERMISSIONS.APPLICATION_RECOMMEND,
        purpose: fixture.assistOnlyA.purpose,
        resourceTenantId: fixture.tenantA,
      }).decision,
    ).toBe("DENY");
    expect(
      authorize(fixture.assistOnlyA, {
        permission: PERMISSIONS.APPLICATION_DECIDE,
        purpose: fixture.assistOnlyA.purpose,
        resourceTenantId: fixture.tenantA,
      }).decision,
    ).toBe("DENY");
  });

  it("E5C-AST-13/14: recorded adult authorization is required and assisted snapshot identifies operator/session", async () => {
    await createPublishedRequirement(versionInput({ required: false }));
    const session = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.startSession(
        fixture.assistOnlyA,
        {
          adultPresentConfirmed: true,
          authorizationConfirmed: true,
          familyProfileId: fixture.profileA,
        },
        NOW,
      ),
    );
    const application = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.createAssistedApplicationDraft(
        fixture.assistOnlyA,
        session.id,
        { offeringId: fixture.offeringA, studentId: fixture.studentA },
        NOW,
      ),
    );
    await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.saveAssistedAnswers(
        fixture.assistOnlyA,
        session.id,
        application.id,
        [{ fieldId: fixture.fieldA, value: true }],
      ),
    );
    await inTenant((transaction) =>
      transaction.assistanceSession.update({
        data: { authorizationConfirmed: false, authorizationRecordedAt: null },
        where: { id: session.id },
      }),
    );
    await expect(
      runWithTenantContext(fixture.assistOnlyA, () =>
        assistance.submitAssistedApplication(
          fixture.assistOnlyA,
          session.id,
          application.id,
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
    await inTenant((transaction) =>
      transaction.assistanceSession.update({
        data: { authorizationConfirmed: true, authorizationRecordedAt: NOW },
        where: { id: session.id },
      }),
    );
    await ensureVerifiedAuthority(application.id);
    await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.submitAssistedApplication(
        fixture.assistOnlyA,
        session.id,
        application.id,
        NOW,
      ),
    );
    const snapshot = await inTenant((transaction) =>
      transaction.applicationSnapshot.findUniqueOrThrow({
        where: { applicationId: application.id },
      }),
    );
    expect(snapshot.payload).toMatchObject({
      adultResponsibleUserId: fixture.userA,
      assistanceSessionId: session.id,
      operatorUserId: fixture.adminA,
      submissionMode: "ASSISTED",
    });
  });

  it("E5C-AST-CON-01: close commits first and the later submit preserves DRAFT with no snapshot", async () => {
    const { application, session } = await readyAssistedApplication();
    await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.closeSession(fixture.assistOnlyA, session.id, NOW),
    );
    await expect(
      runWithTenantContext(fixture.assistOnlyA, () =>
        assistance.submitAssistedApplication(
          fixture.assistOnlyA,
          session.id,
          application.id,
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
    const persisted = await inTenant(async (transaction) => ({
      application: await transaction.application.findUniqueOrThrow({
        where: { id: application.id },
      }),
      snapshots: await transaction.applicationSnapshot.count({
        where: { applicationId: application.id },
      }),
    }));
    expect(persisted.application.status).toBe("DRAFT");
    expect(persisted.snapshots).toBe(0);
  });

  it("E5C-AST-CON-02: submit commits first exactly once and close can follow", async () => {
    const { application, session } = await readyAssistedApplication();
    const first = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.submitAssistedApplication(
        fixture.assistOnlyA,
        session.id,
        application.id,
        NOW,
      ),
    );
    const retry = await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.submitAssistedApplication(
        fixture.assistOnlyA,
        session.id,
        application.id,
        NOW,
      ),
    );
    expect(retry.snapshotId).toBe(first.snapshotId);
    await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.closeSession(fixture.assistOnlyA, session.id, NOW),
    );
    const persisted = await inTenant(async (transaction) => ({
      application: await transaction.application.findUniqueOrThrow({
        where: { id: application.id },
      }),
      session: await transaction.assistanceSession.findUniqueOrThrow({
        where: { id: session.id },
      }),
      snapshots: await transaction.applicationSnapshot.count({
        where: { applicationId: application.id },
      }),
    }));
    expect(persisted.application.status).toBe("SUBMITTED");
    expect(persisted.session.status).toBe("CLOSED");
    expect(persisted.snapshots).toBe(1);
  });

  it("E5C-AST-CON-03: definitive form submission cannot bypass a session already closed", async () => {
    const { application, session } = await readyAssistedApplication();
    await runWithTenantContext(fixture.assistOnlyA, () =>
      assistance.closeSession(fixture.assistOnlyA, session.id, NOW),
    );
    await expect(
      runWithTenantContext(fixture.assistOnlyA, () =>
        forms.submitAssistedApplication(
          fixture.assistOnlyA,
          {
            applicationId: application.id,
            assistanceSessionId: session.id,
          },
          NOW,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
    const persisted = await inTenant(async (transaction) => ({
      application: await transaction.application.findUniqueOrThrow({
        where: { id: application.id },
      }),
      snapshots: await transaction.applicationSnapshot.count({
        where: { applicationId: application.id },
      }),
    }));
    expect(persisted.application.status).toBe("DRAFT");
    expect(persisted.snapshots).toBe(0);
  });
});
