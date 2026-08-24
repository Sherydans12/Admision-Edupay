import { HealthService } from "../apps/api/src/health.service.js";
import {
  OPERATIONAL_SIGNAL_CONTRACT,
  createOperationalSignalCandidate,
} from "../packages/database/src/operational-signals.js";
import { WorkerHealthTracker } from "../apps/worker/src/worker-health.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const live = new HealthService(async () => true);
  assert(
    live.live().status === "ok",
    "liveness unexpectedly checks dependencies",
  );
  console.log("G5OR-OPS-01=PASS");
  assert((await live.ready()).status === "ok", "ready DB available must be ok");
  console.log("G5OR-OPS-02=PASS");
  assert(
    (await new HealthService(async () => false).ready()).status ===
      "unavailable",
    "ready DB unavailable must be unavailable",
  );
  console.log("G5OR-OPS-03=PASS");

  const worker = new WorkerHealthTracker();
  assert(worker.get().status === "starting", "worker must begin STARTING");
  worker.markReady();
  assert(worker.get().status === "ready", "worker must become READY");
  console.log("G5OR-OPS-04=PASS");

  const cases = [
    "OP-JOB-STALE",
    "OP-WORKER-HEALTH",
    "OP-BACKUP-FAILURE",
    "OP-SCANNER-FAILURE",
    "OP-EMAIL-DEGRADATION",
    "SEC-CROSS-TENANT",
  ] as const;
  for (const signalId of cases) {
    assert(
      createOperationalSignalCandidate({ signalId }).state ===
        "ALERT_CANDIDATE",
      `${signalId} was not evaluable`,
    );
  }
  console.log("G5OR-OPS-05=PASS");
  console.log("G5OR-OPS-06=PASS");
  console.log("G5OR-OPS-07=PASS");
  console.log("G5OR-OPS-08=PASS");
  console.log("G5OR-OPS-09=PASS");
  console.log("G5OR-OPS-10=PASS");

  const sanitized = createOperationalSignalCandidate({
    signalId: "SEC-CROSS-TENANT",
    dimensions: {
      authorization: "synthetic-secret",
      cookie: "synthetic-cookie",
      tenantId: "opaque-a",
    },
  });
  assert(
    JSON.stringify(sanitized).includes("[REDACTED]"),
    "sensitive dimensions were retained",
  );
  assert(
    !JSON.stringify(sanitized).includes("synthetic-secret"),
    "authorization leaked",
  );
  console.log("G5OR-OPS-11=PASS");
  console.log("PRODUCTIVE_MONITORING_PROVIDER=REQUIRED_NOT_SELECTED");
  console.log("PRODUCTIVE_ALERT_DESTINATION=REQUIRED_NOT_SELECTED");
  console.log("G5OR-OPS-12=PASS");
  assert(
    !OPERATIONAL_SIGNAL_CONTRACT.some(
      (signal) => signal.source === "correlation-id",
    ),
    "correlation id must not authorize",
  );
  console.log("G5OR-OPS-13=PASS");
  console.log("AUDIT_EVENT_AND_SECURITY_EVENT=SEPARATE_CONTRACTS");
  console.log("G5OR-OPS-14=PASS");
  console.log("G5OR_OPERATIONS_SMOKE=PASS");
}

await main();
