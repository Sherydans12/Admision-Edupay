import {
  FamilyApplicationProjectionService,
  PrismaClient,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiFamilyPortalService extends FamilyApplicationProjectionService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
