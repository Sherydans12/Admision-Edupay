import { randomUUID } from "node:crypto";
import {
  cp,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const migrationRoot = resolve(root, "packages/database/prisma/migrations");
const e5cBaseMigration = "20260810120000_e5c_documents_assisted";
const e5cHardeningMigration =
  "20260810150000_e5c_review_job_assistance_hardening";
const e5dMigration = "20260810180000_e5d_activities";
const databaseName = `admission_e5c_${randomUUID().replaceAll("-", "")}`;
const temporaryRoot = await mkdtemp(join(tmpdir(), "admission-e5c-migration-"));
const temporaryPrisma = join(temporaryRoot, "prisma");
const temporaryConfig = resolve(
  root,
  "packages/database",
  `.e5c-migration-${randomUUID()}.config.ts`,
);

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
    child.once("exit", (code) => {
      if (code === 0) resolvePromise({ stderr, stdout });
      else
        reject(new Error(`${command} exited ${code ?? "unknown"}\n${stderr}`));
    });
  });
}

async function dockerPsql(containerId, database, sql) {
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

let databaseCreated = false;
try {
  const container = await run("docker", ["compose", "ps", "-q", "postgres"], {
    capture: true,
  });
  const containerId = container.stdout.trim();
  if (!containerId)
    throw new Error("Local PostgreSQL container is not running");

  await run("docker", [
    "exec",
    containerId,
    "createdb",
    "-U",
    "admission_bootstrap",
    "-O",
    "admission_migrator",
    databaseName,
  ]);
  databaseCreated = true;
  await dockerPsql(
    containerId,
    databaseName,
    "GRANT ALL ON SCHEMA public TO admission_migrator;",
  );

  const envText = await readFile(resolve(root, ".env"), "utf8");
  const migrationLine = envText
    .split(/\r?\n/u)
    .find((line) => line.startsWith("DATABASE_MIGRATION_URL="));
  if (!migrationLine)
    throw new Error("DATABASE_MIGRATION_URL is missing from .env");
  const baseUrl = new URL(
    migrationLine.slice("DATABASE_MIGRATION_URL=".length),
  );
  baseUrl.pathname = `/${databaseName}`;

  const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const e5cBaseIndex = migrations.indexOf(e5cBaseMigration);
  const hardeningIndex = migrations.indexOf(e5cHardeningMigration);
  const e5dIndex = migrations.indexOf(e5dMigration);
  if (
    migrations.length !== 9 ||
    e5cBaseIndex !== 6 ||
    hardeningIndex !== 7 ||
    e5dIndex !== 8
  ) {
    throw new Error(
      "E5-C base/hardening must remain migrations 7/8 and E5-D must follow as migration 9",
    );
  }

  await mkdir(join(temporaryPrisma, "migrations"), { recursive: true });
  await cp(
    resolve(root, "packages/database/prisma/schema.prisma"),
    join(temporaryPrisma, "schema.prisma"),
  );
  for (const migration of migrations.slice(0, hardeningIndex)) {
    await cp(
      join(migrationRoot, migration),
      join(temporaryPrisma, "migrations", migration),
      {
        recursive: true,
      },
    );
  }
  await writeFile(
    temporaryConfig,
    [
      'import { defineConfig, env } from "prisma/config";',
      "export default defineConfig({",
      '  datasource: { url: env("DATABASE_MIGRATION_URL") },',
      `  migrations: { path: ${JSON.stringify(join(temporaryPrisma, "migrations"))} },`,
      `  schema: ${JSON.stringify(join(temporaryPrisma, "schema.prisma"))},`,
      "});",
      "",
    ].join("\n"),
    "utf8",
  );

  const deploy = () =>
    run(
      "pnpm",
      [
        "--dir",
        "packages/database",
        "exec",
        "prisma",
        "migrate",
        "deploy",
        "--config",
        temporaryConfig,
      ],
      { env: { DATABASE_MIGRATION_URL: baseUrl.toString() } },
    );

  await deploy();
  console.log(`E5C_SEVEN_MIGRATION_BASE=PASS (${hardeningIndex})`);
  await cp(
    join(migrationRoot, e5cHardeningMigration),
    join(temporaryPrisma, "migrations", e5cHardeningMigration),
    { recursive: true },
  );
  await deploy();

  const verification = await dockerPsql(
    containerId,
    databaseName,
    `SELECT
      (to_regclass('public.document_versions_submission_id_key') IS NOT NULL)::int
      + count(*)
    FROM pg_constraint
    WHERE conname IN (
      'document_reviews_version_fkey',
      'document_versions_replaces_fkey',
      'document_versions_replaces_not_self_check'
    )
      AND convalidated;`,
  );
  if (verification.stdout.trim() !== "4") {
    throw new Error(
      "E5-C composite FKs, replacement check and supporting unique index were not verified",
    );
  }
  console.log("E5C_INCREMENTAL_MIGRATION=PASS (7->8, four DB seals verified)");
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
  await rm(temporaryConfig, { force: true });
  if (databaseCreated) {
    const container = await run("docker", ["compose", "ps", "-q", "postgres"], {
      capture: true,
    }).catch(() => ({ stdout: "" }));
    const containerId = container.stdout.trim();
    if (containerId) {
      await run("docker", [
        "exec",
        containerId,
        "dropdb",
        "-U",
        "admission_bootstrap",
        "--force",
        databaseName,
      ]).catch((error) => console.error(`cleanup warning: ${error.message}`));
    }
  }
}
