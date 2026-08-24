import { StructuredLogger } from "./structured-logger.js";

export interface SendEmailInput {
  body: string;
  recipientEmail: string;
  subject: string;
}

export interface SendEmailResult {
  providerReference: string;
  status: "SENT" | "FAILED";
  sanitizedErrorCode?: string;
}

export interface EmailAdapter {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export class DevelopmentEmailAdapter implements EmailAdapter {
  private readonly logger = new StructuredLogger("development-email-adapter");
  private forceFailure = false;

  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DevelopmentEmailAdapter MUST NOT be instantiated in production environments",
      );
    }
  }

  setForceFailure(force: boolean): void {
    this.forceFailure = force;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (
      !input.recipientEmail ||
      (!input.recipientEmail.endsWith(".invalid") &&
        !input.recipientEmail.includes("@example.") &&
        !input.recipientEmail.includes("@synthetic.") &&
        !input.recipientEmail.includes("@test."))
    ) {
      this.logger.warn("NON_SYNTHETIC_EMAIL_REJECTED", "SECURITY_GUARD", {
        recipientEmail: input.recipientEmail,
      });
      return {
        providerReference: `dev-ref-failed-${Date.now()}`,
        sanitizedErrorCode: "INVALID_SYNTHETIC_RECIPIENT",
        status: "FAILED",
      };
    }

    if (this.forceFailure) {
      return {
        providerReference: `dev-ref-failed-${Date.now()}`,
        sanitizedErrorCode: "SIMULATED_EMAIL_FAILURE",
        status: "FAILED",
      };
    }

    const providerReference = `dev-email-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    this.logger.info("SYNTHETIC_EMAIL_ACCEPTED", "DEVELOPMENT_EMAIL_ADAPTER", {
      providerReference,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
    });

    return {
      providerReference,
      status: "SENT",
    };
  }
}
