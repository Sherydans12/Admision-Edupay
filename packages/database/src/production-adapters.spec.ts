import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { ResendEmailAdapter } from "./production-adapters.js";

describe("ResendEmailAdapter", () => {
  it("rejects non-synthetic recipients before network access", async () => {
    const fetchImplementation = vi.fn();
    const adapter = new ResendEmailAdapter({
      apiKey: "synthetic-api-key",
      deliveryMode: "synthetic",
      fetchImplementation: fetchImplementation as unknown as typeof fetch,
      from: "Admission <synthetic@notifications.example.invalid>",
      publicWebUrl: "https://preprod.admission.example.invalid",
    });

    const result = await adapter.send({
      body: "Synthetic body",
      recipientEmail: "person@example.com",
      subject: "Synthetic subject",
    });

    expect(result.status).toBe("FAILED");
    expect(result.sanitizedErrorCode).toBe("INVALID_SYNTHETIC_RECIPIENT");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("sends only an allowlisted payload and an idempotency key", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> =
      [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push({ input, ...(init === undefined ? {} : { init }) });
      return new Response(JSON.stringify({ id: "provider-event-id" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    };
    const adapter = new ResendEmailAdapter({
      apiKey: "synthetic-api-key",
      deliveryMode: "synthetic",
      fetchImplementation,
      from: "Admission <synthetic@notifications.example.invalid>",
      publicWebUrl: "https://preprod.admission.example.invalid",
    });

    const result = await adapter.send({
      body: "Synthetic body",
      idempotencyKey: "communication-synthetic-1",
      recipientEmail: "delivered@resend.dev",
      subject: "Synthetic subject",
      tags: [{ name: "tenant_id", value: "synthetic-tenant" }],
    });

    expect(result).toEqual({
      provider: "resend",
      providerReference: "provider-event-id",
      status: "SENT",
    });
    const request = requests[0]?.init;
    expect(new Headers(request?.headers).get("Idempotency-Key")).toBe(
      "communication-synthetic-1",
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      from: "Admission <synthetic@notifications.example.invalid>",
      subject: "Synthetic subject",
      tags: [{ name: "tenant_id", value: "synthetic-tenant" }],
      text: "Synthetic body",
      to: ["delivered@resend.dev"],
    });
    expect(
      createHash("sha256").update("delivered@resend.dev").digest("hex"),
    ).toHaveLength(64);
  });
});
