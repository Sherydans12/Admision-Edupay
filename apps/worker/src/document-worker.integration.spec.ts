import { randomUUID } from "node:crypto";

import {
  createAppPrismaClient,
  DOCUMENT_PROCESS_TOPIC,
  type DocumentService,
  OutboxService,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { DocumentWorker } from "./worker.js";

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
    correlationId: `synthetic-worker-${tenantId}`,
    effectiveActorId: randomUUID(),
    purpose: "e5c.worker.test",
    source: "trusted_job",
    tenantId,
  };
}

async function enqueue(tenantId: string, topic = DOCUMENT_PROCESS_TOPIC) {
  const tenantContext = context(tenantId);
  const documentVersionId = randomUUID();
  await runWithTenantContext(tenantContext, () =>
    new OutboxService(prisma).enqueue({
      idempotencyKey: `${topic}:${documentVersionId}`,
      payload: {
        correlationId: `synthetic-message-${documentVersionId}`,
        documentVersionId,
      },
      topic,
    }),
  );
  return documentVersionId;
}

function fakeDocuments(
  processed: Array<{ tenantId: string; versionId: string }>,
) {
  return {
    async processDocument(
      workerContext: TenantExecutionContext,
      versionId: string,
    ) {
      processed.push({ tenantId: workerContext.tenantId, versionId });
      return {
        documentVersionId: versionId,
        technicalStatus: "READY_FOR_REVIEW",
      };
    },
  } as unknown as DocumentService;
}

function failingDocuments(): DocumentService {
  return {
    async processDocument() {
      throw new Error("SYNTHETIC_TRANSIENT_HANDLER_FAILURE");
    },
  } as unknown as DocumentService;
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
    "document_reviews", "document_versions", "document_submissions", "applications",
    "assistance_sessions", "document_requirement_versions", "document_requirements",
    "audit_events", "outbox_messages", "admission_offerings", "form_fields",
    "form_sections", "form_versions", "form_definitions", "admission_processes",
    "course_levels", "academic_years", "campuses", "students", "family_profiles",
    "tenant_probe_records", "support_elevations", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "tenants" CASCADE`);
  await migrationPool.query(
    `INSERT INTO tenants (id,name) VALUES ($1,$2),($3,$4)`,
    [
      TENANT_A,
      "Synthetic worker tenant A",
      TENANT_B,
      "Synthetic worker tenant B",
    ],
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe.sequential("E5-C tenant-scoped document worker", () => {
  it("E5C-WRK-02: worker claims the tenant that owns the document message", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    const versionId = await enqueue(TENANT_B);
    const worker = new DocumentWorker(prisma, fakeDocuments(processed), 50);
    await expect(worker.pollOnce()).resolves.toBe(true);
    expect(processed).toEqual([{ tenantId: TENANT_B, versionId }]);
  });

  it("E5C-WRK-03: worker never processes tenant B under tenant A context", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    const versionA = await enqueue(TENANT_A);
    const versionB = await enqueue(TENANT_B);
    const worker = new DocumentWorker(prisma, fakeDocuments(processed), 50);
    await worker.pollOnce();
    await worker.pollOnce();
    expect(processed).toEqual([
      { tenantId: TENANT_A, versionId: versionA },
      { tenantId: TENANT_B, versionId: versionB },
    ]);
  });

  it("E5C-WRK-04: topic allowlist leaves unrelated outbox work untouched", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    await enqueue(TENANT_A, "synthetic.unrelated");
    const worker = new DocumentWorker(prisma, fakeDocuments(processed), 50);
    await expect(worker.pollOnce()).resolves.toBe(false);
    const tenantA = context(TENANT_A);
    const status = await runWithTenantContext(tenantA, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.findFirstOrThrow(),
      ),
    );
    expect(status.status).toBe("PENDING");
    expect(processed).toEqual([]);
  });

  it("E5C-WRK-05: a sent message is not processed twice", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    await enqueue(TENANT_A);
    const worker = new DocumentWorker(prisma, fakeDocuments(processed), 50);
    await expect(worker.pollOnce()).resolves.toBe(true);
    await expect(worker.pollOnce()).resolves.toBe(false);
    expect(processed).toHaveLength(1);
  });

  it("E5C-WRK-06: stop terminates the polling loop cleanly", async () => {
    const processed: Array<{ tenantId: string; versionId: string }> = [];
    const worker = new DocumentWorker(prisma, fakeDocuments(processed), 50);
    const running = worker.run();
    setTimeout(() => worker.stop(), 60);
    await expect(running).resolves.toBeUndefined();
  });

  it("E5C-LEASE-01: PROCESSING is not reclaimed before lease expiry", async () => {
    await enqueue(TENANT_A);
    const tenantContext = context(TENANT_A);
    const outbox = new OutboxService(prisma, { leaseMs: 1_000 });
    const claimedAt = new Date(Date.now() + 10_000);
    const first = await runWithTenantContext(tenantContext, () =>
      outbox.claimNext(claimedAt, [DOCUMENT_PROCESS_TOPIC]),
    );
    expect(first?.status).toBe("PROCESSING");
    await expect(
      runWithTenantContext(tenantContext, () =>
        outbox.claimNext(new Date(claimedAt.getTime() + 999), [
          DOCUMENT_PROCESS_TOPIC,
        ]),
      ),
    ).resolves.toBeUndefined();
  });

  it("E5C-LEASE-02: PROCESSING is reclaimed after lease expiry", async () => {
    await enqueue(TENANT_A);
    const tenantContext = context(TENANT_A);
    const outbox = new OutboxService(prisma, { leaseMs: 1_000 });
    const claimedAt = new Date(Date.now() + 10_000);
    await runWithTenantContext(tenantContext, () =>
      outbox.claimNext(claimedAt, [DOCUMENT_PROCESS_TOPIC]),
    );
    const reclaimed = await runWithTenantContext(tenantContext, () =>
      outbox.claimNext(new Date(claimedAt.getTime() + 1_001), [
        DOCUMENT_PROCESS_TOPIC,
      ]),
    );
    expect(reclaimed).toMatchObject({ attempts: 2, status: "PROCESSING" });
  });

  it("E5C-LEASE-03: a second worker recovers a claim after a simulated crash", async () => {
    await enqueue(TENANT_A);
    const tenantContext = context(TENANT_A);
    const outbox = new OutboxService(prisma, { leaseMs: 1_000 });
    const firstClaimAt = new Date(Date.now() + 10_000);
    const crashedClaim = await runWithTenantContext(tenantContext, () =>
      outbox.claimNext(firstClaimAt, [DOCUMENT_PROCESS_TOPIC]),
    );
    expect(crashedClaim?.status).toBe("PROCESSING");
    const recovered = await runWithTenantContext(tenantContext, () =>
      outbox.claimNext(new Date(firstClaimAt.getTime() + 1_001), [
        DOCUMENT_PROCESS_TOPIC,
      ]),
    );
    expect(recovered?.id).toBe(crashedClaim?.id);
    expect(recovered?.attempts).toBe(2);
  });

  it("E5C-LEASE-04: transient failure requeues PENDING with future availableAt", async () => {
    await enqueue(TENANT_A);
    let now = new Date(Date.now() + 10_000);
    const worker = new DocumentWorker(prisma, failingDocuments(), 50, {
      baseBackoffMs: 500,
      maxAttempts: 3,
      now: () => now,
      outboxLeaseMs: 1_000,
    });
    await expect(worker.pollOnce()).resolves.toBe(true);
    const message = await firstMessage(TENANT_A);
    expect(message).toMatchObject({
      attempts: 1,
      claimedAt: null,
      lastErrorCode: "DOCUMENT_PROCESSING_FAILED",
      status: "PENDING",
    });
    expect(message.availableAt.getTime()).toBe(now.getTime() + 500);
    now = new Date(now.getTime() + 1);
  });

  it("E5C-LEASE-05: backoff prevents an immediate retry", async () => {
    await enqueue(TENANT_A);
    const now = new Date(Date.now() + 10_000);
    const worker = new DocumentWorker(prisma, failingDocuments(), 50, {
      baseBackoffMs: 500,
      maxAttempts: 3,
      now: () => now,
      outboxLeaseMs: 1_000,
    });
    await expect(worker.pollOnce()).resolves.toBe(true);
    await expect(worker.pollOnce()).resolves.toBe(false);
    expect(await firstMessage(TENANT_A)).toMatchObject({
      attempts: 1,
      status: "PENDING",
    });
  });

  it("E5C-LEASE-06: max attempts terminates the job as FAILED", async () => {
    await enqueue(TENANT_A);
    const tenantContext = context(TENANT_A);
    await runWithTenantContext(tenantContext, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.updateMany({ data: { attempts: 2 } }),
      ),
    );
    const now = new Date(Date.now() + 10_000);
    const worker = new DocumentWorker(prisma, failingDocuments(), 50, {
      baseBackoffMs: 500,
      maxAttempts: 3,
      now: () => now,
      outboxLeaseMs: 1_000,
    });
    await expect(worker.pollOnce()).resolves.toBe(true);
    expect(await firstMessage(TENANT_A)).toMatchObject({
      attempts: 3,
      lastErrorCode: "DOCUMENT_PROCESSING_FAILED",
      status: "FAILED",
    });
  });

  it("E5C-LEASE-07: invalid payload fails permanently without a retry loop", async () => {
    const tenantContext = context(TENANT_A);
    await runWithTenantContext(tenantContext, () =>
      new OutboxService(prisma).enqueue({
        idempotencyKey: `invalid:${randomUUID()}`,
        payload: { syntheticInvalid: true },
        topic: DOCUMENT_PROCESS_TOPIC,
      }),
    );
    const now = new Date(Date.now() + 10_000);
    const worker = new DocumentWorker(prisma, fakeDocuments([]), 50, {
      baseBackoffMs: 500,
      maxAttempts: 3,
      now: () => now,
      outboxLeaseMs: 1_000,
    });
    await expect(worker.pollOnce()).resolves.toBe(true);
    expect(await firstMessage(TENANT_A)).toMatchObject({
      attempts: 1,
      lastErrorCode: "INVALID_DOCUMENT_JOB_PAYLOAD",
      status: "FAILED",
    });
    await expect(worker.pollOnce()).resolves.toBe(false);
  });

  it("E5C-LEASE-08: terminal scanner outcome is a successful SENT job", async () => {
    await enqueue(TENANT_A);
    const terminalDocuments = {
      async processDocument(
        _workerContext: TenantExecutionContext,
        versionId: string,
      ) {
        return {
          documentVersionId: versionId,
          technicalStatus: "BLOCKED_INFECTED",
        };
      },
    } as unknown as DocumentService;
    const worker = new DocumentWorker(prisma, terminalDocuments, 50);
    await expect(worker.pollOnce()).resolves.toBe(true);
    expect(await firstMessage(TENANT_A)).toMatchObject({ status: "SENT" });
  });
});
