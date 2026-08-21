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
    purpose: z.string().max(200).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (
        data.enabled &&
        (data.category === "HEALTH" || data.category === "PIE_NEE_DIAGNOSTIC")
      ) {
        return (
          typeof data.purpose === "string" && data.purpose.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        "Explicit purpose is required when enabling sensitive processing category",
      path: ["purpose"],
    },
  );
