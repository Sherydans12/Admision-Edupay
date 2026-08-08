import type { TenantExecutionContext } from "../tenant-execution-context.js";

export const SYNTHETIC_TENANTS = {
  A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

type SyntheticTenantKey = keyof typeof SYNTHETIC_TENANTS;

/** TEST / SYNTHETIC CONTEXT: simula principal autenticado + membership resuelta server-side. */
export function syntheticAuthenticatedRequestContext(
  tenant: SyntheticTenantKey,
): TenantExecutionContext {
  return {
    actorId: `synthetic-request-principal-${tenant.toLowerCase()}`,
    correlationId: `synthetic-request-correlation-${tenant.toLowerCase()}`,
    purpose: "E4_B_RLS_REQUEST_POC",
    source: "authenticated_request",
    tenantId: SYNTHETIC_TENANTS[tenant],
  };
}

/** TEST / SYNTHETIC CONTEXT: simula metadata interna confiable de un job ya validado. */
export function syntheticTrustedJobContext(
  tenant: SyntheticTenantKey,
): TenantExecutionContext {
  return {
    actorId: "synthetic-system-worker",
    correlationId: `synthetic-job-correlation-${tenant.toLowerCase()}`,
    purpose: "E4_B_RLS_JOB_POC",
    source: "trusted_job",
    tenantId: SYNTHETIC_TENANTS[tenant],
  };
}
