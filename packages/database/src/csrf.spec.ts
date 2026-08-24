import { describe, expect, it } from "vitest";

import { StatelessCsrfService } from "./csrf.js";

describe("StatelessCsrfService", () => {
  const service = new StatelessCsrfService("s".repeat(32));
  const now = new Date("2026-08-24T12:00:00.000Z");

  it("validates across service instances without storing session state", () => {
    const token = service.issueToken("session-a", 60, now);
    const secondInstance = new StatelessCsrfService("s".repeat(32));
    expect(
      secondInstance.validate({
        csrfToken: token,
        expectedOrigin: "https://preprod.admission.example.invalid",
        method: "POST",
        now: new Date("2026-08-24T12:00:30.000Z"),
        origin: "https://preprod.admission.example.invalid",
        sessionId: "session-a",
      }),
    ).toBe(true);
  });

  it("rejects another session, expired tokens and deceptive referers", () => {
    const token = service.issueToken("session-a", 60, now);
    const base = {
      csrfToken: token,
      expectedOrigin: "https://preprod.admission.example.invalid",
      method: "POST",
      now: new Date("2026-08-24T12:00:30.000Z"),
      origin: "https://preprod.admission.example.invalid",
    };
    expect(service.validate({ ...base, sessionId: "session-b" })).toBe(false);
    expect(
      service.validate({
        ...base,
        now: new Date("2026-08-24T12:01:00.000Z"),
        sessionId: "session-a",
      }),
    ).toBe(false);
    expect(
      service.validate({
        csrfToken: base.csrfToken,
        expectedOrigin: base.expectedOrigin,
        method: base.method,
        now: base.now,
        referer:
          "https://preprod.admission.example.invalid.attacker.example/path",
        sessionId: "session-a",
      }),
    ).toBe(false);
  });
});
