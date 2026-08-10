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
