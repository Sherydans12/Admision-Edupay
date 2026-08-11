import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ActivityConflictError,
  ForbiddenError,
  IntakeConflictError,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
  RecommendationConflictError,
  RecommendationValidationError,
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
    | "CASE_RETURNED_TO_REVIEW";
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
  if (exception instanceof IntakeDuplicateError) return HttpStatus.CONFLICT;
  if (exception instanceof IntakeNotFoundError) return HttpStatus.NOT_FOUND;
  if (exception instanceof IntakeValidationError) return HttpStatus.BAD_REQUEST;
  if (exception instanceof RecommendationValidationError)
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
