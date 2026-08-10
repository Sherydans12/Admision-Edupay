import {
  IntakeValidationError,
  type DocumentRequirementVersionInput,
} from "@admission/database";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();

const conditionSchema = z
  .object({
    fieldId: uuid,
    formVersionId: uuid,
    operator: z.enum(["EQUALS", "NOT_EQUALS", "IN"]),
    value: z.union([
      z.string().max(2000),
      z.boolean(),
      z
        .array(z.union([z.string().max(2000), z.boolean()]))
        .min(1)
        .max(50),
    ]),
  })
  .strict();

const equivalentOptionSchema = z
  .object({ code: text(80), label: text(160) })
  .strict();

export const requirementSchema = z
  .object({ code: text(80), name: text(160), purpose: text(160) })
  .strict();

export const requirementVersionSchema = z
  .object({
    allowedFileTypes: z
      .array(z.enum(["PDF", "JPEG", "PNG"]))
      .min(1)
      .max(3),
    allowsEquivalent: z.boolean(),
    condition: conditionSchema.nullable().optional(),
    correctionWindowBusinessDays: z.number().int().positive().max(60),
    equivalentOptions: z
      .array(equivalentOptionSchema)
      .max(20)
      .nullable()
      .optional(),
    instruction: z.string().trim().max(1000).nullable().optional(),
    maxAgeDays: z.number().int().positive().max(3650).nullable().optional(),
    maxFileSizeBytes: z.number().int().positive(),
    required: z.boolean(),
    scope: z
      .object({
        academicYearId: nullableUuid,
        courseLevelId: nullableUuid,
        offeringId: nullableUuid,
        processId: nullableUuid,
      })
      .strict()
      .optional(),
    sensitivity: z.enum(["internal", "restricted", "highly_restricted"]),
    validityRule: z.enum(["NONE", "LATEST_AVAILABLE", "MAX_AGE_DAYS"]),
  })
  .strict();

export const acceptDocumentSchema = z
  .object({ expectedDocumentVersionId: uuid })
  .strict();
export const observeDocumentSchema = z
  .object({ expectedDocumentVersionId: uuid, reason: text(1000) })
  .strict();
export const reviewReasonSchema = z.object({ reason: text(1000) }).strict();
export const assistanceStartSchema = z
  .object({
    adultPresentConfirmed: z.boolean(),
    authorizationConfirmed: z.boolean(),
    familyProfileId: uuid,
  })
  .strict();
export const assistedApplicationSchema = z
  .object({ offeringId: uuid, studentId: uuid })
  .strict();
export const assistedAnswersSchema = z
  .object({
    answers: z
      .array(
        z.object({
          fieldId: uuid,
          value: z.union([z.string().max(2000), z.boolean(), z.null()]),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

export function parseDocumentBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new IntakeValidationError(
      result.error.issues
        .map((issue) => issue.path.join(".") || "body")
        .join(", "),
    );
  }
  return result.data as z.output<T>;
}

export function compactRequirementVersionInput(
  input: z.output<typeof requirementVersionSchema>,
): DocumentRequirementVersionInput {
  return {
    allowedFileTypes: input.allowedFileTypes,
    allowsEquivalent: input.allowsEquivalent,
    correctionWindowBusinessDays: input.correctionWindowBusinessDays,
    maxFileSizeBytes: input.maxFileSizeBytes,
    required: input.required,
    sensitivity: input.sensitivity,
    validityRule: input.validityRule,
    ...(input.condition === undefined ? {} : { condition: input.condition }),
    ...(input.equivalentOptions === undefined
      ? {}
      : { equivalentOptions: input.equivalentOptions }),
    ...(input.instruction === undefined
      ? {}
      : { instruction: input.instruction }),
    ...(input.maxAgeDays === undefined ? {} : { maxAgeDays: input.maxAgeDays }),
    ...(input.scope === undefined
      ? {}
      : {
          scope: {
            academicYearId: input.scope.academicYearId ?? null,
            courseLevelId: input.scope.courseLevelId ?? null,
            offeringId: input.scope.offeringId ?? null,
            processId: input.scope.processId ?? null,
          },
        }),
  };
}
