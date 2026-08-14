import { FunctionalHandoffService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiFunctionalHandoffService extends FunctionalHandoffService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
