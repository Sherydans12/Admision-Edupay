import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { PrismaClient } from "./generated/prisma/client.js";
import { NoopAuditSink, type AuditSink } from "./audit.js";
import {
  NoopSecurityEventSink,
  type SecurityEventSink,
} from "./security-events.js";
import { getSessionConfig, type SessionConfig } from "./session-config.js";

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

interface SessionServiceOptions {
  auditSink?: AuditSink;
  correlationId?: string;
  securityEvents?: SecurityEventSink;
  sessionConfig?: SessionConfig;
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

function validAt(
  row: { absoluteExpiresAt: Date; idleExpiresAt: Date; revokedAt: Date | null },
  now: Date,
) {
  return (
    row.revokedAt === null &&
    row.idleExpiresAt > now &&
    row.absoluteExpiresAt > now
  );
}

export class SessionService {
  private readonly auditSink: AuditSink;
  private readonly correlationId: string;
  private readonly securityEvents: SecurityEventSink;
  private readonly sessionConfig: SessionConfig;

  constructor(
    private readonly prisma: PrismaClient,
    options: SessionServiceOptions = {},
  ) {
    this.auditSink = options.auditSink ?? new NoopAuditSink();
    this.correlationId =
      options.correlationId ?? "synthetic-session-correlation";
    this.securityEvents = options.securityEvents ?? new NoopSecurityEventSink();
    this.sessionConfig = options.sessionConfig ?? getSessionConfig();
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

    this.auditSink.record({
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

  async resolveSession(
    token: string,
    now = new Date(),
  ): Promise<ResolvedSession | undefined> {
    if (token.trim() === "") {
      return undefined;
    }

    const digest = hashToken(token);
    const row = await this.prisma.platformSession.findUnique({
      where: { tokenHash: digest.toString("hex") },
      include: { user: true },
    });

    if (
      row === null ||
      !isDigestEqual(row.tokenHash, digest) ||
      !validAt(row, now) ||
      row.user.status !== "ACTIVE"
    ) {
      await this.securityEvents.record({
        code: "INVALID_SESSION",
        correlationId: this.correlationId,
        occurredAt: now,
        result: "DENY",
      });
      return undefined;
    }

    const nextIdleExpiry = new Date(
      now.getTime() + this.sessionConfig.idleTtlSeconds * 1000,
    );
    const idleExpiresAt =
      nextIdleExpiry < row.absoluteExpiresAt
        ? nextIdleExpiry
        : row.absoluteExpiresAt;
    await this.prisma.platformSession.update({
      data: { idleExpiresAt, lastSeenAt: now },
      where: { id: row.id },
    });

    return {
      absoluteExpiresAt: row.absoluteExpiresAt,
      idleExpiresAt,
      sessionId: row.id,
      userId: row.userId,
    };
  }

  async rotateSession(
    token: string,
    now = new Date(),
  ): Promise<IssuedSession | undefined> {
    const current = await this.resolveSession(token, now);
    if (current === undefined) {
      return undefined;
    }

    await this.prisma.platformSession.update({
      data: { revokedAt: now },
      where: { id: current.sessionId },
    });
    const next = await this.issueSession(current.userId, now);
    await this.prisma.platformSession.update({
      data: { rotatedFromSessionId: current.sessionId },
      where: { id: next.sessionId },
    });
    return next;
  }

  async revokeSession(token: string, now = new Date()): Promise<void> {
    const tokenHash = hashTokenHex(token);
    const session = await this.prisma.platformSession.findUnique({
      where: { tokenHash },
    });
    if (session === null) return;

    await this.prisma.platformSession.update({
      data: { revokedAt: now },
      where: { id: session.id },
    });
    this.auditSink.record({
      action: "SESSION_REVOKED",
      actorId: session.userId,
      correlationId: this.correlationId,
      effectiveActorId: session.userId,
      metadata: { sessionId: session.id },
      occurredAt: now,
      purpose: "identity.session",
      resourceId: session.id,
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
    this.auditSink.record({
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
