import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter(
    (file) =>
      !file.startsWith(".env") ||
      file === ".env.example" ||
      file.endsWith(".example"),
  );

const patterns = [
  {
    name: "private key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "generic secret assignment",
    regex:
      /\b(?:SECRET|TOKEN|PASSWORD|API_KEY)\s*[:=]\s*["'](?!CHANGE_ME|REPLACE_ME|SET_IN_|local_only|synthetic|placeholder)[^"']{12,}/i,
  },
  { name: "bearer token", regex: /\bBearer\s+[A-Za-z0-9._~-]{24,}/i },
];

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) findings.push(`${file}: ${pattern.name}`);
  }
}

if (findings.length > 0) {
  console.error("High-confidence secret patterns found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `Secret scan passed (${files.length} tracked and untracked files inspected).`,
  );
}
