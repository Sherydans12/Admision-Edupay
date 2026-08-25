import { afterEach, describe, expect, it } from "vitest";

import { DocumentsFeatureGuard } from "./document-feature.guard.js";

describe("DocumentsFeatureGuard", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ADMISSION_DOCUMENTS_ENABLED;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined)
      delete process.env.ADMISSION_DOCUMENTS_ENABLED;
    else process.env.ADMISSION_DOCUMENTS_ENABLED = originalFlag;
  });

  it("rejects document routes when production preproduction mode disables them", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMISSION_DOCUMENTS_ENABLED = "false";
    expect(() =>
      new DocumentsFeatureGuard().canActivate({} as never),
    ).toThrow();
  });

  it("allows document routes outside the disabled production mode", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMISSION_DOCUMENTS_ENABLED = "true";
    expect(new DocumentsFeatureGuard().canActivate({} as never)).toBe(true);
  });
});
