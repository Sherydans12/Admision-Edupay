import {
  createAppPrismaClient,
  DevelopmentBusinessCalendar,
  DocumentService,
  LocalDevelopmentObjectStorage,
  SyntheticDevelopmentMalwareScanner,
} from "@admission/database";
import { resolve } from "node:path";

import { markWorkerReady } from "./worker-health.js";
import { DocumentWorker, getWorkerDescriptor } from "./worker.js";

const environment = process.env.NODE_ENV ?? "development";
const storageRoot = resolve(
  process.env.DOCUMENT_STORAGE_LOCAL_ROOT ?? ".local/document-storage",
);
const hardMax = Number(
  process.env.DOCUMENT_UPLOAD_HARD_MAX_BYTES ?? 10 * 1024 * 1024,
);
const pollMs = Number(process.env.DOCUMENT_WORKER_POLL_MS ?? 1_000);
const prisma = createAppPrismaClient();
const documents = new DocumentService(
  prisma,
  new LocalDevelopmentObjectStorage({ environment, root: storageRoot }),
  new SyntheticDevelopmentMalwareScanner(environment),
  hardMax,
  new DevelopmentBusinessCalendar(),
);
const worker = new DocumentWorker(prisma, documents, pollMs);

markWorkerReady();
console.info(JSON.stringify(getWorkerDescriptor()));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => worker.stop());
}

void worker.run().finally(async () => {
  await prisma.$disconnect();
});
