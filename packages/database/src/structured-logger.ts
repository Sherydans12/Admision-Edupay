import {
  getCorrelationId,
  resolveCorrelationId,
} from "./correlation-context.js";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|csrf|database.?url|document|password|secret|session|token|form.?data|health|pie|nee)/i;

export type StructuredLogLevel = "ERROR" | "INFO" | "WARN";

export interface StructuredLogEvent {
  correlationId: string;
  eventCode: string;
  level: StructuredLogLevel;
  result: string;
  service: string;
  timestamp: string;
  [key: string]: unknown;
}

export function sanitizeLogValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeLogValue(childValue, childKey),
      ]),
    );
  }
  return value;
}

export class StructuredLogger {
  constructor(
    private readonly service: string,
    private readonly writer: (line: string) => void = (line) =>
      console.log(line),
  ) {}

  info(
    eventCode: string,
    result: string,
    fields: Record<string, unknown> = {},
  ): StructuredLogEvent {
    return this.write("INFO", eventCode, result, fields);
  }

  warn(
    eventCode: string,
    result: string,
    fields: Record<string, unknown> = {},
  ): StructuredLogEvent {
    return this.write("WARN", eventCode, result, fields);
  }

  error(
    eventCode: string,
    result: string,
    fields: Record<string, unknown> = {},
  ): StructuredLogEvent {
    return this.write("ERROR", eventCode, result, fields);
  }

  private write(
    level: StructuredLogLevel,
    eventCode: string,
    result: string,
    fields: Record<string, unknown>,
  ) {
    const event = {
      ...(sanitizeLogValue(fields) as Record<string, unknown>),
      correlationId: getCorrelationId() ?? resolveCorrelationId(undefined),
      eventCode,
      level,
      result,
      service: this.service,
      timestamp: new Date().toISOString(),
    } as StructuredLogEvent;
    this.writer(JSON.stringify(event));
    return event;
  }
}
