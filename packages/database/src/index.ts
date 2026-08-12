export { createAppPrismaClient } from "./prisma-client.js";
export {
  ACTIVITY_KINDS,
  ACTIVITY_STATUSES,
  ActivityService,
  pinApplicationActivities,
  type ActivityDefinitionDto,
  type ActivityDefinitionInput,
  type ActivityKind,
  type ActivityResultValue,
  type ActivityVersionDto,
  type ActivityVersionInput,
  type FamilyActivityDto,
  type RecordOutcomeInput,
  type RepeatActivityInput,
  type StaffActivityDto,
  type StaffScheduleInput,
} from "./activities.js";
export {
  AVAILABILITY_LABELS,
  IntakeConflictError,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeService,
  IntakeValidationError,
  type AcademicYearDto,
  type AcademicYearInput,
  type AdmissionOfferingInput,
  type AdmissionProcessInput,
  type ApplicationDto,
  type AvailabilityCategory,
  type IntakeConflictCode,
  type CampusDto,
  type CampusInput,
  type ConfigurationDto,
  type CourseLevelDto,
  type CourseLevelInput,
  type DraftData,
  type DraftPatch,
  type OfferingDto,
  type ProcessDto,
  type StudentDto,
  type StudentInput,
} from "./intake.js";
export {
  ActivityConflictError,
  CapacityOfferConflictError,
  CapacityOfferValidationError,
  RecommendationConflictError,
  RecommendationValidationError,
  type CapacityOfferConflictCode,
  type RecommendationConflictCode,
} from "./domain-errors.js";
export {
  CapacityOfferService,
  DEFAULT_OFFER_VALIDITY_BUSINESS_DAYS,
  OFFER_EXPIRY_TOPIC,
  applyDirectionDispositionEffects,
  type CapacityAdjustmentInput,
  type CapacityDto,
  type CapacityInput,
  type FamilyAdmissionProjectionDto,
  type OfferDto,
  type OfferVersionCommandInput,
  type OfferVersionDto,
  type PromoteWaitlistInput,
  type ReopenOfferInput,
  type WaitlistEntryDto,
} from "./capacity-offer.js";
export {
  DIRECTION_DISPOSITIONS,
  RECOMMENDATION_OPTIONS,
  RecommendationService,
  type DirectionDecisionInput,
  type DirectionDecisionVersionDto,
  type DirectionDisposition,
  type RecommendationDraftInput,
  type RecommendationOption,
  type RecommendationVersionDto,
  type RecommendationWorkspaceDto,
} from "./recommendation.js";
export { PrismaClient } from "./generated/prisma/client.js";
export {
  FORM_CONDITION_OPERATORS,
  FORM_FIELD_TYPES,
  FormService,
  type AnswerValue,
  type FamilyFormDto,
  type FormConditionInput,
  type FormConditionOperator,
  type FormFieldDto,
  type FormFieldInput,
  type FormFieldType,
  type FormLifecycle,
  type FormOptionInput,
  type FormSectionDto,
  type FormSectionInput,
  type FormVersionDto,
  type ReviewDto,
} from "./forms.js";
export {
  getCorrelationId,
  resolveCorrelationId,
  runWithCorrelationContext,
} from "./correlation-context.js";
export {
  authorize,
  authorizeOrThrow,
  ForbiddenError,
  type AuthorizationDecision,
  type AuthorizationRequirement,
} from "./authorization.js";
export {
  InMemoryAuditSink,
  NoopAuditSink,
  type AuditEvent,
  type AuditSink,
} from "./audit.js";
export { sanitizeAuditMetadata } from "./audit-metadata.js";
export { PrismaAuditSink } from "./prisma-audit-sink.js";
export {
  buildSessionCookieOptions,
  createOpaqueSessionCookie,
} from "./session-cookie.js";
export { InMemoryCsrfService } from "./csrf.js";
export {
  DEFAULT_OUTBOX_LEASE_MS,
  OutboxService,
  type EnqueueOutboxInput,
  type OutboxConfig,
} from "./outbox.js";
export { listActiveTenantIdsForTrustedWorker } from "./outbox.js";
export {
  DEFAULT_DOCUMENT_UPLOAD_HARD_MAX_BYTES,
  DevelopmentBusinessCalendar,
  DOCUMENT_FILE_TYPES,
  DOCUMENT_MIME_BY_TYPE,
  DOCUMENT_PROCESS_TOPIC,
  DocumentService,
  evaluateDocumentSubmissionReadiness,
  pinDocumentRequirements,
  type BusinessCalendar,
  type DocumentFileType,
  type DocumentRequirementVersionInput,
  type EquivalentOptionInput,
  type UploadDocumentInput,
} from "./documents.js";
export { AssistanceService } from "./assistance.js";
export {
  assertOpaqueObjectKey,
  createOpaqueObjectKey,
  InMemoryObjectStorage,
  LocalDevelopmentObjectStorage,
  NoopEmailSender,
  NoopMalwareScanner,
  SyntheticDevelopmentMalwareScanner,
  type MalwareScanner,
  type MalwareScanResult,
  type MalwareScanStatus,
  type ObjectStorage,
  type ObjectStorageArea,
} from "./operational-adapters.js";
export {
  PERMISSIONS,
  SENSITIVITIES,
  type PermissionKey,
  type Sensitivity,
} from "./permission-catalog.js";
export { getSessionConfig, type SessionConfig } from "./session-config.js";
export {
  SessionService,
  type IssuedSession,
  type ResolvedSession,
} from "./session-service.js";
export {
  InMemorySecurityEventSink,
  NoopSecurityEventSink,
  type SecurityEvent,
  type SecurityEventSink,
} from "./security-events.js";
export {
  SupportElevationService,
  getElevationContext,
  type CloseSupportElevationInput,
  type ResolveActiveSupportElevationInput,
  type StartSupportElevationInput,
} from "./support-elevation.js";
export {
  StructuredLogger,
  sanitizeLogValue,
  type StructuredLogEvent,
} from "./structured-logger.js";
export {
  resolveEffectiveTenantContext,
  type TenantResolutionInput,
  type TenantResolutionResult,
} from "./tenant-resolution.js";
export {
  assertTenantContext,
  FamilyContextMissingError,
  getRequiredTenantContext,
  getTenantContext,
  getRequiredFamilyContext,
  PlatformContextTenantError,
  runWithFamilyContext,
  runWithTenantContext,
  TenantContextMissingError,
  type FamilyExecutionContext,
  type PlatformExecutionContext,
  type FamilyContextOrigin,
  type TenantContextOrigin,
  type VerifiedSupportElevation,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
export {
  withTenantCandidateTransaction,
  withPlatformAuditTransaction,
  withTenantTransaction,
} from "./tenant-transaction.js";
export {
  DevelopmentEmailAdapter,
  type EmailAdapter,
  type SendEmailInput,
  type SendEmailResult,
} from "./email-adapter.js";
export {
  COMMUNICATION_SEND_TOPIC,
  CommunicationService,
  type ConfirmCommunicationInput,
  type PrepareActivityAppointmentInput,
  type PrepareDecisionCommunicationInput,
  type PrepareDocumentCorrectionInput,
  type PrepareOfferCommunicationInput,
  type PrepareOfferReminderInput,
  type ProcessOutboxSendInput,
  type RecordDeliveryEvidenceInput,
  type RecordManualContactInput,
  type RetryCommunicationInput,
} from "./communications.js";
export {
  FamilyApplicationProjectionService,
  type FamilyActivityProjection,
  type FamilyApplicationProjection,
  type FamilyDocumentProjection,
  type FamilyHistoryEventProjection,
  type FamilyOfferProjection,
} from "./family-projection.js";
export {
  OperationalDashboardService,
  type OperationalDashboardMetrics,
} from "./dashboard.js";
export {
  REPORT_CATALOG,
  REPORT_KEYS,
  ReportingService,
  ReportExportLimitExceededError,
  ReportValidationError,
  neutralizeCsvFormula,
  serializeCsv,
  type GeneratedReportCsv,
  type ReportColumnDefinition,
  type ReportDefinition,
  type ReportFilterKey,
  type ReportFilters,
  type ReportKey,
} from "./reporting.js";
export {
  AccessAdminValidationError,
  AuditReadService,
  RoleAssignmentAdminService,
  RoleAssignmentChangedError,
  validateRoleAssignmentScopes,
  type AuditReadFilters,
  type MembershipAccessDto,
  type RoleAssignmentDto,
} from "./access-admin.js";
