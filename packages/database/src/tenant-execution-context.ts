import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContextSource = "authenticated_request" | "trusted_job";

export interface TenantExecutionContext {
  readonly actorId: string;
  readonly correlationId: string;
  readonly purpose: string;
  readonly source: TenantContextSource;
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

function validateTenantContext(context: TenantExecutionContext): void {
  if (!UUID_PATTERN.test(context.tenantId)) {
    throw new TypeError(
      "Tenant execution context requires a valid UUID tenantId",
    );
  }

  for (const [name, value] of Object.entries(context)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new TypeError(`Tenant execution context requires ${name}`);
    }
  }
}

export function runWithTenantContext<T>(
  context: TenantExecutionContext,
  operation: () => T,
): T {
  validateTenantContext(context);

  return tenantContextStorage.run(Object.freeze({ ...context }), operation);
}

export function getRequiredTenantContext(): Readonly<TenantExecutionContext> {
  const context = tenantContextStorage.getStore();

  if (context === undefined) {
    throw new TenantContextMissingError();
  }

  return context;
}
