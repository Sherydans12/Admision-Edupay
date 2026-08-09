import {
  IntakeService as DatabaseIntakeService,
  PrismaClient,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiIntakeService extends DatabaseIntakeService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
