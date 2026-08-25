import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = process.cwd();

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(source, expected, label) {
  assert(source.includes(expected), `${label} is missing: ${expected}`);
}

const compose = await read("compose.coolify.yaml");
const environment = await read(".env.coolify.example");
const workflow = await read(".github/workflows/deploy-preprod-coolify.yml");
const dockerfiles = await Promise.all(
  [
    "apps/api/Dockerfile",
    "apps/web/Dockerfile",
    "apps/worker/Dockerfile",
    "infrastructure/docker/Dockerfile.migrator",
  ].map(read),
);

for (const service of ["migrator", "api", "web", "worker"]) {
  assertContains(compose, `  ${service}:`, "Coolify Compose");
}
assertContains(compose, "NODE_ENV: production", "Coolify Compose");
assertContains(compose, "exclude_from_hc: true", "Coolify migrator");
assertContains(
  compose,
  "condition: service_completed_successfully",
  "migration gate",
);
assertContains(compose, "no-new-privileges:true", "container hardening");
assertContains(compose, "cap_drop:", "container hardening");
assertContains(compose, "read_only: true", "container hardening");
assert(
  !/^\s+ports:\s*$/mu.test(compose),
  "Coolify Compose must not publish host ports; domains route through the proxy",
);

for (const name of [
  "DATABASE_MIGRATION_URL",
  "DATABASE_APP_URL",
  "ADMISSION_WEB_ORIGIN",
  "ADMISSION_APP_ORIGIN",
  "ADMISSION_PUBLIC_WEB_URL",
  "ADMISSION_API_PUBLIC_URL",
  "ADMISSION_TENANT_PUBLIC_ID",
  "ADMISSION_DOCUMENTS_ENABLED",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_WEBHOOK_SECRET",
  "EMAIL_DELIVERY_MODE",
  "REAL_EMAIL_DELIVERY_AUTHORIZED",
]) {
  assert(
    new RegExp(`^${name}=`, "m").test(environment),
    `.env.coolify.example is missing ${name}`,
  );
}
assertContains(environment, ".invalid", "synthetic environment contract");
assertContains(environment, "SET_IN_COOLIFY", "secret placeholders");
assertContains(
  environment,
  "EMAIL_DELIVERY_MODE=synthetic",
  "synthetic email guard",
);
assertContains(
  environment,
  "REAL_EMAIL_DELIVERY_AUTHORIZED=false",
  "real email denial guard",
);
assertContains(
  environment,
  "ADMISSION_DOCUMENTS_ENABLED=false",
  "core preproduction document denial guard",
);
assert(
  !compose.includes("S3_ENDPOINT") && !compose.includes("CLAMAV_HOST"),
  "Core preproduction must not configure S3/R2 or ClamAV",
);
assert(
  !compose.includes('REAL_EMAIL_DELIVERY_AUTHORIZED: "true"'),
  "Synthetic preproduction must never authorize real email delivery",
);
assert(
  !environment.includes("baselogic.cl"),
  "The example environment must not contain a real hostname",
);

for (const dockerfile of dockerfiles) {
  assertContains(dockerfile, "USER node", "runtime Dockerfile");
  assertContains(dockerfile, "PRODUCTION CANDIDATE IMAGE", "runtime label");
}
for (const dockerfile of dockerfiles.slice(0, 3)) {
  assertContains(
    dockerfile,
    "RUNTIME_NODE_ENV=production",
    "runtime environment",
  );
  assertContains(dockerfile, "HEALTHCHECK", "runtime healthcheck");
}

assertContains(workflow, "environment: admission-preprod", "deployment gate");
assertContains(workflow, "COOLIFY_DEPLOY_WEBHOOK", "deployment webhook");
assertContains(workflow, "COOLIFY_DEPLOY_TOKEN", "deployment token");
assertContains(workflow, "COOLIFY_API_BASE_URL", "Coolify API base URL");
assertContains(workflow, "deployment_uuid", "deployment execution identity");
assertContains(workflow, "GITHUB_SHA", "deployed revision verification");
assertContains(workflow, "PREPROD_SYNTHETIC", "explicit confirmation");
assert(
  !workflow.includes("secrets: inherit"),
  "Deployment workflow must not inherit unrelated secrets",
);

const portableCompose = compose.replace(
  /^\s+exclude_from_hc:\s+true\s*$/mu,
  "",
);
const docker = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    ".env.coolify.example",
    "-f",
    "-",
    "config",
    "--quiet",
  ],
  { cwd: root, encoding: "utf8", input: portableCompose },
);
assert(
  docker.status === 0,
  `Docker Compose validation failed: ${(docker.stderr || docker.stdout).trim()}`,
);

console.log("COOLIFY_SERVICES=PASS (web/api/worker/migrator)");
console.log("COOLIFY_NETWORK_EXPOSURE=PASS (no host ports)");
console.log("COOLIFY_SECURITY_INVARIANTS=PASS");
console.log("COOLIFY_ENV_CONTRACT=PASS (placeholders only)");
console.log("COOLIFY_CD_GATE=PASS (manual synthetic preprod)");
console.log("COOLIFY_COMPOSE_CONFIG=PASS");
