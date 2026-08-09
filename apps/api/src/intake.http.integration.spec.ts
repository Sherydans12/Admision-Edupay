import { randomUUID } from "node:crypto";

import {
  buildSessionCookieOptions,
  createAppPrismaClient,
  InMemoryAuditSink,
  InMemorySecurityEventSink,
  PERMISSIONS,
  SessionService,
} from "@admission/database";
import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { configureAdmissionApp } from "./app-bootstrap.js";
import { AppModule } from "./app.module.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 3,
});
const cookieName = buildSessionCookieOptions({ environment: "local" }).name;

type HttpFixture = {
  adminAllowedToken: string;
  adminDeniedToken: string;
  adminManageToken: string;
  applicationBId: string;
  formFieldAId: string;
  formVersionAId: string;
  familyAToken: string;
  familyBToken: string;
  offeringAId: string;
  processAId: string;
  studentAId: string;
  studentBId: string;
  tenantAId: string;
  tenantBId: string;
};

let app: INestApplication;
let baseUrl = "";
let fixture: HttpFixture;
let sessions: SessionService;

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "audit_events", "applications", "admission_offerings", "admission_processes",
    "course_levels", "academic_years", "campuses", "students", "family_profiles",
    "tenant_probe_records", "outbox_messages", "support_elevations", "role_assignments",
    "memberships", "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function seedFixture(): Promise<void> {
  const userA = randomUUID();
  const userB = randomUUID();
  const adminAllowed = randomUUID();
  const adminDenied = randomUUID();
  const adminManage = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const profileA = randomUUID();
  const profileB = randomUUID();
  const studentA = randomUUID();
  const studentB = randomUUID();
  const campusA = randomUUID();
  const yearA = randomUUID();
  const levelA = randomUUID();
  const processA = randomUUID();
  const offeringA = randomUUID();
  const formDefinitionA = randomUUID();
  const formVersionA = randomUUID();
  const formSectionA = randomUUID();
  const formFieldA = randomUUID();
  const campusB = randomUUID();
  const yearB = randomUUID();
  const levelB = randomUUID();
  const processB = randomUUID();
  const offeringB = randomUUID();
  const membership = randomUUID();
  const roleAssignment = randomUUID();
  const manageMembership = randomUUID();
  const manageRoleAssignment = randomUUID();
  const applicationB = randomUUID();

  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO platform_users (id, email_normalized)
       VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10)`,
      [
        userA,
        `synthetic-http-a-${userA}@example.invalid`,
        userB,
        `synthetic-http-b-${userB}@example.invalid`,
        adminAllowed,
        `synthetic-http-admin-${adminAllowed}@example.invalid`,
        adminDenied,
        `synthetic-http-denied-${adminDenied}@example.invalid`,
        adminManage,
        `synthetic-http-manage-${adminManage}@example.invalid`,
      ],
    );
    await client.query(
      `INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)`,
      [tenantA, "Synthetic HTTP Tenant A", tenantB, "Synthetic HTTP Tenant B"],
    );
    await client.query(
      `INSERT INTO family_profiles (id, user_id, display_name)
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      [profileA, userA, "Familia HTTP A", profileB, userB, "Familia HTTP B"],
    );
    await client.query(
      `INSERT INTO students (id, family_profile_id, given_name, family_name)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        studentA,
        profileA,
        "Estudiante HTTP A",
        "Familia HTTP A",
        studentB,
        profileB,
        "Estudiante HTTP B",
        "Familia HTTP B",
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${tenantA}, true)`;
    await transaction.$executeRaw`
      INSERT INTO campuses (id, tenant_id, code, name)
      VALUES (${campusA}, ${tenantA}, ${"HTTP-CAMPUS-A"}, ${"Sede HTTP A"})`;
    await transaction.$executeRaw`
      INSERT INTO academic_years (id, tenant_id, code, label, status)
      VALUES (${yearA}, ${tenantA}, ${"HTTP-YEAR-A"}, ${"Año HTTP A"}, 'OPEN')`;
    await transaction.$executeRaw`
      INSERT INTO course_levels (id, tenant_id, code, name)
      VALUES (${levelA}, ${tenantA}, ${"HTTP-LEVEL-A"}, ${"Nivel HTTP A"})`;
    await transaction.$executeRaw`
      INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status)
      VALUES (${processA}, ${tenantA}, ${yearA}, ${"HTTP-PROCESS-A"}, ${"Proceso HTTP A"}, 'PUBLISHED')`;
    await transaction.$executeRaw`
      INSERT INTO form_definitions (id, tenant_id, name, purpose)
      VALUES (${formDefinitionA}, ${tenantA}, ${"Formulario HTTP sintético"}, ${"admission_application"})`;
    await transaction.$executeRaw`
      INSERT INTO form_versions (id, tenant_id, form_definition_id, version_number, lifecycle)
      VALUES (${formVersionA}, ${tenantA}, ${formDefinitionA}, 1, 'DRAFT')`;
    await transaction.$executeRaw`
      INSERT INTO form_sections (id, tenant_id, form_version_id, title, "order")
      VALUES (${formSectionA}, ${tenantA}, ${formVersionA}, ${"Antecedentes HTTP sintéticos"}, 1)`;
    await transaction.$executeRaw`
      INSERT INTO form_fields
        (id, tenant_id, form_version_id, section_id, key, label, type, required, sensitivity, purpose, "order")
      VALUES (${formFieldA}, ${tenantA}, ${formVersionA}, ${formSectionA}, ${"http_context"}, ${"Contexto HTTP sintético"}, 'TEXT', true, ${"restricted"}, ${"Validar el flujo HTTP sintético"}, 1)`;
    await transaction.$executeRaw`
      UPDATE form_versions
      SET lifecycle = 'PUBLISHED', published_at = CURRENT_TIMESTAMP
      WHERE id = ${formVersionA}`;
    await transaction.$executeRaw`
      INSERT INTO admission_offerings
        (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id, code, title, status, availability_category, form_version_id)
      VALUES (${offeringA}, ${tenantA}, ${campusA}, ${yearA}, ${processA}, ${levelA}, ${"HTTP-OFFER-A"}, ${"Oferta HTTP A"}, 'PUBLISHED', 'LIMITED_CAPACITY', ${formVersionA})`;
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${tenantB}, true)`;
    await transaction.$executeRaw`
      INSERT INTO campuses (id, tenant_id, code, name)
      VALUES (${campusB}, ${tenantB}, ${"HTTP-CAMPUS-B"}, ${"Sede HTTP B"})`;
    await transaction.$executeRaw`
      INSERT INTO academic_years (id, tenant_id, code, label, status)
      VALUES (${yearB}, ${tenantB}, ${"HTTP-YEAR-B"}, ${"Año HTTP B"}, 'OPEN')`;
    await transaction.$executeRaw`
      INSERT INTO course_levels (id, tenant_id, code, name)
      VALUES (${levelB}, ${tenantB}, ${"HTTP-LEVEL-B"}, ${"Nivel HTTP B"})`;
    await transaction.$executeRaw`
      INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status)
      VALUES (${processB}, ${tenantB}, ${yearB}, ${"HTTP-PROCESS-B"}, ${"Proceso HTTP B"}, 'PUBLISHED')`;
    await transaction.$executeRaw`
      INSERT INTO admission_offerings
        (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id, code, title, status, availability_category)
      VALUES (${offeringB}, ${tenantB}, ${campusB}, ${yearB}, ${processB}, ${levelB}, ${"HTTP-OFFER-B"}, ${"Oferta HTTP B"}, 'PUBLISHED', 'POSTULATIONS_OPEN')`;
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${tenantA}, true)`;
    await transaction.$executeRaw`
      INSERT INTO applications
        (id, tenant_id, family_profile_id, student_id, academic_year_id, process_id, offering_id, draft_data)
      VALUES (${applicationB}, ${tenantA}, ${profileB}, ${studentB}, ${yearA}, ${processA}, ${offeringA}, ${JSON.stringify({ acknowledgedNoGuarantee: false, currentStep: "CONTEXT" })}::jsonb)`;
    await transaction.$executeRaw`
      INSERT INTO memberships (id, tenant_id, user_id, status, starts_at)
      VALUES (${membership}, ${tenantA}, ${adminAllowed}, 'ACTIVE', CURRENT_TIMESTAMP)`;
    await transaction.$executeRaw`
      INSERT INTO memberships (id, tenant_id, user_id, status, starts_at)
      VALUES (${manageMembership}, ${tenantA}, ${adminManage}, 'ACTIVE', CURRENT_TIMESTAMP)`;
    await transaction.$executeRaw`
      INSERT INTO role_assignments
        (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at)
       VALUES (${roleAssignment}, ${tenantA}, ${membership}, ${"SYNTHETIC_E5A_ADMIN"}, ARRAY[${PERMISSIONS.ADMISSION_CONFIG_READ}, ${PERMISSIONS.ADMISSION_CONFIG_MANAGE}, ${PERMISSIONS.FORM_READ}, ${PERMISSIONS.FORM_MANAGE}, ${PERMISSIONS.FORM_PUBLISH}]::text[], ARRAY[${"*"}]::text[], 'ACTIVE', CURRENT_TIMESTAMP)`;
    await transaction.$executeRaw`
      INSERT INTO role_assignments
        (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at)
      VALUES (${manageRoleAssignment}, ${tenantA}, ${manageMembership}, ${"SYNTHETIC_E5B_FORM_MANAGER"}, ARRAY[${PERMISSIONS.FORM_READ}, ${PERMISSIONS.FORM_MANAGE}]::text[], ARRAY[${"*"}]::text[], 'ACTIVE', CURRENT_TIMESTAMP)`;
  });

  const [
    familySession,
    familyBSession,
    adminAllowedSession,
    adminDeniedSession,
    adminManageSession,
  ] = await Promise.all([
    sessions.issueSession(userA),
    sessions.issueSession(userB),
    sessions.issueSession(adminAllowed),
    sessions.issueSession(adminDenied),
    sessions.issueSession(adminManage),
  ]);
  fixture = {
    adminAllowedToken: adminAllowedSession.token,
    adminDeniedToken: adminDeniedSession.token,
    adminManageToken: adminManageSession.token,
    applicationBId: applicationB,
    familyAToken: familySession.token,
    familyBToken: familyBSession.token,
    formFieldAId: formFieldA,
    formVersionAId: formVersionA,
    offeringAId: offeringA,
    processAId: processA,
    studentAId: studentA,
    studentBId: studentB,
    tenantAId: tenantA,
    tenantBId: tenantB,
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
  const body = (await response.json()) as { token: string };
  return body.token;
}

async function mutation(
  path: string,
  token: string,
  csrfToken: string | undefined,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (!headers.has("Origin")) headers.set("Origin", "http://localhost:3000");
  if (csrfToken !== undefined) headers.set("X-CSRF-Token", csrfToken);
  return request(path, { ...init, headers, token });
}

describe.sequential("E5-A real HTTP boundary", () => {
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
  });

  beforeEach(async () => {
    await clearTables();
    await seedFixture();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("E5A-HTTP-01: protected GET without session is 401", async () => {
    const response = await request("/family/students");
    expect(response.status).toBe(401);
  });

  it("E5A-HTTP-02: admin without membership is denied", async () => {
    const response = await request(
      `/admin/tenants/${fixture.tenantAId}/configuration`,
      { token: fixture.adminDeniedToken },
    );
    expect(response.status).toBe(403);
  });

  it("E5A-HTTP-03: admin with explicit permission can read configuration", async () => {
    const response = await request(
      `/admin/tenants/${fixture.tenantAId}/configuration`,
      { token: fixture.adminAllowedToken },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { offerings: unknown[] };
    expect(body.offerings).toHaveLength(1);
  });

  it("E5A-HTTP-04: mutation without CSRF is denied", async () => {
    const noCsrf = await mutation(
      "/family/students",
      fixture.familyAToken,
      undefined,
      {
        body: JSON.stringify({ familyName: "HTTP A", givenName: "Sin CSRF" }),
        method: "POST",
      },
    );
    expect(noCsrf.status).toBe(403);
  });

  it("E5A-HTTP-05: mutation with wrong origin is denied", async () => {
    const token = await csrf(fixture.familyAToken);
    const wrongOrigin = await mutation(
      "/family/students",
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({ familyName: "HTTP A", givenName: "Origen" }),
        headers: { Origin: "https://attacker.example.invalid" },
        method: "POST",
      },
    );
    expect(wrongOrigin.status).toBe(403);
  });

  it("E5A-HTTP-06: session plus CSRF allows family mutation", async () => {
    const token = await csrf(fixture.familyAToken);
    const response = await mutation(
      "/family/students",
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          familyName: "Familia HTTP A",
          givenName: "Nuevo",
        }),
        method: "POST",
      },
    );
    expect(response.status).toBe(201);
    expect(((await response.json()) as { id: string }).id).toMatch(
      /^[0-9a-f-]{36}$/,
    );

    const profile = await mutation(
      "/family/profile",
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({ displayName: "Familia HTTP A actualizada" }),
        method: "PUT",
      },
    );
    expect(profile.status).toBe(200);
  });

  it("E5A-HTTP-07: family ownership hides and blocks another family student", async () => {
    const list = await request("/family/students", {
      token: fixture.familyAToken,
    });
    expect(list.status).toBe(200);
    const students = (await list.json()) as { items: { id: string }[] };
    expect(students.items.map((student) => student.id)).toEqual([
      fixture.studentAId,
    ]);

    const token = await csrf(fixture.familyAToken);
    const update = await mutation(
      `/family/students/${fixture.studentBId}`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({ familyName: "No", givenName: "Autorizado" }),
        method: "PATCH",
      },
    );
    expect(update.status).toBe(404);
  });

  it("E5A-HTTP-08: family ownership hides another family's application", async () => {
    const response = await request(
      `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationBId}`,
      { token: fixture.familyAToken },
    );
    expect(response.status).toBe(404);
  });

  it("E5A-HTTP-09: an offering from tenant A is not usable through tenant B", async () => {
    const token = await csrf(fixture.familyAToken);
    const response = await mutation(
      `/family/tenants/${fixture.tenantBId}/applications`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        }),
        method: "POST",
      },
    );
    expect(response.status).toBe(404);
  });

  it("E5A-HTTP-10: duplicate draft through API returns 409", async () => {
    const token = await csrf(fixture.familyAToken);
    const body = JSON.stringify({
      offeringId: fixture.offeringAId,
      studentId: fixture.studentAId,
    });
    const first = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      { body, method: "POST" },
    );
    const second = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      { body, method: "POST" },
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("E5A-HTTP-11: public offerings never project exact capacity", async () => {
    const response = await request(
      `/family/tenants/${fixture.tenantAId}/offerings`,
      { token: fixture.familyAToken },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Record<string, unknown>[];
    };
    for (const offering of body.items) {
      expect(offering).not.toHaveProperty("capacity");
      expect(offering).not.toHaveProperty("availableCount");
      expect(offering).not.toHaveProperty("exactCapacity");
      expect(offering).not.toHaveProperty("reservedCount");
    }
  });

  it("E5A-HTTP-12: global family students do not require tenant authority", async () => {
    const response = await request(
      "/family/students?tenantId=00000000-0000-4000-8000-000000000000",
      { token: fixture.familyAToken },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { id: string }[] };
    expect(body.items.map((student) => student.id)).toEqual([
      fixture.studentAId,
    ]);
  });

  it("E5A-HTTP-13: an expired published process cannot start a draft", async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${fixture.tenantAId}, true)`;
      await transaction.$executeRaw`
        UPDATE admission_processes
        SET closes_at = ${new Date("2000-01-01T00:00:00.000Z")}
        WHERE id = ${fixture.processAId}`;
    });

    const token = await csrf(fixture.familyAToken);
    const response = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        }),
        method: "POST",
      },
    );
    expect(response.status).toBe(400);
  });

  it("E5B-HTTP-01: admin without membership is denied builder access", async () => {
    const response = await request(
      `/admin/tenants/${fixture.tenantAId}/forms`,
      {
        token: fixture.adminDeniedToken,
      },
    );
    expect(response.status).toBe(403);
  });

  it("E5B-HTTP-02: form.manage without form.publish cannot publish", async () => {
    const token = await csrf(fixture.adminManageToken);
    const response = await mutation(
      `/admin/tenants/${fixture.tenantAId}/form-versions/${randomUUID()}/publish`,
      fixture.adminManageToken,
      token,
      { method: "POST" },
    );
    expect(response.status).toBe(403);
  });

  it("E5B-HTTP-03: authorized admin creates and publishes a controlled version", async () => {
    const token = await csrf(fixture.adminAllowedToken);
    const definitionResponse = await mutation(
      `/admin/tenants/${fixture.tenantAId}/forms`,
      fixture.adminAllowedToken,
      token,
      {
        body: JSON.stringify({
          name: "Formulario HTTP publicable",
          purpose: "admission_application",
        }),
        method: "POST",
      },
    );
    expect(definitionResponse.status).toBe(201);
    const definition = (await definitionResponse.json()) as { id: string };
    const versionResponse = await mutation(
      `/admin/tenants/${fixture.tenantAId}/forms/${definition.id}/versions`,
      fixture.adminAllowedToken,
      token,
      { body: JSON.stringify({}), method: "POST" },
    );
    expect(versionResponse.status).toBe(201);
    const version = (await versionResponse.json()) as { id: string };
    const sectionResponse = await mutation(
      `/admin/tenants/${fixture.tenantAId}/form-versions/${version.id}/sections`,
      fixture.adminAllowedToken,
      token,
      {
        body: JSON.stringify({ order: 1, title: "Sección HTTP controlada" }),
        method: "POST",
      },
    );
    expect(sectionResponse.status).toBe(201);
    const section = (await sectionResponse.json()) as { id: string };
    const fieldResponse = await mutation(
      `/admin/tenants/${fixture.tenantAId}/form-versions/${version.id}/fields`,
      fixture.adminAllowedToken,
      token,
      {
        body: JSON.stringify({
          key: "http_boolean",
          label: "Confirmación HTTP sintética",
          order: 1,
          purpose: "Validar publicación HTTP",
          required: true,
          sectionId: section.id,
          sensitivity: "restricted",
          type: "BOOLEAN",
        }),
        method: "POST",
      },
    );
    expect(fieldResponse.status).toBe(201);
    const publish = await mutation(
      `/admin/tenants/${fixture.tenantAId}/form-versions/${version.id}/publish`,
      fixture.adminAllowedToken,
      token,
      { method: "POST" },
    );
    expect(publish.status).toBe(201);
    expect((await publish.json()) as object).toMatchObject({
      lifecycle: "PUBLISHED",
      versionNumber: 1,
    });
  });

  it("E5B-HTTP-04: family receives the form version pinned at draft creation", async () => {
    const token = await csrf(fixture.familyAToken);
    const created = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        }),
        method: "POST",
      },
    );
    const application = (await created.json()) as {
      formVersionId: string;
      id: string;
    };
    expect(application.formVersionId).toBe(fixture.formVersionAId);
    const response = await request(
      `/family/tenants/${fixture.tenantAId}/applications/${application.id}/form`,
      { token: fixture.familyAToken },
    );
    expect(response.status).toBe(200);
    expect((await response.json()) as object).toMatchObject({
      applicationId: application.id,
      form: { id: fixture.formVersionAId, lifecycle: "PUBLISHED" },
    });
  });

  it("E5B-HTTP-05: saving answers requires CSRF", async () => {
    const token = await csrf(fixture.familyAToken);
    const created = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        }),
        method: "POST",
      },
    );
    const application = (await created.json()) as { id: string };
    const response = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications/${application.id}/answers`,
      fixture.familyAToken,
      undefined,
      {
        body: JSON.stringify({
          answers: [{ fieldId: fixture.formFieldAId, value: "Sintético" }],
        }),
        method: "PUT",
      },
    );
    expect(response.status).toBe(403);
  });

  it("E5B-HTTP-06: foreign family application remains anti-enumeration 404", async () => {
    const response = await request(
      `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationBId}/form`,
      { token: fixture.familyAToken },
    );
    expect(response.status).toBe(404);
  });

  it("E5B-HTTP-07: active content is rejected at the HTTP boundary", async () => {
    const token = await csrf(fixture.adminAllowedToken);
    const response = await mutation(
      `/admin/tenants/${fixture.tenantAId}/forms`,
      fixture.adminAllowedToken,
      token,
      {
        body: JSON.stringify({
          name: "<script>alert('synthetic')</script>",
          purpose: "admission_application",
        }),
        method: "POST",
      },
    );
    expect(response.status).toBe(400);
  });

  it("E5B-HTTP-08: required missing rejects submit and preserves draft", async () => {
    const token = await csrf(fixture.familyAToken);
    const created = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        }),
        method: "POST",
      },
    );
    const application = (await created.json()) as { id: string };
    const response = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications/${application.id}/submit`,
      fixture.familyAToken,
      token,
      { method: "POST" },
    );
    expect(response.status).toBe(400);
    const persisted = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${fixture.tenantAId}, true)`;
      return transaction.application.findUnique({
        where: { id: application.id },
      });
    });
    expect(persisted?.status).toBe("DRAFT");
  });

  it("E5B-HTTP-09/10: valid submit is durable and retry does not duplicate snapshot", async () => {
    const token = await csrf(fixture.familyAToken);
    const created = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        }),
        method: "POST",
      },
    );
    const application = (await created.json()) as { id: string };
    const saved = await mutation(
      `/family/tenants/${fixture.tenantAId}/applications/${application.id}/answers`,
      fixture.familyAToken,
      token,
      {
        body: JSON.stringify({
          answers: [
            { fieldId: fixture.formFieldAId, value: "Respuesta sintética" },
          ],
        }),
        method: "PUT",
      },
    );
    expect(saved.status).toBe(200);
    const review = await request(
      `/family/tenants/${fixture.tenantAId}/applications/${application.id}/review`,
      { token: fixture.familyAToken },
    );
    expect(review.status).toBe(200);
    expect((await review.json()) as object).toMatchObject({
      missingRequired: [],
    });
    const path = `/family/tenants/${fixture.tenantAId}/applications/${application.id}/submit`;
    const first = await mutation(path, fixture.familyAToken, token, {
      method: "POST",
    });
    const second = await mutation(path, fixture.familyAToken, token, {
      method: "POST",
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = (await first.json()) as { snapshotId: string };
    const secondBody = (await second.json()) as { snapshotId: string };
    expect(secondBody.snapshotId).toBe(firstBody.snapshotId);
    const snapshotCount = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('admission.tenant_id', ${fixture.tenantAId}, true)`;
      return transaction.applicationSnapshot.count({
        where: { applicationId: application.id },
      });
    });
    expect(snapshotCount).toBe(1);
  });
});
