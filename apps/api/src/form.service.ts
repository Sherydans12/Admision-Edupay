import {
  FormService as DatabaseFormService,
  PrismaClient,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiFormService extends DatabaseFormService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
