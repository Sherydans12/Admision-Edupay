import { z } from "zod";

export const PROCESSING_CATEGORY_VALUES = [
  "ORDINARY_ADMISSION",
  "SUPPORT_ACCOMMODATION",
  "PIE_NEE_DIAGNOSTIC",
  "HEALTH",
] as const;

export const updatePolicySchema = z
  .object({
    category: z.enum(PROCESSING_CATEGORY_VALUES),
    enabled: z.boolean(),
    purpose: z.string().min(1).max(200).nullable(),
  })
  .strict();
