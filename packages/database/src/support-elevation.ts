import type { PrismaClient } from "./generated/prisma/client.js";
import { authorize, type AuthorizationRequirement } from "./authorization.js";
import type { AuditSink } from "./audit.js";
import { PERMISSIONS } from "./permission-catalog.js";
import {
  type PlatformExecutionContext,
  createVerifiedSupportElevation,
  type TenantExecutionContext,
  type VerifiedSupportElevation,
} from "./tenant-execution-context.js";
import { withTrustedPlatformSupportTransaction } from "./tenant-transaction.js";
import type { SecurityEventSink } from "./security-events.js";

export interface StartSupportElevationInput {
  actorContext: PlatformExecutionContext;
  categories: readonly string[];
  expiresAt: Date;
  now?: Date;
  purpose: string;
  reason: string;
  scopes: readonly string[];
  targetTenantId: string;
}

export interface ResolveActiveSupportElevationInput {
  actorId: string;
  elevationId: string;
  now?: Date;
  purpose?: string;
  scopes?: readonly string[];
  categories?: readonly string[];
  targetTenantId: string;
}

export interface CloseSupportElevationInput {
  actorContext: PlatformExecutionContext;
  elevationId: string;
  now?: Date;
  targetTenantId: string;
}

function requireNonEmpty(values: readonly string[], field: string): void {
  if (values.length === 0 || values.some((value) => value.trim() === "")) {
    throw new Error(`Support elevation ${field} is required`);
  }
}

function supportRequirement(): AuthorizationRequirement {
  return {
    permission: PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
    purpose: "platform.support",
  };
}

export class SupportElevationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditSink: AuditSink,
    private readonly securityEvents: SecurityEventSink,
  ) {}

  async startSupportElevation(input: StartSupportElevationInput) {
    const now = input.now ?? new Date();
    const actorContext = input.actorContext;
    const decision = authorize(actorContext, supportRequirement(), now);
    const validRequest =
      decision.decision === "ALLOW" &&
      actorContext.globalSuperadmin === true &&
      input.reason.trim() !== "" &&
      input.purpose === "platform.support" &&
      input.expiresAt > now;

    try {
      requireNonEmpty(input.scopes, "scopes");
      requireNonEmpty(input.categories, "categories");
    } catch {
      await this.securityEvents.record({
        code: "SUPPORT_ELEVATION_DENIED",
        correlationId: actorContext.correlationId,
        occurredAt: now,
        result: "DENY",
        subjectId: actorContext.actorId,
        tenantId: input.targetTenantId,
      });
      throw new Error("Support elevation request is invalid");
    }

    if (!validRequest) {
      await this.securityEvents.record({
        code: "SUPPORT_ELEVATION_DENIED",
        correlationId: actorContext.correlationId,
        occurredAt: now,
        result: "DENY",
        subjectId: actorContext.actorId,
        tenantId: input.targetTenantId,
      });
      throw new Error("Support elevation denied");
    }

    // This is the only platform-to-tenant DB boundary. It sets a narrowly scoped
    // transaction-local marker and never installs a tenant context in ALS.
    const elevation = await withTrustedPlatformSupportTransaction(
      this.prisma,
      actorContext.actorId,
      input.targetTenantId,
      (transaction) =>
        transaction.supportElevation.create({
          data: {
            actorUserId: actorContext.actorId,
            categories: [...input.categories],
            expiresAt: input.expiresAt,
            purpose: input.purpose,
            reason: input.reason,
            scopes: [...input.scopes],
            startedAt: now,
            tenantId: input.targetTenantId,
          },
        }),
    );

    await this.auditSink.record({
      action: "SUPPORT_ELEVATION_STARTED",
      actorId: actorContext.actorId,
      correlationId: actorContext.correlationId,
      effectiveActorId: actorContext.effectiveActorId ?? actorContext.actorId,
      metadata: {
        categories: [...input.categories],
        scopes: [...input.scopes],
      },
      occurredAt: now,
      purpose: input.purpose,
      reasonCode: "EXPLICIT_SUPPORT_ELEVATION",
      resourceId: elevation.id,
      resourceType: "SupportElevation",
      result: "SUCCESS",
      tenantId: input.targetTenantId,
    });
    return elevation;
  }

  async resolveActiveSupportElevation(
    input: ResolveActiveSupportElevationInput,
  ): Promise<VerifiedSupportElevation | undefined> {
    const now = input.now ?? new Date();
    const where = {
      actorUserId: input.actorId,
      categories: { hasEvery: [...(input.categories ?? [])] },
      closedAt: null,
      expiresAt: { gt: now },
      id: input.elevationId,
      revokedAt: null,
      scopes: { hasEvery: [...(input.scopes ?? [])] },
      tenantId: input.targetTenantId,
      ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
    };
    const row = await withTrustedPlatformSupportTransaction(
      this.prisma,
      input.actorId,
      input.targetTenantId,
      (transaction) =>
        transaction.supportElevation.findFirst({
          where,
        }),
    );
    if (row === null) return undefined;
    return createVerifiedSupportElevation({
      categories: Object.freeze([...row.categories]),
      expiresAt: row.expiresAt,
      id: row.id,
      purpose: row.purpose,
      scopes: Object.freeze([...row.scopes]),
      tenantId: row.tenantId,
    });
  }

  async closeSupportElevation(
    input: CloseSupportElevationInput,
  ): Promise<void> {
    await this.changeElevationState(
      input,
      "closedAt",
      "SUPPORT_ELEVATION_CLOSED",
    );
  }

  async revokeSupportElevation(
    input: CloseSupportElevationInput,
  ): Promise<void> {
    await this.changeElevationState(
      input,
      "revokedAt",
      "SUPPORT_ELEVATION_REVOKED",
    );
  }

  private async changeElevationState(
    input: CloseSupportElevationInput,
    state: "closedAt" | "revokedAt",
    action: string,
  ): Promise<void> {
    const now = input.now ?? new Date();
    const decision = authorize(input.actorContext, supportRequirement(), now);
    if (decision.decision === "DENY") {
      await this.auditSink.record({
        action,
        actorId: input.actorContext.actorId,
        correlationId: input.actorContext.correlationId,
        effectiveActorId:
          input.actorContext.effectiveActorId ?? input.actorContext.actorId,
        occurredAt: now,
        purpose: "platform.support",
        reasonCode: "UNAUTHORIZED",
        resourceId: input.elevationId,
        resourceType: "SupportElevation",
        result: "DENY",
        tenantId: input.targetTenantId,
      });
      throw new Error("Support elevation change denied");
    }

    const current = await this.resolveActiveSupportElevation({
      actorId: input.actorContext.actorId,
      elevationId: input.elevationId,
      now,
      targetTenantId: input.targetTenantId,
    });
    if (current === undefined) {
      await this.auditSink.record({
        action,
        actorId: input.actorContext.actorId,
        correlationId: input.actorContext.correlationId,
        effectiveActorId:
          input.actorContext.effectiveActorId ?? input.actorContext.actorId,
        occurredAt: now,
        purpose: "platform.support",
        reasonCode: "NOT_ACTIVE_OR_NOT_OWNED",
        resourceId: input.elevationId,
        resourceType: "SupportElevation",
        result: "DENY",
        tenantId: input.targetTenantId,
      });
      throw new Error("Support elevation change denied");
    }

    const result = await withTrustedPlatformSupportTransaction(
      this.prisma,
      input.actorContext.actorId,
      input.targetTenantId,
      (transaction) =>
        transaction.supportElevation.updateMany({
          data: { [state]: now },
          where: {
            actorUserId: input.actorContext.actorId,
            closedAt: null,
            id: input.elevationId,
            revokedAt: null,
            tenantId: input.targetTenantId,
          },
        }),
    );
    if (result.count !== 1) {
      await this.auditSink.record({
        action,
        actorId: input.actorContext.actorId,
        correlationId: input.actorContext.correlationId,
        effectiveActorId:
          input.actorContext.effectiveActorId ?? input.actorContext.actorId,
        occurredAt: now,
        purpose: "platform.support",
        reasonCode: "CONCURRENT_STATE_CHANGE",
        resourceId: input.elevationId,
        resourceType: "SupportElevation",
        result: "DENY",
        tenantId: input.targetTenantId,
      });
      throw new Error("Support elevation change denied");
    }

    await this.auditSink.record({
      action,
      actorId: input.actorContext.actorId,
      correlationId: input.actorContext.correlationId,
      effectiveActorId:
        input.actorContext.effectiveActorId ?? input.actorContext.actorId,
      occurredAt: now,
      purpose: "platform.support",
      resourceId: input.elevationId,
      resourceType: "SupportElevation",
      result: "SUCCESS",
      tenantId: input.targetTenantId,
    });
  }
}

export function getElevationContext(
  context: PlatformExecutionContext,
  elevation: VerifiedSupportElevation,
): TenantExecutionContext {
  const result: TenantExecutionContext = {
    actorId: context.actorId,
    contextOrigin: "support_elevation",
    correlationId: context.correlationId,
    effectiveActorId: context.effectiveActorId ?? context.actorId,
    purpose: elevation.purpose,
    scopes: elevation.scopes,
    source: context.source,
    supportElevation: elevation,
    tenantId: elevation.tenantId,
  };
  if (context.globalCapabilities !== undefined) {
    return { ...result, capabilities: context.globalCapabilities };
  }
  return result;
}
