import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

describe("HealthController", () => {
  it("returns a minimal non-sensitive health response", () => {
    const controller = new HealthController(
      new HealthService(async () => true),
    );

    expect(controller.getHealth()).toEqual({
      service: "admission-api",
      status: "ok",
    });
  });

  it("exposes live and safe readiness states", async () => {
    const controller = new HealthController(
      new HealthService(async () => true),
    );
    expect(controller.getLive()).toEqual({
      service: "admission-api",
      status: "ok",
    });
    await expect(controller.getReady()).resolves.toEqual({
      service: "admission-api",
      status: "ok",
    });
  });
});
