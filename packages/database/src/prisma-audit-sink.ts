import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import type { AuditEvent, AuditSink } from "./audit.js";
import { sanitizeAuditMetadata } from "./audit-metadata.js";
import { withPlatformAuditTransaction } from "./tenant-transaction.js";

function asJson(
  value: Readonly<Record<string, unknown>>,
): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function createAuditEvent(
  transaction: Prisma.TransactionClient,
  event: AuditEvent,
): Promise<void> {
  const metadata = sanitizeAuditMetadata(event.metadata);
  await transaction.auditEvent.create({
    data: {
      action: event.action,
      actorId: event.actorId,
      correlationId: event.correlationId,
      effectiveActorId: event.effectiveActorId,
      ...(metadata === undefined ? {} : { metadata: asJson(metadata) }),
      occurredAt: event.occurredAt,
      purpose: event.purpose,
      ...(event.reasonCode === undefined
        ? {}
        : { reasonCode: event.reasonCode }),
      ...(event.resourceId === undefined
        ? {}
        : { resourceId: event.resourceId }),
      resourceType: event.resourceType,
      result: event.result,
      scope: event.tenantId === undefined ? "PLATFORM_GLOBAL" : "TENANT",
      ...(event.tenantId === undefined ? {} : { tenantId: event.tenantId }),
    },
  });
}

async function createPlatformAuditEvent(
  transaction: Prisma.TransactionClient,
  event: AuditEvent,
): Promise<void> {
  const metadata = sanitizeAuditMetadata(event.metadata);
  const metadataJson = metadata === undefined ? null : JSON.stringify(metadata);
  await transaction.$executeRaw`
    INSERT INTO audit_events (
      id,
      actor_id,
      effective_actor_id,
      action,
      purpose,
      resource_type,
      resource_id,
      result,
      reason_code,
      correlation_id,
      metadata,
      occurred_at,
      scope,
      tenant_id
    ) VALUES (
      ${randomUUID()},
      ${event.actorId},
      ${event.effectiveActorId},
      ${event.action},
      ${event.purpose},
      ${event.resourceType},
      ${event.resourceId ?? null},
      ${event.result},
      ${event.reasonCode ?? null},
      ${event.correlationId},
      CAST(${metadataJson} AS JSONB),
      ${event.occurredAt},
      'PLATFORM_GLOBAL',
      NULL
    )
  `;
}

/**
 * Durable sink for events emitted outside an existing business transaction.
 * It exposes only append-only AuditEvent insertion and never a general tenant client.
 */
export class PrismaAuditSink implements AuditSink {
  constructor(private readonly prisma: PrismaClient) {}

  async record(event: AuditEvent): Promise<void> {
    if (event.tenantId === undefined) {
      await withPlatformAuditTransaction(this.prisma, (transaction) =>
        createPlatformAuditEvent(transaction, event),
      );
      return;
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT set_config('admission.tenant_id', ${event.tenantId}, true) AS tenant_id
      `;
      await createAuditEvent(transaction, event);
    });
  }
}
