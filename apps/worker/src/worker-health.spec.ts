import { describe, expect, it } from "vitest";

import { getWorkerHealth, markWorkerReady } from "./worker-health.js";

describe("worker health", () => {
  it("exposes a process health primitive without HTTP", () => {
    markWorkerReady();
    expect(getWorkerHealth()).toEqual({
      service: "admission-worker",
      status: "ready",
    });
  });
});
