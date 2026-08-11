import { OperationalDashboardService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiOperationalDashboardService extends OperationalDashboardService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
