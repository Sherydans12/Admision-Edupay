const sensitiveKey =
  /(authorization|cookie|csrf|database.?url|document|password|secret|session|token|form.?data|health|pie|nee)/i;

function sanitize(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitize(childValue, childKey),
      ]),
    );
  }
  return value;
}

export class StructuredLogger {
  constructor(private readonly service: string) {}

  error(
    eventCode: string,
    result: string,
    fields: Record<string, unknown> = {},
  ): void {
    console.error(
      JSON.stringify({
        ...(sanitize(fields) as Record<string, unknown>),
        eventCode,
        level: "ERROR",
        result,
        service: this.service,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
