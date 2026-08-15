import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import type { AuditSink } from "./audit.js";
import { getSessionConfig, type SessionConfig } from "./session-config.js";
import type { SecurityEventSink } from "./security-events.js";

export interface IssuedSession {
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  sessionId: string;
  token: string;
}

export interface ResolvedSession {
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  sessionId: string;
  userId: string;
}

export interface SessionServiceOptions {
  auditSink: AuditSink;
  correlationId?: string;
  securityEvents: SecurityEventSink;
  sessionConfig?: SessionConfig;
}

interface LockedSessionRow {
  absolute_expires_at: Date;
  idle_expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
  session_id: string;
  token_hash: string;
  user_id: string;
  user_status: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION" | "SUSPENDED";
}

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

function hashTokenHex(token: string): string {
  return hashToken(token).toString("hex");
}

function isDigestEqual(storedHash: string, digest: Buffer): boolean {
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === digest.length && timingSafeEqual(stored, digest);
}

function rowIsValid(row: LockedSessionRow, now: Date): boolean {
  return (
    row.revoked_at === null &&
    row.idle_expires_at > now &&
    row.absolute_expires_at > now &&
    row.user_status === "ACTIVE"
  );
}

export class SessionService {
  private readonly correlationId: string;
  private readonly sessionConfig: SessionConfig;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: SessionServiceOptions,
  ) {
    this.correlationId =
      options.correlationId ?? "synthetic-session-correlation";
    this.sessionConfig = options.sessionConfig ?? getSessionConfig();
  }

  private async recordInvalidSession(now: Date): Promise<void> {
    await this.options.securityEvents.record({
      code: "INVALID_SESSION",
      correlationId: this.correlationId,
      occurredAt: now,
      result: "DENY",
    });
  }

  async issueSession(userId: string, now = new Date()): Promise<IssuedSession> {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
    });
    if (user === null || user.status !== "ACTIVE") {
      throw new Error("Cannot issue a session for an inactive user");
    }

    const token = randomBytes(32).toString("base64url");
    const idleExpiresAt = new Date(
      now.getTime() + this.sessionConfig.idleTtlSeconds * 1000,
    );
    const absoluteExpiresAt = new Date(
      now.getTime() + this.sessionConfig.absoluteTtlSeconds * 1000,
    );
    const session = await this.prisma.platformSession.create({
      data: {
        absoluteExpiresAt,
        idleExpiresAt,
        issuedAt: now,
        lastSeenAt: now,
        tokenHash: hashTokenHex(token),
        userId,
      },
    });

    await this.options.auditSink.record({
      action: "SESSION_ISSUED",
      actorId: userId,
      correlationId: this.correlationId,
      effectiveActorId: userId,
      metadata: { sessionId: session.id },
      occurredAt: now,
      purpose: "identity.session",
      resourceId: session.id,
      resourceType: "PlatformSession",
      result: "SUCCESS",
    });

    return { absoluteExpiresAt, idleExpiresAt, sessionId: session.id, token };
  }

  private async lockSession(
    transaction: Prisma.TransactionClient,
    tokenHash: string,
  ): Promise<LockedSessionRow | undefined> {
    const [row] = await transaction.$queryRaw<LockedSessionRow[]>`
      SELECT
        s.id AS session_id,
        s.user_id,
        s.token_hash,
        s.last_seen_at,
        s.idle_expires_at,
        s.absolute_expires_at,
        s.revoked_at,
        u.status AS user_status
      FROM platform_sessions s
      JOIN platform_users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
      FOR UPDATE OF s
    `;
    return row;
  }

  async resolveSession(
    token: string,
    now = new Date(),
  ): Promise<ResolvedSession | undefined> {
    if (token.trim() === "") {
      await this.recordInvalidSession(now);
      return undefined;
    }

    const digest = hashToken(token);
    const result = await this.prisma.$transaction(async (transaction) => {
      const row = await this.lockSession(transaction, digest.toString("hex"));
      if (
        row === undefined ||
        !isDigestEqual(row.token_hash, digest) ||
        !rowIsValid(row, now)
      ) {
        return undefined;
      }

      const nextIdleExpiry = new Date(
        now.getTime() + this.sessionConfig.idleTtlSeconds * 1000,
      );
      const idleExpiresAt =
        nextIdleExpiry < row.absolute_expires_at
          ? nextIdleExpiry
          : row.absolute_expires_at;
      await transaction.platformSession.update({
        data: { idleExpiresAt, lastSeenAt: now },
        where: { id: row.session_id },
      });
      return {
        absoluteExpiresAt: row.absolute_expires_at,
        idleExpiresAt,
        sessionId: row.session_id,
        userId: row.user_id,
      };
    });

    if (result === undefined) {
      await this.recordInvalidSession(now);
    }
    return result;
  }

  async rotateSession(
    token: string,
    now = new Date(),
  ): Promise<IssuedSession | undefined> {
    if (token.trim() === "") {
      await this.recordInvalidSession(now);
      return undefined;
    }
    const digest = hashToken(token);
    const next = await this.prisma.$transaction(async (transaction) => {
      const row = await this.lockSession(transaction, digest.toString("hex"));
      if (
        row === undefined ||
        !isDigestEqual(row.token_hash, digest) ||
        !rowIsValid(row, now)
      ) {
        return undefined;
      }

      await transaction.platformSession.update({
        data: { revokedAt: now },
        where: { id: row.session_id },
      });
      const tokenValue = randomBytes(32).toString("base64url");
      const idleExpiresAt = new Date(
        now.getTime() + this.sessionConfig.idleTtlSeconds * 1000,
      );
      const absoluteExpiresAt = new Date(
        now.getTime() + this.sessionConfig.absoluteTtlSeconds * 1000,
      );
      const session = await transaction.platformSession.create({
        data: {
          absoluteExpiresAt,
          idleExpiresAt,
          issuedAt: now,
          lastSeenAt: now,
          rotatedFromSessionId: row.session_id,
          tokenHash: hashTokenHex(tokenValue),
          userId: row.user_id,
        },
      });
      return {
        absoluteExpiresAt,
        idleExpiresAt,
        sessionId: session.id,
        token: tokenValue,
        userId: row.user_id,
        previousSessionId: row.session_id,
      };
    });

    if (next === undefined) {
      await this.recordInvalidSession(now);
      return undefined;
    }
    await this.options.auditSink.record({
      action: "SESSION_ROTATED",
      actorId: next.userId,
      correlationId: this.correlationId,
      effectiveActorId: next.userId,
      metadata: {
        previousSessionId: next.previousSessionId,
        sessionId: next.sessionId,
      },
      occurredAt: now,
      purpose: "identity.session",
      resourceId: next.sessionId,
      resourceType: "PlatformSession",
      result: "SUCCESS",
    });
    return {
      absoluteExpiresAt: next.absoluteExpiresAt,
      idleExpiresAt: next.idleExpiresAt,
      sessionId: next.sessionId,
      token: next.token,
    };
  }

  async revokeSession(token: string, now = new Date()): Promise<void> {
    const tokenHash = hashTokenHex(token);
    const changed = await this.prisma.$transaction(async (transaction) => {
      const row = await this.lockSession(transaction, tokenHash);
      if (row === undefined || row.revoked_at !== null) return undefined;
      await transaction.platformSession.update({
        data: { revokedAt: now },
        where: { id: row.session_id },
      });
      return row;
    });
    if (changed === undefined) return;

    await this.options.auditSink.record({
      action: "SESSION_REVOKED",
      actorId: changed.user_id,
      correlationId: this.correlationId,
      effectiveActorId: changed.user_id,
      metadata: { sessionId: changed.session_id },
      occurredAt: now,
      purpose: "identity.session",
      resourceId: changed.session_id,
      resourceType: "PlatformSession",
      result: "SUCCESS",
    });
  }

  async revokeAllUserSessions(
    userId: string,
    now = new Date(),
  ): Promise<number> {
    const result = await this.prisma.platformSession.updateMany({
      data: { revokedAt: now },
      where: { revokedAt: null, userId },
    });
    await this.options.auditSink.record({
      action: "ALL_USER_SESSIONS_REVOKED",
      actorId: userId,
      correlationId: this.correlationId,
      effectiveActorId: userId,
      metadata: { count: result.count },
      occurredAt: now,
      purpose: "identity.session",
      resourceType: "PlatformUser",
      result: "SUCCESS",
    });
    return result.count;
  }
}
