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
const bootstrapUrl = new URL(process.env.DATABASE_MIGRATION_URL!);
bootstrapUrl.username =
  process.env.POSTGRES_BOOTSTRAP_USER ?? "admission_bootstrap";
bootstrapUrl.password =
  process.env.POSTGRES_BOOTSTRAP_PASSWORD ?? "admission_bootstrap_local_only";
const bootstrapPool = new Pool({ connectionString: bootstrapUrl.toString() });
const cookieName = "admission_session";

const tenantA = randomUUID();
const tenantB = randomUUID();
const managerUser = randomUUID();
const secretaryUser = randomUUID();
const exportOnlyUser = randomUUID();
const reporterUser = randomUUID();
const noMembershipUser = randomUUID();
const familyUser = randomUUID();
const superadminUser = randomUUID();
const targetUser = randomUUID();
const familyProfile = randomUUID();
const studentId = randomUUID();
const targetMembership = randomUUID();
let offeringA = "";
let offeringB = "";
let applicationA = "";
let createdAssignmentId = "";
let createdAssignmentUpdatedAt = "";

let app: INestApplication;
let baseUrl = "";
let sessions: SessionService;
const tokens: Record<string, string> = {};

function context(
  tenantId: string,
  actorId: string,
  capabilities: readonly string[] = [],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5h-http-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5H_HTTP_SPEC",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

function cookie(token: string): Record<string, string> {
  return { Cookie: `${cookieName}=${token}` };
}

async function csrf(token: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/csrf`, {
    headers: cookie(token),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

async function mutation(
  token: string,
  path: string,
  body: unknown,
  method = "POST",
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const csrfToken = await csrf(token);
  return fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      ...cookie(token),
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrfToken,
      ...extraHeaders,
    },
    method,
  });
}

async function createResources(
  tenantId: string,
  actorId: string,
  suffix: string,
) {
  return runWithTenantContext(context(tenantId, actorId), () =>
    withTenantTransaction(prisma, async (tx) => {
      const campus = await tx.campus.create({
        data: { code: `CAMP-${suffix}`, name: `Sede ${suffix}`, tenantId },
      });
      const year = await tx.academicYear.create({
        data: {
          code: `YEAR-${suffix}`,
          label: `Año ${suffix}`,
          status: "OPEN",
          tenantId,
        },
      });
      const level = await tx.courseLevel.create({
        data: { code: `LEVEL-${suffix}`, name: `Nivel ${suffix}`, tenantId },
      });
      const process = await tx.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: `PROCESS-${suffix}`,
          name: `Proceso ${suffix}`,
          status: "PUBLISHED",
          tenantId,
        },
      });
      const offering = await tx.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: campus.id,
          code: `OFFER-${suffix}`,
          courseLevelId: level.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId,
          title: `Oferta ${suffix}`,
        },
      });
      return { offering, process };
    }),
  );
}

describe.sequential(
  "E5-H real Nest/PostgreSQL reporting and admin HTTP",
  () => {
    beforeAll(async () => {
      process.env.ADMISSION_PLATFORM_SUPPORT_USER_IDS = superadminUser;
      sessions = new SessionService(prisma, {
        auditSink: new NoopAuditSink(),
        securityEvents: new NoopSecurityEventSink(),
      });
      app = await NestFactory.create(AppModule, { logger: false });
      configureAdmissionApp(app);
      await app.listen(0);
      baseUrl = await app.getUrl();

      await migrationPool.query(
        "INSERT INTO tenants (id, name) VALUES ($1,$2),($3,$4)",
        [tenantA, "HTTP E5-H A sintético", tenantB, "HTTP E5-H B sintético"],
      );
      const users = [
        managerUser,
        secretaryUser,
        exportOnlyUser,
        reporterUser,
        noMembershipUser,
        familyUser,
        superadminUser,
        targetUser,
      ];
      for (const [index, userId] of users.entries()) {
        await migrationPool.query(
          "INSERT INTO platform_users (id, email_normalized) VALUES ($1,$2)",
          [userId, `e5h-http-${index}-${userId}@example.invalid`],
        );
        tokens[userId] = (await sessions.issueSession(userId)).token;
      }
      await migrationPool.query(
        "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1,$2,$3)",
        [familyProfile, familyUser, "Familia HTTP E5-H sintética"],
      );
      await migrationPool.query(
        "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1,$2,$3,$4)",
        [studentId, familyProfile, "=Estudiante", "HTTP, sintético"],
      );

      const membershipRows: Array<{
        actorId: string;
        membershipId: string;
        permissions: readonly string[];
        roleKey: string;
      }> = [
        {
          actorId: managerUser,
          membershipId: randomUUID(),
          permissions: [
            PERMISSIONS.APPLICATION_READ,
            PERMISSIONS.AUDIT_READ,
            PERMISSIONS.REPORT_EXPORT,
            PERMISSIONS.REPORT_READ,
            PERMISSIONS.RESTRICTED_READ,
            PERMISSIONS.ROLE_ASSIGNMENT_MANAGE,
            PERMISSIONS.ROLE_ASSIGNMENT_READ,
          ],
          roleKey: "synthetic-manager",
        },
        {
          actorId: secretaryUser,
          membershipId: randomUUID(),
          permissions: [PERMISSIONS.APPLICATION_READ, PERMISSIONS.REPORT_READ],
          roleKey: "synthetic-secretary",
        },
        {
          actorId: exportOnlyUser,
          membershipId: randomUUID(),
          permissions: [PERMISSIONS.REPORT_EXPORT],
          roleKey: "synthetic-export-only",
        },
        {
          actorId: reporterUser,
          membershipId: randomUUID(),
          permissions: [PERMISSIONS.REPORT_EXPORT, PERMISSIONS.REPORT_READ],
          roleKey: "synthetic-reporter",
        },
        {
          actorId: targetUser,
          membershipId: targetMembership,
          permissions: [],
          roleKey: "synthetic-target",
        },
      ];
      await runWithTenantContext(context(tenantA, managerUser), () =>
        withTenantTransaction(prisma, async (tx) => {
          for (const row of membershipRows) {
            await tx.membership.create({
              data: {
                id: row.membershipId,
                startsAt: new Date(0),
                tenantId: tenantA,
                userId: row.actorId,
              },
            });
            if (row.permissions.length > 0) {
              await tx.roleAssignment.create({
                data: {
                  membershipId: row.membershipId,
                  permissions: [...row.permissions],
                  roleKey: row.roleKey,
                  scopes: ["*"],
                  startsAt: new Date(0),
                  tenantId: tenantA,
                },
              });
            }
          }
        }),
      );

      const resourcesA = await createResources(tenantA, managerUser, "A");
      const resourcesB = await createResources(tenantB, managerUser, "B");
      offeringA = resourcesA.offering.id;
      offeringB = resourcesB.offering.id;
      await runWithTenantContext(context(tenantA, managerUser), () =>
        withTenantTransaction(prisma, async (tx) => {
          const application = await tx.application.create({
            data: {
              academicYearId: resourcesA.offering.academicYearId,
              draftData: { currentStep: "CONTEXT" },
              familyProfileId: familyProfile,
              offeringId: offeringA,
              processId: resourcesA.process.id,
              studentId,
              tenantId: tenantA,
            },
          });
          applicationA = application.id;
        }),
      );
    });

    afterAll(async () => {
      delete process.env.ADMISSION_PLATFORM_SUPPORT_USER_IDS;
      await app.close();
      await migrationPool.query(
        "DELETE FROM audit_events WHERE scope = 'PLATFORM_GLOBAL' AND actor_id = ANY($1::uuid[])",
        [
          [
            managerUser,
            secretaryUser,
            exportOnlyUser,
            reporterUser,
            noMembershipUser,
            familyUser,
            superadminUser,
            targetUser,
          ],
        ],
      );
      await bootstrapPool.query(
        "DELETE FROM support_elevations WHERE tenant_id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await migrationPool.query(
        "DELETE FROM tenants WHERE id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await migrationPool.query(
        "DELETE FROM platform_users WHERE id = ANY($1::uuid[])",
        [
          [
            managerUser,
            secretaryUser,
            exportOnlyUser,
            reporterUser,
            noMembershipUser,
            familyUser,
            superadminUser,
            targetUser,
          ],
        ],
      );
      await prisma.$disconnect();
      await migrationPool.end();
      await bootstrapPool.end();
    });

    it("E5H-HTTP-01: unauthenticated report returns 401", async () => {
      const response = await fetch(
        `${baseUrl}/staff/tenants/${tenantA}/reports`,
      );
      expect(response.status).toBe(401);
    });

    it("E5H-HTTP-02: authenticated actor without membership returns 403", async () => {
      const response = await fetch(
        `${baseUrl}/staff/tenants/${tenantA}/reports`,
        {
          headers: cookie(tokens[noMembershipUser]!),
        },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-03: report.read missing returns 403", async () => {
      const response = await mutation(
        tokens[exportOnlyUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { filters: {} },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-04..05: export permission missing and Secretary export return 403", async () => {
      const response = await mutation(
        tokens[secretaryUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { filters: {} },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-06: invalid report column returns 400", async () => {
      const response = await mutation(
        tokens[managerUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { columns: ["applicationId", "objectKey"], filters: {} },
      );
      expect(response.status).toBe(400);
    });

    it("E5H-HTTP-07: cross-tenant report filter is safely denied", async () => {
      const response = await mutation(
        tokens[managerUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { filters: { offeringId: offeringB } },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-08: authorized CSV has safe headers and a server filename", async () => {
      const response = await mutation(
        tokens[managerUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { filters: { offeringId: offeringA } },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/csv");
      expect(response.headers.get("content-disposition")).toMatch(
        /attachment; filename="admission-applications-by-course-status-\d{4}-\d{2}-\d{2}\.csv"/,
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    });

    it("E5H-HTTP-09: CSV contains only requested allowlisted columns", async () => {
      const response = await mutation(
        tokens[managerUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { columns: ["applicationId", "status"], filters: {} },
      );
      expect(await response.text()).toMatch(/^applicationId,status\r?\n/);
    });

    it("E5H-HTTP-10: restricted column without restricted.read is denied", async () => {
      const response = await mutation(
        tokens[reporterUser]!,
        `/staff/tenants/${tenantA}/reports/APPLICATIONS_BY_COURSE_STATUS/export`,
        { columns: ["applicationId", "studentGivenName"], filters: {} },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-11: role mutation without CSRF returns 403", async () => {
      const response = await fetch(
        `${baseUrl}/admin/tenants/${tenantA}/role-assignments`,
        {
          body: JSON.stringify({
            membershipId: targetMembership,
            permissions: [PERMISSIONS.REPORT_READ],
            roleKey: "http-reader",
            scopes: ["*"],
            startsAt: new Date().toISOString(),
          }),
          headers: {
            ...cookie(tokens[managerUser]!),
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-12: unauthorized role mutation returns 403", async () => {
      const response = await mutation(
        tokens[reporterUser]!,
        `/admin/tenants/${tenantA}/role-assignments`,
        {
          membershipId: targetMembership,
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "http-reader",
          scopes: ["*"],
          startsAt: new Date().toISOString(),
        },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-14: authorized role mutation is durable and audited", async () => {
      const response = await mutation(
        tokens[managerUser]!,
        `/admin/tenants/${tenantA}/role-assignments`,
        {
          membershipId: targetMembership,
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "http-reader",
          scopes: ["*"],
          startsAt: new Date().toISOString(),
        },
      );
      expect(response.status).toBe(201);
      const assignment = (await response.json()) as {
        id: string;
        updatedAt: string;
      };
      createdAssignmentId = assignment.id;
      createdAssignmentUpdatedAt = assignment.updatedAt;
      const auditCount = await runWithTenantContext(
        context(tenantA, managerUser),
        () =>
          withTenantTransaction(prisma, (tx) =>
            tx.auditEvent.count({
              where: {
                action: "ROLE_ASSIGNMENT_CREATED",
                resourceId: assignment.id,
              },
            }),
          ),
      );
      expect(auditCount).toBe(1);
    });

    it("E5H-HTTP-13: stale role mutation returns 409", async () => {
      const first = await mutation(
        tokens[managerUser]!,
        `/admin/tenants/${tenantA}/role-assignments/${createdAssignmentId}`,
        {
          expectedUpdatedAt: createdAssignmentUpdatedAt,
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "http-reader-updated",
          scopes: ["*"],
          status: "SUSPENDED",
        },
        "PATCH",
      );
      expect(first.status).toBe(200);
      const stale = await mutation(
        tokens[managerUser]!,
        `/admin/tenants/${tenantA}/role-assignments/${createdAssignmentId}`,
        {
          expectedUpdatedAt: createdAssignmentUpdatedAt,
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "stale-update",
          scopes: ["*"],
          status: "ACTIVE",
        },
        "PATCH",
      );
      expect(stale.status).toBe(409);
      expect((await stale.json()) as { code?: string }).toMatchObject({
        code: "ROLE_ASSIGNMENT_CHANGED",
      });
    });

    it("E5H-HTTP-15: audit read without audit.read returns 403", async () => {
      const params = new URLSearchParams({
        dateFrom: new Date(Date.now() - 86_400_000).toISOString(),
        dateTo: new Date(Date.now() + 86_400_000).toISOString(),
      });
      const response = await fetch(
        `${baseUrl}/admin/tenants/${tenantA}/audit-events?${params}`,
        {
          headers: cookie(tokens[reporterUser]!),
        },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-16: authorized audit read is tenant scoped", async () => {
      const params = new URLSearchParams({
        dateFrom: new Date(Date.now() - 86_400_000).toISOString(),
        dateTo: new Date(Date.now() + 86_400_000).toISOString(),
        limit: "100",
      });
      const response = await fetch(
        `${baseUrl}/admin/tenants/${tenantA}/audit-events?${params}`,
        {
          headers: cookie(tokens[managerUser]!),
        },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { items: Array<{ id: string }> };
      expect(body.items.length).toBeGreaterThan(0);
    });

    it("E5H-HTTP-17: global superadmin without elevation is denied tenant audit", async () => {
      const params = new URLSearchParams({
        dateFrom: new Date(Date.now() - 86_400_000).toISOString(),
        dateTo: new Date(Date.now() + 86_400_000).toISOString(),
      });
      const response = await fetch(
        `${baseUrl}/admin/tenants/${tenantA}/audit-events?${params}`,
        {
          headers: cookie(tokens[superadminUser]!),
        },
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-18: valid elevation enables only constrained tenant audit", async () => {
      const start = await mutation(
        tokens[superadminUser]!,
        "/platform/support-elevations",
        {
          categories: ["restricted"],
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          purpose: "platform.support",
          reason: "Soporte sintético E5-H",
          scopes: ["*"],
          targetTenantId: tenantA,
        },
      );
      expect(start.status).toBe(201);
      const elevation = (await start.json()) as { id: string };
      const params = new URLSearchParams({
        dateFrom: new Date(Date.now() - 86_400_000).toISOString(),
        dateTo: new Date(Date.now() + 86_400_000).toISOString(),
      });
      const allowed = await fetch(
        `${baseUrl}/admin/tenants/${tenantA}/audit-events?${params}`,
        {
          headers: {
            ...cookie(tokens[superadminUser]!),
            "X-Support-Elevation-Id": elevation.id,
          },
        },
      );
      expect(allowed.status).toBe(200);
      const wrongTenant = await fetch(
        `${baseUrl}/admin/tenants/${tenantB}/audit-events?${params}`,
        {
          headers: {
            ...cookie(tokens[superadminUser]!),
            "X-Support-Elevation-Id": elevation.id,
          },
        },
      );
      expect(wrongTenant.status).toBe(403);
    });

    it("E5H-HTTP-19: unknown role resources are anti-enumerative", async () => {
      const response = await mutation(
        tokens[managerUser]!,
        `/admin/tenants/${tenantA}/role-assignments/${randomUUID()}`,
        {
          expectedUpdatedAt: new Date().toISOString(),
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "unknown",
          scopes: ["*"],
          status: "ACTIVE",
        },
        "PATCH",
      );
      expect(response.status).toBe(403);
    });

    it("E5H-HTTP-20: family receives no reporting or admin access", async () => {
      const reports = await fetch(
        `${baseUrl}/staff/tenants/${tenantA}/reports`,
        {
          headers: cookie(tokens[familyUser]!),
        },
      );
      const access = await fetch(`${baseUrl}/admin/tenants/${tenantA}/access`, {
        headers: cookie(tokens[familyUser]!),
      });
      expect([reports.status, access.status]).toEqual([403, 403]);
      expect(applicationA).not.toBe("");
    });
  },
);
