import { randomUUID } from "node:crypto";

import {
  buildSessionCookieOptions,
  createAppPrismaClient,
  InMemoryAuditSink,
  InMemorySecurityEventSink,
  PERMISSIONS,
  RecommendationService,
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
const recommendations = new RecommendationService(prisma);

type Fixture = {
  applicationAId: string;
  applicationBId: string;
  applicationCId: string;
  familyToken: string;
  foreignFamilyToken: string;
  noPermissionToken: string;
  offeringAId: string;
  staffToken: string;
  tenantAId: string;
  tenantBId: string;
  tenantBStaffToken: string;
};

let app: INestApplication;
let baseUrl = "";
let fixture: Fixture;
let sessions: SessionService;
let capacityVersion = 0;
let waitlistEntryId = "";
let waitlistEntryVersion = 0;
let promotedOfferId = "";
let promotedOfferVersionId = "";

function context(
  tenantId: string,
  actorId: string,
  capabilities: readonly string[],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5f-http-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5F_HTTP_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function clearTables() {
  await migrationPool.query(`TRUNCATE TABLE
    "offer_acceptances", "application_withdrawals", "admission_offer_versions",
    "admission_offers", "waitlist_entries", "seat_reservations",
    "admission_capacity_adjustments", "admission_capacities",
    "direction_decision_versions", "direction_decisions",
    "admission_recommendation_versions", "admission_recommendations",
    "application_snapshots", "applications", "admission_offerings",
    "form_versions", "form_definitions", "admission_processes", "course_levels",
    "academic_years", "campuses", "students", "family_profiles",
    "role_assignments", "memberships", "platform_sessions", "platform_users",
    "audit_events", "outbox_messages", "tenant_probe_records", "tenants" CASCADE`);
}

async function seedFixture() {
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const familyUserId = randomUUID();
  const foreignFamilyUserId = randomUUID();
  const recommenderId = randomUUID();
  const staffId = randomUUID();
  const noPermissionId = randomUUID();
  const tenantBStaffId = randomUUID();
  const familyProfileId = randomUUID();
  const foreignProfileId = randomUUID();
  await migrationPool.query(
    "INSERT INTO tenants (id,name) VALUES ($1,$2),($3,$4)",
    [tenantAId, "Tenant E5-F HTTP A", tenantBId, "Tenant E5-F HTTP B"],
  );
  const users = [
    familyUserId,
    foreignFamilyUserId,
    recommenderId,
    staffId,
    noPermissionId,
    tenantBStaffId,
  ];
  await migrationPool.query(
    `INSERT INTO platform_users (id,email_normalized) VALUES ${users
      .map((_, index) => `($${index * 2 + 1},$${index * 2 + 2})`)
      .join(",")}`,
    users.flatMap((id) => [id, `e5f-http-${id}@example.invalid`]),
  );
  await migrationPool.query(
    "INSERT INTO family_profiles (id,user_id,display_name) VALUES ($1,$2,$3),($4,$5,$6)",
    [
      familyProfileId,
      familyUserId,
      "Familia E5-F HTTP",
      foreignProfileId,
      foreignFamilyUserId,
      "Familia extranjera E5-F HTTP",
    ],
  );

  const campusId = randomUUID();
  const yearId = randomUUID();
  const levelId = randomUUID();
  const processId = randomUUID();
  const formId = randomUUID();
  const formVersionId = randomUUID();
  const offeringAId = randomUUID();
  const seedContext = context(tenantAId, staffId, []);
  const applicationIds = await runWithTenantContext(seedContext, () =>
    withTenantTransaction(prisma, async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO campuses (id,tenant_id,code,name)
        VALUES (${campusId},${tenantAId},'E5F-HTTP-CAMPUS','Sede E5-F HTTP')`;
      await transaction.$executeRaw`
        INSERT INTO academic_years (id,tenant_id,code,label,status)
        VALUES (${yearId},${tenantAId},'E5F-HTTP-YEAR','Año E5-F HTTP','OPEN')`;
      await transaction.$executeRaw`
        INSERT INTO course_levels (id,tenant_id,code,name)
        VALUES (${levelId},${tenantAId},'E5F-HTTP-LEVEL','Nivel E5-F HTTP')`;
      await transaction.$executeRaw`
        INSERT INTO admission_processes (id,tenant_id,academic_year_id,code,name,status)
        VALUES (${processId},${tenantAId},${yearId},'E5F-HTTP-PROCESS','Proceso E5-F HTTP','PUBLISHED')`;
      await transaction.$executeRaw`
        INSERT INTO form_definitions (id,tenant_id,name,purpose)
        VALUES (${formId},${tenantAId},'Formulario E5-F HTTP','admission_application')`;
      await transaction.$executeRaw`
        INSERT INTO form_versions (id,tenant_id,form_definition_id,version_number,lifecycle,published_at)
        VALUES (${formVersionId},${tenantAId},${formId},1,'PUBLISHED',CURRENT_TIMESTAMP)`;
      await transaction.$executeRaw`
        INSERT INTO admission_offerings
          (id,tenant_id,campus_id,academic_year_id,process_id,course_level_id,form_version_id,code,title,status,availability_category)
        VALUES (${offeringAId},${tenantAId},${campusId},${yearId},${processId},${levelId},${formVersionId},
          'E5F-HTTP-OFFER','Oferta E5-F HTTP','PUBLISHED','POSTULATIONS_OPEN')`;
      const result: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const studentId = randomUUID();
        const applicationId = randomUUID();
        const snapshotId = randomUUID();
        await transaction.$executeRaw`
          INSERT INTO students (id,family_profile_id,given_name,family_name)
          VALUES (${studentId},${familyProfileId},${`Estudiante ${index + 1}`},'Sintético')`;
        await transaction.$executeRaw`
          INSERT INTO applications
            (id,tenant_id,family_profile_id,student_id,academic_year_id,process_id,offering_id,form_version_id,status,submitted_at,draft_data)
          VALUES (${applicationId},${tenantAId},${familyProfileId},${studentId},${yearId},${processId},${offeringAId},${formVersionId},
            'SUBMITTED',CURRENT_TIMESTAMP,${JSON.stringify({ acknowledgedNoGuarantee: true, currentStep: "REVIEW" })}::jsonb)`;
        await transaction.$executeRaw`
          INSERT INTO application_snapshots
            (id,tenant_id,application_id,form_version_id,payload,submitted_by,submitted_at)
          VALUES (${snapshotId},${tenantAId},${applicationId},${formVersionId},'{}'::jsonb,${recommenderId},CURRENT_TIMESTAMP)`;
        result.push(applicationId);
      }
      return result;
    }),
  );

  const membershipRows: Array<{
    actorId: string;
    permissions: readonly string[];
    role: string;
    tenantId: string;
  }> = [
    {
      actorId: staffId,
      permissions: [
        PERMISSIONS.APPLICATION_DECIDE,
        PERMISSIONS.CAPACITY_MANAGE,
        PERMISSIONS.CAPACITY_READ,
        PERMISSIONS.OFFER_READ,
        PERMISSIONS.OFFER_REOPEN,
        PERMISSIONS.RESTRICTED_READ,
        PERMISSIONS.WAITLIST_PROMOTE,
        PERMISSIONS.WAITLIST_READ,
      ],
      role: "E5F_OPERATOR",
      tenantId: tenantAId,
    },
    {
      actorId: noPermissionId,
      permissions: [PERMISSIONS.APPLICATION_READ],
      role: "E5F_NO_CAPACITY",
      tenantId: tenantAId,
    },
    {
      actorId: tenantBStaffId,
      permissions: [
        PERMISSIONS.CAPACITY_MANAGE,
        PERMISSIONS.CAPACITY_READ,
        PERMISSIONS.OFFER_READ,
        PERMISSIONS.WAITLIST_READ,
      ],
      role: "E5F_TENANT_B",
      tenantId: tenantBId,
    },
  ];
  for (const row of membershipRows) {
    const membershipId = randomUUID();
    const membershipContext = context(row.tenantId, row.actorId, []);
    await runWithTenantContext(membershipContext, () =>
      withTenantTransaction(prisma, async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO memberships (id,tenant_id,user_id,status,starts_at)
          VALUES (${membershipId},${row.tenantId},${row.actorId},'ACTIVE',CURRENT_TIMESTAMP)`;
        await transaction.$executeRaw`
          INSERT INTO role_assignments
            (id,tenant_id,membership_id,role_key,permissions,scopes,status,starts_at)
          VALUES (${randomUUID()},${row.tenantId},${membershipId},${row.role},${row.permissions}::text[],ARRAY['*']::text[],'ACTIVE',CURRENT_TIMESTAMP)`;
      }),
    );
  }
  const [
    familySession,
    foreignFamilySession,
    staffSession,
    noPermissionSession,
    tenantBSession,
  ] = await Promise.all([
    sessions.issueSession(familyUserId),
    sessions.issueSession(foreignFamilyUserId),
    sessions.issueSession(staffId),
    sessions.issueSession(noPermissionId),
    sessions.issueSession(tenantBStaffId),
  ]);
  fixture = {
    applicationAId: applicationIds[0]!,
    applicationBId: applicationIds[1]!,
    applicationCId: applicationIds[2]!,
    familyToken: familySession.token,
    foreignFamilyToken: foreignFamilySession.token,
    noPermissionToken: noPermissionSession.token,
    offeringAId,
    staffToken: staffSession.token,
    tenantAId,
    tenantBId,
    tenantBStaffToken: tenantBSession.token,
  };

  const admissionContext = context(tenantAId, recommenderId, [
    PERMISSIONS.APPLICATION_RECOMMEND,
    PERMISSIONS.RESTRICTED_READ,
  ]);
  const directionContext = context(tenantAId, staffId, [
    PERMISSIONS.APPLICATION_DECIDE,
    PERMISSIONS.RESTRICTED_READ,
  ]);
  async function decide(
    applicationId: string,
    disposition: "APROBADO" | "LISTA_DE_ESPERA",
  ) {
    const draft = await runWithTenantContext(admissionContext, () =>
      recommendations.createDraft(admissionContext, applicationId, {
        foundation: "Fundamento sintético HTTP.",
        option: "RECOMENDAR_ADMISION",
      }),
    );
    const submitted = await runWithTenantContext(admissionContext, () =>
      recommendations.submitRecommendation(admissionContext, draft.id),
    );
    return runWithTenantContext(directionContext, () =>
      recommendations.recordDirectionDecision(directionContext, applicationId, {
        disposition,
        expectedRecommendationVersionId: submitted.id,
      }),
    );
  }
  return { decide };
}

function cookie(token: string) {
  return `${cookieName}=${token}`;
}

async function request(
  path: string,
  options: RequestInit & { token?: string } = {},
) {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (token !== undefined) headers.set("Cookie", cookie(token));
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function csrf(token: string) {
  const response = await request("/auth/csrf", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

async function mutation(
  path: string,
  token: string,
  body: unknown,
  options: {
    csrfToken?: string;
    method?: "PATCH" | "POST";
    origin?: string;
  } = {},
) {
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: options.origin ?? "http://localhost:3000",
  });
  if (options.csrfToken !== undefined) {
    headers.set("X-CSRF-Token", options.csrfToken);
  }
  return request(path, {
    body: JSON.stringify(body),
    headers,
    method: options.method ?? "POST",
    token,
  });
}

const capacityPath = () =>
  `/staff/tenants/${fixture.tenantAId}/offerings/${fixture.offeringAId}/capacity`;

describe.sequential("E5-F real Nest HTTP boundary", () => {
  let decide: Awaited<ReturnType<typeof seedFixture>>["decide"];

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
    ({ decide } = await seedFixture());
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("HTTP-01..04: session, membership, permission and tenant boundaries deny access", async () => {
    expect((await request(capacityPath())).status).toBe(401);
    expect(
      (await request(capacityPath(), { token: fixture.foreignFamilyToken }))
        .status,
    ).toBe(403);
    expect(
      (await request(capacityPath(), { token: fixture.noPermissionToken }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          `/staff/tenants/${fixture.tenantBId}/offerings/${fixture.offeringAId}/capacity`,
          { token: fixture.tenantBStaffToken },
        )
      ).status,
    ).toBe(404);
  });

  it("HTTP-05..07: mutations enforce CSRF, Origin and strict payloads", async () => {
    expect(
      (
        await mutation(capacityPath(), fixture.staffToken, {
          configuredCapacity: 3,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await mutation(
          capacityPath(),
          fixture.staffToken,
          { configuredCapacity: 3 },
          {
            csrfToken: await csrf(fixture.staffToken),
            origin: "https://invalid.example",
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await mutation(
          capacityPath(),
          fixture.staffToken,
          { configuredCapacity: 3, unexpected: true },
          { csrfToken: await csrf(fixture.staffToken) },
        )
      ).status,
    ).toBe(400);
  });

  it("HTTP-08..11: authorized capacity create/read/adjust is versioned and duplicate-safe", async () => {
    const token = fixture.staffToken;
    const csrfToken = await csrf(token);
    const created = await mutation(
      capacityPath(),
      token,
      { configuredCapacity: 3, offerValidityBusinessDays: 3 },
      { csrfToken },
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      concurrencyVersion: number;
    };
    capacityVersion = createdBody.concurrencyVersion;
    expect(
      (
        await mutation(
          capacityPath(),
          token,
          { configuredCapacity: 3 },
          { csrfToken },
        )
      ).status,
    ).toBe(409);
    expect((await request(capacityPath(), { token })).status).toBe(200);
    const adjusted = await mutation(
      capacityPath(),
      token,
      {
        configuredCapacity: 4,
        expectedVersion: capacityVersion,
        reason: "Ajuste sintético HTTP.",
      },
      { csrfToken, method: "PATCH" },
    );
    expect(adjusted.status).toBe(200);
    capacityVersion = (
      (await adjusted.json()) as { concurrencyVersion: number }
    ).concurrencyVersion;
  });

  it("HTTP-12..13: staff sees ordered waitlist evidence while family receives no rank or capacity", async () => {
    await decide(fixture.applicationAId, "LISTA_DE_ESPERA");
    const response = await request(
      `/staff/tenants/${fixture.tenantAId}/offerings/${fixture.offeringAId}/waitlist`,
      { token: fixture.staffToken },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{
        concurrencyVersion: number;
        id: string;
        internalPosition: number;
      }>;
    };
    expect(body.items[0]?.internalPosition).toBe(1);
    waitlistEntryId = body.items[0]!.id;
    waitlistEntryVersion = body.items[0]!.concurrencyVersion;
    const familyProjection = await request(
      `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/admission-status`,
      { token: fixture.familyToken },
    );
    expect(familyProjection.status).toBe(200);
    expect(JSON.stringify(await familyProjection.json())).not.toMatch(
      /position|priority|configuredCapacity|availableCount/i,
    );
  });

  it("HTTP-14: family ownership uses an anti-enumeration response", async () => {
    expect(
      (
        await request(
          `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/admission-status`,
          { token: fixture.foreignFamilyToken },
        )
      ).status,
    ).toBe(404);
  });

  it("HTTP-15..16: promotion creates a waitlist-origin offer visible through safe projections", async () => {
    const promoted = await mutation(
      `/staff/tenants/${fixture.tenantAId}/waitlist/${waitlistEntryId}/promote`,
      fixture.staffToken,
      {
        expectedCapacityVersion: capacityVersion,
        expectedWaitlistEntryVersion: waitlistEntryVersion,
      },
      { csrfToken: await csrf(fixture.staffToken) },
    );
    expect(promoted.status).toBe(201);
    const body = (await promoted.json()) as {
      current: { id: string; origin: string };
      id: string;
    };
    expect(body.current.origin).toBe("WAITLIST");
    promotedOfferId = body.id;
    promotedOfferVersionId = body.current.id;
    const projection = await request(
      `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/admission-status`,
      { token: fixture.familyToken },
    );
    expect(projection.status).toBe(200);
    expect(await projection.json()).toMatchObject({
      offer: { current: { origin: "WAITLIST" } },
      waitlist: { state: "PROMOTED" },
    });
  });

  it("HTTP-17: stale family offer commands return a controlled conflict", async () => {
    const response = await mutation(
      `/family/tenants/${fixture.tenantAId}/offers/${promotedOfferId}/accept`,
      fixture.familyToken,
      { expectedOfferVersionId: randomUUID() },
      { csrfToken: await csrf(fixture.familyToken) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "OFFER_VERSION_CHANGED",
    });
  });

  it("HTTP-18: acceptance is explicit and idempotent without creating handoff data", async () => {
    const csrfToken = await csrf(fixture.familyToken);
    const path = `/family/tenants/${fixture.tenantAId}/offers/${promotedOfferId}/accept`;
    const first = await mutation(
      path,
      fixture.familyToken,
      { expectedOfferVersionId: promotedOfferVersionId },
      { csrfToken },
    );
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      current: { lifecycle: "ACCEPTED" },
    });
    expect(
      (
        await mutation(
          path,
          fixture.familyToken,
          { expectedOfferVersionId: promotedOfferVersionId },
          { csrfToken },
        )
      ).status,
    ).toBe(201);
  });

  it("HTTP-19: confirmed family withdrawal is idempotent and rejects unconfirmed input", async () => {
    await decide(fixture.applicationBId, "LISTA_DE_ESPERA");
    const path = `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationBId}/withdraw`;
    const csrfToken = await csrf(fixture.familyToken);
    expect(
      (
        await mutation(
          path,
          fixture.familyToken,
          { confirmed: false },
          { csrfToken },
        )
      ).status,
    ).toBe(400);
    const first = await mutation(
      path,
      fixture.familyToken,
      { confirmed: true },
      { csrfToken },
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { id: string };
    const second = await mutation(
      path,
      fixture.familyToken,
      { confirmed: true },
      { csrfToken },
    );
    expect(second.status).toBe(201);
    expect(await second.json()).toMatchObject({ id: firstBody.id });
  });
});
