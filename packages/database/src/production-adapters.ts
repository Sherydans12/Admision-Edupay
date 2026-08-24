import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { createConnection } from "node:net";

import type {
  EmailAdapter,
  SendEmailInput,
  SendEmailResult,
} from "./email-adapter.js";
import type {
  IdentityEmailAdapter,
  IdentityVerificationEmailInput,
} from "./identity-email-adapter.js";
import {
  assertOpaqueObjectKey,
  type MalwareScanner,
  type MalwareScanResult,
  type ObjectStorage,
  type ObjectStorageArea,
} from "./operational-adapters.js";
import { StructuredLogger } from "./structured-logger.js";

function requireValue(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export type EmailDeliveryMode = "disabled" | "live" | "synthetic";

export interface ResendEmailAdapterOptions {
  apiKey: string;
  apiUrl?: string;
  deliveryMode: EmailDeliveryMode;
  fetchImplementation?: typeof fetch;
  from: string;
  publicWebUrl: string;
  timeoutMs?: number;
}

/** Network transport with a fail-closed synthetic-recipient gate. */
export class ResendEmailAdapter implements EmailAdapter, IdentityEmailAdapter {
  private readonly apiUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly logger = new StructuredLogger("resend-email-adapter");

  constructor(private readonly options: ResendEmailAdapterOptions) {
    requireValue("RESEND_API_KEY", options.apiKey);
    requireValue("RESEND_FROM_EMAIL", options.from);
    const publicWebUrl = new URL(options.publicWebUrl);
    if (publicWebUrl.protocol !== "https:") {
      throw new TypeError("ADMISSION_PUBLIC_WEB_URL must use HTTPS");
    }
    this.apiUrl = new URL(options.apiUrl ?? "https://api.resend.com").origin;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    if (
      options.timeoutMs !== undefined &&
      (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1)
    ) {
      throw new TypeError("Resend timeout must be a positive integer");
    }
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    return this.deliver({
      body: input.body,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      ...(input.idempotencyKey === undefined
        ? {}
        : { idempotencyKey: input.idempotencyKey }),
      ...(input.tags === undefined ? {} : { tags: input.tags }),
    });
  }

  async sendVerification(input: IdentityVerificationEmailInput) {
    const url = new URL("/register/verify", this.options.publicWebUrl);
    const result = await this.deliver({
      body: [
        "Verifica tu cuenta de Admisión usando el siguiente código:",
        input.challenge,
        "Abre la página de verificación:",
        url.toString(),
        `El enlace vence el ${input.expiresAt.toISOString()}.`,
      ].join("\n\n"),
      idempotencyKey: `identity-${createHash("sha256")
        .update(input.challenge, "utf8")
        .digest("hex")}`,
      recipientEmail: input.recipientEmail,
      subject: "Verifica tu cuenta de Admisión",
      tags: [{ name: "purpose", value: "identity_verification" }],
    });
    return {
      providerReference: result.providerReference,
      status: result.status,
    };
  }

  private async deliver(input: {
    body: string;
    idempotencyKey?: string;
    recipientEmail: string;
    subject: string;
    tags?: ReadonlyArray<{ name: string; value: string }>;
  }): Promise<SendEmailResult> {
    const recipient = input.recipientEmail.trim().toLowerCase();
    if (this.options.deliveryMode === "disabled") {
      return {
        provider: "resend",
        providerReference: `resend-disabled-${randomUUID()}`,
        sanitizedErrorCode: "EMAIL_DELIVERY_DISABLED",
        status: "FAILED",
      };
    }
    if (
      this.options.deliveryMode === "synthetic" &&
      !recipient.endsWith("@resend.dev")
    ) {
      this.logger.warn("NON_SYNTHETIC_EMAIL_REJECTED", "SECURITY_GUARD");
      return {
        provider: "resend",
        providerReference: `resend-synthetic-recipient-rejected-${randomUUID()}`,
        sanitizedErrorCode: "INVALID_SYNTHETIC_RECIPIENT",
        status: "FAILED",
      };
    }

    try {
      const response = await this.fetchImplementation(`${this.apiUrl}/emails`, {
        body: JSON.stringify({
          from: this.options.from,
          subject: input.subject,
          tags: input.tags,
          text: input.body,
          to: [recipient],
        }),
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          ...(input.idempotencyKey === undefined
            ? {}
            : { "Idempotency-Key": input.idempotencyKey }),
        },
        method: "POST",
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: unknown;
      };
      if (!response.ok || typeof payload.id !== "string") {
        return {
          provider: "resend",
          providerReference: `resend-http-${response.status}-${randomUUID()}`,
          sanitizedErrorCode: `RESEND_HTTP_${response.status}`,
          status: "FAILED",
        };
      }
      this.logger.info("EMAIL_ACCEPTED_BY_PROVIDER", "SENT", {
        providerReference: payload.id,
      });
      return {
        provider: "resend",
        providerReference: payload.id,
        status: "SENT",
      };
    } catch {
      return {
        provider: "resend",
        providerReference: `resend-network-error-${randomUUID()}`,
        sanitizedErrorCode: "RESEND_NETWORK_ERROR",
        status: "FAILED",
      };
    }
  }
}

export interface S3ObjectStorageOptions {
  accessKeyId: string;
  allowInsecureInternal?: boolean;
  insecureAllowedHost?: string;
  approvedBucket: string;
  endpoint: string;
  forcePathStyle?: boolean;
  quarantineBucket: string;
  region: string;
  secretAccessKey: string;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3ObjectStorageOptions) {
    const endpoint = new URL(options.endpoint);
    if (
      endpoint.protocol !== "https:" &&
      options.allowInsecureInternal !== true
    ) {
      throw new TypeError(
        "S3 endpoint must use HTTPS outside the internal minio service",
      );
    }
    if (
      endpoint.protocol !== "https:" &&
      endpoint.hostname !== options.insecureAllowedHost
    ) {
      throw new TypeError(
        "Insecure S3 endpoint hostname is not explicitly allowlisted",
      );
    }
    this.client = new S3Client({
      credentials: {
        accessKeyId: requireValue("S3_ACCESS_KEY_ID", options.accessKeyId),
        secretAccessKey: requireValue(
          "S3_SECRET_ACCESS_KEY",
          options.secretAccessKey,
        ),
      },
      endpoint: endpoint.toString(),
      forcePathStyle: options.forcePathStyle ?? true,
      region: requireValue("S3_REGION", options.region),
    });
  }

  async putQuarantine(input: { bytes: Uint8Array; key: string }) {
    assertOpaqueObjectKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Body: input.bytes,
        Bucket: this.options.quarantineBucket,
        Key: input.key,
      }),
    );
    return { key: input.key, provider: "s3-compatible" };
  }

  async readQuarantine(key: string) {
    return this.read(this.options.quarantineBucket, key);
  }

  async readApproved(key: string) {
    return this.read(this.options.approvedBucket, key);
  }

  async promote(input: { approvedKey: string; quarantineKey: string }) {
    assertOpaqueObjectKey(input.approvedKey);
    assertOpaqueObjectKey(input.quarantineKey);
    if (!(await this.exists("approved", input.approvedKey))) {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.options.approvedBucket,
          CopySource: encodeURIComponent(
            `${this.options.quarantineBucket}/${input.quarantineKey}`,
          ).replaceAll("%2F", "/"),
          Key: input.approvedKey,
        }),
      );
    }
    return { key: input.approvedKey, provider: "s3-compatible" };
  }

  async deleteQuarantine(key: string): Promise<void> {
    assertOpaqueObjectKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.options.quarantineBucket,
        Key: key,
      }),
    );
  }

  async exists(area: ObjectStorageArea, key: string): Promise<boolean> {
    assertOpaqueObjectKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket(area), Key: key }),
      );
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404) return false;
      throw error;
    }
  }

  private bucket(area: ObjectStorageArea): string {
    return area === "approved"
      ? this.options.approvedBucket
      : this.options.quarantineBucket;
  }

  private async read(bucket: string, key: string): Promise<Uint8Array> {
    assertOpaqueObjectKey(key);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (result.Body === undefined) throw new Error("OBJECT_NOT_FOUND");
    return result.Body.transformToByteArray();
  }
}

export interface ClamAvScannerOptions {
  host: string;
  maxBytes: number;
  port: number;
  timeoutMs: number;
}

export class ClamAvScanner implements MalwareScanner {
  constructor(private readonly options: ClamAvScannerOptions) {
    if (!Number.isInteger(options.port) || options.port < 1) {
      throw new TypeError("CLAMAV_PORT must be a positive integer");
    }
    if (!Number.isInteger(options.maxBytes) || options.maxBytes < 1) {
      throw new TypeError("ClamAV maximum bytes must be a positive integer");
    }
  }

  async scan(bytes: Uint8Array): Promise<MalwareScanResult> {
    if (bytes.byteLength > this.options.maxBytes) {
      return { provider: "clamav", status: "UNSCANNABLE" };
    }
    try {
      const response = await this.scanStream(bytes);
      if (response.includes("FOUND")) {
        return { provider: "clamav", status: "INFECTED" };
      }
      if (response.endsWith("OK")) {
        return { provider: "clamav", status: "CLEAN" };
      }
      return { provider: "clamav", status: "ERROR" };
    } catch {
      return { provider: "clamav", status: "ERROR" };
    }
  }

  private scanStream(bytes: Uint8Array): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({
        host: this.options.host,
        port: this.options.port,
      });
      const response: Buffer[] = [];
      socket.setTimeout(this.options.timeoutMs);
      socket.once("connect", () => {
        socket.write(Buffer.from("zINSTREAM\0", "ascii"));
        for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
          const chunk = bytes.subarray(offset, offset + 64 * 1024);
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.byteLength);
          socket.write(length);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
      socket.on("data", (chunk: Buffer) => response.push(chunk));
      socket.once("end", () =>
        resolve(Buffer.concat(response).toString("utf8").trim()),
      );
      socket.once("error", reject);
      socket.once("timeout", () => socket.destroy(new Error("CLAMAV_TIMEOUT")));
    });
  }
}

export function createProductionObjectStorageFromEnv(): ObjectStorage {
  return new S3ObjectStorage({
    accessKeyId: requireValue("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID),
    allowInsecureInternal: process.env.S3_ALLOW_INSECURE_INTERNAL === "true",
    approvedBucket: requireValue(
      "S3_APPROVED_BUCKET",
      process.env.S3_APPROVED_BUCKET,
    ),
    endpoint: requireValue("S3_ENDPOINT", process.env.S3_ENDPOINT),
    ...(process.env.S3_INSECURE_ALLOWED_HOST === undefined ||
    process.env.S3_INSECURE_ALLOWED_HOST.trim() === ""
      ? {}
      : { insecureAllowedHost: process.env.S3_INSECURE_ALLOWED_HOST.trim() }),
    quarantineBucket: requireValue(
      "S3_QUARANTINE_BUCKET",
      process.env.S3_QUARANTINE_BUCKET,
    ),
    region: requireValue("S3_REGION", process.env.S3_REGION),
    secretAccessKey: requireValue(
      "S3_SECRET_ACCESS_KEY",
      process.env.S3_SECRET_ACCESS_KEY,
    ),
  });
}

export function createProductionMalwareScannerFromEnv(): MalwareScanner {
  return new ClamAvScanner({
    host: requireValue("CLAMAV_HOST", process.env.CLAMAV_HOST),
    maxBytes: Number(
      process.env.DOCUMENT_UPLOAD_HARD_MAX_BYTES ?? 10 * 1024 * 1024,
    ),
    port: Number(process.env.CLAMAV_PORT ?? 3310),
    timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000),
  });
}

export function createProductionEmailAdapterFromEnv(): ResendEmailAdapter {
  const deliveryMode = requireValue(
    "EMAIL_DELIVERY_MODE",
    process.env.EMAIL_DELIVERY_MODE,
  );
  if (
    !(["disabled", "live", "synthetic"] as const).includes(
      deliveryMode as EmailDeliveryMode,
    )
  ) {
    throw new TypeError(
      "EMAIL_DELIVERY_MODE must be disabled, synthetic, or live",
    );
  }
  if (
    deliveryMode === "live" &&
    process.env.REAL_EMAIL_DELIVERY_AUTHORIZED !== "true"
  ) {
    throw new Error("Live email delivery requires explicit authorization");
  }
  return new ResendEmailAdapter({
    apiKey: requireValue("RESEND_API_KEY", process.env.RESEND_API_KEY),
    deliveryMode: deliveryMode as EmailDeliveryMode,
    from: requireValue("RESEND_FROM_EMAIL", process.env.RESEND_FROM_EMAIL),
    publicWebUrl: requireValue(
      "ADMISSION_PUBLIC_WEB_URL",
      process.env.ADMISSION_PUBLIC_WEB_URL,
    ),
    timeoutMs: Number(process.env.RESEND_TIMEOUT_MS ?? 10_000),
  });
}
