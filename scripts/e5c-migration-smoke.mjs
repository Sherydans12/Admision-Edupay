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
const e5cMigration = "20260810120000_e5c_documents_assisted";
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
  const e5cIndex = migrations.indexOf(e5cMigration);
  if (e5cIndex !== migrations.length - 1 || e5cIndex < 1) {
    throw new Error(
      "E5-C migration must be the single forward migration after the approved base",
    );
  }

  await mkdir(join(temporaryPrisma, "migrations"), { recursive: true });
  await cp(
    resolve(root, "packages/database/prisma/schema.prisma"),
    join(temporaryPrisma, "schema.prisma"),
  );
  for (const migration of migrations.slice(0, e5cIndex)) {
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
  console.log(`APPROVED_BASE_MIGRATIONS=PASS (${e5cIndex})`);
  await cp(
    join(migrationRoot, e5cMigration),
    join(temporaryPrisma, "migrations", e5cMigration),
    { recursive: true },
  );
  await deploy();

  const verification = await dockerPsql(
    containerId,
    databaseName,
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('document_requirements','document_requirement_versions','document_submissions','document_versions','document_reviews','assistance_sessions');",
  );
  if (verification.stdout.trim() !== "6") {
    throw new Error(
      "E5-C tables were not created by the incremental migration",
    );
  }
  console.log(
    "E5C_INCREMENTAL_MIGRATION=PASS (6->7, six E5-C tables verified)",
  );
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
