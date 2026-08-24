import { CapacityOfferService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiCapacityOfferService extends CapacityOfferService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
