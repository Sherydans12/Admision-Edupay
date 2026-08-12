import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { ForbiddenError } from "./authorization.js";
import { sanitizeAuditMetadata } from "./audit-metadata.js";
import { PERMISSIONS, type PermissionKey } from "./permission-catalog.js";
import {
  getRequiredTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/i;
const SCOPE_PATTERN =
  /^(application|offering|process|campus):([0-9a-f-]{36})$/i;
const PERMISSION_VALUES = new Set<string>(Object.values(PERMISSIONS));

export class AccessAdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessAdminValidationError";
  }
}

export class RoleAssignmentChangedError extends Error {
  readonly code = "ROLE_ASSIGNMENT_CHANGED";

  constructor() {
    super("Role assignment changed");
    this.name = "RoleAssignmentChangedError";
  }
}

export interface RoleAssignmentDto {
  createdAt: string;
  endsAt: string | null;
  id: string;
  permissions: readonly string[];
  roleKey: string;
  scopes: readonly string[];
  startsAt: string;
  status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  updatedAt: string;
}

export interface MembershipAccessDto {
  assignments: readonly RoleAssignmentDto[];
  endsAt: string | null;
  id: string;
  startsAt: string;
  status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  userId: string;
}

function assertPermission(
  context: TenantExecutionContext,
  permission: PermissionKey,
): void {
  if (!(context.capabilities ?? []).includes(permission))
    throw new ForbiddenError();
}

function validatePermissions(permissions: readonly string[]): PermissionKey[] {
  if (
    permissions.length === 0 ||
    new Set(permissions).size !== permissions.length
  ) {
    throw new AccessAdminValidationError(
      "Permissions must be non-empty and unique",
    );
  }
  if (permissions.some((permission) => !PERMISSION_VALUES.has(permission))) {
    throw new AccessAdminValidationError("Unknown permission");
  }
  return [...permissions] as PermissionKey[];
}

export function validateRoleAssignmentScopes(
  scopes: readonly string[],
): string[] {
  if (scopes.length === 0 || new Set(scopes).size !== scopes.length) {
    throw new AccessAdminValidationError("Scopes must be non-empty and unique");
  }
  for (const scope of scopes) {
    if (scope === "*") continue;
    const match = SCOPE_PATTERN.exec(scope);
    if (match === null || !UUID_PATTERN.test(match[2] ?? "")) {
      throw new AccessAdminValidationError("Unknown or invalid scope");
    }
  }
  return [...scopes];
}

function assertDelegable(
  context: TenantExecutionContext,
  permissions: readonly PermissionKey[],
  scopes: readonly string[],
): void {
  const actorPermissions = new Set(context.capabilities ?? []);
  if (permissions.some((permission) => !actorPermissions.has(permission))) {
    throw new ForbiddenError();
  }
  const actorScopes = new Set(context.scopes ?? []);
  if (actorScopes.has("*")) return;
  if (scopes.some((scope) => !actorScopes.has(scope)))
    throw new ForbiddenError();
}

function validateRoleKey(roleKey: string): string {
  const normalized = roleKey.trim();
  if (!ROLE_KEY_PATTERN.test(normalized)) {
    throw new AccessAdminValidationError("Role key is invalid");
  }
  return normalized;
}

function mapAssignment(row: {
  createdAt: Date;
  endsAt: Date | null;
  id: string;
  permissions: string[];
  roleKey: string;
  scopes: string[];
  startsAt: Date;
  status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  updatedAt: Date;
}): RoleAssignmentDto {
  return {
    createdAt: row.createdAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    id: row.id,
    permissions: row.permissions,
    roleKey: row.roleKey,
    scopes: row.scopes,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function recordRoleAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    assignmentId: string;
    metadata: Readonly<Record<string, unknown>>;
    result?: "DENY" | "SUCCESS";
  },
): Promise<void> {
  const metadata = sanitizeAuditMetadata(input.metadata);
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      ...(metadata === undefined
        ? {}
        : { metadata: metadata as Prisma.InputJsonValue }),
      occurredAt: new Date(),
      purpose: context.purpose,
      resourceId: input.assignmentId,
      resourceType: "RoleAssignment",
      result: input.result ?? "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

export class RoleAssignmentAdminService {
  constructor(private readonly prisma: PrismaClient) {}

  getOwnAccess(): {
    permissions: readonly string[];
    scopes: readonly string[];
  } {
    const context = getRequiredTenantContext();
    return {
      permissions: [...(context.capabilities ?? [])].sort(),
      scopes: [...(context.scopes ?? [])].sort(),
    };
  }

  async listMembershipAccess(): Promise<readonly MembershipAccessDto[]> {
    const context = getRequiredTenantContext();
    assertPermission(context, PERMISSIONS.ROLE_ASSIGNMENT_READ);
    const memberships = await withTenantTransaction(
      this.prisma,
      (transaction) =>
        transaction.membership.findMany({
          include: {
            roleAssignments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          where: { tenantId: context.tenantId },
        }),
    );
    return memberships.map((membership) => ({
      assignments: membership.roleAssignments.map(mapAssignment),
      endsAt: membership.endsAt?.toISOString() ?? null,
      id: membership.id,
      startsAt: membership.startsAt.toISOString(),
      status: membership.status,
      userId: membership.userId,
    }));
  }

  async createAssignment(input: {
    endsAt?: Date;
    membershipId: string;
    permissions: readonly string[];
    roleKey: string;
    scopes: readonly string[];
    startsAt: Date;
  }): Promise<RoleAssignmentDto> {
    const context = getRequiredTenantContext();
    assertPermission(context, PERMISSIONS.ROLE_ASSIGNMENT_MANAGE);
    const permissions = validatePermissions(input.permissions);
    const scopes = validateRoleAssignmentScopes(input.scopes);
    assertDelegable(context, permissions, scopes);
    const roleKey = validateRoleKey(input.roleKey);
    if (input.endsAt !== undefined && input.endsAt <= input.startsAt) {
      throw new AccessAdminValidationError(
        "Assignment end must be after start",
      );
    }
    return withTenantTransaction(this.prisma, async (transaction) => {
      const membership = await transaction.membership.findFirst({
        where: {
          id: input.membershipId,
          status: "ACTIVE",
          tenantId: context.tenantId,
        },
      });
      if (membership === null) throw new ForbiddenError();
      const assignment = await transaction.roleAssignment.create({
        data: {
          ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt }),
          membershipId: membership.id,
          permissions,
          roleKey,
          scopes,
          startsAt: input.startsAt,
          tenantId: context.tenantId,
        },
      });
      await recordRoleAudit(transaction, context, {
        action: "ROLE_ASSIGNMENT_CREATED",
        assignmentId: assignment.id,
        metadata: {
          assignmentId: assignment.id,
          membershipId: assignment.membershipId,
          permissions,
          roleKey,
          scopes,
          status: assignment.status,
        },
      });
      return mapAssignment(assignment);
    });
  }

  async updateAssignment(
    assignmentId: string,
    input: {
      endsAt?: Date | null;
      expectedUpdatedAt: Date;
      permissions: readonly string[];
      roleKey: string;
      scopes: readonly string[];
      status: "ACTIVE" | "SUSPENDED";
    },
  ): Promise<RoleAssignmentDto> {
    const context = getRequiredTenantContext();
    assertPermission(context, PERMISSIONS.ROLE_ASSIGNMENT_MANAGE);
    const permissions = validatePermissions(input.permissions);
    const scopes = validateRoleAssignmentScopes(input.scopes);
    assertDelegable(context, permissions, scopes);
    const roleKey = validateRoleKey(input.roleKey);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const current = await transaction.roleAssignment.findFirst({
        where: { id: assignmentId, tenantId: context.tenantId },
      });
      if (current === null) throw new ForbiddenError();
      if (current.status === "REVOKED") throw new RoleAssignmentChangedError();
      const now = new Date();
      const changed = await transaction.roleAssignment.updateMany({
        data: {
          ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt }),
          permissions,
          roleKey,
          scopes,
          status: input.status,
          updatedAt: now,
        },
        where: {
          id: assignmentId,
          tenantId: context.tenantId,
          updatedAt: input.expectedUpdatedAt,
        },
      });
      if (changed.count !== 1) throw new RoleAssignmentChangedError();
      const updated = await transaction.roleAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
      await recordRoleAudit(transaction, context, {
        action: "ROLE_ASSIGNMENT_UPDATED",
        assignmentId,
        metadata: {
          assignmentId,
          newStatus: updated.status,
          permissions,
          previousStatus: current.status,
          roleKey,
          scopes,
        },
      });
      return mapAssignment(updated);
    });
  }

  async revokeAssignment(
    assignmentId: string,
    expectedUpdatedAt: Date,
  ): Promise<RoleAssignmentDto> {
    const context = getRequiredTenantContext();
    assertPermission(context, PERMISSIONS.ROLE_ASSIGNMENT_MANAGE);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const current = await transaction.roleAssignment.findFirst({
        where: { id: assignmentId, tenantId: context.tenantId },
      });
      if (current === null) throw new ForbiddenError();
      if (current.status === "REVOKED") return mapAssignment(current);
      const now = new Date();
      const changed = await transaction.roleAssignment.updateMany({
        data: {
          endsAt: current.endsAt ?? now,
          status: "REVOKED",
          updatedAt: now,
        },
        where: {
          id: assignmentId,
          tenantId: context.tenantId,
          updatedAt: expectedUpdatedAt,
        },
      });
      if (changed.count !== 1) throw new RoleAssignmentChangedError();
      const updated = await transaction.roleAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
      await recordRoleAudit(transaction, context, {
        action: "ROLE_ASSIGNMENT_REVOKED",
        assignmentId,
        metadata: {
          assignmentId,
          newStatus: updated.status,
          previousStatus: current.status,
        },
      });
      return mapAssignment(updated);
    });
  }
}

export interface AuditReadFilters {
  action?: string;
  cursor?: string;
  dateFrom: Date;
  dateTo: Date;
  limit: number;
  purpose?: string;
  resourceId?: string;
  resourceType?: string;
}

const AUDIT_RESOURCE_SCOPE_PREFIX: Readonly<Record<string, string>> = {
  Application: "application",
  AdmissionOffering: "offering",
  AdmissionProcess: "process",
  Campus: "campus",
};

function eventMatchesScope(
  context: TenantExecutionContext,
  event: { metadata: unknown; resourceId: string | null; resourceType: string },
): boolean {
  const scopes = context.supportElevation?.scopes ?? context.scopes ?? [];
  if (scopes.includes("*")) return true;
  const prefix = AUDIT_RESOURCE_SCOPE_PREFIX[event.resourceType];
  if (
    prefix !== undefined &&
    event.resourceId !== null &&
    scopes.includes(`${prefix}:${event.resourceId}`)
  ) {
    return true;
  }
  if (typeof event.metadata !== "object" || event.metadata === null)
    return false;
  const resourceScopes = (event.metadata as Record<string, unknown>)
    .resourceScopes;
  return (
    Array.isArray(resourceScopes) &&
    resourceScopes.some(
      (scope) => typeof scope === "string" && scopes.includes(scope),
    )
  );
}

export class AuditReadService {
  constructor(private readonly prisma: PrismaClient) {}

  async listEvents(filters: AuditReadFilters) {
    const context = getRequiredTenantContext();
    assertPermission(context, PERMISSIONS.AUDIT_READ);
    if (
      context.supportElevation !== undefined &&
      !context.supportElevation.categories.includes("restricted")
    ) {
      throw new ForbiddenError();
    }
    if (
      filters.dateTo < filters.dateFrom ||
      filters.dateTo.getTime() - filters.dateFrom.getTime() > 93 * 86_400_000
    ) {
      throw new AccessAdminValidationError(
        "Audit date range exceeds the technical limit",
      );
    }
    const events = await withTenantTransaction(this.prisma, (transaction) =>
      transaction.auditEvent.findMany({
        ...(filters.cursor === undefined
          ? {}
          : { cursor: { id: filters.cursor }, skip: 1 }),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: Math.min(filters.limit * 5, 500),
        where: {
          ...(filters.action === undefined ? {} : { action: filters.action }),
          occurredAt: { gte: filters.dateFrom, lte: filters.dateTo },
          ...(filters.purpose === undefined
            ? {}
            : { purpose: filters.purpose }),
          ...(filters.resourceId === undefined
            ? {}
            : { resourceId: filters.resourceId }),
          ...(filters.resourceType === undefined
            ? {}
            : { resourceType: filters.resourceType }),
          scope: "TENANT",
          tenantId: context.tenantId,
        },
      }),
    );
    const visible = events
      .filter((event) => eventMatchesScope(context, event))
      .slice(0, filters.limit);
    return {
      items: visible.map((event) => ({
        action: event.action,
        actorId: event.actorId,
        correlationId: event.correlationId,
        effectiveActorId: event.effectiveActorId,
        id: event.id,
        metadata: sanitizeAuditMetadata(
          typeof event.metadata === "object" && event.metadata !== null
            ? (event.metadata as Record<string, unknown>)
            : undefined,
        ),
        occurredAt: event.occurredAt.toISOString(),
        purpose: event.purpose,
        reasonCode: event.reasonCode,
        resourceId: event.resourceId,
        resourceType: event.resourceType,
        result: event.result,
      })),
      nextCursor:
        visible.length === filters.limit ? (visible.at(-1)?.id ?? null) : null,
    };
  }
}
