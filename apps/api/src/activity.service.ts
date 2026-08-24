import {
  ActivityService as DatabaseActivityService,
  PrismaClient,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiActivityService extends DatabaseActivityService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
