import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";

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
