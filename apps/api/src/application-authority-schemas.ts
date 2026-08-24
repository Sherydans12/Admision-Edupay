import { ApplicationAuthorityValidationError } from "@admission/database";
import { z } from "zod";

const uuid = z.string().uuid();
const expectedVersion = z.number().int().positive();

export const authorityDeclarationSchema = z
  .object({
    authorityBasis: z.enum([
      "PARENT",
      "LEGAL_REPRESENTATIVE",
      "PERSONAL_CARE_HOLDER",
      "AUTHORIZED_BY_AUTHORITY_HOLDER",
      "SELF",
    ]),
    expectedConcurrencyVersion: expectedVersion.optional(),
    relationship: z.enum([
      "MOTHER",
      "FATHER",
      "OTHER_RELATIVE",
      "OTHER",
      "SELF",
    ]),
    subjectMode: z.enum(["MINOR_REPRESENTATIVE", "ADULT_STUDENT_SELF"]),
  })
  .strict();

export const authorityReviewSchema = z
  .object({
    evidenceDocumentVersionIds: z.array(uuid).max(20).optional(),
    expectedConcurrencyVersion: expectedVersion,
    reason: z.string().trim().min(1).max(1000),
    toStatus: z.enum([
      "EVIDENCE_PENDING",
      "UNDER_REVIEW",
      "VERIFIED",
      "DISPUTED",
      "REJECTED",
    ]),
  })
  .strict();

export function parseAuthorityBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApplicationAuthorityValidationError(
      result.error.issues
        .map((issue) => issue.path.join(".") || "body")
        .join(", "),
    );
  }
  return result.data as z.output<TSchema>;
}
