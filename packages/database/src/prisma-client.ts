import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";
import { getRequiredEnvironment } from "./environment.js";

export function createAppPrismaClient(
  databaseUrl = getRequiredEnvironment("DATABASE_APP_URL"),
): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    max: 25,
  });

  return new PrismaClient({ adapter });
}
