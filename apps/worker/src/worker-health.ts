export interface WorkerHealth {
  service: "admission-worker";
  status: "ready" | "starting";
}

let status: WorkerHealth["status"] = "starting";

export function markWorkerReady(): void {
  status = "ready";
}

export function getWorkerHealth(): WorkerHealth {
  return { service: "admission-worker", status };
}
