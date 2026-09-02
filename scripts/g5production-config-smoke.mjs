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

const compose = await read("compose.coolify.production.yaml");
const environment = await read(".env.coolify.production.example");
const workflow = await read(".github/workflows/deploy-production-coolify.yml");

assertContains(
  compose,
  "name: admission-production",
  "production Compose name",
);
for (const service of [
  "migrator",
  "tenant-bootstrap",
  "api",
  "web",
  "worker",
]) {
  assertContains(compose, `  ${service}:`, "production Compose service");
}
assertContains(
  compose,
  "profiles:\n      - bootstrap",
  "production bootstrap profile",
);
assertContains(
  compose,
  "condition: service_completed_successfully",
  "migration gate",
);
assertContains(compose, "read_only: true", "container hardening");
assertContains(compose, "cap_drop:", "container hardening");
assertContains(compose, "no-new-privileges:true", "container hardening");
assert(
  !/^\s+ports:\s*$/mu.test(compose),
  "Production Compose must not publish host ports",
);

for (const value of [
  "ADMISSION_DOCUMENTS_ENABLED: ${ADMISSION_DOCUMENTS_ENABLED:-false}",
  "NEXT_PUBLIC_ADMISSION_DOCUMENTS_ENABLED: ${ADMISSION_DOCUMENTS_ENABLED:-false}",
  "REAL_EMAIL_DELIVERY_AUTHORIZED: ${REAL_EMAIL_DELIVERY_AUTHORIZED:-false}",
  "EMAIL_DELIVERY_MODE: ${EMAIL_DELIVERY_MODE:-synthetic}",
  "S3_ENDPOINT: ${S3_ENDPOINT:-}",
  "CLAMAV_HOST: ${CLAMAV_HOST:-}",
]) {
  assertContains(compose, value, "production runtime contract");
}

for (const name of [
  "DATABASE_MIGRATION_URL",
  "DATABASE_APP_URL",
  "ADMISSION_WEB_ORIGIN",
  "ADMISSION_APP_ORIGIN",
  "ADMISSION_PUBLIC_WEB_URL",
  "ADMISSION_API_PUBLIC_URL",
  "ADMISSION_TENANT_PUBLIC_ID",
  "ADMISSION_DOCUMENTS_ENABLED",
  "S3_ENDPOINT",
  "S3_APPROVED_BUCKET",
  "S3_QUARANTINE_BUCKET",
  "CLAMAV_HOST",
  "EMAIL_DELIVERY_MODE",
  "REAL_EMAIL_DELIVERY_AUTHORIZED",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_WEBHOOK_SECRET",
]) {
  assert(
    new RegExp(`^${name}=`, "m").test(environment),
    `.env.coolify.production.example is missing ${name}`,
  );
}
assertContains(environment, "example.invalid", "non-production placeholders");
assertContains(
  environment,
  "EMAIL_DELIVERY_MODE=synthetic",
  "synthetic email default",
);
assertContains(
  environment,
  "REAL_EMAIL_DELIVERY_AUTHORIZED=false",
  "live email denial default",
);
assertContains(
  environment,
  "ADMISSION_DOCUMENTS_ENABLED=false",
  "document denial default",
);
assertContains(
  environment,
  "S3_ALLOW_INSECURE_INTERNAL=false",
  "secure storage default",
);
assert(
  !environment.includes("baselogic.cl"),
  "Production example must not contain live hostnames",
);
assert(
  !compose.includes('REAL_EMAIL_DELIVERY_AUTHORIZED: "true"'),
  "Production Compose must never hardcode live email authorization",
);
assertContains(
  workflow,
  "environment: admission-production",
  "production gate",
);
assertContains(workflow, "PRODUCTION_SYNTHETIC", "explicit confirmation");
assertContains(
  workflow,
  "compose.coolify.production.yaml",
  "production artifact",
);
assertContains(workflow, "CF_ACCESS_CLIENT_ID", "Cloudflare Access client ID");
assertContains(
  workflow,
  "CF_ACCESS_CLIENT_SECRET",
  "Cloudflare Access client secret",
);
assert(
  !workflow.includes("secrets: inherit"),
  "Production workflow must not inherit unrelated secrets",
);

const portableCompose = compose.replace(
  /^\s+exclude_from_hc:\s+true\s*$/gmu,
  "",
);
const docker = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    ".env.coolify.production.example",
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

console.log("PRODUCTION_COMPOSE_SERVICES=PASS");
console.log("PRODUCTION_NETWORK_EXPOSURE=PASS (no host ports)");
console.log("PRODUCTION_SECURITY_INVARIANTS=PASS");
console.log("PRODUCTION_SYNTHETIC_DEFAULTS=PASS");
console.log("PRODUCTION_CD_GATE=PASS (manual, synthetic-only)");
console.log("PRODUCTION_COMPOSE_CONFIG=PASS");
