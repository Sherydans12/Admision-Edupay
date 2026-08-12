import { z } from "zod";

import { IntakeValidationError } from "@admission/database";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
const dateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const reportExportSchema = z
  .object({
    columns: z.array(text(80)).min(1).max(40).optional(),
    filters: z
      .object({
        applicationStatus: z
          .enum(["DRAFT", "SUBMITTED", "WITHDRAWN"])
          .optional(),
        campusId: uuid.optional(),
        courseLevelId: uuid.optional(),
        dateFrom: dateTime.optional(),
        dateTo: dateTime.optional(),
        offeringId: uuid.optional(),
        processId: uuid.optional(),
      })
      .strict(),
  })
  .strict();

export const roleAssignmentCreateSchema = z
  .object({
    endsAt: dateTime.optional(),
    membershipId: uuid,
    permissions: z.array(text(120)).min(1).max(80),
    roleKey: text(80),
    scopes: z.array(text(120)).min(1).max(80),
    startsAt: dateTime,
  })
  .strict();

export const roleAssignmentUpdateSchema = z
  .object({
    endsAt: dateTime.nullable().optional(),
    expectedUpdatedAt: dateTime,
    permissions: z.array(text(120)).min(1).max(80),
    roleKey: text(80),
    scopes: z.array(text(120)).min(1).max(80),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
  })
  .strict();

export const roleAssignmentRevokeSchema = z
  .object({ expectedUpdatedAt: dateTime })
  .strict();

export const supportElevationStartSchema = z
  .object({
    categories: z
      .array(z.enum(["internal", "restricted", "highly_restricted"]))
      .min(1)
      .max(3),
    expiresAt: dateTime,
    purpose: z.literal("platform.support"),
    reason: text(500),
    scopes: z.array(text(120)).min(1).max(80),
    targetTenantId: uuid,
  })
  .strict();

export const supportElevationCloseSchema = z
  .object({ targetTenantId: uuid })
  .strict();

export const auditQuerySchema = z
  .object({
    action: text(120)
      .regex(/^[A-Z0-9_]+$/)
      .optional(),
    cursor: uuid.optional(),
    dateFrom: dateTime,
    dateTo: dateTime,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    purpose: text(120).optional(),
    resourceId: uuid.optional(),
    resourceType: text(120)
      .regex(/^[A-Za-z][A-Za-z0-9]+$/)
      .optional(),
  })
  .strict();

export function parseReportingBody<TSchema extends z.ZodType>(
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
