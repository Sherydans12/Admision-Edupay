import {
  DevelopmentBusinessCalendar,
  DocumentService as DatabaseDocumentService,
  createProductionMalwareScannerFromEnv,
  createProductionObjectStorageFromEnv,
  LocalDevelopmentObjectStorage,
  PrismaClient,
  SyntheticDevelopmentMalwareScanner,
} from "@admission/database";
import { Injectable } from "@nestjs/common";
import { resolve } from "node:path";

@Injectable()
export class ApiDocumentService extends DatabaseDocumentService {
  constructor(prisma: PrismaClient) {
    const environment = process.env.NODE_ENV ?? "development";
    const storage =
      environment === "production"
        ? createProductionObjectStorageFromEnv()
        : new LocalDevelopmentObjectStorage({
            environment,
            root: resolve(
              process.env.DOCUMENT_STORAGE_LOCAL_ROOT ??
                ".local/document-storage",
            ),
          });
    const scanner =
      environment === "production"
        ? createProductionMalwareScannerFromEnv()
        : new SyntheticDevelopmentMalwareScanner(environment);
    super(
      prisma,
      storage,
      scanner,
      Number(process.env.DOCUMENT_UPLOAD_HARD_MAX_BYTES ?? 10 * 1024 * 1024),
      new DevelopmentBusinessCalendar(),
    );
  }
}
