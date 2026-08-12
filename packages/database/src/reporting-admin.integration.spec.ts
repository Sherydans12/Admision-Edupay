import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AccessAdminValidationError,
  AuditReadService,
  RoleAssignmentAdminService,
  RoleAssignmentChangedError,
} from "./access-admin.js";
import { ForbiddenError } from "./authorization.js";
import { getRequiredEnvironment } from "./environment.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  ReportExportLimitExceededError,
  ReportingService,
  ReportValidationError,
} from "./reporting.js";
import { resolveEffectiveTenantContext } from "./tenant-resolution.js";
import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 2,
});

const tenantA = randomUUID();
const tenantB = randomUUID();
const managerUser = randomUUID();
const secretaryUser = randomUUID();
const targetUser = randomUUID();
const foreignManagerUser = randomUUID();
const familyUser = randomUUID();
const familyProfile = randomUUID();
const studentOne = randomUUID();
const studentTwo = randomUUID();
const managerMembership = randomUUID();
const secretaryMembership = randomUUID();
const targetMembership = randomUUID();
const foreignMembership = randomUUID();
let offeringA = "";
let offeringB = "";
let applicationOne = "";

const managerPermissions = [
  PERMISSIONS.APPLICATION_READ,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.REPORT_EXPORT,
  PERMISSIONS.REPORT_READ,
  PERMISSIONS.RESTRICTED_READ,
  PERMISSIONS.ROLE_ASSIGNMENT_MANAGE,
  PERMISSIONS.ROLE_ASSIGNMENT_READ,
] as const;

function context(
  input: {
    actorId?: string;
    capabilities?: readonly string[];
    scopes?: readonly string[];
    tenantId?: string;
  } = {},
): TenantExecutionContext {
  return {
    actorId: input.actorId ?? managerUser,
    capabilities: input.capabilities ?? managerPermissions,
    contextOrigin: "synthetic_test",
    correlationId: `e5h-${randomUUID()}`,
    effectiveActorId: input.actorId ?? managerUser,
    purpose: "E5H_TEST",
    scopes: input.scopes ?? ["*"],
    source: "authenticated_request",
    tenantId: input.tenantId ?? tenantA,
  };
}

async function createTenantResources(tenantId: string, suffix: string) {
  return runWithTenantContext(context({ tenantId }), () =>
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
  "E5-H reporting, role assignment and audit controls",
  () => {
    beforeAll(async () => {
      await migrationPool.query(
        "INSERT INTO tenants (id, name) VALUES ($1,$2),($3,$4)",
        [
          tenantA,
          "Tenant E5-H A sintético",
          tenantB,
          "Tenant E5-H B sintético",
        ],
      );
      const users = [
        managerUser,
        secretaryUser,
        targetUser,
        foreignManagerUser,
        familyUser,
      ];
      for (const [index, userId] of users.entries()) {
        await migrationPool.query(
          "INSERT INTO platform_users (id, email_normalized) VALUES ($1,$2)",
          [userId, `e5h-${index}-${userId}@example.invalid`],
        );
      }
      await migrationPool.query(
        "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1,$2,$3)",
        [familyProfile, familyUser, "Familia E5-H sintética"],
      );
      await migrationPool.query(
        "INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1,$2,$3,$4),($5,$2,$6,$4)",
        [
          studentOne,
          familyProfile,
          "=Nombre sintético",
          "Apellido, sintético",
          studentTwo,
          "Segundo sintético",
        ],
      );

      await runWithTenantContext(context(), () =>
        withTenantTransaction(prisma, async (tx) => {
          await tx.membership.createMany({
            data: [
              {
                id: managerMembership,
                startsAt: new Date(0),
                tenantId: tenantA,
                userId: managerUser,
              },
              {
                id: secretaryMembership,
                startsAt: new Date(0),
                tenantId: tenantA,
                userId: secretaryUser,
              },
              {
                id: targetMembership,
                startsAt: new Date(0),
                tenantId: tenantA,
                userId: targetUser,
              },
            ],
          });
          await tx.roleAssignment.createMany({
            data: [
              {
                membershipId: managerMembership,
                permissions: [...managerPermissions],
                roleKey: "synthetic-e5h-manager",
                scopes: ["*"],
                startsAt: new Date(0),
                tenantId: tenantA,
              },
              {
                membershipId: secretaryMembership,
                permissions: [
                  PERMISSIONS.APPLICATION_READ,
                  PERMISSIONS.REPORT_READ,
                ],
                roleKey: "synthetic-e5h-secretary",
                scopes: ["*"],
                startsAt: new Date(0),
                tenantId: tenantA,
              },
            ],
          });
        }),
      );
      await runWithTenantContext(
        context({ actorId: foreignManagerUser, tenantId: tenantB }),
        () =>
          withTenantTransaction(prisma, async (tx) => {
            await tx.membership.create({
              data: {
                id: foreignMembership,
                startsAt: new Date(0),
                tenantId: tenantB,
                userId: foreignManagerUser,
              },
            });
          }),
      );

      const resourcesA = await createTenantResources(tenantA, "A");
      const resourcesB = await createTenantResources(tenantB, "B");
      offeringA = resourcesA.offering.id;
      offeringB = resourcesB.offering.id;

      await runWithTenantContext(context(), () =>
        withTenantTransaction(prisma, async (tx) => {
          for (const [index, studentId] of [studentOne, studentTwo].entries()) {
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
            if (index === 0) applicationOne = application.id;
          }
        }),
      );
    });

    afterAll(async () => {
      delete process.env.REPORT_EXPORT_MAX_ROWS;
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
            targetUser,
            foreignManagerUser,
            familyUser,
          ],
        ],
      );
      await prisma.$disconnect();
      await migrationPool.end();
    });

    it("E5H-REP-02..03: rejects unknown report keys and columns", async () => {
      const service = new ReportingService(prisma);
      await expect(
        runWithTenantContext(context(), () =>
          service.generateCsv({ filters: {}, reportKey: "SQL_BUILDER" }),
        ),
      ).rejects.toBeInstanceOf(ReportValidationError);
      await expect(
        runWithTenantContext(context(), () =>
          service.generateCsv({
            columns: ["applicationId", "documentHash"],
            filters: {},
            reportKey: "APPLICATIONS_BY_COURSE_STATUS",
          }),
        ),
      ).rejects.toBeInstanceOf(ReportValidationError);
    });

    it("E5H-REP-05..06: Secretary without report.export is denied and creates no CSV artifact", async () => {
      const service = new ReportingService(prisma);
      await expect(
        runWithTenantContext(
          context({
            actorId: secretaryUser,
            capabilities: [
              PERMISSIONS.APPLICATION_READ,
              PERMISSIONS.REPORT_READ,
            ],
          }),
          () =>
            service.generateCsv({
              filters: {},
              reportKey: "APPLICATIONS_BY_COURSE_STATUS",
            }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
      const evidence = await runWithTenantContext(context(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.auditEvent.findMany({
            where: {
              action: "REPORT_EXPORT_DENIED",
              actorId: secretaryUser,
              tenantId: tenantA,
            },
          }),
        ),
      );
      expect(evidence).toHaveLength(1);
      expect(evidence[0]?.reasonCode).toBe("MISSING_REPORT_PERMISSION");
    });

    it("E5H-REP-07: restricted student columns require restricted.read", async () => {
      const service = new ReportingService(prisma);
      await expect(
        runWithTenantContext(
          context({
            capabilities: [PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT],
          }),
          () =>
            service.generateCsv({
              columns: ["applicationId", "studentGivenName"],
              filters: {},
              reportKey: "APPLICATIONS_BY_COURSE_STATUS",
            }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("E5H-REP-09: a tenant A export cannot use a tenant B offering filter", async () => {
      const service = new ReportingService(prisma);
      await expect(
        runWithTenantContext(context(), () =>
          service.generateCsv({
            filters: { offeringId: offeringB },
            reportKey: "APPLICATIONS_BY_COURSE_STATUS",
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("E5H-REP-10: application scope is applied server-side", async () => {
      const service = new ReportingService(prisma);
      const report = await runWithTenantContext(
        context({ scopes: [`application:${applicationOne}`] }),
        () =>
          service.generateCsv({
            filters: {},
            reportKey: "APPLICATIONS_BY_COURSE_STATUS",
          }),
      );
      expect(report.rowCount).toBe(1);
      expect(report.content).toContain(applicationOne);
    });

    it("E5H-REP-11..15 and REP-19: authorized CSV is minimized, hardened and audited", async () => {
      const service = new ReportingService(prisma);
      const report = await runWithTenantContext(context(), () =>
        service.generateCsv({
          columns: ["applicationId", "studentGivenName", "studentFamilyName"],
          filters: { offeringId: offeringA },
          reportKey: "APPLICATIONS_BY_COURSE_STATUS",
        }),
      );
      expect(report.content).toContain("'=Nombre sintético");
      expect(report.content).toContain('"Apellido, sintético"');
      expect(report.content).not.toContain("objectKey");
      const events = await runWithTenantContext(context(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.auditEvent.findMany({
            where: {
              action: {
                in: ["REPORT_EXPORT_REQUESTED", "REPORT_EXPORT_GENERATED"],
              },
              tenantId: tenantA,
            },
          }),
        ),
      );
      expect(
        events.some((event) => event.action === "REPORT_EXPORT_GENERATED"),
      ).toBe(true);
      expect(JSON.stringify(events)).not.toContain("=Nombre sintético");
    });

    it("E5H-REP-18: the technical export limit fails without silent truncation", async () => {
      process.env.REPORT_EXPORT_MAX_ROWS = "1";
      const service = new ReportingService(prisma);
      await expect(
        runWithTenantContext(context(), () =>
          service.generateCsv({
            filters: {},
            reportKey: "APPLICATIONS_BY_COURSE_STATUS",
          }),
        ),
      ).rejects.toBeInstanceOf(ReportExportLimitExceededError);
      delete process.env.REPORT_EXPORT_MAX_ROWS;
    });

    it("E5H-RBAC-01..03: permission catalog is closed and roleKey grants nothing", async () => {
      const service = new RoleAssignmentAdminService(prisma);
      await expect(
        runWithTenantContext(context(), () =>
          service.createAssignment({
            membershipId: targetMembership,
            permissions: ["application.decide.evil"],
            roleKey: "superadmin",
            scopes: ["*"],
            startsAt: new Date(),
          }),
        ),
      ).rejects.toBeInstanceOf(AccessAdminValidationError);
      const assignment = await runWithTenantContext(context(), () =>
        service.createAssignment({
          membershipId: targetMembership,
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "superadmin",
          scopes: ["*"],
          startsAt: new Date(),
        }),
      );
      expect(assignment.roleKey).toBe("superadmin");
      const resolved = await resolveEffectiveTenantContext({
        authenticatedUserId: targetUser,
        correlationId: randomUUID(),
        prisma,
        purpose: "E5H_TEST",
        requestedTenantCandidate: tenantA,
      });
      expect(resolved.decision).toBe("ALLOW");
      if (resolved.decision === "ALLOW") {
        expect(resolved.context.capabilities).toContain(
          PERMISSIONS.REPORT_READ,
        );
        expect(resolved.context.capabilities).not.toContain(
          PERMISSIONS.REPORT_EXPORT,
        );
      }
    });

    it("E5H-RBAC-04..07: managers cannot grant unowned capabilities, scopes or wildcard", async () => {
      const service = new RoleAssignmentAdminService(prisma);
      await expect(
        runWithTenantContext(
          context({
            capabilities: [PERMISSIONS.ROLE_ASSIGNMENT_MANAGE],
            scopes: [`application:${applicationOne}`],
          }),
          () =>
            service.createAssignment({
              membershipId: targetMembership,
              permissions: [PERMISSIONS.REPORT_EXPORT],
              roleKey: "unsafe-capability",
              scopes: [`application:${applicationOne}`],
              startsAt: new Date(),
            }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        runWithTenantContext(
          context({ scopes: [`application:${applicationOne}`] }),
          () =>
            service.createAssignment({
              membershipId: targetMembership,
              permissions: [PERMISSIONS.REPORT_READ],
              roleKey: "unsafe-scope",
              scopes: ["*"],
              startsAt: new Date(),
            }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("E5H-RBAC-06: tenant A cannot manage a tenant B membership", async () => {
      const service = new RoleAssignmentAdminService(prisma);
      await expect(
        runWithTenantContext(context(), () =>
          service.createAssignment({
            membershipId: foreignMembership,
            permissions: [PERMISSIONS.REPORT_READ],
            roleKey: "cross-tenant",
            scopes: ["*"],
            startsAt: new Date(),
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("E5H-RBAC-12..14: update/revoke use fencing and create durable audit evidence", async () => {
      const service = new RoleAssignmentAdminService(prisma);
      const access = await runWithTenantContext(context(), () =>
        service.listMembershipAccess(),
      );
      const assignment = access.find(
        (membership) => membership.id === targetMembership,
      )?.assignments[0];
      expect(assignment).toBeDefined();
      const updated = await runWithTenantContext(context(), () =>
        service.updateAssignment(assignment!.id, {
          expectedUpdatedAt: new Date(assignment!.updatedAt),
          permissions: [PERMISSIONS.REPORT_READ],
          roleKey: "report-reader-updated",
          scopes: ["*"],
          status: "SUSPENDED",
        }),
      );
      await expect(
        runWithTenantContext(context(), () =>
          service.updateAssignment(assignment!.id, {
            expectedUpdatedAt: new Date(assignment!.updatedAt),
            permissions: [PERMISSIONS.REPORT_READ],
            roleKey: "stale",
            scopes: ["*"],
            status: "ACTIVE",
          }),
        ),
      ).rejects.toBeInstanceOf(RoleAssignmentChangedError);
      const revoked = await runWithTenantContext(context(), () =>
        service.revokeAssignment(updated.id, new Date(updated.updatedAt)),
      );
      expect(revoked.status).toBe("REVOKED");
      const events = await runWithTenantContext(context(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.auditEvent.count({
            where: {
              resourceId: assignment!.id,
              resourceType: "RoleAssignment",
              tenantId: tenantA,
            },
          }),
        ),
      );
      expect(events).toBeGreaterThanOrEqual(3);
    });

    it("E5H-AUD-01..04: AuditEvent is append-only and tenant isolated for the app role", async () => {
      const auditId = await runWithTenantContext(context(), () =>
        withTenantTransaction(prisma, (tx) =>
          tx.auditEvent
            .findFirstOrThrow({
              where: { tenantId: tenantA },
              select: { id: true },
            })
            .then((event) => event.id),
        ),
      );
      await expect(
        runWithTenantContext(context(), () =>
          withTenantTransaction(
            prisma,
            (tx) =>
              tx.$executeRaw`UPDATE audit_events SET result = 'FAILURE' WHERE id = ${auditId}::uuid`,
          ),
        ),
      ).rejects.toThrow();
      await expect(
        runWithTenantContext(context(), () =>
          withTenantTransaction(
            prisma,
            (tx) =>
              tx.$executeRaw`DELETE FROM audit_events WHERE id = ${auditId}::uuid`,
          ),
        ),
      ).rejects.toThrow();
      const crossTenantCount = await runWithTenantContext(
        context({ tenantId: tenantB }),
        () =>
          withTenantTransaction(prisma, (tx) =>
            tx.auditEvent.count({ where: { id: auditId } }),
          ),
      );
      expect(crossTenantCount).toBe(0);
    });

    it("E5H-AUD-13..15: audit read preserves actors/correlation and is tenant scoped", async () => {
      const service = new AuditReadService(prisma);
      const result = await runWithTenantContext(context(), () =>
        service.listEvents({
          dateFrom: new Date(Date.now() - 86_400_000),
          dateTo: new Date(Date.now() + 86_400_000),
          limit: 100,
        }),
      );
      expect(result.items.length).toBeGreaterThan(0);
      expect(
        result.items.every(
          (event) =>
            event.actorId && event.effectiveActorId && event.correlationId,
        ),
      ).toBe(true);
      expect(JSON.stringify(result.items)).not.toContain("password");
    });
  },
);
