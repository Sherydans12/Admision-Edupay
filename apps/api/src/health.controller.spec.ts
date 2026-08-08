import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns a minimal non-sensitive health response", () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      service: "admission-api",
      status: "ok",
    });
  });
});
