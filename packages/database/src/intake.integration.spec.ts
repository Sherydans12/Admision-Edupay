import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeService,
  IntakeValidationError,
  isAdmissionOfferingCurrent,
} from "./intake.js";
import { CapacityOfferService } from "./capacity-offer.js";
import { getRequiredEnvironment } from "./environment.js";
import { FormService } from "./forms.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { PERMISSIONS } from "./permission-catalog.js";
import {
  type FamilyExecutionContext,
  type TenantExecutionContext,
  runWithFamilyContext,
  runWithTenantContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 3,
});

const now = new Date("2026-08-08T23:00:00.000Z");
let fixture: {
  applicationOfferingId: string;
  applicantContextA: TenantExecutionContext;
  campusAId: string;
  contextA: TenantExecutionContext;
  courseLevelAId: string;
  familyA: FamilyExecutionContext;
  familyB: FamilyExecutionContext;
  formVersionId: string;
  academicYearAId: string;
  mismatchedYearId: string;
  processAId: string;
  publicContextA: TenantExecutionContext;
  studentA: string;
  studentB: string;
  tenantA: string;
  tenantB: string;
};

function context(
  actorId: string,
  tenantId: string,
  capabilities: readonly string[],
  origin: TenantExecutionContext["contextOrigin"],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: origin,
    correlationId: `synthetic-e5a-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "e5a.intake.test",
    scopes: ["*"],
    source: "trusted_job",
    tenantId,
  };
}

function familyContext(actorId: string): FamilyExecutionContext {
  return {
    actorId,
    contextOrigin: "family_profile",
    correlationId: `synthetic-e5a-family-${randomUUID()}`,
    effectiveActorId: actorId,
    familyCapabilities: familyCapabilities,
    purpose: "e5a.intake.test",
    source: "trusted_job",
  };
}

const configCapabilities = [
  PERMISSIONS.ADMISSION_CONFIG_MANAGE,
  PERMISSIONS.ADMISSION_CONFIG_READ,
  PERMISSIONS.FORM_MANAGE,
  PERMISSIONS.FORM_PUBLISH,
  PERMISSIONS.FORM_READ,
  PERMISSIONS.CAPACITY_MANAGE,
  PERMISSIONS.CAPACITY_READ,
];
const familyCapabilities = [
  PERMISSIONS.APPLICATION_CREATE,
  PERMISSIONS.APPLICATION_READ,
  PERMISSIONS.APPLICATION_SUBMIT,
  PERMISSIONS.APPLICATION_WRITE,
  PERMISSIONS.FAMILY_PROFILE_READ,
  PERMISSIONS.FAMILY_PROFILE_WRITE,
  PERMISSIONS.OFFERING_PUBLIC_READ,
  PERMISSIONS.STUDENT_READ,
  PERMISSIONS.STUDENT_WRITE,
];

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "audit_events", "applications", "admission_offerings", "admission_processes",
    "course_levels", "academic_years", "campuses", "students", "family_profiles",
    "tenant_probe_records", "outbox_messages", "support_elevations", "role_assignments",
    "memberships", "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function seedFixture(): Promise<void> {
  const [userA, userB] = await Promise.all([
    prisma.platformUser.create({
      data: {
        emailNormalized: `synthetic-e5a-a-${randomUUID()}@example.invalid`,
      },
    }),
    prisma.platformUser.create({
      data: {
        emailNormalized: `synthetic-e5a-b-${randomUUID()}@example.invalid`,
      },
    }),
  ]);
  const [tenantA, tenantB] = await Promise.all([
    prisma.tenant.create({ data: { name: "Synthetic E5A Tenant A" } }),
    prisma.tenant.create({ data: { name: "Synthetic E5A Tenant B" } }),
  ]);
  const contextA = context(
    userA.id,
    tenantA.id,
    configCapabilities,
    "membership",
  );
  const familyA = familyContext(userA.id);
  const familyB = familyContext(userB.id);
  const publicContextA = context(
    userA.id,
    tenantA.id,
    [PERMISSIONS.OFFERING_PUBLIC_READ],
    "public_admission",
  );
  const applicantContextA = context(
    userA.id,
    tenantA.id,
    [PERMISSIONS.APPLICATION_READ, PERMISSIONS.APPLICATION_WRITE],
    "family_application",
  );
  const tenantBContext = context(
    userB.id,
    tenantB.id,
    configCapabilities,
    "synthetic_test",
  );
  const intake = new IntakeService(prisma);
  const capacities = new CapacityOfferService(prisma);
  const forms = new FormService(prisma);

  await runWithTenantContext(contextA, async () => {
    const year = await intake.createAcademicYear(contextA, {
      code: "YEAR-SYNTH",
      label: "Año sintético",
      status: "OPEN",
    });
    const mismatchedYear = await intake.createAcademicYear(contextA, {
      code: "YEAR-SYNTH-B",
      label: "Año sintético alternativo",
      status: "OPEN",
    });
    const level = await intake.createCourseLevel(contextA, {
      code: "LEVEL-SYNTH",
      name: "Nivel sintético",
    });
    const campus = await intake.createCampus(contextA, {
      code: "CAMPUS-SYNTH",
      name: "Sede sintética",
    });
    const process = await intake.createAdmissionProcess(contextA, {
      academicYearId: year.id,
      code: "PROCESS-SYNTH",
      name: "Proceso sintético",
      status: "PUBLISHED",
    });
    const offering = await intake.createOffering(contextA, {
      academicYearId: year.id,
      availabilityCategory: "LIMITED_CAPACITY",
      campusId: campus.id,
      code: "OFFER-SYNTH",
      courseLevelId: level.id,
      processId: process.id,
      title: "Oferta sintética",
    });
    await capacities.createCapacity(contextA, offering.id, {
      configuredCapacity: 1,
    });
    await intake.publishOffering(contextA, offering.id, {
      expectedOfferingVersion: offering.concurrencyVersion,
    });
    const definition = await forms.createDefinition(contextA, {
      name: "Formulario sintético E5-B",
      purpose: "admission_application",
    });
    const version = await forms.createDraftVersion(contextA, definition.id);
    const section = await forms.createSection(contextA, version.id, {
      order: 1,
      title: "Antecedentes sintéticos",
    });
    await forms.createField(contextA, version.id, {
      key: "synthetic_context",
      label: "Contexto sintético",
      order: 1,
      purpose: "Validar el flujo sintético",
      required: false,
      sectionId: section.id,
      sensitivity: "restricted",
      type: "TEXT",
    });
    const published = await forms.publishVersion(contextA, version.id);
    await forms.assignOfferingVersion(contextA, offering.id, published.id);
    fixture = {
      applicationOfferingId: offering.id,
      applicantContextA,
      campusAId: campus.id,
      contextA,
      courseLevelAId: level.id,
      familyA,
      familyB,
      formVersionId: published.id,
      academicYearAId: year.id,
      mismatchedYearId: mismatchedYear.id,
      processAId: process.id,
      publicContextA,
      studentA: "",
      studentB: "",
      tenantA: tenantA.id,
      tenantB: tenantB.id,
    };
  });

  await runWithFamilyContext(familyA, async () => {
    await intake.getOrCreateFamilyProfile(familyA, "Adulto sintético A");
    const student = await intake.createStudent(familyA, {
      familyName: "Familia A",
      givenName: "Estudiante A",
    });
    fixture.studentA = student.id;
  });
  await runWithFamilyContext(familyB, async () => {
    await intake.getOrCreateFamilyProfile(familyB, "Adulto sintético B");
    const student = await intake.createStudent(familyB, {
      familyName: "Familia B",
      givenName: "Estudiante B",
    });
    fixture.studentB = student.id;
  });

  await runWithTenantContext(tenantBContext, async () => {
    const year = await intake.createAcademicYear(tenantBContext, {
      code: "YEAR-B",
      label: "Año privado B",
      status: "OPEN",
    });
    const level = await intake.createCourseLevel(tenantBContext, {
      code: "LEVEL-B",
      name: "Nivel privado B",
    });
    const campus = await intake.createCampus(tenantBContext, {
      code: "CAMPUS-B",
      name: "Sede privada B",
    });
    const process = await intake.createAdmissionProcess(tenantBContext, {
      academicYearId: year.id,
      code: "PROCESS-B",
      name: "Proceso privado B",
      status: "PUBLISHED",
    });
    const offering = await intake.createOffering(tenantBContext, {
      academicYearId: year.id,
      availabilityCategory: "POSTULATIONS_OPEN",
      campusId: campus.id,
      code: "OFFER-B",
      courseLevelId: level.id,
      processId: process.id,
      title: "Oferta privada B",
    });
    await capacities.createCapacity(tenantBContext, offering.id, {
      configuredCapacity: 1,
    });
    await intake.publishOffering(tenantBContext, offering.id, {
      expectedOfferingVersion: offering.concurrencyVersion,
    });
  });

  void now;
}

async function updateFixtureProcess(input: {
  closesAt?: Date | null;
  opensAt?: Date | null;
  status?: "DRAFT" | "PUBLISHED" | "CLOSED";
}): Promise<void> {
  await runWithTenantContext(fixture.contextA, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.admissionProcess.update({
        data: input,
        where: { id: fixture.processAId },
      }),
    ),
  );
}

async function updateFixtureAcademicYear(
  status: "DRAFT" | "OPEN" | "CLOSED",
): Promise<void> {
  await runWithTenantContext(fixture.contextA, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.academicYear.update({
        data: { status },
        where: { id: fixture.academicYearAId },
      }),
    ),
  );
}

async function updateFixtureAvailability(
  availabilityCategory:
    "LIMITED_CAPACITY" | "POSTULATIONS_OPEN" | "PROCESS_CLOSED" | "WAITLIST",
): Promise<void> {
  await runWithTenantContext(fixture.contextA, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.admissionOffering.update({
        data: { availabilityCategory },
        where: { id: fixture.applicationOfferingId },
      }),
    ),
  );
}

async function createSyntheticDraftOffering(codePrefix: string) {
  const intake = new IntakeService(prisma);
  return runWithTenantContext(fixture.contextA, () =>
    intake.createOffering(fixture.contextA, {
      academicYearId: fixture.academicYearAId,
      availabilityCategory: "LIMITED_CAPACITY",
      campusId: fixture.campusAId,
      code: `${codePrefix}-${randomUUID().slice(0, 8)}`,
      courseLevelId: fixture.courseLevelAId,
      processId: fixture.processAId,
      title: `Offering sintética ${codePrefix}`,
    }),
  );
}

async function createLegacyPublishedOfferingWithoutCapacity(
  codePrefix: string,
) {
  return runWithTenantContext(fixture.contextA, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.admissionOffering.create({
        data: {
          academicYearId: fixture.academicYearAId,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: fixture.campusAId,
          code: `${codePrefix}-${randomUUID().slice(0, 8)}`,
          courseLevelId: fixture.courseLevelAId,
          formVersionId: fixture.formVersionId,
          processId: fixture.processAId,
          status: "PUBLISHED",
          tenantId: fixture.tenantA,
          title: `Offering legacy sintética ${codePrefix}`,
        },
      }),
    ),
  );
}

describe.sequential("E5-A intake core", () => {
  beforeEach(async () => {
    await clearTables();
    await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("R5-CAP-01: create is always DRAFT and rejects an implicit publish", async () => {
    const intake = new IntakeService(prisma);
    const code = `R5-IMPLICIT-${randomUUID().slice(0, 8)}`;
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.createOffering(fixture.contextA, {
          academicYearId: fixture.academicYearAId,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: fixture.campusAId,
          code,
          courseLevelId: fixture.courseLevelAId,
          processId: fixture.processAId,
          status: "PUBLISHED",
          title: "Publicación implícita sintética",
        }),
      ),
    ).rejects.toMatchObject({
      code: "OFFERING_EXPLICIT_PUBLISH_REQUIRED",
    });
    const created = await createSyntheticDraftOffering("R5-DRAFT");
    expect(created).toMatchObject({
      concurrencyVersion: 1,
      status: "DRAFT",
    });
    const count = await runWithTenantContext(fixture.contextA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.admissionOffering.count({ where: { code } }),
      ),
    );
    expect(count).toBe(0);
  });

  it("R5-CAP-02/03/04: readiness distinguishes absent, zero and positive capacity", async () => {
    const intake = new IntakeService(prisma);
    const capacities = new CapacityOfferService(prisma);
    const absent = await createSyntheticDraftOffering("R5-ABSENT");
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.publishOffering(fixture.contextA, absent.id, {
          expectedOfferingVersion: absent.concurrencyVersion,
        }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFIGURATION_REQUIRED" });
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.getOfferingReadiness(fixture.contextA, absent.id),
      ),
    ).resolves.toEqual({
      blockers: ["CAPACITY_CONFIGURATION_REQUIRED"],
      capacityState: "CAPACITY_NOT_CONFIGURED",
      capacityVersion: null,
      lifecycle: "DRAFT",
      offeringId: absent.id,
      offeringVersion: 1,
      publishable: false,
    });

    const zero = await createSyntheticDraftOffering("R5-ZERO");
    await runWithTenantContext(fixture.contextA, () =>
      capacities.createCapacity(fixture.contextA, zero.id, {
        configuredCapacity: 0,
      }),
    );
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.getOfferingReadiness(fixture.contextA, zero.id),
      ),
    ).resolves.toMatchObject({
      blockers: [],
      capacityState: "CAPACITY_CONFIGURED_ZERO",
      capacityVersion: 1,
      publishable: true,
    });
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.publishOffering(fixture.contextA, zero.id, {
          expectedOfferingVersion: 1,
        }),
      ),
    ).resolves.toMatchObject({ concurrencyVersion: 2, status: "PUBLISHED" });

    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.getOfferingReadiness(
          fixture.contextA,
          fixture.applicationOfferingId,
        ),
      ),
    ).resolves.toMatchObject({
      capacityState: "CAPACITY_CONFIGURED_POSITIVE",
      capacityVersion: 1,
      lifecycle: "PUBLISHED",
    });
  });

  it("R5-CAP-08/09: generic updates cannot transition lifecycle and publish is optimistic", async () => {
    const intake = new IntakeService(prisma);
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.updateOffering(fixture.contextA, fixture.applicationOfferingId, {
          academicYearId: fixture.academicYearAId,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: fixture.campusAId,
          code: "OFFER-SYNTH",
          courseLevelId: fixture.courseLevelAId,
          processId: fixture.processAId,
          status: "DRAFT",
          title: "No debe despublicarse",
        }),
      ),
    ).rejects.toMatchObject({
      code: "OFFERING_EXPLICIT_PUBLISH_REQUIRED",
    });

    const capacities = new CapacityOfferService(prisma);
    const draft = await createSyntheticDraftOffering("R5-CONCURRENT");
    await runWithTenantContext(fixture.contextA, () =>
      capacities.createCapacity(fixture.contextA, draft.id, {
        configuredCapacity: 1,
      }),
    );
    const concurrentContext = {
      ...fixture.contextA,
      correlationId: `synthetic-r5-publish-${randomUUID()}`,
    };
    const results = await Promise.allSettled([
      runWithTenantContext(fixture.contextA, () =>
        intake.publishOffering(fixture.contextA, draft.id, {
          expectedOfferingVersion: 1,
        }),
      ),
      runWithTenantContext(concurrentContext, () =>
        intake.publishOffering(concurrentContext, draft.id, {
          expectedOfferingVersion: 1,
        }),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: { code: "OFFERING_VERSION_CHANGED" },
      status: "rejected",
    });
    const audits = await runWithTenantContext(fixture.contextA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.auditEvent.count({
          where: {
            action: "ADMISSION_OFFERING_PUBLISHED",
            resourceId: draft.id,
            result: "SUCCESS",
          },
        }),
      ),
    );
    expect(audits).toBe(1);
  });

  it("R5-CAP-06/07: legacy published offerings without capacity fail closed", async () => {
    const intake = new IntakeService(prisma);
    const legacy = await createLegacyPublishedOfferingWithoutCapacity(
      "R5-LEGACY-DISCOVERY",
    );
    const visible = await runWithTenantContext(fixture.publicContextA, () =>
      intake.listPublicOfferings(fixture.publicContextA, now),
    );
    expect(visible.map((offering) => offering.id)).toContain(
      fixture.applicationOfferingId,
    );
    expect(visible.map((offering) => offering.id)).not.toContain(legacy.id);
    await expect(
      runWithFamilyContext(fixture.familyA, () =>
        intake.createApplicationDraft(
          fixture.familyA,
          fixture.publicContextA,
          {
            offeringId: legacy.id,
            studentId: fixture.studentA,
          },
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeNotFoundError);
  });

  it("R5-CAP-10: opening a process or year preflights legacy capacity", async () => {
    const intake = new IntakeService(prisma);
    await createLegacyPublishedOfferingWithoutCapacity("R5-LEGACY-PREFLIGHT");
    await updateFixtureProcess({ status: "DRAFT" });
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.updateAdmissionProcess(fixture.contextA, fixture.processAId, {
          academicYearId: fixture.academicYearAId,
          code: "PROCESS-SYNTH",
          name: "Proceso sintético",
          status: "PUBLISHED",
        }),
      ),
    ).rejects.toMatchObject({
      code: "PUBLISHED_OFFERING_CAPACITY_REQUIRED",
    });
    await updateFixtureAcademicYear("DRAFT");
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.updateAcademicYear(fixture.contextA, fixture.academicYearAId, {
          code: "YEAR-SYNTH",
          label: "Año sintético",
          status: "OPEN",
        }),
      ),
    ).rejects.toMatchObject({
      code: "PUBLISHED_OFFERING_CAPACITY_REQUIRED",
    });
  });

  it("E5A-TEN-01/02/03 + E5A-AUD-04/05: RLS and tenant audit isolation", async () => {
    const visibleToA = await runWithTenantContext(fixture.contextA, () =>
      withTenantTransaction(prisma, async (transaction) => ({
        auditEvents: await transaction.auditEvent.findMany(),
        campuses: await transaction.campus.findMany(),
        offerings: await transaction.admissionOffering.findMany(),
        processes: await transaction.admissionProcess.findMany(),
      })),
    );
    expect(visibleToA.campuses).toHaveLength(1);
    expect(visibleToA.processes).toHaveLength(1);
    expect(visibleToA.offerings).toHaveLength(1);
    expect(visibleToA.auditEvents.length).toBeGreaterThan(0);
    expect(
      visibleToA.auditEvents.every(
        (event) => event.tenantId === fixture.tenantA,
      ),
    ).toBe(true);
    expect(
      visibleToA.auditEvents.every((event) => event.scope === "TENANT"),
    ).toBe(true);
    expect(
      visibleToA.auditEvents.some((event) =>
        event.action.startsWith("ADMISSION_"),
      ),
    ).toBe(true);
    expect(visibleToA.campuses[0]?.tenantId).toBe(fixture.tenantA);
    expect(visibleToA.processes[0]?.tenantId).toBe(fixture.tenantA);
    expect(visibleToA.offerings[0]?.tenantId).toBe(fixture.tenantA);

    await runWithTenantContext(fixture.contextA, async () => {
      await expect(
        withTenantTransaction(prisma, (transaction) =>
          transaction.campus.create({
            data: {
              code: "CROSS-TENANT",
              name: "No debe entrar",
              tenantId: fixture.tenantB,
            },
          }),
        ),
      ).rejects.toThrow();
    });

    await expect(prisma.campus.findMany()).resolves.toEqual([]);
    await expect(prisma.auditEvent.findMany()).resolves.toEqual([]);
    await expect(
      prisma.campus.create({
        data: {
          code: "NO-CONTEXT",
          name: "No debe entrar",
          tenantId: fixture.tenantA,
        },
      }),
    ).rejects.toThrow();
  });

  it("E5A-TEN-04/06: pooled tenant contexts do not leak and platform access is denied", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, async (_, index) => {
        const tenantContext =
          index % 2 === 0
            ? fixture.contextA
            : {
                ...fixture.contextA,
                correlationId: `synthetic-e5a-pool-${index}`,
                tenantId: fixture.tenantB,
              };
        return runWithTenantContext(tenantContext, () =>
          withTenantTransaction(prisma, (transaction) =>
            transaction.campus.findMany(),
          ),
        );
      }),
    );
    expect(
      results.filter((rows) =>
        rows.some((row) => row.tenantId === fixture.tenantA),
      ),
    ).toHaveLength(20);
    expect(
      results.filter((rows) =>
        rows.some((row) => row.tenantId === fixture.tenantB),
      ),
    ).toHaveLength(20);
    expect(
      results.every((rows, index) =>
        rows.every(
          (row) =>
            row.tenantId ===
            (index % 2 === 0 ? fixture.tenantA : fixture.tenantB),
        ),
      ),
    ).toBe(true);
  });

  it("E5A-TEN-05: family resource ownership is narrower than tenant membership", async () => {
    const intake = new IntakeService(prisma);
    await runWithFamilyContext(fixture.familyA, async () => {
      await expect(
        intake.updateStudent(fixture.familyA, fixture.studentB, {
          familyName: "No autorizado",
          givenName: "No autorizado",
        }),
      ).rejects.toBeInstanceOf(IntakeNotFoundError);
      await expect(
        intake.createApplicationDraft(fixture.familyA, fixture.publicContextA, {
          offeringId: fixture.applicationOfferingId,
          studentId: fixture.studentB,
        }),
      ).rejects.toBeInstanceOf(IntakeNotFoundError);
    });
  });

  it("projects availability categorically without exact capacity", async () => {
    const intake = new IntakeService(prisma);
    const offerings = await runWithTenantContext(fixture.publicContextA, () =>
      intake.listPublicOfferings(fixture.publicContextA),
    );
    expect(offerings[0]?.availabilityLabel).toBe("Cupos limitados");
    expect(offerings[0]).not.toHaveProperty("capacity");
    expect(offerings[0]).not.toHaveProperty("availableCount");
    expect(offerings[0]).not.toHaveProperty("exactCapacity");
    expect(offerings[0]).not.toHaveProperty("reservedCount");
  });

  it("E5A-VIG-01: published offering, process and open year inside the window are visible", async () => {
    const intake = new IntakeService(prisma);
    await updateFixtureProcess({
      closesAt: new Date("2026-08-09T00:00:00.000Z"),
      opensAt: now,
    });
    const visible = await runWithTenantContext(fixture.publicContextA, () =>
      intake.listPublicOfferings(fixture.publicContextA, now),
    );
    expect(visible.map((offering) => offering.id)).toEqual([
      fixture.applicationOfferingId,
    ]);

    expect(
      isAdmissionOfferingCurrent(
        {
          academicYear: { status: "OPEN" },
          process: {
            closesAt: new Date("2026-08-09T00:00:00.000Z"),
            opensAt: now,
            status: "PUBLISHED",
          },
          status: "PUBLISHED",
        },
        now,
      ),
    ).toBe(true);
  });

  it("E5A-VIG-02: draft or closed process is not visible", async () => {
    const intake = new IntakeService(prisma);
    for (const status of ["DRAFT", "CLOSED"] as const) {
      await updateFixtureProcess({ status });
      await expect(
        runWithTenantContext(fixture.publicContextA, () =>
          intake.listPublicOfferings(fixture.publicContextA, now),
        ),
      ).resolves.toEqual([]);
    }
  });

  it("E5A-VIG-03: draft or closed academic year is not visible", async () => {
    const intake = new IntakeService(prisma);
    for (const status of ["DRAFT", "CLOSED"] as const) {
      await updateFixtureAcademicYear(status);
      await expect(
        runWithTenantContext(fixture.publicContextA, () =>
          intake.listPublicOfferings(fixture.publicContextA, now),
        ),
      ).resolves.toEqual([]);
    }
  });

  it("E5A-VIG-04: a future opening hides the offering and rejects a draft", async () => {
    const intake = new IntakeService(prisma);
    await updateFixtureProcess({
      closesAt: new Date("2026-08-09T01:00:00.000Z"),
      opensAt: new Date("2026-08-09T00:00:00.000Z"),
    });
    await expect(
      runWithTenantContext(fixture.publicContextA, () =>
        intake.listPublicOfferings(fixture.publicContextA, now),
      ),
    ).resolves.toEqual([]);
    await expect(
      runWithFamilyContext(fixture.familyA, () =>
        intake.createApplicationDraft(
          fixture.familyA,
          fixture.publicContextA,
          {
            offeringId: fixture.applicationOfferingId,
            studentId: fixture.studentA,
          },
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5A-VIG-05: past or exactly reached closing rejects discovery and drafts", async () => {
    const intake = new IntakeService(prisma);
    for (const closesAt of [new Date("2026-08-08T22:00:00.000Z"), now]) {
      await updateFixtureProcess({ closesAt });
      await expect(
        runWithTenantContext(fixture.publicContextA, () =>
          intake.listPublicOfferings(fixture.publicContextA, now),
        ),
      ).resolves.toEqual([]);
      await expect(
        runWithFamilyContext(fixture.familyA, () =>
          intake.createApplicationDraft(
            fixture.familyA,
            fixture.publicContextA,
            {
              offeringId: fixture.applicationOfferingId,
              studentId: fixture.studentA,
            },
            now,
          ),
        ),
      ).rejects.toBeInstanceOf(IntakeValidationError);
    }
  });

  it("E5A-VIG-06: current process_closed is visible but cannot start a draft", async () => {
    const intake = new IntakeService(prisma);
    await updateFixtureAvailability("PROCESS_CLOSED");
    const visible = await runWithTenantContext(fixture.publicContextA, () =>
      intake.listPublicOfferings(fixture.publicContextA, now),
    );
    expect(visible[0]?.availabilityLabel).toBe("Proceso cerrado");
    await expect(
      runWithFamilyContext(fixture.familyA, () =>
        intake.createApplicationDraft(
          fixture.familyA,
          fixture.publicContextA,
          {
            offeringId: fixture.applicationOfferingId,
            studentId: fixture.studentA,
          },
          now,
        ),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5A-VIG-07: current postulations_open permits a draft", async () => {
    const intake = new IntakeService(prisma);
    await updateFixtureAvailability("POSTULATIONS_OPEN");
    await expect(
      runWithFamilyContext(fixture.familyA, () =>
        intake.createApplicationDraft(
          fixture.familyA,
          fixture.publicContextA,
          {
            offeringId: fixture.applicationOfferingId,
            studentId: fixture.studentA,
          },
          now,
        ),
      ),
    ).resolves.toMatchObject({ status: "DRAFT" });
  });

  it("E5A-VIG-08: current limited_capacity permits a draft without exact counts", async () => {
    const intake = new IntakeService(prisma);
    const draft = await runWithFamilyContext(fixture.familyA, () =>
      intake.createApplicationDraft(
        fixture.familyA,
        fixture.publicContextA,
        {
          offeringId: fixture.applicationOfferingId,
          studentId: fixture.studentA,
        },
        now,
      ),
    );
    expect(draft.status).toBe("DRAFT");
    expect(draft.offering).not.toHaveProperty("capacity");
    expect(draft.offering).not.toHaveProperty("availableCount");
  });

  it("E5A-VIG-09: current waitlist permits a draft without creating a waitlist entry", async () => {
    const intake = new IntakeService(prisma);
    await updateFixtureAvailability("WAITLIST");
    const draft = await runWithFamilyContext(fixture.familyA, () =>
      intake.createApplicationDraft(
        fixture.familyA,
        fixture.publicContextA,
        {
          offeringId: fixture.applicationOfferingId,
          studentId: fixture.studentA,
        },
        now,
      ),
    );
    expect(draft.status).toBe("DRAFT");
  });

  it("E5A-VIG-10: impossible process windows are rejected on create and update", async () => {
    const intake = new IntakeService(prisma);
    for (const [opensAt, closesAt] of [
      [now, now],
      [new Date("2026-08-09T01:00:00.000Z"), now],
    ] as const) {
      await expect(
        runWithTenantContext(fixture.contextA, () =>
          intake.createAdmissionProcess(fixture.contextA, {
            academicYearId: fixture.academicYearAId,
            closesAt,
            code: `INVALID-${randomUUID()}`,
            name: "Proceso inválido sintético",
            opensAt,
          }),
        ),
      ).rejects.toBeInstanceOf(IntakeValidationError);
      await expect(
        runWithTenantContext(fixture.contextA, () =>
          intake.updateAdmissionProcess(fixture.contextA, fixture.processAId, {
            academicYearId: fixture.academicYearAId,
            closesAt,
            code: "PROCESS-INVALID",
            name: "Proceso inválido sintético",
            opensAt,
          }),
        ),
      ).rejects.toBeInstanceOf(IntakeValidationError);
    }
  });

  it("E5A-CON-01: twenty concurrent draft attempts leave exactly one active draft", async () => {
    const intake = new IntakeService(prisma);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        runWithFamilyContext(fixture.familyA, () =>
          intake.createApplicationDraft(
            fixture.familyA,
            fixture.publicContextA,
            {
              offeringId: fixture.applicationOfferingId,
              studentId: fixture.studentA,
            },
          ),
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof IntakeDuplicateError,
      ),
    ).toHaveLength(19);

    const applications = await runWithTenantContext(
      fixture.applicantContextA,
      () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.application.findMany({
            where: {
              offeringId: fixture.applicationOfferingId,
              studentId: fixture.studentA,
              status: "DRAFT",
            },
          }),
        ),
    );
    expect(applications).toHaveLength(1);
  });

  it("E5A-AUD-03: application create/update audit remains tenant-owned", async () => {
    const intake = new IntakeService(prisma);
    const created = await runWithFamilyContext(fixture.familyA, () =>
      intake.createApplicationDraft(fixture.familyA, fixture.publicContextA, {
        offeringId: fixture.applicationOfferingId,
        studentId: fixture.studentA,
      }),
    );
    const saved = await runWithTenantContext(fixture.applicantContextA, () =>
      intake.saveApplicationDraft(
        fixture.familyA,
        fixture.applicantContextA,
        created.id,
        {
          acknowledgedNoGuarantee: true,
          currentStep: "REVIEW",
        },
      ),
    );
    expect(saved.draft).toEqual({
      acknowledgedNoGuarantee: true,
      currentStep: "REVIEW",
    });
    expect(saved.status).toBe("DRAFT");

    const audit = await runWithTenantContext(fixture.applicantContextA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.auditEvent.findMany({ where: { resourceId: created.id } }),
      ),
    );
    expect(audit.map((event) => event.action)).toEqual([
      "APPLICATION_DRAFT_CREATED",
      "APPLICATION_DRAFT_UPDATED",
    ]);
    expect(audit.every((event) => event.scope === "TENANT")).toBe(true);
    expect(audit.every((event) => event.tenantId === fixture.tenantA)).toBe(
      true,
    );
  });

  it("E5A-INV-01: rejects process/year mismatches before persistence", async () => {
    const intake = new IntakeService(prisma);
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.createOffering(fixture.contextA, {
          academicYearId: fixture.mismatchedYearId,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: "00000000-0000-4000-8000-000000000001",
          code: "OFFER-INVALID-YEAR",
          courseLevelId: "00000000-0000-4000-8000-000000000002",
          processId: fixture.processAId,
          status: "DRAFT",
          title: "Oferta inconsistente",
        }),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);
  });

  it("E5A-INV-02/03: DB rejects mixed application relations and accepts valid offering", async () => {
    const intake = new IntakeService(prisma);
    await expect(
      runWithTenantContext(fixture.contextA, () =>
        intake.createOffering(fixture.contextA, {
          academicYearId: fixture.mismatchedYearId,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: fixture.campusAId,
          code: "OFFER-INVALID-YEAR-2",
          courseLevelId: fixture.courseLevelAId,
          processId: fixture.processAId,
          status: "DRAFT",
          title: "Oferta inconsistente dos",
        }),
      ),
    ).rejects.toBeInstanceOf(IntakeValidationError);

    const profile = await prisma.familyProfile.findUniqueOrThrow({
      where: { userId: fixture.familyA.actorId },
    });
    await expect(
      runWithTenantContext(fixture.applicantContextA, () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.application.create({
            data: {
              academicYearId: fixture.mismatchedYearId,
              draftData: {
                acknowledgedNoGuarantee: false,
                currentStep: "CONTEXT",
              },
              familyProfileId: profile.id,
              offeringId: fixture.applicationOfferingId,
              processId: fixture.processAId,
              studentId: fixture.studentA,
              tenantId: fixture.tenantA,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const valid = await runWithFamilyContext(fixture.familyA, () =>
      intake.createApplicationDraft(fixture.familyA, fixture.publicContextA, {
        offeringId: fixture.applicationOfferingId,
        studentId: fixture.studentA,
      }),
    );
    expect(valid.status).toBe("DRAFT");
  });

  it("E5A-AUD-01: global family create audit is platform-scoped", async () => {
    const rows = await migrationPool.query<{
      actor_id: string;
      action: string;
      scope: string;
      tenant_id: string | null;
    }>(
      `SELECT actor_id, action, scope, tenant_id
       FROM audit_events
       WHERE action IN ('FAMILY_PROFILE_CREATED', 'STUDENT_CREATED')
       ORDER BY occurred_at ASC`,
    );
    const familyRows = rows.rows.filter(
      (row) => row.actor_id === fixture.familyA.actorId,
    );
    expect(familyRows.length).toBeGreaterThanOrEqual(2);
    expect(familyRows.every((row) => row.scope === "PLATFORM_GLOBAL")).toBe(
      true,
    );
    expect(familyRows.every((row) => row.tenant_id === null)).toBe(true);
  });

  it("E5A-AUD-02: global family update audit is platform-scoped", async () => {
    const intake = new IntakeService(prisma);
    await runWithFamilyContext(fixture.familyA, () =>
      intake.updateStudent(fixture.familyA, fixture.studentA, {
        familyName: "Familia A actualizada",
        givenName: "Estudiante A actualizado",
      }),
    );
    const rows = await migrationPool.query<{
      actor_id: string;
      action: string;
      scope: string;
      tenant_id: string | null;
    }>(
      `SELECT actor_id, action, scope, tenant_id
       FROM audit_events
       WHERE action IN ('FAMILY_PROFILE_CREATED', 'STUDENT_CREATED', 'STUDENT_UPDATED')
       ORDER BY occurred_at ASC`,
    );
    const familyRows = rows.rows.filter(
      (row) => row.actor_id === fixture.familyA.actorId,
    );
    expect(familyRows.length).toBeGreaterThanOrEqual(1);
    expect(familyRows.every((row) => row.scope === "PLATFORM_GLOBAL")).toBe(
      true,
    );
    expect(familyRows.every((row) => row.tenant_id === null)).toBe(true);
  });
});
