import { IntakeValidationError } from "@admission/database";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid();
const activityKind = z.enum(["GUARDIAN_INTERVIEW", "DIAGNOSTIC_EVALUATION"]);
const dateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const activityDefinitionSchema = z
  .object({
    code: text(80),
    kind: activityKind,
    name: text(160),
  })
  .strict();

export const activityVersionSchema = z
  .object({
    durationMinutes: z.number().int().positive().max(1440).optional(),
    instructions: z.string().trim().max(1000).nullable().optional(),
    lateToleranceMinutes: z.number().int().nonnegative().max(1440).optional(),
    maxNormalReschedules: z.number().int().nonnegative().max(100).optional(),
    required: z.boolean(),
    scopeAcademicYearId: uuid.nullable().optional(),
    scopeCourseLevelId: uuid.nullable().optional(),
    scopeOfferingId: uuid.nullable().optional(),
    scopeProcessId: uuid.nullable().optional(),
  })
  .strict();

export const activityPolicySchema = z
  .object({
    backupMembershipId: uuid,
    defaultDurationMinutes: z.number().int().min(1).max(1440),
    expectedVersion: z.number().int().min(1).optional(),
    primaryMembershipId: uuid,
  })
  .strict();

export const scheduleSchema = z
  .object({
    assignedUserId: uuid,
    expectedAppointmentId: uuid.optional(),
    location: text(240),
    newScheduledStartAt: dateTime,
    reason: z.string().trim().max(1000).optional(),
    rescheduleRequestId: uuid.optional(),
  })
  .strict();

export const familyRescheduleRequestSchema = z
  .object({ reason: text(1000) })
  .strict();

const outcomeBase = {
  comment: z.string().trim().max(1000).nullable().optional(),
  expectedAppointmentId: uuid,
  occurredAt: dateTime.optional(),
  reason: z.string().trim().max(1000).optional(),
};

export const completedSchema = z
  .object({
    ...outcomeBase,
    result: z.enum(["FAVORABLE", "NO_FAVORABLE", "INCONCLUSO"]),
  })
  .strict();

export const noShowSchema = z
  .object({ ...outcomeBase, noShowJustified: z.boolean() })
  .strict();

export const notCompletedSchema = z.object({ ...outcomeBase }).strict();

export const repeatSchema = z
  .object({
    assignedUserId: uuid,
    expectedAppointmentId: uuid,
    location: text(240),
    newScheduledStartAt: dateTime,
    reason: text(1000),
  })
  .strict();

export const closeSchema = z.object({ reason: text(1000) }).strict();

export function parseActivityBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new IntakeValidationError(
      result.error.issues
        .map((issue) => issue.path.join(".") || "body")
        .join(", "),
    );
  }
  return result.data as z.output<TSchema>;
}

export function parseActivityKind(
  value: string,
): z.output<typeof activityKind> {
  const result = activityKind.safeParse(value);
  if (!result.success) throw new IntakeValidationError("kind");
  return result.data;
}
