import { Module } from "@nestjs/common";

import {
  createAppPrismaClient,
  NoopAuditSink,
  NoopSecurityEventSink,
  PrismaClient,
  SessionService,
} from "@admission/database";

import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { IntakeController } from "./intake.controller.js";
import { ApiIntakeService } from "./intake.service.js";
import { RequestContextService } from "./request-context.service.js";

const prismaProvider = {
  provide: PrismaClient,
  useFactory: () => createAppPrismaClient(),
};

const sessionProvider = {
  provide: SessionService,
  useFactory: (prisma: PrismaClient) =>
    new SessionService(prisma, {
      auditSink: new NoopAuditSink(),
      securityEvents: new NoopSecurityEventSink(),
    }),
  inject: [PrismaClient],
};

@Module({
  controllers: [HealthController, IntakeController],
  providers: [
    prismaProvider,
    sessionProvider,
    ApiIntakeService,
    HealthService,
    RequestContextService,
  ],
})
export class AppModule {}
