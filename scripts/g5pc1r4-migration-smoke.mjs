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
const expected = "20260820090000_g5pc1r4_sensitive_processing";
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (migrations.length !== 18 || migrations.at(-1) !== expected) {
  throw new Error(`Expected 18 migrations ending in ${expected}`);
}
if (migrations[16] !== "20260816070000_g5pc1r12_authority_core") {
  throw new Error("Migration 17 has been modified");
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
        ? resolvePromise({ stderr, stdout })
        : reject(
            new Error(`${command} exited ${code ?? "unknown"}\n${stderr}`),
          ),
    );
  });
}

async function psql(container, database, sql) {
  return run(
    "docker",
    [
      "exec",
      container,
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

async function createConfig(tempRoot, selected, database) {
  const prismaRoot = join(tempRoot, "prisma");
  await mkdir(join(prismaRoot, "migrations"), { recursive: true });
  await cp(
    resolve(root, "packages/database/prisma/schema.prisma"),
    join(prismaRoot, "schema.prisma"),
  );
  await Promise.all(
    selected.map((migration) =>
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
    `.g5pc1r4-migration-${randomUUID()}.config.ts`,
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
const tempRoot = await mkdtemp(join(tmpdir(), "admission-g5pc1r4-migration-"));
const databases = [];
const configs = [];
try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 17)],
  ]) {
    const database = `admission_g5pc1r4_${label}_${randomUUID().replaceAll("-", "")}`;
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
    configs.push(first.config);
    await deploy(first.config, first.url);
    if (label === "incremental") {
      const final = await createConfig(
        join(tempRoot, `${label}-final`),
        migrations,
        database,
      );
      configs.push(final.config);
      await deploy(final.config, final.url);
    }
    const applied = (
      await psql(
        container,
        database,
        "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;",
      )
    ).stdout.trim();
    if (applied !== "18")
      throw new Error(`${label} applied ${applied} migrations`);
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_18" : "INCREMENTAL_17_TO_18"}=PASS`,
    );

    const seals = (
      await psql(
        container,
        database,
        `SELECT
      (SELECT count(*) FROM pg_type WHERE typname = 'ProcessingCategory'),
      (SELECT count(*) FROM pg_type WHERE typname = 'DocumentClassification'),
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='form_fields' AND column_name='processing_category'),
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='document_requirement_versions' AND column_name='processing_category'),
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='document_requirement_versions' AND column_name='document_classification'),
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='sensitive_processing_policies'),
      (SELECT count(*) FROM pg_class WHERE relname='sensitive_processing_policies' AND relrowsecurity AND relforcerowsecurity),
      has_table_privilege('admission_app', 'sensitive_processing_policies', 'SELECT'),
      has_table_privilege('admission_app', 'sensitive_processing_policies', 'INSERT'),
      has_table_privilege('admission_app', 'sensitive_processing_policies', 'UPDATE'),
      has_table_privilege('admission_app', 'sensitive_processing_policies', 'DELETE'),
      (SELECT pg_get_userbyid(relowner)='admission_migrator' FROM pg_class WHERE relname='sensitive_processing_policies'),
      (SELECT count(*) FROM sensitive_processing_policies),
      ('admission_app' <> 'admission_migrator');`,
      )
    ).stdout.trim();
    if (seals !== "1|1|1|1|1|1|1|t|t|t|f|t|0|t") {
      throw new Error(`G5-PC1-R4 migration seal mismatch: ${seals}`);
    }
    console.log(
      "G5PC1R4_SEALS=PASS (ProcessingCategory enum, DocumentClassification enum, columns, policy table RLS/FORCE, grants, no backfill, distinct roles)",
    );
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  for (const config of configs) await rm(config, { force: true });
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
