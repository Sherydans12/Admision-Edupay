export interface SessionConfig {
  absoluteTtlSeconds: number;
  idleTtlSeconds: number;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function getSessionConfig(): SessionConfig {
  const config = {
    absoluteTtlSeconds: readPositiveInteger(
      "SESSION_ABSOLUTE_TTL_SECONDS",
      28_800,
    ),
    idleTtlSeconds: readPositiveInteger("SESSION_IDLE_TTL_SECONDS", 1_800),
  } satisfies SessionConfig;

  if (config.idleTtlSeconds > config.absoluteTtlSeconds) {
    throw new Error(
      "SESSION_IDLE_TTL_SECONDS cannot exceed SESSION_ABSOLUTE_TTL_SECONDS",
    );
  }

  return config;
}
