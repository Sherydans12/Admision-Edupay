export class IntakeNotFoundError extends Error {
  constructor() {
    super("Intake resource not found");
    this.name = "IntakeNotFoundError";
  }
}

export class IntakeDuplicateError extends Error {
  constructor(
    message = "An active draft already exists for this student and offering",
  ) {
    super(message);
    this.name = "IntakeDuplicateError";
  }
}

export class IntakeValidationError extends Error {
  constructor(message = "Invalid intake input") {
    super(message);
    this.name = "IntakeValidationError";
  }
}

export type IntakeConflictCode =
  | "DOCUMENT_PROCESSING_IN_PROGRESS"
  | "DOCUMENT_VERSION_CHANGED"
  | "OFFERING_EXPLICIT_PUBLISH_REQUIRED"
  | "CAPACITY_CONFIGURATION_REQUIRED"
  | "OFFERING_VERSION_CHANGED"
  | "PUBLISHED_OFFERING_CAPACITY_REQUIRED";

export class IntakeConflictError extends Error {
  constructor(readonly code: IntakeConflictCode) {
    super(code);
    this.name = "IntakeConflictError";
  }
}

export type ActivityConflictCode =
  | "ACTIVITY_APPOINTMENT_CHANGED"
  | "ACTIVITY_ALREADY_SCHEDULED"
  | "ACTIVITY_NO_SHOW_TOO_EARLY"
  | "ACTIVITY_CLOSED"
  | "NORMAL_RESCHEDULE_LIMIT_REQUIRES_REVIEW";

export class ActivityConflictError extends Error {
  constructor(readonly code: ActivityConflictCode) {
    super(code);
    this.name = "ActivityConflictError";
  }
}

export type ActivityPolicyConflictCode =
  | "ACTIVITY_POLICY_ALREADY_CONFIGURED"
  | "ACTIVITY_POLICY_REQUIRED"
  | "ACTIVITY_POLICY_EXECUTORS_MUST_DIFFER"
  | "ACTIVITY_POLICY_EXECUTOR_INACTIVE"
  | "ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED"
  | "ACTIVITY_POLICY_VERSION_CHANGED"
  | "ASSIGNED_EXECUTOR_NOT_PRIMARY_OR_BACKUP";

export class ActivityPolicyConflictError extends Error {
  constructor(readonly code: ActivityPolicyConflictCode) {
    super(code);
    this.name = "ActivityPolicyConflictError";
  }
}

export type RecommendationConflictCode =
  | "RECOMMENDATION_VERSION_CHANGED"
  | "RECOMMENDATION_NOT_SUBMITTED"
  | "DECISION_ALREADY_FINAL"
  | "CASE_RETURNED_TO_REVIEW";

export class RecommendationConflictError extends Error {
  constructor(readonly code: RecommendationConflictCode) {
    super(code);
    this.name = "RecommendationConflictError";
  }
}

export class RecommendationValidationError extends Error {
  constructor(message = "Invalid recommendation or decision input") {
    super(message);
    this.name = "RecommendationValidationError";
  }
}

export type CapacityOfferConflictCode =
  | "CAPACITY_ALREADY_CONFIGURED"
  | "CAPACITY_NOT_CONFIGURED"
  | "CAPACITY_VERSION_CHANGED"
  | "CAPACITY_BELOW_CONSUMED_SEATS"
  | "NO_ADMISSION_SEAT_AVAILABLE"
  | "RESERVATION_ALREADY_EXISTS"
  | "WAITLIST_ENTRY_VERSION_CHANGED"
  | "WAITLIST_ENTRY_NOT_ACTIVE"
  | "WAITLIST_ENTRY_NOT_FIRST"
  | "OFFER_VERSION_CHANGED"
  | "OFFER_NOT_ACTIVE"
  | "OFFER_NOT_EXPIRED"
  | "OFFER_ALREADY_ACCEPTED"
  | "OFFER_EXPIRED"
  | "APPLICATION_WITHDRAWN"
  | "BUSINESS_CALENDAR_NOT_CONFIGURED";

export class CapacityOfferConflictError extends Error {
  constructor(readonly code: CapacityOfferConflictCode) {
    super(code);
    this.name = "CapacityOfferConflictError";
  }
}

export class CapacityOfferValidationError extends Error {
  constructor(
    message = "Invalid capacity, waitlist, offer or withdrawal input",
  ) {
    super(message);
    this.name = "CapacityOfferValidationError";
  }
}

export type FunctionalHandoffConflictCode = "HANDOFF_NOT_ENABLED";

export class FunctionalHandoffConflictError extends Error {
  constructor(readonly code: FunctionalHandoffConflictCode) {
    super(code);
    this.name = "FunctionalHandoffConflictError";
  }
}

export type ApplicationAuthorityConflictCode =
  | "APPLICATION_AUTHORITY_NOT_DECLARED"
  | "APPLICATION_AUTHORITY_NOT_VERIFIED"
  | "APPLICATION_AUTHORITY_MODE_INVALID"
  | "AUTHORITY_STUDENT_DATA_CHANGED"
  | "STUDENT_DATE_OF_BIRTH_REQUIRED"
  | "AUTHORITY_VERSION_CHANGED"
  | "AUTHORITY_EVIDENCE_REQUIRED"
  | "AUTHORITY_INVALID_TRANSITION"
  | "AUTHORITY_EVIDENCE_INVALID"
  | "AUTHORITY_PRINCIPAL_MISMATCH";

export class ApplicationAuthorityConflictError extends Error {
  constructor(readonly code: ApplicationAuthorityConflictCode) {
    super(code);
    this.name = "ApplicationAuthorityConflictError";
  }
}

export class ApplicationAuthorityValidationError extends Error {
  constructor(message = "Invalid application authority input") {
    super(message);
    this.name = "ApplicationAuthorityValidationError";
  }
}

export type BusinessCalendarConflictCode =
  | "BUSINESS_CALENDAR_NOT_CONFIGURED"
  | "BUSINESS_CALENDAR_VERSION_CHANGED"
  | "EXCLUDED_DATE_ALREADY_EXISTS";

export class BusinessCalendarConflictError extends Error {
  constructor(readonly code: BusinessCalendarConflictCode) {
    super(code);
    this.name = "BusinessCalendarConflictError";
  }
}

export class BusinessCalendarValidationError extends Error {
  constructor(message = "Invalid business calendar input") {
    super(message);
    this.name = "BusinessCalendarValidationError";
  }
}

export class BusinessCalendarNotConfiguredError extends BusinessCalendarConflictError {
  constructor() {
    super("BUSINESS_CALENDAR_NOT_CONFIGURED");
    this.name = "BusinessCalendarNotConfiguredError";
  }
}

export class InvalidBusinessTimezoneError extends BusinessCalendarValidationError {
  constructor(message = "Invalid IANA business timezone") {
    super(message);
    this.name = "InvalidBusinessTimezoneError";
  }
}
