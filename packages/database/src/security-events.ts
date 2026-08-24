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
