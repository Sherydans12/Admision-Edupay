import { describe, expect, it } from "vitest";

import { InMemoryCsrfService } from "./csrf.js";
import {
  resolveCorrelationId,
  runWithCorrelationContext,
} from "./correlation-context.js";
import {
  buildSessionCookieOptions,
  createOpaqueSessionCookie,
} from "./session-cookie.js";
import { StructuredLogger } from "./structured-logger.js";

describe("operational security primitives", () => {
  it("validates and propagates correlation IDs without making them authority", () => {
    expect(resolveCorrelationId("valid-correlation_01")).toBe(
      "valid-correlation_01",
    );
    expect(resolveCorrelationId("contains spaces")).not.toBe("contains spaces");
    let observed = "";
    runWithCorrelationContext("synthetic-correlation", () => {
      observed = new StructuredLogger("synthetic-service", () => {}).info(
        "TEST",
        "SUCCESS",
      ).correlationId;
    });
    expect(observed).toBe("synthetic-correlation");
  });

  it("redacts cookies, tokens, credentials, URLs and sensitive content", () => {
    let line = "";
    const logger = new StructuredLogger("synthetic-service", (value) => {
      line = value;
    });
    logger.info("TEST_REDACTION", "SUCCESS", {
      authorization: "Bearer synthetic",
      cookie: "admission_session=synthetic",
      DATABASE_URL: "postgresql://synthetic",
      documentContent: "synthetic-document",
      safeField: "visible",
      sessionRawToken: "synthetic-token",
    });
    expect(line).not.toContain("synthetic-token");
    expect(line).not.toContain("postgresql://synthetic");
    expect(line).toContain("visible");
  });

  it("requires a synchronizer token and origin for mutating requests", () => {
    const csrf = new InMemoryCsrfService();
    const token = csrf.issueToken("synthetic-session");
    expect(
      csrf.validate({
        expectedOrigin: "https://synthetic.test",
        method: "GET",
        sessionId: "synthetic-session",
      }),
    ).toBe(true);
    expect(
      csrf.validate({
        csrfToken: token,
        expectedOrigin: "https://synthetic.test",
        method: "POST",
        origin: "https://synthetic.test",
        sessionId: "synthetic-session",
      }),
    ).toBe(true);
    expect(
      csrf.validate({
        csrfToken: token,
        expectedOrigin: "https://synthetic.test",
        method: "POST",
        origin: "https://attacker.test",
        sessionId: "synthetic-session",
      }),
    ).toBe(false);
    expect(
      csrf.validate({
        expectedOrigin: "https://synthetic.test",
        method: "POST",
        origin: "https://synthetic.test",
        sessionId: "synthetic-session",
      }),
    ).toBe(false);
  });

  it("configures an opaque HttpOnly cookie without tenant or identity claims", () => {
    const options = buildSessionCookieOptions({
      environment: "production",
      sameSite: "lax",
    });
    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      secure: true,
      sameSite: "lax",
    });
    const cookie = createOpaqueSessionCookie("synthetic-opaque-token", options);
    expect(cookie).toMatchObject({
      name: "admission_session",
      value: "synthetic-opaque-token",
    });
    expect(cookie).not.toContain("tenant");
    expect(cookie).not.toContain("permission");
  });
});
