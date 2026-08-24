import { randomUUID } from "node:crypto";

import {
  buildSessionCookieOptions,
  createAppPrismaClient,
  InMemoryAuditSink,
  InMemorySecurityEventSink,
  PERMISSIONS,
  runWithTenantContext,
  SessionService,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureAdmissionApp } from "./app-bootstrap.js";
import { AppModule } from "./app.module.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 3,
});
const cookieName = buildSessionCookieOptions({ environment: "local" }).name;

type ActivityHttpFixture = {
  activityAId: string;
  activityBId: string;
  applicationAId: string;
  applicationBId: string;
  appointmentId: string;
  familyToken: string;
  noPermissionToken: string;
  staffToken: string;
  staffUserId: string;
  tenantId: string;
  userAId: string;
};

let app: INestApplication;
let baseUrl = "";
let fixture: ActivityHttpFixture;
let sessions: SessionService;

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "activity_results", "activity_attempts", "activity_reschedule_requests",
    "activity_appointments", "application_activities",
    "activity_definition_versions", "activity_definitions", "applications",
    "admission_offerings", "admission_processes", "course_levels",
    "academic_years", "campuses", "students", "family_profiles",
    "role_assignments", "memberships", "platform_sessions", "platform_users",
    "tenant_probe_records", "audit_events", "outbox_messages", "tenants" CASCADE`);
}

async function seedFixture(): Promise<void> {
  const tenantId = randomUUID();
  const userAId = randomUUID();
  const outsiderId = randomUUID();
  const staffId = randomUUID();
  const noPermissionId = randomUUID();
  const profileAId = randomUUID();
  const profileBId = randomUUID();
  const studentAId = randomUUID();
  const studentBId = randomUUID();
  const campusId = randomUUID();
  const yearId = randomUUID();
  const levelId = randomUUID();
  const processId = randomUUID();
  const offeringId = randomUUID();
  const applicationAId = randomUUID();
  const applicationBId = randomUUID();
  const definitionId = randomUUID();
  const versionId = randomUUID();
  const activityAId = randomUUID();
  const activityBId = randomUUID();
  const appointmentId = randomUUID();
  const staffMembershipId = randomUUID();
  const staffRoleId = randomUUID();
  const noPermissionMembershipId = randomUUID();
  const noPermissionRoleId = randomUUID();

  await migrationPool.query(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [
    tenantId,
    "E5-D HTTP Tenant sintético",
  ]);
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized)
     VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)`,
    [
      userAId,
      `e5d-http-family-${userAId}@example.invalid`,
      outsiderId,
      `e5d-http-outsider-${outsiderId}@example.invalid`,
      staffId,
      `e5d-http-staff-${staffId}@example.invalid`,
      noPermissionId,
      `e5d-http-denied-${noPermissionId}@example.invalid`,
    ],
  );
  await migrationPool.query(
    `INSERT INTO family_profiles (id, user_id, display_name)
     VALUES ($1, $2, $3), ($4, $5, $6)`,
    [
      profileAId,
      userAId,
      "Familia E5-D HTTP A",
      profileBId,
      outsiderId,
      "Familia E5-D HTTP B",
    ],
  );
  await migrationPool.query(
    `INSERT INTO students (id, family_profile_id, given_name, family_name)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      studentAId,
      profileAId,
      "Estudiante",
      "Sintético A",
      studentBId,
      profileBId,
      "Estudiante",
      "Sintético B",
    ],
  );

  const context: TenantExecutionContext = {
    actorId: staffId,
    capabilities: [],
    contextOrigin: "synthetic_test",
    correlationId: `e5d-http-${tenantId}`,
    effectiveActorId: staffId,
    purpose: "E5D_HTTP_TEST",
    source: "trusted_job",
    tenantId,
  };
  await runWithTenantContext(context, () =>
    withTenantTransaction(prisma, async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO campuses (id, tenant_id, code, name)
        VALUES (${campusId}, ${tenantId}, ${"E5D-HTTP-CAMPUS"}, ${"Sede E5-D HTTP"})`;
      await transaction.$executeRaw`
        INSERT INTO academic_years (id, tenant_id, code, label, status)
        VALUES (${yearId}, ${tenantId}, ${"E5D-HTTP-YEAR"}, ${"Año E5-D HTTP"}, 'OPEN')`;
      await transaction.$executeRaw`
        INSERT INTO course_levels (id, tenant_id, code, name)
        VALUES (${levelId}, ${tenantId}, ${"E5D-HTTP-LEVEL"}, ${"Nivel E5-D HTTP"})`;
      await transaction.$executeRaw`
        INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status)
        VALUES (${processId}, ${tenantId}, ${yearId}, ${"E5D-HTTP-PROCESS"}, ${"Proceso E5-D HTTP"}, 'PUBLISHED')`;
      await transaction.$executeRaw`
        INSERT INTO admission_offerings
          (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id,
           code, title, status, availability_category)
        VALUES
          (${offeringId}, ${tenantId}, ${campusId}, ${yearId}, ${processId}, ${levelId},
           ${"E5D-HTTP-OFFER"}, ${"Oferta E5-D HTTP"}, 'PUBLISHED', 'POSTULATIONS_OPEN')`;
      await transaction.$executeRaw`
        INSERT INTO applications
          (id, tenant_id, family_profile_id, student_id, academic_year_id, process_id,
           offering_id, draft_data)
        VALUES
          (${applicationAId}, ${tenantId}, ${profileAId}, ${studentAId}, ${yearId}, ${processId},
           ${offeringId}, ${JSON.stringify({ acknowledgedNoGuarantee: true, currentStep: "REVIEW" })}::jsonb),
          (${applicationBId}, ${tenantId}, ${profileBId}, ${studentBId}, ${yearId}, ${processId},
           ${offeringId}, ${JSON.stringify({ acknowledgedNoGuarantee: true, currentStep: "REVIEW" })}::jsonb)`;
      await transaction.$executeRaw`
        INSERT INTO activity_definitions (id, tenant_id, code, name, kind)
        VALUES (${definitionId}, ${tenantId}, ${"E5D-HTTP-DIAGNOSTIC"}, ${"Evaluación E5-D HTTP"}, 'DIAGNOSTIC_EVALUATION')`;
      await transaction.$executeRaw`
        INSERT INTO activity_definition_versions
          (id, tenant_id, activity_definition_id, version_number, lifecycle, required,
           duration_minutes, max_normal_reschedules, late_tolerance_minutes, published_at)
        VALUES
          (${versionId}, ${tenantId}, ${definitionId}, 1, 'PUBLISHED', true, 30, 2, 15, CURRENT_TIMESTAMP)`;
      await transaction.$executeRaw`
        INSERT INTO application_activities
          (id, tenant_id, application_id, activity_definition_id,
           activity_definition_version_id, status, pinned_at)
        VALUES
          (${activityAId}, ${tenantId}, ${applicationAId}, ${definitionId}, ${versionId}, 'PROGRAMADA', CURRENT_TIMESTAMP),
          (${activityBId}, ${tenantId}, ${applicationBId}, ${definitionId}, ${versionId}, 'PENDIENTE', CURRENT_TIMESTAMP)`;
      await transaction.$executeRaw`
        INSERT INTO activity_appointments
          (id, tenant_id, application_activity_id, sequence, status,
           scheduled_start_at, duration_minutes, location, assigned_user_id, created_by)
        VALUES
          (${appointmentId}, ${tenantId}, ${activityAId}, 1, 'PROGRAMADA',
           CURRENT_TIMESTAMP + INTERVAL '30 minutes', 30, ${"Sala E5-D HTTP"}, ${staffId}, ${staffId})`;
      await transaction.$executeRaw`
        UPDATE application_activities
        SET current_appointment_id = ${appointmentId}
        WHERE id = ${activityAId}`;
      await transaction.$executeRaw`
        INSERT INTO memberships (id, tenant_id, user_id, status, starts_at)
        VALUES
          (${staffMembershipId}, ${tenantId}, ${staffId}, 'ACTIVE', CURRENT_TIMESTAMP),
          (${noPermissionMembershipId}, ${tenantId}, ${noPermissionId}, 'ACTIVE', CURRENT_TIMESTAMP)`;
      await transaction.$executeRaw`
        INSERT INTO role_assignments
          (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at)
        VALUES
          (${staffRoleId}, ${tenantId}, ${staffMembershipId}, ${"SYNTHETIC_E5D_STAFF"},
           ARRAY[${PERMISSIONS.ACTIVITY_READ}, ${PERMISSIONS.ACTIVITY_SCHEDULE}, ${PERMISSIONS.ACTIVITY_PERFORM}, ${PERMISSIONS.ACTIVITY_REPEAT}, ${PERMISSIONS.ACTIVITY_CLOSE}]::text[],
           ARRAY['*']::text[], 'ACTIVE', CURRENT_TIMESTAMP),
          (${noPermissionRoleId}, ${tenantId}, ${noPermissionMembershipId}, ${"SYNTHETIC_E5D_NO_ACTIVITY"},
           ARRAY[${PERMISSIONS.APPLICATION_READ}]::text[], ARRAY['*']::text[], 'ACTIVE', CURRENT_TIMESTAMP)`;
    }),
  );

  const [familySession, staffSession, noPermissionSession] = await Promise.all([
    sessions.issueSession(userAId),
    sessions.issueSession(staffId),
    sessions.issueSession(noPermissionId),
  ]);
  fixture = {
    activityAId,
    activityBId,
    applicationAId,
    applicationBId,
    appointmentId,
    familyToken: familySession.token,
    noPermissionToken: noPermissionSession.token,
    staffToken: staffSession.token,
    staffUserId: staffId,
    tenantId,
    userAId,
  };
}

function cookie(token: string): string {
  return `${cookieName}=${token}`;
}

async function request(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<Response> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (token !== undefined) headers.set("Cookie", cookie(token));
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function csrf(token: string): Promise<string> {
  const response = await request("/auth/csrf", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

async function mutation(
  path: string,
  token: string,
  csrfToken: string | undefined,
  body: unknown,
): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  });
  if (csrfToken !== undefined) headers.set("X-CSRF-Token", csrfToken);
  return request(path, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
    token,
  });
}

describe.sequential("E5-D real Nest HTTP boundary", () => {
  beforeAll(async () => {
    process.env.ADMISSION_APP_ORIGIN = "http://localhost:3000";
    process.env.ADMISSION_WEB_ORIGIN = "http://localhost:3000";
    sessions = new SessionService(prisma, {
      auditSink: new InMemoryAuditSink(),
      securityEvents: new InMemorySecurityEventSink(),
    });
    app = await NestFactory.create(AppModule);
    configureAdmissionApp(app);
    await app.init();
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (address === null || typeof address === "string") {
      throw new Error("HTTP test server did not expose an ephemeral port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    await clearTables();
    await seedFixture();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("E5D-HTTP-01: session, membership and CSRF boundaries are enforced", async () => {
    const noSession = await request(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities`,
    );
    expect(noSession.status).toBe(401);

    const deniedStaff = await request(
      `/staff/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities`,
      { token: fixture.noPermissionToken },
    );
    expect(deniedStaff.status).toBe(403);

    const noCsrf = await mutation(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities/${fixture.activityAId}/appointments/${fixture.appointmentId}/reschedule-requests`,
      fixture.familyToken,
      undefined,
      { reason: "Solicitud sintética" },
    );
    expect(noCsrf.status).toBe(403);
  });

  it("E5D-HTTP-02: family ownership and strict reschedule body are enforced", async () => {
    const familyCsrf = await csrf(fixture.familyToken);
    const forgedOwnership = await request(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationBId}/activities`,
      { token: fixture.familyToken },
    );
    expect(forgedOwnership.status).toBe(404);

    const extraFields = await mutation(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities/${fixture.activityAId}/appointments/${fixture.appointmentId}/reschedule-requests`,
      fixture.familyToken,
      familyCsrf,
      { reason: "Solicitud sintética", slot: "2026-08-11T15:00:00-04:00" },
    );
    expect(extraFields.status).toBe(400);
  });

  it("E5D-HTTP-03: family projection omits internal result and evaluator data", async () => {
    const response = await request(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities`,
      { token: fixture.familyToken },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty("attempts");
    expect(body[0]).not.toHaveProperty("results");
    expect(body[0]).not.toHaveProperty("assignedUserId");
    expect(body[0]).not.toHaveProperty("evaluator");
    expect(body[0]).not.toHaveProperty("comment");
  });

  it("E5D-HTTP-04: staff result access is omitted without sensitivity permission", async () => {
    const response = await request(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}`,
      { token: fixture.staffToken },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      attempts: unknown[];
      results: unknown[];
    };
    expect(body.attempts).toEqual([]);
    expect(body.results).toEqual([]);
  });

  it("E5D-HTTP-05: stale appointment and early no-show are controlled conflicts", async () => {
    const staffCsrf = await csrf(fixture.staffToken);
    const beforeReprogram = (await (
      await request(
        `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}`,
        { token: fixture.staffToken },
      )
    ).json()) as { appointment: { id: string } };
    const oldAppointmentId = beforeReprogram.appointment.id;
    const reprogram = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/reprogram`,
      fixture.staffToken,
      staffCsrf,
      {
        assignedUserId: fixture.staffUserId,
        expectedAppointmentId: oldAppointmentId,
        location: "Sala E5-D HTTP 2",
        newScheduledStartAt: "2026-08-12T15:00:00-04:00",
      },
    );
    expect(reprogram.status).toBe(201);

    const stale = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/record-no-show`,
      fixture.staffToken,
      staffCsrf,
      {
        expectedAppointmentId: oldAppointmentId,
        noShowJustified: false,
        occurredAt: "2026-08-12T17:00:00-04:00",
      },
    );
    expect(stale.status).toBe(409);
    const staleBody = (await stale.json()) as { code: string };
    expect(staleBody.code).toBe("ACTIVITY_APPOINTMENT_CHANGED");

    const current = (await (
      await request(
        `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}`,
        { token: fixture.staffToken },
      )
    ).json()) as { appointment: { id: string } };
    const earlyNoShow = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/record-no-show`,
      fixture.staffToken,
      staffCsrf,
      {
        expectedAppointmentId: current.appointment.id,
        noShowJustified: false,
        occurredAt: "2026-08-12T14:00:00-04:00",
      },
    );
    expect(earlyNoShow.status).toBe(409);
    const earlyNoShowBody = (await earlyNoShow.json()) as { code: string };
    expect(earlyNoShowBody.code).toBe("ACTIVITY_NO_SHOW_TOO_EARLY");

    const familyCsrf = await csrf(fixture.familyToken);
    const staleFamilyRequest = await mutation(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities/${fixture.activityAId}/appointments/${oldAppointmentId}/reschedule-requests`,
      fixture.familyToken,
      familyCsrf,
      { reason: "Solicitud stale sintética" },
    );
    expect(staleFamilyRequest.status).toBe(409);
    const staleFamilyBody = (await staleFamilyRequest.json()) as {
      code: string;
    };
    expect(staleFamilyBody.code).toBe("ACTIVITY_APPOINTMENT_CHANGED");

    const currentAppointmentId = current.appointment.id;
    const currentFamilyRequest = await mutation(
      `/family/tenants/${fixture.tenantId}/applications/${fixture.applicationAId}/activities/${fixture.activityAId}/appointments/${currentAppointmentId}/reschedule-requests`,
      fixture.familyToken,
      familyCsrf,
      { reason: "Solicitud current sintética" },
    );
    expect(currentFamilyRequest.status).toBe(201);
  });

  it("E5D-HTTP-06: repeat and close return redacted evidence without result.read", async () => {
    const staffCsrf = await csrf(fixture.staffToken);
    const current = (await (
      await request(
        `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}`,
        { token: fixture.staffToken },
      )
    ).json()) as { appointment: { id: string } };
    const notCompleted = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/record-not-completed`,
      fixture.staffToken,
      staffCsrf,
      {
        expectedAppointmentId: current.appointment.id,
        reason: "No completada sintética",
      },
    );
    expect(notCompleted.status).toBe(201);
    const notCompletedBody = (await notCompleted.json()) as {
      attempts: unknown[];
    };
    expect(notCompletedBody.attempts).toEqual([]);

    const missingRepeatToken = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/repeat`,
      fixture.staffToken,
      staffCsrf,
      {
        assignedUserId: fixture.staffUserId,
        location: "Sala repeat HTTP",
        newScheduledStartAt: "2026-08-15T15:00:00-04:00",
        reason: "Repeat sin token sintético",
      },
    );
    expect(missingRepeatToken.status).toBe(400);

    const repeated = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/repeat`,
      fixture.staffToken,
      staffCsrf,
      {
        assignedUserId: fixture.staffUserId,
        expectedAppointmentId: current.appointment.id,
        location: "Sala repeat HTTP",
        newScheduledStartAt: "2026-08-15T15:00:00-04:00",
        reason: "Repetición HTTP sintética",
      },
    );
    expect(repeated.status).toBe(201);
    const repeatedBody = (await repeated.json()) as {
      appointment: { id: string };
      attempts: unknown[];
      results: unknown[];
    };
    expect(repeatedBody.attempts).toEqual([]);
    expect(repeatedBody.results).toEqual([]);

    const firstNoShow = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/record-no-show`,
      fixture.staffToken,
      staffCsrf,
      {
        expectedAppointmentId: repeatedBody.appointment.id,
        noShowJustified: false,
        occurredAt: "2026-08-16T15:00:00-04:00",
      },
    );
    expect(firstNoShow.status).toBe(201);
    const secondAppointment = (await (
      await mutation(
        `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/reprogram`,
        fixture.staffToken,
        staffCsrf,
        {
          assignedUserId: fixture.staffUserId,
          expectedAppointmentId: repeatedBody.appointment.id,
          location: "Sala close HTTP",
          newScheduledStartAt: "2026-08-17T15:00:00-04:00",
        },
      )
    ).json()) as { appointment: { id: string } };
    const secondNoShow = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/record-no-show`,
      fixture.staffToken,
      staffCsrf,
      {
        expectedAppointmentId: secondAppointment.appointment.id,
        noShowJustified: false,
        occurredAt: "2026-08-18T15:00:00-04:00",
      },
    );
    expect(secondNoShow.status).toBe(201);
    const closed = await mutation(
      `/staff/tenants/${fixture.tenantId}/activities/${fixture.activityAId}/close`,
      fixture.staffToken,
      staffCsrf,
      { reason: "Cierre HTTP sintético" },
    );
    expect(closed.status).toBe(201);
    const closedBody = (await closed.json()) as {
      attempts: unknown[];
      results: unknown[];
    };
    expect(closedBody.attempts).toEqual([]);
    expect(closedBody.results).toEqual([]);
  });
});
