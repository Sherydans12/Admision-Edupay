import { afterEach, describe, expect, it } from "vitest";

import { isDocumentsFeatureEnabled } from "./feature-flags.js";

describe("production feature flags", () => {
  const original = process.env.ADMISSION_DOCUMENTS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMISSION_DOCUMENTS_ENABLED;
    else process.env.ADMISSION_DOCUMENTS_ENABLED = original;
  });

  it("keeps document flows enabled for development and tests", () => {
    delete process.env.ADMISSION_DOCUMENTS_ENABLED;
    expect(isDocumentsFeatureEnabled("development")).toBe(true);
    expect(isDocumentsFeatureEnabled("test")).toBe(true);
  });

  it("fails closed in production unless explicitly enabled", () => {
    delete process.env.ADMISSION_DOCUMENTS_ENABLED;
    expect(isDocumentsFeatureEnabled("production")).toBe(false);

    process.env.ADMISSION_DOCUMENTS_ENABLED = "true";
    expect(isDocumentsFeatureEnabled("production")).toBe(true);
  });
});
