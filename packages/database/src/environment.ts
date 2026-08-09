import { config as loadEnvironment } from "dotenv";
import { resolve } from "node:path";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

export function getRequiredEnvironment(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Required environment variable is missing: ${name}`);
  }

  return value;
}
