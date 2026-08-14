const MAX_AUDIT_METADATA_BYTES = 8_192;
const MAX_AUDIT_METADATA_DEPTH = 3;
const MAX_AUDIT_ARRAY_ITEMS = 50;
const MAX_AUDIT_STRING_LENGTH = 500;

const AUDIT_METADATA_ALLOWED_KEYS = new Set([
  "assignmentId",
  "action",
  "applicationStatus",
  "campusId",
  "categories",
  "columns",
  "count",
  "courseLevelId",
  "dateFrom",
  "dateTo",
  "expectedUpdatedAt",
  "filters",
  "handoffId",
  "membershipId",
  "newStatus",
  "offeringId",
  "offerAcceptanceId",
  "permissions",
  "previousSessionId",
  "previousStatus",
  "processId",
  "reportKey",
  "resourceId",
  "resourceType",
  "resourceScopes",
  "roleKey",
  "rowCount",
  "scopes",
  "sessionId",
  "status",
]);

const FORBIDDEN_AUDIT_KEY_PARTS = [
  "authorization",
  "body",
  "cookie",
  "csrf",
  "document",
  "file",
  "health",
  "nee",
  "password",
  "pie",
  "secret",
  "sql",
  "stack",
  "token",
];

function keyIsAllowed(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    AUDIT_METADATA_ALLOWED_KEYS.has(key) &&
    !FORBIDDEN_AUDIT_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_AUDIT_METADATA_DEPTH) return undefined;
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (typeof value === "string") {
    return value.slice(0, MAX_AUDIT_STRING_LENGTH);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_AUDIT_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (!keyIsAllowed(key)) continue;
      const sanitized = sanitizeValue(item, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return undefined;
}

export function sanitizeAuditMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (metadata === undefined) return undefined;
  const sanitized = sanitizeValue(metadata, 0) as Record<string, unknown>;
  if (Object.keys(sanitized).length === 0) return undefined;
  if (
    Buffer.byteLength(JSON.stringify(sanitized), "utf8") >
    MAX_AUDIT_METADATA_BYTES
  ) {
    throw new TypeError("Audit metadata exceeds the technical safety limit");
  }
  return Object.freeze(sanitized);
}
