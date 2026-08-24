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
const expected = "20260824130000_g5pc1r5_capacity_activity_policy";
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
]);
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .filter((migration) => migration <= expected);

if (migrations.length !== 20 || migrations.at(-1) !== expected) {
  throw new Error(`Expected 20 migrations ending in ${expected}`);
}
for (const [migration, expectedHash] of protectedMigrations) {
  const bytes = await readFile(join(migrationRoot, migration, "migration.sql"));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Protected migration ${migration} checksum changed`);
  }
}
console.log("MIGRATIONS_17_TO_19_BYTE_IMMUTABLE=PASS");

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
    `.g5pc1r5-migration-${randomUUID()}.config.ts`,
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

async function insertLegacyActivityVersions(container, database) {
  const tenantId = randomUUID();
  const definitionId = randomUUID();
  const draftVersionId = randomUUID();
  const publishedVersionId = randomUUID();
  await psql(
    container,
    database,
    `INSERT INTO tenants (id, name) VALUES ('${tenantId}', 'Synthetic R5 Migration Tenant');
     INSERT INTO activity_definitions (id, tenant_id, code, name, kind)
       VALUES ('${definitionId}', '${tenantId}', 'SYNTHETIC_R5', 'Synthetic R5 Activity', 'GUARDIAN_INTERVIEW');
     INSERT INTO activity_definition_versions
       (id, tenant_id, activity_definition_id, version_number, lifecycle, required, modality,
        duration_minutes, max_normal_reschedules, late_tolerance_minutes, created_at, published_at)
       VALUES
       ('${draftVersionId}', '${tenantId}', '${definitionId}', 1, 'DRAFT', false, 'IN_PERSON', 30, 2, 15, CURRENT_TIMESTAMP, NULL),
       ('${publishedVersionId}', '${tenantId}', '${definitionId}', 2, 'PUBLISHED', true, 'IN_PERSON', 60, 2, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );
  return { draftVersionId, publishedVersionId };
}

const container = (
  await run("docker", ["compose", "ps", "-q", "postgres"], { capture: true })
).stdout.trim();
if (!container) throw new Error("Local PostgreSQL container is not running");

const tempRoot = await mkdtemp(join(tmpdir(), "admission-g5pc1r5-migration-"));
const databases = [];
const configs = [];
try {
  for (const [label, selected] of [
    ["fresh", migrations],
    ["incremental", migrations.slice(0, 19)],
  ]) {
    const database = `admission_g5pc1r5_${label}_${randomUUID().replaceAll("-", "")}`;
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

    let legacy;
    if (label === "incremental") {
      legacy = await insertLegacyActivityVersions(container, database);
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
    if (applied !== "20")
      throw new Error(`${label} applied ${applied} migrations`);
    console.log(
      `${label === "fresh" ? "FRESH_0_TO_20" : "INCREMENTAL_19_TO_20"}=PASS`,
    );

    const seals = (
      await psql(
        container,
        database,
        `SELECT
          (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant_activity_policies'),
          (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='admission_offerings' AND column_name='concurrency_version'),
          (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='activity_definition_versions' AND column_name='duration_source'),
          (SELECT COALESCE(column_default, 'NULL') FROM information_schema.columns WHERE table_schema='public' AND table_name='activity_definition_versions' AND column_name='duration_source'),
          (SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid='"ActivityDurationSource"'::regtype),
          (SELECT count(*) FROM pg_class WHERE relname='tenant_activity_policies' AND relrowsecurity AND relforcerowsecurity),
          (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='tenant_activity_policies' AND policyname='tenant_activity_policies_tenant_isolation'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'SELECT'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'INSERT'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'UPDATE'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'DELETE'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'TRUNCATE'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'REFERENCES'),
          has_table_privilege('admission_app', 'tenant_activity_policies', 'TRIGGER'),
          (SELECT pg_get_userbyid(relowner)='admission_migrator' FROM pg_class WHERE relname='tenant_activity_policies'),
          (SELECT count(*) FROM pg_constraint WHERE conrelid='tenant_activity_policies'::regclass
             AND conname IN ('tenant_activity_policies_duration_check', 'tenant_activity_policies_executors_differ_check', 'tenant_activity_policies_version_check')),
          (SELECT count(*) FROM pg_constraint WHERE conrelid='tenant_activity_policies'::regclass
             AND conname IN ('tenant_activity_policies_tenant_fkey', 'tenant_activity_policies_primary_membership_fkey', 'tenant_activity_policies_backup_membership_fkey')),
          (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='tenant_activity_policies'
             AND indexname IN ('tenant_activity_policies_tenant_id_key', 'tenant_activity_policies_tenant_kind_key', 'tenant_activity_policies_primary_membership_idx', 'tenant_activity_policies_backup_membership_idx')),
          (SELECT position('duration_source' IN pg_get_functiondef('admission_guard_activity_definition_version_history()'::regprocedure)) > 0),
          (SELECT count(*) FROM tenant_activity_policies),
          (SELECT count(*) FROM admission_capacities);`,
      )
    ).stdout.trim();
    if (
      seals !==
      "1|1|NO|NULL|TENANT_KIND_DEFAULT,VERSION_OVERRIDE|1|1|t|t|t|t|f|f|f|t|3|3|4|t|0|0"
    ) {
      throw new Error(`G5-PC1-R5 migration seal mismatch: ${seals}`);
    }
    console.log(
      "G5PC1R5_SEALS=PASS (columns, enum, constraints, composite FKs, indexes, history guard, RLS/FORCE, least privilege, owner, no policy/capacity seed)",
    );

    if (legacy) {
      const legacyRows = (
        await psql(
          container,
          database,
          `SELECT id, duration_minutes, duration_source
           FROM activity_definition_versions
           WHERE id IN ('${legacy.draftVersionId}', '${legacy.publishedVersionId}')
           ORDER BY duration_minutes;`,
        )
      ).stdout.trim();
      const expectedRows = `${legacy.draftVersionId}|30|VERSION_OVERRIDE\n${legacy.publishedVersionId}|60|VERSION_OVERRIDE`;
      if (legacyRows !== expectedRows) {
        throw new Error(
          `Legacy duration/source compatibility mismatch: ${legacyRows}`,
        );
      }
      console.log(
        "LEGACY_DURATION_BACKFILL=PASS (minutes preserved, source=VERSION_OVERRIDE)",
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
