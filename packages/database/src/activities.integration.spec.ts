import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ActivityConflictError,
  ActivityService,
  PERMISSIONS,
  pinApplicationActivities,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "@admission/database";
import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});

const tenantId = randomUUID();
const familyUserId = randomUUID();
const staffUserId = randomUUID();
const otherStaffUserId = randomUUID();
const familyProfileId = randomUUID();
const studentId = randomUUID();
let applicationId = "";
let diagnosticActivityId = "";
let interviewActivityId = "";

const staffContext = (
  capabilities: readonly string[] = [
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.ACTIVITY_SCHEDULE,
    PERMISSIONS.ACTIVITY_PERFORM,
    PERMISSIONS.ACTIVITY_RESULT_READ,
    PERMISSIONS.ACTIVITY_REPEAT,
    PERMISSIONS.ACTIVITY_CLOSE,
    PERMISSIONS.ACTIVITY_DEFINITION_MANAGE,
    PERMISSIONS.ACTIVITY_DEFINITION_PUBLISH,
    PERMISSIONS.RESTRICTED_READ,
  ],
): TenantExecutionContext => ({
  actorId: staffUserId,
  capabilities,
  contextOrigin: "synthetic_test",
  correlationId: `activity-test-${randomUUID()}`,
  effectiveActorId: staffUserId,
  purpose: "E5D_TEST",
  scopes: ["*"],
  source: "authenticated_request",
  tenantId,
});

const familyContext: FamilyExecutionContext = {
  actorId: familyUserId,
  contextOrigin: "synthetic_test",
  correlationId: `activity-family-${randomUUID()}`,
  effectiveActorId: familyUserId,
  familyCapabilities: [PERMISSIONS.ACTIVITY_READ],
  purpose: "E5D_FAMILY_TEST",
  source: "authenticated_request",
};

async function seed(): Promise<void> {
  await migrationPool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    "Synthetic E5-D Tenant",
  ]);
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized) VALUES
       ($1, $2), ($3, $4), ($5, $6)`,
    [
      familyUserId,
      `e5d-family-${familyUserId}@example.invalid`,
      staffUserId,
      `e5d-staff-${staffUserId}@example.invalid`,
      otherStaffUserId,
      `e5d-other-${otherStaffUserId}@example.invalid`,
    ],
  );
  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [familyProfileId, familyUserId, "Familia E5-D sintética"],
  );
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [studentId, familyProfileId, "Estudiante", "Sintético"],
  );
  await runWithTenantContext(staffContext(), async () => {
    await withTenantTransaction(prisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: { code: "E5D-CAMPUS", name: "Sede sintética", tenantId },
      });
      const year = await transaction.academicYear.create({
        data: {
          code: "E5D-YEAR",
          label: "Año sintético",
          status: "OPEN",
          tenantId,
        },
      });
      const level = await transaction.courseLevel.create({
        data: { code: "E5D-LEVEL", name: "Nivel sintético", tenantId },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: "E5D-PROCESS",
          name: "Proceso sintético",
          status: "PUBLISHED",
          tenantId,
        },
      });
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: campus.id,
          code: "E5D-OFFER",
          courseLevelId: level.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId,
          title: "Oferta sintética",
        },
      });
      const application = await transaction.application.create({
        data: {
          academicYearId: year.id,
          draftData: { acknowledgedNoGuarantee: true, currentStep: "REVIEW" },
          familyProfileId,
          offeringId: offering.id,
          processId: process.id,
          studentId,
          tenantId,
        },
      });
      applicationId = application.id;
    });
  });
}

describe.sequential("E5-D activities domain", () => {
  const service = new ActivityService(prisma);

  beforeAll(async () => {
    await seed();
    await runWithTenantContext(staffContext(), async () => {
      const interview = await service.createDefinition(staffContext(), {
        code: "GUARDIAN_INTERVIEW",
        kind: "GUARDIAN_INTERVIEW",
        name: "Entrevista del apoderado",
      });
      const interviewVersion = await service.createVersion(
        staffContext(),
        interview.id,
        { durationMinutes: 45, required: true },
      );
      await service.publishVersion(staffContext(), interviewVersion.id);
      const diagnostic = await service.createDefinition(staffContext(), {
        code: "DIAGNOSTIC_EVALUATION",
        kind: "DIAGNOSTIC_EVALUATION",
        name: "Evaluación diagnóstica",
      });
      const diagnosticVersion = await service.createVersion(
        staffContext(),
        diagnostic.id,
        { durationMinutes: 60, required: true },
      );
      await service.publishVersion(staffContext(), diagnosticVersion.id);
    });
    await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        await pinApplicationActivities(transaction, {
          academicYearId: (
            await transaction.application.findUniqueOrThrow({
              where: { id: applicationId },
            })
          ).academicYearId,
          applicationId,
          courseLevelId: (
            await transaction.admissionOffering.findUniqueOrThrow({
              where: {
                id: (
                  await transaction.application.findUniqueOrThrow({
                    where: { id: applicationId },
                  })
                ).offeringId,
              },
            })
          ).courseLevelId,
          offeringId: (
            await transaction.application.findUniqueOrThrow({
              where: { id: applicationId },
            })
          ).offeringId,
          processId: (
            await transaction.application.findUniqueOrThrow({
              where: { id: applicationId },
            })
          ).processId,
          tenantId,
        });
        const activities = await transaction.applicationActivity.findMany({
          where: { applicationId },
          include: { definition: true },
        });
        interviewActivityId =
          activities.find(
            (activity) => activity.definition.kind === "GUARDIAN_INTERVIEW",
          )?.id ?? "";
        diagnosticActivityId =
          activities.find(
            (activity) => activity.definition.kind === "DIAGNOSTIC_EVALUATION",
          )?.id ?? "";
      }),
    );
  });

  it("E5D-CFG-01..10: publishes immutable versions and pins the exact version", async () => {
    expect(interviewActivityId).not.toBe("");
    expect(diagnosticActivityId).not.toBe("");
    const versionBefore = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityDefinitionVersion.findFirst({
          where: { lifecycle: "PUBLISHED" },
          orderBy: { versionNumber: "asc" },
        }),
      ),
    );
    expect(versionBefore?.durationMinutes).toBe(45);
    await expect(
      service.updateDraftVersion(staffContext(), versionBefore!.id, {
        durationMinutes: 30,
        required: true,
      }),
    ).rejects.toThrow();
    const pinned = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationActivity.findUniqueOrThrow({
          where: { id: interviewActivityId },
        }),
      ),
    );
    expect(pinned.activityDefinitionVersionId).toBe(versionBefore!.id);
  });

  it("E5D-SCH-01..12: schedules, reschedules with history, and rejects stale appointment", async () => {
    const scheduled = await runWithTenantContext(staffContext(), () =>
      service.schedule(staffContext(), interviewActivityId, {
        assignedUserId: staffUserId,
        location: "Sala sintética",
        newScheduledStartAt: new Date(Date.now() + 3_600_000),
      }),
    );
    const oldAppointmentId = scheduled.appointment!.id;
    const reprogrammed = await runWithTenantContext(staffContext(), () =>
      service.reprogram(staffContext(), interviewActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: oldAppointmentId,
        location: "Sala nueva",
        newScheduledStartAt: new Date(Date.now() + 7_200_000),
        reason: "Motivo sintético",
      }),
    );
    expect(reprogrammed.appointment!.id).not.toBe(oldAppointmentId);
    expect(
      reprogrammed.appointmentHistory.find(
        (appointment) => appointment.id === oldAppointmentId,
      )?.status,
    ).toBe("REPROGRAMADA");
    await expect(
      runWithTenantContext(staffContext(), () =>
        service.reprogram(staffContext(), interviewActivityId, {
          assignedUserId: staffUserId,
          expectedAppointmentId: oldAppointmentId,
          location: "Sala stale",
          newScheduledStartAt: new Date(Date.now() + 10_800_000),
          reason: "Stale",
        }),
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_APPOINTMENT_CHANGED" });
  });

  it("E5D-ATT/RES/AUTH: records no-show without closing and hides results from family", async () => {
    const scheduled = await runWithTenantContext(staffContext(), () =>
      service.schedule(staffContext(), diagnosticActivityId, {
        assignedUserId: staffUserId,
        location: "Sala diagnóstica",
        newScheduledStartAt: new Date(Date.now() - 3_600_000),
      }),
    );
    const noShow = await runWithTenantContext(staffContext(), () =>
      service.recordOutcome(staffContext(), diagnosticActivityId, {
        expectedAppointmentId: scheduled.appointment!.id,
        noShowJustified: false,
        occurredAt: new Date(Date.now() + 10_800_000),
        operationalOutcome: "INASISTENCIA",
      }),
    );
    expect(noShow.status).toBe("INASISTENCIA");
    const familyActivities = await runWithFamilyContext(familyContext, () =>
      runWithTenantContext(
        {
          ...staffContext([PERMISSIONS.APPLICATION_READ]),
          actorId: familyUserId,
          effectiveActorId: familyUserId,
          purpose: "E5D_FAMILY_TEST",
        },
        () =>
          service.listFamilyActivities(
            familyContext,
            {
              ...staffContext([PERMISSIONS.APPLICATION_READ]),
              actorId: familyUserId,
              effectiveActorId: familyUserId,
              purpose: "E5D_FAMILY_TEST",
            },
            applicationId,
          ),
      ),
    );
    expect(familyActivities[1]?.activityId).toBeDefined();
    expect(JSON.stringify(familyActivities)).not.toContain("results");
    const operationalOnly = await runWithTenantContext(
      {
        ...staffContext([PERMISSIONS.ACTIVITY_READ]),
        capabilities: [PERMISSIONS.ACTIVITY_READ],
      },
      () =>
        service.listStaffActivities(
          {
            ...staffContext([PERMISSIONS.ACTIVITY_READ]),
            capabilities: [PERMISSIONS.ACTIVITY_READ],
          },
          applicationId,
        ),
    );
    expect(operationalOnly[0]?.results).toEqual([]);
  });

  it("E5D-RES-07..12: assigned executor records a result and repeat preserves attempts", async () => {
    const current = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationActivity.findUniqueOrThrow({
          where: { id: diagnosticActivityId },
        }),
      ),
    );
    const activity = await runWithTenantContext(staffContext(), () =>
      service.reprogram(staffContext(), diagnosticActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: current.currentAppointmentId!,
        location: "Sala diagnóstica 2",
        newScheduledStartAt: new Date(Date.now() - 3_600_000),
        reason: "Segundo intento sintético",
      }),
    );
    const notCompleted = await runWithTenantContext(staffContext(), () =>
      service.recordOutcome(staffContext(), diagnosticActivityId, {
        expectedAppointmentId: activity.appointment!.id,
        occurredAt: new Date(),
        operationalOutcome: "NO_COMPLETADA",
        result: "INCONCLUSO",
        reason: "Evidencia sintética",
      }),
    );
    const repeated = await runWithTenantContext(staffContext(), () =>
      service.repeat(staffContext(), diagnosticActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: activity.appointment!.id,
        location: "Sala repetición",
        newScheduledStartAt: new Date(Date.now() + 3_600_000),
        reason: "Repetición autorizada",
      }),
    );
    expect(repeated.appointment!.id).not.toBe(activity.appointment!.id);
    expect(notCompleted.attempts).toHaveLength(2);
    const completed = await runWithTenantContext(staffContext(), () =>
      service.recordOutcome(staffContext(), diagnosticActivityId, {
        expectedAppointmentId: repeated.appointment!.id,
        occurredAt: new Date(),
        operationalOutcome: "REALIZADA",
        result: "FAVORABLE",
        comment: "Comentario interno sintético",
      }),
    );
    expect(completed.results.at(-1)?.result).toBe("FAVORABLE");
    const wrongExecutor = {
      ...staffContext(),
      actorId: otherStaffUserId,
      effectiveActorId: otherStaffUserId,
    };
    await expect(
      runWithTenantContext(wrongExecutor, () =>
        service.recordOutcome(wrongExecutor, diagnosticActivityId, {
          expectedAppointmentId: repeated.appointment!.id,
          occurredAt: new Date(),
          operationalOutcome: "REALIZADA",
          result: "FAVORABLE",
        }),
      ),
    ).rejects.toBeInstanceOf(ActivityConflictError);
  });

  it("E5D-ATT-05..10: second unjustified no-show enables but does not perform auto-close", async () => {
    const current = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationActivity.findUniqueOrThrow({
          where: { id: interviewActivityId },
        }),
      ),
    );
    await runWithTenantContext(staffContext(), () =>
      service.recordOutcome(staffContext(), interviewActivityId, {
        expectedAppointmentId: current.currentAppointmentId!,
        occurredAt: new Date(Date.now() + 10_800_000),
        noShowJustified: false,
        operationalOutcome: "INASISTENCIA",
      }),
    );
    const afterFirstNoShow = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.applicationActivity.findUniqueOrThrow({
          where: { id: interviewActivityId },
        }),
      ),
    );
    const rescheduled = await runWithTenantContext(staffContext(), () =>
      service.reprogram(staffContext(), interviewActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: afterFirstNoShow.currentAppointmentId!,
        location: "Sala no-show",
        newScheduledStartAt: new Date(Date.now() - 3_600_000),
        reason: "Segundo no-show sintético",
      }),
    );
    const afterSecond = await runWithTenantContext(staffContext(), () =>
      service.recordOutcome(staffContext(), interviewActivityId, {
        expectedAppointmentId: rescheduled.appointment!.id,
        occurredAt: new Date(),
        noShowJustified: false,
        operationalOutcome: "INASISTENCIA",
      }),
    );
    expect(afterSecond.status).toBe("INASISTENCIA");
    expect(afterSecond.manualClosureEligible).toBe(true);
    const closed = await runWithTenantContext(staffContext(), () =>
      service.closeActivityAfterNoShows(
        staffContext(),
        interviewActivityId,
        "Cierre manual sintético",
      ),
    );
    expect(closed.status).toBe("CERRADA");
  });

  afterAll(async () => {
    await migrationPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await prisma.$disconnect();
    await migrationPool.end();
  });
});
