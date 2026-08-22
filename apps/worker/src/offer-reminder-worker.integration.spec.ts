import { randomUUID } from "node:crypto";

import {
  type CommunicationService,
  createAppPrismaClient,
  OFFER_REMINDER_PREPARE_TOPIC,
  OutboxService,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { OfferReminderWorker } from "./worker.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 2,
});
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function context(tenantId: string): TenantExecutionContext {
  return {
    actorId: randomUUID(),
    capabilities: [],
    contextOrigin: "trusted_job",
    correlationId: `synthetic-reminder-worker-${tenantId}`,
    effectiveActorId: randomUUID(),
    purpose: "offer.reminder.prepare",
    source: "trusted_job",
    tenantId,
  };
}

async function enqueue(
  tenantId: string,
  options: { availableAt?: Date; payload?: unknown; topic?: string } = {},
) {
  const offerVersionId = randomUUID();
  const tenantContext = context(tenantId);
  await runWithTenantContext(tenantContext, () =>
    new OutboxService(prisma).enqueue({
      ...(options.availableAt === undefined
        ? {}
        : { availableAt: options.availableAt }),
      idempotencyKey: `offer-reminder-test:${randomUUID()}`,
      payload: (options.payload ?? {
        correlationId: `synthetic-message-${offerVersionId}`,
        offerVersionId,
      }) as never,
      topic: options.topic ?? OFFER_REMINDER_PREPARE_TOPIC,
    }),
  );
  return offerVersionId;
}

function fakeService(
  processed: Array<{ tenantId: string; versionId: string }>,
): CommunicationService {
  return {
    async prepareOfferReminderCommunication(params: {
      offerVersionId: string;
    }) {
      processed.push({ tenantId: TENANT_A, versionId: params.offerVersionId });
      return { id: randomUUID() };
    },
  } as unknown as CommunicationService;
}

function failingService(): CommunicationService {
  return {
    async prepareOfferReminderCommunication() {
      throw new Error("SYNTHETIC_TRANSIENT_REMINDER_FAILURE");
    },
  } as unknown as CommunicationService;
}

async function firstMessage(tenantId: string) {
  const tenantContext = context(tenantId);
  return runWithTenantContext(tenantContext, () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.outboxMessage.findFirstOrThrow({
        orderBy: { createdAt: "asc" },
      }),
    ),
  );
}

beforeEach(async () => {
  await migrationPool.query(`TRUNCATE TABLE
    "communications", "outbox_messages", "audit_events" CASCADE`);
  await migrationPool.query(
    `INSERT INTO tenants (id, name)
     VALUES ($1, 'Tenant A'), ($2, 'Tenant B')
     ON CONFLICT (id) DO NOTHING`,
    [TENANT_A, TENANT_B],
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe("OfferReminderWorker (R3-WORK-*)", () => {
  it("R3-WORK-01 & R3-WORK-02: marks available reminder job as SENT after successful preparation", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    const versionId = await enqueue(TENANT_A);
    const worker = new OfferReminderWorker(prisma, fakeService(processed), 100);

    const handled = await worker.pollOnce();

    expect(handled).toBe(true);
    expect(processed).toEqual([{ tenantId: TENANT_A, versionId }]);
    const message = await firstMessage(TENANT_A);
    expect(message.status).toBe("SENT");
    expect(message.attempts).toBe(1);
  });

  it("R3-WORK-03: ignores reminder messages whose availableAt is in the future", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    await enqueue(TENANT_A, {
      availableAt: new Date(Date.now() + 60_000),
    });
    const worker = new OfferReminderWorker(prisma, fakeService(processed), 100);

    const handled = await worker.pollOnce();

    expect(handled).toBe(false);
    expect(processed).toEqual([]);
    const message = await firstMessage(TENANT_A);
    expect(message.status).toBe("PENDING");
    expect(message.attempts).toBe(0);
  });

  it("R3-WORK-04: marks permanently malformed payload as FAILED immediately", async () => {
    await enqueue(TENANT_A, { payload: { invalid: "payload" } });
    const worker = new OfferReminderWorker(prisma, fakeService([]), 100);

    const handled = await worker.pollOnce();

    expect(handled).toBe(true);
    const message = await firstMessage(TENANT_A);
    expect(message.status).toBe("FAILED");
    expect(message.lastErrorCode).toBe("INVALID_OFFER_REMINDER_JOB_PAYLOAD");
    expect(message.attempts).toBe(1);
  });

  it("R3-WORK-05: requeues transient failures with backoff", async () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    await enqueue(TENANT_A, { availableAt: now });
    const worker = new OfferReminderWorker(prisma, failingService(), 100, {
      baseBackoffMs: 1_000,
      maxAttempts: 3,
      now: () => now,
    });

    const handled = await worker.pollOnce();

    expect(handled).toBe(true);
    const message = await firstMessage(TENANT_A);
    expect(message.status).toBe("PENDING");
    expect(message.attempts).toBe(1);
    expect(message.lastErrorCode).toBe("OFFER_REMINDER_PREPARATION_FAILED");
    expect(message.availableAt.toISOString()).toBe("2026-08-21T12:00:01.000Z");
  });

  it("R3-WORK-06: respects tenant boundaries when polling", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    const versionId = await enqueue(TENANT_B);
    const worker = new OfferReminderWorker(prisma, fakeService(processed), 100);

    const handled = await worker.pollOnce();

    expect(handled).toBe(true);
    expect(processed).toEqual([{ tenantId: TENANT_A, versionId }]);
    const messageB = await firstMessage(TENANT_B);
    expect(messageB.status).toBe("SENT");
  });
});
