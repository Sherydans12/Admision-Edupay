import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface StoredCsrfToken {
  expiresAt: Date;
  hash: string;
}

export interface CsrfValidationInput {
  csrfToken?: string;
  expectedOrigin: string;
  method: string;
  origin?: string;
  referer?: string;
  sessionId: string;
  now?: Date;
}

export interface CsrfService {
  issueToken(sessionId: string, ttlSeconds?: number, now?: Date): string;
  validate(input: CsrfValidationInput): boolean;
}

function hash(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function isExpectedOrigin(value: string, expectedOrigin: string): boolean {
  try {
    return new URL(value).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

function hasValidRequestOrigin(input: CsrfValidationInput): boolean {
  if (
    input.origin !== undefined &&
    !isExpectedOrigin(input.origin, input.expectedOrigin)
  ) {
    return false;
  }
  if (input.origin === undefined && input.referer === undefined) return false;
  if (
    input.referer !== undefined &&
    !isExpectedOrigin(input.referer, input.expectedOrigin)
  ) {
    return false;
  }
  return true;
}

export class InMemoryCsrfService implements CsrfService {
  private readonly tokens = new Map<string, StoredCsrfToken>();

  issueToken(sessionId: string, ttlSeconds = 1_800, now = new Date()): string {
    const token = randomBytes(32).toString("base64url");
    this.tokens.set(sessionId, {
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      hash: hash(token).toString("hex"),
    });
    return token;
  }

  validate(input: CsrfValidationInput): boolean {
    if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
    const now = input.now ?? new Date();
    if (!hasValidRequestOrigin(input)) return false;
    if (input.csrfToken === undefined) return false;

    const stored = this.tokens.get(input.sessionId);
    if (stored === undefined || stored.expiresAt <= now) return false;
    const actual = hash(input.csrfToken);
    const expected = Buffer.from(stored.hash, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}

/**
 * HMAC-bound CSRF tokens suitable for horizontally scaled API instances.
 * The token contains only an expiry and nonce; the session identifier remains
 * server-side and is included exclusively in the MAC input.
 */
export class StatelessCsrfService implements CsrfService {
  private readonly secret: Buffer;

  constructor(secret: string) {
    this.secret = Buffer.from(secret, "utf8");
    if (this.secret.byteLength < 32) {
      throw new TypeError("CSRF signing secret must contain at least 32 bytes");
    }
  }

  issueToken(sessionId: string, ttlSeconds = 1_800, now = new Date()): string {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new TypeError("CSRF token TTL must be a positive integer");
    }
    const payload = `${Math.floor(now.getTime() / 1_000) + ttlSeconds}.${randomBytes(24).toString("base64url")}`;
    const signature = this.sign(sessionId, payload);
    return `${payload}.${signature}`;
  }

  validate(input: CsrfValidationInput): boolean {
    if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
    if (!hasValidRequestOrigin(input) || input.csrfToken === undefined) {
      return false;
    }
    const parts = input.csrfToken.split(".");
    if (parts.length !== 3) return false;
    const [expiresRaw, nonce, actualSignature] = parts;
    if (
      expiresRaw === undefined ||
      nonce === undefined ||
      actualSignature === undefined ||
      !/^\d+$/.test(expiresRaw) ||
      !/^[A-Za-z0-9_-]{32}$/.test(nonce)
    ) {
      return false;
    }
    const expiresAtSeconds = Number(expiresRaw);
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
    if (
      !Number.isSafeInteger(expiresAtSeconds) ||
      expiresAtSeconds <= nowSeconds
    ) {
      return false;
    }
    const expectedSignature = this.sign(
      input.sessionId,
      `${expiresRaw}.${nonce}`,
    );
    const actual = Buffer.from(actualSignature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private sign(sessionId: string, payload: string): string {
    return createHmac("sha256", this.secret)
      .update(sessionId, "utf8")
      .update("\0", "utf8")
      .update(payload, "utf8")
      .digest("base64url");
  }
}
