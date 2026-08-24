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
const tenantA = randomUUID();
const tenantB = randomUUID();
const actorA = randomUUID();
const actorB = randomUUID();

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    contextOrigin: "synthetic_test",
    correlationId: `e5d-rls-${tenantId}`,
    purpose: "E5D_RLS_TEST",
    source: "authenticated_request",
    tenantId,
  };
}

async function seedTenant(
  tenantId: string,
  actorId: string,
  suffix: string,
): Promise<void> {
  const ids = Object.fromEntries(
    [
      "profile",
      "student",
      "campus",
      "year",
      "level",
      "process",
      "offering",
      "application",
      "definition",
      "version",
      "activity",
      "appointment",
      "request",
      "attempt",
      "result",
    ].map((key) => [key, randomUUID()]),
  ) as Record<string, string>;
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    `E5-D RLS ${suffix}`,
  ]);
  await pool.query(
    "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
    [actorId, `e5d-rls-${suffix}-${actorId}@example.invalid`],
  );
  await pool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [ids.profile, actorId, `Familia RLS ${suffix}`],
  );
  await pool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [ids.student, ids.profile, "Estudiante", suffix],
  );
  await runWithTenantContext(context(tenantId, actorId), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const execute = (sql: string, params: unknown[]) =>
        transaction.$executeRawUnsafe(sql, ...params);
      await execute(
        "INSERT INTO campuses (id, tenant_id, code, name) VALUES ($1, $2, $3, $4)",
        [ids.campus, tenantId, `E5D-RLS-CAMPUS-${suffix}`, `Sede ${suffix}`],
      );
      await execute(
        "INSERT INTO academic_years (id, tenant_id, code, label, status) VALUES ($1, $2, $3, $4, 'OPEN')",
        [ids.year, tenantId, `E5D-RLS-YEAR-${suffix}`, `Año ${suffix}`],
      );
      await execute(
        "INSERT INTO course_levels (id, tenant_id, code, name) VALUES ($1, $2, $3, $4)",
        [ids.level, tenantId, `E5D-RLS-LEVEL-${suffix}`, `Nivel ${suffix}`],
      );
      await execute(
        "INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status) VALUES ($1, $2, $3, $4, $5, 'PUBLISHED')",
        [
          ids.process,
          tenantId,
          ids.year,
          `E5D-RLS-PROCESS-${suffix}`,
          `Proceso ${suffix}`,
        ],
      );
      await execute(
        "INSERT INTO admission_offerings (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id, code, title, status, availability_category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLISHED', 'POSTULATIONS_OPEN')",
        [
          ids.offering,
          tenantId,
          ids.campus,
          ids.year,
          ids.process,
          ids.level,
          `E5D-RLS-OFFER-${suffix}`,
          `Oferta ${suffix}`,
        ],
      );
      await execute(
        "INSERT INTO applications (id, tenant_id, family_profile_id, student_id, academic_year_id, process_id, offering_id, draft_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          ids.application,
          tenantId,
          ids.profile,
          ids.student,
          ids.year,
          ids.process,
          ids.offering,
          JSON.stringify({
            acknowledgedNoGuarantee: true,
            currentStep: "REVIEW",
          }),
        ],
      );
      await execute(
        "INSERT INTO activity_definitions (id, tenant_id, code, name, kind) VALUES ($1, $2, $3, $4, 'GUARDIAN_INTERVIEW')",
        [
          ids.definition,
          tenantId,
          `E5D-RLS-ACT-${suffix}`,
          `Actividad ${suffix}`,
        ],
      );
      await execute(
        "INSERT INTO activity_definition_versions (id, tenant_id, activity_definition_id, version_number, lifecycle, required, duration_minutes, duration_source, published_at) VALUES ($1, $2, $3, 1, 'PUBLISHED', true, 30, 'VERSION_OVERRIDE', CURRENT_TIMESTAMP)",
        [ids.version, tenantId, ids.definition],
      );
      await execute(
        "INSERT INTO application_activities (id, tenant_id, application_id, activity_definition_id, activity_definition_version_id, pinned_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)",
        [ids.activity, tenantId, ids.application, ids.definition, ids.version],
      );
      await execute(
        "INSERT INTO activity_appointments (id, tenant_id, application_activity_id, sequence, scheduled_start_at, duration_minutes, location, assigned_user_id, created_by) VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP, 30, 'Sala RLS', $4, $4)",
        [ids.appointment, tenantId, ids.activity, actorId],
      );
      await execute(
        "INSERT INTO activity_reschedule_requests (id, tenant_id, application_activity_id, appointment_id, requested_by_user_id, reason) VALUES ($1, $2, $3, $4, $5, 'Motivo RLS')",
        [ids.request, tenantId, ids.activity, ids.appointment, actorId],
      );
      await execute(
        "INSERT INTO activity_attempts (id, tenant_id, application_activity_id, appointment_id, sequence, recorded_by, occurred_at, operational_outcome, no_show_justified) VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP, 'INASISTENCIA', false)",
        [ids.attempt, tenantId, ids.activity, ids.appointment, actorId],
      );
      await execute(
        "INSERT INTO activity_results (id, tenant_id, application_activity_id, attempt_id, version_number, result, recorded_by) VALUES ($1, $2, $3, $4, 1, 'INCONCLUSO', $5)",
        [ids.result, tenantId, ids.activity, ids.attempt, actorId],
      );
      await execute(
        "UPDATE application_activities SET current_appointment_id = $1 WHERE id = $2",
        [ids.appointment, ids.activity],
      );
    }),
  );
}

describe.sequential("E5-D tenant RLS", () => {
  beforeAll(async () => {
    await seedTenant(tenantA, actorA, "A");
    await seedTenant(tenantB, actorB, "B");
  });

  it("E5D-RLS-01..04: no context and tenant A cannot see or insert tenant B activity rows", async () => {
    await expect(prisma.activityDefinition.findMany()).resolves.toEqual([]);
    const visible = await runWithTenantContext(context(tenantA, actorA), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityDefinition.findMany(),
      ),
    );
    expect(visible).toHaveLength(1);
    await expect(
      runWithTenantContext(context(tenantA, actorA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityDefinition.create({
            data: {
              code: "FORGED",
              kind: "GUARDIAN_INTERVIEW",
              name: "No",
              tenantId: tenantB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("E5D-RLS-05: every E5-D table is tenant-isolated", async () => {
    const rows = await runWithTenantContext(context(tenantA, actorA), () =>
      withTenantTransaction(prisma, async (transaction) => ({
        definitions: await transaction.activityDefinition.count(),
        versions: await transaction.activityDefinitionVersion.count(),
        activities: await transaction.applicationActivity.count(),
        appointments: await transaction.activityAppointment.count(),
        requests: await transaction.activityRescheduleRequest.count(),
        attempts: await transaction.activityAttempt.count(),
        results: await transaction.activityResult.count(),
      })),
    );
    expect(rows).toEqual({
      activities: 1,
      appointments: 1,
      attempts: 1,
      definitions: 1,
      requests: 1,
      results: 1,
      versions: 1,
    });
    const crossTenantVisible = await runWithTenantContext(
      context(tenantA, actorA),
      () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityResult.findMany({ where: { tenantId: tenantB } }),
        ),
    );
    expect(crossTenantVisible).toEqual([]);
  });

  it("E5D-RLS-06: pooled connections reset tenant context between A, no-context and B", async () => {
    await expect(
      runWithTenantContext(context(tenantA, actorA), () =>
        withTenantTransaction(prisma, (transaction) =>
          transaction.activityResult.count(),
        ),
      ),
    ).resolves.toBe(1);
    await expect(prisma.activityResult.count()).resolves.toBe(0);
    const tenantBRows = await runWithTenantContext(
      context(tenantB, actorB),
      () =>
        withTenantTransaction(prisma, async (transaction) => ({
          own: await transaction.activityResult.count(),
          foreign: await transaction.activityResult.count({
            where: { tenantId: tenantA },
          }),
        })),
    );
    expect(tenantBRows).toEqual({ foreign: 0, own: 1 });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
      [tenantA, tenantB],
    ]);
    await prisma.$disconnect();
    await pool.end();
  });
});
