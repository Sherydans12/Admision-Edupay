import {
  CapacityOfferService,
  CommunicationService,
  createEmailSuppressionHashOptionsListFromEnv,
  createProductionEmailAdapterFromEnv,
  createProductionMalwareScannerFromEnv,
  createProductionObjectStorageFromEnv,
  DevelopmentEmailAdapter,
  createAppPrismaClient,
  DevelopmentBusinessCalendar,
  DocumentService,
  LocalDevelopmentObjectStorage,
  SyntheticDevelopmentMalwareScanner,
} from "@admission/database";
import { resolve } from "node:path";
import { rm, writeFile } from "node:fs/promises";

import { markWorkerReady } from "./worker-health.js";
import {
  CommunicationWorker,
  DocumentWorker,
  getWorkerDescriptor,
  OfferExpiryWorker,
  OfferReminderWorker,
} from "./worker.js";

const environment = process.env.NODE_ENV ?? "development";
const storageRoot = resolve(
  process.env.DOCUMENT_STORAGE_LOCAL_ROOT ?? ".local/document-storage",
);
const hardMax = Number(
  process.env.DOCUMENT_UPLOAD_HARD_MAX_BYTES ?? 10 * 1024 * 1024,
);
const pollMs = Number(process.env.DOCUMENT_WORKER_POLL_MS ?? 1_000);
const outboxLeaseMs = Number(process.env.OUTBOX_LEASE_MS ?? 60_000);
const maxAttempts = Number(process.env.DOCUMENT_JOB_MAX_ATTEMPTS ?? 5);
const baseBackoffMs = Number(process.env.DOCUMENT_JOB_BASE_BACKOFF_MS ?? 1_000);
const prisma = createAppPrismaClient();
const storage =
  environment === "production"
    ? createProductionObjectStorageFromEnv()
    : new LocalDevelopmentObjectStorage({ environment, root: storageRoot });
const scanner =
  environment === "production"
    ? createProductionMalwareScannerFromEnv()
    : new SyntheticDevelopmentMalwareScanner(environment);
const documents = new DocumentService(
  prisma,
  storage,
  scanner,
  hardMax,
  new DevelopmentBusinessCalendar(),
);
const communications = new CommunicationService(
  prisma,
  environment === "production"
    ? createProductionEmailAdapterFromEnv()
    : new DevelopmentEmailAdapter(),
  environment === "production"
    ? { suppressionHashes: createEmailSuppressionHashOptionsListFromEnv() }
    : {},
);
const worker = new DocumentWorker(prisma, documents, pollMs, {
  baseBackoffMs,
  maxAttempts,
  outboxLeaseMs,
});
const offerExpiryWorker = new OfferExpiryWorker(
  prisma,
  new CapacityOfferService(prisma, new DevelopmentBusinessCalendar()),
  pollMs,
  { baseBackoffMs, maxAttempts, outboxLeaseMs },
);
const offerReminderWorker = new OfferReminderWorker(
  prisma,
  communications,
  pollMs,
  { baseBackoffMs, maxAttempts, outboxLeaseMs },
);
const communicationWorker = new CommunicationWorker(
  prisma,
  communications,
  pollMs,
  { baseBackoffMs, maxAttempts, outboxLeaseMs },
);

const healthFile =
  process.env.WORKER_HEALTH_FILE ?? "/tmp/admission-worker-ready";
let heartbeat: ReturnType<typeof setInterval> | undefined;

async function bootstrap(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  await storage.exists("approved", "00000000-0000-4000-8000-000000000021");
  const scan = await scanner.scan(
    new TextEncoder().encode("SYNTHETIC_WORKER_HEALTH_PROBE"),
  );
  if (scan.status !== "CLEAN") {
    throw new Error("WORKER_MALWARE_SCANNER_NOT_READY");
  }
  await writeFile(healthFile, new Date().toISOString(), "utf8");
  heartbeat = setInterval(() => {
    void writeFile(healthFile, new Date().toISOString(), "utf8").catch(() => {
      // A stale heartbeat makes the container unhealthy without logging paths or secrets.
    });
  }, 15_000);
  heartbeat.unref();

  markWorkerReady();
  console.info(JSON.stringify(getWorkerDescriptor()));

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      worker.stop();
      offerExpiryWorker.stop();
      offerReminderWorker.stop();
      communicationWorker.stop();
    });
  }

  const activeWorkers = [
    worker,
    offerExpiryWorker,
    offerReminderWorker,
    communicationWorker,
  ] as const;
  const loops = [
    worker.run(),
    offerExpiryWorker.run(),
    offerReminderWorker.run(),
    communicationWorker.run(),
  ];
  try {
    await Promise.all(loops);
  } catch (error) {
    for (const activeWorker of activeWorkers) activeWorker.stop();
    await Promise.allSettled(loops);
    throw error;
  }
}

void bootstrap()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        code: "WORKER_FATAL_ERROR",
        message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    await rm(healthFile, { force: true }).catch(() => undefined);
    await prisma.$disconnect();
  });
