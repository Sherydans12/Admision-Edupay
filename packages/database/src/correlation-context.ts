import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/;
const correlationStorage = new AsyncLocalStorage<string>();

export function resolveCorrelationId(candidate: string | undefined): string {
  if (candidate !== undefined && CORRELATION_PATTERN.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}

export function runWithCorrelationContext<T>(
  correlationId: string,
  operation: () => T,
): T {
  if (!CORRELATION_PATTERN.test(correlationId)) {
    throw new TypeError("Correlation ID is invalid");
  }
  return correlationStorage.run(correlationId, operation);
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}
