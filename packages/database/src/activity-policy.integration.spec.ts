import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ActivityPolicyConflictError,
  ActivityPolicyService,
  ActivityService,
  ForbiddenError,
  PERMISSIONS,
  createAppPrismaClient,
  proposedActivityPolicyBaseline,
  runWithTenantContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";
import { getRequiredEnvironment } from "./environment.js";

const prisma = createAppPrismaClient();
const pool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});
const policyService = new ActivityPolicyService(prisma);
const activityService = new ActivityService(prisma);

const tenantId = randomUUID();
const adminUserId = randomUUID();
const primaryUserId = randomUUID();
const backupUserId = randomUUID();
const alternateUserId = randomUUID();
const inactiveUserId = randomUUID();
const noCapabilityUserId = randomUUID();
const primaryMembershipId = randomUUID();
const backupMembershipId = randomUUID();
const alternateMembershipId = randomUUID();
const inactiveMembershipId = randomUUID();
const noCapabilityMembershipId = randomUUID();

function context(
  capabilities: readonly string[] = [
    PERMISSIONS.ACTIVITY_POLICY_MANAGE,
    PERMISSIONS.ACTIVITY_POLICY_READ,
    PERMISSIONS.ACTIVITY_DEFINITION_MANAGE,
    PERMISSIONS.ACTIVITY_DEFINITION_PUBLISH,
  ],
): TenantExecutionContext {
  return {
    actorId: adminUserId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `r5-policy-${randomUUID()}`,
    effectiveActorId: adminUserId,
    purpose: "R5_SYNTHETIC_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function seed(): Promise<void> {
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    "R5 Policy Synthetic Tenant",
  ]);
  const users = [
    [adminUserId, "admin"],
    [primaryUserId, "primary"],
    [backupUserId, "backup"],
    [alternateUserId, "alternate"],
    [inactiveUserId, "inactive"],
    [noCapabilityUserId, "no-capability"],
  ] as const;
  for (const [userId, label] of users) {
    await pool.query(
      "INSERT INTO platform_users (id, email_normalized) VALUES ($1, $2)",
      [userId, `r5-${label}-${userId}@example.invalid`],
    );
  }
  const seededContext = context();
  await runWithTenantContext(seededContext, () =>
    withTenantTransaction(prisma, async (transaction) => {
      const startsAt = new Date(Date.now() - 60_000);
      await transaction.membership.createMany({
        data: [
          {
            id: primaryMembershipId,
            startsAt,
            tenantId,
            userId: primaryUserId,
          },
          {
            id: backupMembershipId,
            startsAt,
            tenantId,
            userId: backupUserId,
          },
          {
            id: alternateMembershipId,
            startsAt,
            tenantId,
            userId: alternateUserId,
          },
          {
            id: inactiveMembershipId,
            startsAt,
            status: "SUSPENDED",
            tenantId,
            userId: inactiveUserId,
          },
          {
            id: noCapabilityMembershipId,
            startsAt,
            tenantId,
            userId: noCapabilityUserId,
          },
        ],
      });
      await transaction.roleAssignment.createMany({
        data: [
          primaryMembershipId,
          backupMembershipId,
          alternateMembershipId,
          inactiveMembershipId,
        ].map((membershipId) => ({
          membershipId,
          permissions: [PERMISSIONS.ACTIVITY_PERFORM],
          roleKey: "synthetic-executor",
          scopes: ["*"],
          startsAt,
          tenantId,
        })),
      });
      await transaction.roleAssignment.create({
        data: {
          membershipId: noCapabilityMembershipId,
          permissions: [PERMISSIONS.ACTIVITY_READ],
          roleKey: "synthetic-observer",
          scopes: ["*"],
          startsAt,
          tenantId,
        },
      });
    }),
  );
}

describe.sequential("R5 tenant activity policy domain", () => {
  beforeAll(seed);

  it("R5-DUR-01..02: exposes 30/60 only as initialization baselines", () => {
    expect(proposedActivityPolicyBaseline("GUARDIAN_INTERVIEW")).toBe(30);
    expect(proposedActivityPolicyBaseline("DIAGNOSTIC_EVALUATION")).toBe(60);
  });

  it("R5-POL-01..04: rejects equal, inactive and incapable executors", async () => {
    const c = context();
    await expect(
      runWithTenantContext(c, () =>
        policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
          backupMembershipId: primaryMembershipId,
          defaultDurationMinutes: 30,
          primaryMembershipId,
        }),
      ),
    ).rejects.toMatchObject({
      code: "ACTIVITY_POLICY_EXECUTORS_MUST_DIFFER",
    });
    await expect(
      runWithTenantContext(c, () =>
        policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
          backupMembershipId: inactiveMembershipId,
          defaultDurationMinutes: 30,
          primaryMembershipId,
        }),
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_POLICY_EXECUTOR_INACTIVE" });
    await expect(
      runWithTenantContext(c, () =>
        policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
          backupMembershipId: noCapabilityMembershipId,
          defaultDurationMinutes: 30,
          primaryMembershipId,
        }),
      ),
    ).rejects.toMatchObject({
      code: "ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED",
    });
  });

  it("R5-DUR-06: validates the complete persisted duration boundary", async () => {
    const c = context();
    for (const defaultDurationMinutes of [0, -1, 1.5, 1441]) {
      await expect(
        runWithTenantContext(c, () =>
          policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
            backupMembershipId,
            defaultDurationMinutes,
            primaryMembershipId,
          }),
        ),
      ).rejects.toThrow("between 1 and 1440");
    }
  });

  it("R5-POL-05: creates atomically, audits and enforces optimistic concurrency", async () => {
    const c = context();
    const created = await runWithTenantContext(c, () =>
      policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
        backupMembershipId,
        defaultDurationMinutes: 30,
        primaryMembershipId,
      }),
    );
    expect(created).toMatchObject({ concurrencyVersion: 1, ready: true });
    await expect(
      runWithTenantContext(c, () =>
        policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
          backupMembershipId,
          defaultDurationMinutes: 31,
          primaryMembershipId,
        }),
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_POLICY_ALREADY_CONFIGURED" });
    const updated = await runWithTenantContext(c, () =>
      policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
        backupMembershipId,
        defaultDurationMinutes: 35,
        expectedVersion: 1,
        primaryMembershipId,
      }),
    );
    expect(updated.concurrencyVersion).toBe(2);
    await expect(
      runWithTenantContext(c, () =>
        policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
          backupMembershipId,
          defaultDurationMinutes: 40,
          expectedVersion: 1,
          primaryMembershipId,
        }),
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_POLICY_VERSION_CHANGED" });
    const auditCount = await runWithTenantContext(c, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.auditEvent.count({
          where: {
            action: {
              in: [
                "TENANT_ACTIVITY_POLICY_CREATED",
                "TENANT_ACTIVITY_POLICY_UPDATED",
              ],
            },
          },
        }),
      ),
    );
    expect(auditCount).toBe(2);
  });

  it("R5-DUR-03..05: resolves persisted defaults and preserves published snapshots", async () => {
    const c = context();
    const definition = await runWithTenantContext(c, () =>
      activityService.createDefinition(c, {
        code: `R5-INTERVIEW-${randomUUID()}`,
        kind: "GUARDIAN_INTERVIEW",
        name: "Synthetic guardian interview",
      }),
    );
    const fromDefault = await runWithTenantContext(c, () =>
      activityService.createVersion(c, definition.id, { required: true }),
    );
    expect(fromDefault).toMatchObject({
      durationMinutes: 35,
      durationSource: "TENANT_KIND_DEFAULT",
    });
    await runWithTenantContext(c, () =>
      activityService.publishVersion(c, fromDefault.id),
    );
    const override = await runWithTenantContext(c, () =>
      activityService.createVersion(c, definition.id, {
        durationMinutes: 45,
        required: true,
      }),
    );
    expect(override).toMatchObject({
      durationMinutes: 45,
      durationSource: "VERSION_OVERRIDE",
    });
    const updated = await runWithTenantContext(c, () =>
      policyService.putPolicy(c, "GUARDIAN_INTERVIEW", {
        backupMembershipId,
        defaultDurationMinutes: 40,
        expectedVersion: 2,
        primaryMembershipId,
      }),
    );
    expect(updated.concurrencyVersion).toBe(3);
    const persistedPublished = await runWithTenantContext(c, () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.activityDefinitionVersion.findUniqueOrThrow({
          where: { id: fromDefault.id },
        }),
      ),
    );
    expect(persistedPublished).toMatchObject({
      durationMinutes: 35,
      durationSource: "TENANT_KIND_DEFAULT",
    });
    const latestDefault = await runWithTenantContext(c, () =>
      activityService.createVersion(c, definition.id, { required: true }),
    );
    expect(latestDefault).toMatchObject({
      durationMinutes: 40,
      durationSource: "TENANT_KIND_DEFAULT",
    });
  });

  it("R5-POL-06: publication is fail-closed until a ready kind policy exists", async () => {
    const c = context();
    const definition = await runWithTenantContext(c, () =>
      activityService.createDefinition(c, {
        code: `R5-DIAGNOSTIC-${randomUUID()}`,
        kind: "DIAGNOSTIC_EVALUATION",
        name: "Synthetic diagnostic evaluation",
      }),
    );
    const version = await runWithTenantContext(c, () =>
      activityService.createVersion(c, definition.id, {
        durationMinutes: 60,
        required: true,
      }),
    );
    await expect(
      runWithTenantContext(c, () =>
        activityService.publishVersion(c, version.id),
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_POLICY_REQUIRED" });
    await runWithTenantContext(c, () =>
      policyService.putPolicy(c, "DIAGNOSTIC_EVALUATION", {
        backupMembershipId,
        defaultDurationMinutes: 60,
        primaryMembershipId,
      }),
    );
    await expect(
      runWithTenantContext(c, () =>
        activityService.publishVersion(c, version.id),
      ),
    ).resolves.toMatchObject({ lifecycle: "PUBLISHED" });
  });

  it("R5-POL-07..08: eligible executor projection is minimized and permissioned", async () => {
    const c = context();
    const eligible = await runWithTenantContext(c, () =>
      policyService.listEligibleExecutors(c),
    );
    expect(eligible).toEqual(
      [primaryMembershipId, backupMembershipId, alternateMembershipId]
        .sort()
        .map((membershipId) => ({
          membershipId,
          roleKeys: ["synthetic-executor"],
        })),
    );
    expect(JSON.stringify(eligible)).not.toContain("example.invalid");
    const denied = context([PERMISSIONS.ACTIVITY_POLICY_MANAGE]);
    await expect(
      runWithTenantContext(denied, () =>
        policyService.listEligibleExecutors(denied),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("R5-POL: errors remain canonical typed domain conflicts", () => {
    expect(
      new ActivityPolicyConflictError("ACTIVITY_POLICY_REQUIRED"),
    ).toMatchObject({
      code: "ACTIVITY_POLICY_REQUIRED",
      name: "ActivityPolicyConflictError",
    });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await pool.query("DELETE FROM platform_users WHERE id = ANY($1::uuid[])", [
      [
        adminUserId,
        primaryUserId,
        backupUserId,
        alternateUserId,
        inactiveUserId,
        noCapabilityUserId,
      ],
    ]);
    await prisma.$disconnect();
    await pool.end();
  });
});
