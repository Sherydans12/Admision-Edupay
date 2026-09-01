import { describe, expect, it, vi } from "vitest";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import {
  SYNTHETIC_ADMISSIONS_DIRECTOR_PERMISSIONS,
  SYNTHETIC_ADMISSIONS_DIRECTOR_ROLE_KEY,
  SYNTHETIC_ADMISSIONS_DIRECTOR_TENANT_CODE,
  SyntheticAdmissionsDirectorProvisioner,
} from "./synthetic-admissions-director.js";

const validInput = {
  confirmation: SYNTHETIC_ADMISSIONS_DIRECTOR_TENANT_CODE,
  directorEmail: "admissions-director@resend.dev",
  stage: "preproduction-synthetic",
  tenantCode: SYNTHETIC_ADMISSIONS_DIRECTOR_TENANT_CODE,
};

describe("synthetic admissions director guardrails", () => {
  it("rejects non-synthetic stages and tenants", async () => {
    const provisioner = new SyntheticAdmissionsDirectorProvisioner({
      $transaction: vi.fn(),
    } as unknown as PrismaClient);
    await expect(
      provisioner.provision({ ...validInput, stage: "production" }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_TENANT_REQUIRED" });
    await expect(
      provisioner.provision({ ...validInput, tenantCode: "other-school" }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_TENANT_REQUIRED" });
    await expect(
      provisioner.provision({ ...validInput, confirmation: "synthetic-typo" }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_CONFIRMATION_REQUIRED" });
  });

  it("accepts only a synthetic Resend address", async () => {
    await expect(
      new SyntheticAdmissionsDirectorProvisioner({
        $transaction: vi.fn(),
      } as unknown as PrismaClient).provision({
        ...validInput,
        directorEmail: "director@example.invalid",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DIRECTOR_EMAIL" });
  });

  it("creates a least-privilege assignment once and is idempotent", async () => {
    const director = {
      emailNormalized: validInput.directorEmail,
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
          where.userId === director.id
            ? (memberships[0] ?? null)
            : provisionerMembership,
      },
      platformUser: {
        findUnique: async () => director,
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
    const provisioner = new SyntheticAdmissionsDirectorProvisioner(
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
      ...SYNTHETIC_ADMISSIONS_DIRECTOR_PERMISSIONS,
    ]);
    expect(assignments[0]?.roleKey).toBe(
      SYNTHETIC_ADMISSIONS_DIRECTOR_ROLE_KEY,
    );
    expect(assignments[0]?.scopes).toEqual(["*"]);
    expect(audit).toMatchObject({
      action: "SYNTHETIC_ADMISSIONS_DIRECTOR_PROVISIONED",
      resourceType: "Membership",
      result: "SUCCESS",
      scope: "TENANT",
    });
  });
});
