import { spawn } from "node:child_process";
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

const root = process.cwd();
const migrationRoot = resolve(root, "packages/database/prisma/migrations");
const expected = "20260815090000_g5br_account_verification";
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (migrations.length !== 16 || migrations.at(-1) !== expected) {
  throw new Error(`Expected 16 migrations ending in ${expected}`);
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
    `.g5br-migration-${randomUUID()}.config.ts`,
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

const tempRoot = await mkdtemp(join(tmpdir(), "admission-g5br-migration-"));
const databases = [];
const configs = [];
try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 15)],
  ]) {
    const database = `admission_g5br_${label}_${randomUUID().replaceAll("-", "")}`;
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
    if (applied !== "16")
      throw new Error(`${label} applied ${applied} migrations`);
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_16" : "INCREMENTAL_15_TO_16"}=PASS`,
    );

    if (label === "incremental") {
      const seals = (
        await psql(
          container,
          database,
          `SELECT
            (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='account_verification_challenges'),
            (SELECT relrowsecurity FROM pg_class WHERE relname='account_verification_challenges'),
            (SELECT relforcerowsecurity FROM pg_class WHERE relname='account_verification_challenges'),
            has_table_privilege('admission_app', 'account_verification_challenges', 'SELECT'),
            has_table_privilege('admission_app', 'account_verification_challenges', 'INSERT'),
            has_table_privilege('admission_app', 'account_verification_challenges', 'UPDATE'),
            has_table_privilege('admission_app', 'account_verification_challenges', 'DELETE'),
            (SELECT count(*) FROM pg_constraint WHERE conrelid='account_verification_challenges'::regclass AND contype='f'),
            (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='account_verification_challenges' AND indexname IN ('account_verification_challenges_verifier_hash_key','account_verification_challenges_one_active_per_user_key')),
            (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='account_verification_challenges' AND column_name IN ('consumed_at','superseded_at','verifier_hash')),
            (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='account_verification_challenges' AND column_name IN ('token','raw_token')),
            (SELECT pg_get_userbyid(relowner)='admission_migrator' FROM pg_class WHERE relname='account_verification_challenges');`,
        )
      ).stdout.trim();
      if (seals !== "1|f|f|t|t|t|f|1|2|3|0|t") {
        throw new Error(`G5BR identity seal mismatch: ${seals}`);
      }
      console.log(
        "G5BR_IDENTITY_SEALS=PASS (hashed verifier, uniqueness, one-time fields, FK, grants and global control-plane boundary)",
      );
    }
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
