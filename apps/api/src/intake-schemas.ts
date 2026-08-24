import { z } from "zod";
import { IntakeValidationError } from "@admission/database";

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid();
const dateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const version = z.number().int().min(1);

export const profileSchema = z.object({ displayName: text(160) }).strict();
export const studentSchema = z
  .object({
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    familyName: text(160),
    givenName: text(120),
  })
  .strict();

export const campusSchema = z
  .object({ code: text(80), name: text(160) })
  .strict();
export const academicYearSchema = z
  .object({
    code: text(40),
    label: text(80),
    status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
  })
  .strict();
export const courseLevelSchema = z
  .object({ code: text(80), name: text(120) })
  .strict();
export const processSchema = z
  .object({
    academicYearId: uuid,
    closesAt: dateTime.optional(),
    code: text(80),
    name: text(160),
    opensAt: dateTime.optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
  })
  .strict();
export const offeringSchema = z
  .object({
    academicYearId: uuid,
    availabilityCategory: z.enum([
      "POSTULATIONS_OPEN",
      "LIMITED_CAPACITY",
      "WAITLIST",
      "PROCESS_CLOSED",
    ]),
    campusId: uuid,
    code: text(80),
    courseLevelId: uuid,
    processId: uuid,
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
    title: text(160),
  })
  .strict();
export const offeringLifecycleCommandSchema = z
  .object({ expectedOfferingVersion: version })
  .strict();

export const applicationSchema = z
  .object({ offeringId: uuid, studentId: uuid })
  .strict();
export const draftSchema = z
  .object({
    acknowledgedNoGuarantee: z.boolean(),
    currentStep: z.enum(["CONTEXT", "STUDENT_DETAILS", "REVIEW"]),
  })
  .strict();

export function parseBody<TSchema extends z.ZodType>(
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

export function parseUuid(value: string): string {
  const result = uuid.safeParse(value);
  if (!result.success)
    throw new IntakeValidationError("Invalid resource identifier");
  return result.data;
}
