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
  ACTIVITY_POLICY_BASELINES,
  ActivityPolicyService,
  assertExecutorCanPerform,
  assertReadyActivityPolicy,
  proposedActivityPolicyBaseline,
  resolveActivityDuration,
  type ActivityDurationSourceValue,
  type ActivityPolicyDto,
  type ActivityPolicyKind,
  type ActivityPolicyMutationDto,
  type EligibleActivityExecutorDto,
  type UpsertActivityPolicyInput,
} from "./activity-policy.js";
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
  type OfferingCapacityState,
  type OfferingLifecycleCommandInput,
  type OfferingReadinessDto,
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
  ActivityPolicyConflictError,
  ApplicationAuthorityConflictError,
  ApplicationAuthorityValidationError,
  BusinessCalendarConflictError,
  BusinessCalendarNotConfiguredError,
  BusinessCalendarValidationError,
  CapacityOfferConflictError,
  CapacityOfferValidationError,
  FunctionalHandoffConflictError,
  InvalidBusinessTimezoneError,
  RecommendationConflictError,
  RecommendationValidationError,
  type BusinessCalendarConflictCode,
  type ActivityPolicyConflictCode,
  type CapacityOfferConflictCode,
  type ApplicationAuthorityConflictCode,
  type FunctionalHandoffConflictCode,
  type RecommendationConflictCode,
} from "./domain-errors.js";
export {
  APPLICATION_AUTHORITY_BASES,
  APPLICATION_AUTHORITY_RELATIONSHIPS,
  APPLICATION_AUTHORITY_STATUSES,
  APPLICATION_AUTHORITY_SUBJECT_MODES,
  ApplicationAuthorityService,
  assertApplicationAuthorityForCriticalAction,
  isAdultStudent,
  type ApplicationAuthorityBasis,
  type ApplicationAuthorityDeclarationInput,
  type ApplicationAuthorityDto,
  type ApplicationAuthorityRelationship,
  type ApplicationAuthorityReviewInput,
  type ApplicationAuthorityStaffDto,
  type ApplicationAuthorityStatus,
  type ApplicationAuthoritySubjectMode,
} from "./application-authority.js";
export {
  CapacityOfferService,
  DEFAULT_OFFER_VALIDITY_BUSINESS_DAYS,
  OFFER_EXPIRY_TOPIC,
  OFFER_REMINDER_PREPARE_TOPIC,
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
  FunctionalHandoffService,
  type FunctionalHandoffDto,
} from "./functional-handoff.js";
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
export {
  CommunicationWebhookEventType,
  PrismaClient,
} from "./generated/prisma/client.js";
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
export {
  InMemoryCsrfService,
  StatelessCsrfService,
  type CsrfService,
  type CsrfValidationInput,
} from "./csrf.js";
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
export { isDocumentsFeatureEnabled } from "./feature-flags.js";
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
  PROCESSING_CATEGORIES,
  DOCUMENT_CLASSIFICATIONS,
  SENSITIVE_PROCESSING_CATEGORIES,
  RESTRICTED_DOCUMENT_CLASSIFICATIONS,
  SENSITIVITIES,
  type PermissionKey,
  type ProcessingCategoryValue,
  type DocumentClassificationValue,
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
  StructuredSecurityEventSink,
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
  OPERATIONAL_SIGNAL_CONTRACT,
  createOperationalSignalCandidate,
  type OperationalSignalCandidate,
  type OperationalSignalDefinition,
  type OperationalSignalId,
} from "./operational-signals.js";
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
  AccountRegistrationService,
  AccountRegistrationValidationError,
  AccountVerificationError,
  createTestAccountRegistrationService,
  hashNormalizedChannel,
  type AccountRegistrationInput,
  type AccountRegistrationPrismaInput,
  type AccountRegistrationServiceOptions,
  type AccountVerificationInput,
  type VerifiedAccountResult,
} from "./account-registration.js";
export {
  DevelopmentIdentityEmailAdapter,
  type IdentityEmailAdapter,
  type IdentityVerificationEmailDelivery,
  type IdentityVerificationEmailInput,
} from "./identity-email-adapter.js";
export {
  ClamAvScanner,
  ResendEmailAdapter,
  S3ObjectStorage,
  createProductionEmailAdapterFromEnv,
  createProductionMalwareScannerFromEnv,
  createProductionObjectStorageFromEnv,
  type ClamAvScannerOptions,
  type EmailDeliveryMode,
  type ResendEmailAdapterOptions,
  type S3ObjectStorageOptions,
} from "./production-adapters.js";
export {
  COMMUNICATION_SEND_TOPIC,
  CommunicationService,
  type ConfirmCommunicationInput,
  type CommunicationServiceOptions,
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
  EmailDeliveryEventService,
  createEmailSuppressionHashOptionsFromEnv,
  createEmailSuppressionHashOptionsListFromEnv,
  hashSuppressedEmail,
  type EmailSuppressionHashOptions,
  type VerifiedEmailWebhookEvent,
} from "./email-delivery.js";
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
export {
  SensitiveProcessingService,
  SensitiveProcessingValidationError,
  assertDocumentRequirementProcessingAllowed,
  assertFieldProcessingCategoryAllowed,
  assertSensitiveProcessingAllowedForApplicationField,
  isCategoryEffectivelyEnabled,
  type EffectivePolicyEntry,
  type SensitiveProcessingErrorCode,
  type SensitiveProcessingPolicyDto,
  type UpdatePolicyInput,
} from "./sensitive-processing.js";
export {
  BusinessCalendarService,
  addBusinessDaysAfter,
  assertValidIanaTimeZone,
  calculateBusinessDeadline,
  calculateOfferReminderAt,
  civilDateTimeToInstant,
  civilDayOfWeek,
  formatIsoCivilDate,
  formatLocalizedDeadline,
  getLocalDate,
  getZonedParts,
  isBusinessDate,
  parseIsoCivilDate,
  previousBusinessDate,
  shiftCivilDate,
  validateIanaTimeZone,
  validateIsoCivilDate,
  type AddExcludedDateInput,
  type BusinessCalendarExcludedDateDto,
  type CivilDateParts,
  type ConfigureBusinessCalendarInput,
  type EffectiveCalendarConfig,
  type TenantBusinessCalendarDto,
} from "./business-calendar.js";
export {
  INITIAL_TENANT_ADMIN_PERMISSIONS,
  TenantBootstrapError,
  TenantBootstrapService,
  normalizeTenantCode,
  type BootstrapTenantAdminInput,
  type BootstrapTenantAdminResult,
  type TenantBootstrapErrorCode,
} from "./tenant-bootstrap.js";
export {
  SYNTHETIC_AUTHORITY_REVIEWER_PERMISSIONS,
  SYNTHETIC_AUTHORITY_REVIEWER_ROLE_KEY,
  SYNTHETIC_AUTHORITY_TENANT_CODE,
  SyntheticAuthorityReviewerProvisionError,
  SyntheticAuthorityReviewerProvisioner,
  type ProvisionSyntheticAuthorityReviewerInput,
  type ProvisionSyntheticAuthorityReviewerResult,
  type SyntheticAuthorityReviewerProvisionErrorCode,
} from "./synthetic-authority-reviewer.js";
export {
  SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS,
  SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY,
  SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE,
  SyntheticAdmissionsOperatorProvisionError,
  SyntheticAdmissionsOperatorProvisioner,
  type ProvisionSyntheticAdmissionsOperatorInput,
  type ProvisionSyntheticAdmissionsOperatorResult,
  type SyntheticAdmissionsOperatorProvisionErrorCode,
} from "./synthetic-admissions-operator.js";
