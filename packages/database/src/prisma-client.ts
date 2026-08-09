import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";
import { getRequiredEnvironment } from "./environment.js";

export function createAppPrismaClient(
  databaseUrl = getRequiredEnvironment("DATABASE_APP_URL"),
): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 4,
  });

  return new PrismaClient({ adapter });
}
