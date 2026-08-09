export type AuditResult = "ALLOW" | "DENY" | "FAILURE" | "SUCCESS";

export interface AuditEvent {
  action: string;
  actorId: string;
  correlationId: string;
  effectiveActorId: string;
  metadata?: Readonly<Record<string, unknown>>;
  occurredAt: Date;
  purpose: string;
  reasonCode?: string;
  resourceId?: string;
  resourceType: string;
  result: AuditResult;
  tenantId?: string;
}

export interface AuditSink {
  record(event: AuditEvent): void | Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    const copy: AuditEvent = { ...event };
    if (event.metadata !== undefined) {
      copy.metadata = { ...event.metadata };
    }
    this.events.push(copy);
  }
}

export class NoopAuditSink implements AuditSink {
  record(_event: AuditEvent): void {
    // Deliberately empty: applications inject a real sink or the in-memory test sink.
  }
}
