import { z } from "zod";

import { AccountRegistrationValidationError } from "@admission/database";

export const registerAccountSchema = z
  .object({
    email: z.string().trim().min(1).max(320).email(),
  })
  .strict();

export const verifyAccountSchema = z
  .object({
    challenge: z.string().trim().min(1).max(256),
  })
  .strict();

export function parseIdentityBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(body);
  if (!result.success) throw new AccountRegistrationValidationError();
  return result.data as z.output<TSchema>;
}
