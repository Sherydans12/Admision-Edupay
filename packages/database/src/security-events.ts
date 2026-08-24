export type SecurityEventCode =
  | "ACCOUNT_VERIFICATION_EXCESSIVE_ATTEMPTS"
  | "ACCOUNT_VERIFICATION_INVALID_ATTEMPT"
  | "ACCOUNT_VERIFICATION_REPLAY"
  | "CROSS_TENANT_AUTHORIZATION_DENIED"
  | "INVALID_SESSION"
  | "SENSITIVE_PERMISSION_DENIED"
  | "SUPPORT_ELEVATION_DENIED";

export interface SecurityEvent {
  code: SecurityEventCode;
  correlationId: string;
  occurredAt: Date;
  result: "DENY" | "SUCCESS";
  subjectId?: string;
  tenantId?: string;
}

export interface SecurityEventSink {
  record(event: SecurityEvent): void | Promise<void>;
}

export class InMemorySecurityEventSink implements SecurityEventSink {
  readonly events: SecurityEvent[] = [];

  record(event: SecurityEvent): void {
    this.events.push({ ...event });
  }
}

export class NoopSecurityEventSink implements SecurityEventSink {
  record(_event: SecurityEvent): void {
    // Deliberately empty: the caller can inject an append-only security sink.
  }
}

export class StructuredSecurityEventSink implements SecurityEventSink {
  private readonly logger = new StructuredLogger("security-events");

  record(event: SecurityEvent): void {
    const metadata = {
      correlationId: event.correlationId,
      occurredAt: event.occurredAt.toISOString(),
      ...(event.subjectId === undefined
        ? {}
        : { subjectHash: opaqueHash(event.subjectId) }),
      ...(event.tenantId === undefined
        ? {}
        : { tenantHash: opaqueHash(event.tenantId) }),
    };
    if (event.result === "DENY") {
      this.logger.warn(event.code, event.result, metadata);
    } else {
      this.logger.info(event.code, event.result, metadata);
    }
  }
}

function opaqueHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
import { createHash } from "node:crypto";

import { StructuredLogger } from "./structured-logger.js";
