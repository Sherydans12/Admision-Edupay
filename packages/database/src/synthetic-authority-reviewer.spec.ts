import { describe, expect, it, vi } from "vitest";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import {
  SYNTHETIC_AUTHORITY_TENANT_CODE,
  SyntheticAuthorityReviewerProvisioner,
} from "./synthetic-authority-reviewer.js";

function service() {
  return new SyntheticAuthorityReviewerProvisioner({
    $transaction: vi.fn(),
  } as unknown as PrismaClient);
}

describe("synthetic authority reviewer guardrails", () => {
  it("rejects every stage except the explicitly synthetic preproduction stage", async () => {
    await expect(
      service().provision({
        confirmation: SYNTHETIC_AUTHORITY_TENANT_CODE,
        reviewerEmail: "reviewer@resend.dev",
        stage: "production",
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
      }),
    ).rejects.toMatchObject({
      code: "SYNTHETIC_TENANT_REQUIRED",
    });
  });

  it("rejects a non-synthetic tenant code before touching the database", async () => {
    await expect(
      service().provision({
        confirmation: "other-school",
        reviewerEmail: "reviewer@resend.dev",
        stage: "preproduction-synthetic",
        tenantCode: "other-school",
      }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_TENANT_REQUIRED" });
  });

  it("requires an exact confirmation token", async () => {
    await expect(
      service().provision({
        confirmation: "synthetic-school-typo",
        reviewerEmail: "reviewer@resend.dev",
        stage: "preproduction-synthetic",
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
      }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_CONFIRMATION_REQUIRED" });
  });

  it("accepts only a synthetic Resend address", async () => {
    await expect(
      service().provision({
        confirmation: SYNTHETIC_AUTHORITY_TENANT_CODE,
        reviewerEmail: "reviewer@example.invalid",
        stage: "preproduction-synthetic",
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REVIEWER_EMAIL" });
  });

  it("creates the least-privilege assignment once and is idempotent", async () => {
    const reviewer = {
      emailNormalized: "reviewer@resend.dev",
      emailVerifiedAt: new Date("2026-08-25T12:00:00.000Z"),
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "ACTIVE" as const,
    };
    const provisionerMembership = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      roleAssignments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          permissions: ["role_assignment.manage"],
        },
      ],
      userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };
    const memberships: Array<Record<string, unknown>> = [];
    const assignments: Array<Record<string, unknown>> = [];
    let audit: Record<string, unknown> | null = null;
    const transaction = {
      $queryRaw: async () => [],
      auditEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          audit = data;
          return data;
        },
        findUnique: async () => audit,
      },
      membership: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            ...data,
            createdAt: new Date(),
            endsAt: null,
            updatedAt: new Date(),
          };
          memberships.push(row);
          return row;
        },
        findFirst: async ({ where }: { where: { userId?: string } }) =>
          where.userId === reviewer.id
            ? (memberships[0] ?? null)
            : provisionerMembership,
      },
      platformUser: {
        findUnique: async () => reviewer,
      },
      roleAssignment: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, endsAt: null };
          assignments.push(row);
          return row;
        },
        findMany: async () => assignments,
      },
      tenant: {
        findUnique: async () => ({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          status: "ACTIVE" as const,
        }),
      },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
        callback(transaction),
    } as unknown as PrismaClient;
    const provisioner = new SyntheticAuthorityReviewerProvisioner(
      prisma,
      () => new Date("2026-08-25T13:00:00.000Z"),
    );

    const first = await provisioner.provision({
      confirmation: SYNTHETIC_AUTHORITY_TENANT_CODE,
      reviewerEmail: reviewer.emailNormalized,
      stage: "preproduction-synthetic",
      tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
    });
    const second = await provisioner.provision({
      confirmation: SYNTHETIC_AUTHORITY_TENANT_CODE,
      reviewerEmail: reviewer.emailNormalized,
      stage: "preproduction-synthetic",
      tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
    });

    expect(first.created).toEqual({
      auditEvent: true,
      membership: true,
      roleAssignment: true,
    });
    expect(second.created).toEqual({
      auditEvent: false,
      membership: false,
      roleAssignment: false,
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.permissions).toEqual([
      "application.authority.read",
      "application.authority.review",
    ]);
    expect(assignments[0]?.roleKey).toBe("synthetic.authority.reviewer");
    expect(assignments[0]?.scopes).toEqual(["*"]);
    expect(audit).toMatchObject({
      action: "SYNTHETIC_AUTHORITY_REVIEWER_PROVISIONED",
      resourceType: "Membership",
      result: "SUCCESS",
      scope: "TENANT",
    });
  });
});
