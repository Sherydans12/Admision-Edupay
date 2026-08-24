import {
  CommunicationWebhookEventType,
  createEmailSuppressionHashOptionsFromEnv,
  EmailDeliveryEventService,
  PrismaClient,
  runWithTenantContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const uuidSchema = z.string().uuid();
const eventSchema = z.object({
  created_at: z.iso.datetime(),
  data: z
    .object({
      email_id: z.string().min(1).max(160),
      tags: z.record(z.string(), z.string()),
    })
    .passthrough(),
  type: z.enum(["email.delivered", "email.bounced", "email.complained"]),
});

interface WebhookRequest {
  headers?: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

function firstHeader(
  request: WebhookRequest,
  name: string,
): string | undefined {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function verifySvixSignature(
  rawBody: Buffer,
  request: WebhookRequest,
  secretValue: string,
  now = new Date(),
): boolean {
  const id = firstHeader(request, "svix-id");
  const timestamp = firstHeader(request, "svix-timestamp");
  const signatures = firstHeader(request, "svix-signature");
  if (id === undefined || timestamp === undefined || signatures === undefined) {
    return false;
  }
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Math.floor(now.getTime() / 1_000) - timestampSeconds) > 300
  ) {
    return false;
  }
  const encodedSecret = secretValue.startsWith("whsec_")
    ? secretValue.slice("whsec_".length)
    : secretValue;
  let secret: Buffer;
  try {
    secret = Buffer.from(encodedSecret, "base64");
  } catch {
    return false;
  }
  if (secret.byteLength < 16) return false;
  const expected = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.`, "utf8")
    .update(rawBody)
    .digest();
  return signatures.split(" ").some((candidate) => {
    const [version, encoded] = candidate.split(",", 2);
    if (version !== "v1" || encoded === undefined) return false;
    const actual = Buffer.from(encoded, "base64");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  });
}

@Injectable()
export class ResendWebhookService {
  constructor(private readonly prisma: PrismaClient) {}

  async process(request: WebhookRequest) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret === undefined) {
      throw new UnauthorizedException("INVALID_WEBHOOK_SIGNATURE");
    }
    const { event, providerEventId } = parseVerifiedResendEvent(
      request,
      secret,
    );
    const route = resolveWebhookRoute(event.data.tags);
    if (route.kind === "identity") {
      return { idempotent: true, ignored: true };
    }
    const { communicationId, tenantId } = route;
    const eventType = resolveEventType(event.type);
    const context: TenantExecutionContext = {
      actorId: "00000000-0000-4000-8000-000000000021",
      capabilities: [],
      contextOrigin: "trusted_job",
      correlationId: `resend-webhook:${providerEventId}`,
      effectiveActorId: "00000000-0000-4000-8000-000000000021",
      purpose: "communication.delivery.webhook",
      source: "trusted_job",
      tenantId,
    };
    return runWithTenantContext(context, () =>
      new EmailDeliveryEventService(
        this.prisma,
        createEmailSuppressionHashOptionsFromEnv(),
      ).processVerifiedEvent({
        communicationId,
        eventType,
        occurredAt: new Date(event.created_at),
        providerEventId,
        providerReference: event.data.email_id,
      }),
    );
  }
}

function resolveWebhookRoute(
  tags: Record<string, string>,
):
  | { kind: "identity" }
  | { communicationId: string; kind: "communication"; tenantId: string } {
  if (
    tags.purpose === "identity_verification" &&
    tags.tenant_id === undefined &&
    tags.communication_id === undefined
  ) {
    return { kind: "identity" };
  }
  return {
    communicationId: uuidSchema.parse(tags.communication_id),
    kind: "communication",
    tenantId: uuidSchema.parse(tags.tenant_id),
  };
}

function parseVerifiedResendEvent(
  request: WebhookRequest,
  secret: string,
  now = new Date(),
) {
  const rawBody = request.rawBody;
  if (
    rawBody === undefined ||
    !verifySvixSignature(rawBody, request, secret, now)
  ) {
    throw new UnauthorizedException("INVALID_WEBHOOK_SIGNATURE");
  }
  const providerEventId = firstHeader(request, "svix-id");
  if (providerEventId === undefined || providerEventId.length > 160) {
    throw new UnauthorizedException("INVALID_WEBHOOK_SIGNATURE");
  }
  return {
    event: eventSchema.parse(JSON.parse(rawBody.toString("utf8"))),
    providerEventId,
  };
}

function resolveEventType(
  type: "email.bounced" | "email.complained" | "email.delivered",
): CommunicationWebhookEventType {
  if (type === "email.bounced") return CommunicationWebhookEventType.BOUNCED;
  if (type === "email.complained") {
    return CommunicationWebhookEventType.COMPLAINED;
  }
  return CommunicationWebhookEventType.DELIVERED;
}

export { parseVerifiedResendEvent, resolveWebhookRoute, verifySvixSignature };
