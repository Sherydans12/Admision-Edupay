import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

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

function hash(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export class InMemoryCsrfService {
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
    if (input.origin !== undefined && input.origin !== input.expectedOrigin)
      return false;
    if (input.origin === undefined && input.referer === undefined) return false;
    if (
      input.referer !== undefined &&
      !input.referer.startsWith(`${input.expectedOrigin}/`)
    )
      return false;
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
