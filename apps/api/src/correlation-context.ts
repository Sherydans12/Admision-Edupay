import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const pattern = /^[A-Za-z0-9._:-]{1,96}$/;
const storage = new AsyncLocalStorage<string>();

export function resolveCorrelationId(candidate: string | undefined): string {
  return candidate !== undefined && pattern.test(candidate)
    ? candidate
    : randomUUID();
}

export function runWithCorrelationContext<T>(
  id: string,
  operation: () => T,
): T {
  return storage.run(id, operation);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore();
}
