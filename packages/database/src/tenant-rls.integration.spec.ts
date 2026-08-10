import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  runWithFamilyContext,
  getRequiredTenantContext,
  runWithTenantContext,
  TenantContextMissingError,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";
import {
  SYNTHETIC_TENANTS,
  syntheticAuthenticatedRequestContext,
  syntheticTrustedJobContext,
} from "./testing/synthetic-tenant-fixtures.js";

const appPrisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
  max: 2,
});

async function clearProbeRecords(): Promise<void> {
  await migrationPool.query('TRUNCATE TABLE "tenant_probe_records"');
}

async function createForCurrentTenant(label: string) {
  return withTenantTransaction(appPrisma, async (transaction) => {
    const { tenantId } = getRequiredTenantContext();

    return transaction.tenantProbeRecord.create({
      data: { label, tenantId },
    });
  });
}

async function listForCurrentTenant() {
  return withTenantTransaction(appPrisma, (transaction) =>
    transaction.tenantProbeRecord.findMany({ orderBy: { label: "asc" } }),
  );
}

describe.sequential("ADR-0003 PostgreSQL/Prisma tenant RLS PoC", () => {
  beforeEach(clearProbeRecords);

  it("POC-01 request context tenant A only sees tenant A", async () => {
    await runWithTenantContext(syntheticAuthenticatedRequestContext("A"), () =>
      createForCurrentTenant("request-a"),
    );

    const records = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      listForCurrentTenant,
    );

    expect(records.map(({ label }) => label)).toEqual(["request-a"]);
    expect(
      records.every(({ tenantId }) => tenantId === SYNTHETIC_TENANTS.A),
    ).toBe(true);
  });

  it("POC-02 trusted job context tenant B only sees tenant B", async () => {
    await runWithTenantContext(syntheticTrustedJobContext("B"), () =>
      createForCurrentTenant("job-b-seed"),
    );

    const records = await runWithTenantContext(
      syntheticTrustedJobContext("B"),
      listForCurrentTenant,
    );

    expect(records.map(({ label }) => label)).toEqual(["job-b-seed"]);
    expect(
      records.every(({ tenantId }) => tenantId === SYNTHETIC_TENANTS.B),
    ).toBe(true);
  });

  it("POC-03 absence of context denies application and database access", async () => {
    await expect(
      withTenantTransaction(appPrisma, async () => undefined),
    ).rejects.toBeInstanceOf(TenantContextMissingError);
    await expect(appPrisma.tenantProbeRecord.findMany()).resolves.toEqual([]);
    await expect(
      appPrisma.tenantProbeRecord.create({
        data: {
          label: "unauthorized-no-context",
          tenantId: SYNTHETIC_TENANTS.A,
        },
      }),
    ).rejects.toThrow();
  });

  it("POC-04 tenant A cannot read, update, or insert tenant B records", async () => {
    const tenantBRecord = await runWithTenantContext(
      syntheticTrustedJobContext("B"),
      () => createForCurrentTenant("tenant-b-private"),
    );

    await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      async () => {
        const visible = await listForCurrentTenant();
        expect(visible.some(({ id }) => id === tenantBRecord.id)).toBe(false);

        const update = await withTenantTransaction(appPrisma, (transaction) =>
          transaction.tenantProbeRecord.updateMany({
            data: { label: "cross-tenant-update" },
            where: { id: tenantBRecord.id },
          }),
        );
        expect(update.count).toBe(0);

        await expect(
          withTenantTransaction(appPrisma, (transaction) =>
            transaction.tenantProbeRecord.create({
              data: {
                id: randomUUID(),
                label: "cross-tenant-insert",
                tenantId: SYNTHETIC_TENANTS.B,
              },
            }),
          ),
        ).rejects.toThrow();
      },
    );
  });

  it("POC-05 alternating and concurrent pooled transactions never leak tenants", async () => {
    await runWithTenantContext(syntheticAuthenticatedRequestContext("A"), () =>
      createForCurrentTenant("pool-a-seed"),
    );
    await runWithTenantContext(syntheticTrustedJobContext("B"), () =>
      createForCurrentTenant("pool-b-seed"),
    );

    await Promise.all(
      Array.from({ length: 40 }, async (_, index) => {
        const tenant = index % 2 === 0 ? "A" : "B";
        const context =
          tenant === "A"
            ? syntheticAuthenticatedRequestContext(tenant)
            : syntheticTrustedJobContext(tenant);

        const records = await runWithTenantContext(
          context,
          listForCurrentTenant,
        );
        expect(records.length).toBeGreaterThan(0);
        expect(
          records.every(
            ({ tenantId }) => tenantId === SYNTHETIC_TENANTS[tenant],
          ),
        ).toBe(true);
      }),
    );

    await expect(appPrisma.tenantProbeRecord.findMany()).resolves.toEqual([]);
  });

  it("POC-06 Prisma operations work inside a context-setting transaction", async () => {
    const created = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, async (transaction) => {
          const record = await transaction.tenantProbeRecord.create({
            data: {
              label: "prisma-transaction",
              tenantId: SYNTHETIC_TENANTS.A,
            },
          });
          const loaded = await transaction.tenantProbeRecord.findUnique({
            where: { id: record.id },
          });

          expect(loaded).toEqual(record);
          return record;
        }),
    );

    expect(created.tenantId).toBe(SYNTHETIC_TENANTS.A);
  });

  it("POC-07 runtime and migration roles are distinct and runtime cannot bypass RLS", async () => {
    const [appRole] = await appPrisma.$queryRaw<
      Array<{ current_user: string; rolbypassrls: boolean; rolsuper: boolean }>
    >`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `;
    const migrationRole = await migrationPool.query<{
      current_user: string;
      rolbypassrls: boolean;
      rolsuper: boolean;
    }>(`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const tableSecurity = await migrationPool.query<{
      relforcerowsecurity: boolean;
      relowner: string;
      relrowsecurity: boolean;
    }>(`
      SELECT
        c.relrowsecurity,
        c.relforcerowsecurity,
        pg_get_userbyid(c.relowner) AS relowner
      FROM pg_class c
      WHERE c.oid = 'tenant_probe_records'::regclass
    `);

    expect(appRole).toEqual({
      current_user: "admission_app",
      rolbypassrls: false,
      rolsuper: false,
    });
    expect(migrationRole.rows[0]).toEqual({
      current_user: "admission_migrator",
      rolbypassrls: false,
      rolsuper: false,
    });
    expect(appRole?.current_user).not.toBe(migrationRole.rows[0]?.current_user);
    expect(tableSecurity.rows[0]).toEqual({
      relforcerowsecurity: true,
      relowner: "admission_migrator",
      relrowsecurity: true,
    });
  });

  it("POC-08 errors roll back and cannot degrade later operations to global access", async () => {
    await expect(
      runWithTenantContext(syntheticAuthenticatedRequestContext("A"), () =>
        withTenantTransaction(appPrisma, async (transaction) => {
          await transaction.tenantProbeRecord.create({
            data: {
              label: "must-roll-back",
              tenantId: SYNTHETIC_TENANTS.A,
            },
          });
          throw new Error("synthetic rollback");
        }),
      ),
    ).rejects.toThrow("synthetic rollback");

    await expect(appPrisma.tenantProbeRecord.findMany()).resolves.toEqual([]);
    const tenantARecords = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      listForCurrentTenant,
    );
    expect(tenantARecords.some(({ label }) => label === "must-roll-back")).toBe(
      false,
    );
  });
});

type E5BRlsRows = {
  answerId: string;
  applicationId: string;
  definitionId: string;
  fieldId: string;
  offeringId: string;
  profileId: string;
  sectionId: string;
  snapshotId: string;
  userId: string;
  versionId: string;
};

async function clearE5BRlsRows(): Promise<void> {
  await migrationPool.query(`TRUNCATE TABLE
    "application_snapshots", "application_draft_answers", "audit_events", "applications",
    "admission_offerings", "form_fields", "form_sections", "form_versions", "form_definitions",
    "admission_processes", "course_levels", "academic_years", "campuses", "students",
    "family_profiles", "platform_sessions", "platform_users", "tenants" CASCADE`);
}

async function seedE5BRlsTenant(
  context: ReturnType<typeof syntheticAuthenticatedRequestContext>,
  suffix: string,
): Promise<E5BRlsRows> {
  const userId = randomUUID();
  const profileId = randomUUID();
  const studentId = randomUUID();
  await migrationPool.query(
    `INSERT INTO tenants (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [context.tenantId, `Synthetic E5B RLS Tenant ${suffix}`],
  );
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)`,
    [userId, `synthetic-e5b-rls-${suffix}-${userId}@example.invalid`],
  );
  await migrationPool.query(
    `INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1, $2, $3)`,
    [profileId, userId, `Familia RLS sintética ${suffix}`],
  );
  await migrationPool.query(
    `INSERT INTO students (id, family_profile_id, given_name, family_name) VALUES ($1, $2, $3, $4)`,
    [studentId, profileId, `Estudiante ${suffix}`, `Familia ${suffix}`],
  );

  return runWithTenantContext(context, () =>
    withTenantTransaction(appPrisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: {
          code: `RLS-CAMPUS-${suffix}`,
          name: `Sede ${suffix}`,
          tenantId: context.tenantId,
        },
      });
      const year = await transaction.academicYear.create({
        data: {
          code: `RLS-YEAR-${suffix}`,
          label: `Año ${suffix}`,
          status: "OPEN",
          tenantId: context.tenantId,
        },
      });
      const level = await transaction.courseLevel.create({
        data: {
          code: `RLS-LEVEL-${suffix}`,
          name: `Nivel ${suffix}`,
          tenantId: context.tenantId,
        },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: year.id,
          code: `RLS-PROCESS-${suffix}`,
          name: `Proceso ${suffix}`,
          status: "PUBLISHED",
          tenantId: context.tenantId,
        },
      });
      const definition = await transaction.formDefinition.create({
        data: {
          name: `Formulario RLS ${suffix}`,
          purpose: "admission_application",
          tenantId: context.tenantId,
        },
      });
      const version = await transaction.formVersion.create({
        data: {
          formDefinitionId: definition.id,
          tenantId: context.tenantId,
          versionNumber: 1,
        },
      });
      const section = await transaction.formSection.create({
        data: {
          formVersionId: version.id,
          order: 1,
          tenantId: context.tenantId,
          title: `Sección RLS ${suffix}`,
        },
      });
      const field = await transaction.formField.create({
        data: {
          formVersionId: version.id,
          key: `rls_field_${suffix.toLowerCase()}`,
          label: `Campo RLS ${suffix}`,
          order: 1,
          purpose: "Validar RLS",
          required: false,
          sectionId: section.id,
          sensitivity: "restricted",
          tenantId: context.tenantId,
          type: "TEXT",
        },
      });
      await transaction.formVersion.update({
        data: { lifecycle: "PUBLISHED", publishedAt: new Date() },
        where: { id: version.id },
      });
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: year.id,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId: campus.id,
          code: `RLS-OFFER-${suffix}`,
          courseLevelId: level.id,
          formVersionId: version.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId: context.tenantId,
          title: `Oferta RLS ${suffix}`,
        },
      });
      const application = await transaction.application.create({
        data: {
          academicYearId: year.id,
          draftData: { acknowledgedNoGuarantee: false, currentStep: "CONTEXT" },
          familyProfileId: profileId,
          formVersionId: version.id,
          offeringId: offering.id,
          processId: process.id,
          studentId,
          tenantId: context.tenantId,
        },
      });
      const answer = await transaction.applicationDraftAnswer.create({
        data: {
          applicationId: application.id,
          fieldId: field.id,
          formVersionId: version.id,
          tenantId: context.tenantId,
          value: `Respuesta RLS ${suffix}`,
        },
      });
      const snapshot = await transaction.applicationSnapshot.create({
        data: {
          applicationId: application.id,
          formVersionId: version.id,
          payload: { schemaVersion: 1, synthetic: true },
          submittedAt: new Date(),
          submittedBy: userId,
          tenantId: context.tenantId,
        },
      });
      await transaction.application.update({
        data: { status: "SUBMITTED", submittedAt: snapshot.submittedAt },
        where: { id: application.id },
      });
      return {
        answerId: answer.id,
        applicationId: application.id,
        definitionId: definition.id,
        fieldId: field.id,
        offeringId: offering.id,
        profileId,
        sectionId: section.id,
        snapshotId: snapshot.id,
        userId,
        versionId: version.id,
      };
    }),
  );
}

describe.sequential("E5-B tenant-owned form and snapshot RLS", () => {
  let rowsA: E5BRlsRows;
  let rowsB: E5BRlsRows;

  beforeEach(async () => {
    await clearE5BRlsRows();
    rowsA = await seedE5BRlsTenant(
      syntheticAuthenticatedRequestContext("A"),
      "A",
    );
    rowsB = await seedE5BRlsTenant(
      syntheticAuthenticatedRequestContext("B"),
      "B",
    );
  });

  it("E5B-TEN-01: form definitions are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.formDefinition.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.definitionId]);
    expect(visible.some((row) => row.id === rowsB.definitionId)).toBe(false);
  });

  it("E5B-TEN-02: versions, sections and fields are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, async (transaction) => ({
          fields: await transaction.formField.findMany(),
          sections: await transaction.formSection.findMany(),
          versions: await transaction.formVersion.findMany(),
        })),
    );
    expect(visible.versions.map((row) => row.id)).toEqual([rowsA.versionId]);
    expect(visible.sections.map((row) => row.id)).toEqual([rowsA.sectionId]);
    expect(visible.fields.map((row) => row.id)).toEqual([rowsA.fieldId]);
  });

  it("E5B-TEN-03: draft answers are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.applicationDraftAnswer.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.answerId]);
    expect(visible.some((row) => row.id === rowsB.answerId)).toBe(false);
  });

  it("E5B-TEN-04: application snapshots are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.applicationSnapshot.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.snapshotId]);
    expect(visible.some((row) => row.id === rowsB.snapshotId)).toBe(false);
  });

  it("E5B-TEN-05: absence of tenant context denies all new tables", async () => {
    await expect(appPrisma.formDefinition.findMany()).resolves.toEqual([]);
    await expect(appPrisma.formVersion.findMany()).resolves.toEqual([]);
    await expect(appPrisma.formSection.findMany()).resolves.toEqual([]);
    await expect(appPrisma.formField.findMany()).resolves.toEqual([]);
    await expect(appPrisma.applicationDraftAnswer.findMany()).resolves.toEqual(
      [],
    );
    await expect(appPrisma.applicationSnapshot.findMany()).resolves.toEqual([]);
  });

  it("E5B-TEN-06: platform/family context does not obtain tenant content", async () => {
    const platformLikeFamilyContext = {
      actorId: randomUUID(),
      contextOrigin: "synthetic_test" as const,
      correlationId: `synthetic-platform-${randomUUID()}`,
      effectiveActorId: randomUUID(),
      familyCapabilities: [] as const,
      purpose: "platform.metrics",
      source: "trusted_job" as const,
    };
    const visible = await runWithFamilyContext(platformLikeFamilyContext, () =>
      appPrisma.formDefinition.findMany(),
    );
    expect(visible).toEqual([]);
  });
});

type E5CRlsRows = {
  assistanceId: string;
  requirementId: string;
  requirementVersionId: string;
  reviewId: string;
  submissionId: string;
  versionId: string;
};

async function seedE5CRlsRows(
  context: ReturnType<typeof syntheticAuthenticatedRequestContext>,
  base: E5BRlsRows,
  suffix: string,
): Promise<E5CRlsRows> {
  return runWithTenantContext(context, () =>
    withTenantTransaction(appPrisma, async (transaction) => {
      const requirement = await transaction.documentRequirement.create({
        data: {
          code: `RLS-DOC-${suffix}`,
          name: `Documento RLS ${suffix}`,
          purpose: "Validar aislamiento E5-C",
          tenantId: context.tenantId,
        },
      });
      const requirementVersion =
        await transaction.documentRequirementVersion.create({
          data: {
            allowedFileTypes: ["PDF"],
            allowsEquivalent: false,
            correctionWindowBusinessDays: 3,
            documentRequirementId: requirement.id,
            lifecycle: "PUBLISHED",
            maxFileSizeBytes: 1024,
            publishedAt: new Date(),
            required: true,
            sensitivity: "restricted",
            tenantId: context.tenantId,
            validityRule: "NONE",
            versionNumber: 1,
          },
        });
      await transaction.application.update({
        data: { documentRequirementsPinnedAt: new Date() },
        where: { id: base.applicationId },
      });
      const submission = await transaction.documentSubmission.create({
        data: {
          applicationId: base.applicationId,
          documentRequirementId: requirement.id,
          requirementVersionId: requirementVersion.id,
          tenantId: context.tenantId,
        },
      });
      const version = await transaction.documentVersion.create({
        data: {
          approvedObjectKey: randomUUID(),
          declaredMime: "application/pdf",
          detectedMime: "application/pdf",
          displayNameSanitized: "synthetic.pdf",
          documentSubmissionId: submission.id,
          origin: "SELF_SERVICE",
          quarantineObjectKey: randomUUID(),
          readyAt: new Date(),
          scanProvider: "synthetic-test",
          scanStatus: "CLEAN",
          sha256: "a".repeat(64),
          sizeBytes: 32,
          technicalStatus: "READY_FOR_REVIEW",
          tenantId: context.tenantId,
          uploadedBy: base.userId,
          versionNumber: 1,
        },
      });
      await transaction.documentSubmission.update({
        data: { currentDocumentVersionId: version.id, status: "ACEPTADO" },
        where: { id: submission.id },
      });
      const review = await transaction.documentReview.create({
        data: {
          actorId: base.userId,
          documentSubmissionId: submission.id,
          documentVersionId: version.id,
          tenantId: context.tenantId,
          verdict: "ACCEPTED",
        },
      });
      const assistance = await transaction.assistanceSession.create({
        data: {
          adultPresentConfirmed: true,
          adultResponsibleUserId: base.userId,
          authorizationConfirmed: true,
          authorizationMethod: "IN_PERSON_CONFIRMED",
          authorizationRecordedAt: new Date(),
          correlationId: `synthetic-e5c-rls-${suffix}`,
          familyProfileId: base.profileId,
          operatorRoleSnapshot: "application.assist",
          operatorUserId: base.userId,
          startedAt: new Date(),
          tenantId: context.tenantId,
        },
      });
      return {
        assistanceId: assistance.id,
        requirementId: requirement.id,
        requirementVersionId: requirementVersion.id,
        reviewId: review.id,
        submissionId: submission.id,
        versionId: version.id,
      };
    }),
  );
}

describe.sequential("E5-C tenant-owned document and assistance RLS", () => {
  let baseA: E5BRlsRows;
  let baseB: E5BRlsRows;
  let rowsA: E5CRlsRows;
  let rowsB: E5CRlsRows;

  beforeEach(async () => {
    await clearE5BRlsRows();
    baseA = await seedE5BRlsTenant(
      syntheticAuthenticatedRequestContext("A"),
      "A",
    );
    baseB = await seedE5BRlsTenant(
      syntheticAuthenticatedRequestContext("B"),
      "B",
    );
    rowsA = await seedE5CRlsRows(
      syntheticAuthenticatedRequestContext("A"),
      baseA,
      "A",
    );
    rowsB = await seedE5CRlsRows(
      syntheticAuthenticatedRequestContext("B"),
      baseB,
      "B",
    );
  });

  it("E5C-TEN-01: requirements and exact versions are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, async (transaction) => ({
          requirements: await transaction.documentRequirement.findMany(),
          versions: await transaction.documentRequirementVersion.findMany(),
        })),
    );
    expect(visible.requirements.map((row) => row.id)).toEqual([
      rowsA.requirementId,
    ]);
    expect(visible.versions.map((row) => row.id)).toEqual([
      rowsA.requirementVersionId,
    ]);
  });

  it("E5C-TEN-02: submissions are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.documentSubmission.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.submissionId]);
    expect(visible.some((row) => row.id === rowsB.submissionId)).toBe(false);
  });

  it("E5C-TEN-03: document versions are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.documentVersion.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.versionId]);
  });

  it("E5C-TEN-04: reviews are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.documentReview.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.reviewId]);
  });

  it("E5C-TEN-05: assistance sessions are isolated", async () => {
    const visible = await runWithTenantContext(
      syntheticAuthenticatedRequestContext("A"),
      () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.assistanceSession.findMany(),
        ),
    );
    expect(visible.map((row) => row.id)).toEqual([rowsA.assistanceId]);
  });

  it("E5C-TEN-06: absence of tenant context denies every E5-C table", async () => {
    await expect(appPrisma.documentRequirement.findMany()).resolves.toEqual([]);
    await expect(
      appPrisma.documentRequirementVersion.findMany(),
    ).resolves.toEqual([]);
    await expect(appPrisma.documentSubmission.findMany()).resolves.toEqual([]);
    await expect(appPrisma.documentVersion.findMany()).resolves.toEqual([]);
    await expect(appPrisma.documentReview.findMany()).resolves.toEqual([]);
    await expect(appPrisma.assistanceSession.findMany()).resolves.toEqual([]);
  });

  it("E5C-TEN-07: a platform-like context without elevation cannot see tenant documents", async () => {
    const visible = await runWithFamilyContext(
      {
        actorId: randomUUID(),
        contextOrigin: "synthetic_test",
        correlationId: `synthetic-platform-${randomUUID()}`,
        familyCapabilities: [],
        purpose: "platform.metrics",
        source: "trusted_job",
      },
      () => appPrisma.documentRequirement.findMany(),
    );
    expect(visible).toEqual([]);
  });

  it("E5C-TEN-08: same-tenant composite FK rejects cross-tenant scope", async () => {
    await expect(
      runWithTenantContext(syntheticAuthenticatedRequestContext("A"), () =>
        withTenantTransaction(appPrisma, (transaction) =>
          transaction.documentRequirementVersion.create({
            data: {
              allowedFileTypes: ["PDF"],
              allowsEquivalent: false,
              correctionWindowBusinessDays: 3,
              documentRequirementId: rowsA.requirementId,
              maxFileSizeBytes: 1024,
              required: false,
              scopeOfferingId: baseB.offeringId,
              sensitivity: "restricted",
              tenantId: SYNTHETIC_TENANTS.A,
              validityRule: "NONE",
              versionNumber: 2,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });
});

afterAll(async () => {
  await appPrisma.$disconnect();
  await migrationPool.end();
});
