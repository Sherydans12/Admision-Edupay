import { IntakeValidationError } from "@admission/database";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid();

export const recommendationDraftSchema = z
  .object({
    foundation: text(2000),
    option: z.enum([
      "RECOMENDAR_ADMISION",
      "NO_RECOMENDAR_ADMISION",
      "DEVOLVER_A_REVISION",
    ]),
  })
  .strict();

export const directionDecisionSchema = z
  .object({
    disposition: z.enum([
      "APROBADO",
      "LISTA_DE_ESPERA",
      "RECHAZADO",
      "DEVUELTO_A_REVISION",
    ]),
    expectedRecommendationVersionId: uuid,
    foundation: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export function parseRecommendationBody<TSchema extends z.ZodType>(
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
