import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { PERMISSIONS, type PermissionKey } from "./permission-catalog.js";

/**
 * This provisioner is deliberately narrower than the normal access-admin
 * surface. It exists only to unblock the synthetic pre-production smoke and
 * must never be used as a production onboarding mechanism.
 */
export const SYNTHETIC_AUTHORITY_TENANT_CODE = "synthetic-school";
export const SYNTHETIC_AUTHORITY_REVIEWER_ROLE_KEY =
  "synthetic.authority.reviewer";
export const SYNTHETIC_AUTHORITY_REVIEWER_PERMISSIONS = Object.freeze([
  PERMISSIONS.APPLICATION_AUTHORITY_READ,
  PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
] satisfies readonly PermissionKey[]);

const BOOTSTRAP_ROLE_KEY = "institution_admin.bootstrap";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type SyntheticAuthorityReviewerProvisionErrorCode =
  | "INVALID_REVIEWER_EMAIL"
  | "REVIEWER_EMAIL_NOT_VERIFIED"
  | "REVIEWER_ACCOUNT_NOT_ACTIVE"
  | "REVIEWER_ACCOUNT_NOT_FOUND"
  | "SYNTHETIC_CONFIRMATION_REQUIRED"
  | "SYNTHETIC_TENANT_REQUIRED"
  | "SYNTHETIC_PROVISIONER_NOT_FOUND"
  | "SYNTHETIC_PROVISIONER_ROLE_INCOMPATIBLE"
  | "SYNTHETIC_PROVISIONING_STATE_CONFLICT";

export class SyntheticAuthorityReviewerProvisionError extends Error {
  constructor(
    readonly code: SyntheticAuthorityReviewerProvisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SyntheticAuthorityReviewerProvisionError";
  }
}

export interface ProvisionSyntheticAuthorityReviewerInput {
  confirmation: string;
  reviewerEmail: string;
  stage: string;
  tenantCode: string;
}

export interface ProvisionSyntheticAuthorityReviewerResult {
  auditEventId: string;
  created: {
    auditEvent: boolean;
    membership: boolean;
    roleAssignment: boolean;
  };
  membershipId: string;
  reviewerUserId: string;
  roleAssignmentId: string;
  tenantCode: typeof SYNTHETIC_AUTHORITY_TENANT_CODE;
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

function normalizeReviewerEmail(value: string): string {
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > 320 ||
    !EMAIL_PATTERN.test(email) ||
    !email.endsWith("@resend.dev")
  ) {
    throw new SyntheticAuthorityReviewerProvisionError(
      "INVALID_REVIEWER_EMAIL",
      "The synthetic reviewer must use a verified @resend.dev address",
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

export class SyntheticAuthorityReviewerProvisioner {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async provision(
    input: ProvisionSyntheticAuthorityReviewerInput,
  ): Promise<ProvisionSyntheticAuthorityReviewerResult> {
    if (input.stage !== "preproduction-synthetic") {
      throw new SyntheticAuthorityReviewerProvisionError(
        "SYNTHETIC_TENANT_REQUIRED",
        "Synthetic authority reviewer provisioning is restricted to preproduction-synthetic",
      );
    }
    if (input.tenantCode !== SYNTHETIC_AUTHORITY_TENANT_CODE) {
      throw new SyntheticAuthorityReviewerProvisionError(
        "SYNTHETIC_TENANT_REQUIRED",
        "Synthetic authority reviewer provisioning is restricted to synthetic-school",
      );
    }
    if (input.confirmation !== SYNTHETIC_AUTHORITY_TENANT_CODE) {
      throw new SyntheticAuthorityReviewerProvisionError(
        "SYNTHETIC_CONFIRMATION_REQUIRED",
        "Confirmation must exactly match synthetic-school",
      );
    }
    const reviewerEmail = normalizeReviewerEmail(input.reviewerEmail);
    const tenantId = stableUuid(`admission:tenant:${input.tenantCode}`);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`admission:synthetic-authority-reviewer:${input.tenantCode}`}, 0)
        )::text AS lock_result
      `;

      const tenant = await transaction.tenant.findUnique({
        where: { id: tenantId },
      });
      if (tenant === null || tenant.status !== "ACTIVE") {
        throw new SyntheticAuthorityReviewerProvisionError(
          "SYNTHETIC_TENANT_REQUIRED",
          "The deterministic synthetic tenant must already exist and be active",
        );
      }

      const reviewer = await transaction.platformUser.findUnique({
        where: { emailNormalized: reviewerEmail },
      });
      if (reviewer === null) {
        throw new SyntheticAuthorityReviewerProvisionError(
          "REVIEWER_ACCOUNT_NOT_FOUND",
          "The reviewer must register before synthetic provisioning",
        );
      }
      if (reviewer.status !== "ACTIVE") {
        throw new SyntheticAuthorityReviewerProvisionError(
          "REVIEWER_ACCOUNT_NOT_ACTIVE",
          "The reviewer account must be active",
        );
      }
      if (reviewer.emailVerifiedAt === null) {
        throw new SyntheticAuthorityReviewerProvisionError(
          "REVIEWER_EMAIL_NOT_VERIFIED",
          "The reviewer email must be verified",
        );
      }

      // The bootstrap administrator is the accountable actor for this
      // one-shot operation. It must already have the least-privilege bootstrap
      // role; no role is inferred from a caller-supplied email.
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
        throw new SyntheticAuthorityReviewerProvisionError(
          "SYNTHETIC_PROVISIONER_NOT_FOUND",
          "An active institution_admin.bootstrap membership is required",
        );
      }
      if (
        !provisionerAssignment.permissions.includes(
          PERMISSIONS.ROLE_ASSIGNMENT_MANAGE,
        )
      ) {
        throw new SyntheticAuthorityReviewerProvisionError(
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
        where: { tenantId, userId: reviewer.id },
      });
      if (membership === null) {
        membership = await transaction.membership.create({
          data: {
            id: stableUuid(
              `admission:synthetic-authority-reviewer:membership:${input.tenantCode}:${reviewer.id}`,
            ),
            startsAt: now,
            status: "ACTIVE",
            tenantId,
            userId: reviewer.id,
          },
        });
        membershipCreated = true;
      } else if (membership.status !== "ACTIVE" || membership.endsAt !== null) {
        throw new SyntheticAuthorityReviewerProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "The reviewer membership has incompatible state",
        );
      }

      const roleAssignmentId = stableUuid(
        `admission:synthetic-authority-reviewer:role:${input.tenantCode}:${reviewer.id}`,
      );
      const existingAssignments = await transaction.roleAssignment.findMany({
        where: {
          membershipId: membership.id,
          roleKey: SYNTHETIC_AUTHORITY_REVIEWER_ROLE_KEY,
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
        throw new SyntheticAuthorityReviewerProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "A non-deterministic synthetic reviewer role already exists",
        );
      }
      let roleAssignmentCreated = false;
      if (roleAssignment === undefined) {
        roleAssignment = await transaction.roleAssignment.create({
          data: {
            id: roleAssignmentId,
            membershipId: membership.id,
            permissions: [...SYNTHETIC_AUTHORITY_REVIEWER_PERMISSIONS],
            roleKey: SYNTHETIC_AUTHORITY_REVIEWER_ROLE_KEY,
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
          SYNTHETIC_AUTHORITY_REVIEWER_PERMISSIONS,
        ) ||
        !sameValues(roleAssignment.scopes, ["*"])
      ) {
        throw new SyntheticAuthorityReviewerProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "The deterministic synthetic reviewer role has incompatible state",
        );
      }

      const auditEventId = stableUuid(
        `admission:audit:synthetic-authority-reviewer:${input.tenantCode}:${reviewer.id}`,
      );
      let auditEventCreated = false;
      const existingAudit = await transaction.auditEvent.findUnique({
        where: { id: auditEventId },
      });
      if (existingAudit === null) {
        await transaction.auditEvent.create({
          data: {
            action: "SYNTHETIC_AUTHORITY_REVIEWER_PROVISIONED",
            actorId: provisionerMembership.userId,
            correlationId: `synthetic-authority-reviewer:${input.tenantCode}`,
            effectiveActorId: provisionerMembership.userId,
            id: auditEventId,
            metadata: asJson({
              assignmentId: roleAssignment.id,
              membershipId: membership.id,
              permissions: [...SYNTHETIC_AUTHORITY_REVIEWER_PERMISSIONS],
              roleKey: SYNTHETIC_AUTHORITY_REVIEWER_ROLE_KEY,
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
        existingAudit.action !== "SYNTHETIC_AUTHORITY_REVIEWER_PROVISIONED"
      ) {
        throw new SyntheticAuthorityReviewerProvisionError(
          "SYNTHETIC_PROVISIONING_STATE_CONFLICT",
          "The deterministic synthetic reviewer audit event has incompatible state",
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
        reviewerUserId: reviewer.id,
        roleAssignmentId: roleAssignment.id,
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
        tenantId,
      };
    });
  }
}
