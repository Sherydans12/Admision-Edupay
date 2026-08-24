import {
  TenantBootstrapService,
  createAppPrismaClient,
  normalizeTenantCode,
} from "../packages/database/src/index.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Required environment variable is missing: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const tenantCode = normalizeTenantCode(required("TENANT_BOOTSTRAP_CODE"));
  const confirmation = required("TENANT_BOOTSTRAP_CONFIRM");
  if (confirmation !== tenantCode) {
    throw new Error(
      "TENANT_BOOTSTRAP_CONFIRM must exactly match the normalized tenant code",
    );
  }

  const prisma = createAppPrismaClient();
  try {
    const result = await new TenantBootstrapService(prisma).bootstrap({
      adminEmail: required("TENANT_BOOTSTRAP_ADMIN_EMAIL"),
      tenantCode,
      tenantName: required("TENANT_BOOTSTRAP_NAME"),
    });
    process.stdout.write(
      `${JSON.stringify({
        auditEventId: result.auditEventId,
        created: result.created,
        membershipId: result.membershipId,
        roleAssignmentId: result.roleAssignmentId,
        tenantCode: result.tenantCode,
        tenantId: result.tenantId,
      })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
