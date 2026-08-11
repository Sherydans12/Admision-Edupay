import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";

export interface TenantTransactionOptions {
  maxWait?: number;
  timeout?: number;
}

const DEFAULT_TRANSACTION_OPTIONS: TenantTransactionOptions = {
  maxWait: 10_000,
  timeout: 15_000,
};

export async function withTenantCandidateTransaction<T>(
  prisma: PrismaClient,
  actorId: string,
  candidateTenantId: string,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: TenantTransactionOptions = DEFAULT_TRANSACTION_OPTIONS,
): Promise<T> {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw<
        Array<{ actor_id: string; candidate_tenant_id: string }>
      >`
        SELECT
          set_config('admission.actor_id', ${actorId}, true) AS actor_id,
          set_config('admission.candidate_tenant_id', ${candidateTenantId}, true) AS candidate_tenant_id
      `;

      return operation(transaction);
    },
    options,
  );
}

export async function withTenantTransaction<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: TenantTransactionOptions = DEFAULT_TRANSACTION_OPTIONS,
): Promise<T> {
  const context = getRequiredTenantContext();

  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw<Array<{ set_config: string }>>`
        SELECT set_config('admission.tenant_id', ${context.tenantId}, true)
      `;

      return operation(transaction);
    },
    options,
  );
}

export async function withPlatformAuditTransaction<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: TenantTransactionOptions = DEFAULT_TRANSACTION_OPTIONS,
): Promise<T> {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw<Array<{ audit_scope: string }>>`
        SELECT set_config('admission.audit_scope', 'platform_global', true) AS audit_scope
      `;

      return operation(transaction);
    },
    options,
  );
}
