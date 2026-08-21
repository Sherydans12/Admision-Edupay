import { SensitiveProcessingService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiSensitiveProcessingService extends SensitiveProcessingService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
