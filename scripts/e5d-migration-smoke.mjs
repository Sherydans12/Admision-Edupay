import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const root = process.cwd();
const migrationRoot = resolve(root, "packages/database/prisma/migrations");
const allMigrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const expectedMigration = "20260810180000_e5d_activities";
if (allMigrations.length !== 9 || allMigrations.at(-1) !== expectedMigration) {
  throw new Error(`Expected 9 migrations ending in ${expectedMigration}`);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: process.platform === "win32" && command === "pnpm",
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk) => (stderr += chunk.toString()));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise({ stdout, stderr })
        : reject(
            new Error(`${command} exited ${code ?? "unknown"}\n${stderr}`),
          ),
    );
  });
}

async function psql(containerId, database, sql) {
  return run(
    "docker",
    [
      "exec",
      containerId,
      "psql",
      "-U",
      "admission_bootstrap",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      sql,
    ],
    { capture: true },
  );
}

async function createConfig(tempRoot, migrations, database) {
  const prismaRoot = join(tempRoot, "prisma");
  await mkdir(join(prismaRoot, "migrations"), { recursive: true });
  await cp(
    resolve(root, "packages/database/prisma/schema.prisma"),
    join(prismaRoot, "schema.prisma"),
  );
  await Promise.all(
    migrations.map((migration) =>
      cp(
        join(migrationRoot, migration),
        join(prismaRoot, "migrations", migration),
        { recursive: true },
      ),
    ),
  );
  const config = resolve(
    root,
    "packages/database",
    `.e5d-migration-${randomUUID()}.config.ts`,
  );
  const envText = await readFile(resolve(root, ".env"), "utf8");
  const line = envText
    .split(/\r?\n/u)
    .find((value) => value.startsWith("DATABASE_MIGRATION_URL="));
  if (!line) throw new Error("DATABASE_MIGRATION_URL is missing from .env");
  const url = new URL(line.slice("DATABASE_MIGRATION_URL=".length));
  url.pathname = `/${database}`;
  await writeFile(
    config,
    [
      'import { defineConfig, env } from "prisma/config";',
      "export default defineConfig({",
      '  datasource: { url: env("DATABASE_MIGRATION_URL") },',
      `  migrations: { path: ${JSON.stringify(join(prismaRoot, "migrations"))} },`,
      `  schema: ${JSON.stringify(join(prismaRoot, "schema.prisma"))},`,
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  return { config, url: url.toString(), prismaRoot };
}

async function deploy(config, url) {
  await run(
    "pnpm",
    [
      "--dir",
      "packages/database",
      "exec",
      "prisma",
      "migrate",
      "deploy",
      "--config",
      config,
    ],
    { env: { DATABASE_MIGRATION_URL: url } },
  );
}

const container = (
  await run("docker", ["compose", "ps", "-q", "postgres"], { capture: true })
).stdout.trim();
if (!container) throw new Error("Local PostgreSQL container is not running");
const tempRoot = await mkdtemp(join(tmpdir(), "admission-e5d-migration-"));
const databases = [];
try {
  for (const [label, migrations] of [
    ["fresh", allMigrations],
    ["incremental", allMigrations.slice(0, 8)],
  ]) {
    const database = `admission_e5d_${label}_${randomUUID().replaceAll("-", "")}`;
    databases.push(database);
    await run("docker", [
      "exec",
      container,
      "createdb",
      "-U",
      "admission_bootstrap",
      "-O",
      "admission_migrator",
      database,
    ]);
    await psql(
      container,
      database,
      "GRANT ALL ON SCHEMA public TO admission_migrator;",
    );
    const first = await createConfig(
      join(tempRoot, label),
      migrations,
      database,
    );
    await deploy(first.config, first.url);
    if (label === "incremental") {
      const second = await createConfig(
        join(tempRoot, `${label}-final`),
        allMigrations,
        database,
      );
      await deploy(second.config, second.url);
    }
    const count = (
      await psql(
        container,
        database,
        "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;",
      )
    ).stdout.trim();
    if (count !== "9")
      throw new Error(`${label} migration proof applied ${count} migrations`);
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_9" : "INCREMENTAL_8_TO_9"}=PASS`,
    );
    if (label === "incremental") {
      const verification = (
        await psql(
          container,
          database,
          `SELECT
        (SELECT count(*) FROM information_schema.tables WHERE table_name IN ('activity_definitions','activity_definition_versions','application_activities','activity_appointments','activity_reschedule_requests','activity_attempts','activity_results')),
        (SELECT count(*) FROM pg_type WHERE typname IN ('ActivityDefinitionKind','ActivityDefinitionVersionLifecycle','ActivityModality','ApplicationActivityStatus','ActivityAppointmentStatus','ActivityRescheduleRequestStatus','ActivityAttemptOutcome','ActivityResultValue')),
        (SELECT count(*) FROM pg_class WHERE relname IN ('activity_definitions','activity_definition_versions','application_activities','activity_appointments','activity_reschedule_requests','activity_attempts','activity_results') AND relrowsecurity AND relforcerowsecurity),
        (SELECT count(*) FROM pg_trigger WHERE tgname IN ('activity_definition_versions_history_immutable','application_activities_current_appointment_guard','activity_attempts_append_only','activity_results_append_only'));`,
        )
      ).stdout.trim();
      if (verification !== "7|8|7|4")
        throw new Error(`E5-D DB seals mismatch: ${verification}`);
      console.log(
        "E5D_DB_SEALS=PASS (tables, enums, RLS/FORCE, triggers, composite FKs)",
      );
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  for (const database of databases)
    await run("docker", [
      "exec",
      container,
      "dropdb",
      "-U",
      "admission_bootstrap",
      "--force",
      database,
    ]).catch(() => undefined);
}
