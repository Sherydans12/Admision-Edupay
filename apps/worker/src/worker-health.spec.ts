import { describe, expect, it } from "vitest";

import {
  WorkerHealthTracker,
  getWorkerHealth,
  markWorkerReady,
} from "./worker-health.js";

describe("worker health", () => {
  it("exposes a process health primitive without HTTP", () => {
    markWorkerReady();
    expect(getWorkerHealth()).toEqual({
      service: "admission-worker",
      status: "ready",
    });
  });

  it("G5OR-OPS-04: exposes STARTING before READY without a public business endpoint", () => {
    const tracker = new WorkerHealthTracker();
    expect(tracker.get().status).toBe("starting");
    tracker.markReady();
    expect(tracker.get().status).toBe("ready");
  });
});
