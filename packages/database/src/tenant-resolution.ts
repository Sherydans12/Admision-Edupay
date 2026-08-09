import type { PrismaClient } from "./generated/prisma/client.js";
import { PERMISSIONS, type PermissionKey } from "./permission-catalog.js";
import { withTenantCandidateTransaction } from "./tenant-transaction.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";

export interface TenantResolutionInput {
  authenticatedUserId: string;
  correlationId: string;
  prisma: PrismaClient;
  purpose: string;
  requestedTenantCandidate: string;
  now?: Date;
}

export type TenantResolutionResult =
  | { decision: "ALLOW"; context: TenantExecutionContext }
  | { decision: "DENY"; reasonCode: "NO_ACTIVE_MEMBERSHIP" };

export async function resolveEffectiveTenantContext(
  input: TenantResolutionInput,
): Promise<TenantResolutionResult> {
  const now = input.now ?? new Date();

  return withTenantCandidateTransaction(
    input.prisma,
    input.authenticatedUserId,
    input.requestedTenantCandidate,
    async (transaction) => {
      const membership = await transaction.membership.findFirst({
        where: {
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          startsAt: { lte: now },
          status: "ACTIVE",
          tenantId: input.requestedTenantCandidate,
          userId: input.authenticatedUserId,
        },
      });

      if (membership === null) {
        return { decision: "DENY", reasonCode: "NO_ACTIVE_MEMBERSHIP" };
      }

      const tenant = await transaction.tenant.findUnique({
        where: { id: membership.tenantId },
      });
      if (tenant === null || tenant.status !== "ACTIVE") {
        return { decision: "DENY", reasonCode: "NO_ACTIVE_MEMBERSHIP" };
      }

      await transaction.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT set_config('admission.tenant_id', ${membership.tenantId}, true) AS tenant_id
      `;
      const assignments = await transaction.roleAssignment.findMany({
        where: {
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          membershipId: membership.id,
          startsAt: { lte: now },
          status: "ACTIVE",
          tenantId: membership.tenantId,
        },
      });
      const capabilities = [
        ...new Set(assignments.flatMap((assignment) => assignment.permissions)),
      ] as PermissionKey[];
      const scopes = [
        ...new Set(assignments.flatMap((assignment) => assignment.scopes)),
      ];

      return {
        context: {
          actorId: input.authenticatedUserId,
          capabilities,
          contextOrigin: "membership",
          correlationId: input.correlationId,
          effectiveActorId: input.authenticatedUserId,
          membershipId: membership.id,
          purpose: input.purpose,
          scopes,
          source: "authenticated_request",
          tenantId: membership.tenantId,
        },
        decision: "ALLOW",
      };
    },
  );
}

export const SYNTHETIC_SECRETARY_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.APPLICATION_READ,
];
