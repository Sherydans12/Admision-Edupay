import { describe, expect, it, vi } from "vitest";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import {
  SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS,
  SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY,
  SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE,
  SyntheticAdmissionsOperatorProvisioner,
} from "./synthetic-admissions-operator.js";

const validInput = {
  confirmation: SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE,
  operatorEmail: "admissions-operator@resend.dev",
  stage: "preproduction-synthetic",
  tenantCode: SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE,
};

describe("synthetic admissions operator guardrails", () => {
  it("rejects every stage except synthetic preproduction", async () => {
    await expect(
      new SyntheticAdmissionsOperatorProvisioner({
        $transaction: vi.fn(),
      } as unknown as PrismaClient).provision({
        ...validInput,
        stage: "production",
      }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_TENANT_REQUIRED" });
  });

  it("requires the exact tenant and confirmation", async () => {
    const provisioner = new SyntheticAdmissionsOperatorProvisioner({
      $transaction: vi.fn(),
    } as unknown as PrismaClient);
    await expect(
      provisioner.provision({ ...validInput, tenantCode: "other-school" }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_TENANT_REQUIRED" });
    await expect(
      provisioner.provision({ ...validInput, confirmation: "synthetic-typo" }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_CONFIRMATION_REQUIRED" });
  });

  it("accepts only a verified synthetic Resend address", async () => {
    await expect(
      new SyntheticAdmissionsOperatorProvisioner({
        $transaction: vi.fn(),
      } as unknown as PrismaClient).provision({
        ...validInput,
        operatorEmail: "operator@example.invalid",
      }),
    ).rejects.toMatchObject({ code: "INVALID_OPERATOR_EMAIL" });
  });

  it("creates the least-privilege assignment once and is idempotent", async () => {
    const operator = {
      emailNormalized: validInput.operatorEmail,
      emailVerifiedAt: new Date("2026-09-01T12:00:00.000Z"),
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
          where.userId === operator.id
            ? (memberships[0] ?? null)
            : provisionerMembership,
      },
      platformUser: {
        findUnique: async () => operator,
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
    const provisioner = new SyntheticAdmissionsOperatorProvisioner(
      prisma,
      () => new Date("2026-09-01T13:00:00.000Z"),
    );

    const first = await provisioner.provision(validInput);
    const second = await provisioner.provision(validInput);

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
      ...SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS,
    ]);
    expect(assignments[0]?.roleKey).toBe(
      SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY,
    );
    expect(assignments[0]?.scopes).toEqual(["*"]);
    expect(audit).toMatchObject({
      action: "SYNTHETIC_ADMISSIONS_OPERATOR_PROVISIONED",
      resourceType: "Membership",
      result: "SUCCESS",
      scope: "TENANT",
    });
  });
});
