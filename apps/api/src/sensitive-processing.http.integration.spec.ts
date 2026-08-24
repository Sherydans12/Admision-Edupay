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
  adminConfigOnlyToken: string;
  adminFullToken: string;
  adminStaffBToken: string;
  familyAToken: string;
  formDefinitionAId: string;
  offeringAId: string;
  studentAId: string;
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
    correlationId: `sp-http-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "SENSITIVE_PROCESSING_HTTP_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function seedFixture() {
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const userAId = randomUUID();
  const adminFullId = randomUUID();
  const adminConfigOnlyId = randomUUID();
  const staffBId = randomUUID();
  const familyProfileAId = randomUUID();
  const studentAId = randomUUID();
  const now = new Date();

  await migrationPool.query(
    "INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)",
    [tenantAId, "Tenant A HTTP SP", tenantBId, "Tenant B HTTP SP"],
  );

  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, email_verified_at) VALUES
      ($1, $2, CURRENT_TIMESTAMP), ($3, $4, CURRENT_TIMESTAMP), ($5, $6, CURRENT_TIMESTAMP),
      ($7, $8, CURRENT_TIMESTAMP)`,
    [
      userAId,
      `family-a-${userAId}@example.invalid`,
      adminFullId,
      `admin-full-${adminFullId}@example.invalid`,
      adminConfigOnlyId,
      `admin-config-${adminConfigOnlyId}@example.invalid`,
      staffBId,
      `staff-b-${staffBId}@example.invalid`,
    ],
  );

  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)",
    [familyProfileAId, userAId, "Familia A SP"],
  );

  await migrationPool.query(
    "INSERT INTO students (id, family_profile_id, given_name, family_name, date_of_birth) VALUES ($1, $2, $3, $4, DATE '2015-01-01')",
    [studentAId, familyProfileAId, "Estudiante", "SP"],
  );

  const seedCtx = context(tenantAId, adminFullId, [
    PERMISSIONS.ADMISSION_CONFIG_READ,
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
    PERMISSIONS.FORM_MANAGE,
    PERMISSIONS.FORM_PUBLISH,
    PERMISSIONS.FORM_READ,
  ]);

  const { formDefId, offeringId } = await runWithTenantContext(seedCtx, () =>
    withTenantTransaction(prisma, async (tx) => {
      const campus = await tx.campus.create({
        data: {
          code: "SP-CAMPUS-A",
          name: "Sede SP HTTP",
          tenantId: tenantAId,
        },
      });
      const year = await tx.academicYear.create({
        data: {
          code: "SP-YEAR-A",
          label: "Año 2026 SP",
          status: "OPEN",
          tenantId: tenantAId,
        },
      });
      const level = await tx.courseLevel.create({
        data: {
          code: "SP-LEVEL-A",
          name: "Nivel 1 SP",
          tenantId: tenantAId,
        },
      });
      const process = await tx.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: "SP-PROCESS-A",
          name: "Proceso 2026 SP",
          status: "PUBLISHED",
          tenantId: tenantAId,
        },
      });
      const formDef = await tx.formDefinition.create({
        data: {
          name: "Formulario Base SP",
          purpose: "admission_application",
          tenantId: tenantAId,
        },
      });
      const formVersion = await tx.formVersion.create({
        data: {
          formDefinitionId: formDef.id,
          lifecycle: "DRAFT",
          tenantId: tenantAId,
          versionNumber: 1,
        },
      });
      const section = await tx.formSection.create({
        data: {
          formVersionId: formVersion.id,
          order: 1,
          tenantId: tenantAId,
          title: "Datos Generales",
        },
      });
      await tx.formField.create({
        data: {
          formVersionId: formVersion.id,
          key: "confirmed_info",
          label: "Confirma información",
          order: 1,
          processingCategory: "ORDINARY_ADMISSION",
          purpose: "admission_application",
          required: true,
          sectionId: section.id,
          sensitivity: "restricted",
          tenantId: tenantAId,
          type: "BOOLEAN",
        },
      });
      await tx.formVersion.update({
        data: {
          lifecycle: "PUBLISHED",
          publishedAt: now,
        },
        where: { id: formVersion.id },
      });
      const offering = await tx.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "LIMITED_CAPACITY",
          campusId: campus.id,
          code: "SP-OFFERING-A",
          courseLevelId: level.id,
          formVersionId: formVersion.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId: tenantAId,
          title: "Oferta SP 2026",
        },
      });
      await tx.admissionCapacity.create({
        data: {
          configuredCapacity: 10,
          offeringId: offering.id,
          tenantId: tenantAId,
        },
      });

      // Admin with full SP config capability
      const adminMembership = await tx.membership.create({
        data: {
          id: randomUUID(),
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
          userId: adminFullId,
        },
      });
      await tx.roleAssignment.create({
        data: {
          id: randomUUID(),
          membershipId: adminMembership.id,
          permissions: [
            PERMISSIONS.ADMISSION_CONFIG_READ,
            PERMISSIONS.ADMISSION_CONFIG_MANAGE,
            PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
            PERMISSIONS.FORM_MANAGE,
            PERMISSIONS.FORM_PUBLISH,
            PERMISSIONS.FORM_READ,
            PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
            PERMISSIONS.APPLICATION_AUTHORITY_READ,
            PERMISSIONS.APPLICATION_READ,
          ],
          roleKey: "SP_ADMIN_FULL_ROLE",
          scopes: ["*"],
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
        },
      });

      // Admin with read & manage but WITHOUT admission.sensitive_processing.configure
      const adminConfigMembership = await tx.membership.create({
        data: {
          id: randomUUID(),
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
          userId: adminConfigOnlyId,
        },
      });
      await tx.roleAssignment.create({
        data: {
          id: randomUUID(),
          membershipId: adminConfigMembership.id,
          permissions: [
            PERMISSIONS.ADMISSION_CONFIG_READ,
            PERMISSIONS.ADMISSION_CONFIG_MANAGE,
            PERMISSIONS.FORM_MANAGE,
            PERMISSIONS.FORM_PUBLISH,
            PERMISSIONS.FORM_READ,
          ],
          roleKey: "SP_ADMIN_READ_ONLY_ROLE",
          scopes: ["*"],
          startsAt: new Date(now.getTime() - 60_000),
          status: "ACTIVE",
          tenantId: tenantAId,
        },
      });

      return {
        formDefId: formDef.id,
        offeringId: offering.id,
      };
    }),
  );

  // Staff B in Tenant B
  const seedCtxB = context(tenantBId, staffBId, [
    PERMISSIONS.ADMISSION_CONFIG_READ,
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
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
            PERMISSIONS.ADMISSION_CONFIG_READ,
            PERMISSIONS.ADMISSION_CONFIG_MANAGE,
            PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
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

  const [familyASession, adminFullSession, adminConfigSession, staffBSession] =
    await Promise.all([
      sessions.issueSession(userAId),
      sessions.issueSession(adminFullId),
      sessions.issueSession(adminConfigOnlyId),
      sessions.issueSession(staffBId),
    ]);

  fixture = {
    adminConfigOnlyToken: adminConfigSession.token,
    adminFullToken: adminFullSession.token,
    adminStaffBToken: staffBSession.token,
    familyAToken: familyASession.token,
    formDefinitionAId: formDefId,
    offeringAId: offeringId,
    studentAId,
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
  "G5-PC1-R4 Sensitive Processing Direct HTTP Integration Suite",
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

    it("R4-HTTP-01: authorized staff GET effective policy succeeds", async () => {
      const res = await request(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing`,
        { token: fixture.adminFullToken },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: Array<{ category: string; enabled: boolean }>;
      };
      expect(body.items).toHaveLength(4);
      expect(
        body.items.find((i) => i.category === "ORDINARY_ADMISSION")?.enabled,
      ).toBe(true);
      expect(
        body.items.find((i) => i.category === "SUPPORT_ACCOMMODATION")?.enabled,
      ).toBe(true);
      expect(
        body.items.find((i) => i.category === "PIE_NEE_DIAGNOSTIC")?.enabled,
      ).toBe(false);
      expect(body.items.find((i) => i.category === "HEALTH")?.enabled).toBe(
        false,
      );
    });

    it("R4-HTTP-02: actor without admission.sensitive_processing.configure cannot update policy", async () => {
      const res = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminConfigOnlyToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: "Unauthorized attempt",
        },
      );
      expect(res.status).toBe(403);
    });

    it("R4-HTTP-03: authorized actor can update an allowed policy state", async () => {
      const res = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: "Authorized activation for clinical intake",
        },
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        category: string;
        enabled: boolean;
        purpose: string;
      };
      expect(body.category).toBe("HEALTH");
      expect(body.enabled).toBe(true);
      expect(body.purpose).toBe("Authorized activation for clinical intake");

      // Verify effective policies now show HEALTH = true
      const getRes = await request(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing`,
        { token: fixture.adminFullToken },
      );
      const getBody = (await getRes.json()) as {
        items: Array<{ category: string; enabled: boolean }>;
      };
      expect(getBody.items.find((i) => i.category === "HEALTH")?.enabled).toBe(
        true,
      );

      // Disable HEALTH again to return to default disabled state for following tests
      await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: false,
          purpose: null,
        },
      );
    });

    it("R4-HTTP-04: tenant mismatch is controlled/denied", async () => {
      // Staff B (Tenant B) trying to access Tenant A policy
      const res = await request(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing`,
        { token: fixture.adminStaffBToken },
      );
      expect([403, 404]).toContain(res.status);
    });

    it("R4-HTTP-05: HEALTH disabled + publish attempt via raw HTTP is denied", async () => {
      const draftRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms/${fixture.formDefinitionAId}/versions`,
        fixture.adminFullToken,
        {},
      );
      expect(draftRes.status).toBe(201);
      const draft = (await draftRes.json()) as { id: string };

      const secRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/sections`,
        fixture.adminFullToken,
        { order: 1, title: "Salud" },
      );
      const section = (await secRes.json()) as { id: string };

      await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "health_record",
          label: "Registro de salud",
          order: 1,
          processingCategory: "HEALTH",
          purpose: "medical_records",
          required: false,
          sectionId: section.id,
          sensitivity: "highly_restricted",
          type: "TEXT",
        },
      );

      // Attempt to publish when HEALTH is disabled on tenant
      const pubRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/publish`,
        fixture.adminFullToken,
        {},
      );
      expect(pubRes.status).toBe(400);
      const body = (await pubRes.json()) as { error: string };
      expect(body.error).toBe("VALIDATION");
    });

    it("R4-HTTP-06: PIE_NEE_DIAGNOSTIC disabled + publish attempt via raw HTTP is denied", async () => {
      const draftRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms/${fixture.formDefinitionAId}/versions`,
        fixture.adminFullToken,
        {},
      );
      const draft = (await draftRes.json()) as { id: string };

      const secRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/sections`,
        fixture.adminFullToken,
        { order: 1, title: "PIE" },
      );
      const section = (await secRes.json()) as { id: string };

      await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "pie_diagnostic",
          label: "Diagnóstico PIE",
          order: 1,
          processingCategory: "PIE_NEE_DIAGNOSTIC",
          purpose: "pie_support",
          required: false,
          sectionId: section.id,
          sensitivity: "highly_restricted",
          type: "TEXT",
        },
      );

      const pubRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/publish`,
        fixture.adminFullToken,
        {},
      );
      expect(pubRes.status).toBe(400);
      const body = (await pubRes.json()) as { error: string };
      expect(body.error).toBe("VALIDATION");
    });

    it("R4-HTTP-07: HIGHLY_RESTRICTED family-facing field without processingCategory cannot be published via raw HTTP", async () => {
      const draftRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms/${fixture.formDefinitionAId}/versions`,
        fixture.adminFullToken,
        {},
      );
      const draft = (await draftRes.json()) as { id: string };

      const secRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/sections`,
        fixture.adminFullToken,
        { order: 1, title: "Datos Críticos" },
      );
      const section = (await secRes.json()) as { id: string };

      await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "unclassified_critical",
          label: "Dato sin categoría",
          order: 1,
          processingCategory: null,
          purpose: "unclassified",
          required: false,
          sectionId: section.id,
          sensitivity: "highly_restricted",
          type: "TEXT",
        },
      );

      const pubRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/publish`,
        fixture.adminFullToken,
        {},
      );
      expect(pubRes.status).toBe(400);
      const body = (await pubRes.json()) as { error: string };
      expect(body.error).toBe("VALIDATION");
    });

    it("R4-HTTP-08: sensitive response requiring authority: email verification alone is insufficient and save is denied", async () => {
      // 1. Enable HEALTH temporarily to publish a form version with a HEALTH field
      await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: "Publishing health form version",
        },
      );

      const formDefRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms`,
        fixture.adminFullToken,
        {
          name: "Formulario Sensible R4",
          purpose: "admission_application",
        },
      );
      const formDef = (await formDefRes.json()) as { id: string };

      const draftRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms/${formDef.id}/versions`,
        fixture.adminFullToken,
        {},
      );
      const draft = (await draftRes.json()) as { id: string };

      const secRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/sections`,
        fixture.adminFullToken,
        { order: 1, title: "Salud" },
      );
      const section = (await secRes.json()) as { id: string };

      const fieldRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "health_allergies_http",
          label: "Alergias del estudiante",
          order: 1,
          processingCategory: "HEALTH",
          purpose: "medical_records",
          required: false,
          sectionId: section.id,
          sensitivity: "highly_restricted",
          type: "TEXT",
        },
      );
      const healthField = (await fieldRes.json()) as { id: string };

      const boolFieldRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "confirmed_info_http",
          label: "Confirma información",
          order: 2,
          processingCategory: "ORDINARY_ADMISSION",
          purpose: "admission_application",
          required: true,
          sectionId: section.id,
          sensitivity: "restricted",
          type: "BOOLEAN",
        },
      );
      const boolField = (await boolFieldRes.json()) as { id: string };

      await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/publish`,
        fixture.adminFullToken,
        {},
      );

      // Assign form version to the offering
      const assignRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/offerings/${fixture.offeringAId}/form-version`,
        fixture.adminFullToken,
        { formVersionId: draft.id },
        "PUT",
      );
      expect(assignRes.status).toBe(200);

      // Create or get draft application for student A
      const draftAppRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications`,
        fixture.familyAToken,
        {
          offeringId: fixture.offeringAId,
          studentId: fixture.studentAId,
        },
      );
      let appId = "";
      if (draftAppRes.status === 201) {
        appId = ((await draftAppRes.json()) as { id: string }).id;
      } else {
        const listRes = await request(
          `/family/tenants/${fixture.tenantAId}/applications`,
          { token: fixture.familyAToken },
        );
        const list = (await listRes.json()) as { items: Array<{ id: string }> };
        appId = list.items[0]!.id;
      }

      // Attempting to save HEALTH answer without declared/verified authority fails (409 or 400)
      const saveRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${appId}/answers`,
        fixture.familyAToken,
        {
          answers: [
            {
              fieldId: healthField.id,
              value: "Alergias HTTP sin autoridad",
            },
          ],
        },
        "PUT",
      );
      expect(saveRes.status).toBeGreaterThanOrEqual(400);

      // Prove ApplicationDraftAnswer was NOT written in the database
      const dbCheck = await migrationPool.query(
        "SELECT * FROM application_draft_answers WHERE application_id = $1 AND field_id = $2",
        [appId, healthField.id],
      );
      expect(dbCheck.rows).toHaveLength(0);

      // Store ids on fixture-scoped variables for next tests
      (fixture as Record<string, unknown>).sensitiveAppId = appId;
      (fixture as Record<string, unknown>).healthFieldId = healthField.id;
      (fixture as Record<string, unknown>).boolFieldId = boolField.id;
    });

    it("R4-HTTP-09: valid authority but category disabled remains denied fail-closed", async () => {
      const appId = (fixture as Record<string, unknown>)
        .sensitiveAppId as string;
      const healthFieldId = (fixture as Record<string, unknown>)
        .healthFieldId as string;

      // Declare authority
      const decRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${appId}/authority`,
        fixture.familyAToken,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );
      expect([201, 200]).toContain(decRes.status);
      const decBody = (await decRes.json()) as { concurrencyVersion: number };

      // Review authority: DECLARED -> UNDER_REVIEW -> VERIFIED
      const underReviewRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${appId}/authority/review`,
        fixture.adminFullToken,
        {
          expectedConcurrencyVersion: decBody.concurrencyVersion,
          reason: "Iniciando revision",
          toStatus: "UNDER_REVIEW",
        },
      );
      expect(underReviewRes.status).toBe(201);
      const underReviewBody = (await underReviewRes.json()) as {
        concurrencyVersion: number;
      };

      const verifyRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${appId}/authority/review`,
        fixture.adminFullToken,
        {
          expectedConcurrencyVersion: underReviewBody.concurrencyVersion,
          reason: "Direct verify for HTTP test",
          toStatus: "VERIFIED",
        },
      );
      expect(verifyRes.status).toBe(201);

      // Disable HEALTH category on tenant A
      const disableRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: false,
          purpose: null,
        },
      );
      expect(disableRes.status).toBe(201);

      // Attempt to save sensitive answer while category is disabled → 400
      const saveRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${appId}/answers`,
        fixture.familyAToken,
        {
          answers: [
            {
              fieldId: healthFieldId,
              value: "Alergias HTTP deshabilitado",
            },
          ],
        },
        "PUT",
      );
      expect(saveRes.status).toBe(400);

      // Prove ApplicationDraftAnswer was NOT persisted
      const dbCheck = await migrationPool.query(
        "SELECT * FROM application_draft_answers WHERE application_id = $1 AND field_id = $2",
        [appId, healthFieldId],
      );
      expect(dbCheck.rows).toHaveLength(0);
    });

    it("R4-HTTP-10: valid authority + enabled category + all normal requirements succeeds", async () => {
      const appId = (fixture as Record<string, unknown>)
        .sensitiveAppId as string;
      const healthFieldId = (fixture as Record<string, unknown>)
        .healthFieldId as string;
      const boolFieldId = (fixture as Record<string, unknown>)
        .boolFieldId as string;

      // Enable HEALTH category on tenant A with explicit purpose
      const enableRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: "Atención de primeros auxilios",
        },
      );
      expect(enableRes.status).toBe(201);

      // Save sensitive answer + required boolean answer
      const saveRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${appId}/answers`,
        fixture.familyAToken,
        {
          answers: [
            {
              fieldId: healthFieldId,
              value: "Sin alergias médicas conocidas",
            },
            {
              fieldId: boolFieldId,
              value: true,
            },
          ],
        },
        "PUT",
      );
      expect(saveRes.status).toBe(200);
      const saveBody = (await saveRes.json()) as {
        answers: Array<{ fieldId: string; value: unknown }>;
      };
      expect(
        saveBody.answers.find((a) => a.fieldId === healthFieldId)?.value,
      ).toBe("Sin alergias médicas conocidas");

      // Verify answers are reloaded via HTTP GET /form
      const formRes = await request(
        `/family/tenants/${fixture.tenantAId}/applications/${appId}/form`,
        { token: fixture.familyAToken },
      );
      expect(formRes.status).toBe(200);
      const formData = (await formRes.json()) as {
        answers: Array<{ fieldId: string; value: unknown }>;
      };
      expect(
        formData.answers.find((a) => a.fieldId === healthFieldId)?.value,
      ).toBe("Sin alergias médicas conocidas");

      // Submit succeeds
      const submitRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${appId}/submit`,
        fixture.familyAToken,
        {},
      );
      expect(submitRes.status).toBe(201);
    });

    it("R4-HTTP-11: family/raw caller cannot modify sensitive-processing policy", async () => {
      const res = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.familyAToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: "Illegal family attempt",
        },
      );
      expect([403, 404]).toContain(res.status);
    });

    it("R4-HTTP-12: standard API error envelope/correlation behavior is preserved", async () => {
      const res = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "INVALID_CAT",
          enabled: true,
          purpose: "Test invalid body",
        },
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        correlationId?: string;
        error?: string;
        message?: string;
      };
      expect(body.error).toBe("VALIDATION");
      expect(
        res.headers.get("x-correlation-id") || body.correlationId,
      ).toBeDefined();
    });

    it("R4-HTTP-13: enabling sensitive category with null purpose returns 400 validation error", async () => {
      const res = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: null,
        },
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("VALIDATION");
    });

    it("R4-CLEAR-HTTP-01: clear stored sensitive answer when category is disabled allows successful submission", async () => {
      // 1. Enable HEALTH on tenant
      const enableRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: true,
          purpose: "Captura de antecedentes médicos para clearance",
        },
      );
      expect(enableRes.status).toBe(201);

      // 2. Create dedicated form definition with HEALTH and ORDINARY fields
      const formDefRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms`,
        fixture.adminFullToken,
        {
          name: "Formulario Clear Sensible",
          purpose: "admission_application",
        },
      );
      const formDef = (await formDefRes.json()) as { id: string };

      const draftRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/forms/${formDef.id}/versions`,
        fixture.adminFullToken,
        {},
      );
      const draft = (await draftRes.json()) as { id: string };

      const secRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/sections`,
        fixture.adminFullToken,
        { order: 1, title: "Salud y Obligatorios" },
      );
      const section = (await secRes.json()) as { id: string };

      const healthFieldRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "health_clear_test",
          label: "Condición médica",
          order: 1,
          processingCategory: "HEALTH",
          purpose: "medical_records",
          required: false,
          sectionId: section.id,
          sensitivity: "highly_restricted",
          type: "TEXT",
        },
      );
      const healthField = (await healthFieldRes.json()) as { id: string };

      const boolFieldRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/fields`,
        fixture.adminFullToken,
        {
          key: "confirmed_terms_clear",
          label: "Acepta términos",
          order: 2,
          processingCategory: "ORDINARY_ADMISSION",
          purpose: "admission_application",
          required: true,
          sectionId: section.id,
          sensitivity: "restricted",
          type: "BOOLEAN",
        },
      );
      const boolField = (await boolFieldRes.json()) as { id: string };

      // Publish version
      const pubRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/form-versions/${draft.id}/publish`,
        fixture.adminFullToken,
        {},
      );
      expect([200, 201]).toContain(pubRes.status);

      // Assign to offering
      const assignRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/offerings/${fixture.offeringAId}/form-version`,
        fixture.adminFullToken,
        { formVersionId: draft.id },
        "PUT",
      );
      expect(assignRes.status).toBe(200);

      // 3. Create a fresh student and draft application for family A
      const studentRes = await migrationPool.query(
        `INSERT INTO students (id, family_profile_id, given_name, family_name, date_of_birth)
         VALUES ($1, (SELECT id FROM family_profiles WHERE user_id = $2 LIMIT 1), 'EstudianteClear', 'Prueba', DATE '2016-06-15')
         RETURNING id`,
        [randomUUID(), fixture.userAId],
      );
      const studentId = studentRes.rows[0].id as string;

      const draftAppRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications`,
        fixture.familyAToken,
        {
          offeringId: fixture.offeringAId,
          studentId,
        },
      );
      expect(draftAppRes.status).toBe(201);
      const app = (await draftAppRes.json()) as { id: string };

      // Declare and verify authority
      const decRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/authority`,
        fixture.familyAToken,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      );
      expect([200, 201]).toContain(decRes.status);
      const decBody = (await decRes.json()) as { concurrencyVersion: number };

      const underReviewRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${app.id}/authority/review`,
        fixture.adminFullToken,
        {
          expectedConcurrencyVersion: decBody.concurrencyVersion,
          reason: "Reviewing for clear test",
          toStatus: "UNDER_REVIEW",
        },
      );
      const underReviewBody = (await underReviewRes.json()) as {
        concurrencyVersion: number;
      };

      const verifyRes = await mutation(
        `/staff/tenants/${fixture.tenantAId}/applications/${app.id}/authority/review`,
        fixture.adminFullToken,
        {
          expectedConcurrencyVersion: underReviewBody.concurrencyVersion,
          reason: "Verified for clear test",
          toStatus: "VERIFIED",
        },
      );
      expect(verifyRes.status).toBe(201);

      // 4. Save HEALTH answer + required bool answer when HEALTH is enabled
      const saveActiveRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/answers`,
        fixture.familyAToken,
        {
          answers: [
            { fieldId: healthField.id, value: "Asma leve controlada" },
            { fieldId: boolField.id, value: true },
          ],
        },
        "PUT",
      );
      expect(saveActiveRes.status).toBe(200);

      // Verify answer exists in form
      const formActiveRes = await request(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/form`,
        { token: fixture.familyAToken },
      );
      expect(formActiveRes.status).toBe(200);
      const formActiveData = (await formActiveRes.json()) as {
        answers: Array<{ fieldId: string; value: unknown }>;
      };
      expect(
        formActiveData.answers.find((a) => a.fieldId === healthField.id)?.value,
      ).toBe("Asma leve controlada");

      // 5. Disable HEALTH category on tenant
      const disableRes = await mutation(
        `/admin/tenants/${fixture.tenantAId}/sensitive-processing/policy`,
        fixture.adminFullToken,
        {
          category: "HEALTH",
          enabled: false,
          purpose: null,
        },
      );
      expect(disableRes.status).toBe(201);

      // 6. Proving: disabled category + new non-null sensitive value is still denied (400)
      const saveDeniedRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/answers`,
        fixture.familyAToken,
        {
          answers: [
            { fieldId: healthField.id, value: "Nuevo dato sensible bloqueado" },
          ],
        },
        "PUT",
      );
      expect(saveDeniedRes.status).toBe(400);

      // 7. Proving: submitting application while disabled sensitive answer exists is denied (400)
      const submitBlockedRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/submit`,
        fixture.familyAToken,
        {},
      );
      expect(submitBlockedRes.status).toBe(400);

      // 8. PUT answer with value=null to clear the sensitive answer
      const clearRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/answers`,
        fixture.familyAToken,
        {
          answers: [{ fieldId: healthField.id, value: null }],
        },
        "PUT",
      );
      expect(clearRes.status).toBe(200);

      // 9. Prove answer for healthField is now absent in form
      const formClearedRes = await request(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/form`,
        { token: fixture.familyAToken },
      );
      expect(formClearedRes.status).toBe(200);
      const formClearedData = (await formClearedRes.json()) as {
        answers: Array<{ fieldId: string; value: unknown }>;
      };
      expect(
        formClearedData.answers.find((a) => a.fieldId === healthField.id),
      ).toBeUndefined();

      // 10. Submit application now succeeds (201) because no disabled sensitive answers remain
      const submitSuccessRes = await mutation(
        `/family/tenants/${fixture.tenantAId}/applications/${app.id}/submit`,
        fixture.familyAToken,
        {},
      );
      expect(submitSuccessRes.status).toBe(201);
    });
  },
);
