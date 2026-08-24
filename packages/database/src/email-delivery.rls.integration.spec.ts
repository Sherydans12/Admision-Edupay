import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const admin = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 2,
});

type Fixture = {
  actorId: string;
  applicationId: string;
  attemptId: string;
  eventId: string;
  suppressionId: string;
  tenantId: string;
};

function context(fixture: Pick<Fixture, "actorId" | "tenantId">) {
  return {
    actorId: fixture.actorId,
    capabilities: ["communication.read"],
    contextOrigin: "synthetic_test",
    correlationId: `g5p2-rls-${randomUUID()}`,
    effectiveActorId: fixture.actorId,
    purpose: "G5P2_EMAIL_DELIVERY_RLS_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId: fixture.tenantId,
  } satisfies TenantExecutionContext;
}

async function seedTenant(
  suffix: string,
  channelHash: string,
): Promise<Fixture> {
  const fixture = {
    actorId: randomUUID(),
    applicationId: randomUUID(),
    attemptId: randomUUID(),
    eventId: randomUUID(),
    suppressionId: randomUUID(),
    tenantId: randomUUID(),
  };
  const profileId = randomUUID();
  const studentId = randomUUID();
  const campusId = randomUUID();
  const academicYearId = randomUUID();
  const courseLevelId = randomUUID();
  const processId = randomUUID();
  const formDefinitionId = randomUUID();
  const formVersionId = randomUUID();
  const offeringId = randomUUID();
  const communicationId = randomUUID();

  await admin.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    fixture.tenantId,
    `G5-P2 RLS Tenant ${suffix}`,
  ]);
  await admin.query(
    "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
    [fixture.actorId, `g5p2-rls-${suffix}-${fixture.actorId}@example.invalid`],
  );
  await admin.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [profileId, fixture.actorId, `Synthetic family ${suffix}`],
  );
  await admin.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [studentId, profileId, "Synthetic", suffix],
  );

  await runWithTenantContext(context(fixture), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const execute = (sql: string, ...params: unknown[]) =>
        transaction.$executeRawUnsafe(sql, ...params);

      await execute(
        "INSERT INTO campuses (id, tenant_id, code, name) VALUES ($1, $2, $3, $4)",
        campusId,
        fixture.tenantId,
        `G5P2-C-${suffix}`,
        `Synthetic campus ${suffix}`,
      );
      await execute(
        "INSERT INTO academic_years (id, tenant_id, code, label, status) VALUES ($1, $2, $3, $4, 'OPEN')",
        academicYearId,
        fixture.tenantId,
        `G5P2-Y-${suffix}`,
        `Synthetic year ${suffix}`,
      );
      await execute(
        "INSERT INTO course_levels (id, tenant_id, code, name) VALUES ($1, $2, $3, $4)",
        courseLevelId,
        fixture.tenantId,
        `G5P2-L-${suffix}`,
        `Synthetic level ${suffix}`,
      );
      await execute(
        "INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status) VALUES ($1, $2, $3, $4, $5, 'DRAFT')",
        processId,
        fixture.tenantId,
        academicYearId,
        `G5P2-P-${suffix}`,
        `Synthetic process ${suffix}`,
      );
      await execute(
        "INSERT INTO form_definitions (id, tenant_id, name, purpose) VALUES ($1, $2, $3, 'admission')",
        formDefinitionId,
        fixture.tenantId,
        `Synthetic form ${suffix}`,
      );
      await execute(
        "INSERT INTO form_versions (id, tenant_id, form_definition_id, version_number, lifecycle, published_at) VALUES ($1, $2, $3, 1, 'PUBLISHED', CURRENT_TIMESTAMP)",
        formVersionId,
        fixture.tenantId,
        formDefinitionId,
      );
      await execute(
        `INSERT INTO admission_offerings
           (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id,
            form_version_id, code, title, status, availability_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT', 'PROCESS_CLOSED')`,
        offeringId,
        fixture.tenantId,
        campusId,
        academicYearId,
        processId,
        courseLevelId,
        formVersionId,
        `G5P2-O-${suffix}`,
        `Synthetic offering ${suffix}`,
      );
      await execute(
        `INSERT INTO applications
           (id, tenant_id, family_profile_id, student_id, academic_year_id, process_id,
            offering_id, form_version_id, status, draft_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', '{}')`,
        fixture.applicationId,
        fixture.tenantId,
        profileId,
        studentId,
        academicYearId,
        processId,
        offeringId,
        formVersionId,
      );
      await execute(
        `INSERT INTO communications
           (id, tenant_id, application_id, purpose, audience, template_key,
            template_version, lifecycle, recipient_email, subject, body, payload_snapshot)
         VALUES ($1, $2, $3, 'ADMISSION_APPROVED', 'FAMILY', 'synthetic', 1,
                 'SENT', $4, 'Synthetic subject', 'Synthetic body', '{}')`,
        communicationId,
        fixture.tenantId,
        fixture.applicationId,
        `recipient-${suffix}@example.invalid`,
      );
      await execute(
        `INSERT INTO communication_attempts
           (id, tenant_id, communication_id, sequence, provider, technical_status,
            provider_reference, attempted_at, completed_at, delivery_evidence)
         VALUES ($1, $2, $3, 1, 'RESEND', 'SENT', $4, CURRENT_TIMESTAMP,
                 CURRENT_TIMESTAMP, '{}')`,
        fixture.attemptId,
        fixture.tenantId,
        communicationId,
        `resend-message-${suffix}-${randomUUID()}`,
      );
      await execute(
        `INSERT INTO communication_webhook_events
           (id, tenant_id, communication_attempt_id, provider, provider_event_id,
            event_type, occurred_at)
         VALUES ($1, $2, $3, 'RESEND', $4, 'BOUNCED', CURRENT_TIMESTAMP)`,
        fixture.eventId,
        fixture.tenantId,
        fixture.attemptId,
        `resend-event-${suffix}-${randomUUID()}`,
      );
      await execute(
        `INSERT INTO communication_suppressions
           (id, tenant_id, channel_hash, hash_key_version, reason,
            source_webhook_event_id)
         VALUES ($1, $2, $3, 1, 'BOUNCE', $4)`,
        fixture.suppressionId,
        fixture.tenantId,
        channelHash,
        fixture.eventId,
      );
    }),
  );

  return fixture;
}

describe.sequential("G5-P2 email delivery RLS and database seals", () => {
  let tenantA: Fixture;
  let tenantB: Fixture;

  beforeAll(async () => {
    tenantA = await seedTenant("A", "a".repeat(64));
    tenantB = await seedTenant("B", "b".repeat(64));
  });

  it("G5P2-RLS-01..02: a tenant sees only its events and suppressions", async () => {
    const rows = await runWithTenantContext(context(tenantA), () =>
      withTenantTransaction(prisma, async (transaction) => ({
        events: await transaction.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          "SELECT tenant_id FROM communication_webhook_events ORDER BY id",
        ),
        suppressions: await transaction.$queryRawUnsafe<
          Array<{ tenant_id: string }>
        >("SELECT tenant_id FROM communication_suppressions ORDER BY id"),
      })),
    );

    expect(rows.events).toEqual([{ tenant_id: tenantA.tenantId }]);
    expect(rows.suppressions).toEqual([{ tenant_id: tenantA.tenantId }]);
  });

  it("G5P2-RLS-03: missing tenant context exposes no delivery-control rows", async () => {
    const events = await prisma.$queryRawUnsafe<unknown[]>(
      "SELECT id FROM communication_webhook_events",
    );
    const suppressions = await prisma.$queryRawUnsafe<unknown[]>(
      "SELECT id FROM communication_suppressions",
    );

    expect(events).toEqual([]);
    expect(suppressions).toEqual([]);
  });

  it("G5P2-RLS-04: explicit cross-tenant reads return no rows", async () => {
    const rows = await runWithTenantContext(context(tenantA), () =>
      withTenantTransaction(prisma, async (transaction) => ({
        events: await transaction.$queryRawUnsafe<unknown[]>(
          "SELECT id FROM communication_webhook_events WHERE tenant_id = $1",
          tenantB.tenantId,
        ),
        suppressions: await transaction.$queryRawUnsafe<unknown[]>(
          "SELECT id FROM communication_suppressions WHERE tenant_id = $1",
          tenantB.tenantId,
        ),
      })),
    );

    expect(rows).toEqual({ events: [], suppressions: [] });
  });

  it("G5P2-RLS-05..06: composite FKs reject cross-tenant attempt and event links", async () => {
    await expect(
      runWithTenantContext(context(tenantA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.$executeRawUnsafe(
            `INSERT INTO communication_webhook_events
               (id, tenant_id, communication_attempt_id, provider, provider_event_id,
                event_type, occurred_at)
             VALUES ($1, $2, $3, 'RESEND', $4, 'DELIVERED', CURRENT_TIMESTAMP)`,
            randomUUID(),
            tenantA.tenantId,
            tenantB.attemptId,
            `cross-attempt-${randomUUID()}`,
          ),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      runWithTenantContext(context(tenantA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.$executeRawUnsafe(
            `INSERT INTO communication_suppressions
               (id, tenant_id, channel_hash, hash_key_version, reason,
                source_webhook_event_id)
             VALUES ($1, $2, $3, 1, 'COMPLAINT', $4)`,
            randomUUID(),
            tenantA.tenantId,
            "c".repeat(64),
            tenantB.eventId,
          ),
        ),
      ),
    ).rejects.toThrow();
  });

  it("G5P2-RLS-07: forged tenant inserts fail closed", async () => {
    await expect(
      runWithTenantContext(context(tenantA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.$executeRawUnsafe(
            `INSERT INTO communication_webhook_events
               (id, tenant_id, communication_attempt_id, provider, provider_event_id,
                event_type, occurred_at)
             VALUES ($1, $2, $3, 'RESEND', $4, 'DELIVERED', CURRENT_TIMESTAMP)`,
            randomUUID(),
            tenantB.tenantId,
            tenantB.attemptId,
            `forged-tenant-${randomUUID()}`,
          ),
        ),
      ),
    ).rejects.toThrow();
  });

  it("G5P2-RLS-08..09: event and suppression rows are append-only", async () => {
    for (const [table, id] of [
      ["communication_webhook_events", tenantA.eventId],
      ["communication_suppressions", tenantA.suppressionId],
    ] as const) {
      await expect(
        runWithTenantContext(context(tenantA), () =>
          withTenantTransaction(prisma, (transaction) =>
            transaction.$executeRawUnsafe(
              `UPDATE ${table} SET tenant_id = tenant_id WHERE id = $1`,
              id,
            ),
          ),
        ),
      ).rejects.toThrow();
      await expect(
        runWithTenantContext(context(tenantA), () =>
          withTenantTransaction(prisma, (transaction) =>
            transaction.$executeRawUnsafe(
              `DELETE FROM ${table} WHERE id = $1`,
              id,
            ),
          ),
        ),
      ).rejects.toThrow();
    }
  });

  it("G5P2-RLS-10: FORCE RLS, owner and least-privilege grants are sealed", async () => {
    const tables = [
      "communication_suppressions",
      "communication_webhook_events",
    ];
    const seals = await admin.query<{
      relforcerowsecurity: boolean;
      relname: string;
      relowner: string;
      relrowsecurity: boolean;
    }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
              pg_get_userbyid(c.relowner) AS relowner
       FROM pg_class c
       WHERE c.relname = ANY($1::text[])
       ORDER BY c.relname`,
      [tables],
    );
    expect(seals.rows).toEqual(
      tables.map((relname) => ({
        relforcerowsecurity: true,
        relname,
        relowner: "admission_migrator",
        relrowsecurity: true,
      })),
    );

    for (const table of tables) {
      const grants = await admin.query<{ privilege_type: string }>(
        `SELECT privilege_type
         FROM information_schema.role_table_grants
         WHERE grantee = 'admission_app'
           AND table_schema = 'public'
           AND table_name = $1
         ORDER BY privilege_type`,
        [table],
      );
      expect(grants.rows.map((row) => row.privilege_type)).toEqual([
        "INSERT",
        "SELECT",
      ]);
    }
  });

  afterAll(async () => {
    // Published historical fixtures are intentionally immutable. Their random synthetic
    // identifiers prevent collisions across reruns, matching the other history suites.
    await prisma.$disconnect();
    await admin.end();
  });
});
