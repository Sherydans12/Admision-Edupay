import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFile = promisify(execFileCallback);
const project = "admission-e4-recovery";
const composeArgs = [
  "compose",
  "-f",
  "compose.e4-recovery.yaml",
  "-p",
  project,
];
const bootstrapPassword = "admission_bootstrap_local_only";
const migratorPassword = "admission_migrator_local_only";
const appPassword = "admission_app_local_only";

const controlPlaneSql = [
  "BEGIN;",
  "INSERT INTO platform_users (id, email_normalized, status) VALUES",
  "  ('11111111-1111-4111-8111-111111111111', 'recovery-principal-a@example.invalid', 'ACTIVE'),",
  "  ('22222222-2222-4222-8222-222222222222', 'recovery-principal-b@example.invalid', 'ACTIVE');",
  "INSERT INTO tenants (id, name, status) VALUES",
  "  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic Recovery Tenant A', 'ACTIVE'),",
  "  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Synthetic Recovery Tenant B', 'ACTIVE');",
  "COMMIT;",
].join("\n");

const tenantFixtureSql = [
  "BEGIN;",
  "SELECT set_config('admission.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);",
  "INSERT INTO memberships (id, tenant_id, user_id, status, starts_at) VALUES ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'ACTIVE', '2026-08-08 18:00:00+00');",
  "INSERT INTO role_assignments (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at) VALUES ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic.operator', ARRAY['synthetic.read'], ARRAY['synthetic'], 'ACTIVE', '2026-08-08 18:00:00+00');",
  "INSERT INTO support_elevations (id, tenant_id, actor_user_id, reason, purpose, scopes, categories, started_at, expires_at) VALUES ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'synthetic recovery validation', 'E4_RECOVERY_TEST', ARRAY['synthetic'], ARRAY['synthetic'], '2026-08-08 18:00:00+00', '2026-08-08 19:00:00+00');",
  "INSERT INTO outbox_messages (id, tenant_id, topic, payload, idempotency_key, available_at) VALUES ('aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic.recovery', '{\"fixture\":\"A\"}', 'recovery-a', '2026-08-08 18:00:00+00');",
  "INSERT INTO tenant_probe_records (id, tenant_id, label) VALUES ('aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'recovery-probe-a');",
  "COMMIT;",
  "BEGIN;",
  "SELECT set_config('admission.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);",
  "INSERT INTO memberships (id, tenant_id, user_id, status, starts_at) VALUES ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'ACTIVE', '2026-08-08 18:00:00+00');",
  "INSERT INTO role_assignments (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at) VALUES ('bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'synthetic.operator', ARRAY['synthetic.read'], ARRAY['synthetic'], 'ACTIVE', '2026-08-08 18:00:00+00');",
  "INSERT INTO outbox_messages (id, tenant_id, topic, payload, idempotency_key, available_at) VALUES ('bbbbbbb4-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'synthetic.recovery', '{\"fixture\":\"B\"}', 'recovery-b', '2026-08-08 18:00:00+00');",
  "INSERT INTO tenant_probe_records (id, tenant_id, label) VALUES ('bbbbbbb5-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'recovery-probe-b');",
  "COMMIT;",
].join("\n");

const fingerprintSql = [
  "SELECT 'platform_users=' || count(*) FROM platform_users;",
  "SELECT 'tenants=' || count(*) FROM tenants;",
  "SELECT 'memberships=' || count(*) FROM memberships;",
  "SELECT 'role_assignments=' || count(*) FROM role_assignments;",
  "SELECT 'support_elevations=' || count(*) FROM support_elevations;",
  "SELECT 'outbox_messages=' || count(*) FROM outbox_messages;",
  "SELECT 'tenant_probe_records=' || count(*) FROM tenant_probe_records;",
].join("\n");

const controlsSql = [
  "SELECT 'rls=' || CASE WHEN count(*) = 5 AND bool_and(relrowsecurity AND relforcerowsecurity) THEN 'ok' ELSE 'fail' END",
  "  FROM pg_class WHERE relname IN ('memberships', 'role_assignments', 'support_elevations', 'outbox_messages', 'tenant_probe_records');",
  "SELECT 'policies=' || CASE WHEN count(*) = 5 THEN 'ok' ELSE 'fail' END",
  "  FROM pg_policies WHERE tablename IN ('memberships', 'role_assignments', 'support_elevations', 'outbox_messages', 'tenant_probe_records');",
  "SELECT 'ownership=' || CASE WHEN bool_and(c.relowner = r.oid) THEN 'ok' ELSE 'fail' END",
  "  FROM pg_class c JOIN pg_roles r ON r.rolname = 'admission_migrator'",
  "  WHERE c.relname IN ('memberships', 'role_assignments', 'support_elevations', 'outbox_messages', 'tenant_probe_records');",
].join("\n");

const rlsSql = [
  "BEGIN;",
  "SELECT set_config('admission.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);",
  "SELECT 'tenant_a_visible=' || count(*) FROM tenant_probe_records WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';",
  "SELECT 'cross_tenant_visible=' || count(*) FROM tenant_probe_records WHERE tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';",
  "COMMIT;",
].join("\n");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: options.input === undefined ? "inherit" : ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (options.input !== undefined) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.stdin.end(options.input);
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else {
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

async function capture(args) {
  const result = await execFile("docker", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  return result.stdout.trim();
}

async function containerState(service) {
  const id = await capture([...composeArgs, "ps", "-aq", service]);
  if (!id) throw new Error("Container for " + service + " was not created");
  return JSON.parse(
    await capture([
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

function psql(service, role, password, database, sql) {
  return capture([
    ...composeArgs,
    "exec",
    "-T",
    "-e",
    "PGPASSWORD=" + password,
    service,
    "psql",
    "-U",
    role,
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    sql,
  ]);
}

async function migrate(host) {
  await run("docker", [
    ...composeArgs,
    "run",
    "--build",
    "--rm",
    "--no-deps",
    "-e",
    "DATABASE_MIGRATION_URL=postgresql://admission_migrator:" +
      migratorPassword +
      "@" +
      host +
      ":5432/admission_dev",
    "migrator",
  ]);
}

function lines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const startedAt = Date.now();
  const tempDir = await mkdtemp(join(tmpdir(), "admission-e4-recovery-"));
  const backupPath = join(tempDir, "synthetic-admission.dump.sql");
  console.log("RECOVERY_SCOPE=LOCAL_DEVELOPMENT_ONLY");
  console.log(
    "RECOVERY_STRATEGY=logical_pg_dump_schema_and_data_to_isolated_database",
  );

  await run(
    "docker",
    [...composeArgs, "down", "--volumes", "--remove-orphans"],
    {
      input: "",
    },
  ).catch(() => undefined);

  try {
    await run("docker", [...composeArgs, "up", "-d", "source", "recovery"]);
    await waitForHealthy("source");
    await waitForHealthy("recovery");
    await migrate("source");
    await migrate("recovery");
    await run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "-e",
        "PGPASSWORD=" + migratorPassword,
        "source",
        "psql",
        "-U",
        "admission_migrator",
        "-d",
        "admission_dev",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
      ],
      { input: controlPlaneSql },
    );
    await run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "-e",
        "PGPASSWORD=" + appPassword,
        "source",
        "psql",
        "-U",
        "admission_app",
        "-d",
        "admission_dev",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
      ],
      { input: tenantFixtureSql },
    );

    const sourceFingerprint = lines(
      await psql(
        "source",
        "admission_migrator",
        migratorPassword,
        "admission_dev",
        fingerprintSql,
      ),
    );
    assert(
      sourceFingerprint.length === 7,
      "synthetic fixture fingerprint is incomplete",
    );

    const dump = await capture([
      ...composeArgs,
      "exec",
      "-T",
      "-e",
      "PGPASSWORD=" + bootstrapPassword,
      "source",
      "pg_dump",
      "-U",
      "admission_bootstrap",
      "-d",
      "admission_dev",
      "--format=plain",
      "--no-owner",
      "--clean",
      "--if-exists",
    ]);
    await writeFile(backupPath, dump, "utf8");
    const backupBytes = (await readFile(backupPath)).byteLength;
    assert(backupBytes > 0, "synthetic backup is empty");
    console.log("REC-01=PASS (pg_dump bytes " + backupBytes + ")");

    await run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "-e",
        "PGPASSWORD=" + migratorPassword,
        "recovery",
        "psql",
        "-U",
        "admission_migrator",
        "-d",
        "admission_dev",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
      ],
      { input: dump },
    );
    console.log("REC-02=PASS (restore into isolated recovery database)");

    const recoveryFingerprint = lines(
      await psql(
        "recovery",
        "admission_migrator",
        migratorPassword,
        "admission_dev",
        fingerprintSql,
      ),
    );
    assert(
      sourceFingerprint.join("\n") === recoveryFingerprint.join("\n"),
      "source and recovery fingerprints differ",
    );
    console.log("REC-03=PASS (synthetic fingerprints match)");

    const controls = lines(
      await psql(
        "recovery",
        "admission_migrator",
        migratorPassword,
        "admission_dev",
        controlsSql,
      ),
    );
    assert(
      controls.includes("rls=ok") &&
        controls.includes("policies=ok") &&
        controls.includes("ownership=ok"),
      "restored RLS controls are incomplete",
    );
    console.log("REC-04=PASS (RLS, policies and ownership operational)");

    const appRole = await psql(
      "recovery",
      "admission_app",
      appPassword,
      "admission_dev",
      "SELECT current_user || '|' || rolsuper || '|' || rolbypassrls FROM pg_roles WHERE rolname = current_user;",
    );
    assert(
      appRole === "admission_app|false|false",
      "runtime role controls unexpected: " + appRole,
    );
    console.log("REC-05=PASS (runtime role is not superuser/BYPASSRLS)");

    const crossTenant = lines(
      await psql(
        "recovery",
        "admission_app",
        appPassword,
        "admission_dev",
        rlsSql,
      ),
    );
    assert(
      crossTenant.includes("tenant_a_visible=1") &&
        crossTenant.includes("cross_tenant_visible=0"),
      "cross-tenant RLS check failed after restore",
    );
    console.log("REC-06=PASS (cross-tenant DENY after restore)");

    const noContext = await psql(
      "recovery",
      "admission_app",
      appPassword,
      "admission_dev",
      "SELECT 'no_context_visible=' || count(*) FROM tenant_probe_records;",
    );
    assert(
      noContext === "no_context_visible=0",
      "missing tenant context did not fail closed after restore",
    );
    console.log("REC-07=PASS (no tenant context DENY after restore)");

    const elapsedMs = Date.now() - startedAt;
    console.log("REC-08=PASS (observed elapsed " + elapsedMs + " ms)");
    console.log("RECOVERY_ELAPSED_MS=" + elapsedMs);
    console.log("RECOVERY_SMOKE=PASS");
  } finally {
    await run(
      "docker",
      [...composeArgs, "down", "--volumes", "--remove-orphans"],
      {
        input: "",
      },
    ).catch((error) => console.error("cleanup warning: " + error.message));
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
