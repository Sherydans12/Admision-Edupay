import { getWorkerDescriptor } from "./worker.js";
import { markWorkerReady } from "./worker-health.js";

const descriptor = getWorkerDescriptor();
markWorkerReady();
console.info(JSON.stringify(descriptor));

const heartbeat = setInterval(() => {
  console.info(JSON.stringify({ ...descriptor, heartbeat: "alive" }));
}, 30_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    clearInterval(heartbeat);
    process.exitCode = 0;
  });
}
