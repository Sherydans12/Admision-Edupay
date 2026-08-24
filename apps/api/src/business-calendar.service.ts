import { BusinessCalendarService, PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiBusinessCalendarService extends BusinessCalendarService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
