import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ActivityConflictError,
  ActivityService,
  ForbiddenError,
  PERMISSIONS,
  SENSITIVITIES,
  createAppPrismaClient,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { createVerifiedSupportElevation } from "./tenant-execution-context.js";
import { getRequiredEnvironment } from "./environment.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});
const service = new ActivityService(prisma);

const tenantId = randomUUID();
const staffUserId = randomUUID();
const backupUserId = randomUUID();
const staffMembershipId = randomUUID();
const backupMembershipId = randomUUID();
const familyUserId = randomUUID();
const familyProfileId = randomUUID();
const studentId = randomUUID();
let applicationId = "";
let scheduleActivityId = "";
let reprogramActivityId = "";
let repeatActivityId = "";
let outcomeActivityId = "";
let closeActivityId = "";
let familyActivityId = "";
let resourceOfferingId = "";
let resourceProcessId = "";
let resourceCampusId = "";

const allCapabilities = [
  PERMISSIONS.ACTIVITY_READ,
  PERMISSIONS.ACTIVITY_SCHEDULE,
  PERMISSIONS.ACTIVITY_PERFORM,
  PERMISSIONS.ACTIVITY_RESULT_READ,
  PERMISSIONS.ACTIVITY_REPEAT,
  PERMISSIONS.ACTIVITY_CLOSE,
  PERMISSIONS.RESTRICTED_READ,
];

function staffContext(
  scopes: readonly string[] = ["*"],
  capabilities: readonly string[] = allCapabilities,
): TenantExecutionContext {
  return {
    actorId: staffUserId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5d-hardening-${randomUUID()}`,
    effectiveActorId: staffUserId,
    purpose: "E5D_HARDENING_TEST",
    scopes,
    source: "authenticated_request",
    tenantId,
  };
}

const familyContext: FamilyExecutionContext = {
  actorId: familyUserId,
  contextOrigin: "synthetic_test",
  correlationId: `e5d-family-hardening-${randomUUID()}`,
  effectiveActorId: familyUserId,
  familyCapabilities: [PERMISSIONS.ACTIVITY_READ],
  purpose: "E5D_FAMILY_HARDENING_TEST",
  source: "authenticated_request",
};

async function seed(): Promise<void> {
  await migrationPool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    "E5-D hardening sintético",
  ]);
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized) VALUES
      ($1, $2), ($3, $4), ($5, $6)`,
    [
      staffUserId,
      `e5d-hardening-staff-${staffUserId}@example.invalid`,
      familyUserId,
      `e5d-hardening-family-${familyUserId}@example.invalid`,
      backupUserId,
      `e5d-hardening-backup-${backupUserId}@example.invalid`,
    ],
  );
  await migrationPool.query(
    `INSERT INTO family_profiles (id, user_id, display_name)
     VALUES ($1, $2, $3)`,
    [familyProfileId, familyUserId, "Familia hardening sintética"],
  );
  await migrationPool.query(
    `INSERT INTO students (id, family_profile_id, given_name, family_name)
     VALUES ($1, $2, $3, $4)`,
    [studentId, familyProfileId, "Estudiante", "Hardening"],
  );

  await runWithTenantContext(staffContext(), () =>
    withTenantTransaction(prisma, async (transaction) => {
      await transaction.membership.createMany({
        data: [
          {
            id: staffMembershipId,
            startsAt: new Date(Date.now() - 60_000),
            status: "ACTIVE",
            tenantId,
            userId: staffUserId,
          },
          {
            id: backupMembershipId,
            startsAt: new Date(Date.now() - 60_000),
            status: "ACTIVE",
            tenantId,
            userId: backupUserId,
          },
        ],
      });
      await transaction.roleAssignment.createMany({
        data: [staffMembershipId, backupMembershipId].map((membershipId) => ({
          membershipId,
          permissions: [PERMISSIONS.ACTIVITY_PERFORM],
          roleKey: "synthetic-activity-executor",
          scopes: ["*"],
          startsAt: new Date(Date.now() - 60_000),
          status: "ACTIVE" as const,
          tenantId,
        })),
      });
      await transaction.tenantActivityPolicy.createMany({
        data: [
          {
            backupMembershipId,
            createdBy: staffUserId,
            defaultDurationMinutes: 30,
            kind: "GUARDIAN_INTERVIEW",
            primaryMembershipId: staffMembershipId,
            tenantId,
            updatedBy: staffUserId,
          },
          {
            backupMembershipId,
            createdBy: staffUserId,
            defaultDurationMinutes: 60,
            kind: "DIAGNOSTIC_EVALUATION",
            primaryMembershipId: staffMembershipId,
            tenantId,
            updatedBy: staffUserId,
          },
        ],
      });
      const campus = await transaction.campus.create({
        data: {
          code: "E5D-HARDENING-CAMPUS",
          name: "Sede hardening",
          tenantId,
        },
      });
      resourceCampusId = campus.id;
      const year = await transaction.academicYear.create({
        data: {
          code: "E5D-HARDENING-YEAR",
          label: "Año hardening",
          status: "OPEN",
          tenantId,
        },
      });
      const level = await transaction.courseLevel.create({
        data: {
          code: "E5D-HARDENING-LEVEL",
          name: "Nivel hardening",
          tenantId,
        },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: "E5D-HARDENING-PROCESS",
          name: "Proceso hardening",
          status: "PUBLISHED",
          tenantId,
        },
      });
      resourceProcessId = process.id;
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: campus.id,
          code: "E5D-HARDENING-OFFER",
          courseLevelId: level.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId,
          title: "Oferta hardening",
        },
      });
      resourceOfferingId = offering.id;
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

      async function createActivity(
        index: number,
        kind: "GUARDIAN_INTERVIEW" | "DIAGNOSTIC_EVALUATION",
        state:
          "UNSCHEDULED" | "SCHEDULED" | "REPEATABLE" | "OUTCOME" | "CLOSEABLE",
      ): Promise<string> {
        const definition = await transaction.activityDefinition.create({
          data: {
            code: `E5D-HARDENING-ACT-${index}`,
            kind,
            name: `Actividad hardening ${index}`,
            tenantId,
          },
        });
        const version = await transaction.activityDefinitionVersion.create({
          data: {
            activityDefinitionId: definition.id,
            durationMinutes: 30,
            durationSource: "VERSION_OVERRIDE",
            lifecycle: "PUBLISHED",
            publishedAt: new Date(),
            required: true,
            tenantId,
            versionNumber: 1,
          },
        });
        const activity = await transaction.applicationActivity.create({
          data: {
            activityDefinitionId: definition.id,
            activityDefinitionVersionId: version.id,
            applicationId,
            pinnedAt: new Date(),
            status:
              state === "UNSCHEDULED"
                ? "PENDIENTE"
                : state === "CLOSEABLE"
                  ? "INASISTENCIA"
                  : state === "REPEATABLE"
                    ? "NO_COMPLETADA"
                    : "PROGRAMADA",
            tenantId,
          },
        });
        if (state === "UNSCHEDULED") return activity.id;
        const appointment = await transaction.activityAppointment.create({
          data: {
            applicationActivityId: activity.id,
            assignedUserId: staffUserId,
            createdBy: staffUserId,
            durationMinutes: 30,
            location: `Sala hardening ${index}`,
            scheduledStartAt: new Date(Date.now() - 3_600_000),
            sequence: 1,
            status:
              state === "REPEATABLE" || state === "CLOSEABLE"
                ? state === "REPEATABLE"
                  ? "NO_COMPLETADA"
                  : "INASISTENCIA"
                : "PROGRAMADA",
            tenantId,
          },
        });
        await transaction.applicationActivity.update({
          data: { currentAppointmentId: appointment.id },
          where: { id: activity.id },
        });
        if (state === "REPEATABLE") {
          await transaction.activityAttempt.create({
            data: {
              applicationActivityId: activity.id,
              appointmentId: appointment.id,
              occurredAt: new Date(Date.now() - 1_800_000),
              operationalOutcome: "NO_COMPLETADA",
              recordedBy: staffUserId,
              sequence: 1,
              tenantId,
            },
          });
        }
        if (state === "CLOSEABLE") {
          const first = await transaction.activityAttempt.create({
            data: {
              applicationActivityId: activity.id,
              appointmentId: appointment.id,
              noShowJustified: false,
              occurredAt: new Date(Date.now() - 1_800_000),
              operationalOutcome: "INASISTENCIA",
              recordedBy: staffUserId,
              sequence: 1,
              tenantId,
            },
          });
          await transaction.activityAttempt.create({
            data: {
              applicationActivityId: activity.id,
              appointmentId: appointment.id,
              noShowJustified: false,
              occurredAt: new Date(Date.now() - 900_000),
              operationalOutcome: "INASISTENCIA",
              previousAttemptId: first.id,
              recordedBy: staffUserId,
              sequence: 2,
              tenantId,
            },
          });
        }
        return activity.id;
      }

      scheduleActivityId = await createActivity(
        1,
        "GUARDIAN_INTERVIEW",
        "UNSCHEDULED",
      );
      reprogramActivityId = await createActivity(
        2,
        "GUARDIAN_INTERVIEW",
        "SCHEDULED",
      );
      repeatActivityId = await createActivity(
        3,
        "DIAGNOSTIC_EVALUATION",
        "REPEATABLE",
      );
      outcomeActivityId = await createActivity(
        4,
        "GUARDIAN_INTERVIEW",
        "OUTCOME",
      );
      closeActivityId = await createActivity(
        5,
        "GUARDIAN_INTERVIEW",
        "CLOSEABLE",
      );
      familyActivityId = await createActivity(
        6,
        "GUARDIAN_INTERVIEW",
        "SCHEDULED",
      );
    }),
  );
}

async function currentAppointmentId(activityId: string): Promise<string> {
  return runWithTenantContext(staffContext(), () =>
    withTenantTransaction(
      prisma,
      async (transaction) =>
        (
          await transaction.applicationActivity.findUniqueOrThrow({
            where: { id: activityId },
          })
        ).currentAppointmentId!,
    ),
  );
}

async function twenty<T>(
  operation: () => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(
    Array.from({ length: 20 }, () =>
      runWithTenantContext(staffContext(), operation),
    ),
  );
}

function countFulfilled<T>(results: PromiseSettledResult<T>[]): number {
  return results.filter((result) => result.status === "fulfilled").length;
}

function expectControlledConflicts<T>(
  results: PromiseSettledResult<T>[],
): void {
  for (const result of results) {
    if (result.status === "rejected") {
      expect(result.reason).toBeInstanceOf(ActivityConflictError);
    }
  }
}

describe.sequential("E5-D hardening concurrency and authorization", () => {
  beforeAll(seed);

  it("E5D-CON-01: twenty initial schedules fence to one current appointment", async () => {
    const results = await twenty(() =>
      service.schedule(staffContext(), scheduleActivityId, {
        assignedUserId: staffUserId,
        location: "Sala schedule concurrente",
        newScheduledStartAt: new Date(Date.now() + 3_600_000),
      }),
    );
    expect(countFulfilled(results)).toBe(1);
    expectControlledConflicts(results);
    await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        const appointments = await transaction.activityAppointment.findMany({
          where: { applicationActivityId: scheduleActivityId },
        });
        expect(appointments).toHaveLength(1);
        expect(appointments[0]?.sequence).toBe(1);
      }),
    );
  });

  it("E5D-CON-02: twenty reprograms with one token create one new appointment", async () => {
    const expected = await currentAppointmentId(reprogramActivityId);
    const results = await twenty(() =>
      service.reprogram(staffContext(), reprogramActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: expected,
        location: "Sala reprogramación concurrente",
        newScheduledStartAt: new Date(Date.now() + 7_200_000),
      }),
    );
    expect(countFulfilled(results)).toBe(1);
    expectControlledConflicts(results);
    await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        const appointments = await transaction.activityAppointment.findMany({
          where: { applicationActivityId: reprogramActivityId },
          orderBy: { sequence: "asc" },
        });
        expect(appointments.map((appointment) => appointment.sequence)).toEqual(
          [1, 2],
        );
      }),
    );
  });

  it("E5D-CON-REPEAT-01: twenty repeats require the same token and create one appointment", async () => {
    const expected = await currentAppointmentId(repeatActivityId);
    const results = await twenty(() =>
      service.repeat(staffContext(), repeatActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: expected,
        location: "Sala repeat concurrente",
        newScheduledStartAt: new Date(Date.now() + 10_800_000),
        reason: "Repeat concurrente sintético",
      }),
    );
    expect(countFulfilled(results)).toBe(1);
    expectControlledConflicts(results);
    await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        const appointments = await transaction.activityAppointment.findMany({
          where: { applicationActivityId: repeatActivityId },
          orderBy: { sequence: "asc" },
        });
        expect(appointments.map((appointment) => appointment.sequence)).toEqual(
          [1, 2],
        );
      }),
    );
  });

  it("E5D-CON-04: twenty outcome writes create exactly one attempt", async () => {
    const expected = await currentAppointmentId(outcomeActivityId);
    const results = await twenty(() =>
      service.recordOutcome(staffContext(), outcomeActivityId, {
        expectedAppointmentId: expected,
        operationalOutcome: "NO_COMPLETADA",
        result: "INCONCLUSO",
        occurredAt: new Date(),
      }),
    );
    expect(countFulfilled(results)).toBe(1);
    expectControlledConflicts(results);
    await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        const attempts = await transaction.activityAttempt.count({
          where: { applicationActivityId: outcomeActivityId },
        });
        expect(attempts).toBe(1);
      }),
    );
  });

  it("E5D-CON-05: close versus reprogram cannot leave closed plus scheduled current", async () => {
    const expected = await currentAppointmentId(closeActivityId);
    const results = await Promise.allSettled([
      runWithTenantContext(staffContext(), () =>
        service.closeActivityAfterNoShows(
          staffContext(),
          closeActivityId,
          "Cierre concurrente sintético",
        ),
      ),
      runWithTenantContext(staffContext(), () =>
        service.reprogram(staffContext(), closeActivityId, {
          assignedUserId: staffUserId,
          expectedAppointmentId: expected,
          location: "Sala close/reprogram",
          newScheduledStartAt: new Date(Date.now() + 14_400_000),
        }),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, async (transaction) => {
        const activity =
          await transaction.applicationActivity.findUniqueOrThrow({
            where: { id: closeActivityId },
            include: { currentAppointment: true },
          });
        expect(
          activity.status === "CERRADA" &&
            activity.currentAppointment?.status === "PROGRAMADA",
        ).toBe(false);
      }),
    );
  });

  it("E5D-FAM-CON-01/02: family request fences the visualized appointment", async () => {
    const applicantContext: TenantExecutionContext = {
      ...staffContext(["*"], [PERMISSIONS.APPLICATION_READ]),
      actorId: familyUserId,
      effectiveActorId: familyUserId,
      purpose: "E5D_FAMILY_HARDENING_TEST",
    };
    const appointmentA = await currentAppointmentId(familyActivityId);
    await runWithTenantContext(staffContext(), () =>
      service.reprogram(staffContext(), familyActivityId, {
        assignedUserId: staffUserId,
        expectedAppointmentId: appointmentA,
        location: "Sala family B",
        newScheduledStartAt: new Date(Date.now() + 18_000_000),
      }),
    );
    const appointmentB = await currentAppointmentId(familyActivityId);
    await expect(
      runWithFamilyContext(familyContext, () =>
        runWithTenantContext(applicantContext, () =>
          service.requestFamilyReschedule(
            familyContext,
            applicantContext,
            applicationId,
            familyActivityId,
            appointmentA,
            "Solicitud stale sintética",
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_APPOINTMENT_CHANGED" });
    const afterStale = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityRescheduleRequest.count({
          where: { applicationActivityId: familyActivityId },
        }),
      ),
    );
    expect(afterStale).toBe(0);
    const currentRequest = await runWithFamilyContext(familyContext, () =>
      runWithTenantContext(applicantContext, () =>
        service.requestFamilyReschedule(
          familyContext,
          applicantContext,
          applicationId,
          familyActivityId,
          appointmentB,
          "Solicitud current sintética",
        ),
      ),
    );
    expect(currentRequest.status).toBe("PENDING");
    expect(
      await runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityRescheduleRequest.count({
            where: {
              applicationActivityId: familyActivityId,
              appointmentId: appointmentB,
            },
          }),
        ),
      ),
    ).toBe(1);
  });

  it("E5D-EXEC-01..04: assignment requires an active platform user and tenant membership", async () => {
    async function freshActivity(): Promise<string> {
      return runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, async (transaction) => {
          const definition = await transaction.activityDefinition.create({
            data: {
              code: `E5D-HARDENING-EXEC-${randomUUID()}`,
              kind: "GUARDIAN_INTERVIEW",
              name: "Actividad executor sintética",
              tenantId,
            },
          });
          const version = await transaction.activityDefinitionVersion.create({
            data: {
              activityDefinitionId: definition.id,
              durationMinutes: 30,
              durationSource: "VERSION_OVERRIDE",
              lifecycle: "PUBLISHED",
              publishedAt: new Date(),
              required: true,
              tenantId,
              versionNumber: 1,
            },
          });
          const activity = await transaction.applicationActivity.create({
            data: {
              activityDefinitionId: definition.id,
              activityDefinitionVersionId: version.id,
              applicationId,
              pinnedAt: new Date(),
              tenantId,
            },
          });
          return activity.id;
        }),
      );
    }
    async function createUser(status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
      const userId = randomUUID();
      await migrationPool.query(
        "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
        [userId, `e5d-executor-${userId}@example.invalid`],
      );
      await runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.membership.create({
            data: {
              id: randomUUID(),
              startsAt: new Date(Date.now() - 60_000),
              status,
              tenantId,
              userId,
            },
          }),
        ),
      );
      return userId;
    }
    const missingActivity = await freshActivity();
    await expect(
      runWithTenantContext(staffContext(), () =>
        service.schedule(staffContext(), missingActivity, {
          assignedUserId: randomUUID(),
          location: "Sala executor inexistente",
          newScheduledStartAt: new Date(Date.now() + 3_600_000),
        }),
      ),
    ).rejects.toMatchObject({
      code: "ASSIGNED_EXECUTOR_NOT_PRIMARY_OR_BACKUP",
    });

    const outsiderId = randomUUID();
    await migrationPool.query(
      "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
      [outsiderId, `e5d-executor-outsider-${outsiderId}@example.invalid`],
    );
    const outsiderActivity = await freshActivity();
    await expect(
      runWithTenantContext(staffContext(), () =>
        service.schedule(staffContext(), outsiderActivity, {
          assignedUserId: outsiderId,
          location: "Sala executor sin membership",
          newScheduledStartAt: new Date(Date.now() + 3_600_000),
        }),
      ),
    ).rejects.toMatchObject({
      code: "ASSIGNED_EXECUTOR_NOT_PRIMARY_OR_BACKUP",
    });

    for (const status of ["SUSPENDED", "REVOKED"] as const) {
      const userId = await createUser(status);
      const activity = await freshActivity();
      await expect(
        runWithTenantContext(staffContext(), () =>
          service.schedule(staffContext(), activity, {
            assignedUserId: userId,
            location: `Sala executor ${status}`,
            newScheduledStartAt: new Date(Date.now() + 3_600_000),
          }),
        ),
      ).rejects.toMatchObject({
        code: "ASSIGNED_EXECUTOR_NOT_PRIMARY_OR_BACKUP",
      });
    }

    await createUser("ACTIVE");
    const validActivity = await freshActivity();
    const scheduled = await runWithTenantContext(staffContext(), () =>
      service.schedule(staffContext(), validActivity, {
        assignedUserId: backupUserId,
        location: "Sala executor válido",
        newScheduledStartAt: new Date(Date.now() + 3_600_000),
      }),
    );
    expect(scheduled.assignedUserId).toBe(backupUserId);
  });

  it("E5D-SCOPE-01..08: activity resources accept derived scopes and bound support elevation", async () => {
    const capabilities = [PERMISSIONS.ACTIVITY_READ];
    for (const scope of [
      `application:${applicationId}`,
      `offering:${resourceOfferingId}`,
      `process:${resourceProcessId}`,
      `campus:${resourceCampusId}`,
      "*",
    ]) {
      await expect(
        runWithTenantContext(staffContext([scope], capabilities), () =>
          service.getStaffActivity(
            staffContext([scope], capabilities),
            familyActivityId,
          ),
        ),
      ).resolves.toBeDefined();
    }
    await expect(
      runWithTenantContext(
        staffContext([`application:${randomUUID()}`], capabilities),
        () =>
          service.getStaffActivity(
            staffContext([`application:${randomUUID()}`], capabilities),
            familyActivityId,
          ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const elevation = createVerifiedSupportElevation({
      categories: [SENSITIVITIES.RESTRICTED],
      expiresAt: new Date(Date.now() + 60_000),
      id: randomUUID(),
      purpose: "E5D_HARDENING_TEST",
      scopes: [`application:${applicationId}`],
      tenantId,
    });
    const support: TenantExecutionContext = {
      actorId: staffUserId,
      capabilities: [
        PERMISSIONS.ACTIVITY_READ,
        PERMISSIONS.ACTIVITY_RESULT_READ,
      ],
      contextOrigin: "support_elevation",
      correlationId: `e5d-support-${randomUUID()}`,
      effectiveActorId: staffUserId,
      purpose: elevation.purpose,
      scopes: elevation.scopes,
      source: "authenticated_request",
      supportElevation: elevation,
      tenantId,
    };
    await expect(
      runWithTenantContext(support, () =>
        service.getStaffActivity(support, familyActivityId),
      ),
    ).resolves.toBeDefined();
    const wrongElevation = {
      ...support,
      scopes: [`application:${randomUUID()}`],
      supportElevation: createVerifiedSupportElevation({
        ...elevation,
        scopes: [`application:${randomUUID()}`],
      }),
    };
    await expect(
      runWithTenantContext(wrongElevation, () =>
        service.getStaffActivity(wrongElevation, familyActivityId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const highEvidence = await runWithTenantContext(
      staffContext([`application:${applicationId}`]),
      () =>
        service.getStaffActivity(
          staffContext([`application:${applicationId}`]),
          outcomeActivityId,
        ),
    );
    expect(highEvidence.results.length).toBeGreaterThan(0);
    expect(
      await runWithTenantContext(support, () =>
        service.getStaffActivity(support, outcomeActivityId),
      ),
    ).toMatchObject({ results: [] });
  });

  it("E5D-DB-01..05: history seals reject cross-aggregate and self references", async () => {
    const foreignAppointment = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityAppointment.findFirstOrThrow({
          where: { applicationActivityId: reprogramActivityId },
        }),
      ),
    );
    await expect(
      runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityAppointment.create({
            data: {
              applicationActivityId: scheduleActivityId,
              assignedUserId: staffUserId,
              createdBy: staffUserId,
              durationMinutes: 30,
              location: "Sala DB cross activity",
              previousAppointmentId: foreignAppointment.id,
              scheduledStartAt: new Date(Date.now() + 20_000_000),
              sequence: 2,
              tenantId,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    const sameActivityPrevious = await runWithTenantContext(
      staffContext(),
      () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityAppointment.findFirstOrThrow({
            where: { applicationActivityId: scheduleActivityId },
          }),
        ),
    );
    await expect(
      runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityAppointment.create({
            data: {
              applicationActivityId: scheduleActivityId,
              assignedUserId: staffUserId,
              createdBy: staffUserId,
              durationMinutes: 30,
              location: "Sala DB same activity",
              previousAppointmentId: sameActivityPrevious.id,
              scheduledStartAt: new Date(Date.now() + 21_000_000),
              sequence: 2,
              tenantId,
            },
          }),
        ),
      ),
    ).resolves.toBeDefined();
    const selfAppointmentId = randomUUID();
    await expect(
      runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityAppointment.create({
            data: {
              applicationActivityId: scheduleActivityId,
              assignedUserId: staffUserId,
              createdBy: staffUserId,
              durationMinutes: 30,
              id: selfAppointmentId,
              location: "Sala DB self appointment",
              previousAppointmentId: selfAppointmentId,
              scheduledStartAt: new Date(Date.now() + 22_000_000),
              sequence: 3,
              tenantId,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const firstResult = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityResult.findFirstOrThrow({
          where: { applicationActivityId: outcomeActivityId },
        }),
      ),
    );
    const firstAttempt = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityAttempt.findFirstOrThrow({
          where: { applicationActivityId: outcomeActivityId },
        }),
      ),
    );
    const secondAttempt = await runWithTenantContext(staffContext(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityAttempt.create({
          data: {
            applicationActivityId: outcomeActivityId,
            appointmentId: firstAttempt.appointmentId,
            occurredAt: new Date(),
            operationalOutcome: "NO_COMPLETADA",
            previousAttemptId: firstAttempt.id,
            recordedBy: staffUserId,
            sequence: 2,
            tenantId,
          },
        }),
      ),
    );
    await expect(
      runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityResult.create({
            data: {
              applicationActivityId: outcomeActivityId,
              attemptId: secondAttempt.id,
              previousResultId: firstResult.id,
              recordedBy: staffUserId,
              result: "INCONCLUSO",
              tenantId,
              versionNumber: 1,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityResult.create({
            data: {
              applicationActivityId: outcomeActivityId,
              attemptId: firstAttempt.id,
              previousResultId: firstResult.id,
              recordedBy: staffUserId,
              result: "INCONCLUSO",
              tenantId,
              versionNumber: 2,
            },
          }),
        ),
      ),
    ).resolves.toBeDefined();
    const selfResultId = randomUUID();
    await expect(
      runWithTenantContext(staffContext(), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityResult.create({
            data: {
              applicationActivityId: outcomeActivityId,
              attemptId: firstAttempt.id,
              id: selfResultId,
              previousResultId: selfResultId,
              recordedBy: staffUserId,
              result: "INCONCLUSO",
              tenantId,
              versionNumber: 3,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  afterAll(async () => {
    await migrationPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await prisma.$disconnect();
    await migrationPool.end();
  });
});
