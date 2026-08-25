/**
 * Production defaults are fail-closed for optional capabilities. Development and
 * integration environments keep the complete local feature set unless a test
 * explicitly overrides it.
 */
export function isDocumentsFeatureEnabled(
  environment = process.env.NODE_ENV ?? "development",
): boolean {
  return (
    environment !== "production" ||
    process.env.ADMISSION_DOCUMENTS_ENABLED === "true"
  );
}
