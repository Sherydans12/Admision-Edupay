import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "./generated/prisma/client.js";
import {
  SYNTHETIC_AUTHORITY_TENANT_CODE,
  SyntheticAuthorityReviewerProvisioner,
} from "./synthetic-authority-reviewer.js";

function service() {
  return new SyntheticAuthorityReviewerProvisioner({
    $transaction: vi.fn(),
  } as unknown as PrismaClient);
}

describe("synthetic authority reviewer guardrails", () => {
  it("rejects every stage except the explicitly synthetic preproduction stage", async () => {
    await expect(
      service().provision({
        confirmation: SYNTHETIC_AUTHORITY_TENANT_CODE,
        reviewerEmail: "reviewer@resend.dev",
        stage: "production",
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
      }),
    ).rejects.toMatchObject({
      code: "SYNTHETIC_TENANT_REQUIRED",
    });
  });

  it("rejects a non-synthetic tenant code before touching the database", async () => {
    await expect(
      service().provision({
        confirmation: "other-school",
        reviewerEmail: "reviewer@resend.dev",
        stage: "preproduction-synthetic",
        tenantCode: "other-school",
      }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_TENANT_REQUIRED" });
  });

  it("requires an exact confirmation token", async () => {
    await expect(
      service().provision({
        confirmation: "synthetic-school-typo",
        reviewerEmail: "reviewer@resend.dev",
        stage: "preproduction-synthetic",
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
      }),
    ).rejects.toMatchObject({ code: "SYNTHETIC_CONFIRMATION_REQUIRED" });
  });

  it("accepts only a synthetic Resend address", async () => {
    await expect(
      service().provision({
        confirmation: SYNTHETIC_AUTHORITY_TENANT_CODE,
        reviewerEmail: "reviewer@example.invalid",
        stage: "preproduction-synthetic",
        tenantCode: SYNTHETIC_AUTHORITY_TENANT_CODE,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REVIEWER_EMAIL" });
  });
});
