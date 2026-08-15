import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import type { AuditSink } from "./audit.js";
import {
  DevelopmentIdentityEmailAdapter,
  type IdentityEmailAdapter,
} from "./identity-email-adapter.js";
import type { IssuedSession } from "./session-service.js";
import { SessionService } from "./session-service.js";
import type { SecurityEventSink } from "./security-events.js";
import { getCorrelationId } from "./correlation-context.js";

const DEFAULT_CHALLENGE_TTL_SECONDS = 900;
const DEFAULT_REGISTRATION_COOLDOWN_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 5;

export class AccountRegistrationValidationError extends Error {
  constructor(message = "Invalid registration request") {
    super(message);
    this.name = "AccountRegistrationValidationError";
  }
}

export class AccountVerificationError extends Error {
  constructor() {
    super("Verification failed");
    this.name = "AccountVerificationError";
  }
}

export interface AccountRegistrationInput {
  email: string;
}

export interface AccountVerificationInput {
  challenge: string;
}

export interface AccountRegistrationServiceOptions {
  challengeTtlSeconds?: number;
  clock?: () => Date;
  maxAttempts?: number;
  registrationCooldownMs?: number;
}

export interface VerifiedAccountResult {
  activated: boolean;
  session: IssuedSession;
  userId: string;
}

interface PlatformIdentityRow {
  email_verified_at: Date | null;
  id: string;
  status: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION" | "SUSPENDED";
}

interface ActiveChallengeRow {
  challenge_id: string;
  created_at: Date;
}

interface VerificationChallengeRow {
  attempts: number;
  consumed_at: Date | null;
  expires_at: Date;
  platform_user_id: string;
  status: PlatformIdentityRow["status"];
  superseded_at: Date | null;
  user_email_verified_at: Date | null;
  verifier_hash: string;
  challenge_id: string;
}

function readPositiveInteger(
  value: number | undefined,
  name: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readNonNegativeInteger(
  value: number | undefined,
  name: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function configuredSeconds(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function normalizeEmail(email: string): string {
  const normalized = email.normalize("NFKC").trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
  ) {
    throw new AccountRegistrationValidationError();
  }
  return normalized;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function digestMatches(storedHex: string, candidate: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const candidateDigest = Buffer.from(candidate, "hex");
  return (
    stored.length === candidateDigest.length &&
    timingSafeEqual(stored, candidateDigest)
  );
}

function correlationId(): string {
  return getCorrelationId() ?? "unbound-request";
}

function auditBase(userId: string, resourceId: string, resourceType: string) {
  return {
    actorId: userId,
    correlationId: correlationId(),
    effectiveActorId: userId,
    resourceId,
    resourceType,
  } as const;
}

function securityCodeFor(reason: VerificationFailureReason) {
  if (reason === "REPLAYED") return "ACCOUNT_VERIFICATION_REPLAY" as const;
  if (reason === "TOO_MANY_ATTEMPTS") {
    return "ACCOUNT_VERIFICATION_EXCESSIVE_ATTEMPTS" as const;
  }
  return "ACCOUNT_VERIFICATION_INVALID_ATTEMPT" as const;
}

type VerificationFailureReason =
  "EXPIRED" | "INVALID" | "REPLAYED" | "TOO_MANY_ATTEMPTS";

export class AccountRegistrationService {
  private readonly challengeTtlSeconds: number;
  private readonly clock: () => Date;
  private readonly maxAttempts: number;
  private readonly registrationCooldownMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessions: SessionService,
    private readonly emailAdapter: IdentityEmailAdapter = new DevelopmentIdentityEmailAdapter(),
    private readonly auditSink: AuditSink,
    private readonly securityEvents: SecurityEventSink,
    options: AccountRegistrationServiceOptions = {},
  ) {
    this.challengeTtlSeconds = readPositiveInteger(
      options.challengeTtlSeconds ??
        configuredSeconds(
          "IDENTITY_VERIFICATION_TTL_SECONDS",
          DEFAULT_CHALLENGE_TTL_SECONDS,
        ),
      "IDENTITY_VERIFICATION_TTL_SECONDS",
      DEFAULT_CHALLENGE_TTL_SECONDS,
    );
    this.clock = options.clock ?? (() => new Date());
    this.maxAttempts = readPositiveInteger(
      options.maxAttempts ??
        configuredSeconds(
          "IDENTITY_VERIFICATION_MAX_ATTEMPTS",
          DEFAULT_MAX_ATTEMPTS,
        ),
      "IDENTITY_VERIFICATION_MAX_ATTEMPTS",
      DEFAULT_MAX_ATTEMPTS,
    );
    this.registrationCooldownMs = readNonNegativeInteger(
      options.registrationCooldownMs ??
        configuredSeconds(
          "IDENTITY_REGISTRATION_COOLDOWN_SECONDS",
          DEFAULT_REGISTRATION_COOLDOWN_MS / 1000,
        ) * 1000,
      "IDENTITY_REGISTRATION_COOLDOWN_MS",
      DEFAULT_REGISTRATION_COOLDOWN_MS,
    );
  }

  async register(input: AccountRegistrationInput): Promise<void> {
    const normalizedEmail = normalizeEmail(input.email);
    const channelHash = hashValue(normalizedEmail);
    const now = this.clock();
    const token = randomBytes(32).toString("base64url");
    const verifierHash = hashValue(token);
    const expiresAt = new Date(
      now.getTime() + this.challengeTtlSeconds * 1_000,
    );

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO platform_users (id, email_normalized, status)
        VALUES (${randomUUID()}, ${normalizedEmail}, 'PENDING_VERIFICATION'::"PlatformUserStatus")
        ON CONFLICT (email_normalized) DO NOTHING
      `;
      const [user] = await transaction.$queryRaw<PlatformIdentityRow[]>`
        SELECT id, status, email_verified_at
        FROM platform_users
        WHERE email_normalized = ${normalizedEmail}
        FOR UPDATE
      `;
      if (user === undefined)
        throw new Error("Platform identity was not created");

      if (user.status === "DISABLED" || user.status === "SUSPENDED") {
        return { challengeId: undefined, shouldSend: false, user };
      }

      const [activeChallenge] = await transaction.$queryRaw<
        ActiveChallengeRow[]
      >`
        SELECT id AS challenge_id, created_at
        FROM account_verification_challenges
        WHERE platform_user_id = ${user.id}
          AND consumed_at IS NULL
          AND superseded_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `;
      if (
        activeChallenge !== undefined &&
        now.getTime() - activeChallenge.created_at.getTime() <
          this.registrationCooldownMs
      ) {
        return {
          challengeId: activeChallenge.challenge_id,
          shouldSend: false,
          user,
        };
      }

      if (activeChallenge !== undefined) {
        await transaction.$executeRaw`
          UPDATE account_verification_challenges
          SET superseded_at = ${now}
          WHERE id = ${activeChallenge.challenge_id}
            AND consumed_at IS NULL
            AND superseded_at IS NULL
        `;
      }

      const challenge = await transaction.accountVerificationChallenge.create({
        data: {
          createdAt: now,
          expiresAt,
          normalizedChannelHash: channelHash,
          platformUserId: user.id,
          purpose: "ACCOUNT_REGISTRATION",
          verifierHash,
        },
      });
      return { challengeId: challenge.id, shouldSend: true, user };
    });

    if (result.challengeId === undefined) {
      await this.recordRegistrationAudit(
        result.user.id,
        result.user.id,
        "DENY",
        "ACCOUNT_REGISTRATION_REQUESTED",
        "ACCOUNT_NOT_ELIGIBLE",
        result.user.status,
      );
      return;
    }
    if (!result.shouldSend) {
      await this.recordRegistrationAudit(
        result.user.id,
        result.challengeId,
        "SUCCESS",
        "ACCOUNT_REGISTRATION_REQUESTED",
        "COOLDOWN_OR_RETRY_SUPPRESSED",
        result.user.status,
      );
      return;
    }

    const delivery = await this.emailAdapter.sendVerification({
      challenge: token,
      expiresAt,
      recipientEmail: normalizedEmail,
    });
    await this.recordRegistrationAudit(
      result.user.id,
      result.challengeId,
      delivery.status === "SENT" ? "SUCCESS" : "FAILURE",
      "ACCOUNT_REGISTRATION_REQUESTED",
      delivery.status === "SENT" ? undefined : "EMAIL_DELIVERY_FAILED",
      result.user.status,
    );
  }

  async verify(
    input: AccountVerificationInput,
  ): Promise<VerifiedAccountResult> {
    const challenge = input.challenge.trim();
    if (challenge.length === 0 || challenge.length > 256) {
      throw new AccountVerificationError();
    }
    const verifierHash = hashValue(challenge);
    const now = this.clock();
    const outcome = await this.prisma.$transaction(async (transaction) => {
      const [row] = await transaction.$queryRaw<VerificationChallengeRow[]>`
        SELECT
          c.id AS challenge_id,
          c.platform_user_id,
          c.verifier_hash,
          c.expires_at,
          c.consumed_at,
          c.superseded_at,
          c.attempts,
          u.status,
          u.email_verified_at AS user_email_verified_at
        FROM account_verification_challenges c
        JOIN platform_users u ON u.id = c.platform_user_id
        WHERE c.verifier_hash = ${verifierHash}
        FOR UPDATE OF c, u
      `;
      if (row === undefined) {
        return { reason: "INVALID" as const };
      }
      if (!digestMatches(row.verifier_hash, verifierHash)) {
        return { reason: "INVALID" as const, row };
      }
      if (row.consumed_at !== null || row.superseded_at !== null) {
        return { reason: "REPLAYED" as const, row };
      }
      if (row.expires_at <= now) {
        return { reason: "EXPIRED" as const, row };
      }
      if (row.attempts >= this.maxAttempts) {
        return { reason: "TOO_MANY_ATTEMPTS" as const, row };
      }
      if (row.status !== "ACTIVE" && row.status !== "PENDING_VERIFICATION") {
        return { reason: "INVALID" as const, row };
      }

      await transaction.accountVerificationChallenge.update({
        data: {
          attempts: { increment: 1 },
          consumedAt: now,
          lastAttemptAt: now,
        },
        where: { id: row.challenge_id },
      });
      const activated = row.status === "PENDING_VERIFICATION";
      await transaction.platformUser.update({
        data: {
          ...(activated ? { status: "ACTIVE" as const } : {}),
          emailVerifiedAt: row.user_email_verified_at ?? now,
        },
        where: { id: row.platform_user_id },
      });
      return {
        activated,
        challengeId: row.challenge_id,
        userId: row.platform_user_id,
      };
    });

    if (!("activated" in outcome)) {
      const reason = outcome.reason as VerificationFailureReason;
      const row = "row" in outcome ? outcome.row : undefined;
      if (row !== undefined) {
        await this.recordVerificationAudit(row, reason);
      }
      await this.securityEvents.record({
        code: securityCodeFor(reason),
        correlationId: correlationId(),
        occurredAt: now,
        result: "DENY",
        ...(row === undefined ? {} : { subjectId: row.platform_user_id }),
      });
      throw new AccountVerificationError();
    }

    const verifiedOutcome = outcome as {
      activated: boolean;
      challengeId: string;
      userId: string;
    };
    await this.auditSink.record({
      ...auditBase(
        verifiedOutcome.userId,
        verifiedOutcome.challengeId,
        "AccountVerificationChallenge",
      ),
      action: "ACCOUNT_VERIFICATION_SUCCEEDED",
      occurredAt: now,
      purpose: "identity.account_registration",
      result: "SUCCESS",
    });
    if (verifiedOutcome.activated) {
      await this.auditSink.record({
        ...auditBase(
          verifiedOutcome.userId,
          verifiedOutcome.userId,
          "PlatformUser",
        ),
        action: "ACCOUNT_ACTIVATED",
        occurredAt: now,
        purpose: "identity.account_registration",
        result: "SUCCESS",
      });
    }
    return {
      activated: verifiedOutcome.activated,
      session: await this.sessions.issueSession(verifiedOutcome.userId, now),
      userId: verifiedOutcome.userId,
    };
  }

  private async recordRegistrationAudit(
    userId: string,
    resourceId: string,
    result: "DENY" | "FAILURE" | "SUCCESS",
    action: "ACCOUNT_REGISTRATION_REQUESTED",
    reasonCode: string | undefined,
    status: PlatformIdentityRow["status"],
  ): Promise<void> {
    await this.auditSink.record({
      ...auditBase(userId, resourceId, "AccountVerificationChallenge"),
      action,
      ...(reasonCode === undefined ? {} : { reasonCode }),
      metadata: { status },
      occurredAt: this.clock(),
      purpose: "identity.account_registration",
      result,
    });
  }

  private async recordVerificationAudit(
    row: VerificationChallengeRow,
    reason: VerificationFailureReason,
  ): Promise<void> {
    const action =
      reason === "EXPIRED"
        ? "ACCOUNT_VERIFICATION_EXPIRED"
        : reason === "REPLAYED"
          ? "ACCOUNT_VERIFICATION_REPLAYED"
          : "ACCOUNT_VERIFICATION_REJECTED";
    await this.auditSink.record({
      ...auditBase(
        row.platform_user_id,
        row.challenge_id,
        "AccountVerificationChallenge",
      ),
      action,
      occurredAt: this.clock(),
      purpose: "identity.account_registration",
      reasonCode: reason,
      result: "DENY",
    });
  }
}

export function hashNormalizedChannel(email: string): string {
  return hashValue(normalizeEmail(email));
}

export function createTestAccountRegistrationService(
  prisma: PrismaClient,
  sessions: SessionService,
  auditSink: AuditSink,
  securityEvents: SecurityEventSink,
  emailAdapter: IdentityEmailAdapter,
  options: AccountRegistrationServiceOptions = {},
): AccountRegistrationService {
  return new AccountRegistrationService(
    prisma,
    sessions,
    emailAdapter,
    auditSink,
    securityEvents,
    options,
  );
}

export type AccountRegistrationPrismaInput =
  Prisma.AccountVerificationChallengeCreateInput;
