import type { TenantExecutionContext } from "./tenant-execution-context.js";
import {
  PERMISSIONS,
  type PermissionKey,
  type Sensitivity,
} from "./permission-catalog.js";

export type AuthorizationDenyCode =
  | "MISSING_PERMISSION"
  | "MISSING_SCOPE"
  | "SENSITIVITY_NOT_ALLOWED"
  | "SEPARATION_OF_DUTIES"
  | "TENANT_MISMATCH"
  | "PURPOSE_MISMATCH"
  | "SUPERADMIN_REQUIRES_ELEVATION"
  | "ELEVATION_EXPIRED"
  | "ELEVATION_INACTIVE"
  | "INVALID_REQUIREMENT";

export interface AuthorizationRequirement {
  permission: PermissionKey;
  purpose?: string;
  resourceTenantId?: string;
  scope?: string;
  sensitivity?: Sensitivity;
  separationOfDuties?: {
    recommenderActorId?: string;
  };
}

export type AuthorizationDecision =
  { decision: "ALLOW" } | { code: AuthorizationDenyCode; decision: "DENY" };

function includesScope(
  scopes: readonly string[] | undefined,
  required: string | undefined,
): boolean {
  if (required === undefined) return true;
  return scopes?.includes(required) === true || scopes?.includes("*") === true;
}

function elevationIsActive(
  context: TenantExecutionContext,
  now: Date,
): boolean {
  const elevation = context.supportElevation;
  return (
    elevation !== undefined &&
    elevation.tenantId === context.tenantId &&
    elevation.closedAt === undefined &&
    elevation.revokedAt === undefined &&
    elevation.expiresAt > now
  );
}

export function authorize(
  context: TenantExecutionContext,
  requirement: AuthorizationRequirement,
  now = new Date(),
): AuthorizationDecision {
  if (
    context.globalSuperadmin === true &&
    context.supportElevation === undefined &&
    requirement.permission !== PERMISSIONS.PLATFORM_SUPPORT_ELEVATE
  ) {
    return { code: "SUPERADMIN_REQUIRES_ELEVATION", decision: "DENY" };
  }

  if (
    context.supportElevation !== undefined &&
    !elevationIsActive(context, now)
  ) {
    return {
      code:
        context.supportElevation.closedAt !== undefined ||
        context.supportElevation.revokedAt !== undefined
          ? "ELEVATION_INACTIVE"
          : "ELEVATION_EXPIRED",
      decision: "DENY",
    };
  }

  if (
    requirement.resourceTenantId !== undefined &&
    requirement.resourceTenantId !== context.tenantId
  ) {
    return { code: "TENANT_MISMATCH", decision: "DENY" };
  }

  if (!context.capabilities?.includes(requirement.permission)) {
    return { code: "MISSING_PERMISSION", decision: "DENY" };
  }

  const contextScopeAllowed = includesScope(context.scopes, requirement.scope);
  const elevationScopeAllowed =
    context.supportElevation?.scopes.includes("*") === true ||
    (requirement.scope !== undefined &&
      context.supportElevation?.scopes.includes(requirement.scope) === true);
  if (!contextScopeAllowed && !elevationScopeAllowed) {
    return { code: "MISSING_SCOPE", decision: "DENY" };
  }

  if (
    requirement.purpose !== undefined &&
    requirement.purpose !== context.purpose
  ) {
    return { code: "PURPOSE_MISMATCH", decision: "DENY" };
  }

  if (
    requirement.sensitivity !== undefined &&
    (requirement.sensitivity === "restricted" ||
      requirement.sensitivity === "highly_restricted") &&
    context.capabilities?.includes(PERMISSIONS.RESTRICTED_READ) !== true &&
    !context.supportElevation?.categories.includes(requirement.sensitivity)
  ) {
    return { code: "SENSITIVITY_NOT_ALLOWED", decision: "DENY" };
  }

  if (
    requirement.separationOfDuties?.recommenderActorId !== undefined &&
    requirement.separationOfDuties.recommenderActorId ===
      (context.effectiveActorId ?? context.actorId) &&
    requirement.permission === PERMISSIONS.APPLICATION_DECIDE
  ) {
    return { code: "SEPARATION_OF_DUTIES", decision: "DENY" };
  }

  if (
    context.supportElevation !== undefined &&
    !context.supportElevation.scopes.includes("*") &&
    requirement.scope !== undefined &&
    !context.supportElevation.scopes.includes(requirement.scope)
  ) {
    return { code: "MISSING_SCOPE", decision: "DENY" };
  }

  return { decision: "ALLOW" };
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export function authorizeOrThrow(
  context: TenantExecutionContext,
  requirement: AuthorizationRequirement,
  now = new Date(),
): void {
  const result = authorize(context, requirement, now);
  if (result.decision === "DENY") {
    throw new ForbiddenError();
  }
}
