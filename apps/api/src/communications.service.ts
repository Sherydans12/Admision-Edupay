import {
  CommunicationService,
  createEmailSuppressionHashOptionsListFromEnv,
  createProductionEmailAdapterFromEnv,
  DevelopmentEmailAdapter,
  PrismaClient,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiCommunicationsService extends CommunicationService {
  constructor(prisma: PrismaClient) {
    super(
      prisma,
      process.env.NODE_ENV === "production"
        ? createProductionEmailAdapterFromEnv()
        : new DevelopmentEmailAdapter(),
      process.env.NODE_ENV === "production"
        ? { suppressionHashes: createEmailSuppressionHashOptionsListFromEnv() }
        : {},
    );
  }
}
