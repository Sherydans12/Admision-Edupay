import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { PERMISSIONS, type PermissionKey } from "./permission-catalog.js";

/**
 * One-shot, synthetic-only provisioning for the pre-production admissions
 * operator. This is intentionally not a general onboarding API.
 */
export const SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE = "synthetic-school";
export const SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY =
  "synthetic.admissions.operator";
export const SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS = Object.freeze([
  PERMISSIONS.APPLICATION_READ,
  PERMISSIONS.APPLICATION_RECOMMEND,
] satisfies readonly PermissionKey[]);

const BOOTSTRAP_ROLE_KEY = "institution_admin.bootstrap";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type SyntheticAdmissionsOperatorProvisionErrorCode =
  | "INVALID_OPERATOR_EMAIL"
  | "OPERATOR_EMAIL_NOT_VERIFIED"
  | "OPERATOR_ACCOUNT_NOT_ACTIVE"
  | "OPERATOR_ACCOUNT_NOT_FOUND"
  | "SYNTHETIC_CONFIRMATION_REQUIRED"
  | "SYNTHETIC_TENANT_REQUIRED"
  | "SYNTHETIC_PROVISIONER_NOT_FOUND"
  | "SYNTHETIC_PROVISIONER_ROLE_INCOMPATIBLE"
  | "SYNTHETIC_PROVISIONING_STATE_CONFLICT";

export class SyntheticAdmissionsOperatorProvisionError extends Error {
  constructor(
    readonly code: SyntheticAdmissionsOperatorProvisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SyntheticAdmissionsOperatorProvisionError";
  }
}

export interface ProvisionSyntheticAdmissionsOperatorInput {
  confirmation: string;
  operatorEmail: string;
  stage: string;
  tenantCode: string;
}

export interface ProvisionSyntheticAdmissionsOperatorResult {
  auditEventId: string;
  created: {
    auditEvent: boolean;
    membership: boolean;
    roleAssignment: boolean;
  };
  membershipId: string;
  operatorUserId: string;
  roleAssignmentId: string;
  tenantCode: typeof SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE;
  tenantId: string;
}

function stableUuid(key: string): string {
  const bytes = createHash("sha256")
    .update(key, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeOperatorEmail(value: string): string {
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > 320 ||
    !EMAIL_PATTERN.test(email) ||
    !email.endsWith("@resend.dev")
  ) {
    throw new SyntheticAdmissionsOperatorProvisionError(
      "INVALID_OPERATOR_EMAIL",
      "The synthetic operator must use a verified @resend.dev address",
    );
  }
  return email;
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class SyntheticAdmissionsOperatorProvisioner {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async provision(
    input: ProvisionSyntheticAdmissionsOperatorInput,
  ): Promise<ProvisionSyntheticAdmissionsOperatorResult> {
    if (input.stage !== "preproduction-synthetic") {
      throw new SyntheticAdmissionsOperatorProvisionError(
        "SYNTHETIC_TENANT_REQUIRED",
        "Synthetic admissions operator provisioning is restricted to preproduction-synthetic",
      );
    }
    if (input.tenantCode !== SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE) {
      throw new SyntheticAdmissionsOperatorProvisionError(
        "SYNTHETIC_TENANT_REQUIRED",
        "Synthetic admissions operator provisioning is restricted to synthetic-school",
      );
    }
    if (input.confirmation !== SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE) {
      throw new SyntheticAdmissionsOperatorProvisionError(
        "SYNTHETIC_CONFIRMATION_REQUIRED",
        "Confirmation must exactly match synthetic-school",
      );
    }
    const operatorEmail = normalizeOperatorEmail(input.operatorEmail);
    const tenantId = stableUuid(`admission:tenant:${input.tenantCode}`);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`admission:synthetic-admissions-operator:${input.tenantCode}`}, 0)
        )::text AS lock_result
      `;

      const tenant = await transaction.tenant.findUnique({
        where: { id: tenantId },
      });
      if (tenant === null || tenant.status !== "ACTIVE") {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_TENANT_REQUIRED",
          "The deterministic synthetic tenant must already exist and be active",
        );
      }

      const operator = await transaction.platformUser.findUnique({
        where: { emailNormalized: operatorEmail },
      });
      if (operator === null) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "OPERATOR_ACCOUNT_NOT_FOUND",
          "The operator must register before synthetic provisioning",
        );
      }
      if (operator.status !== "ACTIVE") {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "OPERATOR_ACCOUNT_NOT_ACTIVE",
          "The operator account must be active",
        );
      }
      if (operator.emailVerifiedAt === null) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "OPERATOR_EMAIL_NOT_VERIFIED",
          "The operator email must be verified",
        );
      }

      // The already-bootstrapped tenant administrator is the accountable
      // actor. No caller-supplied identity is allowed to become the actor.
      await transaction.$queryRaw`
        SELECT
          set_config('admission.tenant_id', ${tenantId}, true),
          set_config('admission.actor_id', '', true)
      `;
      const provisionerMembership = await transaction.membership.findFirst({
        include: {
          roleAssignments: {
            where: { roleKey: BOOTSTRAP_ROLE_KEY, status: "ACTIVE" },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { status: "ACTIVE", tenantId },
      });
      const provisionerAssignment = provisionerMembership?.roleAssignments[0];
      if (
        provisionerMembership === null ||
        provisionerAssignment === undefined
      ) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_PROVISIONER_NOT_FOUND",
          "An active institution_admin.bootstrap membership is required",
        );
      }
      if (
        !provisionerAssignment.permissions.includes(
          PERMISSIONS.ROLE_ASSIGNMENT_MANAGE,
        )
      ) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_PROVISIONER_ROLE_INCOMPATIBLE",
          "The synthetic provisioner role is missing required delegation capabilities",
        );
      }
      await transaction.$queryRaw`
        SELECT set_config('admission.actor_id', ${provisionerMembership.userId}, true)
      `;

      const now = this.clock();
      let membershipCreated = false;
      let membership = await transaction.membership.findFirst({
        where: { tenantId, userId: operator.id },
      });
      if (membership === null) {
        membership = await transaction.membership.create({
          data: {
            id: stableUuid(
              `admission:synthetic-admissions-operator:membership:${input.tenantCode}:${operator.id}`,
            ),
            startsAt: now,
            status: "ACTIVE",
            tenantId,
            userId: operator.id,
          },
        });
        membershipCreated = true;
      } else if (membership.status !== "ACTIVE" || membership.endsAt !== null) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "The operator membership has incompatible state",
        );
      }

      const roleAssignmentId = stableUuid(
        `admission:synthetic-admissions-operator:role:${input.tenantCode}:${operator.id}`,
      );
      const existingAssignments = await transaction.roleAssignment.findMany({
        where: {
          membershipId: membership.id,
          roleKey: SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY,
          tenantId,
        },
      });
      let roleAssignment = existingAssignments.find(
        (candidate) => candidate.id === roleAssignmentId,
      );
      if (
        existingAssignments.some(
          (candidate) => candidate.id !== roleAssignmentId,
        )
      ) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "A non-deterministic synthetic operator role already exists",
        );
      }
      let roleAssignmentCreated = false;
      if (roleAssignment === undefined) {
        roleAssignment = await transaction.roleAssignment.create({
          data: {
            id: roleAssignmentId,
            membershipId: membership.id,
            permissions: [...SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS],
            roleKey: SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY,
            scopes: ["*"],
            startsAt: now,
            status: "ACTIVE",
            tenantId,
          },
        });
        roleAssignmentCreated = true;
      } else if (
        roleAssignment.status !== "ACTIVE" ||
        roleAssignment.endsAt !== null ||
        !sameValues(
          roleAssignment.permissions,
          SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS,
        ) ||
        !sameValues(roleAssignment.scopes, ["*"])
      ) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "The deterministic synthetic operator role has incompatible state",
        );
      }

      const auditEventId = stableUuid(
        `admission:audit:synthetic-admissions-operator:${input.tenantCode}:${operator.id}`,
      );
      let auditEventCreated = false;
      const existingAudit = await transaction.auditEvent.findUnique({
        where: { id: auditEventId },
      });
      if (existingAudit === null) {
        await transaction.auditEvent.create({
          data: {
            action: "SYNTHETIC_ADMISSIONS_OPERATOR_PROVISIONED",
            actorId: provisionerMembership.userId,
            correlationId: `synthetic-admissions-operator:${input.tenantCode}`,
            effectiveActorId: provisionerMembership.userId,
            id: auditEventId,
            metadata: asJson({
              assignmentId: roleAssignment.id,
              membershipId: membership.id,
              permissions: [...SYNTHETIC_ADMISSIONS_OPERATOR_PERMISSIONS],
              roleKey: SYNTHETIC_ADMISSIONS_OPERATOR_ROLE_KEY,
              scopes: ["*"],
              status: "ACTIVE",
            }),
            occurredAt: now,
            purpose: "synthetic_preproduction_access",
            resourceId: membership.id,
            resourceType: "Membership",
            result: "SUCCESS",
            scope: "TENANT",
            tenantId,
          },
        });
        auditEventCreated = true;
      } else if (
        existingAudit.tenantId !== tenantId ||
        existingAudit.actorId !== provisionerMembership.userId ||
        existingAudit.action !== "SYNTHETIC_ADMISSIONS_OPERATOR_PROVISIONED"
      ) {
        throw new SyntheticAdmissionsOperatorProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "The deterministic synthetic operator audit event has incompatible state",
        );
      }

      return {
        auditEventId,
        created: {
          auditEvent: auditEventCreated,
          membership: membershipCreated,
          roleAssignment: roleAssignmentCreated,
        },
        membershipId: membership.id,
        operatorUserId: operator.id,
        roleAssignmentId: roleAssignment.id,
        tenantCode: SYNTHETIC_ADMISSIONS_OPERATOR_TENANT_CODE,
        tenantId,
      };
    });
  }
}
