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
  "DOCUMENT_PROCESSING_IN_PROGRESS" | "DOCUMENT_VERSION_CHANGED";

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
  | "APPLICATION_WITHDRAWN";

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
