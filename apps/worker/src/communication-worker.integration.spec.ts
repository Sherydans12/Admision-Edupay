import { randomUUID } from "node:crypto";
import {
  COMMUNICATION_SEND_TOPIC,
  type CommunicationService,
  createAppPrismaClient,
  getTenantContext,
  OutboxService,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CommunicationWorker } from "./worker.js";

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
    correlationId: `synthetic-comm-worker-${tenantId}`,
    effectiveActorId: randomUUID(),
    purpose: "e5g.worker.test",
    source: "trusted_job",
    tenantId,
  };
}

async function enqueue(
  tenantId: string,
  options: { availableAt?: Date; payload?: unknown; topic?: string } = {},
) {
  const commId = randomUUID();
  const tenantContext = context(tenantId);
  await runWithTenantContext(tenantContext, () =>
    new OutboxService(prisma).enqueue({
      ...(options.availableAt === undefined
        ? {}
        : { availableAt: options.availableAt }),
      idempotencyKey: `comm-send-test:${randomUUID()}`,
      payload: (options.payload ?? {
        communicationId: commId,
        correlationId: `synthetic-comm-msg-${commId}`,
      }) as never,
      topic: options.topic ?? COMMUNICATION_SEND_TOPIC,
    }),
  );
  return commId;
}

function fakeService(
  processed: Array<{ tenantId: string; communicationId: string }>,
): CommunicationService {
  return {
    async processOutboxSend(input: { communicationId: string }) {
      const currentContext = getTenantContext();
      processed.push({
        communicationId: input.communicationId,
        tenantId: currentContext?.tenantId ?? "",
      });
      return {
        id: input.communicationId,
        lifecycle: "SENT",
      } as unknown as Awaited<
        ReturnType<CommunicationService["processOutboxSend"]>
      >;
    },
  } as unknown as CommunicationService;
}

function failingService(): CommunicationService {
  return {
    async processOutboxSend() {
      throw new Error("SYNTHETIC_TRANSIENT_COMMUNICATION_FAILURE");
    },
  } as unknown as CommunicationService;
}

async function firstMessage(tenantId: string) {
  const tenantContext = context(tenantId);
  return runWithTenantContext(tenantContext, () =>
    withTenantTransaction(prisma, (tx) =>
      tx.outboxMessage.findFirstOrThrow({
        orderBy: { createdAt: "asc" },
      }),
    ),
  );
}

beforeEach(async () => {
  await migrationPool.query(`TRUNCATE TABLE
    "manual_contacts", "operational_tasks", "communication_attempts", "communications",
    "offer_acceptances", "application_withdrawals", "admission_offer_versions",
    "admission_offers", "waitlist_entries", "seat_reservations",
    "admission_capacity_adjustments", "admission_capacities", "outbox_messages",
    "audit_events", "applications", "admission_offerings", "form_fields",
    "form_sections", "form_versions", "form_definitions", "admission_processes",
    "course_levels", "academic_years", "campuses", "students", "family_profiles",
    "tenant_probe_records", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);

  await migrationPool.query(
    "INSERT INTO tenants (id,name) VALUES ($1,$2),($3,$4)",
    [
      TENANT_A,
      "Synthetic comm worker tenant A",
      TENANT_B,
      "Synthetic comm worker tenant B",
    ],
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe.sequential("E5-G tenant-scoped communication worker", () => {
  it("WRK-01..02: claims owning tenant and processes under correct tenant context", async () => {
    const processed: Array<{ tenantId: string; communicationId: string }> = [];
    const commA = await enqueue(TENANT_A);
    const commB = await enqueue(TENANT_B);
    const worker = new CommunicationWorker(prisma, fakeService(processed), 50);

    await worker.pollOnce();
    await worker.pollOnce();

    expect(processed).toEqual([
      { communicationId: commA, tenantId: TENANT_A },
      { communicationId: commB, tenantId: TENANT_B },
    ]);
  });

  it("WRK-03..04: topic allowlist and sent-state make processing exactly once", async () => {
    const processed: Array<{ tenantId: string; communicationId: string }> = [];
    await enqueue(TENANT_A, { topic: "unrelated.topic" });
    const commId = await enqueue(TENANT_A);
    const worker = new CommunicationWorker(prisma, fakeService(processed), 50);

    await expect(worker.pollOnce()).resolves.toBe(true);
    await expect(worker.pollOnce()).resolves.toBe(false);
    expect(processed).toEqual([
      { communicationId: commId, tenantId: TENANT_A },
    ]);
  });

  it("WRK-05: invalid payload fails permanently without retrying", async () => {
    await enqueue(TENANT_A, { payload: { invalidPayload: true } });
    const worker = new CommunicationWorker(prisma, fakeService([]), 50);

    await expect(worker.pollOnce()).resolves.toBe(true);
    const msg = await firstMessage(TENANT_A);
    expect(msg.status).toBe("FAILED");
    expect(msg.attempts).toBe(1);
    expect(msg.lastErrorCode).toBe("INVALID_COMMUNICATION_JOB_PAYLOAD");
  });

  it("WRK-06..07: transient failures back off and stop at max attempts", async () => {
    let nowTime = 1_000_000;
    const _commId = await enqueue(TENANT_A, { availableAt: new Date(nowTime) });
    const worker = new CommunicationWorker(prisma, failingService(), 50, {
      baseBackoffMs: 1_000,
      maxAttempts: 3,
      now: () => new Date(nowTime),
    });

    await expect(worker.pollOnce()).resolves.toBe(true);
    let msg = await firstMessage(TENANT_A);
    expect(msg.status).toBe("PENDING");
    expect(msg.attempts).toBe(1);
    expect(msg.lastErrorCode).toBe("COMMUNICATION_SEND_FAILED");
    expect(msg.availableAt.getTime()).toBe(1_000_000 + 1_000);

    nowTime += 1_500;
    await expect(worker.pollOnce()).resolves.toBe(true);
    msg = await firstMessage(TENANT_A);
    expect(msg.status).toBe("PENDING");
    expect(msg.attempts).toBe(2);
    expect(msg.availableAt.getTime()).toBe(1_000_000 + 1_500 + 2_000);

    nowTime += 2_500;
    await expect(worker.pollOnce()).resolves.toBe(true);
    msg = await firstMessage(TENANT_A);
    expect(msg.status).toBe("FAILED");
    expect(msg.attempts).toBe(3);
    expect(msg.lastErrorCode).toBe("COMMUNICATION_SEND_FAILED");

    nowTime += 10_000;
    await expect(worker.pollOnce()).resolves.toBe(false);
  });
});
