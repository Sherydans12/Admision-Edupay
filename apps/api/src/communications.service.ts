import { CommunicationService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiCommunicationsService extends CommunicationService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
