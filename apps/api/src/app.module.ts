import { Module } from "@nestjs/common";

import {
  createAppPrismaClient,
  NoopAuditSink,
  NoopSecurityEventSink,
  PrismaClient,
  SessionService,
} from "@admission/database";

import { HealthController } from "./health.controller.js";
import { FormController } from "./form.controller.js";
import { ApiFormService } from "./form.service.js";
import { HealthService } from "./health.service.js";
import { IntakeController } from "./intake.controller.js";
import { ApiIntakeService } from "./intake.service.js";
import { RequestContextService } from "./request-context.service.js";
import { DocumentController } from "./document.controller.js";
import { ApiDocumentService } from "./document.service.js";
import { ApiAssistanceService } from "./assistance.service.js";
import { ActivityController } from "./activity.controller.js";
import { ApiActivityService } from "./activity.service.js";
import { RecommendationController } from "./recommendation.controller.js";
import { ApiRecommendationService } from "./recommendation.service.js";
import { CapacityOfferController } from "./capacity-offer.controller.js";
import { ApiCapacityOfferService } from "./capacity-offer.service.js";
import { CommunicationsController } from "./communications.controller.js";
import { ApiCommunicationsService } from "./communications.service.js";
import { FamilyPortalController } from "./family-portal.controller.js";
import { ApiFamilyPortalService } from "./family-portal.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { ApiOperationalDashboardService } from "./dashboard.service.js";

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
  controllers: [
    HealthController,
    IntakeController,
    FormController,
    DocumentController,
    ActivityController,
    RecommendationController,
    CapacityOfferController,
    CommunicationsController,
    FamilyPortalController,
    DashboardController,
  ],
  providers: [
    prismaProvider,
    sessionProvider,
    ApiIntakeService,
    ApiFormService,
    ApiDocumentService,
    ApiAssistanceService,
    ApiActivityService,
    ApiRecommendationService,
    ApiCapacityOfferService,
    ApiCommunicationsService,
    ApiFamilyPortalService,
    ApiOperationalDashboardService,
    HealthService,
    RequestContextService,
  ],
})
export class AppModule {}
