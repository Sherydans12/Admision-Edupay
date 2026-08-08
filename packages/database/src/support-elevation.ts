import type { PrismaClient } from "./generated/prisma/client.js";
import { authorize, type AuthorizationRequirement } from "./authorization.js";
import { NoopAuditSink, type AuditSink } from "./audit.js";
import { PERMISSIONS } from "./permission-catalog.js";
import {
  NoopSecurityEventSink,
  type SecurityEventSink,
} from "./security-events.js";
import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export interface StartSupportElevationInput {
  actorContext: TenantExecutionContext;
  categories: readonly string[];
  expiresAt: Date;
  now?: Date;
  purpose: string;
  reason: string;
  scopes: readonly string[];
  tenantId: string;
}

export class SupportElevationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditSink: AuditSink = new NoopAuditSink(),
    private readonly securityEvents: SecurityEventSink = new NoopSecurityEventSink(),
  ) {}

  async startSupportElevation(input: StartSupportElevationInput) {
    const now = input.now ?? new Date();
    const capabilityRequirement: AuthorizationRequirement = {
      permission: PERMISSIONS.PLATFORM_SUPPORT_ELEVATE,
      purpose: "platform.support",
    };
    const actorContext = input.actorContext;
    const decision = authorize(actorContext, capabilityRequirement, now);

    if (
      decision.decision === "DENY" ||
      actorContext.globalSuperadmin !== true
    ) {
      this.securityEvents.record({
        code: "SUPPORT_ELEVATION_DENIED",
        correlationId: actorContext.correlationId,
        occurredAt: now,
        result: "DENY",
        subjectId: actorContext.actorId,
        tenantId: input.tenantId,
      });
      throw new Error("Support elevation denied");
    }
    if (
      input.tenantId !== actorContext.tenantId ||
      input.reason.trim() === "" ||
      input.purpose.trim() === "" ||
      input.scopes.length === 0 ||
      input.categories.length === 0 ||
      input.expiresAt <= now
    ) {
      throw new Error("Support elevation request is invalid");
    }

    const elevation = await runWithTenantContext(actorContext, () =>
      withTenantTransaction(this.prisma, (transaction) =>
        transaction.supportElevation.create({
          data: {
            actorUserId: actorContext.actorId,
            categories: [...input.categories],
            expiresAt: input.expiresAt,
            purpose: input.purpose,
            reason: input.reason,
            scopes: [...input.scopes],
            startedAt: now,
            tenantId: input.tenantId,
          },
        }),
      ),
    );

    this.auditSink.record({
      action: "SUPPORT_ELEVATION_STARTED",
      actorId: actorContext.actorId,
      correlationId: actorContext.correlationId,
      effectiveActorId: actorContext.actorId,
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
      tenantId: input.tenantId,
    });
    return elevation;
  }

  async closeSupportElevation(
    context: TenantExecutionContext,
    elevationId: string,
    now = new Date(),
  ): Promise<void> {
    await runWithTenantContext(context, () =>
      withTenantTransaction(this.prisma, (transaction) =>
        transaction.supportElevation.updateMany({
          data: { closedAt: now },
          where: {
            id: elevationId,
            closedAt: null,
            tenantId: context.tenantId,
          },
        }),
      ),
    );
    this.auditSink.record({
      action: "SUPPORT_ELEVATION_CLOSED",
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      occurredAt: now,
      purpose: context.purpose,
      resourceId: elevationId,
      resourceType: "SupportElevation",
      result: "SUCCESS",
      tenantId: context.tenantId,
    });
  }
}

export function getElevationContext(
  context: TenantExecutionContext,
  elevation: {
    categories: string[];
    closedAt?: Date;
    expiresAt: Date;
    id: string;
    purpose: string;
    revokedAt?: Date;
    scopes: string[];
    tenantId: string;
  },
): TenantExecutionContext {
  return {
    ...context,
    purpose: elevation.purpose,
    scopes: elevation.scopes,
    supportElevation: elevation,
    tenantId: elevation.tenantId,
  };
}
