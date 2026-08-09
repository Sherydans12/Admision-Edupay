import type { Prisma, PrismaClient } from "./generated/prisma/client.js";

export interface TrustedSupportElevationCreateInput {
  actorUserId: string;
  categories: readonly string[];
  expiresAt: Date;
  purpose: string;
  reason: string;
  scopes: readonly string[];
  startedAt: Date;
  tenantId: string;
}

export interface TrustedSupportElevationLookupInput {
  actorUserId: string;
  categories?: readonly string[];
  elevationId: string;
  expiresAfter: Date;
  purpose?: string;
  scopes?: readonly string[];
  tenantId: string;
}

export interface TrustedSupportElevationStateInput {
  actorUserId: string;
  elevationId: string;
  state: "closedAt" | "revokedAt";
  tenantId: string;
  timestamp: Date;
}

export interface TrustedSupportElevationRepository {
  create(
    input: TrustedSupportElevationCreateInput,
  ): Promise<Prisma.SupportElevationModel>;
  findActive(
    input: TrustedSupportElevationLookupInput,
  ): Promise<Prisma.SupportElevationModel | null>;
  updateActiveState(input: TrustedSupportElevationStateInput): Promise<number>;
}

/**
 * Internal-only boundary. It exposes a narrow SupportElevation repository, never a
 * Prisma TransactionClient, and never installs admission.tenant_id.
 */
export function withTrustedPlatformSupportTransaction<T>(
  prisma: PrismaClient,
  actorId: string,
  targetTenantId: string,
  operation: (repository: TrustedSupportElevationRepository) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT
        set_config('admission.platform_operation', 'support_elevation', true),
        set_config('admission.platform_actor_id', ${actorId}, true),
        set_config('admission.platform_target_tenant_id', ${targetTenantId}, true)
    `;

    const repository: TrustedSupportElevationRepository = {
      create: (input) =>
        transaction.supportElevation.create({
          data: {
            actorUserId: input.actorUserId,
            categories: [...input.categories],
            expiresAt: input.expiresAt,
            purpose: input.purpose,
            reason: input.reason,
            scopes: [...input.scopes],
            startedAt: input.startedAt,
            tenantId: input.tenantId,
          },
        }),
      findActive: (input) =>
        transaction.supportElevation.findFirst({
          where: {
            actorUserId: input.actorUserId,
            categories: { hasEvery: [...(input.categories ?? [])] },
            closedAt: null,
            expiresAt: { gt: input.expiresAfter },
            id: input.elevationId,
            revokedAt: null,
            scopes: { hasEvery: [...(input.scopes ?? [])] },
            tenantId: input.tenantId,
            ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
          },
        }),
      updateActiveState: (input) =>
        transaction.supportElevation
          .updateMany({
            data: { [input.state]: input.timestamp },
            where: {
              actorUserId: input.actorUserId,
              closedAt: null,
              id: input.elevationId,
              revokedAt: null,
              tenantId: input.tenantId,
            },
          })
          .then((result) => result.count),
    };

    return operation(repository);
  });
}
