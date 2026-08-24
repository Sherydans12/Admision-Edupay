import {
  ActivityPolicyService as DatabaseActivityPolicyService,
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

@Injectable()
export class ApiActivityPolicyService extends DatabaseActivityPolicyService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
