import { getWorkerDescriptor } from "./worker.js";

const descriptor = getWorkerDescriptor();
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
