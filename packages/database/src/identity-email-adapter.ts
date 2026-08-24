import { createHash, randomBytes } from "node:crypto";

import { StructuredLogger } from "./structured-logger.js";

export interface IdentityVerificationEmailInput {
  challenge: string;
  expiresAt: Date;
  recipientEmail: string;
}

export interface IdentityVerificationEmailDelivery extends IdentityVerificationEmailInput {
  providerReference: string;
  subject: string;
}

export interface IdentityEmailAdapter {
  sendVerification(
    input: IdentityVerificationEmailInput,
  ): Promise<{ providerReference: string; status: "SENT" | "FAILED" }>;
}

function channelHash(email: string): string {
  return createHash("sha256").update(email, "utf8").digest("hex");
}

/**
 * Development/test transport for identity verification only.
 * It never performs network delivery and keeps synthetic messages capturable
 * by tests without writing the raw challenge to logs or durable storage.
 */
export class DevelopmentIdentityEmailAdapter implements IdentityEmailAdapter {
  readonly deliveries: IdentityVerificationEmailDelivery[] = [];
  private readonly logger = new StructuredLogger(
    "development-identity-email-adapter",
  );
  private forceFailure = false;

  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DevelopmentIdentityEmailAdapter MUST NOT be instantiated in production environments",
      );
    }
  }

  setForceFailure(force: boolean): void {
    this.forceFailure = force;
  }

  async sendVerification(
    input: IdentityVerificationEmailInput,
  ): Promise<{ providerReference: string; status: "SENT" | "FAILED" }> {
    const providerReference = `dev-identity-email-${randomBytes(8).toString("hex")}`;
    const delivery: IdentityVerificationEmailDelivery = {
      ...input,
      providerReference,
      subject: "Verifica tu cuenta de Admisión",
    };

    if (this.forceFailure) {
      return { providerReference, status: "FAILED" };
    }

    this.deliveries.push(delivery);
    this.logger.info("IDENTITY_VERIFICATION_EMAIL_CAPTURED", "SENT", {
      channelHash: channelHash(input.recipientEmail),
      expiresAt: input.expiresAt.toISOString(),
      providerReference,
    });
    return { providerReference, status: "SENT" };
  }
}
