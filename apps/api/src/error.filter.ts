import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
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
}

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger("admission-api");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{
      status(code: number): { json(body: PublicErrorResponse): void };
    }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = classifyStatus(status);
    const correlationId = getCorrelationId() ?? "unbound-request";
    this.logger.error("HTTP_REQUEST_FAILED", error, { correlationId, status });
    response
      .status(status)
      .json({ correlationId, error, message: "Request failed" });
  }
}

function classifyStatus(status: number): PublicErrorResponse["error"] {
  if (status === HttpStatus.UNAUTHORIZED) return "AUTHENTICATION";
  if (status === HttpStatus.FORBIDDEN) return "AUTHORIZATION";
  if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND";
  if (status === HttpStatus.CONFLICT) return "CONFLICT";
  if (
    status === HttpStatus.BAD_REQUEST ||
    status === HttpStatus.UNPROCESSABLE_ENTITY
  )
    return "VALIDATION";
  return "INTERNAL";
}
