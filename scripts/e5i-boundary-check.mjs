import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const files = [
  "apps/api/src",
  "apps/worker/src",
  "packages/database/src",
  ".env.example",
  "compose.yaml",
  "package.json",
];
const banned = [
  /EDUPAY_API_URL|EDUPAY_API_KEY/i,
  /(?:https?:\/\/|fetch\s*\(|axios|http\.request|https\.request)[^\n]{0,160}edupay/i,
  /edupay[^\n]{0,160}(?:webhook|enrollment|obligation|payment)/i,
  /(?:externalEnrollmentId|enrollmentId|obligationId|paymentId|createEnrollment|createObligation|createPayment)/i,
];

async function filesUnder(path) {
  const absolute = resolve(root, path);
  const stat = await import("node:fs/promises").then(({ stat }) =>
    stat(absolute),
  );
  if (stat.isFile()) return [absolute];
  const entries = await import("node:fs/promises").then(({ readdir }) =>
    readdir(absolute, { recursive: true, withFileTypes: true }),
  );
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath ?? absolute, entry.name));
}

const candidates = (await Promise.all(files.map(filesUnder))).flat();
for (const file of candidates) {
  const source = await readFile(file, "utf8");
  if (banned.some((pattern) => pattern.test(source))) {
    throw new Error(`E5-I external integration marker found in ${file}`);
  }
}
console.log("E5I_NO_EXTERNAL_INTEGRATION=PASS");
