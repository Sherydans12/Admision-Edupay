import { describe, expect, it } from "vitest";

import {
  getRequiredTenantContext,
  runWithTenantContext,
  TenantContextMissingError,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";

const SYNTHETIC_CONTEXT: TenantExecutionContext = {
  actorId: "synthetic-request-principal",
  correlationId: "synthetic-correlation-a",
  purpose: "E4_B_RLS_POC",
  source: "authenticated_request",
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

describe("TenantExecutionContext", () => {
  it("fails closed when no context exists", () => {
    expect(() => getRequiredTenantContext()).toThrow(TenantContextMissingError);
  });

  it("propagates an immutable context across asynchronous work", async () => {
    await runWithTenantContext(SYNTHETIC_CONTEXT, async () => {
      await Promise.resolve();

      const context = getRequiredTenantContext();
      expect(context).toEqual(SYNTHETIC_CONTEXT);
      expect(Object.isFrozen(context)).toBe(true);
    });
  });

  it("rejects an invalid tenant identifier before database access", () => {
    expect(() =>
      runWithTenantContext(
        { ...SYNTHETIC_CONTEXT, tenantId: "not-a-uuid" },
        () => undefined,
      ),
    ).toThrow(TypeError);
  });
});
