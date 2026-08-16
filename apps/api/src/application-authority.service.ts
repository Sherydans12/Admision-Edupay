import { ApplicationAuthorityService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiApplicationAuthorityService extends ApplicationAuthorityService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
