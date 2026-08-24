import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAppPrismaClient,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { getRequiredEnvironment } from "./environment.js";

const prisma = createAppPrismaClient();
const pool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    capabilities: [
      "communication.read",
      "communication.confirm",
      "communication.retry",
      "dashboard.read",
      "manual_contact.record",
    ],
    contextOrigin: "synthetic_test",
    correlationId: `rls-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5G_RLS_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

type TenantFixture = {
  application: string;
  attempt: string;
  campus: string;
  comm: string;
  contact: string;
  formDef: string;
  formVer: string;
  level: string;
  offering: string;
  process: string;
  profile: string;
  student: string;
  task: string;
  tenantId: string;
  user: string;
  year: string;
};

async function seedTenant(suffix: string): Promise<TenantFixture> {
  const tenantId = randomUUID();
  const ids: TenantFixture = {
    application: randomUUID(),
    attempt: randomUUID(),
    campus: randomUUID(),
    comm: randomUUID(),
    contact: randomUUID(),
    formDef: randomUUID(),
    formVer: randomUUID(),
    level: randomUUID(),
    offering: randomUUID(),
    process: randomUUID(),
    profile: randomUUID(),
    student: randomUUID(),
    task: randomUUID(),
    tenantId,
    user: randomUUID(),
    year: randomUUID(),
  };

  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    `E5-G RLS ${suffix}`,
  ]);
  await pool.query(
    "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
    [ids.user, `e5g-rls-${suffix}-${ids.user}@example.invalid`],
  );
  await pool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [ids.profile, ids.user, `Familia RLS ${suffix}`],
  );
  await pool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, 'Estudiante', $3)",
    [ids.student, ids.profile, suffix],
  );

  await runWithTenantContext(context(tenantId, ids.user), () =>
    withTenantTransaction(prisma, async (tx) => {
      const q = (sql: string, params: unknown[] = []) =>
        tx.$executeRawUnsafe(sql, ...params);

      await q(
        "INSERT INTO campuses (id, tenant_id, code, name) VALUES ($1, $2, $3, $4)",
        [ids.campus, tenantId, `E5G-C-${suffix}`, `Sede ${suffix}`],
      );
      await q(
        "INSERT INTO academic_years (id, tenant_id, code, label, status) VALUES ($1, $2, $3, $4, 'OPEN')",
        [ids.year, tenantId, `E5G-Y-${suffix}`, `Año ${suffix}`],
      );
      await q(
        "INSERT INTO course_levels (id, tenant_id, code, name) VALUES ($1, $2, $3, $4)",
        [ids.level, tenantId, `E5G-L-${suffix}`, `Nivel ${suffix}`],
      );
      await q(
        "INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status) VALUES ($1, $2, $3, $4, $5, 'PUBLISHED')",
        [
          ids.process,
          tenantId,
          ids.year,
          `E5G-P-${suffix}`,
          `Proceso ${suffix}`,
        ],
      );
      await q(
        "INSERT INTO form_definitions (id, tenant_id, name, purpose) VALUES ($1, $2, $3, 'admission')",
        [ids.formDef, tenantId, `Form ${suffix}`],
      );
      await q(
        "INSERT INTO form_versions (id, tenant_id, form_definition_id, version_number, lifecycle, published_at) VALUES ($1, $2, $3, 1, 'PUBLISHED', CURRENT_TIMESTAMP)",
        [ids.formVer, tenantId, ids.formDef],
      );
      await q(
        "INSERT INTO admission_offerings (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id, form_version_id, code, title, status, availability_category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PUBLISHED', 'POSTULATIONS_OPEN')",
        [
          ids.offering,
          tenantId,
          ids.campus,
          ids.year,
          ids.process,
          ids.level,
          ids.formVer,
          `E5G-O-${suffix}`,
          `Oferta ${suffix}`,
        ],
      );
      await q(
        "INSERT INTO applications (id, tenant_id, family_profile_id, student_id, academic_year_id, process_id, offering_id, form_version_id, status, submitted_at, draft_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUBMITTED', CURRENT_TIMESTAMP, '{}')",
        [
          ids.application,
          tenantId,
          ids.profile,
          ids.student,
          ids.year,
          ids.process,
          ids.offering,
          ids.formVer,
        ],
      );

      await q(
        `INSERT INTO communications
         (id, tenant_id, application_id, purpose, audience, template_key, template_version, lifecycle, recipient_email, subject, body, payload_snapshot)
         VALUES ($1, $2, $3, 'ADMISSION_APPROVED', 'FAMILY', 'tpl_1', 1, 'CONFIRMED', $4, 'Subject', 'Body', '{}')`,
        [
          ids.comm,
          tenantId,
          ids.application,
          `recipient-${suffix}@example.invalid`,
        ],
      );

      await q(
        `INSERT INTO communication_attempts
         (id, tenant_id, communication_id, sequence, provider, technical_status, attempted_at)
         VALUES ($1, $2, $3, 1, 'DEVELOPMENT_EMAIL_ADAPTER', 'SENT', CURRENT_TIMESTAMP)`,
        [ids.attempt, tenantId, ids.comm],
      );

      await q(
        `INSERT INTO operational_tasks
         (id, tenant_id, application_id, communication_id, type, title, description, status)
         VALUES ($1, $2, $3, $4, 'COMMUNICATION_FAILED', 'Task Title', 'Task Desc', 'PENDING')`,
        [ids.task, tenantId, ids.application, ids.comm],
      );

      await q(
        `INSERT INTO manual_contacts
         (id, tenant_id, application_id, actor_id, purpose, outcome, notes, contacted_at)
         VALUES ($1, $2, $3, $4, 'TELEPHONE_FOLLOWUP', 'CONTACT_ESTABLISHED', 'Notes', CURRENT_TIMESTAMP)`,
        [ids.contact, tenantId, ids.application, ids.user],
      );
    }),
  );

  return ids;
}

describe("E5-G Tenant RLS and Database Seals", () => {
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    tenantA = await seedTenant("A");
    tenantB = await seedTenant("B");
  });

  it("E5G-RLS-01..04: communications, attempts, tasks and contacts expose only active tenant", async () => {
    await runWithTenantContext(
      context(tenantA.tenantId, tenantA.user),
      async () => {
        const comms = await prisma.communication.findMany();
        expect(comms.every((c) => c.tenantId === tenantA.tenantId)).toBe(true);

        const attempts = await prisma.communicationAttempt.findMany();
        expect(attempts.every((a) => a.tenantId === tenantA.tenantId)).toBe(
          true,
        );

        const tasks = await prisma.operationalTask.findMany();
        expect(tasks.every((t) => t.tenantId === tenantA.tenantId)).toBe(true);

        const contacts = await prisma.manualContact.findMany();
        expect(contacts.every((c) => c.tenantId === tenantA.tenantId)).toBe(
          true,
        );
      },
    );
  });

  it("E5G-RLS-05..07: no tenant context returns empty, forged tenant inserts fail", async () => {
    const rawComms = await prisma.communication.findMany();
    expect(rawComms).toHaveLength(0);

    const rawAttempts = await prisma.communicationAttempt.findMany();
    expect(rawAttempts).toHaveLength(0);

    await expect(
      runWithTenantContext(context(tenantA.tenantId, tenantA.user), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO communications
             (id, tenant_id, application_id, purpose, audience, template_key, template_version, lifecycle, recipient_email, subject, body, payload_snapshot)
             VALUES ($1, $2, $3, 'ADMISSION_APPROVED', 'FAMILY', 'tpl_1', 1, 'PREPARED', 'a@example.invalid', 'Subj', 'Body', '{}')`,
            randomUUID(),
            tenantB.tenantId,
            tenantA.application,
          ),
        ),
      ),
    ).rejects.toThrow();
  });

  it("E5G-RLS-08: communication_attempts append-only guard prevents UPDATE and DELETE", async () => {
    await expect(
      runWithTenantContext(context(tenantA.tenantId, tenantA.user), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE communication_attempts SET provider = 'FORGED' WHERE id = $1`,
            tenantA.attempt,
          ),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      runWithTenantContext(context(tenantA.tenantId, tenantA.user), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.$executeRawUnsafe(
            `DELETE FROM communication_attempts WHERE id = $1`,
            tenantA.attempt,
          ),
        ),
      ),
    ).rejects.toThrow();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
});
