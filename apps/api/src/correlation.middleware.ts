import {
  resolveCorrelationId,
  runWithCorrelationContext,
} from "./correlation-context.js";

interface CorrelationRequest {
  headers?: Record<string, string | string[] | undefined>;
}

interface CorrelationResponse {
  setHeader(name: string, value: string): void;
}

export class CorrelationMiddleware {
  use(
    request: CorrelationRequest,
    response: CorrelationResponse,
    next: () => void,
  ): void {
    const candidate = request.headers?.["x-correlation-id"];
    const rawCandidate = Array.isArray(candidate) ? candidate[0] : candidate;
    const correlationId = resolveCorrelationId(rawCandidate);
    response.setHeader("X-Correlation-Id", correlationId);
    runWithCorrelationContext(correlationId, next);
  }
}
