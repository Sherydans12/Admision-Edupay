import { IntakeValidationError } from "@admission/database";
import { z } from "zod";

const capacity = z.number().int().min(0);
const businessDays = z.number().int().min(1).max(30);
const version = z.number().int().min(1);
const uuid = z.string().uuid();
const reason = z.string().trim().min(1).max(1000);

export const capacityCreateSchema = z
  .object({
    configuredCapacity: capacity,
    offerValidityBusinessDays: businessDays.optional(),
  })
  .strict();

export const capacityAdjustmentSchema = z
  .object({
    configuredCapacity: capacity,
    expectedVersion: version,
    offerValidityBusinessDays: businessDays.optional(),
    reason,
  })
  .strict();

export const waitlistPromotionSchema = z
  .object({
    expectedCapacityVersion: version,
    expectedWaitlistEntryVersion: version,
  })
  .strict();

export const offerVersionCommandSchema = z
  .object({ expectedOfferVersionId: uuid })
  .strict();

export const offerReopenSchema = z
  .object({
    expectedCapacityVersion: version,
    expectedOfferVersionId: uuid,
    reason,
  })
  .strict();

export const withdrawalSchema = z
  .object({ confirmed: z.literal(true) })
  .strict();

export function parseCapacityOfferBody<TSchema extends z.ZodType>(
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
