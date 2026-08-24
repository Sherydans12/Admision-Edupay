import { randomUUID } from "node:crypto";

import {
  type CapacityOfferService,
  createAppPrismaClient,
  OFFER_EXPIRY_TOPIC,
  OutboxService,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { OfferExpiryWorker } from "./worker.js";

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
    correlationId: `synthetic-offer-worker-${tenantId}`,
    effectiveActorId: randomUUID(),
    purpose: "e5f.worker.test",
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
      idempotencyKey: `offer-expiry-test:${randomUUID()}`,
      payload: (options.payload ?? {
        correlationId: `synthetic-message-${offerVersionId}`,
        offerVersionId,
      }) as never,
      topic: options.topic ?? OFFER_EXPIRY_TOPIC,
    }),
  );
  return offerVersionId;
}

function fakeService(
  processed: Array<{ tenantId: string; versionId: string }>,
): CapacityOfferService {
  return {
    async expireOfferVersion(
      workerContext: TenantExecutionContext,
      versionId: string,
    ) {
      processed.push({ tenantId: workerContext.tenantId, versionId });
      return "EXPIRED" as const;
    },
  } as unknown as CapacityOfferService;
}

function failingService(): CapacityOfferService {
  return {
    async expireOfferVersion() {
      throw new Error("SYNTHETIC_TRANSIENT_EXPIRY_FAILURE");
    },
  } as unknown as CapacityOfferService;
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
      "Synthetic offer worker tenant A",
      TENANT_B,
      "Synthetic offer worker tenant B",
    ],
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe.sequential("E5-F tenant-scoped offer expiry worker", () => {
  it("WRK-01..02: claims the owning tenant and never processes B under A context", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    const versionA = await enqueue(TENANT_A);
    const versionB = await enqueue(TENANT_B);
    const worker = new OfferExpiryWorker(prisma, fakeService(processed), 50);
    await worker.pollOnce();
    await worker.pollOnce();
    expect(processed).toEqual([
      { tenantId: TENANT_A, versionId: versionA },
      { tenantId: TENANT_B, versionId: versionB },
    ]);
  });

  it("WRK-03..04: topic allowlist and sent-state make processing exactly once", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    await enqueue(TENANT_A, { topic: "synthetic.unrelated" });
    const versionId = await enqueue(TENANT_A);
    const worker = new OfferExpiryWorker(prisma, fakeService(processed), 50);
    await expect(worker.pollOnce()).resolves.toBe(true);
    await expect(worker.pollOnce()).resolves.toBe(false);
    expect(processed).toEqual([{ tenantId: TENANT_A, versionId }]);
  });

  it("WRK-05: invalid payload fails permanently without exposing payload data", async () => {
    await enqueue(TENANT_A, { payload: { syntheticInvalid: true } });
    const worker = new OfferExpiryWorker(prisma, fakeService([]), 50);
    await expect(worker.pollOnce()).resolves.toBe(true);
    expect(await firstMessage(TENANT_A)).toMatchObject({
      attempts: 1,
      lastErrorCode: "INVALID_OFFER_EXPIRY_JOB_PAYLOAD",
      status: "FAILED",
    });
  });

  it("WRK-06..07: transient failures back off and stop at the configured maximum", async () => {
    await enqueue(TENANT_A);
    const tenantContext = context(TENANT_A);
    await runWithTenantContext(tenantContext, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.updateMany({ data: { attempts: 1 } }),
      ),
    );
    const now = new Date(Date.now() + 10_000);
    const retrying = new OfferExpiryWorker(prisma, failingService(), 50, {
      baseBackoffMs: 500,
      maxAttempts: 3,
      now: () => now,
      outboxLeaseMs: 1_000,
    });
    await expect(retrying.pollOnce()).resolves.toBe(true);
    const pending = await firstMessage(TENANT_A);
    expect(pending).toMatchObject({
      attempts: 2,
      lastErrorCode: "OFFER_EXPIRY_FAILED",
      status: "PENDING",
    });
    expect(pending.availableAt.getTime()).toBe(now.getTime() + 1_000);
    await expect(retrying.pollOnce()).resolves.toBe(false);

    await runWithTenantContext(tenantContext, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.updateMany({
          data: { attempts: 2, availableAt: now },
        }),
      ),
    );
    await expect(retrying.pollOnce()).resolves.toBe(true);
    expect(await firstMessage(TENANT_A)).toMatchObject({
      attempts: 3,
      lastErrorCode: "OFFER_EXPIRY_FAILED",
      status: "FAILED",
    });
  });

  it("WRK-08: future availableAt is not claimed before the exact deadline", async () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    await enqueue(TENANT_A, {
      availableAt: new Date("2026-08-11T12:00:01.000Z"),
    });
    const worker = new OfferExpiryWorker(prisma, fakeService(processed), 50, {
      now: () => now,
    });
    await expect(worker.pollOnce()).resolves.toBe(false);
    expect(processed).toEqual([]);
  });

  it("WRK-09: stop terminates the polling loop cleanly", async () => {
    const worker = new OfferExpiryWorker(prisma, fakeService([]), 50);
    const running = worker.run();
    setTimeout(() => worker.stop(), 60);
    await expect(running).resolves.toBeUndefined();
  });
});
