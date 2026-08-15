export interface WorkerHealth {
  service: "admission-worker";
  status: "ready" | "starting";
}

export class WorkerHealthTracker {
  private status: WorkerHealth["status"] = "starting";

  get(): WorkerHealth {
    return { service: "admission-worker", status: this.status };
  }

  markReady(): void {
    this.status = "ready";
  }
}

const tracker = new WorkerHealthTracker();

export function markWorkerReady(): void {
  tracker.markReady();
}

export function getWorkerHealth(): WorkerHealth {
  return tracker.get();
}
