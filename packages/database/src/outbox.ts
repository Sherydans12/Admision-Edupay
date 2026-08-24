import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { OutboxMessageStatus } from "./generated/prisma/enums.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export interface EnqueueOutboxInput {
  availableAt?: Date;
  idempotencyKey: string;
  payload: Prisma.InputJsonValue;
  topic: string;
}

export const DEFAULT_OUTBOX_LEASE_MS = 60_000;

export interface OutboxConfig {
  leaseMs?: number;
}

export class OutboxService {
  private readonly leaseMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    config: OutboxConfig = {},
  ) {
    this.leaseMs = config.leaseMs ?? DEFAULT_OUTBOX_LEASE_MS;
    if (!Number.isSafeInteger(this.leaseMs) || this.leaseMs < 1_000) {
      throw new TypeError("Outbox lease must be at least 1000ms");
    }
  }

  enqueue(input: EnqueueOutboxInput, now = new Date()) {
    return withTenantTransaction(this.prisma, (transaction) => {
      const context = getRequiredTenantContext();
      return transaction.outboxMessage.create({
        data: {
          availableAt: input.availableAt ?? now,
          idempotencyKey: input.idempotencyKey,
          payload: input.payload,
          tenantId: context.tenantId,
          topic: input.topic,
        },
      });
    });
  }

  async claimNext(now = new Date(), topicAllowlist?: readonly string[]) {
    if (topicAllowlist !== undefined && topicAllowlist.length === 0) {
      return undefined;
    }
    return withTenantTransaction(this.prisma, async (transaction) => {
      const topicFilter =
        topicAllowlist === undefined
          ? Prisma.empty
          : Prisma.sql`AND topic IN (${Prisma.join(topicAllowlist)})`;
      const leaseExpiredAt = new Date(now.getTime() - this.leaseMs);
      const [candidate] = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT id
          FROM outbox_messages
          WHERE (
              (status = 'PENDING'::"OutboxMessageStatus" AND available_at <= ${now})
              OR
              (status = 'PROCESSING'::"OutboxMessageStatus" AND claimed_at <= ${leaseExpiredAt})
            )
            ${topicFilter}
          ORDER BY COALESCE(claimed_at, available_at), created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `,
      );
      if (candidate === undefined) return undefined;

      return transaction.outboxMessage.update({
        data: {
          attempts: { increment: 1 },
          claimedAt: now,
          status: OutboxMessageStatus.PROCESSING,
        },
        where: { id: candidate.id },
      });
    });
  }

  markSent(id: string, expectedClaimedAt: Date) {
    return withTenantTransaction(this.prisma, (transaction) =>
      transaction.outboxMessage.updateMany({
        data: { status: OutboxMessageStatus.SENT },
        where: {
          claimedAt: expectedClaimedAt,
          id,
          status: OutboxMessageStatus.PROCESSING,
          tenantId: getRequiredTenantContext().tenantId,
        },
      }),
    );
  }

  markFailed(id: string, expectedClaimedAt: Date, errorCode: string) {
    return withTenantTransaction(this.prisma, (transaction) =>
      transaction.outboxMessage.updateMany({
        data: { lastErrorCode: errorCode, status: OutboxMessageStatus.FAILED },
        where: {
          claimedAt: expectedClaimedAt,
          id,
          status: OutboxMessageStatus.PROCESSING,
          tenantId: getRequiredTenantContext().tenantId,
        },
      }),
    );
  }

  requeueAfterFailure(
    id: string,
    expectedClaimedAt: Date,
    errorCode: string,
    availableAt: Date,
  ) {
    return withTenantTransaction(this.prisma, (transaction) =>
      transaction.outboxMessage.updateMany({
        data: {
          availableAt,
          claimedAt: null,
          lastErrorCode: errorCode,
          status: OutboxMessageStatus.PENDING,
        },
        where: {
          claimedAt: expectedClaimedAt,
          id,
          status: OutboxMessageStatus.PROCESSING,
          tenantId: getRequiredTenantContext().tenantId,
        },
      }),
    );
  }
}

export async function listActiveTenantIdsForTrustedWorker(
  prisma: PrismaClient,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ tenant_id: string }>>`
    SELECT tenant_id FROM admission_list_active_tenant_ids_for_worker()
  `;
  return rows.map((row) => row.tenant_id);
}
