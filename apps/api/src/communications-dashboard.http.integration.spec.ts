import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  createAppPrismaClient,
  NoopAuditSink,
  NoopSecurityEventSink,
  PERMISSIONS,
  runWithTenantContext,
  SessionService,
  type TenantExecutionContext,
  withTenantTransaction,
  RecommendationService,
  CommunicationService,
} from "@admission/database";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";
import { configureAdmissionApp } from "./app-bootstrap.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  max: 2,
});
const recommendations = new RecommendationService(prisma);
const communications = new CommunicationService(prisma);

const cookieName = "admission_session";

type Fixture = {
  applicationId: string;
  communicationId: string;
  familyProfileId: string;
  familyToken: string;
  foreignFamilyToken: string;
  noPermissionToken: string;
  secretaryToken: string;
  staffToken: string;
  studentId: string;
  tenantAId: string;
  tenantBId: string;
};

let app: INestApplication;
let baseUrl = "";
let fixture: Fixture;
let sessions: SessionService;

function context(
  tenantId: string,
  actorId: string,
  capabilities: readonly string[],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5g-http-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5G_HTTP_SPEC",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function createToken(userId: string) {
  const issued = await sessions.issueSession(userId);
  return issued.token;
}

async function fetchCsrfToken(cookieToken: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/csrf`, {
    headers: { Cookie: `${cookieName}=${cookieToken}` },
  });
  expect(response.status).toBe(200);
  const data = (await response.json()) as { token: string };
  return data.token;
}

describe("E5-G Communications and Dashboard HTTP API", () => {
  beforeAll(async () => {
    sessions = new SessionService(prisma, {
      auditSink: new NoopAuditSink(),
      securityEvents: new NoopSecurityEventSink(),
    });
    app = await NestFactory.create(AppModule, { logger: false });
    configureAdmissionApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();

    const tenantAId = randomUUID();
    const tenantBId = randomUUID();

    const staffUserId = randomUUID();
    const directionUserId = randomUUID();
    const secretaryUserId = randomUUID();
    const noPermissionUserId = randomUUID();
    const familyUserId = randomUUID();
    const foreignFamilyUserId = randomUUID();

    const familyProfileId = randomUUID();
    const foreignFamilyProfileId = randomUUID();

    const studentId = randomUUID();
    const foreignStudentId = randomUUID();

    await migrationPool.query(
      "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
      [tenantAId, "HTTP Tenant A", tenantBId, "HTTP Tenant B"],
    );

    await migrationPool.query(
      "INSERT INTO platform_users (id, email_normalized) VALUES ($1,$2), ($3,$4), ($5,$6), ($7,$8), ($9,$10), ($11,$12)",
      [
        staffUserId,
        `staff-${staffUserId}@example.invalid`,
        directionUserId,
        `dir-${directionUserId}@example.invalid`,
        secretaryUserId,
        `sec-${secretaryUserId}@example.invalid`,
        noPermissionUserId,
        `noperm-${noPermissionUserId}@example.invalid`,
        familyUserId,
        `family-${familyUserId}@example.invalid`,
        foreignFamilyUserId,
        `foreign-${foreignFamilyUserId}@example.invalid`,
      ],
    );

    await migrationPool.query(
      "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1,$2,$3), ($4,$5,$6)",
      [
        familyProfileId,
        familyUserId,
        "Familia HTTP A",
        foreignFamilyProfileId,
        foreignFamilyUserId,
        "Familia HTTP B",
      ],
    );

    await migrationPool.query(
      "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1,$2,'Estudiante','HTTP'), ($3,$4,'Estudiante','B')",
      [studentId, familyProfileId, foreignStudentId, foreignFamilyProfileId],
    );

    // Memberships & Role Assignments
    const mStaff = randomUUID();
    const mDir = randomUUID();
    const mSec = randomUUID();
    const mNoPerm = randomUUID();

    const staffPermissions = [
      PERMISSIONS.APPLICATION_RECOMMEND,
      PERMISSIONS.COMMUNICATION_READ,
      PERMISSIONS.COMMUNICATION_CONFIRM,
      PERMISSIONS.COMMUNICATION_RETRY,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.MANUAL_CONTACT_RECORD,
      PERMISSIONS.RESTRICTED_READ,
    ];
    const directionPermissions = [
      PERMISSIONS.APPLICATION_DECIDE,
      PERMISSIONS.RESTRICTED_READ,
    ];
    const secretaryPermissions = [
      PERMISSIONS.COMMUNICATION_READ,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.APPLICATION_READ,
    ];

    await runWithTenantContext(context(tenantAId, staffUserId, []), () =>
      withTenantTransaction(prisma, async (tx) => {
        await tx.$executeRaw`INSERT INTO memberships (id, tenant_id, user_id, status, starts_at) VALUES (${mStaff}, ${tenantAId}, ${staffUserId}, 'ACTIVE', NOW() - INTERVAL '1 day')`;
        await tx.$executeRaw`INSERT INTO memberships (id, tenant_id, user_id, status, starts_at) VALUES (${mDir}, ${tenantAId}, ${directionUserId}, 'ACTIVE', NOW() - INTERVAL '1 day')`;
        await tx.$executeRaw`INSERT INTO memberships (id, tenant_id, user_id, status, starts_at) VALUES (${mSec}, ${tenantAId}, ${secretaryUserId}, 'ACTIVE', NOW() - INTERVAL '1 day')`;
        await tx.$executeRaw`INSERT INTO memberships (id, tenant_id, user_id, status, starts_at) VALUES (${mNoPerm}, ${tenantAId}, ${noPermissionUserId}, 'ACTIVE', NOW() - INTERVAL '1 day')`;

        await tx.$executeRaw`INSERT INTO role_assignments (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at) VALUES (${randomUUID()}, ${tenantAId}, ${mStaff}, 'recommender', ${staffPermissions}::text[], ARRAY['*']::text[], 'ACTIVE', NOW() - INTERVAL '1 day')`;
        await tx.$executeRaw`INSERT INTO role_assignments (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at) VALUES (${randomUUID()}, ${tenantAId}, ${mDir}, 'direction', ${directionPermissions}::text[], ARRAY['*']::text[], 'ACTIVE', NOW() - INTERVAL '1 day')`;
        await tx.$executeRaw`INSERT INTO role_assignments (id, tenant_id, membership_id, role_key, permissions, scopes, status, starts_at) VALUES (${randomUUID()}, ${tenantAId}, ${mSec}, 'secretary', ${secretaryPermissions}::text[], ARRAY['*']::text[], 'ACTIVE', NOW() - INTERVAL '1 day')`;
      }),
    );

    // Setup domain resources for tenant A
    let applicationId = "";
    let commId = "";

    await runWithTenantContext(
      context(tenantAId, staffUserId, [
        PERMISSIONS.APPLICATION_RECOMMEND,
        PERMISSIONS.RESTRICTED_READ,
      ]),
      () =>
        withTenantTransaction(prisma, async (tx) => {
          const campus = await tx.campus.create({
            data: { code: "CAMP-HTTP", name: "Sede HTTP", tenantId: tenantAId },
          });
          const year = await tx.academicYear.create({
            data: {
              code: "YEAR-HTTP",
              label: "Año HTTP",
              status: "OPEN",
              tenantId: tenantAId,
            },
          });
          const level = await tx.courseLevel.create({
            data: { code: "LEV-HTTP", name: "Nivel HTTP", tenantId: tenantAId },
          });
          const process = await tx.admissionProcess.create({
            data: {
              academicYearId: year.id,
              code: "PROC-HTTP",
              name: "Proceso HTTP",
              status: "PUBLISHED",
              tenantId: tenantAId,
            },
          });
          const formDef = await tx.formDefinition.create({
            data: {
              name: "Form HTTP",
              purpose: "admission",
              tenantId: tenantAId,
            },
          });
          const formVer = await tx.formVersion.create({
            data: {
              formDefinitionId: formDef.id,
              lifecycle: "PUBLISHED",
              publishedAt: new Date(),
              tenantId: tenantAId,
              versionNumber: 1,
            },
          });

          const offering = await tx.admissionOffering.create({
            data: {
              academicYearId: year.id,
              availabilityCategory: "POSTULATIONS_OPEN",
              campusId: campus.id,
              code: "OFF-HTTP",
              courseLevelId: level.id,
              formVersionId: formVer.id,
              processId: process.id,
              status: "PUBLISHED",
              tenantId: tenantAId,
              title: "Oferta HTTP",
            },
          });

          await tx.admissionCapacity.create({
            data: {
              configuredCapacity: 50,
              offeringId: offering.id,
              tenantId: tenantAId,
            },
          });

          const submittedAt = new Date();
          const app = await tx.application.create({
            data: {
              academicYearId: year.id,
              draftData: { currentStep: "REVIEW" },
              familyProfileId,
              formVersionId: formVer.id,
              offeringId: offering.id,
              processId: process.id,
              status: "SUBMITTED",
              studentId,
              submittedAt,
              tenantId: tenantAId,
            },
          });
          applicationId = app.id;

          await tx.applicationSnapshot.create({
            data: {
              applicationId: app.id,
              formVersionId: formVer.id,
              payload: { answers: {} },
              schemaVersion: 1,
              submittedAt,
              submittedBy: staffUserId,
              tenantId: tenantAId,
            },
          });
        }),
    );

    // Create decision & PREPARED communication after initial seeding commits
    const recDraft = await runWithTenantContext(
      context(tenantAId, staffUserId, [
        PERMISSIONS.APPLICATION_RECOMMEND,
        PERMISSIONS.RESTRICTED_READ,
      ]),
      () =>
        recommendations.createDraft(
          context(tenantAId, staffUserId, [
            PERMISSIONS.APPLICATION_RECOMMEND,
            PERMISSIONS.RESTRICTED_READ,
          ]),
          applicationId,
          { foundation: "Rec OK", option: "RECOMENDAR_ADMISION" },
        ),
    );
    const subRec = await runWithTenantContext(
      context(tenantAId, staffUserId, [
        PERMISSIONS.APPLICATION_RECOMMEND,
        PERMISSIONS.RESTRICTED_READ,
      ]),
      () =>
        recommendations.submitRecommendation(
          context(tenantAId, staffUserId, [
            PERMISSIONS.APPLICATION_RECOMMEND,
            PERMISSIONS.RESTRICTED_READ,
          ]),
          recDraft.id,
        ),
    );
    const dec = await runWithTenantContext(
      context(tenantAId, directionUserId, [
        PERMISSIONS.APPLICATION_DECIDE,
        PERMISSIONS.RESTRICTED_READ,
      ]),
      () =>
        recommendations.recordDirectionDecision(
          context(tenantAId, directionUserId, [
            PERMISSIONS.APPLICATION_DECIDE,
            PERMISSIONS.RESTRICTED_READ,
          ]),
          applicationId,
          {
            disposition: "APROBADO",
            expectedRecommendationVersionId: subRec.id,
          },
        ),
    );

    const comm = await runWithTenantContext(
      context(tenantAId, staffUserId, [PERMISSIONS.COMMUNICATION_CONFIRM]),
      () =>
        communications.prepareDecisionCommunication({
          applicationId,
          directionDecisionVersionId: dec.id,
        }),
    );
    commId = comm!.id;

    fixture = {
      applicationId,
      communicationId: commId,
      familyProfileId,
      familyToken: await createToken(familyUserId),
      foreignFamilyToken: await createToken(foreignFamilyUserId),
      noPermissionToken: await createToken(noPermissionUserId),
      secretaryToken: await createToken(secretaryUserId),
      staffToken: await createToken(staffUserId),
      studentId,
      tenantAId,
      tenantBId,
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("E5G-HTTP-01: unauthenticated staff returns 401", async () => {
    const res = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/applications/${fixture.applicationId}/communications`,
    );
    expect(res.status).toBe(401);
  });

  it("E5G-HTTP-02: no membership returns 403", async () => {
    const res = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/applications/${fixture.applicationId}/communications`,
      {
        headers: { Cookie: `${cookieName}=${fixture.noPermissionToken}` },
      },
    );
    expect(res.status).toBe(403);
  });

  it("E5G-HTTP-04..05: confirm without CSRF or wrong Origin returns 403", async () => {
    const resNoCsrf = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/communications/${fixture.communicationId}/confirm`,
      {
        headers: { Cookie: `${cookieName}=${fixture.staffToken}` },
        method: "POST",
      },
    );
    expect(resNoCsrf.status).toBe(403);

    const csrfToken = await fetchCsrfToken(fixture.staffToken);
    const resWrongOrigin = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/communications/${fixture.communicationId}/confirm`,
      {
        headers: {
          Cookie: `${cookieName}=${fixture.staffToken}`,
          Origin: "http://malicious.example.invalid",
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      },
    );
    expect(resWrongOrigin.status).toBe(403);
  });

  it("E5G-HTTP-06: Secretary confirm returns 403", async () => {
    const csrfToken = await fetchCsrfToken(fixture.secretaryToken);
    const res = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/communications/${fixture.communicationId}/confirm`,
      {
        headers: {
          Cookie: `${cookieName}=${fixture.secretaryToken}`,
          Origin: "http://localhost:3000",
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      },
    );
    expect(res.status).toBe(403);
  });

  it("E5G-HTTP-07..08: Authorized confirm succeeds and is idempotent", async () => {
    const csrfToken = await fetchCsrfToken(fixture.staffToken);

    const res1 = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/communications/${fixture.communicationId}/confirm`,
      {
        headers: {
          Cookie: `${cookieName}=${fixture.staffToken}`,
          Origin: "http://localhost:3000",
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      },
    );
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { item: { lifecycle: string } };
    expect(body1.item.lifecycle).toBe("CONFIRMED");

    // Idempotent repeat
    const res2 = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/communications/${fixture.communicationId}/confirm`,
      {
        headers: {
          Cookie: `${cookieName}=${fixture.staffToken}`,
          Origin: "http://localhost:3000",
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      },
    );
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { item: { lifecycle: string } };
    expect(body2.item.lifecycle).toBe("CONFIRMED");
  });

  it("E5G-HTTP-10..14: Family own projection 200 and foreign family deny", async () => {
    const ownRes = await fetch(
      `${baseUrl}/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationId}/projection`,
      {
        headers: { Cookie: `${cookieName}=${fixture.familyToken}` },
      },
    );
    expect(ownRes.status).toBe(200);
    const ownData = (await ownRes.json()) as {
      applicationId: string;
      capacitySummary: unknown;
      internalScore: unknown;
      recommendation: unknown;
    };
    expect(ownData.applicationId).toBe(fixture.applicationId);
    expect(ownData.internalScore).toBeUndefined();
    expect(ownData.recommendation).toBeUndefined();
    expect(ownData.capacitySummary).toBeUndefined();

    const foreignRes = await fetch(
      `${baseUrl}/family/tenants/${fixture.tenantAId}/applications/${fixture.applicationId}/projection`,
      {
        headers: { Cookie: `${cookieName}=${fixture.foreignFamilyToken}` },
      },
    );
    expect(foreignRes.status).toBe(403);
  });

  it("E5G-HTTP-15..16: Dashboard authorized 200 and wrong tenant 403", async () => {
    const dashRes = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantAId}/dashboard/metrics`,
      {
        headers: { Cookie: `${cookieName}=${fixture.staffToken}` },
      },
    );
    expect(dashRes.status).toBe(200);
    const dashData = (await dashRes.json()) as {
      newApplicationsCount: number;
    };
    expect(dashData.newApplicationsCount).toBeGreaterThanOrEqual(1);

    const wrongTenantRes = await fetch(
      `${baseUrl}/staff/tenants/${fixture.tenantBId}/dashboard/metrics`,
      {
        headers: { Cookie: `${cookieName}=${fixture.staffToken}` },
      },
    );
    expect(wrongTenantRes.status).toBe(403);
  });
});
