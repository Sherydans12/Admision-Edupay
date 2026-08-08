import { execFile as execFileCallback } from "node:child_process";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFile = promisify(execFileCallback);
const project = "admission-e4-readiness";
const composeArgs = [
  "compose",
  "-f",
  "compose.yaml",
  "-f",
  "compose.e4-readiness.yaml",
  "-p",
  project,
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            command +
              " " +
              args.join(" ") +
              " exited with " +
              (code ?? "unknown") +
              "\n" +
              stderr,
          ),
        );
      }
    });
  });
}

async function capture(command, args) {
  const result = await execFile(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  return result.stdout.trim();
}

async function freePort(start) {
  for (let port = start; port < start + 100; port += 1) {
    const available = await new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });
    if (available) return port;
  }
  throw new Error("No local port available in " + start + "-" + (start + 99));
}

async function waitForHttp(label, url) {
  const deadline = Date.now() + 60_000;
  let lastError = "not attempted";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        console.log(label + "=PASS (" + response.status + ")");
        return;
      }
      lastError = "HTTP " + response.status;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(label + " did not become ready: " + lastError);
}

async function containerState(service) {
  const id = await capture("docker", [...composeArgs, "ps", "-aq", service]);
  if (!id) throw new Error("Container for " + service + " was not created");
  return JSON.parse(
    await capture("docker", [
      "inspect",
      id.split("\n")[0],
      "--format",
      "{{json .State}}",
    ]),
  );
}

async function waitForHealthy(service) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = await containerState(service);
    if (state.Status !== "running") {
      throw new Error(service + " exited before becoming healthy");
    }
    if (state.Health?.Status === "healthy") return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(service + " did not become healthy");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const apiPort = Number(process.env.E4_API_PORT ?? (await freePort(3310)));
  const webPort = Number(process.env.E4_WEB_PORT ?? (await freePort(3320)));
  process.env.E4_API_PORT = String(apiPort);
  process.env.E4_WEB_PORT = String(webPort);

  console.log("DEVELOPMENT READINESS IMAGE: starting local smoke");
  console.log("LOCAL_PORTS=api:" + apiPort + ",web:" + webPort);

  await run(
    "docker",
    [...composeArgs, "down", "--volumes", "--remove-orphans"],
    {
      capture: true,
    },
  ).catch(() => undefined);

  try {
    await run("docker", [
      ...composeArgs,
      "up",
      "-d",
      "--build",
      "--force-recreate",
      "--remove-orphans",
    ]);

    await waitForHttp(
      "API_LIVE",
      "http://127.0.0.1:" + apiPort + "/health/live",
    );
    await waitForHttp(
      "API_READY",
      "http://127.0.0.1:" + apiPort + "/health/ready",
    );
    await waitForHttp("WEB_HTTP_200", "http://127.0.0.1:" + webPort);
    await waitForHealthy("postgres");
    await waitForHealthy("api");
    await waitForHealthy("web");

    const postgres = await containerState("postgres");
    const api = await containerState("api");
    const web = await containerState("web");
    const worker = await containerState("worker");
    const migrator = await containerState("migrator");

    assert(
      postgres.Status === "running" && postgres.Health?.Status === "healthy",
      "PostgreSQL is not healthy",
    );
    assert(
      api.Status === "running" && api.Health?.Status === "healthy",
      "API is not healthy",
    );
    assert(
      web.Status === "running" && web.Health?.Status === "healthy",
      "web is not healthy",
    );
    assert(worker.Status === "running", "worker is not running");
    assert(
      migrator.Status === "exited" && migrator.ExitCode === 0,
      "migrator did not complete successfully",
    );
    console.log("POSTGRES=PASS (healthy)");
    console.log("MIGRATIONS=PASS (migrator exit 0)");
    console.log("WORKER_START=PASS (container running)");

    const logs = await capture("docker", [
      ...composeArgs,
      "logs",
      "--no-color",
      "worker",
    ]);
    assert(
      logs.includes('"status":"ready"'),
      "worker readiness log was not observed",
    );
    assert(
      logs.includes('"environment":"synthetic-development"'),
      "worker synthetic environment was not observed",
    );
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const workerStillRunning = await containerState("worker");
    assert(
      workerStillRunning.Status === "running",
      "worker exited immediately",
    );
    console.log("WORKER_PERSISTENCE=PASS (still running after wait)");
    console.log("SERVICES_ALIVE=PASS (postgres/api/web/worker)");

    await run("docker", [...composeArgs, "stop", "-t", "10", "worker"]);
    const stoppedWorker = await containerState("worker");
    assert(
      stoppedWorker.Status === "exited" && stoppedWorker.ExitCode === 0,
      "worker did not stop cleanly with SIGTERM",
    );
    console.log("WORKER_SIGTERM=PASS (exit 0)");
    console.log("DEPLOYMENT_SMOKE=PASS");
  } finally {
    await run(
      "docker",
      [...composeArgs, "down", "--volumes", "--remove-orphans"],
      {
        capture: true,
      },
    ).catch((error) => console.error("cleanup warning: " + error.message));
  }
}

await main();
