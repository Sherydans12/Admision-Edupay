import {
  COMMUNICATION_SEND_TOPIC,
  CommunicationService,
  CapacityOfferService,
  DOCUMENT_PROCESS_TOPIC,
  DocumentService,
  listActiveTenantIdsForTrustedWorker,
  OutboxService,
  OFFER_EXPIRY_TOPIC,
  OFFER_REMINDER_PREPARE_TOPIC,
  runWithTenantContext,
  StructuredLogger,
  type PrismaClient,
  type TenantExecutionContext,
} from "@admission/database";

export interface WorkerDescriptor {
  environment: "synthetic-development";
  service: "admission-worker";
  status: "ready";
}

function parseOfferExpiryPayload(value: unknown): {
  correlationId: string;
  offerVersionId: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("offerVersionId" in value) ||
    !("correlationId" in value) ||
    typeof value.offerVersionId !== "string" ||
    typeof value.correlationId !== "string"
  ) {
    throw new Error("INVALID_OFFER_EXPIRY_JOB_PAYLOAD");
  }
  return {
    correlationId: value.correlationId,
    offerVersionId: value.offerVersionId,
  };
}

export const DEFAULT_DOCUMENT_JOB_MAX_ATTEMPTS = 5;
export const DEFAULT_DOCUMENT_JOB_BASE_BACKOFF_MS = 1_000;

export interface DocumentWorkerOptions {
  baseBackoffMs?: number;
  maxAttempts?: number;
  now?: () => Date;
  outboxLeaseMs?: number;
}

export function getWorkerDescriptor(): WorkerDescriptor {
  return {
    environment: "synthetic-development",
    service: "admission-worker",
    status: "ready",
  };
}

const WORKER_ACTOR_ID = "00000000-0000-4000-8000-000000000005";

function parseDocumentPayload(value: unknown): {
  correlationId: string;
  documentVersionId: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("documentVersionId" in value) ||
    !("correlationId" in value) ||
    typeof value.documentVersionId !== "string" ||
    typeof value.correlationId !== "string"
  ) {
    throw new Error("INVALID_DOCUMENT_JOB_PAYLOAD");
  }
  return {
    correlationId: value.correlationId,
    documentVersionId: value.documentVersionId,
  };
}

export class DocumentWorker {
  private stopping = false;
  private readonly logger = new StructuredLogger("admission-worker");
  private readonly baseBackoffMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private readonly outboxLeaseMs: number | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly documents: DocumentService,
    private readonly pollIntervalMs = 1_000,
    options: DocumentWorkerOptions = {},
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 50) {
      throw new TypeError("Worker polling interval must be at least 50ms");
    }
    this.baseBackoffMs =
      options.baseBackoffMs ?? DEFAULT_DOCUMENT_JOB_BASE_BACKOFF_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_DOCUMENT_JOB_MAX_ATTEMPTS;
    this.now = options.now ?? (() => new Date());
    this.outboxLeaseMs = options.outboxLeaseMs;
    if (!Number.isSafeInteger(this.baseBackoffMs) || this.baseBackoffMs < 1) {
      throw new TypeError("Document job base backoff must be positive");
    }
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw new TypeError("Document job max attempts must be positive");
    }
  }

  stop(): void {
    this.stopping = true;
  }

  async run(): Promise<void> {
    this.logger.info("DOCUMENT_WORKER_STARTED", "READY");
    while (!this.stopping) {
      const processed = await this.pollOnce();
      if (!processed && !this.stopping) await this.waitForPoll();
    }
    this.logger.info("DOCUMENT_WORKER_STOPPED", "SUCCESS");
  }

  async pollOnce(): Promise<boolean> {
    const tenantIds = await listActiveTenantIdsForTrustedWorker(this.prisma);
    for (const tenantId of tenantIds) {
      if (this.stopping) return false;
      if (await this.processTenant(tenantId)) return true;
    }
    return false;
  }

  private async processTenant(tenantId: string): Promise<boolean> {
    const baseContext: TenantExecutionContext = {
      actorId: WORKER_ACTOR_ID,
      capabilities: [],
      contextOrigin: "trusted_job",
      correlationId: `document-worker:${tenantId}`,
      effectiveActorId: WORKER_ACTOR_ID,
      purpose: "document.processing",
      source: "trusted_job",
      tenantId,
    };
    return runWithTenantContext(baseContext, async () => {
      const outbox = new OutboxService(this.prisma, {
        ...(this.outboxLeaseMs === undefined
          ? {}
          : { leaseMs: this.outboxLeaseMs }),
      });
      const message = await outbox.claimNext(this.now(), [
        DOCUMENT_PROCESS_TOPIC,
      ]);
      if (message === undefined) return false;
      if (message.claimedAt === null) {
        throw new Error("CLAIMED_DOCUMENT_JOB_WITHOUT_LEASE");
      }
      try {
        const payload = parseDocumentPayload(message.payload);
        const context = {
          ...baseContext,
          correlationId: payload.correlationId,
        };
        await runWithTenantContext(context, () =>
          this.documents.processDocument(context, payload.documentVersionId),
        );
        await outbox.markSent(message.id, message.claimedAt);
        this.logger.info("DOCUMENT_JOB_PROCESSED", "SUCCESS", {
          documentVersionId: payload.documentVersionId,
          stateTransition: "TERMINAL",
        });
      } catch (error) {
        const permanent =
          error instanceof Error &&
          error.message === "INVALID_DOCUMENT_JOB_PAYLOAD";
        const safeErrorCode = permanent
          ? "INVALID_DOCUMENT_JOB_PAYLOAD"
          : "DOCUMENT_PROCESSING_FAILED";
        if (permanent || message.attempts >= this.maxAttempts) {
          await outbox.markFailed(message.id, message.claimedAt, safeErrorCode);
        } else {
          const exponent = Math.max(0, message.attempts - 1);
          const backoffMs = Math.min(
            this.baseBackoffMs * 2 ** exponent,
            24 * 60 * 60 * 1_000,
          );
          await outbox.requeueAfterFailure(
            message.id,
            message.claimedAt,
            safeErrorCode,
            new Date(this.now().getTime() + backoffMs),
          );
        }
        this.logger.error("DOCUMENT_JOB_FAILED", safeErrorCode, {
          jobId: message.id,
        });
      }
      return true;
    });
  }

  private waitForPoll(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, this.pollIntervalMs);
    });
  }
}

export class OfferExpiryWorker {
  private stopping = false;
  private readonly logger = new StructuredLogger("admission-worker");
  private readonly baseBackoffMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private readonly outboxLeaseMs: number | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly capacityOffers: CapacityOfferService,
    private readonly pollIntervalMs = 1_000,
    options: DocumentWorkerOptions = {},
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 50) {
      throw new TypeError("Worker polling interval must be at least 50ms");
    }
    this.baseBackoffMs =
      options.baseBackoffMs ?? DEFAULT_DOCUMENT_JOB_BASE_BACKOFF_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_DOCUMENT_JOB_MAX_ATTEMPTS;
    this.now = options.now ?? (() => new Date());
    this.outboxLeaseMs = options.outboxLeaseMs;
  }

  stop(): void {
    this.stopping = true;
  }

  async run(): Promise<void> {
    this.logger.info("OFFER_EXPIRY_WORKER_STARTED", "READY");
    while (!this.stopping) {
      const processed = await this.pollOnce();
      if (!processed && !this.stopping) await this.waitForPoll();
    }
    this.logger.info("OFFER_EXPIRY_WORKER_STOPPED", "SUCCESS");
  }

  async pollOnce(): Promise<boolean> {
    const tenantIds = await listActiveTenantIdsForTrustedWorker(this.prisma);
    for (const tenantId of tenantIds) {
      if (this.stopping) return false;
      if (await this.processTenant(tenantId)) return true;
    }
    return false;
  }

  private async processTenant(tenantId: string): Promise<boolean> {
    const baseContext: TenantExecutionContext = {
      actorId: WORKER_ACTOR_ID,
      capabilities: [],
      contextOrigin: "trusted_job",
      correlationId: `offer-expiry-worker:${tenantId}`,
      effectiveActorId: WORKER_ACTOR_ID,
      purpose: "offer.expiry",
      source: "trusted_job",
      tenantId,
    };
    return runWithTenantContext(baseContext, async () => {
      const outbox = new OutboxService(this.prisma, {
        ...(this.outboxLeaseMs === undefined
          ? {}
          : { leaseMs: this.outboxLeaseMs }),
      });
      const message = await outbox.claimNext(this.now(), [OFFER_EXPIRY_TOPIC]);
      if (message === undefined) return false;
      if (message.claimedAt === null) {
        throw new Error("CLAIMED_OFFER_EXPIRY_JOB_WITHOUT_LEASE");
      }
      try {
        const payload = parseOfferExpiryPayload(message.payload);
        const context = {
          ...baseContext,
          correlationId: payload.correlationId,
        };
        await runWithTenantContext(context, () =>
          this.capacityOffers.expireOfferVersion(
            context,
            payload.offerVersionId,
            this.now(),
          ),
        );
        await outbox.markSent(message.id, message.claimedAt);
        this.logger.info("OFFER_EXPIRY_JOB_PROCESSED", "SUCCESS", {
          offerVersionId: payload.offerVersionId,
          stateTransition: "TERMINAL_OR_NOOP",
        });
      } catch (error) {
        const permanent =
          error instanceof Error &&
          error.message === "INVALID_OFFER_EXPIRY_JOB_PAYLOAD";
        const safeErrorCode = permanent
          ? "INVALID_OFFER_EXPIRY_JOB_PAYLOAD"
          : "OFFER_EXPIRY_FAILED";
        if (permanent || message.attempts >= this.maxAttempts) {
          await outbox.markFailed(message.id, message.claimedAt, safeErrorCode);
        } else {
          const exponent = Math.max(0, message.attempts - 1);
          const backoffMs = Math.min(
            this.baseBackoffMs * 2 ** exponent,
            24 * 60 * 60 * 1_000,
          );
          await outbox.requeueAfterFailure(
            message.id,
            message.claimedAt,
            safeErrorCode,
            new Date(this.now().getTime() + backoffMs),
          );
        }
        this.logger.error("OFFER_EXPIRY_JOB_FAILED", safeErrorCode, {
          jobId: message.id,
        });
      }
      return true;
    });
  }

  private waitForPoll(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
  }
}

function parseCommunicationPayload(value: unknown): {
  communicationId: string;
  correlationId: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("communicationId" in value) ||
    !("correlationId" in value) ||
    typeof value.communicationId !== "string" ||
    typeof value.correlationId !== "string"
  ) {
    throw new Error("INVALID_COMMUNICATION_JOB_PAYLOAD");
  }
  return {
    communicationId: value.communicationId,
    correlationId: value.correlationId,
  };
}

export class CommunicationWorker {
  private stopping = false;
  private readonly logger = new StructuredLogger("admission-worker");
  private readonly baseBackoffMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private readonly outboxLeaseMs: number | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly communications: CommunicationService,
    private readonly pollIntervalMs = 1_000,
    options: DocumentWorkerOptions = {},
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 50) {
      throw new TypeError("Worker polling interval must be at least 50ms");
    }
    this.baseBackoffMs =
      options.baseBackoffMs ?? DEFAULT_DOCUMENT_JOB_BASE_BACKOFF_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_DOCUMENT_JOB_MAX_ATTEMPTS;
    this.now = options.now ?? (() => new Date());
    this.outboxLeaseMs = options.outboxLeaseMs;
  }

  stop(): void {
    this.stopping = true;
  }

  async run(): Promise<void> {
    this.logger.info("COMMUNICATION_WORKER_STARTED", "READY");
    while (!this.stopping) {
      const processed = await this.pollOnce();
      if (!processed && !this.stopping) await this.waitForPoll();
    }
    this.logger.info("COMMUNICATION_WORKER_STOPPED", "SUCCESS");
  }

  async pollOnce(): Promise<boolean> {
    const tenantIds = await listActiveTenantIdsForTrustedWorker(this.prisma);
    for (const tenantId of tenantIds) {
      if (this.stopping) return false;
      if (await this.processTenant(tenantId)) return true;
    }
    return false;
  }

  private async processTenant(tenantId: string): Promise<boolean> {
    const baseContext: TenantExecutionContext = {
      actorId: WORKER_ACTOR_ID,
      capabilities: [],
      contextOrigin: "trusted_job",
      correlationId: `communication-worker:${tenantId}`,
      effectiveActorId: WORKER_ACTOR_ID,
      purpose: "communication.send",
      source: "trusted_job",
      tenantId,
    };
    return runWithTenantContext(baseContext, async () => {
      const outbox = new OutboxService(this.prisma, {
        ...(this.outboxLeaseMs === undefined
          ? {}
          : { leaseMs: this.outboxLeaseMs }),
      });
      const message = await outbox.claimNext(this.now(), [
        COMMUNICATION_SEND_TOPIC,
      ]);
      if (message === undefined) return false;
      if (message.claimedAt === null) {
        throw new Error("CLAIMED_COMMUNICATION_JOB_WITHOUT_LEASE");
      }
      try {
        const payload = parseCommunicationPayload(message.payload);
        const context = {
          ...baseContext,
          correlationId: payload.correlationId,
        };
        await runWithTenantContext(context, () =>
          this.communications.processOutboxSend({
            communicationId: payload.communicationId,
          }),
        );
        await outbox.markSent(message.id, message.claimedAt);
        this.logger.info("COMMUNICATION_JOB_PROCESSED", "SUCCESS", {
          communicationId: payload.communicationId,
        });
      } catch (error) {
        const permanent =
          error instanceof Error &&
          error.message === "INVALID_COMMUNICATION_JOB_PAYLOAD";
        const safeErrorCode = permanent
          ? "INVALID_COMMUNICATION_JOB_PAYLOAD"
          : "COMMUNICATION_SEND_FAILED";
        if (permanent || message.attempts >= this.maxAttempts) {
          await outbox.markFailed(message.id, message.claimedAt, safeErrorCode);
        } else {
          const exponent = Math.max(0, message.attempts - 1);
          const backoffMs = Math.min(
            this.baseBackoffMs * 2 ** exponent,
            24 * 60 * 60 * 1_000,
          );
          await outbox.requeueAfterFailure(
            message.id,
            message.claimedAt,
            safeErrorCode,
            new Date(this.now().getTime() + backoffMs),
          );
        }
        this.logger.error("COMMUNICATION_JOB_FAILED", safeErrorCode, {
          error: error instanceof Error ? error.stack : String(error),
          jobId: message.id,
        });
      }
      return true;
    });
  }

  private waitForPoll(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
  }
}

function parseOfferReminderPayload(value: unknown): {
  correlationId: string;
  offerId?: string;
  offerVersionId: string;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("offerVersionId" in value) ||
    !("correlationId" in value)
  ) {
    throw new Error("INVALID_OFFER_REMINDER_JOB_PAYLOAD");
  }
  const rec = value as Record<string, unknown>;
  if (
    typeof rec.offerVersionId !== "string" ||
    typeof rec.correlationId !== "string"
  ) {
    throw new Error("INVALID_OFFER_REMINDER_JOB_PAYLOAD");
  }
  return {
    correlationId: rec.correlationId,
    offerVersionId: rec.offerVersionId,
    ...(typeof rec.offerId === "string" ? { offerId: rec.offerId } : {}),
  };
}

export class OfferReminderWorker {
  private stopping = false;
  private readonly logger = new StructuredLogger("admission-worker");
  private readonly baseBackoffMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private readonly outboxLeaseMs: number | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly communications: CommunicationService,
    private readonly pollIntervalMs = 1_000,
    options: DocumentWorkerOptions = {},
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 50) {
      throw new TypeError("Worker polling interval must be at least 50ms");
    }
    this.baseBackoffMs =
      options.baseBackoffMs ?? DEFAULT_DOCUMENT_JOB_BASE_BACKOFF_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_DOCUMENT_JOB_MAX_ATTEMPTS;
    this.now = options.now ?? (() => new Date());
    this.outboxLeaseMs = options.outboxLeaseMs;
  }

  stop(): void {
    this.stopping = true;
  }

  async run(): Promise<void> {
    this.logger.info("OFFER_REMINDER_WORKER_STARTED", "READY");
    while (!this.stopping) {
      const processed = await this.pollOnce();
      if (!processed && !this.stopping) await this.waitForPoll();
    }
    this.logger.info("OFFER_REMINDER_WORKER_STOPPED", "SUCCESS");
  }

  async pollOnce(): Promise<boolean> {
    const tenantIds = await listActiveTenantIdsForTrustedWorker(this.prisma);
    for (const tenantId of tenantIds) {
      if (this.stopping) return false;
      if (await this.processTenant(tenantId)) return true;
    }
    return false;
  }

  private async processTenant(tenantId: string): Promise<boolean> {
    const baseContext: TenantExecutionContext = {
      actorId: WORKER_ACTOR_ID,
      capabilities: [],
      contextOrigin: "trusted_job",
      correlationId: `offer-reminder-worker:${tenantId}`,
      effectiveActorId: WORKER_ACTOR_ID,
      purpose: "offer.reminder.prepare",
      source: "trusted_job",
      tenantId,
    };
    return runWithTenantContext(baseContext, async () => {
      const outbox = new OutboxService(this.prisma, {
        ...(this.outboxLeaseMs === undefined
          ? {}
          : { leaseMs: this.outboxLeaseMs }),
      });
      const message = await outbox.claimNext(this.now(), [
        OFFER_REMINDER_PREPARE_TOPIC,
      ]);
      if (message === undefined) return false;
      if (message.claimedAt === null) {
        throw new Error("CLAIMED_OFFER_REMINDER_JOB_WITHOUT_LEASE");
      }
      try {
        const payload = parseOfferReminderPayload(message.payload);
        const context = {
          ...baseContext,
          correlationId: payload.correlationId,
        };
        await runWithTenantContext(context, () =>
          this.communications.prepareOfferReminderCommunication({
            offerVersionId: payload.offerVersionId,
          }),
        );
        await outbox.markSent(message.id, message.claimedAt);
        this.logger.info("OFFER_REMINDER_JOB_PROCESSED", "SUCCESS", {
          offerVersionId: payload.offerVersionId,
          stateTransition: "PREPARED_OR_SUPPRESSED",
        });
      } catch (error) {
        const permanent =
          error instanceof Error &&
          error.message === "INVALID_OFFER_REMINDER_JOB_PAYLOAD";
        const safeErrorCode = permanent
          ? "INVALID_OFFER_REMINDER_JOB_PAYLOAD"
          : "OFFER_REMINDER_PREPARATION_FAILED";
        if (permanent || message.attempts >= this.maxAttempts) {
          await outbox.markFailed(message.id, message.claimedAt, safeErrorCode);
        } else {
          const exponent = Math.max(0, message.attempts - 1);
          const backoffMs = Math.min(
            this.baseBackoffMs * 2 ** exponent,
            24 * 60 * 60 * 1_000,
          );
          await outbox.requeueAfterFailure(
            message.id,
            message.claimedAt,
            safeErrorCode,
            new Date(this.now().getTime() + backoffMs),
          );
        }
        this.logger.error("OFFER_REMINDER_JOB_FAILED", safeErrorCode, {
          jobId: message.id,
        });
      }
      return true;
    });
  }

  private waitForPoll(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
  }
}
