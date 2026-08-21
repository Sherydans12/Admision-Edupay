import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ActivityConflictError,
  ApplicationAuthorityConflictError,
  ApplicationAuthorityValidationError,
  AccessAdminValidationError,
  AccountRegistrationValidationError,
  AccountVerificationError,
  CapacityOfferConflictError,
  CapacityOfferValidationError,
  FunctionalHandoffConflictError,
  ForbiddenError,
  IntakeConflictError,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
  RecommendationConflictError,
  RecommendationValidationError,
  ReportExportLimitExceededError,
  ReportValidationError,
  RoleAssignmentChangedError,
  SensitiveProcessingValidationError,
} from "@admission/database";
import { getCorrelationId } from "./correlation-context.js";
import { StructuredLogger } from "./structured-logger.js";

export interface PublicErrorResponse {
  correlationId: string;
  error:
    | "AUTHENTICATION"
    | "AUTHORIZATION"
    | "CONFLICT"
    | "INTERNAL"
    | "NOT_FOUND"
    | "VALIDATION";
  message: "Request failed";
  code?:
    | "DOCUMENT_PROCESSING_IN_PROGRESS"
    | "DOCUMENT_VERSION_CHANGED"
    | "ACTIVITY_APPOINTMENT_CHANGED"
    | "ACTIVITY_ALREADY_SCHEDULED"
    | "ACTIVITY_NO_SHOW_TOO_EARLY"
    | "ACTIVITY_CLOSED"
    | "NORMAL_RESCHEDULE_LIMIT_REQUIRES_REVIEW"
    | "RECOMMENDATION_VERSION_CHANGED"
    | "RECOMMENDATION_NOT_SUBMITTED"
    | "DECISION_ALREADY_FINAL"
    | "CASE_RETURNED_TO_REVIEW"
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
    | "HANDOFF_NOT_ENABLED"
    | "APPLICATION_AUTHORITY_NOT_DECLARED"
    | "APPLICATION_AUTHORITY_NOT_VERIFIED"
    | "APPLICATION_AUTHORITY_MODE_INVALID"
    | "AUTHORITY_STUDENT_DATA_CHANGED"
    | "STUDENT_DATE_OF_BIRTH_REQUIRED"
    | "AUTHORITY_VERSION_CHANGED"
    | "AUTHORITY_EVIDENCE_REQUIRED"
    | "AUTHORITY_INVALID_TRANSITION"
    | "AUTHORITY_EVIDENCE_INVALID"
    | "AUTHORITY_PRINCIPAL_MISMATCH"
    | "REPORT_EXPORT_LIMIT_EXCEEDED"
    | "ROLE_ASSIGNMENT_CHANGED";
}

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger("admission-api");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{
      status(code: number): { json(body: PublicErrorResponse): void };
    }>();
    const status = exceptionStatus(exception);
    const error = classifyStatus(status);
    const correlationId = getCorrelationId() ?? "unbound-request";
    this.logger.error("HTTP_REQUEST_FAILED", error, { correlationId, status });
    response.status(status).json({
      correlationId,
      error,
      message: "Request failed",
      ...(exception instanceof IntakeConflictError
        ? { code: exception.code }
        : exception instanceof ActivityConflictError
          ? { code: exception.code }
          : exception instanceof RecommendationConflictError
            ? { code: exception.code }
            : exception instanceof CapacityOfferConflictError
              ? { code: exception.code }
              : exception instanceof FunctionalHandoffConflictError
                ? { code: exception.code }
                : exception instanceof ApplicationAuthorityConflictError
                  ? { code: exception.code }
                  : exception instanceof ReportExportLimitExceededError
                    ? { code: exception.code }
                    : exception instanceof RoleAssignmentChangedError
                      ? { code: exception.code }
                      : {}),
    });
  }
}

function exceptionStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
  if (exception instanceof IntakeConflictError) return HttpStatus.CONFLICT;
  if (exception instanceof ActivityConflictError) return HttpStatus.CONFLICT;
  if (exception instanceof RecommendationConflictError)
    return HttpStatus.CONFLICT;
  if (exception instanceof CapacityOfferConflictError)
    return HttpStatus.CONFLICT;
  if (exception instanceof FunctionalHandoffConflictError)
    return HttpStatus.CONFLICT;
  if (exception instanceof ApplicationAuthorityConflictError)
    return HttpStatus.CONFLICT;
  if (exception instanceof ReportExportLimitExceededError)
    return HttpStatus.CONFLICT;
  if (exception instanceof RoleAssignmentChangedError)
    return HttpStatus.CONFLICT;
  if (exception instanceof IntakeDuplicateError) return HttpStatus.CONFLICT;
  if (exception instanceof IntakeNotFoundError) return HttpStatus.NOT_FOUND;
  if (exception instanceof IntakeValidationError) return HttpStatus.BAD_REQUEST;
  if (exception instanceof RecommendationValidationError)
    return HttpStatus.BAD_REQUEST;
  if (exception instanceof CapacityOfferValidationError)
    return HttpStatus.BAD_REQUEST;
  if (exception instanceof ApplicationAuthorityValidationError)
    return HttpStatus.BAD_REQUEST;
  if (exception instanceof ReportValidationError) return HttpStatus.BAD_REQUEST;
  if (exception instanceof AccessAdminValidationError)
    return HttpStatus.BAD_REQUEST;
  if (exception instanceof AccountRegistrationValidationError)
    return HttpStatus.BAD_REQUEST;
  if (exception instanceof AccountVerificationError)
    return HttpStatus.BAD_REQUEST;
  if (exception instanceof SensitiveProcessingValidationError)
    return HttpStatus.BAD_REQUEST;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function classifyStatus(status: number): PublicErrorResponse["error"] {
  if (status === HttpStatus.UNAUTHORIZED) return "AUTHENTICATION";
  if (status === HttpStatus.FORBIDDEN) return "AUTHORIZATION";
  if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND";
  if (status === HttpStatus.CONFLICT) return "CONFLICT";
  if (
    status === HttpStatus.BAD_REQUEST ||
    status === HttpStatus.PAYLOAD_TOO_LARGE ||
    status === HttpStatus.UNPROCESSABLE_ENTITY
  )
    return "VALIDATION";
  return "INTERNAL";
}
