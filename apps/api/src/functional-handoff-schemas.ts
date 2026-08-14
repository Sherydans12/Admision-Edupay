import { IntakeValidationError } from "@admission/database";
import { z } from "zod";

export const functionalHandoffSchema = z.object({}).strict();

export function parseFunctionalHandoffBody(
  body: unknown,
): Record<never, never> {
  const result = functionalHandoffSchema.safeParse(body ?? {});
  if (!result.success) {
    throw new IntakeValidationError(
      result.error.issues
        .map((issue) => issue.path.join(".") || "body")
        .join(", "),
    );
  }
  return result.data;
}
