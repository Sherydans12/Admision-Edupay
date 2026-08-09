import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeService,
  IntakeValidationError,
} from "./intake.js";
import { getRequiredEnvironment } from "./environment.js";
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
];
const familyCapabilities = [
  PERMISSIONS.APPLICATION_CREATE,
  PERMISSIONS.APPLICATION_READ,
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
      status: "PUBLISHED",
      title: "Oferta sintética",
    });
    fixture = {
      applicationOfferingId: offering.id,
      applicantContextA,
      campusAId: campus.id,
      contextA,
      courseLevelAId: level.id,
      familyA,
      familyB,
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
    await intake.createOffering(tenantBContext, {
      academicYearId: year.id,
      availabilityCategory: "POSTULATIONS_OPEN",
      campusId: campus.id,
      code: "OFFER-B",
      courseLevelId: level.id,
      processId: process.id,
      status: "PUBLISHED",
      title: "Oferta privada B",
    });
  });

  void now;
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
          status: "PUBLISHED",
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
