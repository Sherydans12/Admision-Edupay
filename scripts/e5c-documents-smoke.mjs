import { spawn } from "node:child_process";

const args = [
  "exec",
  "vitest",
  "run",
  "packages/database/src/documents.integration.spec.ts",
  "-t",
  "E5C-SMOKE-01",
];

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn("pnpm", args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) process.exit(exitCode);
console.log("E5C_DOCUMENT_PIPELINE_SMOKE=PASS");
