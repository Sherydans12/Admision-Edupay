import { describe, expect, it } from "vitest";

import {
  OPERATIONAL_SIGNAL_CONTRACT,
  createOperationalSignalCandidate,
} from "./operational-signals.js";

describe("G5OR operational signal contract", () => {
  it("G5OR-OPS-05..10: deterministically represents stale, degraded and security conditions", () => {
    expect(OPERATIONAL_SIGNAL_CONTRACT).toHaveLength(16);
    expect(
      createOperationalSignalCandidate({
        signalId: "OP-JOB-STALE",
        dimensions: { ageMs: 60_001 },
      }),
    ).toMatchObject({ state: "ALERT_CANDIDATE" });
    expect(
      createOperationalSignalCandidate({ signalId: "OP-EMAIL-DEGRADATION" })
        .signalId,
    ).toBe("OP-EMAIL-DEGRADATION");
    expect(
      createOperationalSignalCandidate({ signalId: "SEC-CROSS-TENANT" })
        .signalId,
    ).toBe("SEC-CROSS-TENANT");
  });

  it("G5OR-OPS-11: redacts sensitive dimensions before a signal can leave the process", () => {
    const candidate = createOperationalSignalCandidate({
      signalId: "SEC-SENSITIVE-PERMISSION-DENIED",
      dimensions: {
        authorization: "secret",
        documentContent: "private",
        tenantId: "opaque-tenant",
      },
    });
    expect(candidate.dimensions).toEqual({
      authorization: "[REDACTED]",
      documentContent: "[REDACTED]",
      tenantId: "opaque-tenant",
    });
  });
});
