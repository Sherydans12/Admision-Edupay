import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
const expected = "20260824190000_g5p2_email_delivery_controls";
const protectedMigrations = new Map([
  [
    "20260816070000_g5pc1r12_authority_core",
    "aef202695295198be8c45a7d3f06bd179072d57580f8d32c61388f76c0849344",
  ],
  [
    "20260820090000_g5pc1r4_sensitive_processing",
    "1256ad268cf0b7a27d3f1e83a39df478b455548daaec86e49604b8a333a1ff4e",
  ],
  [
    "20260821190000_g5pc1r3_business_calendar",
    "9699ea385fcd876209206e2a026eedfb701399b7795e062858a57d6b6d7544f4",
  ],
  [
    "20260824130000_g5pc1r5_capacity_activity_policy",
    "6d71e5243e180cf5940b1db2a912736bef21e019f52a77fe7b210faad6c15955",
  ],
]);

const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .filter((migration) => migration <= expected);

if (migrations.length !== 21 || migrations.at(-1) !== expected) {
  throw new Error(`Expected 21 migrations ending in ${expected}`);
}

for (const [migration, expectedHash] of protectedMigrations) {
  const text = await readFile(
    join(migrationRoot, migration, "migration.sql"),
    "utf8",
  );
  // Git stores these migrations with LF. Normalize the checkout so the immutable-byte
  // seal is reproducible on Windows without accepting semantic content changes.
  const canonical = text.replaceAll("\r\n", "\n");
  const actualHash = createHash("sha256").update(canonical).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Protected migration ${migration} checksum changed`);
  }
}
console.log("MIGRATIONS_17_TO_20_IMMUTABLE=PASS");

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
    `.g5p2-migration-${randomUUID()}.config.ts`,
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

const tempRoot = await mkdtemp(join(tmpdir(), "admission-g5p2-migration-"));
const databases = [];
const configs = [];

try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 20)],
  ]) {
    const database = `admission_g5p2_${label}_${randomUUID().replaceAll("-", "")}`;
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
    if (applied !== "21") {
      throw new Error(`${label} applied ${applied} migrations`);
    }
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_21" : "INCREMENTAL_20_TO_21"}=PASS`,
    );

    const seals = (
      await psql(
        container,
        database,
        `SELECT
          (SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
             FROM pg_enum WHERE enumtypid='"CommunicationWebhookEventType"'::regtype),
          (SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
             FROM pg_enum WHERE enumtypid='"CommunicationSuppressionReason"'::regtype),
          (SELECT string_agg(column_name, ',' ORDER BY column_name)
             FROM information_schema.columns
            WHERE table_schema='public' AND table_name='communication_webhook_events'),
          (SELECT string_agg(column_name, ',' ORDER BY column_name)
             FROM information_schema.columns
            WHERE table_schema='public' AND table_name='communication_suppressions'),
          (SELECT count(*) FROM pg_class
            WHERE relname IN ('communication_webhook_events', 'communication_suppressions')
              AND relrowsecurity AND relforcerowsecurity),
          (SELECT count(*) FROM pg_policies
            WHERE schemaname='public'
              AND tablename IN ('communication_webhook_events', 'communication_suppressions')
              AND policyname IN ('communication_webhook_events_tenant_isolation', 'communication_suppressions_tenant_isolation')),
          (SELECT count(*) FROM pg_class
            WHERE relname IN ('communication_webhook_events', 'communication_suppressions')
              AND pg_get_userbyid(relowner)='admission_migrator'),
          has_table_privilege('admission_app', 'communication_webhook_events', 'SELECT'),
          has_table_privilege('admission_app', 'communication_webhook_events', 'INSERT'),
          has_table_privilege('admission_app', 'communication_webhook_events', 'UPDATE'),
          has_table_privilege('admission_app', 'communication_webhook_events', 'DELETE'),
          has_table_privilege('admission_app', 'communication_suppressions', 'SELECT'),
          has_table_privilege('admission_app', 'communication_suppressions', 'INSERT'),
          has_table_privilege('admission_app', 'communication_suppressions', 'UPDATE'),
          has_table_privilege('admission_app', 'communication_suppressions', 'DELETE'),
          (SELECT count(*) FROM pg_constraint
            WHERE conrelid='communication_webhook_events'::regclass
              AND conname IN ('communication_webhook_events_provider_check',
                              'communication_webhook_events_provider_event_check',
                              'communication_webhook_events_tenant_fkey',
                              'communication_webhook_events_attempt_fkey')),
          (SELECT count(*) FROM pg_constraint
            WHERE conrelid='communication_suppressions'::regclass
              AND conname IN ('communication_suppressions_hash_check',
                              'communication_suppressions_hash_version_check',
                              'communication_suppressions_tenant_fkey',
                              'communication_suppressions_source_event_fkey')),
          (SELECT count(*) FROM pg_indexes
            WHERE schemaname='public'
              AND indexname IN ('communication_attempts_provider_reference_key',
                                'communication_webhook_events_tenant_id_key',
                                'communication_webhook_events_provider_event_key',
                                'communication_webhook_events_attempt_occurred_idx',
                                'communication_suppressions_tenant_id_key',
                                'communication_suppressions_channel_key',
                                'communication_suppressions_created_idx')),
          (SELECT count(*) FROM pg_trigger
            WHERE tgrelid IN ('communication_webhook_events'::regclass,
                              'communication_suppressions'::regclass)
              AND tgname IN ('communication_webhook_events_append_only',
                             'communication_suppressions_append_only')
              AND NOT tgisinternal),
          (SELECT count(*) FROM information_schema.columns
            WHERE table_schema='public'
              AND table_name IN ('communication_webhook_events', 'communication_suppressions')
              AND column_name IN ('payload', 'headers', 'email', 'recipient_email',
                                  'subject', 'body')),
          (SELECT count(*) FROM communication_webhook_events),
          (SELECT count(*) FROM communication_suppressions);`,
      )
    ).stdout.trim();

    const expectedSeals = [
      "DELIVERED,BOUNCED,COMPLAINED",
      "BOUNCE,COMPLAINT",
      "communication_attempt_id,event_type,id,occurred_at,provider,provider_event_id,received_at,tenant_id",
      "channel_hash,hash_key_version,id,reason,source_webhook_event_id,suppressed_at,tenant_id",
      "2",
      "2",
      "2",
      "t",
      "t",
      "f",
      "f",
      "t",
      "t",
      "f",
      "f",
      "4",
      "4",
      "7",
      "2",
      "0",
      "0",
      "0",
    ].join("|");

    if (seals !== expectedSeals) {
      throw new Error(`G5-P2 migration seal mismatch: ${seals}`);
    }
    console.log(
      "G5P2_SEALS=PASS (minimal columns, enums, composite FKs, indexes, append-only, RLS/FORCE, least privilege, owners, no seeds)",
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
