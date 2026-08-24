import { createHmac, randomUUID } from "node:crypto";

import {
  CommunicationLifecycle,
  CommunicationSuppressionReason,
  CommunicationWebhookEventType,
  OperationalTaskStatus,
  OperationalTaskType,
  type PrismaClient,
} from "./generated/prisma/client.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export interface EmailSuppressionHashOptions {
  keyVersion: number;
  secret: string;
}

export interface VerifiedEmailWebhookEvent {
  communicationId: string;
  eventType: CommunicationWebhookEventType;
  occurredAt: Date;
  providerEventId: string;
  providerReference: string;
}

export function createEmailSuppressionHashOptionsFromEnv(): EmailSuppressionHashOptions {
  const secret = process.env.EMAIL_SUPPRESSION_HMAC_SECRET;
  if (secret === undefined || secret.trim() === "") {
    throw new Error("EMAIL_SUPPRESSION_HMAC_SECRET is required");
  }
  const keyVersion = Number(
    process.env.EMAIL_SUPPRESSION_HASH_KEY_VERSION ?? 1,
  );
  const options = { keyVersion, secret };
  hashSuppressedEmail(
    "00000000-0000-4000-8000-000000000000",
    "probe@example.invalid",
    options,
  );
  return options;
}

export function createEmailSuppressionHashOptionsListFromEnv(): readonly EmailSuppressionHashOptions[] {
  const current = createEmailSuppressionHashOptionsFromEnv();
  const raw = process.env.EMAIL_SUPPRESSION_PREVIOUS_KEYS_JSON ?? "[]";
  let previous: unknown;
  try {
    previous = JSON.parse(raw);
  } catch {
    throw new Error("EMAIL_SUPPRESSION_PREVIOUS_KEYS_JSON must be valid JSON");
  }
  if (!Array.isArray(previous)) {
    throw new Error("EMAIL_SUPPRESSION_PREVIOUS_KEYS_JSON must be an array");
  }
  const result = [current];
  for (const entry of previous) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("keyVersion" in entry) ||
      !("secret" in entry) ||
      typeof entry.keyVersion !== "number" ||
      typeof entry.secret !== "string"
    ) {
      throw new Error("Invalid previous email suppression key entry");
    }
    const option = { keyVersion: entry.keyVersion, secret: entry.secret };
    hashSuppressedEmail(
      "00000000-0000-4000-8000-000000000000",
      "probe@example.invalid",
      option,
    );
    if (result.some((item) => item.keyVersion === option.keyVersion)) {
      throw new Error("Email suppression key versions must be unique");
    }
    result.push(option);
  }
  return result;
}

export function hashSuppressedEmail(
  tenantId: string,
  email: string,
  options: EmailSuppressionHashOptions,
): string {
  if (Buffer.byteLength(options.secret, "utf8") < 32) {
    throw new TypeError("Email suppression HMAC secret must contain 32 bytes");
  }
  if (!Number.isInteger(options.keyVersion) || options.keyVersion < 1) {
    throw new TypeError("Email suppression hash key version must be positive");
  }
  return createHmac("sha256", options.secret)
    .update(tenantId, "utf8")
    .update("\0", "utf8")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export class EmailDeliveryEventService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly suppressionHash: EmailSuppressionHashOptions,
  ) {}

  async processVerifiedEvent(input: VerifiedEmailWebhookEvent) {
    const context = getRequiredTenantContext();
    try {
      return await withTenantTransaction(this.prisma, async (tx) => {
        const existing = await tx.communicationWebhookEvent.findFirst({
          include: { communicationAttempt: true },
          where: {
            provider: "resend",
            providerEventId: input.providerEventId,
            tenantId: context.tenantId,
          },
        });
        if (existing !== null) {
          if (
            existing.eventType !== input.eventType ||
            existing.communicationAttempt.communicationId !==
              input.communicationId ||
            existing.communicationAttempt.providerReference !==
              input.providerReference
          ) {
            throw new Error("WEBHOOK_EVENT_CONFLICT");
          }
          return { eventId: existing.id, idempotent: true };
        }

        const attempt = await tx.communicationAttempt.findFirst({
          include: { communication: true },
          where: {
            communicationId: input.communicationId,
            provider: "resend",
            providerReference: input.providerReference,
            tenantId: context.tenantId,
          },
        });
        if (attempt === null) throw new Error("WEBHOOK_TARGET_NOT_FOUND");

        const event = await tx.communicationWebhookEvent.create({
          data: {
            communicationAttemptId: attempt.id,
            eventType: input.eventType,
            id: randomUUID(),
            occurredAt: input.occurredAt,
            provider: "resend",
            providerEventId: input.providerEventId,
            tenantId: context.tenantId,
          },
        });

        if (
          input.eventType === CommunicationWebhookEventType.DELIVERED &&
          attempt.communication.lifecycle === CommunicationLifecycle.SENT
        ) {
          await tx.communication.update({
            data: { lifecycle: CommunicationLifecycle.DELIVERED },
            where: { id: attempt.communicationId },
          });
        }

        if (
          input.eventType === CommunicationWebhookEventType.BOUNCED ||
          input.eventType === CommunicationWebhookEventType.COMPLAINED
        ) {
          const reason =
            input.eventType === CommunicationWebhookEventType.BOUNCED
              ? CommunicationSuppressionReason.BOUNCE
              : CommunicationSuppressionReason.COMPLAINT;
          const channelHash = hashSuppressedEmail(
            context.tenantId,
            attempt.communication.recipientEmail,
            this.suppressionHash,
          );
          await tx.$executeRaw`
          INSERT INTO communication_suppressions
            (id, tenant_id, channel_hash, hash_key_version, reason,
             source_webhook_event_id, suppressed_at)
          VALUES
            (${randomUUID()}::uuid, ${context.tenantId}::uuid, ${channelHash},
             ${this.suppressionHash.keyVersion},
             ${reason}::"CommunicationSuppressionReason", ${event.id}::uuid,
             CURRENT_TIMESTAMP)
          ON CONFLICT (tenant_id, hash_key_version, channel_hash) DO NOTHING
        `;
          if (attempt.communication.lifecycle === CommunicationLifecycle.SENT) {
            await tx.communication.update({
              data: { lifecycle: CommunicationLifecycle.FAILED },
              where: { id: attempt.communicationId },
            });
          }
          await tx.operationalTask.upsert({
            create: {
              applicationId: attempt.communication.applicationId,
              communicationId: attempt.communicationId,
              description:
                "El proveedor rechazó la entrega. El portal familiar sigue intacto y el canal requiere revisión.",
              status: OperationalTaskStatus.PENDING,
              tenantId: context.tenantId,
              title: "Revisar canal de notificación",
              type: OperationalTaskType.COMMUNICATION_FAILED,
            },
            update: {},
            where: {
              tenantId_communicationId_type: {
                communicationId: attempt.communicationId,
                tenantId: context.tenantId,
                type: OperationalTaskType.COMMUNICATION_FAILED,
              },
            },
          });
        }

        return { eventId: event.id, idempotent: false };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return withTenantTransaction(this.prisma, async (tx) => {
        const existing = await tx.communicationWebhookEvent.findFirst({
          include: { communicationAttempt: true },
          where: {
            provider: "resend",
            providerEventId: input.providerEventId,
            tenantId: context.tenantId,
          },
        });
        if (
          existing === null ||
          existing.eventType !== input.eventType ||
          existing.communicationAttempt.communicationId !==
            input.communicationId ||
          existing.communicationAttempt.providerReference !==
            input.providerReference
        ) {
          throw new Error("WEBHOOK_EVENT_CONFLICT");
        }
        return { eventId: existing.id, idempotent: true };
      });
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
