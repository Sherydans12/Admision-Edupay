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

type RecommendationHttpFixture = {
  applicationAId: string;
  applicationBId: string;
  directorToken: string;
  familyToken: string;
  noDecideToken: string;
  noRecommendToken: string;
  recommenderToken: string;
  tenantAId: string;
  tenantBId: string;
  tenantBMemberToken: string;
};

let app: INestApplication;
let baseUrl = "";
let fixture: RecommendationHttpFixture;
let sessions: SessionService;
let submittedV1Id = "";
let submittedV2Id = "";

async function clearTables(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "direction_decision_versions", "direction_decisions",
    "admission_recommendation_versions", "admission_recommendations",
    "application_snapshots", "applications", "admission_offerings",
    "admission_processes", "course_levels", "academic_years", "campuses",
    "students", "family_profiles", "role_assignments", "memberships",
    "platform_sessions", "platform_users", "audit_events", "outbox_messages",
    "tenant_probe_records", "tenants" CASCADE`);
}

async function seedApplication(
  tenantId: string,
  actorId: string,
  familyProfileId: string,
  studentId: string,
  suffix: string,
): Promise<string> {
  const campusId = randomUUID();
  const yearId = randomUUID();
  const levelId = randomUUID();
  const processId = randomUUID();
  const formDefinitionId = randomUUID();
  const formVersionId = randomUUID();
  const offeringId = randomUUID();
  const applicationId = randomUUID();
  const snapshotId = randomUUID();
  const context: TenantExecutionContext = {
    actorId,
    capabilities: [],
    contextOrigin: "synthetic_test",
    correlationId: `e5ee-http-${suffix}-${tenantId}`,
    effectiveActorId: actorId,
    purpose: "E5EE_HTTP_TEST",
    source: "trusted_job",
    tenantId,
  };

  await runWithTenantContext(context, () =>
    withTenantTransaction(prisma, async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO campuses (id, tenant_id, code, name)
        VALUES (${campusId}, ${tenantId}, ${`E5EE-HTTP-CAMPUS-${suffix}`}, ${`Sede E5-E HTTP ${suffix}`})`;
      await transaction.$executeRaw`
        INSERT INTO academic_years (id, tenant_id, code, label, status)
        VALUES (${yearId}, ${tenantId}, ${`E5EE-HTTP-YEAR-${suffix}`}, ${`Año E5-E HTTP ${suffix}`}, 'OPEN')`;
      await transaction.$executeRaw`
        INSERT INTO course_levels (id, tenant_id, code, name)
        VALUES (${levelId}, ${tenantId}, ${`E5EE-HTTP-LEVEL-${suffix}`}, ${`Nivel E5-E HTTP ${suffix}`})`;
      await transaction.$executeRaw`
        INSERT INTO admission_processes (id, tenant_id, academic_year_id, code, name, status)
        VALUES (${processId}, ${tenantId}, ${yearId}, ${`E5EE-HTTP-PROCESS-${suffix}`}, ${`Proceso E5-E HTTP ${suffix}`}, 'PUBLISHED')`;
      await transaction.$executeRaw`
        INSERT INTO form_definitions (id, tenant_id, name, purpose)
        VALUES (${formDefinitionId}, ${tenantId}, ${`Formulario E5-E HTTP ${suffix}`}, 'admission_application')`;
      await transaction.$executeRaw`
        INSERT INTO form_versions
          (id, tenant_id, form_definition_id, version_number, lifecycle, published_at)
        VALUES
          (${formVersionId}, ${tenantId}, ${formDefinitionId}, 1, 'PUBLISHED', CURRENT_TIMESTAMP)`;
      await transaction.$executeRaw`
        INSERT INTO admission_offerings
          (id, tenant_id, campus_id, academic_year_id, process_id, course_level_id,
           form_version_id, code, title, status, availability_category)
        VALUES
          (${offeringId}, ${tenantId}, ${campusId}, ${yearId}, ${processId}, ${levelId}, ${formVersionId},
           ${`E5EE-HTTP-OFFER-${suffix}`}, ${`Oferta E5-E HTTP ${suffix}`}, 'PUBLISHED', 'POSTULATIONS_OPEN')`;
      await transaction.$executeRaw`
        INSERT INTO applications
          (id, tenant_id, family_profile_id, student_id, academic_year_id, process_id,
           offering_id, form_version_id, status, submitted_at, draft_data)
        VALUES
          (${applicationId}, ${tenantId}, ${familyProfileId}, ${studentId}, ${yearId}, ${processId},
           ${offeringId}, ${formVersionId}, 'SUBMITTED', CURRENT_TIMESTAMP,
           ${JSON.stringify({ acknowledgedNoGuarantee: true, currentStep: "REVIEW" })}::jsonb)`;
      await transaction.$executeRaw`
        INSERT INTO application_snapshots
          (id, tenant_id, application_id, form_version_id, payload, submitted_by, submitted_at)
        VALUES
          (${snapshotId}, ${tenantId}, ${applicationId}, ${formVersionId},
           ${JSON.stringify({ schemaVersion: 1, synthetic: true })}::jsonb, ${actorId}, CURRENT_TIMESTAMP)`;
    }),
  );
  return applicationId;
}

async function seedFixture(): Promise<void> {
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const familyUserId = randomUUID();
  const familyBUserId = randomUUID();
  const recommenderId = randomUUID();
  const directorId = randomUUID();
  const noRecommendId = randomUUID();
  const noDecideId = randomUUID();
  const tenantBMemberId = randomUUID();
  const familyProfileAId = randomUUID();
  const familyProfileBId = randomUUID();
  const studentAId = randomUUID();
  const studentBId = randomUUID();

  await migrationPool.query(
    `INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)`,
    [
      tenantAId,
      "Tenant A E5-E HTTP sintético",
      tenantBId,
      "Tenant B E5-E HTTP sintético",
    ],
  );
  const userRows = [
    [familyUserId, `e5ee-http-family-a-${familyUserId}@example.invalid`],
    [familyBUserId, `e5ee-http-family-b-${familyBUserId}@example.invalid`],
    [recommenderId, `e5ee-http-recommender-${recommenderId}@example.invalid`],
    [directorId, `e5ee-http-director-${directorId}@example.invalid`],
    [noRecommendId, `e5ee-http-no-recommend-${noRecommendId}@example.invalid`],
    [noDecideId, `e5ee-http-no-decide-${noDecideId}@example.invalid`],
    [tenantBMemberId, `e5ee-http-tenant-b-${tenantBMemberId}@example.invalid`],
  ];
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized) VALUES ${userRows
      .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
      .join(", ")}`,
    userRows.flat(),
  );
  await migrationPool.query(
    `INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3), ($4, $5, $6)`,
    [
      familyProfileAId,
      familyUserId,
      "Familia E5-E HTTP A",
      familyProfileBId,
      familyBUserId,
      "Familia E5-E HTTP B",
    ],
  );
  await migrationPool.query(
    `INSERT INTO students (id, family_profile_id, given_name, family_name)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      studentAId,
      familyProfileAId,
      "Estudiante",
      "Sintético A",
      studentBId,
      familyProfileBId,
      "Estudiante",
      "Sintético B",
    ],
  );

  const applicationAId = await seedApplication(
    tenantAId,
    recommenderId,
    familyProfileAId,
    studentAId,
    "A",
  );
  const applicationBId = await seedApplication(
    tenantBId,
    tenantBMemberId,
    familyProfileBId,
    studentBId,
    "B",
  );

  const memberships: Array<[string, string, string, string]> = [
    [randomUUID(), tenantAId, recommenderId, "RECOMMENDER_AND_DIRECTOR"],
    [randomUUID(), tenantAId, directorId, "DIRECTOR"],
    [randomUUID(), tenantAId, noRecommendId, "NO_RECOMMEND"],
    [randomUUID(), tenantAId, noDecideId, "NO_DECIDE"],
    [randomUUID(), tenantBId, tenantBMemberId, "TENANT_B_RECOMMENDER"],
  ];
  const membershipIds = memberships.map(([id]) => id);
  const roles: Array<[string, string, string, readonly string[]]> = [
    [
      tenantAId,
      membershipIds[0]!,
      "RECOMMENDER_AND_DIRECTOR",
      [
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_RECOMMEND,
        PERMISSIONS.APPLICATION_DECIDE,
        PERMISSIONS.RESTRICTED_READ,
      ],
    ],
    [
      tenantAId,
      membershipIds[1]!,
      "DIRECTOR",
      [
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_DECIDE,
        PERMISSIONS.RESTRICTED_READ,
      ],
    ],
    [
      tenantAId,
      membershipIds[2]!,
      "NO_RECOMMEND",
      [PERMISSIONS.APPLICATION_READ, PERMISSIONS.RESTRICTED_READ],
    ],
    [
      tenantAId,
      membershipIds[3]!,
      "NO_DECIDE",
      [PERMISSIONS.APPLICATION_READ, PERMISSIONS.RESTRICTED_READ],
    ],
    [
      tenantBId,
      membershipIds[4]!,
      "TENANT_B_RECOMMENDER",
      [
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_RECOMMEND,
        PERMISSIONS.RESTRICTED_READ,
      ],
    ],
  ];
  for (const [tenantId, membershipId, roleKey, permissions] of roles) {
    const membership = memberships.find(([id]) => id === membershipId);
    if (membership === undefined)
      throw new Error("Missing synthetic membership");
    await runWithTenantContext(
      {
        actorId: membership[2],
        capabilities: [],
        contextOrigin: "synthetic_test",
        correlationId: `e5ee-http-membership-${membershipId}`,
        effectiveActorId: membership[2],
        purpose: "E5EE_HTTP_TEST",
        source: "trusted_job",
        tenantId,
      },
      () =>
        withTenantTransaction(prisma, async (transaction) => {
          await transaction.$executeRaw`
            INSERT INTO memberships (id, tenant_id, user_id, status, starts_at)
            VALUES (${membership[0]}, ${tenantId}, ${membership[2]}, 'ACTIVE', CURRENT_TIMESTAMP)`;
          await transaction.$executeRaw`
            INSERT INTO role_assignments
              (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at)
            VALUES
              (${randomUUID()}, ${tenantId}, ${membershipId}, ${roleKey}, ${permissions}::text[], ARRAY['*']::text[], 'ACTIVE', CURRENT_TIMESTAMP)`;
        }),
    );
  }

  const [
    familySession,
    recommenderSession,
    directorSession,
    noRecommendSession,
    noDecideSession,
    tenantBMemberSession,
  ] = await Promise.all([
    sessions.issueSession(familyUserId),
    sessions.issueSession(recommenderId),
    sessions.issueSession(directorId),
    sessions.issueSession(noRecommendId),
    sessions.issueSession(noDecideId),
    sessions.issueSession(tenantBMemberId),
  ]);
  fixture = {
    applicationAId,
    applicationBId,
    directorToken: directorSession.token,
    familyToken: familySession.token,
    noDecideToken: noDecideSession.token,
    noRecommendToken: noRecommendSession.token,
    recommenderToken: recommenderSession.token,
    tenantAId,
    tenantBId,
    tenantBMemberToken: tenantBMemberSession.token,
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
  options: { method?: "PATCH" | "POST"; origin?: string } = {},
): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: options.origin ?? "http://localhost:3000",
  });
  if (csrfToken !== undefined) headers.set("X-CSRF-Token", csrfToken);
  return request(path, {
    body: JSON.stringify(body),
    headers,
    method: options.method ?? "POST",
    token,
  });
}

const recommendationWorkspacePath = () =>
  `/staff/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/recommendation-workspace`;
const draftPath = () =>
  `/staff/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/recommendations/drafts`;
const directionPath = () =>
  `/staff/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/direction-decisions`;

async function decisionVersionCount(): Promise<number> {
  return runWithTenantContext(
    {
      actorId: "e5ee-http-decision-count",
      capabilities: [],
      contextOrigin: "synthetic_test",
      correlationId: `e5ee-http-decision-count-${fixture.tenantAId}`,
      purpose: "E5EE_HTTP_TEST",
      source: "trusted_job",
      tenantId: fixture.tenantAId,
    },
    () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.directionDecisionVersion.count({
          where: { applicationId: fixture.applicationAId },
        }),
      ),
  );
}

describe.sequential(
  "E5-E real Nest HTTP recommendation and direction boundary",
  () => {
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

    it("E5EE-HTTP-01: protected recommendation reads require an opaque session", async () => {
      expect((await request(recommendationWorkspacePath())).status).toBe(401);
    });

    it("E5EE-HTTP-02: an authenticated actor without tenant membership is denied", async () => {
      expect(
        (
          await request(recommendationWorkspacePath(), {
            token: fixture.tenantBMemberToken,
          })
        ).status,
      ).toBe(403);
    });

    it("E5EE-HTTP-03 and AC-023: membership without application.recommend cannot read, create, edit, or submit", async () => {
      const token = fixture.noRecommendToken;
      const csrfToken = await csrf(token);
      expect(
        (await request(recommendationWorkspacePath(), { token })).status,
      ).toBe(403);
      expect(
        (
          await mutation(draftPath(), token, csrfToken, {
            foundation: "Fundamento sintético",
            option: "RECOMENDAR_ADMISION",
          })
        ).status,
      ).toBe(403);
    });

    it("E5EE-HTTP-04 and AC-028: membership without application.decide cannot read or decide", async () => {
      const token = fixture.noDecideToken;
      const csrfToken = await csrf(token);
      expect(
        (
          await request(
            `/staff/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/direction-workspace`,
            { token },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await mutation(directionPath(), token, csrfToken, {
            disposition: "APROBADO",
            expectedRecommendationVersionId: randomUUID(),
          })
        ).status,
      ).toBe(403);
    });

    it("E5EE-HTTP-05: recommendation mutations require CSRF", async () => {
      expect(
        (
          await mutation(draftPath(), fixture.recommenderToken, undefined, {
            foundation: "Fundamento sin CSRF",
            option: "RECOMENDAR_ADMISION",
          })
        ).status,
      ).toBe(403);
    });

    it("E5EE-HTTP-06: direction mutations reject invalid Origin even with CSRF", async () => {
      const token = fixture.directorToken;
      expect(
        (
          await mutation(
            directionPath(),
            token,
            await csrf(token),
            {
              disposition: "APROBADO",
              expectedRecommendationVersionId: randomUUID(),
            },
            { origin: "https://invalid.example" },
          )
        ).status,
      ).toBe(403);
    });

    it("E5EE-HTTP-07: authorized staff creates, edits, and submits a DRAFT through HTTP", async () => {
      const token = fixture.recommenderToken;
      const csrfToken = await csrf(token);
      const created = await mutation(draftPath(), token, csrfToken, {
        foundation: "Fundamento interno V1 sintético.",
        option: "RECOMENDAR_ADMISION",
      });
      expect(created.status).toBe(201);
      const draft = (await created.json()) as { id: string; lifecycle: string };
      expect(draft.lifecycle).toBe("DRAFT");
      const updated = await mutation(
        `/staff/tenants/${fixture.tenantAId}/recommendation-versions/${draft.id}`,
        token,
        csrfToken,
        {
          foundation: "Fundamento interno V1 actualizado sintético.",
          option: "RECOMENDAR_ADMISION",
        },
        { method: "PATCH" },
      );
      expect(updated.status).toBe(200);
      const submitted = await mutation(
        `/staff/tenants/${fixture.tenantAId}/recommendation-versions/${draft.id}/submit`,
        token,
        csrfToken,
        {},
      );
      expect(submitted.status).toBe(201);
      const body = (await submitted.json()) as {
        id: string;
        lifecycle: string;
      };
      expect(body.lifecycle).toBe("SUBMITTED");
      submittedV1Id = body.id;
    });

    it("E5EE-HTTP-03: membership without application.recommend cannot edit or submit an existing recommendation", async () => {
      const token = fixture.noRecommendToken;
      const csrfToken = await csrf(token);
      expect(
        (
          await mutation(
            `/staff/tenants/${fixture.tenantAId}/recommendation-versions/${submittedV1Id}`,
            token,
            csrfToken,
            {
              foundation: "Fundamento sintético",
              option: "RECOMENDAR_ADMISION",
            },
            { method: "PATCH" },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await mutation(
            `/staff/tenants/${fixture.tenantAId}/recommendation-versions/${submittedV1Id}/submit`,
            token,
            csrfToken,
            {},
          )
        ).status,
      ).toBe(403);
    });

    it("E5EE-HTTP-08: return, V2, and stale recommendation version return a controlled conflict", async () => {
      const directionToken = fixture.directorToken;
      const decision = await mutation(
        directionPath(),
        directionToken,
        await csrf(directionToken),
        {
          disposition: "DEVUELTO_A_REVISION",
          expectedRecommendationVersionId: submittedV1Id,
          reason: "Completar antecedente sintético.",
        },
      );
      expect(decision.status).toBe(201);

      const recommenderToken = fixture.recommenderToken;
      const createdV2 = await mutation(
        draftPath(),
        recommenderToken,
        await csrf(recommenderToken),
        {
          foundation: "Fundamento interno V2 sintético.",
          option: "RECOMENDAR_ADMISION",
        },
      );
      expect(createdV2.status).toBe(201);
      const draftV2 = (await createdV2.json()) as { id: string };
      const submittedV2 = await mutation(
        `/staff/tenants/${fixture.tenantAId}/recommendation-versions/${draftV2.id}/submit`,
        recommenderToken,
        await csrf(recommenderToken),
        {},
      );
      expect(submittedV2.status).toBe(201);
      submittedV2Id = ((await submittedV2.json()) as { id: string }).id;

      const stale = await mutation(
        directionPath(),
        directionToken,
        await csrf(directionToken),
        {
          disposition: "APROBADO",
          expectedRecommendationVersionId: submittedV1Id,
        },
      );
      expect(stale.status).toBe(409);
      expect((await stale.json()) as { code: string }).toMatchObject({
        code: "RECOMMENDATION_VERSION_CHANGED",
      });
    });

    it("E5EE-HTTP-09 and E5EE-SOD-01: the effective recommender cannot decide and inserts no version", async () => {
      const before = await decisionVersionCount();
      const token = fixture.recommenderToken;
      const response = await mutation(
        directionPath(),
        token,
        await csrf(token),
        {
          disposition: "APROBADO",
          expectedRecommendationVersionId: submittedV2Id,
        },
      );
      expect(response.status).toBe(403);
      await expect(decisionVersionCount()).resolves.toBe(before);
    });

    it("E5EE-HTTP-10 and E5EE-HTTP-11: invalid rejection and return inputs are controlled 400 responses", async () => {
      const token = fixture.directorToken;
      const csrfToken = await csrf(token);
      expect(
        (
          await mutation(directionPath(), token, csrfToken, {
            disposition: "RECHAZADO",
            expectedRecommendationVersionId: submittedV2Id,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await mutation(directionPath(), token, csrfToken, {
            disposition: "DEVUELTO_A_REVISION",
            expectedRecommendationVersionId: submittedV2Id,
          })
        ).status,
      ).toBe(400);
    });

    it("E5EE-HTTP-12: a Tenant B member receives the established anti-enumeration response for Tenant A application", async () => {
      const response = await request(
        `/staff/tenants/${fixture.tenantBId}/applications/${fixture.applicationAId}/recommendation-workspace`,
        { token: fixture.tenantBMemberToken },
      );
      expect(response.status).toBe(404);
    });

    it("E5EE-PRIV-01..06: family projections and routes disclose neither recommendation nor internal direction evidence", async () => {
      const application = await request(
        `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}`,
        { token: fixture.familyToken },
      );
      expect(application.status).toBe(200);
      const projection = JSON.stringify(await application.json());
      expect(projection).not.toContain("RECOMENDAR_ADMISION");
      expect(projection).not.toContain("Fundamento interno V2 sintético.");
      expect(projection).not.toContain("DEVUELTO_A_REVISION");
      expect(projection).not.toContain("Completar antecedente sintético.");
      expect(projection).not.toContain("evidenceManifest");
      expect(projection).not.toContain("activityResultIds");

      expect(
        (
          await request(
            `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/recommendations`,
            { token: fixture.familyToken },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            `/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationAId}/direction-decisions`,
            { token: fixture.familyToken },
          )
        ).status,
      ).toBe(404);
    });
  },
);
