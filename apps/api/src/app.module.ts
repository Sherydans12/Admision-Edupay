import { Module } from "@nestjs/common";

import {
  createAppPrismaClient,
  AccountRegistrationService,
  DevelopmentIdentityEmailAdapter,
  NoopSecurityEventSink,
  PrismaAuditSink,
  PrismaClient,
  SessionService,
  SupportElevationService,
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
import { FunctionalHandoffController } from "./functional-handoff.controller.js";
import { ApiFunctionalHandoffService } from "./functional-handoff.service.js";
import { CommunicationsController } from "./communications.controller.js";
import { ApiCommunicationsService } from "./communications.service.js";
import { FamilyPortalController } from "./family-portal.controller.js";
import { ApiFamilyPortalService } from "./family-portal.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { ApiOperationalDashboardService } from "./dashboard.service.js";
import { ReportingAdminController } from "./reporting-admin.controller.js";
import { IdentityController } from "./identity.controller.js";
import {
  ApiAuditReadService,
  ApiReportingService,
  ApiRoleAssignmentAdminService,
} from "./reporting-admin.service.js";

const prismaProvider = {
  provide: PrismaClient,
  useFactory: () => createAppPrismaClient(),
};

const sessionProvider = {
  provide: SessionService,
  useFactory: (prisma: PrismaClient, auditSink: PrismaAuditSink) =>
    new SessionService(prisma, {
      auditSink,
      securityEvents: new NoopSecurityEventSink(),
    }),
  inject: [PrismaClient, PrismaAuditSink],
};

const auditSinkProvider = {
  provide: PrismaAuditSink,
  useFactory: (prisma: PrismaClient) => new PrismaAuditSink(prisma),
  inject: [PrismaClient],
};

const supportElevationProvider = {
  provide: SupportElevationService,
  useFactory: (prisma: PrismaClient, auditSink: PrismaAuditSink) =>
    new SupportElevationService(prisma, auditSink, new NoopSecurityEventSink()),
  inject: [PrismaClient, PrismaAuditSink],
};

const identityEmailAdapterProvider = {
  provide: DevelopmentIdentityEmailAdapter,
  useFactory: () => new DevelopmentIdentityEmailAdapter(),
};

const accountRegistrationProvider = {
  provide: AccountRegistrationService,
  useFactory: (
    prisma: PrismaClient,
    sessions: SessionService,
    emailAdapter: DevelopmentIdentityEmailAdapter,
    auditSink: PrismaAuditSink,
  ) =>
    new AccountRegistrationService(
      prisma,
      sessions,
      emailAdapter,
      auditSink,
      new NoopSecurityEventSink(),
    ),
  inject: [
    PrismaClient,
    SessionService,
    DevelopmentIdentityEmailAdapter,
    PrismaAuditSink,
  ],
};

@Module({
  controllers: [
    HealthController,
    IdentityController,
    IntakeController,
    FormController,
    DocumentController,
    ActivityController,
    RecommendationController,
    CapacityOfferController,
    FunctionalHandoffController,
    CommunicationsController,
    FamilyPortalController,
    DashboardController,
    ReportingAdminController,
  ],
  providers: [
    prismaProvider,
    auditSinkProvider,
    sessionProvider,
    supportElevationProvider,
    identityEmailAdapterProvider,
    accountRegistrationProvider,
    ApiIntakeService,
    ApiFormService,
    ApiDocumentService,
    ApiAssistanceService,
    ApiActivityService,
    ApiRecommendationService,
    ApiCapacityOfferService,
    ApiFunctionalHandoffService,
    ApiCommunicationsService,
    ApiFamilyPortalService,
    ApiOperationalDashboardService,
    ApiReportingService,
    ApiRoleAssignmentAdminService,
    ApiAuditReadService,
    HealthService,
    RequestContextService,
  ],
})
export class AppModule {}
