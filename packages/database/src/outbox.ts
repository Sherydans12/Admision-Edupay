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

export class OutboxService {
  constructor(private readonly prisma: PrismaClient) {}

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
      const [candidate] = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT id
          FROM outbox_messages
          WHERE status = 'PENDING'::"OutboxMessageStatus"
            AND available_at <= ${now}
            ${topicFilter}
          ORDER BY available_at, created_at
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

  markSent(id: string, now = new Date()) {
    void now;
    return withTenantTransaction(this.prisma, (transaction) =>
      transaction.outboxMessage.updateMany({
        data: { status: OutboxMessageStatus.SENT },
        where: {
          id,
          status: OutboxMessageStatus.PROCESSING,
          tenantId: getRequiredTenantContext().tenantId,
        },
      }),
    );
  }

  markFailed(id: string, errorCode: string, now = new Date()) {
    void now;
    return withTenantTransaction(this.prisma, (transaction) =>
      transaction.outboxMessage.updateMany({
        data: { lastErrorCode: errorCode, status: OutboxMessageStatus.FAILED },
        where: {
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
