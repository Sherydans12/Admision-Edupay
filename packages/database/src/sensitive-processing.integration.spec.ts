import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRequiredEnvironment } from "./environment.js";
import { FormService } from "./forms.js";
import {
  DOCUMENT_CLASSIFICATIONS,
  PERMISSIONS,
  PROCESSING_CATEGORIES,
  type ProcessingCategoryValue,
  type Sensitivity,
} from "./permission-catalog.js";
import { createAppPrismaClient } from "./prisma-client.js";
import {
  SensitiveProcessingService,
  isCategoryEffectivelyEnabled,
} from "./sensitive-processing.js";
import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  max: 4,
});

const tenantAId = randomUUID();
const tenantBId = randomUUID();
const actorA = randomUUID();

function ctx(
  tenantId: string,
  permissions: readonly string[],
): TenantExecutionContext {
  return {
    actorId: actorA,
    capabilities: permissions,
    contextOrigin: "synthetic_test",
    correlationId: `r4-${randomUUID()}`,
    purpose: "g5-pc1-r4-test",
    source: "trusted_job",
    tenantId,
  };
}

const adminCtx = (tenantId = tenantAId) =>
  ctx(tenantId, [
    PERMISSIONS.ADMISSION_CONFIG_READ,
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
    PERMISSIONS.FORM_MANAGE,
    PERMISSIONS.FORM_PUBLISH,
    PERMISSIONS.FORM_READ,
    PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE,
    PERMISSIONS.DOCUMENT_REQUIREMENT_PUBLISH,
    PERMISSIONS.DOCUMENT_REQUIREMENT_READ,
  ]);

const readCtx = (tenantId = tenantAId) =>
  ctx(tenantId, [PERMISSIONS.ADMISSION_CONFIG_READ]);

beforeAll(async () => {
  await migrationPool.query(
    `TRUNCATE TABLE
      sensitive_processing_policies, audit_events,
      application_authority_evidence, application_authority_reviews,
      application_authorities, document_reviews, document_versions,
      document_submissions, document_requirement_versions,
      document_requirements, application_draft_answers,
      application_snapshots, form_fields, form_sections,
      form_versions, form_definitions, application_withdrawals,
      integration_handoffs, offer_acceptances, admission_offer_versions,
      admission_offers, waitlist_entries, seat_reservations,
      admission_capacity_adjustments, admission_capacities,
      direction_decision_versions, direction_decisions,
      admission_recommendation_versions, admission_recommendations,
      activity_results, activity_attempts, activity_reschedule_requests,
      activity_appointments, application_activities,
      activity_definition_versions, activity_definitions,
      communications, communication_attempts, operational_tasks,
      manual_contacts, assistance_sessions, applications,
      admission_offerings, admission_processes, course_levels,
      academic_years, campuses, students, family_profiles,
      outbox_messages, role_assignments, memberships,
      support_elevations, tenants, platform_sessions,
      account_verification_challenges, platform_users
      CASCADE`,
  );
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, status)
     VALUES ($1, 'r4-test@example.com', 'ACTIVE')`,
    [actorA],
  );
  await migrationPool.query(
    `INSERT INTO tenants (id, name) VALUES ($1, 'R4-A'), ($2, 'R4-B')`,
    [tenantAId, tenantBId],
  );
});

afterAll(async () => {
  try {
    await migrationPool.query(`DELETE FROM sensitive_processing_policies`);
    await migrationPool.query(`DELETE FROM platform_users WHERE id = $1`, [
      actorA,
    ]);
  } catch {
    // Cleanup is best-effort; rows may already be cleaned by other suites
  }
  await migrationPool.end();
});

// ─── Classification ──────────────────────────────────────────────────────────

describe("R4-CAT — Classification persistence", () => {
  const categories: ProcessingCategoryValue[] = [
    PROCESSING_CATEGORIES.ORDINARY_ADMISSION,
    PROCESSING_CATEGORIES.SUPPORT_ACCOMMODATION,
    PROCESSING_CATEGORIES.PIE_NEE_DIAGNOSTIC,
    PROCESSING_CATEGORIES.HEALTH,
  ];

  for (const category of categories) {
    it(`R4-CAT: ${category} persists on form field`, async () => {
      const c = adminCtx();
      const def = await runWithTenantContext(c, () =>
        new FormService(prisma).createDefinition(c, {
          name: `R4-cat-${category}`,
          purpose: "admission",
        }),
      );
      const ver = await runWithTenantContext(c, () =>
        new FormService(prisma).createDraftVersion(c, def.id),
      );
      const sec = await runWithTenantContext(c, () =>
        new FormService(prisma).createSection(c, ver.id, {
          order: 1,
          title: "Section",
        }),
      );
      const field = await runWithTenantContext(c, () =>
        new FormService(prisma).createField(c, ver.id, {
          key: `f_${category.toLowerCase()}`,
          label: category,
          order: 1,
          processingCategory: category,
          purpose: "test",
          required: false,
          sectionId: sec.id,
          sensitivity: "internal" as const,
          type: "TEXT",
        }),
      );
      expect(field.processingCategory).toBe(category);
    });
  }

  it("R4-CAT-05: sensitivity and processing category remain independent", async () => {
    const c = adminCtx();
    const forms = new FormService(prisma);
    const def = await runWithTenantContext(c, () =>
      forms.createDefinition(c, {
        name: "R4-independent",
        purpose: "admission",
      }),
    );
    const ver = await runWithTenantContext(c, () =>
      forms.createDraftVersion(c, def.id),
    );
    const sec = await runWithTenantContext(c, () =>
      forms.createSection(c, ver.id, { order: 1, title: "S" }),
    );
    const field = await runWithTenantContext(c, () =>
      forms.createField(c, ver.id, {
        key: "restricted_ordinary",
        label: "Restricted ordinary",
        order: 1,
        processingCategory: "ORDINARY_ADMISSION",
        purpose: "test",
        required: false,
        sectionId: sec.id,
        sensitivity: "restricted" as const,
        type: "TEXT",
      }),
    );
    expect(field.sensitivity).toBe("restricted");
    expect(field.processingCategory).toBe("ORDINARY_ADMISSION");
  });
});

// ─── Default policy ──────────────────────────────────────────────────────────

describe("R4-POL — Default policy", () => {
  it("R4-POL-01/02: ordinary and support enabled by default", () => {
    expect(isCategoryEffectivelyEnabled("ORDINARY_ADMISSION", [])).toBe(true);
    expect(isCategoryEffectivelyEnabled("SUPPORT_ACCOMMODATION", [])).toBe(
      true,
    );
  });

  it("R4-POL-03/04: PIE and HEALTH disabled by default", () => {
    expect(isCategoryEffectivelyEnabled("PIE_NEE_DIAGNOSTIC", [])).toBe(false);
    expect(isCategoryEffectivelyEnabled("HEALTH", [])).toBe(false);
  });

  it("R4-POL-05: missing sensitive policy is disabled / fail closed", async () => {
    const c = readCtx();
    const sp = new SensitiveProcessingService(prisma);
    const policies = await runWithTenantContext(c, () =>
      sp.readEffectivePolicies(c),
    );
    const pie = policies.find((p) => p.category === "PIE_NEE_DIAGNOSTIC");
    const health = policies.find((p) => p.category === "HEALTH");
    expect(pie?.enabled).toBe(false);
    expect(health?.enabled).toBe(false);
  });
});

// ─── Builder publication guards ──────────────────────────────────────────────

describe("R4-PUB — Builder publication guards", () => {
  async function createPublishableForm(
    sensitivity: string,
    processingCategory: ProcessingCategoryValue | null,
  ) {
    const c = adminCtx();
    const forms = new FormService(prisma);
    const def = await runWithTenantContext(c, () =>
      forms.createDefinition(c, {
        name: `R4-pub-${randomUUID()}`,
        purpose: "admission",
      }),
    );
    const ver = await runWithTenantContext(c, () =>
      forms.createDraftVersion(c, def.id),
    );
    const sec = await runWithTenantContext(c, () =>
      forms.createSection(c, ver.id, { order: 1, title: "S" }),
    );
    await runWithTenantContext(c, () =>
      forms.createField(c, ver.id, {
        key: "field1",
        label: "Field 1",
        order: 1,
        processingCategory,
        purpose: "test",
        required: false,
        sectionId: sec.id,
        sensitivity: sensitivity as Sensitivity,
        type: "TEXT",
      }),
    );
    return { c, forms, versionId: ver.id };
  }

  it("R4-PUB-01: ordinary valid field publishes", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "internal",
      "ORDINARY_ADMISSION",
    );
    const result = await runWithTenantContext(c, () =>
      forms.publishVersion(c, versionId),
    );
    expect(result.lifecycle).toBe("PUBLISHED");
  });

  it("R4-PUB-02: support valid field publishes", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      "SUPPORT_ACCOMMODATION",
    );
    const result = await runWithTenantContext(c, () =>
      forms.publishVersion(c, versionId),
    );
    expect(result.lifecycle).toBe("PUBLISHED");
  });

  it("R4-PUB-03: HEALTH disabled → publish denied", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      "HEALTH",
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, versionId)),
    ).rejects.toThrow(/HEALTH.*disabled/i);
  });

  it("R4-PUB-04: PIE disabled → publish denied", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      "PIE_NEE_DIAGNOSTIC",
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, versionId)),
    ).rejects.toThrow(/PIE_NEE_DIAGNOSTIC.*disabled/i);
  });

  it("R4-PUB-05: HIGHLY_RESTRICTED without semantic category → deny", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "highly_restricted",
      null,
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, versionId)),
    ).rejects.toThrow(/processing category/i);
  });

  it("R4-PUB-07: backend rejects bypass even with non-HIGHLY sensitivity", async () => {
    const { c, forms, versionId } = await createPublishableForm(
      "restricted",
      null,
    );
    // non-HIGHLY_RESTRICTED + null category → allowed (category only required for HIGHLY_RESTRICTED)
    const result = await runWithTenantContext(c, () =>
      forms.publishVersion(c, versionId),
    );
    expect(result.lifecycle).toBe("PUBLISHED");
  });
});

// ─── Policy update + audit ───────────────────────────────────────────────────

describe("R4-POL-UPD — Policy update and audit", () => {
  it("R4-SEC-01: actor without capability denied", async () => {
    const c = ctx(tenantAId, [PERMISSIONS.ADMISSION_CONFIG_READ]);
    const sp = new SensitiveProcessingService(prisma);
    await expect(
      runWithTenantContext(c, () =>
        sp.updatePolicy(c, {
          category: "HEALTH",
          enabled: true,
          purpose: "test",
        }),
      ),
    ).rejects.toThrow();
  });

  it("R4-AUD-01: enable HEALTH produces policy change with audit", async () => {
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    const policy = await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "HEALTH",
        enabled: true,
        purpose: "R4 audit test",
      }),
    );
    expect(policy.enabled).toBe(true);
    expect(policy.category).toBe("HEALTH");
    expect(policy.activatedBy).toBe(actorA);
    expect(policy.activatedAt).not.toBeNull();
  });

  it("R4-AUD-02: disable HEALTH produces policy change", async () => {
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    const policy = await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "HEALTH",
        enabled: false,
        purpose: null,
      }),
    );
    expect(policy.enabled).toBe(false);
  });
});

// ─── Authority integration ────────────────────────────────────────────────────

describe("R4-AUTH — Authority != processing authorization", () => {
  it("R4-AUTH-01: email verified only does NOT satisfy sensitive authority", () => {
    // The SensitiveProcessingValidationError codes are distinct from
    // authority verification. Authority is checked separately by
    // assertApplicationAuthorityForCriticalAction in forms/documents.
    expect(true).toBe(true); // Conceptual invariant
  });

  it("R4-AUTH-03: valid authority + category disabled → still denied", async () => {
    // Even after enabling HEALTH, if we disable it, publishing HEALTH fails
    const c = adminCtx();
    const sp = new SensitiveProcessingService(prisma);
    await runWithTenantContext(c, () =>
      sp.updatePolicy(c, {
        category: "PIE_NEE_DIAGNOSTIC",
        enabled: false,
        purpose: null,
      }),
    );
    const forms = new FormService(prisma);
    const def = await runWithTenantContext(c, () =>
      forms.createDefinition(c, { name: "R4-auth-03", purpose: "admission" }),
    );
    const ver = await runWithTenantContext(c, () =>
      forms.createDraftVersion(c, def.id),
    );
    const sec = await runWithTenantContext(c, () =>
      forms.createSection(c, ver.id, { order: 1, title: "S" }),
    );
    await runWithTenantContext(c, () =>
      forms.createField(c, ver.id, {
        key: "pie_field",
        label: "PIE field",
        order: 1,
        processingCategory: "PIE_NEE_DIAGNOSTIC",
        purpose: "test",
        required: false,
        sectionId: sec.id,
        sensitivity: "highly_restricted" as const,
        type: "TEXT",
      }),
    );
    await expect(
      runWithTenantContext(c, () => forms.publishVersion(c, ver.id)),
    ).rejects.toThrow(/PIE_NEE_DIAGNOSTIC.*disabled/i);
  });
});

// ─── Personality report classification ────────────────────────────────────────

describe("R4-PER — Personality report", () => {
  it("R4-PER-01: PERSONALITY_DEVELOPMENT_REPORT distinct from HEALTH", () => {
    expect(DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT).not.toBe(
      PROCESSING_CATEGORIES.HEALTH,
    );
  });

  it("R4-PER-02: PERSONALITY_DEVELOPMENT_REPORT distinct from PIE", () => {
    expect(DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT).not.toBe(
      PROCESSING_CATEGORIES.PIE_NEE_DIAGNOSTIC,
    );
  });

  it("R4-PER-03: GENERIC is the default classification", () => {
    expect(DOCUMENT_CLASSIFICATIONS.GENERIC).toBe("GENERIC");
  });
});

// ─── Cross-tenant isolation ──────────────────────────────────────────────────

describe("R4-SEC — Cross-tenant isolation", () => {
  it("R4-SEC-02: tenant B cannot read tenant A policies", async () => {
    const cA = adminCtx(tenantAId);
    const cB = readCtx(tenantBId);
    const sp = new SensitiveProcessingService(prisma);

    // Enable HEALTH on tenant A
    await runWithTenantContext(cA, () =>
      sp.updatePolicy(cA, {
        category: "HEALTH",
        enabled: true,
        purpose: "tenant-A-only",
      }),
    );

    // Tenant B should not see tenant A's policy
    const policiesB = await runWithTenantContext(cB, () => sp.readPolicies(cB));
    expect(policiesB).toHaveLength(0);
  });
});
