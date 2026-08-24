import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  InMemoryAuditSink,
  InMemorySecurityEventSink,
  PERMISSIONS,
  SessionService,
  buildSessionCookieOptions,
  createAppPrismaClient,
  runWithTenantContext,
  withTenantTransaction,
  type TenantExecutionContext,
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
  adminAllowedToken: string;
  adminReaderOnlyToken: string;
  adminStaffBToken: string;
  adultApplicationId: string;
  adultFamilyToken: string;
  adultStudentId: string;
  familyAToken: string;
  handoffAdminToken: string;
  minorApplicationId: string;
  minorStudentId: string;
  offeringAId: string;
  tenantAId: string;
  tenantBId: string;
  userAId: string;
};

function context(
  tenantId: string,
  actorId: string,
  capabilities: readonly string[],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `auth-http-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "AUTHORITY_HTTP_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function seedFixture() {
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const userAId = randomUUID();
  const adultUserId = randomUUID();
  const reviewerAdminId = randomUUID();
  const readerOnlyAdminId = randomUUID();
  const handoffAdminId = randomUUID();
  const staffBId = randomUUID();
  const familyProfileAId = randomUUID();
  const familyProfileAdultId = randomUUID();
  const minorStudentId = randomUUID();
  const adultStudentId = randomUUID();
  const now = new Date();

  await migrationPool.query(
    "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
    [tenantAId, "Tenant A HTTP Auth", tenantBId, "Tenant B HTTP Auth"],
  );

  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, email_verified_at) VALUES
      ($1, $2, CURRENT_TIMESTAMP), ($3, $4, CURRENT_TIMESTAMP), ($5, $6, CURRENT_TIMESTAMP),
      ($7, $8, CURRENT_TIMESTAMP), ($9, $10, CURRENT_TIMESTAMP), ($11, $12, CURRENT_TIMESTAMP)`,
    [
      userAId,
      `family-a-${userAId}@example.invalid`,
      adultUserId,
      `adult-a-${adultUserId}@example.invalid`,
      reviewerAdminId,
      `reviewer-${reviewerAdminId}@example.invalid`,
      readerOnlyAdminId,
      `reader-${readerOnlyAdminId}@example.invalid`,
      handoffAdminId,
      `handoff-${handoffAdminId}@example.invalid`,
      staffBId,
      `staff-b-${staffBId}@example.invalid`,
    ],
  );

  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3), ($4, $5, $6)",
    [
      familyProfileAId,
      userAId,
      "Familia Menor A",
      familyProfileAdultId,
      adultUserId,
      "Familia Adulto A",
    ],
  );

  // Minor student (age 10)
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name, date_of_birth) VALUES ($1, $2, $3, $4, DATE '2016-01-01')",
    [minorStudentId, familyProfileAId, "Estudiante", "Menor"],
  );

  // Adult student (age 20)
  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name, date_of_birth) VALUES ($1, $2, $3, $4, DATE '2006-01-01')",
    [adultStudentId, familyProfileAdultId, "Estudiante", "Adulto"],
  );

  const seedCtx = context(tenantAId, reviewerAdminId, [
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
  ]);

  const { minorAppId, adultAppId, offeringId } = await runWithTenantContext(
    seedCtx,
    () =>
      withTenantTransaction(prisma, async (tx) => {
        const campus = await tx.campus.create({
          data: {
            code: "HTTP-CAMPUS-A",
            name: "Sede Auth HTTP",
            tenantId: tenantAId,
          },
        });
        const year = await tx.academicYear.create({
          data: {
            code: "HTTP-YEAR-A",
            label: "Año 2026",
            status: "OPEN",
            tenantId: tenantAId,
          },
        });
        const level = await tx.courseLevel.create({
          data: {
            code: "HTTP-LEVEL-A",
            name: "Nivel 1",
            tenantId: tenantAId,
          },
        });
        const process = await tx.admissionProcess.create({
          data: {
            academicYearId: year.id,
            code: "HTTP-PROCESS-A",
            name: "Proceso 2026",
            status: "PUBLISHED",
            tenantId: tenantAId,
          },
        });
        const form = await tx.formDefinition.create({
          data: {
            name: "Formulario Auth",
            purpose: "admission_application",
            tenantId: tenantAId,
          },
        });
        const formVersion = await tx.formVersion.create({
          data: {
            formDefinitionId: form.id,
            lifecycle: "PUBLISHED",
            publishedAt: now,
            tenantId: tenantAId,
            versionNumber: 1,
          },
        });
        const offering = await tx.admissionOffering.create({
          data: {
            academicYearId: year.id,
            availabilityCategory: "LIMITED_CAPACITY",
            campusId: campus.id,
            code: "HTTP-OFFERING-A",
            courseLevelId: level.id,
            formVersionId: formVersion.id,
            processId: process.id,
            status: "PUBLISHED",
            tenantId: tenantAId,
            title: "Oferta Auth 2026",
          },
        });
        await tx.admissionCapacity.create({
          data: {
            configuredCapacity: 10,
            offeringId: offering.id,
            tenantId: tenantAId,
          },
        });

        const minorApp = await tx.application.create({
          data: {
            academicYearId: year.id,
            draftData: { confirmed_info: true },
            familyProfileId: familyProfileAId,
            formVersionId: formVersion.id,
            offeringId: offering.id,
            processId: process.id,
            status: "DRAFT",
            studentId: minorStudentId,
            tenantId: tenantAId,
          },
        });

        const adultApp = await tx.application.create({
          data: {
            academicYearId: year.id,
            draftData: { confirmed_info: true },
            familyProfileId: familyProfileAdultId,
            formVersionId: formVersion.id,
            offeringId: offering.id,
            processId: process.id,
            status: "DRAFT",
            studentId: adultStudentId,
            tenantId: tenantAId,
          },
        });

        // Reviewer membership & role
        const reviewerMembership = await tx.membership.create({
          data: {
            id: randomUUID(),
            startsAt: new Date(now.getTime() - 60_000),
            status: "ACTIVE",
            tenantId: tenantAId,
            userId: reviewerAdminId,
          },
        });
        await tx.roleAssignment.create({
          data: {
            id: randomUUID(),
            membershipId: reviewerMembership.id,
            permissions: [
              PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
              PERMISSIONS.APPLICATION_AUTHORITY_READ,
              PERMISSIONS.APPLICATION_READ,
              PERMISSIONS.CAPACITY_MANAGE,
            ],
            roleKey: "AUTH_REVIEWER_ROLE",
            scopes: ["*"],
            startsAt: new Date(now.getTime() - 60_000),
            status: "ACTIVE",
            tenantId: tenantAId,
          },
        });

        // Reader-only membership & role
        const readerMembership = await tx.membership.create({
          data: {
            id: randomUUID(),
            startsAt: new Date(now.getTime() - 60_000),
            status: "ACTIVE",
            tenantId: tenantAId,
            userId: readerOnlyAdminId,
          },
        });
        await tx.roleAssignment.create({
          data: {
            id: randomUUID(),
            membershipId: readerMembership.id,
            permissions: [
              PERMISSIONS.APPLICATION_AUTHORITY_READ,
              PERMISSIONS.APPLICATION_READ,
            ],
            roleKey: "AUTH_READER_ROLE",
            scopes: ["*"],
            startsAt: new Date(now.getTime() - 60_000),
            status: "ACTIVE",
            tenantId: tenantAId,
          },
        });

        // Handoff admin membership & role
        const handoffMembership = await tx.membership.create({
          data: {
            id: randomUUID(),
            startsAt: new Date(now.getTime() - 60_000),
            status: "ACTIVE",
            tenantId: tenantAId,
            userId: handoffAdminId,
          },
        });
        await tx.roleAssignment.create({
          data: {
            id: randomUUID(),
            membershipId: handoffMembership.id,
            permissions: [
              PERMISSIONS.APPLICATION_HANDOFF_REQUEST,
              PERMISSIONS.APPLICATION_READ,
            ],
            roleKey: "HANDOFF_ADMIN_ROLE",
            scopes: ["*"],
            startsAt: new Date(now.getTime() - 60_000),
            status: "ACTIVE",
            tenantId: tenantAId,
          },
        });

        return {
          adultAppId: adultApp.id,
          minorAppId: minorApp.id,
          offeringId: offering.id,
        };
      }),
  );

  const seedCtxB = context(tenantBId, staffBId, [
    PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
    PERMISSIONS.APPLICATION_READ,
  ]);
  await runWithTenantContext(seedCtxB, () =>
    withTenantTransaction(prisma, async (tx) => {
      const staffBMembership = await tx.membership.create({
        data: {
          id: randomUUID(),
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantBId,
          userId: staffBId,
        },
      });
      await tx.roleAssignment.create({
        data: {
          id: randomUUID(),
          membershipId: staffBMembership.id,
          permissions: [
            PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
            PERMISSIONS.APPLICATION_AUTHORITY_READ,
            PERMISSIONS.APPLICATION_READ,
          ],
          roleKey: "STAFF_B_ROLE",
          scopes: ["*"],
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantBId,
        },
      });
    }),
  );

  sessions = new SessionService(prisma, {
    auditSink: new InMemoryAuditSink(),
    securityEvents: new InMemorySecurityEventSink(),
  });

  const [
    familyASession,
    adultFamilySession,
    reviewerSession,
    readerSession,
    handoffSession,
    staffBSession,
  ] = await Promise.all([
    sessions.issueSession(userAId),
    sessions.issueSession(adultUserId),
    sessions.issueSession(reviewerAdminId),
    sessions.issueSession(readerOnlyAdminId),
    sessions.issueSession(handoffAdminId),
    sessions.issueSession(staffBId),
  ]);

  fixture = {
    adminAllowedToken: reviewerSession.token,
    adminReaderOnlyToken: readerSession.token,
    adminStaffBToken: staffBSession.token,
    adultApplicationId: adultAppId,
    adultFamilyToken: adultFamilySession.token,
    adultStudentId,
    familyAToken: familyASession.token,
    handoffAdminToken: handoffSession.token,
    minorApplicationId: minorAppId,
    minorStudentId,
    offeringAId: offeringId,
    tenantAId,
    tenantBId,
    userAId,
  };
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
  method = "POST",
) {
  const csrfToken = await csrf(token);
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-CSRF-Token": csrfToken,
  });
  return request(path, {
    body: JSON.stringify(body),
    headers,
    method,
    token,
  });
}

describe.sequential(
  "Application Authority Direct HTTP Integration Suite",
  () => {
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
        throw new Error("HTTP test server did not expose a port");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      await seedFixture();
    });

    afterAll(async () => {
      await app.close();
      await prisma.$disconnect();
      await migrationPool.end();
    });

    it("1. Family GET authority returns NOT_DECLARED before declaration and 404 for unknown app", async () => {
      const res = await request(
        `/family/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority`,
        { token: fixture.familyAToken },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("NOT_DECLARED");

      const notFound = await request(
        `/family/tenants/${fixture.tenantAId}/applications/${randomUUID()}/authority`,
        { token: fixture.familyAToken },
      );
      expect(notFound.status).toBe(404);
    });

    it("2. Family declaration succeeds and returns DECLARED status", async () => {
      const res = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority`,
        fixture.familyAToken,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        concurrencyVersion: number;
        status: string;
        subjectMode: string;
      };
      expect(body.status).toBe("DECLARED");
      expect(body.subjectMode).toBe("MINOR_REPRESENTATIVE");
      expect(body.concurrencyVersion).toBe(1);
    });

    it("3. Strict body validation rejects client attempt to inject status=VERIFIED", async () => {
      const res = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority`,
        fixture.familyAToken,
        {
          authorityBasis: "PARENT",
          expectedConcurrencyVersion: 1,
          relationship: "MOTHER",
          status: "VERIFIED",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );
      // Extra/invalid fields rejected with 400 Bad Request by strict schema parser
      expect(res.status).toBe(400);
    });

    it("4. Staff review without application.authority.review returns 403 Forbidden", async () => {
      const res = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority/review`,
        fixture.adminReaderOnlyToken,
        {
          expectedConcurrencyVersion: 1,
          reason: "Intento sin permisos",
          toStatus: "UNDER_REVIEW",
        },
      );
      expect(res.status).toBe(403);
    });

    it("5. Authorized reviewer executes valid review transitions: DECLARED -> UNDER_REVIEW -> VERIFIED", async () => {
      // 1. DECLARED -> UNDER_REVIEW
      const underReviewRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority/review`,
        fixture.adminAllowedToken,
        {
          expectedConcurrencyVersion: 1,
          reason: "Iniciando revisión documental",
          toStatus: "UNDER_REVIEW",
        },
      );
      expect(underReviewRes.status).toBe(201);
      const underReviewBody = (await underReviewRes.json()) as {
        concurrencyVersion: number;
        status: string;
      };
      expect(underReviewBody.status).toBe("UNDER_REVIEW");
      expect(underReviewBody.concurrencyVersion).toBe(2);

      // 2. UNDER_REVIEW -> VERIFIED
      const verifiedRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority/review`,
        fixture.adminAllowedToken,
        {
          expectedConcurrencyVersion: 2,
          reason: "Documentos comprobados conforme",
          toStatus: "VERIFIED",
        },
      );
      expect(verifiedRes.status).toBe(201);
      const verifiedBody = (await verifiedRes.json()) as {
        concurrencyVersion: number;
        status: string;
      };
      expect(verifiedBody.status).toBe("VERIFIED");
      expect(verifiedBody.concurrencyVersion).toBe(3);
    });

    it("6. Stale concurrency version in review returns 409 Conflict", async () => {
      const res = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority/review`,
        fixture.adminAllowedToken,
        {
          expectedConcurrencyVersion: 1, // Stale version (current is 3)
          reason: "Intento con versión antigua",
          toStatus: "DISPUTED",
        },
      );
      expect(res.status).toBe(409);
    });

    it("7. Cross-tenant access returns 404 Not Found", async () => {
      const res = await request(
        `/staff/tenants/${fixture.tenantBId}/applications/${fixture.minorApplicationId}/authority`,
        { token: fixture.adminStaffBToken },
      );
      expect(res.status).toBe(404);
    });

    it("8. Invalid combinations (e.g. minor SELF) return 400/422 Bad Request", async () => {
      const res = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${fixture.minorApplicationId}/authority`,
        fixture.familyAToken,
        {
          authorityBasis: "SELF",
          relationship: "SELF",
          subjectMode: "ADULT_STUDENT_SELF",
        },
      );
      // Student is 10 years old; ADULT_STUDENT_SELF is rejected
      expect(res.status).toBe(400);
    });

    it("9. Adult student SELF declaration and review flow", async () => {
      const decRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${fixture.adultApplicationId}/authority`,
        fixture.adultFamilyToken,
        {
          authorityBasis: "SELF",
          relationship: "SELF",
          subjectMode: "ADULT_STUDENT_SELF",
        },
      );
      expect(decRes.status).toBe(201);
      const decBody = (await decRes.json()) as { concurrencyVersion: number };

      const reviewRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${fixture.adultApplicationId}/authority/review`,
        fixture.adminAllowedToken,
        {
          expectedConcurrencyVersion: decBody.concurrencyVersion,
          reason: "Revisando adulto",
          toStatus: "UNDER_REVIEW",
        },
      );
      expect(reviewRes.status).toBe(201);
      const revBody = (await reviewRes.json()) as {
        concurrencyVersion: number;
      };

      const verRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${fixture.adultApplicationId}/authority/review`,
        fixture.adminAllowedToken,
        {
          expectedConcurrencyVersion: revBody.concurrencyVersion,
          reason: "Verificado adulto",
          toStatus: "VERIFIED",
        },
      );
      expect(verRes.status).toBe(201);
    });
  },
);
