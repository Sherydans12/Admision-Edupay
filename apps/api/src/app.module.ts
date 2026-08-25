import { Module } from "@nestjs/common";

import {
  createAppPrismaClient,
  createProductionEmailAdapterFromEnv,
  AccountRegistrationService,
  DevelopmentIdentityEmailAdapter,
  NoopSecurityEventSink,
  PrismaAuditSink,
  PrismaClient,
  SessionService,
  StructuredSecurityEventSink,
  SupportElevationService,
  type IdentityEmailAdapter,
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
import { DocumentsFeatureGuard } from "./document-feature.guard.js";
import { ApiAssistanceService } from "./assistance.service.js";
import { ActivityController } from "./activity.controller.js";
import {
  ApiActivityPolicyService,
  ApiActivityService,
} from "./activity.service.js";
import { RecommendationController } from "./recommendation.controller.js";
import { ApiRecommendationService } from "./recommendation.service.js";
import { CapacityOfferController } from "./capacity-offer.controller.js";
import { ApiCapacityOfferService } from "./capacity-offer.service.js";
import { FunctionalHandoffController } from "./functional-handoff.controller.js";
import { ApiFunctionalHandoffService } from "./functional-handoff.service.js";
import { ApplicationAuthorityController } from "./application-authority.controller.js";
import { ApiApplicationAuthorityService } from "./application-authority.service.js";
import { CommunicationsController } from "./communications.controller.js";
import { ApiCommunicationsService } from "./communications.service.js";
import { FamilyPortalController } from "./family-portal.controller.js";
import { ApiFamilyPortalService } from "./family-portal.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { ApiOperationalDashboardService } from "./dashboard.service.js";
import { ReportingAdminController } from "./reporting-admin.controller.js";
import { IdentityController } from "./identity.controller.js";
import { SensitiveProcessingController } from "./sensitive-processing.controller.js";
import { ApiSensitiveProcessingService } from "./sensitive-processing.service.js";
import { BusinessCalendarController } from "./business-calendar.controller.js";
import { ApiBusinessCalendarService } from "./business-calendar.service.js";
import {
  ApiAuditReadService,
  ApiReportingService,
  ApiRoleAssignmentAdminService,
} from "./reporting-admin.service.js";
import { ResendWebhookController } from "./resend-webhook.controller.js";
import { ResendWebhookService } from "./resend-webhook.service.js";

const prismaProvider = {
  provide: PrismaClient,
  useFactory: () => createAppPrismaClient(),
};

const sessionProvider = {
  provide: SessionService,
  useFactory: (prisma: PrismaClient, auditSink: PrismaAuditSink) =>
    new SessionService(prisma, {
      auditSink,
      securityEvents:
        process.env.NODE_ENV === "production"
          ? new StructuredSecurityEventSink()
          : new NoopSecurityEventSink(),
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
    new SupportElevationService(
      prisma,
      auditSink,
      process.env.NODE_ENV === "production"
        ? new StructuredSecurityEventSink()
        : new NoopSecurityEventSink(),
    ),
  inject: [PrismaClient, PrismaAuditSink],
};

const identityEmailAdapterProvider = {
  provide: DevelopmentIdentityEmailAdapter,
  useFactory: (): IdentityEmailAdapter =>
    process.env.NODE_ENV === "production"
      ? createProductionEmailAdapterFromEnv()
      : new DevelopmentIdentityEmailAdapter(),
};

const accountRegistrationProvider = {
  provide: AccountRegistrationService,
  useFactory: (
    prisma: PrismaClient,
    sessions: SessionService,
    emailAdapter: IdentityEmailAdapter,
    auditSink: PrismaAuditSink,
  ) =>
    new AccountRegistrationService(
      prisma,
      sessions,
      emailAdapter,
      auditSink,
      process.env.NODE_ENV === "production"
        ? new StructuredSecurityEventSink()
        : new NoopSecurityEventSink(),
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
    ApplicationAuthorityController,
    CommunicationsController,
    FamilyPortalController,
    DashboardController,
    ReportingAdminController,
    SensitiveProcessingController,
    BusinessCalendarController,
    ResendWebhookController,
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
    DocumentsFeatureGuard,
    ApiAssistanceService,
    ApiActivityService,
    ApiActivityPolicyService,
    ApiRecommendationService,
    ApiCapacityOfferService,
    ApiFunctionalHandoffService,
    ApiApplicationAuthorityService,
    ApiCommunicationsService,
    ApiFamilyPortalService,
    ApiOperationalDashboardService,
    ApiReportingService,
    ApiRoleAssignmentAdminService,
    ApiAuditReadService,
    ApiSensitiveProcessingService,
    ApiBusinessCalendarService,
    HealthService,
    RequestContextService,
    ResendWebhookService,
  ],
})
export class AppModule {}
