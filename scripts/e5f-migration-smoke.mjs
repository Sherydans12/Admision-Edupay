import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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

const root = process.cwd();
const migrationRoot = resolve(root, "packages/database/prisma/migrations");
const expectedMigration = "20260811180000_e5f_capacity_waitlist_offers";
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .filter((migration) => migration <= expectedMigration);
if (migrations.length !== 12 || migrations.at(-1) !== expectedMigration) {
  throw new Error(`Expected 12 migrations ending in ${expectedMigration}`);
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
    `.e5f-migration-${randomUUID()}.config.ts`,
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
    { env: { DATABASE_MIGRATION_URL: url } },
  );
}

const container = (
  await run("docker", ["compose", "ps", "-q", "postgres"], { capture: true })
).stdout.trim();
if (!container) throw new Error("Local PostgreSQL container is not running");
const tempRoot = await mkdtemp(join(tmpdir(), "admission-e5f-migration-"));
const databases = [];
try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 11)],
  ]) {
    const database = `admission_e5f_${label}_${randomUUID().replaceAll("-", "")}`;
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
    if (applied !== "12") {
      throw new Error(`${label} migration proof applied ${applied} migrations`);
    }
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_12" : "INCREMENTAL_11_TO_12"}=PASS`,
    );
    if (label === "incremental") {
      const tables = [
        "admission_capacities",
        "admission_capacity_adjustments",
        "seat_reservations",
        "waitlist_entries",
        "admission_offers",
        "admission_offer_versions",
        "offer_acceptances",
        "application_withdrawals",
      ];
      const tableList = tables.map((table) => `'${table}'`).join(",");
      const seals = (
        await psql(
          container,
          database,
          `SELECT
            (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN (${tableList})),
            (SELECT count(*) FROM pg_type WHERE typname IN ('SeatReservationState','WaitlistEntryState','AdmissionOfferOrigin','AdmissionOfferLifecycle','AdmissionOfferTerminalReason')),
            (SELECT count(*) FROM pg_class WHERE relname IN (${tableList}) AND relrowsecurity AND relforcerowsecurity),
            (SELECT count(*) FROM pg_trigger WHERE tgname IN ('admission_capacity_adjustments_append_only','offer_acceptances_append_only','application_withdrawals_append_only','seat_reservations_history_guard','waitlist_entries_history_guard','admission_offer_versions_history_guard')),
            (SELECT count(*) FROM pg_class WHERE relname IN (${tableList}) AND pg_get_userbyid(relowner)='admission_migrator'),
            (SELECT count(*) FROM unnest(ARRAY[${tableList}]) AS t(name) WHERE has_table_privilege('admission_app', name, 'SELECT') AND has_table_privilege('admission_app', name, 'INSERT')),
            (SELECT count(*) FROM unnest(ARRAY[${tableList}]) AS t(name) WHERE has_table_privilege('admission_app', name, 'DELETE'))`,
        )
      ).stdout.trim();
      if (seals !== "8|5|8|6|8|8|0") {
        throw new Error(`E5-F DB seals mismatch: ${seals}`);
      }
      console.log(
        "E5F_DB_SEALS=PASS (tables, enums, RLS/FORCE, history guards, ownership, minimum grants)",
      );
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  for (const database of databases) {
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
}
