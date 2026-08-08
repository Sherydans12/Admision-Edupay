import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContextSource = "authenticated_request" | "trusted_job";
export type TenantContextOrigin =
  "membership" | "support_elevation" | "synthetic_test";

const VERIFIED_ELEVATION_BRAND = Symbol("verified-support-elevation");

export interface PlatformExecutionContext {
  readonly actorId: string;
  readonly correlationId: string;
  readonly effectiveActorId?: string;
  readonly globalCapabilities?: readonly string[];
  readonly globalSuperadmin: boolean;
  readonly purpose: string;
  readonly source: "authenticated_request" | "trusted_job";
}

export interface VerifiedSupportElevation {
  readonly categories: readonly string[];
  readonly expiresAt: Date;
  readonly id: string;
  readonly purpose: string;
  readonly scopes: readonly string[];
  readonly tenantId: string;
  readonly [VERIFIED_ELEVATION_BRAND]: true;
}

/** @internal Only the persisted elevation resolver may call this factory. */
export function createVerifiedSupportElevation(
  input: Omit<VerifiedSupportElevation, typeof VERIFIED_ELEVATION_BRAND>,
): VerifiedSupportElevation {
  return { ...input, [VERIFIED_ELEVATION_BRAND]: true };
}

export interface TenantExecutionContext {
  readonly actorId: string;
  readonly capabilities?: readonly string[];
  readonly contextOrigin: TenantContextOrigin;
  readonly correlationId: string;
  readonly effectiveActorId?: string;
  readonly membershipId?: string;
  readonly purpose: string;
  readonly source: TenantContextSource;
  readonly scopes?: readonly string[];
  readonly supportElevation?: VerifiedSupportElevation;
  readonly tenantId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tenantContextStorage = new AsyncLocalStorage<
  Readonly<TenantExecutionContext>
>();

export class TenantContextMissingError extends Error {
  constructor() {
    super("Tenant execution context is required");
    this.name = "TenantContextMissingError";
  }
}

export class PlatformContextTenantError extends Error {
  constructor() {
    super("Platform execution context cannot execute tenant-owned operations");
    this.name = "PlatformContextTenantError";
  }
}

function validateTenantContext(context: TenantExecutionContext): void {
  if (!UUID_PATTERN.test(context.tenantId)) {
    throw new TypeError(
      "Tenant execution context requires a valid UUID tenantId",
    );
  }

  for (const name of [
    "actorId",
    "correlationId",
    "purpose",
    "source",
    "contextOrigin",
  ] as const) {
    if (context[name].trim() === "") {
      throw new TypeError(`Tenant execution context requires ${name}`);
    }
  }

  for (const name of ["effectiveActorId", "membershipId"] as const) {
    if (context[name] !== undefined && context[name].trim() === "") {
      throw new TypeError(`Tenant execution context requires ${name}`);
    }
  }

  for (const name of ["capabilities", "scopes"] as const) {
    if (
      context[name] !== undefined &&
      context[name].some((value) => value.trim() === "")
    ) {
      throw new TypeError(
        `Tenant execution context requires non-empty ${name}`,
      );
    }
  }

  if (context.supportElevation !== undefined) {
    if (context.supportElevation.tenantId !== context.tenantId) {
      throw new TypeError(
        "Support elevation tenant must match the execution tenant",
      );
    }
    if (
      context.supportElevation.scopes.some((value) => value.trim() === "") ||
      context.supportElevation.categories.some((value) => value.trim() === "")
    ) {
      throw new TypeError(
        "Support elevation scopes and categories must be non-empty",
      );
    }
  }
}

export function runWithTenantContext<T>(
  context: TenantExecutionContext,
  operation: () => T,
): T {
  validateTenantContext(context);

  const frozenContext = {
    ...context,
    capabilities:
      context.capabilities === undefined
        ? undefined
        : Object.freeze([...context.capabilities]),
    scopes:
      context.scopes === undefined
        ? undefined
        : Object.freeze([...context.scopes]),
    supportElevation:
      context.supportElevation === undefined
        ? undefined
        : Object.freeze({
            ...context.supportElevation,
            categories: Object.freeze([...context.supportElevation.categories]),
            scopes: Object.freeze([...context.supportElevation.scopes]),
          }),
  } as Readonly<TenantExecutionContext>;

  return tenantContextStorage.run(Object.freeze(frozenContext), operation);
}

export function getRequiredTenantContext(): Readonly<TenantExecutionContext> {
  const context = tenantContextStorage.getStore();

  if (context === undefined) {
    throw new TenantContextMissingError();
  }

  return context;
}

export function assertTenantContext(
  context: PlatformExecutionContext | TenantExecutionContext,
): asserts context is TenantExecutionContext {
  if (!("tenantId" in context) || context.tenantId.trim() === "") {
    throw new PlatformContextTenantError();
  }
}
