import { IntakeValidationError } from "@admission/database";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid();
const answerValue = z.union([z.string().max(2000), z.boolean()]);

export const formDefinitionSchema = z
  .object({ name: text(160), purpose: text(120) })
  .strict();

export const draftVersionSchema = z
  .object({ sourceVersionId: uuid.optional() })
  .strict();

export const formSectionSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    order: z.number().int().positive(),
    title: text(160),
  })
  .strict();

const optionSchema = z
  .object({
    label: text(160),
    order: z.number().int().positive(),
    value: text(80),
  })
  .strict();

const conditionSchema = z
  .object({
    fieldId: uuid,
    operator: z.enum(["EQUALS", "NOT_EQUALS", "IN"]),
    value: z.union([answerValue, z.array(answerValue).min(1).max(50)]),
  })
  .strict();

const validationSchema = z
  .object({
    maxLength: z.number().int().positive().max(2000).optional(),
    minLength: z.number().int().nonnegative().max(2000).optional(),
  })
  .strict();

export const formFieldSchema = z
  .object({
    condition: conditionSchema.nullable().optional(),
    helpText: z.string().trim().max(500).nullable().optional(),
    key: text(80),
    label: text(200),
    options: z.array(optionSchema).max(50).nullable().optional(),
    order: z.number().int().positive(),
    purpose: text(160),
    required: z.boolean(),
    sectionId: uuid,
    sensitivity: z.enum(["internal", "restricted", "highly_restricted"]),
    type: z.enum(["TEXT", "TEXTAREA", "SELECT", "RADIO", "BOOLEAN", "DATE"]),
    validation: validationSchema.nullable().optional(),
  })
  .strict();

export const offeringFormVersionSchema = z
  .object({ formVersionId: uuid })
  .strict();

export const moveFormItemSchema = z
  .object({ direction: z.enum(["UP", "DOWN"]) })
  .strict();

export const answersSchema = z
  .object({
    answers: z
      .array(z.object({ fieldId: uuid, value: answerValue }).strict())
      .min(1)
      .max(100),
  })
  .strict();

export function parseFormBody<TSchema extends z.ZodType>(
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
