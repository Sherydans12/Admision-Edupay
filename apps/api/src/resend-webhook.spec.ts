import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseVerifiedResendEvent,
  resolveWebhookRoute,
  verifySvixSignature,
} from "./resend-webhook.service.js";

describe("Resend webhook signature", () => {
  it("accepts exact signed bytes and rejects tampering or stale timestamps", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const timestamp = String(Math.floor(now.getTime() / 1_000));
    const id = "msg_synthetic";
    const rawBody = Buffer.from('{"type":"email.delivered"}', "utf8");
    const secretBytes = Buffer.from(
      "synthetic-webhook-secret-32-bytes!",
      "utf8",
    );
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const signature = createHmac("sha256", secretBytes)
      .update(`${id}.${timestamp}.`, "utf8")
      .update(rawBody)
      .digest("base64");
    const request = {
      headers: {
        "svix-id": id,
        "svix-signature": `v1,${signature}`,
        "svix-timestamp": timestamp,
      },
    };

    expect(verifySvixSignature(rawBody, request, secret, now)).toBe(true);
    expect(verifySvixSignature(Buffer.from("{}"), request, secret, now)).toBe(
      false,
    );
    expect(
      verifySvixSignature(
        rawBody,
        request,
        secret,
        new Date("2026-08-24T12:06:00.000Z"),
      ),
    ).toBe(false);
  });

  it("uses the signed svix-id when the Resend body has no top-level id", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const timestamp = String(Math.floor(now.getTime() / 1_000));
    const id = "msg_synthetic_without_body_id";
    const rawBody = Buffer.from(
      JSON.stringify({
        created_at: now.toISOString(),
        data: {
          email_id: "email_synthetic",
          tags: {
            communication_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        },
        type: "email.delivered",
      }),
      "utf8",
    );
    const secretBytes = Buffer.from(
      "synthetic-webhook-secret-32-bytes!",
      "utf8",
    );
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const signature = createHmac("sha256", secretBytes)
      .update(`${id}.${timestamp}.`, "utf8")
      .update(rawBody)
      .digest("base64");

    const parsed = parseVerifiedResendEvent(
      {
        headers: {
          "svix-id": id,
          "svix-signature": `v1,${signature}`,
          "svix-timestamp": timestamp,
        },
        rawBody,
      },
      secret,
      now,
    );

    expect(parsed.providerEventId).toBe(id);
    expect(parsed.event.type).toBe("email.delivered");
  });

  it("routes signed identity events outside tenant communications", () => {
    expect(resolveWebhookRoute({ purpose: "identity_verification" })).toEqual({
      kind: "identity",
    });
    expect(() => resolveWebhookRoute({ purpose: "unknown" })).toThrow();
  });
});
