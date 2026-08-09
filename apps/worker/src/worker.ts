export interface WorkerDescriptor {
  environment: "synthetic-development";
  service: "admission-worker";
  status: "ready";
}

export function getWorkerDescriptor(): WorkerDescriptor {
  return {
    environment: "synthetic-development",
    service: "admission-worker",
    status: "ready",
  };
}
