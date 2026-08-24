import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow, ForbiddenError } from "./authorization.js";
import {
  ActivityConflictError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./domain-errors.js";
import {
  PERMISSIONS,
  SENSITIVITIES,
  type PermissionKey,
} from "./permission-catalog.js";
import type {
  FamilyExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const ACTIVITY_KINDS = [
  "GUARDIAN_INTERVIEW",
  "DIAGNOSTIC_EVALUATION",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_STATUSES = [
  "PENDIENTE",
  "PROGRAMADA",
  "REALIZADA",
  "REPROGRAMADA",
  "INASISTENCIA",
  "EXENTA",
  "NO_COMPLETADA",
  "CERRADA",
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type ActivityAttemptOutcome =
  "REALIZADA" | "INASISTENCIA" | "NO_COMPLETADA";
export type ActivityResultValue = "FAVORABLE" | "NO_FAVORABLE" | "INCONCLUSO";

export interface ActivityDefinitionInput {
  code: string;
  kind: ActivityKind;
  name: string;
}

export interface ActivityVersionInput {
  durationMinutes: number;
  instructions?: string | null | undefined;
  lateToleranceMinutes?: number | undefined;
  maxNormalReschedules?: number | undefined;
  required: boolean;
  scopeAcademicYearId?: string | null | undefined;
  scopeCourseLevelId?: string | null | undefined;
  scopeOfferingId?: string | null | undefined;
  scopeProcessId?: string | null | undefined;
}

export interface StaffScheduleInput {
  assignedUserId: string;
  expectedAppointmentId?: string | undefined;
  location: string;
  newScheduledStartAt: Date;
  reason?: string | undefined;
  rescheduleRequestId?: string | undefined;
}

export interface RecordOutcomeInput {
  comment?: string | null | undefined;
  expectedAppointmentId: string;
  noShowJustified?: boolean | undefined;
  occurredAt?: Date | undefined;
  operationalOutcome: ActivityAttemptOutcome;
  reason?: string | undefined;
  result?: ActivityResultValue | undefined;
}

export interface RepeatActivityInput {
  assignedUserId: string;
  expectedAppointmentId: string;
  location: string;
  newScheduledStartAt: Date;
  reason: string;
}

export interface ActivityDefinitionDto {
  code: string;
  id: string;
  kind: ActivityKind;
  name: string;
  versions: ActivityVersionDto[];
}

export interface ActivityVersionDto {
  archivedAt: string | null;
  durationMinutes: number;
  id: string;
  instructions: string | null;
  lateToleranceMinutes: number;
  lifecycle: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  maxNormalReschedules: number;
  modality: "IN_PERSON";
  publishedAt: string | null;
  required: boolean;
  scope: {
    academicYearId: string | null;
    courseLevelId: string | null;
    offeringId: string | null;
    processId: string | null;
  };
  versionNumber: number;
}

export interface FamilyActivityDto {
  activityDefinitionId: string;
  activityId: string;
  instructions: string | null;
  kind: ActivityKind;
  modality: "IN_PERSON";
  name: string;
  nextStep: string;
  required: boolean;
  reschedule: {
    normalReschedulesMade: number;
    normalReschedulesRemaining: number;
    pendingRequest: boolean;
  };
  status: ActivityStatus;
  appointment: {
    durationMinutes: number;
    id: string;
    location: string;
    scheduledStartAt: string;
    status: string;
  } | null;
  appointmentHistory: Array<{
    durationMinutes: number;
    id: string;
    location: string;
    scheduledStartAt: string;
    status: string;
  }>;
}

export interface StaffActivityDto extends FamilyActivityDto {
  attempts: Array<{
    id: string;
    noShowJustified: boolean | null;
    occurredAt: string;
    operationalOutcome: ActivityAttemptOutcome;
    reason: string | null;
    sequence: number;
  }>;
  assignedUserId: string | null;
  manualClosureEligible: boolean;
  rescheduleRequests: Array<{
    appointmentId: string;
    createdAt: string;
    id: string;
    reason: string;
    status: "PENDING" | "FULFILLED";
  }>;
  results: Array<{
    attemptId: string;
    comment: string | null;
    createdAt: string;
    id: string;
    result: ActivityResultValue;
    versionNumber: number;
  }>;
}

type ActivityWithRelations = Prisma.ApplicationActivityGetPayload<{
  include: {
    application: {
      select: {
        id: true;
        tenantId: true;
        offeringId: true;
        processId: true;
        offering: { select: { campusId: true } };
      };
    };
    definition: true;
    definitionVersion: true;
    appointments: { orderBy: { sequence: "asc" } };
    rescheduleRequests: { orderBy: { createdAt: "asc" } };
    attempts: { orderBy: { sequence: "asc" } };
    results: { orderBy: { createdAt: "asc" } };
  };
}>;

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function cleanText(value: string, field: string, max: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) {
    throw new IntakeValidationError(`Invalid ${field}`);
  }
  if (
    /<\s*\/??\s*(script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(
      normalized,
    )
  ) {
    throw new IntakeValidationError(`Invalid ${field}`);
  }
  return normalized;
}

function validateConfiguration(input: ActivityVersionInput): void {
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes <= 0 ||
    input.durationMinutes > 1440
  ) {
    throw new IntakeValidationError(
      "Activity duration must be between 1 and 1440 minutes",
    );
  }
  const maxNormalReschedules = input.maxNormalReschedules ?? 2;
  const lateToleranceMinutes = input.lateToleranceMinutes ?? 15;
  if (
    !Number.isInteger(maxNormalReschedules) ||
    maxNormalReschedules < 0 ||
    maxNormalReschedules > 100
  ) {
    throw new IntakeValidationError("Invalid maxNormalReschedules");
  }
  if (
    !Number.isInteger(lateToleranceMinutes) ||
    lateToleranceMinutes < 0 ||
    lateToleranceMinutes > 1440
  ) {
    throw new IntakeValidationError("Invalid lateToleranceMinutes");
  }
  if (input.instructions !== undefined && input.instructions !== null) {
    cleanText(input.instructions, "instructions", 1000);
  }
  if (
    input.scopeOfferingId !== undefined &&
    input.scopeOfferingId !== null &&
    input.scopeProcessId == null
  ) {
    throw new IntakeValidationError("Offering scope requires process scope");
  }
}

type ActivityResourceApplication = {
  id: string;
  tenantId: string;
  offeringId: string;
  processId: string;
  offering: { campusId: string };
};

function activityResourceScopes(
  application: ActivityResourceApplication,
): readonly string[] {
  return [
    `application:${application.id}`,
    `offering:${application.offeringId}`,
    `process:${application.processId}`,
    `campus:${application.offering.campusId}`,
  ];
}

function assertActivityPermission(
  context: TenantExecutionContext,
  permission: PermissionKey,
  applicationId?: string,
  sensitivity?: "restricted" | "highly_restricted",
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
    ...(applicationId === undefined
      ? {}
      : { scope: `application:${applicationId}` }),
    ...(sensitivity === undefined ? {} : { sensitivity }),
  });
}

/** Resource scopes are derived from the persisted application graph only. */
function authorizeActivityResource(
  context: TenantExecutionContext,
  application: ActivityResourceApplication,
  permission: PermissionKey,
  sensitivity?: "restricted" | "highly_restricted",
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: application.tenantId,
    ...(sensitivity === undefined ? {} : { sensitivity }),
  });
  const effectiveScopes =
    context.contextOrigin === "support_elevation"
      ? context.supportElevation?.scopes
      : context.scopes;
  if (
    effectiveScopes?.includes("*") !== true &&
    !activityResourceScopes(application).some((scope) =>
      effectiveScopes?.includes(scope),
    )
  ) {
    throw new ForbiddenError();
  }
}

function canViewActivitySensitiveEvidence(
  context: TenantExecutionContext,
  application: ActivityResourceApplication,
): boolean {
  const sensitivityValid =
    context.contextOrigin === "support_elevation"
      ? context.supportElevation?.categories.includes(
          SENSITIVITIES.HIGHLY_RESTRICTED,
        ) === true
      : context.capabilities?.includes(PERMISSIONS.RESTRICTED_READ) === true;
  if (!sensitivityValid) return false;
  try {
    authorizeActivityResource(
      context,
      application,
      PERMISSIONS.ACTIVITY_RESULT_READ,
      SENSITIVITIES.HIGHLY_RESTRICTED,
    );
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError) return false;
    throw error;
  }
}

async function assertAssignedExecutor(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  assignedUserId: string,
  now = new Date(),
): Promise<void> {
  const executor = await transaction.platformUser.findFirst({
    where: {
      id: assignedUserId,
      status: "ACTIVE",
      memberships: {
        some: {
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          startsAt: { lte: now },
          status: "ACTIVE",
          tenantId,
        },
      },
    },
    select: { id: true },
  });
  if (executor === null) {
    throw new IntakeValidationError(
      "Assigned executor must be an active platform user with an active tenant membership",
    );
  }
}

function assertFamilyActivityPermission(context: FamilyExecutionContext): void {
  authorizeOrThrow(context, {
    permission: PERMISSIONS.ACTIVITY_READ,
    purpose: context.purpose,
  });
}

async function recordActivityAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    metadata?: Record<string, boolean | number | string>;
    resourceId: string;
    resourceType: string;
  },
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      ...(input.metadata === undefined
        ? {}
        : { metadata: asJson(input.metadata) }),
      occurredAt: new Date(),
      purpose: context.purpose,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

function scopeMatches(
  version: {
    scopeAcademicYearId: string | null;
    scopeCourseLevelId: string | null;
    scopeOfferingId: string | null;
    scopeProcessId: string | null;
  },
  application: {
    academicYearId: string;
    courseLevelId: string;
    offeringId: string;
    processId: string;
  },
): boolean {
  return (
    (version.scopeAcademicYearId === null ||
      version.scopeAcademicYearId === application.academicYearId) &&
    (version.scopeProcessId === null ||
      version.scopeProcessId === application.processId) &&
    (version.scopeCourseLevelId === null ||
      version.scopeCourseLevelId === application.courseLevelId) &&
    (version.scopeOfferingId === null ||
      version.scopeOfferingId === application.offeringId)
  );
}

function specificity(version: {
  scopeAcademicYearId: string | null;
  scopeCourseLevelId: string | null;
  scopeOfferingId: string | null;
  scopeProcessId: string | null;
}): number {
  return [
    version.scopeAcademicYearId,
    version.scopeProcessId,
    version.scopeCourseLevelId,
    version.scopeOfferingId,
  ].filter((value) => value !== null).length;
}

type ActivityVersionRecord = Prisma.ActivityDefinitionVersionGetPayload<{
  include: { definition: true };
}>;

function mapVersion(version: ActivityVersionRecord): ActivityVersionDto {
  return {
    archivedAt: version.archivedAt?.toISOString() ?? null,
    durationMinutes: version.durationMinutes,
    id: version.id,
    instructions: version.instructions,
    lateToleranceMinutes: version.lateToleranceMinutes,
    lifecycle: version.lifecycle,
    maxNormalReschedules: version.maxNormalReschedules,
    modality: version.modality,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    required: version.required,
    scope: {
      academicYearId: version.scopeAcademicYearId,
      courseLevelId: version.scopeCourseLevelId,
      offeringId: version.scopeOfferingId,
      processId: version.scopeProcessId,
    },
    versionNumber: version.versionNumber,
  };
}

function mapDefinition(
  definition: Prisma.ActivityDefinitionGetPayload<{
    include: { versions: { include: { definition: true } } };
  }>,
): ActivityDefinitionDto {
  return {
    code: definition.code,
    id: definition.id,
    kind: definition.kind,
    name: definition.name,
    versions: definition.versions.map(mapVersion),
  };
}

function appointmentHistory(activity: ActivityWithRelations) {
  return activity.appointments.map((appointment) => ({
    durationMinutes: appointment.durationMinutes,
    id: appointment.id,
    location: appointment.location,
    scheduledStartAt: appointment.scheduledStartAt.toISOString(),
    status: appointment.status,
  }));
}

function rescheduleCounts(activity: ActivityWithRelations) {
  const normalReschedulesMade = activity.appointments.filter(
    (appointment) => appointment.status === "REPROGRAMADA",
  ).length;
  const normalReschedulesRemaining = Math.max(
    0,
    activity.definitionVersion.maxNormalReschedules - normalReschedulesMade,
  );
  return { normalReschedulesMade, normalReschedulesRemaining };
}

function mapFamilyActivity(activity: ActivityWithRelations): FamilyActivityDto {
  const currentAppointment = activity.appointments.find(
    (appointment) => appointment.id === activity.currentAppointmentId,
  );
  const counts = rescheduleCounts(activity);
  return {
    activityDefinitionId: activity.activityDefinitionId,
    activityId: activity.id,
    appointment:
      currentAppointment === undefined
        ? null
        : {
            durationMinutes: currentAppointment.durationMinutes,
            id: currentAppointment.id,
            location: currentAppointment.location,
            scheduledStartAt: currentAppointment.scheduledStartAt.toISOString(),
            status: currentAppointment.status,
          },
    appointmentHistory: appointmentHistory(activity),
    instructions: activity.definitionVersion.instructions,
    kind: activity.definition.kind,
    modality: activity.definitionVersion.modality,
    name: activity.definition.name,
    nextStep: nextStepFor(activity.status),
    required: activity.definitionVersion.required,
    reschedule: {
      ...counts,
      pendingRequest: activity.rescheduleRequests.some(
        (request) => request.status === "PENDING",
      ),
    },
    status: activity.status,
  };
}

function nextStepFor(status: ActivityStatus): string {
  switch (status) {
    case "PENDIENTE":
      return "El colegio asignará una cita.";
    case "PROGRAMADA":
      return "Revisa la fecha, hora y lugar de tu cita.";
    case "REPROGRAMADA":
      return "Revisa la nueva fecha, hora y lugar.";
    case "INASISTENCIA":
      return "El colegio revisará el siguiente paso.";
    case "NO_COMPLETADA":
      return "El colegio puede coordinar un nuevo intento.";
    case "REALIZADA":
      return "La actividad fue registrada.";
    case "EXENTA":
      return "No necesitas realizar esta actividad.";
    case "CERRADA":
      return "La actividad fue cerrada por una acción institucional.";
  }
}

function mapStaffActivity(
  activity: ActivityWithRelations,
  includeSensitive: boolean,
): StaffActivityDto {
  const base = mapFamilyActivity(activity);
  const currentAppointment = activity.appointments.find(
    (appointment) => appointment.id === activity.currentAppointmentId,
  );
  const noShows = activity.attempts.filter(
    (attempt) =>
      attempt.operationalOutcome === "INASISTENCIA" &&
      attempt.noShowJustified === false,
  ).length;
  return {
    ...base,
    assignedUserId: currentAppointment?.assignedUserId ?? null,
    attempts: includeSensitive
      ? activity.attempts.map((attempt) => ({
          id: attempt.id,
          noShowJustified: attempt.noShowJustified,
          occurredAt: attempt.occurredAt.toISOString(),
          operationalOutcome: attempt.operationalOutcome,
          reason: attempt.reason,
          sequence: attempt.sequence,
        }))
      : [],
    manualClosureEligible: noShows >= 2,
    rescheduleRequests: activity.rescheduleRequests.map((request) => ({
      appointmentId: request.appointmentId,
      createdAt: request.createdAt.toISOString(),
      id: request.id,
      reason: request.reason,
      status: request.status,
    })),
    results: includeSensitive
      ? activity.results.map((result) => ({
          attemptId: result.attemptId,
          comment: result.comment,
          createdAt: result.createdAt.toISOString(),
          id: result.id,
          result: result.result,
          versionNumber: result.versionNumber,
        }))
      : [],
  };
}

const activityInclude = {
  application: {
    select: {
      id: true,
      tenantId: true,
      offeringId: true,
      processId: true,
      offering: { select: { campusId: true } },
    },
  },
  definition: true,
  definitionVersion: true,
  appointments: { orderBy: { sequence: "asc" as const } },
  rescheduleRequests: { orderBy: { createdAt: "asc" as const } },
  attempts: { orderBy: { sequence: "asc" as const } },
  results: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ApplicationActivityInclude;

/** Pins exactly one applicable published version per definition in the submit transaction. */
export async function pinApplicationActivities(
  transaction: Prisma.TransactionClient,
  input: {
    academicYearId: string;
    applicationId: string;
    courseLevelId: string;
    offeringId: string;
    processId: string;
    tenantId: string;
  },
  now = new Date(),
): Promise<number> {
  const existing = await transaction.applicationActivity.count({
    where: { applicationId: input.applicationId, tenantId: input.tenantId },
  });
  if (existing > 0) return existing;
  const versions = await transaction.activityDefinitionVersion.findMany({
    include: { definition: true },
    where: { lifecycle: "PUBLISHED", tenantId: input.tenantId },
  });
  const applicable = versions
    .filter((version) => scopeMatches(version, input))
    .sort((left, right) => {
      const specificityDelta = specificity(right) - specificity(left);
      return specificityDelta !== 0
        ? specificityDelta
        : right.versionNumber - left.versionNumber;
    });
  const selected = new Map<string, ActivityVersionRecord>();
  for (const version of applicable) {
    if (!selected.has(version.activityDefinitionId))
      selected.set(version.activityDefinitionId, version);
  }
  for (const version of selected.values()) {
    await transaction.applicationActivity.create({
      data: {
        activityDefinitionId: version.activityDefinitionId,
        activityDefinitionVersionId: version.id,
        applicationId: input.applicationId,
        pinnedAt: now,
        tenantId: input.tenantId,
      },
    });
  }
  await transaction.application.update({
    data: { activitiesPinnedAt: now },
    where: { id: input.applicationId },
  });
  return selected.size;
}

export class ActivityService {
  constructor(private readonly prisma: PrismaClient) {}

  async listDefinitions(
    context: TenantExecutionContext,
  ): Promise<ActivityDefinitionDto[]> {
    assertActivityPermission(context, PERMISSIONS.ACTIVITY_DEFINITION_MANAGE);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const definitions = await transaction.activityDefinition.findMany({
        include: {
          versions: {
            include: { definition: true },
            orderBy: { versionNumber: "asc" },
          },
        },
        orderBy: { code: "asc" },
      });
      return definitions.map(mapDefinition);
    });
  }

  async createDefinition(
    context: TenantExecutionContext,
    input: ActivityDefinitionInput,
  ): Promise<ActivityDefinitionDto> {
    assertActivityPermission(context, PERMISSIONS.ACTIVITY_DEFINITION_MANAGE);
    const code = cleanText(input.code, "code", 80);
    const name = cleanText(input.name, "name", 160);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const definition = await transaction.activityDefinition.create({
        data: { code, kind: input.kind, name, tenantId: context.tenantId },
        include: {
          versions: {
            include: { definition: true },
            orderBy: { versionNumber: "asc" },
          },
        },
      });
      await recordActivityAudit(transaction, context, {
        action: "ACTIVITY_DEFINITION_CREATED",
        resourceId: definition.id,
        resourceType: "ActivityDefinition",
      });
      return mapDefinition(definition);
    });
  }

  async createVersion(
    context: TenantExecutionContext,
    definitionId: string,
    input: ActivityVersionInput,
    sourceVersionId?: string,
  ): Promise<ActivityVersionDto> {
    assertActivityPermission(context, PERMISSIONS.ACTIVITY_DEFINITION_MANAGE);
    validateConfiguration(input);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const definition = await transaction.activityDefinition.findFirst({
        where: { id: definitionId },
      });
      if (definition === null) throw new IntakeNotFoundError();
      const source =
        sourceVersionId === undefined
          ? null
          : await transaction.activityDefinitionVersion.findFirst({
              where: {
                id: sourceVersionId,
                activityDefinitionId: definitionId,
              },
            });
      if (sourceVersionId !== undefined && source === null)
        throw new IntakeNotFoundError();
      const latest = await transaction.activityDefinitionVersion.findFirst({
        where: { activityDefinitionId: definitionId },
        orderBy: { versionNumber: "desc" },
      });
      const version = await transaction.activityDefinitionVersion.create({
        data: {
          activityDefinitionId: definitionId,
          durationMinutes: input.durationMinutes,
          instructions:
            input.instructions === undefined || input.instructions === null
              ? (source?.instructions ?? null)
              : cleanText(input.instructions, "instructions", 1000),
          lateToleranceMinutes:
            input.lateToleranceMinutes ?? source?.lateToleranceMinutes ?? 15,
          maxNormalReschedules:
            input.maxNormalReschedules ?? source?.maxNormalReschedules ?? 2,
          required: input.required,
          scopeAcademicYearId:
            input.scopeAcademicYearId ?? source?.scopeAcademicYearId ?? null,
          scopeCourseLevelId:
            input.scopeCourseLevelId ?? source?.scopeCourseLevelId ?? null,
          scopeOfferingId:
            input.scopeOfferingId ?? source?.scopeOfferingId ?? null,
          scopeProcessId:
            input.scopeProcessId ?? source?.scopeProcessId ?? null,
          tenantId: context.tenantId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
        },
        include: { definition: true },
      });
      await recordActivityAudit(transaction, context, {
        action: "ACTIVITY_DEFINITION_VERSION_CREATED",
        metadata: { versionNumber: version.versionNumber },
        resourceId: version.id,
        resourceType: "ActivityDefinitionVersion",
      });
      return mapVersion(version);
    });
  }

  async updateDraftVersion(
    context: TenantExecutionContext,
    versionId: string,
    input: ActivityVersionInput,
  ): Promise<ActivityVersionDto> {
    assertActivityPermission(context, PERMISSIONS.ACTIVITY_DEFINITION_MANAGE);
    validateConfiguration(input);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.activityDefinitionVersion.findFirst({
        where: { id: versionId, lifecycle: "DRAFT" },
        include: { definition: true },
      });
      if (existing === null) throw new IntakeNotFoundError();
      const updated = await transaction.activityDefinitionVersion.update({
        data: {
          durationMinutes: input.durationMinutes,
          instructions:
            input.instructions === undefined || input.instructions === null
              ? null
              : cleanText(input.instructions, "instructions", 1000),
          lateToleranceMinutes: input.lateToleranceMinutes ?? 15,
          maxNormalReschedules: input.maxNormalReschedules ?? 2,
          required: input.required,
          scopeAcademicYearId: input.scopeAcademicYearId ?? null,
          scopeCourseLevelId: input.scopeCourseLevelId ?? null,
          scopeOfferingId: input.scopeOfferingId ?? null,
          scopeProcessId: input.scopeProcessId ?? null,
        },
        include: { definition: true },
        where: { id: versionId },
      });
      return mapVersion(updated);
    });
  }

  async publishVersion(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<ActivityVersionDto> {
    assertActivityPermission(context, PERMISSIONS.ACTIVITY_DEFINITION_PUBLISH);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.activityDefinitionVersion.findFirst({
        where: { id: versionId, lifecycle: "DRAFT" },
        include: { definition: true },
      });
      if (existing === null) throw new IntakeNotFoundError();
      const published = await transaction.activityDefinitionVersion.update({
        data: { lifecycle: "PUBLISHED", publishedAt: new Date() },
        where: { id: versionId },
        include: { definition: true },
      });
      await recordActivityAudit(transaction, context, {
        action: "ACTIVITY_DEFINITION_VERSION_PUBLISHED",
        resourceId: versionId,
        resourceType: "ActivityDefinitionVersion",
      });
      return mapVersion(published);
    });
  }

  async archiveVersion(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<ActivityVersionDto> {
    assertActivityPermission(context, PERMISSIONS.ACTIVITY_DEFINITION_PUBLISH);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.activityDefinitionVersion.findFirst({
        where: { id: versionId, lifecycle: "PUBLISHED" },
        include: { definition: true },
      });
      if (existing === null) throw new IntakeNotFoundError();
      const archived = await transaction.activityDefinitionVersion.update({
        data: { archivedAt: new Date(), lifecycle: "ARCHIVED" },
        where: { id: versionId },
        include: { definition: true },
      });
      await recordActivityAudit(transaction, context, {
        action: "ACTIVITY_DEFINITION_VERSION_ARCHIVED",
        resourceId: versionId,
        resourceType: "ActivityDefinitionVersion",
      });
      return mapVersion(archived);
    });
  }

  async listFamilyActivities(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
  ): Promise<FamilyActivityDto[]> {
    assertFamilyActivityPermission(familyContext);
    authorizeOrThrow(applicantContext, {
      permission: PERMISSIONS.APPLICATION_READ,
      purpose: applicantContext.purpose,
      resourceTenantId: applicantContext.tenantId,
    });
    const profile = await this.prisma.familyProfile.findUnique({
      where: { userId: familyContext.actorId },
      select: { id: true },
    });
    if (profile === null) throw new IntakeNotFoundError();
    return withTenantTransaction(this.prisma, async (transaction) => {
      const activities = await transaction.applicationActivity.findMany({
        where: { applicationId, application: { familyProfileId: profile.id } },
        include: activityInclude,
        orderBy: { createdAt: "asc" },
      });
      if (activities.length === 0) {
        const application = await transaction.application.findFirst({
          where: { id: applicationId, familyProfileId: profile.id },
          select: { id: true },
        });
        if (application === null) throw new IntakeNotFoundError();
      }
      return activities.map(mapFamilyActivity);
    });
  }

  async getFamilyActivity(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    activityId: string,
  ): Promise<FamilyActivityDto> {
    const activities = await this.listFamilyActivities(
      familyContext,
      applicantContext,
      applicationId,
    );
    const activity = activities.find((item) => item.activityId === activityId);
    if (activity === undefined) throw new IntakeNotFoundError();
    return activity;
  }

  async requestFamilyReschedule(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    activityId: string,
    expectedAppointmentId: string,
    reason: string,
  ): Promise<{ id: string; status: "PENDING" }> {
    assertFamilyActivityPermission(familyContext);
    authorizeOrThrow(applicantContext, {
      permission: PERMISSIONS.APPLICATION_READ,
      purpose: applicantContext.purpose,
      resourceTenantId: applicantContext.tenantId,
    });
    const cleanReason = cleanText(reason, "reason", 1000);
    const profile = await this.prisma.familyProfile.findUnique({
      where: { userId: familyContext.actorId },
      select: { id: true },
    });
    if (profile === null) throw new IntakeNotFoundError();
    return withTenantTransaction(this.prisma, async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "application_activities" WHERE "tenant_id" = ${applicantContext.tenantId}::uuid AND "id" = ${activityId}::uuid FOR UPDATE`;
      const activity = await transaction.applicationActivity.findFirst({
        where: {
          id: activityId,
          applicationId,
          application: { familyProfileId: profile.id },
        },
        include: { currentAppointment: true },
      });
      if (activity === null) throw new IntakeNotFoundError();
      if (activity.currentAppointment === null)
        throw new IntakeValidationError("Activity has no current appointment");
      if (activity.currentAppointment.id !== expectedAppointmentId)
        throw new ActivityConflictError("ACTIVITY_APPOINTMENT_CHANGED");
      const request = await transaction.activityRescheduleRequest.create({
        data: {
          appointmentId: activity.currentAppointment.id,
          applicationActivityId: activity.id,
          reason: cleanReason,
          requestedByUserId: familyContext.actorId,
          tenantId: applicantContext.tenantId,
        },
      });
      await recordActivityAudit(transaction, applicantContext, {
        action: "ACTIVITY_RESCHEDULE_REQUESTED",
        metadata: { appointmentId: activity.currentAppointment.id },
        resourceId: activity.id,
        resourceType: "ApplicationActivity",
      });
      return { id: request.id, status: "PENDING" as const };
    });
  }

  async listStaffActivities(
    context: TenantExecutionContext,
    applicationId: string,
  ): Promise<StaffActivityDto[]> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await transaction.application.findFirst({
        where: { id: applicationId },
        select: {
          id: true,
          tenantId: true,
          offeringId: true,
          processId: true,
          offering: { select: { campusId: true } },
        },
      });
      if (application === null) throw new IntakeNotFoundError();
      authorizeActivityResource(
        context,
        application,
        PERMISSIONS.ACTIVITY_READ,
        SENSITIVITIES.RESTRICTED,
      );
      const activities = await transaction.applicationActivity.findMany({
        where: { applicationId },
        include: activityInclude,
        orderBy: { createdAt: "asc" },
      });
      const canViewResults = canViewActivitySensitiveEvidence(
        context,
        application,
      );
      if (canViewResults) {
        await recordActivityAudit(transaction, context, {
          action: "ACTIVITY_SENSITIVE_RESULTS_READ",
          resourceId: application.id,
          resourceType: "Application",
        });
      }
      return activities.map((activity) =>
        mapStaffActivity(activity, canViewResults),
      );
    });
  }

  async getStaffActivity(
    context: TenantExecutionContext,
    activityId: string,
  ): Promise<StaffActivityDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const activity = await transaction.applicationActivity.findFirst({
        where: { id: activityId },
        include: activityInclude,
      });
      if (activity === null) throw new IntakeNotFoundError();
      authorizeActivityResource(
        context,
        activity.application,
        PERMISSIONS.ACTIVITY_READ,
        SENSITIVITIES.RESTRICTED,
      );
      const canViewResults = canViewActivitySensitiveEvidence(
        context,
        activity.application,
      );
      if (canViewResults) {
        await recordActivityAudit(transaction, context, {
          action: "ACTIVITY_SENSITIVE_RESULTS_READ",
          resourceId: activity.id,
          resourceType: "ApplicationActivity",
        });
      }
      return mapStaffActivity(activity, canViewResults);
    });
  }

  async schedule(
    context: TenantExecutionContext,
    activityId: string,
    input: StaffScheduleInput,
  ): Promise<StaffActivityDto> {
    assertActivityPermission(
      context,
      PERMISSIONS.ACTIVITY_SCHEDULE,
      undefined,
      SENSITIVITIES.RESTRICTED,
    );
    return this.mutateAppointment(context, activityId, input, false);
  }

  async reprogram(
    context: TenantExecutionContext,
    activityId: string,
    input: StaffScheduleInput,
  ): Promise<StaffActivityDto> {
    assertActivityPermission(
      context,
      PERMISSIONS.ACTIVITY_SCHEDULE,
      undefined,
      SENSITIVITIES.RESTRICTED,
    );
    if (input.expectedAppointmentId === undefined)
      throw new IntakeValidationError("expectedAppointmentId is required");
    return this.mutateAppointment(context, activityId, input, true);
  }

  private async mutateAppointment(
    context: TenantExecutionContext,
    activityId: string,
    input: StaffScheduleInput,
    reprogram: boolean,
  ): Promise<StaffActivityDto> {
    const location = cleanText(input.location, "location", 240);
    if (
      !(input.newScheduledStartAt instanceof Date) ||
      Number.isNaN(input.newScheduledStartAt.getTime())
    )
      throw new IntakeValidationError("Invalid appointment date");
    if (input.reason !== undefined) cleanText(input.reason, "reason", 1000);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const lock = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "application_activities" WHERE "tenant_id" = ${context.tenantId}::uuid AND "id" = ${activityId}::uuid FOR UPDATE`;
      if (lock.length !== 1) throw new IntakeNotFoundError();
      const activity = await transaction.applicationActivity.findFirst({
        where: { id: activityId },
        include: {
          application: {
            select: {
              id: true,
              tenantId: true,
              offeringId: true,
              processId: true,
              offering: { select: { campusId: true } },
            },
          },
          definitionVersion: true,
          currentAppointment: true,
        },
      });
      if (activity === null) throw new IntakeNotFoundError();
      authorizeActivityResource(
        context,
        activity.application,
        PERMISSIONS.ACTIVITY_SCHEDULE,
        SENSITIVITIES.RESTRICTED,
      );
      await assertAssignedExecutor(
        transaction,
        context.tenantId,
        input.assignedUserId,
      );
      if (activity.status === "CERRADA")
        throw new ActivityConflictError("ACTIVITY_CLOSED");
      if (!reprogram) {
        if (activity.currentAppointment !== null)
          throw new ActivityConflictError("ACTIVITY_ALREADY_SCHEDULED");
        const appointment = await transaction.activityAppointment.create({
          data: {
            applicationActivityId: activity.id,
            assignedUserId: input.assignedUserId,
            createdBy: context.effectiveActorId ?? context.actorId,
            durationMinutes: activity.definitionVersion.durationMinutes,
            location,
            scheduledStartAt: input.newScheduledStartAt,
            sequence: 1,
            tenantId: context.tenantId,
          },
        });
        await transaction.applicationActivity.update({
          data: { currentAppointmentId: appointment.id, status: "PROGRAMADA" },
          where: { id: activity.id },
        });
        await recordActivityAudit(transaction, context, {
          action: "ACTIVITY_APPOINTMENT_SCHEDULED",
          metadata: { appointmentId: appointment.id },
          resourceId: activity.id,
          resourceType: "ApplicationActivity",
        });
      } else {
        if (
          activity.currentAppointment === null ||
          activity.currentAppointment.id !== input.expectedAppointmentId
        )
          throw new ActivityConflictError("ACTIVITY_APPOINTMENT_CHANGED");
        const normalReschedulesMade =
          await transaction.activityAppointment.count({
            where: {
              applicationActivityId: activity.id,
              status: "REPROGRAMADA",
            },
          });
        if (
          normalReschedulesMade >=
          activity.definitionVersion.maxNormalReschedules
        )
          throw new ActivityConflictError(
            "NORMAL_RESCHEDULE_LIMIT_REQUIRES_REVIEW",
          );
        const nextSequence = activity.currentAppointment.sequence + 1;
        const oldAppointment = activity.currentAppointment;
        const appointment = await transaction.activityAppointment.create({
          data: {
            applicationActivityId: activity.id,
            assignedUserId: input.assignedUserId,
            createdBy: context.effectiveActorId ?? context.actorId,
            durationMinutes: activity.definitionVersion.durationMinutes,
            location,
            previousAppointmentId: oldAppointment.id,
            reprogramReason: input.reason ?? null,
            scheduledStartAt: input.newScheduledStartAt,
            sequence: nextSequence,
            tenantId: context.tenantId,
          },
        });
        await transaction.activityAppointment.update({
          data: { status: "REPROGRAMADA" },
          where: { id: oldAppointment.id },
        });
        await transaction.applicationActivity.update({
          data: { currentAppointmentId: appointment.id, status: "PROGRAMADA" },
          where: { id: activity.id },
        });
        if (input.rescheduleRequestId !== undefined) {
          const request = await transaction.activityRescheduleRequest.findFirst(
            {
              where: {
                id: input.rescheduleRequestId,
                applicationActivityId: activity.id,
                appointmentId: oldAppointment.id,
                status: "PENDING",
              },
            },
          );
          if (request === null) throw new IntakeNotFoundError();
          await transaction.activityRescheduleRequest.update({
            data: {
              fulfilledAppointmentId: appointment.id,
              fulfilledAt: new Date(),
              status: "FULFILLED",
            },
            where: { id: request.id },
          });
        }
        await recordActivityAudit(transaction, context, {
          action: "ACTIVITY_APPOINTMENT_REPROGRAMMED",
          metadata: {
            newAppointmentId: appointment.id,
            oldAppointmentId: oldAppointment.id,
            ...(input.rescheduleRequestId === undefined
              ? {}
              : { rescheduleRequestId: input.rescheduleRequestId }),
          },
          resourceId: activity.id,
          resourceType: "ApplicationActivity",
        });
      }
      const result = await transaction.applicationActivity.findFirstOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
      const canViewResults = canViewActivitySensitiveEvidence(
        context,
        result.application,
      );
      return mapStaffActivity(result, canViewResults);
    });
  }

  async recordOutcome(
    context: TenantExecutionContext,
    activityId: string,
    input: RecordOutcomeInput,
  ): Promise<StaffActivityDto> {
    assertActivityPermission(
      context,
      PERMISSIONS.ACTIVITY_PERFORM,
      undefined,
      SENSITIVITIES.HIGHLY_RESTRICTED,
    );
    if (
      input.operationalOutcome !== "INASISTENCIA" &&
      input.noShowJustified !== undefined
    )
      throw new IntakeValidationError(
        "noShowJustified only applies to no-show",
      );
    if (input.operationalOutcome === "REALIZADA" && input.result === undefined)
      throw new IntakeValidationError("A completed activity requires a result");
    if (
      input.operationalOutcome === "NO_COMPLETADA" &&
      input.result !== "INCONCLUSO"
    )
      throw new IntakeValidationError(
        "A not-completed activity requires INCONCLUSO",
      );
    if (
      input.operationalOutcome === "INASISTENCIA" &&
      input.result !== undefined
    )
      throw new IntakeValidationError(
        "No-show cannot create an academic result",
      );
    return withTenantTransaction(this.prisma, async (transaction) => {
      const lock = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "application_activities" WHERE "tenant_id" = ${context.tenantId}::uuid AND "id" = ${activityId}::uuid FOR UPDATE`;
      if (lock.length !== 1) throw new IntakeNotFoundError();
      const activity = await transaction.applicationActivity.findFirst({
        where: { id: activityId },
        include: {
          application: {
            select: {
              id: true,
              tenantId: true,
              offeringId: true,
              processId: true,
              offering: { select: { campusId: true } },
            },
          },
          definitionVersion: true,
          currentAppointment: true,
          attempts: { orderBy: { sequence: "desc" } },
        },
      });
      if (activity === null) throw new IntakeNotFoundError();
      authorizeActivityResource(
        context,
        activity.application,
        PERMISSIONS.ACTIVITY_PERFORM,
        SENSITIVITIES.HIGHLY_RESTRICTED,
      );
      if (activity.status === "CERRADA")
        throw new ActivityConflictError("ACTIVITY_CLOSED");
      const appointment = activity.currentAppointment;
      if (
        appointment === null ||
        appointment.id !== input.expectedAppointmentId ||
        appointment.status !== "PROGRAMADA"
      )
        throw new ActivityConflictError("ACTIVITY_APPOINTMENT_CHANGED");
      if (
        appointment.assignedUserId !==
        (context.effectiveActorId ?? context.actorId)
      )
        throw new ActivityConflictError("ACTIVITY_APPOINTMENT_CHANGED");
      const occurredAt = input.occurredAt ?? new Date();
      if (input.operationalOutcome === "INASISTENCIA") {
        const allowedAt =
          appointment.scheduledStartAt.getTime() +
          activity.definitionVersion.lateToleranceMinutes * 60_000;
        if (occurredAt.getTime() < allowedAt)
          throw new ActivityConflictError("ACTIVITY_NO_SHOW_TOO_EARLY");
      }
      const previousAttempt = activity.attempts[0];
      const attempt = await transaction.activityAttempt.create({
        data: {
          applicationActivityId: activity.id,
          appointmentId: appointment.id,
          noShowJustified:
            input.operationalOutcome === "INASISTENCIA"
              ? (input.noShowJustified ?? false)
              : null,
          occurredAt,
          operationalOutcome: input.operationalOutcome,
          previousAttemptId: previousAttempt?.id ?? null,
          reason:
            input.reason === undefined
              ? null
              : cleanText(input.reason, "reason", 1000),
          recordedBy: context.effectiveActorId ?? context.actorId,
          sequence: (previousAttempt?.sequence ?? 0) + 1,
          tenantId: context.tenantId,
        },
      });
      const appointmentStatus =
        input.operationalOutcome === "REALIZADA"
          ? "REALIZADA"
          : input.operationalOutcome;
      const activityStatus =
        input.operationalOutcome === "REALIZADA"
          ? "REALIZADA"
          : input.operationalOutcome;
      await transaction.activityAppointment.update({
        data: { status: appointmentStatus },
        where: { id: appointment.id },
      });
      if (input.result !== undefined) {
        await transaction.activityResult.create({
          data: {
            applicationActivityId: activity.id,
            attemptId: attempt.id,
            comment:
              input.comment === undefined || input.comment === null
                ? null
                : cleanText(input.comment, "comment", 1000),
            recordedBy: context.effectiveActorId ?? context.actorId,
            result: input.result,
            tenantId: context.tenantId,
            versionNumber: 1,
          },
        });
      }
      await transaction.applicationActivity.update({
        data: { status: activityStatus },
        where: { id: activity.id },
      });
      await recordActivityAudit(transaction, context, {
        action: `ACTIVITY_${input.operationalOutcome}_RECORDED`,
        metadata: { appointmentId: appointment.id, attemptId: attempt.id },
        resourceId: activity.id,
        resourceType: "ApplicationActivity",
      });
      const result = await transaction.applicationActivity.findFirstOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
      const canViewResults = canViewActivitySensitiveEvidence(
        context,
        result.application,
      );
      return mapStaffActivity(result, canViewResults);
    });
  }

  async repeat(
    context: TenantExecutionContext,
    activityId: string,
    input: RepeatActivityInput,
  ): Promise<StaffActivityDto> {
    assertActivityPermission(
      context,
      PERMISSIONS.ACTIVITY_REPEAT,
      undefined,
      SENSITIVITIES.RESTRICTED,
    );
    const location = cleanText(input.location, "location", 240);
    const reason = cleanText(input.reason, "reason", 1000);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const lock = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "application_activities" WHERE "tenant_id" = ${context.tenantId}::uuid AND "id" = ${activityId}::uuid FOR UPDATE`;
      if (lock.length !== 1) throw new IntakeNotFoundError();
      const activity = await transaction.applicationActivity.findFirst({
        where: { id: activityId },
        include: {
          application: {
            select: {
              id: true,
              tenantId: true,
              offeringId: true,
              processId: true,
              offering: { select: { campusId: true } },
            },
          },
          definition: true,
          currentAppointment: true,
          attempts: { orderBy: { sequence: "desc" } },
          definitionVersion: true,
        },
      });
      if (activity === null) throw new IntakeNotFoundError();
      authorizeActivityResource(
        context,
        activity.application,
        PERMISSIONS.ACTIVITY_REPEAT,
        SENSITIVITIES.RESTRICTED,
      );
      await assertAssignedExecutor(
        transaction,
        context.tenantId,
        input.assignedUserId,
      );
      if (activity.status === "CERRADA")
        throw new ActivityConflictError("ACTIVITY_CLOSED");
      if (activity.definition.kind !== "DIAGNOSTIC_EVALUATION")
        throw new IntakeValidationError(
          "Only diagnostic evaluations can be repeated",
        );
      const previousAttempt = activity.attempts[0];
      if (
        previousAttempt === undefined ||
        previousAttempt.operationalOutcome !== "NO_COMPLETADA"
      )
        throw new IntakeValidationError(
          "Only a not-completed attempt can be repeated",
        );
      if (
        activity.currentAppointment === null ||
        input.expectedAppointmentId !== activity.currentAppointment.id
      )
        throw new ActivityConflictError("ACTIVITY_APPOINTMENT_CHANGED");
      const previousAppointment = activity.currentAppointment;
      if (previousAppointment === null)
        throw new IntakeValidationError("Activity has no current appointment");
      const appointment = await transaction.activityAppointment.create({
        data: {
          applicationActivityId: activity.id,
          assignedUserId: input.assignedUserId,
          createdBy: context.effectiveActorId ?? context.actorId,
          durationMinutes: activity.definitionVersion.durationMinutes,
          location,
          previousAppointmentId: previousAppointment.id,
          reprogramReason: reason,
          scheduledStartAt: input.newScheduledStartAt,
          sequence: previousAppointment.sequence + 1,
          tenantId: context.tenantId,
        },
      });
      await transaction.applicationActivity.update({
        data: { currentAppointmentId: appointment.id, status: "PROGRAMADA" },
        where: { id: activity.id },
      });
      await recordActivityAudit(transaction, context, {
        action: "ACTIVITY_REPETITION_STARTED",
        metadata: {
          appointmentId: appointment.id,
          previousAttemptId: previousAttempt.id,
        },
        resourceId: activity.id,
        resourceType: "ApplicationActivity",
      });
      const result = await transaction.applicationActivity.findFirstOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
      return mapStaffActivity(
        result,
        canViewActivitySensitiveEvidence(context, result.application),
      );
    });
  }

  async closeActivityAfterNoShows(
    context: TenantExecutionContext,
    activityId: string,
    reason: string,
  ): Promise<StaffActivityDto> {
    assertActivityPermission(
      context,
      PERMISSIONS.ACTIVITY_CLOSE,
      undefined,
      SENSITIVITIES.RESTRICTED,
    );
    const cleanReason = cleanText(reason, "reason", 1000);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const lock = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "application_activities" WHERE "tenant_id" = ${context.tenantId}::uuid AND "id" = ${activityId}::uuid FOR UPDATE`;
      if (lock.length !== 1) throw new IntakeNotFoundError();
      const activity = await transaction.applicationActivity.findFirst({
        where: { id: activityId },
        include: {
          application: {
            select: {
              id: true,
              tenantId: true,
              offeringId: true,
              processId: true,
              offering: { select: { campusId: true } },
            },
          },
          currentAppointment: true,
          attempts: true,
        },
      });
      if (activity === null) throw new IntakeNotFoundError();
      authorizeActivityResource(
        context,
        activity.application,
        PERMISSIONS.ACTIVITY_CLOSE,
        SENSITIVITIES.RESTRICTED,
      );
      if (activity.currentAppointment?.status === "PROGRAMADA")
        throw new IntakeValidationError(
          "A scheduled current appointment must be resolved before closing",
        );
      const unjustified = activity.attempts.filter(
        (attempt) =>
          attempt.operationalOutcome === "INASISTENCIA" &&
          attempt.noShowJustified === false,
      );
      if (unjustified.length < 2)
        throw new IntakeValidationError(
          "Manual closure requires two unjustified no-shows",
        );
      await transaction.applicationActivity.update({
        data: { status: "CERRADA" },
        where: { id: activity.id },
      });
      await recordActivityAudit(transaction, context, {
        action: "ACTIVITY_CLOSED_MANUALLY",
        metadata: {
          closureReason: cleanReason,
          unjustifiedNoShows: unjustified.length,
        },
        resourceId: activity.id,
        resourceType: "ApplicationActivity",
      });
      const result = await transaction.applicationActivity.findFirstOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
      return mapStaffActivity(
        result,
        canViewActivitySensitiveEvidence(context, result.application),
      );
    });
  }
}
