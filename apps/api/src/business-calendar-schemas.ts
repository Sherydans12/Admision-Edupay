import { z } from "zod";

export const configureBusinessCalendarSchema = z
  .object({
    expectedVersion: z.number().int().positive().optional(),
    timezone: z.string().min(1).max(80),
  })
  .strict();

export const addExcludedDateSchema = z
  .object({
    calendarDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date format YYYY-MM-DD"),
    reason: z.string().min(1).max(200),
  })
  .strict();
