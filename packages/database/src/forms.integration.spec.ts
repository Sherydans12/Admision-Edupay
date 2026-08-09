import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ForbiddenError } from "./authorization.js";
import { getRequiredEnvironment } from "./environment.js";
import { FormService } from "./forms.js";
import {
  IntakeNotFoundError,
  IntakeService,
  IntakeValidationError,
} from "./intake.js";
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
const rawHarnessPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_APP_URL"),
  max: 2,
});
const now = new Date("2026-08-09T15:00:00.000Z");

type Fixture = {
  adminA: TenantExecutionContext;
  adminB: TenantExecutionContext;
  applicantA: TenantExecutionContext;
  applicantB: TenantExecutionContext;
  consentFieldId: string;
  definitionId: string;
  familyA: FamilyExecutionContext;
  familyB: FamilyExecutionContext;
  formVersionId: string;
  legacyApplicationId: string;
  manageOnlyA: TenantExecutionContext;
  neeFieldId: string;
  offeringId: string;
  processId: string;
  publicA: TenantExecutionContext;
  publicB: TenantExecutionContext;
  sectionId: string;
  studentA: string;
  studentA2: string;
  studentA3: string;
  studentB: string;
  supportFieldId: string;
  supportTriggerFieldId: string;
  tenantA: string;
  tenantB: string;
};

let fixture: Fixture;

const allFormPermissions = [
  PERMISSIONS.ADMISSION_CONFIG_MANAGE,
  PERMISSIONS.ADMISSION_CONFIG_READ,
  PERMISSIONS.FORM_MANAGE,
  PERMISSIONS.FORM_PUBLISH,
  PERMISSIONS.FORM_READ,
];
const familyPermissions = [
  PERMISSIONS.APPLICATION_CREATE,
  PERMISSIONS.APPLICATION_READ,
  PERMISSIONS.APPLICATION_SUBMIT,
  PERMISSIONS.APPLICATION_WRITE,
  PERMISSIONS.FAMILY_PROFILE_READ,
  PERMISSIONS.FAMILY_PROFILE_WRITE,
  PERMISSIONS.STUDENT_READ,
  PERMISSIONS.STUDENT_WRITE,
];

function tenantContext(
  actorId: string,
  tenantId: string,
  capabilities: readonly string[],
  origin: TenantExecutionContext["contextOrigin"] = "synthetic_test",
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: origin,
    correlationId: `synthetic-e5b-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "e5b.form-submission.test",
    source: "trusted_job",
    tenantId,
  };
}

function familyContext(actorId: string): FamilyExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `synthetic-e5b-family-${randomUUID()}`,
    effectiveActorId: actorId,
    familyCapabilities: familyPermissions,
    purpose: "e5b.form-submission.test",
    source: "trusted_job",
  };
}

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "application_snapshots", "application_draft_answers", "audit_events", "applications",
    "admission_offerings", "form_fields", "form_sections", "form_versions", "form_definitions",
    "admission_processes", "course_levels", "academic_years", "campuses", "students",
    "family_profiles", "tenant_probe_records", "outbox_messages", "support_elevations",
    "role_assignments", "memberships", "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function withRawTenantHarness<T>(
  tenantId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await rawHarnessPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('admission.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createPublishedForm(
  context: TenantExecutionContext,
  name: string,
): Promise<{
  consentFieldId: string;
  definitionId: string;
  neeFieldId: string;
  sectionId: string;
  supportFieldId: string;
  supportTriggerFieldId: string;
  versionId: string;
}> {
  const forms = new FormService(prisma);
  return runWithTenantContext(context, async () => {
    const definition = await forms.createDefinition(context, {
      name,
      purpose: "admission_application",
    });
    const version = await forms.createDraftVersion(context, definition.id);
    const section = await forms.createSection(context, version.id, {
      description: "Datos sintéticos mínimos para validar E5-B.",
      order: 1,
      title: "Antecedentes sintéticos",
    });
    const consent = await forms.createField(context, version.id, {
      key: "confirmed_information",
      label: "Confirmo la información sintética",
      order: 1,
      purpose: "Confirmar el envío",
      required: true,
      sectionId: section.id,
      sensitivity: "restricted",
      type: "BOOLEAN",
    });
    const supportTrigger = await forms.createField(context, version.id, {
      key: "needs_support",
      label: "¿Requiere apoyo sintético?",
      options: [
        { label: "No", order: 1, value: "NO" },
        { label: "Sí", order: 2, value: "YES" },
      ],
      order: 2,
      purpose: "Determinar apoyos mínimos",
      required: true,
      sectionId: section.id,
      sensitivity: "restricted",
      type: "RADIO",
    });
    const support = await forms.createField(context, version.id, {
      condition: {
        fieldId: supportTrigger.id,
        operator: "EQUALS",
        value: "YES",
      },
      key: "support_detail",
      label: "Detalle mínimo del apoyo sintético",
      order: 3,
      purpose: "Preparar apoyo o adecuación",
      required: true,
      sectionId: section.id,
      sensitivity: "highly_restricted",
      type: "TEXTAREA",
      validation: { maxLength: 300 },
    });
    const nee = await forms.createField(context, version.id, {
      key: "optional_nee_support",
      label: "Apoyo PIE/NEE sintético opcional",
      order: 4,
      purpose: "Preparar apoyo o adecuación opcional",
      required: false,
      sectionId: section.id,
      sensitivity: "highly_restricted",
      type: "TEXT",
    });
    await forms.publishVersion(context, version.id);
    return {
      consentFieldId: consent.id,
      definitionId: definition.id,
      neeFieldId: nee.id,
      sectionId: section.id,
      supportFieldId: support.id,
      supportTriggerFieldId: supportTrigger.id,
      versionId: version.id,
    };
  });
}

async function seed(): Promise<void> {
  const [userA, userB, adminAUser, adminBUser] = await Promise.all([
    prisma.platformUser.create({
      data: {
        emailNormalized: `synthetic-e5b-family-a-${randomUUID()}@example.invalid`,
      },
    }),
    prisma.platformUser.create({
      data: {
        emailNormalized: `synthetic-e5b-family-b-${randomUUID()}@example.invalid`,
      },
    }),
    prisma.platformUser.create({
      data: {
        emailNormalized: `synthetic-e5b-admin-a-${randomUUID()}@example.invalid`,
      },
    }),
    prisma.platformUser.create({
      data: {
        emailNormalized: `synthetic-e5b-admin-b-${randomUUID()}@example.invalid`,
      },
    }),
  ]);
  const [tenantA, tenantB] = await Promise.all([
    prisma.tenant.create({ data: { name: "Synthetic E5B Tenant A" } }),
    prisma.tenant.create({ data: { name: "Synthetic E5B Tenant B" } }),
  ]);
  const adminA = tenantContext(adminAUser.id, tenantA.id, allFormPermissions);
  const adminB = tenantContext(adminBUser.id, tenantB.id, allFormPermissions);
  const manageOnlyA = tenantContext(adminAUser.id, tenantA.id, [
    PERMISSIONS.FORM_MANAGE,
    PERMISSIONS.FORM_READ,
  ]);
  const publicA = tenantContext(
    userA.id,
    tenantA.id,
    [PERMISSIONS.OFFERING_PUBLIC_READ],
    "public_admission",
  );
  const publicB = tenantContext(
    userB.id,
    tenantB.id,
    [PERMISSIONS.OFFERING_PUBLIC_READ],
    "public_admission",
  );
  const applicantA = tenantContext(
    userA.id,
    tenantA.id,
    [
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
    ],
    "family_application",
  );
  const applicantB = tenantContext(
    userB.id,
    tenantB.id,
    [
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_SUBMIT,
      PERMISSIONS.APPLICATION_WRITE,
    ],
    "family_application",
  );
  const familyA = familyContext(userA.id);
  const familyB = familyContext(userB.id);
  const intake = new IntakeService(prisma);

  await runWithFamilyContext(familyA, async () => {
    await intake.getOrCreateFamilyProfile(familyA, "Adulto sintético E5B A");
  });
  await runWithFamilyContext(familyB, async () => {
    await intake.getOrCreateFamilyProfile(familyB, "Adulto sintético E5B B");
  });
  const studentA = await runWithFamilyContext(familyA, () =>
    intake.createStudent(familyA, {
      familyName: "Familia E5B A",
      givenName: "Estudiante Uno",
    }),
  );
  const studentA2 = await runWithFamilyContext(familyA, () =>
    intake.createStudent(familyA, {
      familyName: "Familia E5B A",
      givenName: "Estudiante Dos",
    }),
  );
  const studentA3 = await runWithFamilyContext(familyA, () =>
    intake.createStudent(familyA, {
      familyName: "Familia E5B A",
      givenName: "Estudiante Tres",
    }),
  );
  const studentB = await runWithFamilyContext(familyB, () =>
    intake.createStudent(familyB, {
      familyName: "Familia E5B B",
      givenName: "Estudiante B",
    }),
  );

  let offeringId = "";
  let processId = "";
  let academicYearId = "";
  await runWithTenantContext(adminA, async () => {
    const year = await intake.createAcademicYear(adminA, {
      code: "E5B-2027",
      label: "Año sintético E5B",
      status: "OPEN",
    });
    const campus = await intake.createCampus(adminA, {
      code: "E5B-CAMPUS",
      name: "Sede sintética E5B",
    });
    academicYearId = year.id;
    const level = await intake.createCourseLevel(adminA, {
      code: "E5B-LEVEL",
      name: "Nivel sintético E5B",
    });
    const process = await intake.createAdmissionProcess(adminA, {
      academicYearId: year.id,
      closesAt: new Date("2026-08-10T00:00:00.000Z"),
      code: "E5B-PROCESS",
      name: "Proceso sintético E5B",
      opensAt: new Date("2026-08-09T00:00:00.000Z"),
      status: "PUBLISHED",
    });
    processId = process.id;
    const offering = await intake.createOffering(adminA, {
      academicYearId: year.id,
      availabilityCategory: "POSTULATIONS_OPEN",
      campusId: campus.id,
      code: "E5B-OFFER",
      courseLevelId: level.id,
      processId: process.id,
      status: "PUBLISHED",
      title: "Oferta sintética E5B",
    });
    offeringId = offering.id;
  });

  const baseForm = await createPublishedForm(
    adminA,
    "Formulario sintético E5B V1",
  );
  const forms = new FormService(prisma);
  await runWithTenantContext(adminA, () =>
    forms.assignOfferingVersion(adminA, offeringId, baseForm.versionId),
  );

  const profileA = await prisma.familyProfile.findUniqueOrThrow({
    where: { userId: userA.id },
  });
  const legacyApplicationId = randomUUID();
  await runWithTenantContext(applicantA, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.application.create({
        data: {
          academicYearId,
          draftData: { acknowledgedNoGuarantee: false, currentStep: "CONTEXT" },
          familyProfileId: profileA.id,
          id: legacyApplicationId,
          offeringId,
          processId,
          studentId: studentA2.id,
          tenantId: tenantA.id,
        },
      }),
    ),
  );

  fixture = {
    adminA,
    adminB,
    applicantA,
    applicantB,
    consentFieldId: baseForm.consentFieldId,
    definitionId: baseForm.definitionId,
    familyA,
    familyB,
    formVersionId: baseForm.versionId,
    legacyApplicationId,
    manageOnlyA,
    neeFieldId: baseForm.neeFieldId,
    offeringId,
    processId,
    publicA,
    publicB,
    sectionId: baseForm.sectionId,
    studentA: studentA.id,
    studentA2: studentA2.id,
    studentA3: studentA3.id,
    studentB: studentB.id,
    supportFieldId: baseForm.supportFieldId,
    supportTriggerFieldId: baseForm.supportTriggerFieldId,
    tenantA: tenantA.id,
    tenantB: tenantB.id,
  };
}

async function createDraft(studentId = fixture.studentA) {
  const intake = new IntakeService(prisma);
  return runWithFamilyContext(fixture.familyA, () =>
    intake.createApplicationDraft(
      fixture.familyA,
      fixture.publicA,
      { offeringId: fixture.offeringId, studentId },
      now,
    ),
  );
}

async function saveMinimum(applicationId: string, support = "NO") {
  const forms = new FormService(prisma);
  const answers: Array<{ fieldId: string; value: unknown }> = [
    { fieldId: fixture.consentFieldId, value: true },
    { fieldId: fixture.supportTriggerFieldId, value: support },
  ];
  if (support === "YES") {
    answers.push({
      fieldId: fixture.supportFieldId,
      value: "Apoyo sintético mínimo",
    });
  }
  return runWithTenantContext(fixture.applicantA, () =>
    forms.saveAnswers(
      fixture.familyA,
      fixture.applicantA,
      applicationId,
      answers,
    ),
  );
}

async function createConditionDraft(source: {
  options?: Array<{ label: string; order: number; value: string }>;
  type: "BOOLEAN" | "DATE" | "RADIO" | "SELECT" | "TEXT" | "TEXTAREA";
  validation?: { maxLength?: number; minLength?: number };
}) {
  const forms = new FormService(prisma);
  return runWithTenantContext(fixture.adminA, async () => {
    const definition = await forms.createDefinition(fixture.adminA, {
      name: `Condición sintética ${randomUUID()}`,
      purpose: "integrity_condition_test",
    });
    const version = await forms.createDraftVersion(
      fixture.adminA,
      definition.id,
    );
    const section = await forms.createSection(fixture.adminA, version.id, {
      order: 1,
      title: "Condición sintética",
    });
    const sourceField = await forms.createField(fixture.adminA, version.id, {
      key: "condition_source",
      label: "Origen sintético",
      options: source.options,
      order: 1,
      purpose: "Validar dominio de condición",
      required: false,
      sectionId: section.id,
      sensitivity: "restricted",
      type: source.type,
      validation: source.validation,
    });
    return { forms, section, sourceField, version };
  });
}

async function createPublishedDateForm() {
  const forms = new FormService(prisma);
  return runWithTenantContext(fixture.adminA, async () => {
    const definition = await forms.createDefinition(fixture.adminA, {
      name: `Fecha sintética ${randomUUID()}`,
      purpose: "integrity_date_test",
    });
    const version = await forms.createDraftVersion(
      fixture.adminA,
      definition.id,
    );
    const section = await forms.createSection(fixture.adminA, version.id, {
      order: 1,
      title: "Fecha sintética",
    });
    const dateField = await forms.createField(fixture.adminA, version.id, {
      key: "calendar_date",
      label: "Fecha calendario sintética",
      order: 1,
      purpose: "Validar fecha calendario",
      required: true,
      sectionId: section.id,
      sensitivity: "restricted",
      type: "DATE",
    });
    await forms.publishVersion(fixture.adminA, version.id);
    await forms.assignOfferingVersion(
      fixture.adminA,
      fixture.offeringId,
      version.id,
    );
    return { dateField, forms, version };
  });
}

describe.sequential("E5-B versioned forms and submission", () => {
  beforeEach(async () => {
    await clearTables();
    await seed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await migrationPool.end();
    await rawHarnessPool.end();
  });

  it("E5B-FORM-01: DRAFT content is editable", async () => {
    const forms = new FormService(prisma);
    const draft = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    const field = draft.sections[0]?.fields[0];
    expect(field).toBeDefined();
    const updated = await runWithTenantContext(fixture.adminA, () =>
      forms.updateField(fixture.adminA, field!.id, {
        ...field!,
        label: "Etiqueta sintética actualizada",
        sectionId: draft.sections[0]!.id,
      }),
    );
    expect(updated.label).toBe("Etiqueta sintética actualizada");
  });

  it("E5B-FORM-02: PostgreSQL denies INSERT, UPDATE and DELETE on PUBLISHED content", async () => {
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.formSection.create({
            data: {
              formVersionId: fixture.formVersionId,
              order: 99,
              tenantId: fixture.tenantA,
              title: "No permitida",
            },
          }),
        ),
      ),
    ).rejects.toThrow(/published form content is immutable/i);
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.formField.update({
            data: { label: "No permitido" },
            where: { id: fixture.consentFieldId },
          }),
        ),
      ),
    ).rejects.toThrow(/published form content is immutable/i);
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.formSection.delete({ where: { id: fixture.sectionId } }),
        ),
      ),
    ).rejects.toThrow(/published form content is immutable/i);
  });

  it("E5B-FORM-03: a new version copies rows and does not alter its source", async () => {
    const forms = new FormService(prisma);
    const copy = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    expect(copy.sections[0]?.id).not.toBe(fixture.sectionId);
    expect(copy.sections[0]?.fields[0]?.id).not.toBe(fixture.consentFieldId);
    await runWithTenantContext(fixture.adminA, () =>
      forms.updateField(fixture.adminA, copy.sections[0]!.fields[0]!.id, {
        ...copy.sections[0]!.fields[0]!,
        label: "Sólo V2",
        sectionId: copy.sections[0]!.id,
      }),
    );
    const original = await runWithTenantContext(fixture.adminA, () =>
      forms.getVersion(fixture.adminA, fixture.formVersionId),
    );
    expect(original.sections[0]?.fields[0]?.label).not.toBe("Sólo V2");
  });

  it("E5B-FORM-04: form.manage without form.publish is denied", async () => {
    const forms = new FormService(prisma);
    const draft = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    await expect(
      runWithTenantContext(fixture.manageOnlyA, () =>
        forms.publishVersion(fixture.manageOnlyA, draft.id),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each([
    "<script>x</script>",
    "onclick=run",
    "javascript:run",
    "<iframe>",
    "<object>",
    "<embed>",
  ])("E5B-FORM-05: active content %s is rejected", async (unsafe) => {
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        forms.createDefinition(fixture.adminA, {
          name: unsafe,
          purpose: "admission_application",
        }),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-FORM-06: duplicate field keys are rejected", async () => {
    const forms = new FormService(prisma);
    const draft = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(fixture.adminA, fixture.definitionId),
    );
    const section = await runWithTenantContext(fixture.adminA, () =>
      forms.createSection(fixture.adminA, draft.id, {
        order: 1,
        title: "Duplicados",
      }),
    );
    const input = {
      key: "duplicate_key",
      label: "Campo sintético",
      order: 1,
      purpose: "Validar unicidad",
      required: false,
      sectionId: section.id,
      sensitivity: "restricted" as const,
      type: "TEXT" as const,
    };
    await runWithTenantContext(fixture.adminA, () =>
      forms.createField(fixture.adminA, draft.id, input),
    );
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        forms.createField(fixture.adminA, draft.id, { ...input, order: 2 }),
      ),
    ).rejects.toThrow();
  });

  it("E5B-FORM-07: a condition only references a previous field in the same version", async () => {
    const forms = new FormService(prisma);
    const draft = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(fixture.adminA, fixture.definitionId),
    );
    const section = await runWithTenantContext(fixture.adminA, () =>
      forms.createSection(fixture.adminA, draft.id, {
        order: 1,
        title: "Condición",
      }),
    );
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        forms.createField(fixture.adminA, draft.id, {
          condition: {
            fieldId: fixture.consentFieldId,
            operator: "EQUALS",
            value: true,
          },
          key: "cross_version",
          label: "Condición inválida",
          order: 1,
          purpose: "Validar versión",
          required: false,
          sectionId: section.id,
          sensitivity: "restricted",
          type: "TEXT",
        }),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);

    const laterSource = await runWithTenantContext(fixture.adminA, () =>
      forms.createField(fixture.adminA, draft.id, {
        key: "later_source",
        label: "Campo posterior",
        order: 2,
        purpose: "Validar orden",
        required: false,
        sectionId: section.id,
        sensitivity: "restricted",
        type: "BOOLEAN",
      }),
    );
    await runWithTenantContext(fixture.adminA, () =>
      forms.createField(fixture.adminA, draft.id, {
        condition: {
          fieldId: laterSource.id,
          operator: "EQUALS",
          value: true,
        },
        key: "earlier_dependent",
        label: "Campo dependiente anterior",
        order: 1,
        purpose: "Validar orden",
        required: false,
        sectionId: section.id,
        sensitivity: "restricted",
        type: "TEXT",
      }),
    );
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        forms.publishVersion(fixture.adminA, draft.id),
      ),
    ).rejects.toThrow(/previous field/i);
  });

  it("E5B-FORM-08: offering cannot bind a DRAFT version", async () => {
    const forms = new FormService(prisma);
    const draft = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(fixture.adminA, fixture.definitionId),
    );
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        forms.assignOfferingVersion(
          fixture.adminA,
          fixture.offeringId,
          draft.id,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-FORM-09: offering cannot bind a version from another tenant", async () => {
    const forms = new FormService(prisma);
    const foreign = await createPublishedForm(
      fixture.adminB,
      "Formulario tenant B",
    );
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        forms.assignOfferingVersion(
          fixture.adminA,
          fixture.offeringId,
          foreign.versionId,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-FORM-10: preview keeps a draft unpublished", async () => {
    const forms = new FormService(prisma);
    const draft = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    const preview = await runWithTenantContext(fixture.adminA, () =>
      forms.previewVersion(fixture.adminA, draft.id),
    );
    expect(preview).toMatchObject({ lifecycle: "DRAFT", preview: true });
    const persisted = await runWithTenantContext(fixture.adminA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.formVersion.findUnique({ where: { id: draft.id } }),
      ),
    );
    expect(persisted?.lifecycle).toBe("DRAFT");
  });

  it("E5B-ANS-01: family saves answers for its own application", async () => {
    const draft = await createDraft();
    const saved = await saveMinimum(draft.id);
    expect(saved.answers).toHaveLength(2);
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.applicantA, () =>
      forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
        { fieldId: fixture.neeFieldId, value: "Nota sintética temporal" },
      ]),
    );
    const cleared = await runWithTenantContext(fixture.applicantA, () =>
      forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
        { fieldId: fixture.neeFieldId, value: "" },
      ]),
    );
    expect(
      cleared.answers.some((answer) => answer.fieldId === fixture.neeFieldId),
    ).toBe(false);
  });

  it("E5B-ANS-02: family B cannot read or write family A answers", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.getFamilyForm(fixture.familyB, fixture.applicantA, draft.id),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
  });

  it("E5B-ANS-03: a field from another FormVersion is rejected", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    const v2 = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
          { fieldId: v2.sections[0]!.fields[0]!.id, value: true },
        ]),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-ANS-04: SELECT/RADIO value outside published catalog is rejected", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
          { fieldId: fixture.supportTriggerFieldId, value: "OUTSIDE" },
        ]),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-ANS-05: missing applicable required answer rejects submit", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-ANS-06: required NOT_APPLICABLE does not block submission", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id, "NO");
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).resolves.toMatchObject({ status: "SUBMITTED" });
  });

  it("E5B-ANS-07: optional synthetic PIE/NEE field does not block", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id, "NO");
    const forms = new FormService(prisma);
    const review = await runWithTenantContext(fixture.applicantA, () =>
      forms.getReview(fixture.familyA, fixture.applicantA, draft.id),
    );
    expect(review.missingRequired).toEqual([]);
    expect(
      review.sections
        .flatMap((section) => section.fields)
        .find((field) => field.id === fixture.neeFieldId)?.required,
    ).toBe(false);
  });

  it("E5B-ANS-08: conditional change preserves draft answer but hides it from active review", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id, "YES");
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.applicantA, () =>
      forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
        { fieldId: fixture.supportTriggerFieldId, value: "NO" },
      ]),
    );
    const familyForm = await runWithTenantContext(fixture.applicantA, () =>
      forms.getFamilyForm(fixture.familyA, fixture.applicantA, draft.id),
    );
    expect(
      familyForm.answers.some(
        (answer) => answer.fieldId === fixture.supportFieldId,
      ),
    ).toBe(true);
    const review = await runWithTenantContext(fixture.applicantA, () =>
      forms.getReview(fixture.familyA, fixture.applicantA, draft.id),
    );
    const support = review.sections
      .flatMap((section) => section.fields)
      .find((field) => field.id === fixture.supportFieldId);
    expect(support).toMatchObject({ applicable: false });
    expect(support).not.toHaveProperty("value");
  });

  it("E5B-VER-01/02: V1 stays pinned and later applications use assigned V2", async () => {
    const oldDraft = await createDraft(fixture.studentA);
    const forms = new FormService(prisma);
    const v2 = await runWithTenantContext(fixture.adminA, async () => {
      const draft = await forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      );
      await forms.publishVersion(fixture.adminA, draft.id);
      await forms.assignOfferingVersion(
        fixture.adminA,
        fixture.offeringId,
        draft.id,
      );
      return draft;
    });
    const newDraft = await createDraft(fixture.studentA3);
    expect(oldDraft.formVersionId).toBe(fixture.formVersionId);
    expect(newDraft.formVersionId).toBe(v2.id);
  });

  it("E5B-VER-03: published V1 remains historically readable", async () => {
    const forms = new FormService(prisma);
    const version = await runWithTenantContext(fixture.adminA, () =>
      forms.getVersion(fixture.adminA, fixture.formVersionId),
    );
    expect(version).toMatchObject({ lifecycle: "PUBLISHED", versionNumber: 1 });
  });

  it("E5B-VER-04: archived V1 does not break an application already pinned to V1", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.adminA, () =>
      forms.archiveVersion(fixture.adminA, fixture.formVersionId),
    );
    const form = await runWithTenantContext(fixture.applicantA, () =>
      forms.getFamilyForm(fixture.familyA, fixture.applicantA, draft.id),
    );
    expect(form.form.lifecycle).toBe("ARCHIVED");
  });

  it("E5B-SUB-01/02: complete draft becomes SUBMITTED with exactly one snapshot", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    const submitted = await runWithTenantContext(fixture.applicantA, () =>
      forms.submitApplication(
        fixture.familyA,
        fixture.applicantA,
        draft.id,
        now,
      ),
    );
    expect(submitted.status).toBe("SUBMITTED");
    const snapshots = await runWithTenantContext(fixture.applicantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationSnapshot.findMany({
          where: { applicationId: draft.id },
        }),
      ),
    );
    expect(snapshots).toHaveLength(1);
  });

  it("E5B-SUB-03/04: later profile and student changes do not alter snapshot", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.applicantA, () =>
      forms.submitApplication(
        fixture.familyA,
        fixture.applicantA,
        draft.id,
        now,
      ),
    );
    const before = await runWithTenantContext(fixture.applicantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationSnapshot.findUnique({
          where: { applicationId: draft.id },
        }),
      ),
    );
    const intake = new IntakeService(prisma);
    await runWithFamilyContext(fixture.familyA, async () => {
      await intake.getOrCreateFamilyProfile(
        fixture.familyA,
        "Adulto cambiado después del envío",
      );
      await intake.updateStudent(fixture.familyA, fixture.studentA, {
        familyName: "Familia cambiada",
        givenName: "Estudiante cambiado",
      });
    });
    const after = await runWithTenantContext(fixture.applicantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationSnapshot.findUnique({
          where: { applicationId: draft.id },
        }),
      ),
    );
    expect(after?.payload).toEqual(before?.payload);
  });

  it("E5B-SUB-05: V2 published later does not alter V1 snapshot", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.applicantA, () =>
      forms.submitApplication(
        fixture.familyA,
        fixture.applicantA,
        draft.id,
        now,
      ),
    );
    const v2 = await runWithTenantContext(fixture.adminA, async () => {
      const copy = await forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      );
      await forms.publishVersion(fixture.adminA, copy.id);
      return copy;
    });
    const snapshot = await runWithTenantContext(fixture.applicantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationSnapshot.findUnique({
          where: { applicationId: draft.id },
        }),
      ),
    );
    expect(snapshot?.formVersionId).toBe(fixture.formVersionId);
    expect((snapshot?.payload as { form: { id: string } }).form.id).toBe(
      fixture.formVersionId,
    );
    expect(snapshot?.formVersionId).not.toBe(v2.id);
  });

  it("E5B-SUB-06: closing race rejects submit and leaves no snapshot", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          new Date("2026-08-10T00:00:00.000Z"),
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    const [state, snapshots] = await runWithTenantContext(
      fixture.applicantA,
      () =>
        withTenantTransaction(prisma, (transaction) =>
          Promise.all([
            transaction.application.findUnique({ where: { id: draft.id } }),
            transaction.applicationSnapshot.findMany({
              where: { applicationId: draft.id },
            }),
          ]),
        ),
    );
    expect(state?.status).toBe("DRAFT");
    expect(snapshots).toHaveLength(0);
  });

  it("E5B-SUB-07: PROCESS_CLOSED rejects submit", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    await runWithTenantContext(fixture.adminA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.admissionOffering.update({
          data: { availabilityCategory: "PROCESS_CLOSED" },
          where: { id: fixture.offeringId },
        }),
      ),
    );
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-SUB-08: family B gets safe not-found for family A application", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyB,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
  });

  it("E5B-SUB-09: twenty concurrent submissions create exactly one snapshot", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        runWithTenantContext(fixture.applicantA, () =>
          forms.submitApplication(
            fixture.familyA,
            fixture.applicantA,
            draft.id,
            now,
          ),
        ),
      ),
    );
    expect(new Set(results.map((result) => result.snapshotId)).size).toBe(1);
    const snapshots = await runWithTenantContext(fixture.applicantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationSnapshot.count({
          where: { applicationId: draft.id },
        }),
      ),
    );
    expect(snapshots).toBe(1);
  });

  it("E5B-SUB-10: retry after success returns the same durable result", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    const first = await runWithTenantContext(fixture.applicantA, () =>
      forms.submitApplication(
        fixture.familyA,
        fixture.applicantA,
        draft.id,
        now,
      ),
    );
    const retry = await runWithTenantContext(fixture.applicantA, () =>
      forms.submitApplication(
        fixture.familyA,
        fixture.applicantA,
        draft.id,
        now,
      ),
    );
    expect(retry).toEqual(first);
  });

  it("E5B-INTEGRITY-01: corrupted durable answer rejects submit without side effects", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const corrupted = await withRawTenantHarness(fixture.tenantA, (client) =>
      client.query(
        `UPDATE "application_draft_answers"
         SET "value" = $1::jsonb
         WHERE "application_id" = $2::uuid AND "field_id" = $3::uuid`,
        [
          JSON.stringify("OUTSIDE_CATALOG"),
          draft.id,
          fixture.supportTriggerFieldId,
        ],
      ),
    );
    expect(corrupted.rowCount).toBe(1);
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
    const [application, snapshotCount, submittedAuditCount] =
      await runWithTenantContext(fixture.applicantA, () =>
        withTenantTransaction(prisma, (transaction) =>
          Promise.all([
            transaction.application.findUnique({ where: { id: draft.id } }),
            transaction.applicationSnapshot.count({
              where: { applicationId: draft.id },
            }),
            transaction.auditEvent.count({
              where: {
                action: "APPLICATION_SUBMITTED",
                resourceId: draft.id,
                result: "SUCCESS",
              },
            }),
          ]),
        ),
      );
    expect(application?.status).toBe("DRAFT");
    expect(snapshotCount).toBe(0);
    expect(submittedAuditCount).toBe(0);
  });

  it("E5B-INTEGRITY-02: DB denies an answer whose version differs from the pinned application", async () => {
    const draft = await createDraft();
    const forms = new FormService(prisma);
    const v2 = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    const foreignField = v2.sections[0]!.fields[0]!;
    await expect(
      withRawTenantHarness(fixture.tenantA, (client) =>
        client.query(
          `INSERT INTO "application_draft_answers"
            ("id", "tenant_id", "application_id", "form_version_id", "field_id", "value")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::jsonb)`,
          [
            randomUUID(),
            fixture.tenantA,
            draft.id,
            v2.id,
            foreignField.id,
            JSON.stringify(true),
          ],
        ),
      ),
    ).rejects.toThrow(
      /application_draft_answers_application_fkey|foreign key/i,
    );
  });

  it('E5B-INTEGRITY-03: RADIO condition rejects EQUALS "MAYBE"', async () => {
    const setup = await createConditionDraft({
      options: [
        { label: "Sí", order: 1, value: "YES" },
        { label: "No", order: 2, value: "NO" },
      ],
      type: "RADIO",
    });
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        setup.forms.createField(fixture.adminA, setup.version.id, {
          condition: {
            fieldId: setup.sourceField.id,
            operator: "EQUALS",
            value: "MAYBE",
          },
          key: "radio_dependent",
          label: "Dependiente sintético",
          order: 2,
          purpose: "Validar catálogo",
          required: false,
          sectionId: setup.section.id,
          sensitivity: "restricted",
          type: "TEXT",
        }),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it('E5B-INTEGRITY-04: BOOLEAN condition rejects string "true"', async () => {
    const setup = await createConditionDraft({ type: "BOOLEAN" });
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        setup.forms.createField(fixture.adminA, setup.version.id, {
          condition: {
            fieldId: setup.sourceField.id,
            operator: "EQUALS",
            value: "true",
          },
          key: "boolean_string_dependent",
          label: "Dependiente sintético",
          order: 2,
          purpose: "Validar boolean",
          required: false,
          sectionId: setup.section.id,
          sensitivity: "restricted",
          type: "TEXT",
        }),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-INTEGRITY-05: BOOLEAN condition accepts true", async () => {
    const setup = await createConditionDraft({ type: "BOOLEAN" });
    await runWithTenantContext(fixture.adminA, async () => {
      await setup.forms.createField(fixture.adminA, setup.version.id, {
        condition: {
          fieldId: setup.sourceField.id,
          operator: "EQUALS",
          value: true,
        },
        key: "boolean_dependent",
        label: "Dependiente sintético",
        order: 2,
        purpose: "Validar boolean",
        required: false,
        sectionId: setup.section.id,
        sensitivity: "restricted",
        type: "TEXT",
      });
      await expect(
        setup.forms.publishVersion(fixture.adminA, setup.version.id),
      ).resolves.toMatchObject({ lifecycle: "PUBLISHED" });
    });
  });

  it('E5B-INTEGRITY-06: RADIO condition accepts IN ["YES", "NO"]', async () => {
    const setup = await createConditionDraft({
      options: [
        { label: "Sí", order: 1, value: "YES" },
        { label: "No", order: 2, value: "NO" },
      ],
      type: "RADIO",
    });
    await runWithTenantContext(fixture.adminA, async () => {
      await setup.forms.createField(fixture.adminA, setup.version.id, {
        condition: {
          fieldId: setup.sourceField.id,
          operator: "IN",
          value: ["YES", "NO"],
        },
        key: "radio_in_dependent",
        label: "Dependiente sintético",
        order: 2,
        purpose: "Validar catálogo",
        required: false,
        sectionId: setup.section.id,
        sensitivity: "restricted",
        type: "TEXT",
      });
      await expect(
        setup.forms.publishVersion(fixture.adminA, setup.version.id),
      ).resolves.toMatchObject({ lifecycle: "PUBLISHED" });
    });
  });

  it("E5B-INTEGRITY-07: publish rejects persisted IN value outside the RADIO catalog", async () => {
    const setup = await createConditionDraft({
      options: [
        { label: "Sí", order: 1, value: "YES" },
        { label: "No", order: 2, value: "NO" },
      ],
      type: "RADIO",
    });
    const dependent = await runWithTenantContext(fixture.adminA, () =>
      setup.forms.createField(fixture.adminA, setup.version.id, {
        condition: {
          fieldId: setup.sourceField.id,
          operator: "IN",
          value: ["YES"],
        },
        key: "corrupted_in_dependent",
        label: "Dependiente sintético",
        order: 2,
        purpose: "Validar defensa de publicación",
        required: false,
        sectionId: setup.section.id,
        sensitivity: "restricted",
        type: "TEXT",
      }),
    );
    const corrupted = await withRawTenantHarness(fixture.tenantA, (client) =>
      client.query(
        `UPDATE "form_fields" SET "condition_value" = $1::jsonb WHERE "id" = $2::uuid`,
        [JSON.stringify(["YES", "MAYBE"]), dependent.id],
      ),
    );
    expect(corrupted.rowCount).toBe(1);
    await expect(
      runWithTenantContext(fixture.adminA, () =>
        setup.forms.publishVersion(fixture.adminA, setup.version.id),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-INTEGRITY-08: 2026-02-31 is rejected", async () => {
    const setup = await createPublishedDateForm();
    const draft = await createDraft();
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        setup.forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
          { fieldId: setup.dateField.id, value: "2026-02-31" },
        ]),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-INTEGRITY-09: 2024-02-29 is accepted through submission", async () => {
    const setup = await createPublishedDateForm();
    const draft = await createDraft();
    await runWithTenantContext(fixture.applicantA, () =>
      setup.forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
        { fieldId: setup.dateField.id, value: "2024-02-29" },
      ]),
    );
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        setup.forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).resolves.toMatchObject({ status: "SUBMITTED" });
  });

  it("E5B-INTEGRITY-10: 2026-02-29 is rejected", async () => {
    const setup = await createPublishedDateForm();
    const draft = await createDraft();
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        setup.forms.saveAnswers(fixture.familyA, fixture.applicantA, draft.id, [
          { fieldId: setup.dateField.id, value: "2026-02-29" },
        ]),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-INTEGRITY-11: discovery exposes a current offering with a PUBLISHED form", async () => {
    const intake = new IntakeService(prisma);
    const offerings = await runWithTenantContext(fixture.publicA, () =>
      intake.listPublicOfferings(fixture.publicA, now),
    );
    expect(offerings.map((offering) => offering.id)).toContain(
      fixture.offeringId,
    );
    await expect(createDraft()).resolves.toMatchObject({
      formVersionId: fixture.formVersionId,
    });
  });

  it("E5B-INTEGRITY-12: archived assigned form hides offering and rejects a new draft", async () => {
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.adminA, () =>
      forms.archiveVersion(fixture.adminA, fixture.formVersionId),
    );
    const intake = new IntakeService(prisma);
    const offerings = await runWithTenantContext(fixture.publicA, () =>
      intake.listPublicOfferings(fixture.publicA, now),
    );
    expect(offerings.map((offering) => offering.id)).not.toContain(
      fixture.offeringId,
    );
    await expect(createDraft()).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5B-INTEGRITY-13: application pinned to archived V1 can read, review and submit", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.adminA, () =>
      forms.archiveVersion(fixture.adminA, fixture.formVersionId),
    );
    const familyForm = await runWithTenantContext(fixture.applicantA, () =>
      forms.getFamilyForm(fixture.familyA, fixture.applicantA, draft.id),
    );
    const review = await runWithTenantContext(fixture.applicantA, () =>
      forms.getReview(fixture.familyA, fixture.applicantA, draft.id),
    );
    expect(familyForm.form.lifecycle).toBe("ARCHIVED");
    expect(review.missingRequired).toEqual([]);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          draft.id,
          now,
        ),
      ),
    ).resolves.toMatchObject({ status: "SUBMITTED" });
  });

  it("E5B-INTEGRITY-14: assigning PUBLISHED V2 restores discovery and preserves V1 pin", async () => {
    const oldDraft = await createDraft(fixture.studentA);
    const forms = new FormService(prisma);
    const v2 = await runWithTenantContext(fixture.adminA, () =>
      forms.createDraftVersion(
        fixture.adminA,
        fixture.definitionId,
        fixture.formVersionId,
      ),
    );
    await runWithTenantContext(fixture.adminA, async () => {
      await forms.archiveVersion(fixture.adminA, fixture.formVersionId);
      await forms.publishVersion(fixture.adminA, v2.id);
      await forms.assignOfferingVersion(
        fixture.adminA,
        fixture.offeringId,
        v2.id,
      );
    });
    const intake = new IntakeService(prisma);
    const offerings = await runWithTenantContext(fixture.publicA, () =>
      intake.listPublicOfferings(fixture.publicA, now),
    );
    expect(offerings.map((offering) => offering.id)).toContain(
      fixture.offeringId,
    );
    const newDraft = await createDraft(fixture.studentA3);
    const historical = await runWithTenantContext(fixture.applicantA, () =>
      forms.getFamilyForm(fixture.familyA, fixture.applicantA, oldDraft.id),
    );
    expect(oldDraft.formVersionId).toBe(fixture.formVersionId);
    expect(historical.form).toMatchObject({
      id: fixture.formVersionId,
      lifecycle: "ARCHIVED",
    });
    expect(newDraft.formVersionId).toBe(v2.id);
  });

  it("E5B legacy draft remains readable but controlled submit rejects without assigning a version", async () => {
    const forms = new FormService(prisma);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        forms.submitApplication(
          fixture.familyA,
          fixture.applicantA,
          fixture.legacyApplicationId,
          now,
        ),
      ),
    ).rejects.toThrow(/Legacy development draft has no form version/i);
    const legacy = await runWithTenantContext(fixture.applicantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.application.findUnique({
          where: { id: fixture.legacyApplicationId },
        }),
      ),
    );
    expect(legacy).toMatchObject({ formVersionId: null, status: "DRAFT" });
  });

  it("E5B snapshot denies ordinary UPDATE and DELETE", async () => {
    const draft = await createDraft();
    await saveMinimum(draft.id);
    const forms = new FormService(prisma);
    await runWithTenantContext(fixture.applicantA, () =>
      forms.submitApplication(
        fixture.familyA,
        fixture.applicantA,
        draft.id,
        now,
      ),
    );
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.applicationSnapshot.update({
            data: { schemaVersion: 1 },
            where: { applicationId: draft.id },
          }),
        ),
      ),
    ).rejects.toThrow(/snapshot is immutable|permission denied/i);
    await expect(
      runWithTenantContext(fixture.applicantA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.applicationSnapshot.delete({
            where: { applicationId: draft.id },
          }),
        ),
      ),
    ).rejects.toThrow(/snapshot is immutable|permission denied/i);
  });
});
