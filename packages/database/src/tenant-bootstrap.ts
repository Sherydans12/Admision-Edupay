import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { PERMISSIONS, type PermissionKey } from "./permission-catalog.js";

const TENANT_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const BOOTSTRAP_ROLE_KEY = "institution_admin.bootstrap";

/**
 * Deliberately excludes operational decision, recommendation, sensitive-content
 * read and platform-support powers. The initial administrator can configure the
 * tenant and delegate separately approved operational roles.
 */
export const INITIAL_TENANT_ADMIN_PERMISSIONS = Object.freeze([
  PERMISSIONS.ADMISSION_CONFIG_MANAGE,
  PERMISSIONS.ADMISSION_CONFIG_READ,
  PERMISSIONS.ACTIVITY_DEFINITION_MANAGE,
  PERMISSIONS.ACTIVITY_DEFINITION_PUBLISH,
  PERMISSIONS.ACTIVITY_POLICY_MANAGE,
  PERMISSIONS.ACTIVITY_POLICY_READ,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.CAPACITY_MANAGE,
  PERMISSIONS.CAPACITY_READ,
  PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE,
  PERMISSIONS.DOCUMENT_REQUIREMENT_PUBLISH,
  PERMISSIONS.DOCUMENT_REQUIREMENT_READ,
  PERMISSIONS.FORM_MANAGE,
  PERMISSIONS.FORM_PUBLISH,
  PERMISSIONS.FORM_READ,
  PERMISSIONS.REPORT_READ,
  PERMISSIONS.ROLE_ASSIGNMENT_MANAGE,
  PERMISSIONS.ROLE_ASSIGNMENT_READ,
] satisfies readonly PermissionKey[]);

export type TenantBootstrapErrorCode =
  | "ADMIN_ACCOUNT_NOT_ACTIVE"
  | "ADMIN_ACCOUNT_NOT_FOUND"
  | "ADMIN_EMAIL_NOT_VERIFIED"
  | "BOOTSTRAP_STATE_CONFLICT"
  | "INVALID_ADMIN_EMAIL"
  | "INVALID_TENANT_CODE"
  | "INVALID_TENANT_NAME";

export class TenantBootstrapError extends Error {
  constructor(
    readonly code: TenantBootstrapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TenantBootstrapError";
  }
}

export interface BootstrapTenantAdminInput {
  adminEmail: string;
  tenantCode: string;
  tenantName: string;
}

export interface BootstrapTenantAdminResult {
  adminUserId: string;
  auditEventId: string;
  created: {
    auditEvent: boolean;
    membership: boolean;
    roleAssignment: boolean;
    tenant: boolean;
  };
  membershipId: string;
  roleAssignmentId: string;
  tenantCode: string;
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

export function normalizeTenantCode(value: string): string {
  const code = value.normalize("NFKC").trim().toLowerCase();
  if (!TENANT_CODE_PATTERN.test(code)) {
    throw new TenantBootstrapError(
      "INVALID_TENANT_CODE",
      "tenantCode must contain 2-63 lowercase letters, numbers or hyphens",
    );
  }
  return code;
}

function normalizeTenantName(value: string): string {
  const name = value.normalize("NFKC").trim();
  if (name.length === 0 || name.length > 160) {
    throw new TenantBootstrapError(
      "INVALID_TENANT_NAME",
      "tenantName must contain 1-160 characters",
    );
  }
  return name;
}

function normalizeAdminEmail(value: string): string {
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (email.length === 0 || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new TenantBootstrapError(
      "INVALID_ADMIN_EMAIL",
      "adminEmail is invalid",
    );
  }
  return email;
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class TenantBootstrapService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async bootstrap(
    input: BootstrapTenantAdminInput,
  ): Promise<BootstrapTenantAdminResult> {
    const tenantCode = normalizeTenantCode(input.tenantCode);
    const tenantName = normalizeTenantName(input.tenantName);
    const adminEmail = normalizeAdminEmail(input.adminEmail);
    const tenantId = stableUuid(`admission:tenant:${tenantCode}`);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`admission:tenant-bootstrap:${tenantCode}`}, 0)
        )::text AS lock_result
      `;

      const admin = await transaction.platformUser.findUnique({
        where: { emailNormalized: adminEmail },
      });
      if (admin === null) {
        throw new TenantBootstrapError(
          "ADMIN_ACCOUNT_NOT_FOUND",
          "The administrator must register before tenant bootstrap",
        );
      }
      if (admin.status !== "ACTIVE") {
        throw new TenantBootstrapError(
          "ADMIN_ACCOUNT_NOT_ACTIVE",
          "The administrator account must be active",
        );
      }
      if (admin.emailVerifiedAt === null) {
        throw new TenantBootstrapError(
          "ADMIN_EMAIL_NOT_VERIFIED",
          "The administrator email must be verified",
        );
      }

      let tenantCreated = false;
      const existingTenant = await transaction.tenant.findUnique({
        where: { id: tenantId },
      });
      if (existingTenant === null) {
        await transaction.tenant.create({
          data: { id: tenantId, name: tenantName, status: "ACTIVE" },
        });
        tenantCreated = true;
      } else if (
        existingTenant.name !== tenantName ||
        existingTenant.status !== "ACTIVE"
      ) {
        throw new TenantBootstrapError(
          "BOOTSTRAP_STATE_CONFLICT",
          "The deterministic tenant already exists with incompatible state",
        );
      }

      await transaction.$queryRaw`
        SELECT
          set_config('admission.tenant_id', ${tenantId}, true),
          set_config('admission.actor_id', ${admin.id}, true)
      `;

      const now = this.clock();
      let membershipCreated = false;
      let membership = await transaction.membership.findFirst({
        where: { tenantId, userId: admin.id },
      });
      if (membership === null) {
        membership = await transaction.membership.create({
          data: {
            id: stableUuid(`admission:membership:${tenantCode}:${admin.id}`),
            startsAt: now,
            status: "ACTIVE",
            tenantId,
            userId: admin.id,
          },
        });
        membershipCreated = true;
      } else if (membership.status !== "ACTIVE" || membership.endsAt !== null) {
        throw new TenantBootstrapError(
          "BOOTSTRAP_STATE_CONFLICT",
          "The administrator membership has incompatible state",
        );
      }

      let roleAssignmentCreated = false;
      let assignment = await transaction.roleAssignment.findFirst({
        where: {
          membershipId: membership.id,
          roleKey: BOOTSTRAP_ROLE_KEY,
          tenantId,
        },
      });
      if (assignment === null) {
        assignment = await transaction.roleAssignment.create({
          data: {
            id: stableUuid(
              `admission:role:${tenantCode}:${admin.id}:${BOOTSTRAP_ROLE_KEY}`,
            ),
            membershipId: membership.id,
            permissions: [...INITIAL_TENANT_ADMIN_PERMISSIONS],
            roleKey: BOOTSTRAP_ROLE_KEY,
            scopes: ["*"],
            startsAt: now,
            status: "ACTIVE",
            tenantId,
          },
        });
        roleAssignmentCreated = true;
      } else if (
        assignment.status !== "ACTIVE" ||
        assignment.endsAt !== null ||
        !sameValues(assignment.permissions, INITIAL_TENANT_ADMIN_PERMISSIONS) ||
        !sameValues(assignment.scopes, ["*"])
      ) {
        throw new TenantBootstrapError(
          "BOOTSTRAP_STATE_CONFLICT",
          "The bootstrap role assignment has incompatible state",
        );
      }

      const auditEventId = stableUuid(
        `admission:audit:tenant-bootstrap:${tenantCode}:${admin.id}`,
      );
      let auditEventCreated = false;
      const existingAudit = await transaction.auditEvent.findUnique({
        where: { id: auditEventId },
      });
      if (existingAudit === null) {
        await transaction.auditEvent.create({
          data: {
            action: "TENANT_ADMIN_BOOTSTRAPPED",
            actorId: admin.id,
            correlationId: `tenant-bootstrap:${tenantCode}`,
            effectiveActorId: admin.id,
            id: auditEventId,
            metadata: asJson({
              assignmentId: assignment.id,
              membershipId: membership.id,
              permissions: [...INITIAL_TENANT_ADMIN_PERMISSIONS],
              roleKey: BOOTSTRAP_ROLE_KEY,
              scopes: ["*"],
              status: "ACTIVE",
            }),
            occurredAt: now,
            purpose: "tenant_bootstrap",
            resourceId: tenantId,
            resourceType: "Tenant",
            result: "SUCCESS",
            scope: "TENANT",
            tenantId,
          },
        });
        auditEventCreated = true;
      } else if (
        existingAudit.tenantId !== tenantId ||
        existingAudit.actorId !== admin.id ||
        existingAudit.action !== "TENANT_ADMIN_BOOTSTRAPPED"
      ) {
        throw new TenantBootstrapError(
          "BOOTSTRAP_STATE_CONFLICT",
          "The deterministic bootstrap audit event has incompatible state",
        );
      }

      return {
        adminUserId: admin.id,
        auditEventId,
        created: {
          auditEvent: auditEventCreated,
          membership: membershipCreated,
          roleAssignment: roleAssignmentCreated,
          tenant: tenantCreated,
        },
        membershipId: membership.id,
        roleAssignmentId: assignment.id,
        tenantCode,
        tenantId,
      };
    });
  }
}
