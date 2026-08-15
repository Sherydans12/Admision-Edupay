import { sanitizeLogValue } from "./structured-logger.js";

export type OperationalSignalId =
  | "OP-API-AVAILABILITY"
  | "OP-API-ERROR-RATE"
  | "OP-API-READINESS"
  | "OP-WORKER-HEALTH"
  | "OP-JOB-STALE"
  | "OP-OUTBOX-DEPTH"
  | "OP-BACKUP-FAILURE"
  | "OP-DB-SATURATION"
  | "OP-SCANNER-FAILURE"
  | "OP-SCANNER-BACKLOG"
  | "OP-OBJECT-STORAGE-FAILURE"
  | "OP-EMAIL-DEGRADATION"
  | "SEC-CROSS-TENANT"
  | "SEC-ELEVATION-DENIED"
  | "SEC-REPEATED-CREDENTIAL-FAILURE"
  | "SEC-SENSITIVE-PERMISSION-DENIED";

export interface OperationalSignalDefinition {
  category: "OPERATIONAL" | "SECURITY";
  condition: string;
  expectedOperatorAction: string;
  runbook: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  signalId: OperationalSignalId;
  source: string;
}

export interface OperationalSignalCandidate {
  dimensions: Record<string, unknown>;
  signalId: OperationalSignalId;
  state: "ALERT_CANDIDATE";
}

const contractRows: ReadonlyArray<
  readonly [
    OperationalSignalId,
    OperationalSignalDefinition["category"],
    OperationalSignalDefinition["severity"],
    string,
    string,
    string,
  ]
> = [
  [
    "OP-API-AVAILABILITY",
    "OPERATIONAL",
    "CRITICAL",
    "api",
    "liveness fails",
    "API unavailable",
  ],
  [
    "OP-API-ERROR-RATE",
    "OPERATIONAL",
    "HIGH",
    "api",
    "error rate exceeds configured local test threshold",
    "API errors",
  ],
  [
    "OP-API-READINESS",
    "OPERATIONAL",
    "CRITICAL",
    "api",
    "readiness is unavailable",
    "API readiness",
  ],
  [
    "OP-WORKER-HEALTH",
    "OPERATIONAL",
    "HIGH",
    "worker",
    "worker is not ready",
    "Worker stopped",
  ],
  [
    "OP-JOB-STALE",
    "OPERATIONAL",
    "HIGH",
    "outbox",
    "oldest pending or processing job exceeds threshold",
    "Jobs/outbox stale",
  ],
  [
    "OP-OUTBOX-DEPTH",
    "OPERATIONAL",
    "MEDIUM",
    "outbox",
    "depth exceeds threshold",
    "Jobs/outbox stale",
  ],
  [
    "OP-BACKUP-FAILURE",
    "OPERATIONAL",
    "CRITICAL",
    "recovery-smoke",
    "backup or restore verification fails",
    "Backup failed",
  ],
  [
    "OP-DB-SATURATION",
    "OPERATIONAL",
    "HIGH",
    "database",
    "saturation exceeds threshold",
    "DB unavailable",
  ],
  [
    "OP-SCANNER-FAILURE",
    "OPERATIONAL",
    "HIGH",
    "document-worker",
    "scan is ERROR or UNSCANNABLE",
    "Scanner unavailable",
  ],
  [
    "OP-SCANNER-BACKLOG",
    "OPERATIONAL",
    "MEDIUM",
    "document-worker",
    "pending scan age exceeds threshold",
    "Scanner unavailable",
  ],
  [
    "OP-OBJECT-STORAGE-FAILURE",
    "OPERATIONAL",
    "HIGH",
    "object-storage",
    "storage operation fails",
    "Object inconsistency",
  ],
  [
    "OP-EMAIL-DEGRADATION",
    "OPERATIONAL",
    "HIGH",
    "communication-worker",
    "delivery attempt fails",
    "Email degraded",
  ],
  [
    "SEC-CROSS-TENANT",
    "SECURITY",
    "CRITICAL",
    "security-event",
    "cross-tenant authorization is denied",
    "Suspected cross-tenant/security event",
  ],
  [
    "SEC-ELEVATION-DENIED",
    "SECURITY",
    "HIGH",
    "security-event",
    "support elevation is denied",
    "Suspected cross-tenant/security event",
  ],
  [
    "SEC-REPEATED-CREDENTIAL-FAILURE",
    "SECURITY",
    "HIGH",
    "security-event",
    "repeated credential verification failures reach threshold",
    "Suspected cross-tenant/security event",
  ],
  [
    "SEC-SENSITIVE-PERMISSION-DENIED",
    "SECURITY",
    "HIGH",
    "security-event",
    "sensitive permission is denied",
    "Suspected cross-tenant/security event",
  ],
];

export const OPERATIONAL_SIGNAL_CONTRACT: readonly OperationalSignalDefinition[] =
  contractRows.map(
    ([signalId, category, severity, source, condition, runbook]) => ({
      category,
      condition,
      expectedOperatorAction:
        "Follow the referenced runbook; do not treat this local candidate as a productive page.",
      runbook: `docs/g5/08-g5or-incident-and-recovery-runbook.md#${runbook.toLowerCase().replaceAll(" ", "-")}`,
      severity,
      signalId,
      source,
    }),
  );

export function createOperationalSignalCandidate(input: {
  dimensions?: Record<string, unknown>;
  signalId: OperationalSignalId;
}): OperationalSignalCandidate {
  if (
    !OPERATIONAL_SIGNAL_CONTRACT.some(
      (item) => item.signalId === input.signalId,
    )
  ) {
    throw new TypeError("Unknown operational signal");
  }
  return {
    dimensions: sanitizeLogValue(input.dimensions ?? {}) as Record<
      string,
      unknown
    >,
    signalId: input.signalId,
    state: "ALERT_CANDIDATE",
  };
}
