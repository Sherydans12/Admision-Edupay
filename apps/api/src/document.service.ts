import {
  DevelopmentBusinessCalendar,
  DocumentService as DatabaseDocumentService,
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
    super(
      prisma,
      new LocalDevelopmentObjectStorage({
        environment,
        root: resolve(
          process.env.DOCUMENT_STORAGE_LOCAL_ROOT ?? ".local/document-storage",
        ),
      }),
      new SyntheticDevelopmentMalwareScanner(environment),
      Number(process.env.DOCUMENT_UPLOAD_HARD_MAX_BYTES ?? 10 * 1024 * 1024),
      new DevelopmentBusinessCalendar(),
    );
  }
}
