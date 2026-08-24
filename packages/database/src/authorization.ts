import type {
  FamilyExecutionContext,
  PlatformExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
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
  | "TENANT_CONTEXT_REQUIRED"
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
export type AuthorizationContext =
  FamilyExecutionContext | PlatformExecutionContext | TenantExecutionContext;

function isFamilyContext(
  context: AuthorizationContext,
): context is FamilyExecutionContext {
  return "familyCapabilities" in context;
}

function isTenantContext(
  context: AuthorizationContext,
): context is TenantExecutionContext {
  return "tenantId" in context;
}

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
    elevation.expiresAt > now
  );
}

export function authorize(
  context: AuthorizationContext,
  requirement: AuthorizationRequirement,
  now = new Date(),
): AuthorizationDecision {
  if (requirement.permission === PERMISSIONS.PLATFORM_SUPPORT_ELEVATE) {
    if (
      isTenantContext(context) ||
      isFamilyContext(context) ||
      context.globalSuperadmin !== true ||
      context.globalCapabilities?.includes(
        PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
      ) !== true
    ) {
      return { code: "MISSING_PERMISSION", decision: "DENY" };
    }
    if (
      requirement.purpose !== undefined &&
      requirement.purpose !== context.purpose
    ) {
      return { code: "PURPOSE_MISMATCH", decision: "DENY" };
    }
    return { decision: "ALLOW" };
  }

  if (isFamilyContext(context)) {
    if (requirement.resourceTenantId !== undefined) {
      return { code: "TENANT_MISMATCH", decision: "DENY" };
    }
    if (!context.familyCapabilities?.includes(requirement.permission)) {
      return { code: "MISSING_PERMISSION", decision: "DENY" };
    }
    if (
      requirement.purpose !== undefined &&
      requirement.purpose !== context.purpose
    ) {
      return { code: "PURPOSE_MISMATCH", decision: "DENY" };
    }
    return { decision: "ALLOW" };
  }

  if (!isTenantContext(context)) {
    return {
      code:
        context.globalSuperadmin === true
          ? "SUPERADMIN_REQUIRES_ELEVATION"
          : "TENANT_CONTEXT_REQUIRED",
      decision: "DENY",
    };
  }

  if (
    context.supportElevation !== undefined &&
    !elevationIsActive(context, now)
  ) {
    return { code: "ELEVATION_EXPIRED", decision: "DENY" };
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
  const elevationScopeAllowed = includesScope(
    context.supportElevation?.scopes,
    requirement.scope,
  );
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
    !(
      [
        PERMISSIONS.ACTIVITY_CLOSE,
        PERMISSIONS.ACTIVITY_READ,
        PERMISSIONS.ACTIVITY_REPEAT,
        PERMISSIONS.ACTIVITY_SCHEDULE,
      ] as PermissionKey[]
    ).includes(requirement.permission) &&
    !(
      requirement.sensitivity === "highly_restricted" &&
      (
        [
          PERMISSIONS.ACTIVITY_PERFORM,
          PERMISSIONS.ACTIVITY_RESULT_READ,
        ] as PermissionKey[]
      ).includes(requirement.permission)
    ) &&
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

  return { decision: "ALLOW" };
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export function authorizeOrThrow(
  context: AuthorizationContext,
  requirement: AuthorizationRequirement,
  now = new Date(),
): void {
  const result = authorize(context, requirement, now);
  if (result.decision === "DENY") {
    throw new ForbiddenError();
  }
}
