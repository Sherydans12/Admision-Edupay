import {
  createAppPrismaClient,
  SyntheticAuthorityReviewerProvisioner,
  SYNTHETIC_AUTHORITY_TENANT_CODE,
} from "@admission/database";

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Required environment variable is missing: ${name}`);
  }
  return value.trim();
}

if (required("PREPROD_SYNTHETIC") !== "true") {
  throw new Error("PREPROD_SYNTHETIC must be exactly true");
}

const tenantCode = required("SYNTHETIC_REVIEWER_TENANT_CODE");
if (tenantCode !== SYNTHETIC_AUTHORITY_TENANT_CODE) {
  throw new Error("SYNTHETIC_REVIEWER_TENANT_CODE must be synthetic-school");
}

const prisma = createAppPrismaClient();
try {
  const result = await new SyntheticAuthorityReviewerProvisioner(
    prisma,
  ).provision({
    confirmation: required("SYNTHETIC_REVIEWER_CONFIRM"),
    reviewerEmail: required("SYNTHETIC_REVIEWER_EMAIL"),
    stage: "preproduction-synthetic",
    tenantCode,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await prisma.$disconnect();
}
