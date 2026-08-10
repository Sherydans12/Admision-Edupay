import {
  DOCUMENT_PROCESS_TOPIC,
  DocumentService,
  listActiveTenantIdsForTrustedWorker,
  OutboxService,
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

  constructor(
    private readonly prisma: PrismaClient,
    private readonly documents: DocumentService,
    private readonly pollIntervalMs = 1_000,
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 50) {
      throw new TypeError("Worker polling interval must be at least 50ms");
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
      const outbox = new OutboxService(this.prisma);
      const message = await outbox.claimNext(new Date(), [
        DOCUMENT_PROCESS_TOPIC,
      ]);
      if (message === undefined) return false;
      try {
        const payload = parseDocumentPayload(message.payload);
        const context = {
          ...baseContext,
          correlationId: payload.correlationId,
        };
        await runWithTenantContext(context, () =>
          this.documents.processDocument(context, payload.documentVersionId),
        );
        await outbox.markSent(message.id);
        this.logger.info("DOCUMENT_JOB_PROCESSED", "SUCCESS", {
          documentVersionId: payload.documentVersionId,
          stateTransition: "TERMINAL",
        });
      } catch (error) {
        const safeErrorCode =
          error instanceof Error &&
          error.message === "INVALID_DOCUMENT_JOB_PAYLOAD"
            ? "INVALID_DOCUMENT_JOB_PAYLOAD"
            : "DOCUMENT_PROCESSING_FAILED";
        await outbox.markFailed(message.id, safeErrorCode);
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
