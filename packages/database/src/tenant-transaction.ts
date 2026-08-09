import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";

export async function withTenantCandidateTransaction<T>(
  prisma: PrismaClient,
  actorId: string,
  candidateTenantId: string,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<
      Array<{ actor_id: string; candidate_tenant_id: string }>
    >`
      SELECT
        set_config('admission.actor_id', ${actorId}, true) AS actor_id,
        set_config('admission.candidate_tenant_id', ${candidateTenantId}, true) AS candidate_tenant_id
    `;

    return operation(transaction);
  });
}

export async function withTenantTransaction<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const context = getRequiredTenantContext();

  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ set_config: string }>>`
      SELECT set_config('admission.tenant_id', ${context.tenantId}, true)
    `;

    return operation(transaction);
  });
}
