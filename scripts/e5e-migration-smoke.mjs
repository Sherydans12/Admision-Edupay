import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const root = process.cwd();
const migrationRoot = resolve(root, "packages/database/prisma/migrations");
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const expectedMigration = "20260811090000_e5e_recommendation_decision";
if (migrations.length !== 11 || migrations.at(-1) !== expectedMigration) {
  throw new Error(`Expected 11 migrations ending in ${expectedMigration}`);
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

async function createConfig(tempRoot, selectedMigrations, database) {
  const prismaRoot = join(tempRoot, "prisma");
  await mkdir(join(prismaRoot, "migrations"), { recursive: true });
  await cp(
    resolve(root, "packages/database/prisma/schema.prisma"),
    join(prismaRoot, "schema.prisma"),
  );
  await Promise.all(
    selectedMigrations.map((migration) =>
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
    `.e5e-migration-${randomUUID()}.config.ts`,
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
  return { config, url: url.toString() };
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
    {
      env: { DATABASE_MIGRATION_URL: url },
    },
  );
}

const container = (
  await run("docker", ["compose", "ps", "-q", "postgres"], { capture: true })
).stdout.trim();
if (!container) throw new Error("Local PostgreSQL container is not running");
const tempRoot = await mkdtemp(join(tmpdir(), "admission-e5e-migration-"));
const databases = [];
try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 10)],
  ]) {
    const database = `admission_e5e_${label}_${randomUUID().replaceAll("-", "")}`;
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
    const first = await createConfig(join(tempRoot, label), selected, database);
    await deploy(first.config, first.url);
    if (label === "incremental") {
      const second = await createConfig(
        join(tempRoot, `${label}-final`),
        migrations,
        database,
      );
      await deploy(second.config, second.url);
    }
    const applied = (
      await psql(
        container,
        database,
        "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;",
      )
    ).stdout.trim();
    if (applied !== "11")
      throw new Error(`${label} migration proof applied ${applied} migrations`);
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_11" : "INCREMENTAL_10_TO_11"}=PASS`,
    );
    if (label === "incremental") {
      const seals = (
        await psql(
          container,
          database,
          `SELECT
        (SELECT count(*) FROM information_schema.tables WHERE table_name IN ('admission_recommendations','admission_recommendation_versions','direction_decisions','direction_decision_versions')),
        (SELECT count(*) FROM pg_type WHERE typname IN ('AdmissionRecommendationOption','RecommendationVersionLifecycle','DirectionDisposition')),
        (SELECT count(*) FROM pg_class WHERE relname IN ('admission_recommendations','admission_recommendation_versions','direction_decisions','direction_decision_versions') AND relrowsecurity AND relforcerowsecurity),
        (SELECT count(*) FROM pg_trigger WHERE tgname IN ('admission_recommendation_versions_append_only','direction_decision_versions_append_only')),
        (SELECT count(*) FROM pg_constraint WHERE conname IN (
          'admission_recommendations_tenant_fkey','admission_recommendations_application_fkey','admission_recommendations_current_version_fkey',
          'admission_recommendation_versions_tenant_fkey','admission_recommendation_versions_recommendation_fkey','admission_recommendation_versions_application_fkey','admission_recommendation_versions_previous_same_root_fkey','admission_recommendation_versions_version_check','admission_recommendation_versions_lifecycle_check','admission_recommendation_versions_previous_not_self_check',
          'direction_decisions_tenant_fkey','direction_decisions_application_fkey','direction_decisions_current_version_fkey',
          'direction_decision_versions_tenant_fkey','direction_decision_versions_decision_fkey','direction_decision_versions_application_fkey','direction_decision_versions_recommendation_fkey','direction_decision_versions_previous_same_root_fkey','direction_decision_versions_version_check','direction_decision_versions_disposition_check','direction_decision_versions_previous_not_self_check'))`,
        )
      ).stdout.trim();
      if (seals !== "4|3|4|2|21")
        throw new Error(`E5-E DB seals mismatch: ${seals}`);
      console.log(
        "E5E_DB_SEALS=PASS (tables, enums, RLS/FORCE, append-only triggers, tenant-safe constraints)",
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
