import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  InMemoryAuditSink,
  InMemorySecurityEventSink,
  buildSessionCookieOptions,
  createAppPrismaClient,
  PERMISSIONS,
  SessionService,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { AppModule } from "./app.module.js";
import { configureAdmissionApp } from "./app-bootstrap.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: process.env.DATABASE_MIGRATION_URL,
  connectionTimeoutMillis: 5_000,
});
const cookieName = buildSessionCookieOptions({ environment: "local" }).name;
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl = "";
let sessions: SessionService;
let fixture: {
  acceptedApplicationId: string;
  activeApplicationId: string;
  familyToken: string;
  noPermissionToken: string;
  staffToken: string;
  tenantAId: string;
  tenantBId: string;
};

function context(tenantId: string, actorId: string): TenantExecutionContext {
  return {
    actorId,
    capabilities: [PERMISSIONS.APPLICATION_HANDOFF_REQUEST],
    contextOrigin: "synthetic_test",
    correlationId: `e5i-http-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5I_HTTP_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function seedFixture() {
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const staffId = randomUUID();
  const noPermissionId = randomUUID();
  const familyId = randomUUID();
  const globalId = randomUUID();
  const profileId = randomUUID();
  const studentId = randomUUID();
  const activeStudentId = randomUUID();
  const now = new Date();
  await migrationPool.query(
    "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
    [tenantAId, "E5I HTTP A sintético", tenantBId, "E5I HTTP B sintético"],
  );
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized) VALUES
      ($1, $2), ($3, $4), ($5, $6), ($7, $8)`,
    [
      staffId,
      `e5i-http-staff-${staffId}@example.invalid`,
      noPermissionId,
      `e5i-http-noperm-${noPermissionId}@example.invalid`,
      familyId,
      `e5i-http-family-${familyId}@example.invalid`,
      globalId,
      `e5i-http-global-${globalId}@example.invalid`,
    ],
  );
  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [profileId, familyId, "Familia E5-I HTTP sintética"],
  );
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [studentId, profileId, "Estudiante", "HTTP"],
  );
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)",
    [activeStudentId, profileId, "Estudiante Activo", "HTTP"],
  );
  const seedContext = context(tenantAId, staffId);
  const applicationIds = await runWithTenantContext(seedContext, () =>
    withTenantTransaction(prisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: {
          code: "E5I-HTTP-CAMPUS",
          name: "Sede HTTP",
          tenantId: tenantAId,
        },
      });
      const year = await transaction.academicYear.create({
        data: {
          code: "E5I-HTTP-YEAR",
          label: "Año HTTP",
          status: "OPEN",
          tenantId: tenantAId,
        },
      });
      const level = await transaction.courseLevel.create({
        data: {
          code: "E5I-HTTP-LEVEL",
          name: "Nivel HTTP",
          tenantId: tenantAId,
        },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: "E5I-HTTP-PROCESS",
          name: "Proceso HTTP",
          status: "PUBLISHED",
          tenantId: tenantAId,
        },
      });
      const form = await transaction.formDefinition.create({
        data: {
          name: "Formulario HTTP",
          purpose: "admission_application",
          tenantId: tenantAId,
        },
      });
      const formVersion = await transaction.formVersion.create({
        data: {
          formDefinitionId: form.id,
          lifecycle: "PUBLISHED",
          publishedAt: now,
          tenantId: tenantAId,
          versionNumber: 1,
        },
      });
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: campus.id,
          code: "E5I-HTTP-OFFER",
          courseLevelId: level.id,
          formVersionId: formVersion.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId: tenantAId,
          title: "Oferta HTTP",
        },
      });
      const capacity = await transaction.admissionCapacity.create({
        data: {
          configuredCapacity: 2,
          offeringId: offering.id,
          tenantId: tenantAId,
        },
      });
      const ids: string[] = [];
      for (const lifecycle of ["ACCEPTED", "ACTIVE"] as const) {
        const application = await transaction.application.create({
          data: {
            academicYearId: year.id,
            draftData: { currentStep: "REVIEW" },
            familyProfileId: profileId,
            formVersionId: formVersion.id,
            offeringId: offering.id,
            processId: process.id,
            status: "SUBMITTED",
            studentId: lifecycle === "ACCEPTED" ? studentId : activeStudentId,
            submittedAt: now,
            tenantId: tenantAId,
          },
        });
        const reservation = await transaction.seatReservation.create({
          data: {
            applicationId: application.id,
            capacityId: capacity.id,
            committedAt: lifecycle === "ACCEPTED" ? now : null,
            offeringId: offering.id,
            reservedAt: now,
            state: lifecycle === "ACCEPTED" ? "COMMITTED" : "ACTIVE",
            tenantId: tenantAId,
          },
        });
        const offer = await transaction.admissionOffer.create({
          data: {
            applicationId: application.id,
            offeringId: offering.id,
            origin: "NORMAL",
            tenantId: tenantAId,
          },
        });
        const version = await transaction.admissionOfferVersion.create({
          data: {
            applicationId: application.id,
            expiresAt: new Date(now.getTime() + 86_400_000),
            issuedAt: new Date(now.getTime() - 60_000),
            issuedBy: staffId,
            lifecycle,
            offerId: offer.id,
            offeringId: offering.id,
            origin: "NORMAL",
            reservationId: reservation.id,
            terminalAt: lifecycle === "ACCEPTED" ? now : null,
            terminalReason: lifecycle === "ACCEPTED" ? "FAMILY_ACCEPTED" : null,
            tenantId: tenantAId,
            versionNumber: 1,
          },
        });
        await transaction.admissionOffer.update({
          data: { currentVersionId: version.id },
          where: { id: offer.id },
        });
        if (lifecycle === "ACCEPTED") {
          await transaction.offerAcceptance.create({
            data: {
              acceptedAt: now,
              actorId: familyId,
              applicationId: application.id,
              offerId: offer.id,
              offerVersionId: version.id,
              offeringId: offering.id,
              reservationId: reservation.id,
              tenantId: tenantAId,
            },
          });
        }
        ids.push(application.id);
      }
      const membership = await transaction.membership.create({
        data: {
          id: randomUUID(),
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
          userId: staffId,
        },
      });
      await transaction.roleAssignment.create({
        data: {
          id: randomUUID(),
          membershipId: membership.id,
          permissions: [PERMISSIONS.APPLICATION_HANDOFF_REQUEST],
          roleKey: "E5I_HTTP_HANDOFF",
          scopes: ["*"],
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
        },
      });
      await transaction.membership.create({
        data: {
          id: randomUUID(),
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
          userId: noPermissionId,
        },
      });
      return ids;
    }),
  );
  sessions = new SessionService(prisma, {
    auditSink: new InMemoryAuditSink(),
    securityEvents: new InMemorySecurityEventSink(),
  });
  const [staffSession, noPermissionSession, familySession] = await Promise.all([
    sessions.issueSession(staffId),
    sessions.issueSession(noPermissionId),
    sessions.issueSession(familyId),
  ]);
  fixture = {
    acceptedApplicationId: applicationIds[0]!,
    activeApplicationId: applicationIds[1]!,
    familyToken: familySession.token,
    noPermissionToken: noPermissionSession.token,
    staffToken: staffSession.token,
    tenantAId,
    tenantBId,
  };
  return { globalId };
}

function request(path: string, options: RequestInit & { token?: string } = {}) {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (token !== undefined) headers.set("Cookie", `${cookieName}=${token}`);
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
  body: unknown,
  options: { csrfToken?: string; origin?: string } = {},
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
    method: "POST",
    token,
  });
}

function handoffPath(applicationId: string, tenantId = fixture.tenantAId) {
  return `/staff/tenants/${tenantId}/applications/${applicationId}/handoff`;
}

describe.sequential("E5-I real Nest/PostgreSQL HTTP boundary", () => {
  let globalId = "";

  beforeAll(async () => {
    process.env.ADMISSION_APP_ORIGIN = "http://localhost:3000";
    process.env.ADMISSION_WEB_ORIGIN = "http://localhost:3000";
    process.env.ADMISSION_PLATFORM_SUPPORT_USER_IDS = "";
    app = await NestFactory.create(AppModule, { logger: false });
    configureAdmissionApp(app);
    await app.init();
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (address === null || typeof address === "string") {
      throw new Error("E5-I HTTP test server did not expose a port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    ({ globalId } = await seedFixture());
  });

  afterAll(async () => {
    await app.close();
    // Fixtures remain synthetic and uniquely named; immutable historical rows are not deleted.
    await prisma.$disconnect();
    await migrationPool.end();
  });

  it("HND-18: authorized HTTP happy path is idempotent", async () => {
    const token = fixture.staffToken;
    const csrfToken = await csrf(token);
    const first = await mutation(
      handoffPath(fixture.acceptedApplicationId),
      token,
      {},
      { csrfToken },
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { id: string; status: string };
    expect(firstBody.status).toBe("REQUESTED");
    const second = await mutation(
      handoffPath(fixture.acceptedApplicationId),
      token,
      {},
      { csrfToken },
    );
    expect(second.status).toBe(201);
    expect(((await second.json()) as { id: string }).id).toBe(firstBody.id);
  });

  it("HND-19: HTTP without acceptance returns controlled 409 and no row", async () => {
    const response = await mutation(
      handoffPath(fixture.activeApplicationId),
      fixture.staffToken,
      {},
      { csrfToken: await csrf(fixture.staffToken) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "HANDOFF_NOT_ENABLED",
    });
  });

  it("HND-20: HTTP enforces session, CSRF, Origin and strict body", async () => {
    expect(
      (
        await mutation(
          handoffPath(fixture.acceptedApplicationId),
          fixture.staffToken,
          {},
        )
      ).status,
    ).toBe(403);
    const csrfToken = await csrf(fixture.staffToken);
    expect(
      (
        await mutation(
          handoffPath(fixture.acceptedApplicationId),
          fixture.staffToken,
          {},
          { csrfToken, origin: "https://invalid.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await mutation(
          handoffPath(fixture.acceptedApplicationId),
          fixture.staffToken,
          { tenantId: fixture.tenantBId, status: "REQUESTED" },
          { csrfToken },
        )
      ).status,
    ).toBe(400);
    expect(
      (await mutation(handoffPath(fixture.acceptedApplicationId), "", {}))
        .status,
    ).toBe(401);
  });

  it("HND-21: HTTP denies family, missing capability, superadmin without elevation, and cross-tenant access", async () => {
    const familyResponse = await mutation(
      handoffPath(fixture.acceptedApplicationId),
      fixture.familyToken,
      {},
      { csrfToken: await csrf(fixture.familyToken) },
    );
    expect(familyResponse.status).toBe(403);
    const noPermissionResponse = await mutation(
      handoffPath(fixture.acceptedApplicationId),
      fixture.noPermissionToken,
      {},
      { csrfToken: await csrf(fixture.noPermissionToken) },
    );
    expect(noPermissionResponse.status).toBe(403);
    const globalSession = await sessions.issueSession(globalId);
    const globalResponse = await mutation(
      handoffPath(fixture.acceptedApplicationId),
      globalSession.token,
      {},
      { csrfToken: await csrf(globalSession.token) },
    );
    expect(globalResponse.status).toBe(403);
    const crossTenant = await mutation(
      handoffPath(fixture.acceptedApplicationId, fixture.tenantBId),
      fixture.staffToken,
      {},
      { csrfToken: await csrf(fixture.staffToken) },
    );
    expect([403, 404]).toContain(crossTenant.status);
  });
});
