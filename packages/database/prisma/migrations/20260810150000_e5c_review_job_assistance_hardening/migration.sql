-- E5-C forward-only hardening: a review or replacement may only reference a
-- version belonging to the same tenant-owned document submission.
CREATE UNIQUE INDEX "document_versions_submission_id_key"
  ON "document_versions"("tenant_id", "document_submission_id", "id");

ALTER TABLE "document_reviews"
  DROP CONSTRAINT "document_reviews_version_fkey";
ALTER TABLE "document_reviews"
  ADD CONSTRAINT "document_reviews_version_fkey"
  FOREIGN KEY ("tenant_id", "document_submission_id", "document_version_id")
  REFERENCES "document_versions"("tenant_id", "document_submission_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_versions"
  DROP CONSTRAINT "document_versions_replaces_fkey";
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_replaces_not_self_check"
  CHECK ("replaces_version_id" IS NULL OR "replaces_version_id" <> "id");
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_replaces_fkey"
  FOREIGN KEY ("tenant_id", "document_submission_id", "replaces_version_id")
  REFERENCES "document_versions"("tenant_id", "document_submission_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
