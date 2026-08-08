import { describe, expect, it } from "vitest";

import { getWorkerDescriptor } from "./worker.js";

describe("worker foundation", () => {
  it("exposes an independent synthetic worker descriptor", () => {
    expect(getWorkerDescriptor()).toEqual({
      environment: "synthetic-development",
      service: "admission-worker",
      status: "ready",
    });
  });
});
