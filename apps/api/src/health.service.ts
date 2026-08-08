import { Pool } from "pg";

export interface HealthStatus {
  service: "admission-api";
  status: "ok" | "unavailable";
}

export class HealthService {
  constructor(
    private readonly checkDatabase: () => Promise<boolean> = defaultDatabaseCheck,
  ) {}

  live(): HealthStatus {
    return { service: "admission-api", status: "ok" };
  }

  async ready(): Promise<HealthStatus> {
    return {
      service: "admission-api",
      status: (await this.checkDatabase()) ? "ok" : "unavailable",
    };
  }
}

async function defaultDatabaseCheck(): Promise<boolean> {
  const connectionString = process.env.DATABASE_APP_URL;
  if (connectionString === undefined || connectionString.trim() === "")
    return false;

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 2_000,
    max: 1,
  });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}
