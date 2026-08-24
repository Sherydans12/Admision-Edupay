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
const expected = "20260816070000_g5pc1r12_authority_core";
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .filter((migration) => migration <= expected);
if (migrations.length !== 17 || migrations.at(-1) !== expected) {
  throw new Error(`Expected 17 migrations ending in ${expected}`);
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
    `.g5pc1r12-migration-${randomUUID()}.config.ts`,
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
const tempRoot = await mkdtemp(join(tmpdir(), "admission-g5pc1r12-migration-"));
const databases = [];
const configs = [];
try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 16)],
  ]) {
    const database = `admission_g5pc1r12_${label}_${randomUUID().replaceAll("-", "")}`;
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
    if (applied !== "17")
      throw new Error(`${label} applied ${applied} migrations`);
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_17" : "INCREMENTAL_16_TO_17"}=PASS`,
    );
    const seals = (
      await psql(
        container,
        database,
        `SELECT
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='date_of_birth'),
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('application_authorities','application_authority_reviews','application_authority_evidence')),
      (SELECT count(*) FROM pg_type WHERE typname IN ('ApplicationAuthoritySubjectMode','ApplicationAuthorityRelationship','ApplicationAuthorityBasis','ApplicationAuthorityStatus')),
      (SELECT count(*) FROM pg_class WHERE relname IN ('application_authorities','application_authority_reviews','application_authority_evidence') AND relrowsecurity AND relforcerowsecurity),
      has_table_privilege('admission_app', 'application_authorities', 'SELECT'),
      has_table_privilege('admission_app', 'application_authorities', 'INSERT'),
      has_table_privilege('admission_app', 'application_authorities', 'UPDATE'),
      has_table_privilege('admission_app', 'application_authorities', 'DELETE'),
      has_table_privilege('admission_app', 'application_authority_reviews', 'INSERT'),
      has_table_privilege('admission_app', 'application_authority_reviews', 'UPDATE'),
      has_table_privilege('admission_app', 'application_authority_evidence', 'INSERT'),
      has_table_privilege('admission_app', 'application_authority_evidence', 'DELETE'),
      (SELECT count(*) FROM application_authorities WHERE status='VERIFIED'),
      (SELECT pg_get_userbyid(relowner)='admission_migrator' FROM pg_class WHERE relname='application_authorities'),
      ('admission_app' <> 'admission_migrator');`,
      )
    ).stdout.trim();
    if (seals !== "1|3|4|3|t|t|t|f|t|f|t|f|0|t|t") {
      throw new Error(`G5-PC1-R12 migration seal mismatch: ${seals}`);
    }
    console.log(
      "G5PC1R12_SEALS=PASS (DOB nullable, authority schema, RLS/FORCE, grants, distinct roles and no verified backfill)",
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
