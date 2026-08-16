import { authorizeOrThrow, ForbiddenError } from "./authorization.js";
import {
  assertApplicationAuthorityForCriticalAction,
  isApplicationAuthorityCriticalActionError,
  recordApplicationAuthorityCriticalActionDenied,
} from "./application-authority.js";
import {
  FunctionalHandoffConflictError,
  IntakeNotFoundError,
} from "./domain-errors.js";
import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { PERMISSIONS, SENSITIVITIES } from "./permission-catalog.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export interface FunctionalHandoffDto {
  applicationId: string;
  createdAt: string;
  id: string;
  offerAcceptanceId: string;
  requestedAt: string;
  status: "REQUESTED";
}

interface HandoffOfferingResource {
  campusId: string;
  id: string;
  processId: string;
  tenantId: string;
}

interface HandoffApplicationResource {
  id: string;
  offering: HandoffOfferingResource;
  status: string;
  tenantId: string;
}

function effectiveActor(context: TenantExecutionContext): string {
  return context.effectiveActorId ?? context.actorId;
}

function resourceScopes(
  application: HandoffApplicationResource,
): readonly string[] {
  return [
    `application:${application.id}`,
    `offering:${application.offering.id}`,
    `process:${application.offering.processId}`,
    `campus:${application.offering.campusId}`,
  ];
}

function assertResourceScope(
  context: TenantExecutionContext,
  application: HandoffApplicationResource,
): void {
  const scopes =
    context.contextOrigin === "support_elevation"
      ? context.supportElevation?.scopes
      : context.scopes;
  if (
    scopes?.includes("*") !== true &&
    !resourceScopes(application).some((scope) => scopes?.includes(scope))
  ) {
    throw new ForbiddenError();
  }
}

function authorizeHandoff(
  context: TenantExecutionContext,
  application: HandoffApplicationResource,
): void {
  authorizeOrThrow(context, {
    permission: PERMISSIONS.APPLICATION_HANDOFF_REQUEST,
    purpose: context.purpose,
    resourceTenantId: application.tenantId,
    sensitivity: SENSITIVITIES.INTERNAL,
  });
  assertResourceScope(context, application);
}

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapHandoff(handoff: {
  applicationId: string;
  createdAt: Date;
  id: string;
  offerAcceptanceId: string;
  requestedAt: Date;
}): FunctionalHandoffDto {
  return {
    applicationId: handoff.applicationId,
    createdAt: handoff.createdAt.toISOString(),
    id: handoff.id,
    offerAcceptanceId: handoff.offerAcceptanceId,
    requestedAt: handoff.requestedAt.toISOString(),
    status: "REQUESTED",
  };
}

export class FunctionalHandoffService {
  constructor(private readonly prisma: PrismaClient) {}

  async requestFunctionalHandoff(
    context: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ): Promise<FunctionalHandoffDto> {
    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        await transaction.$queryRaw`
        SELECT id FROM applications
        WHERE tenant_id = ${context.tenantId}::uuid
          AND id = ${applicationId}::uuid
        FOR UPDATE
      `;

        const application = await transaction.application.findFirst({
          select: {
            id: true,
            offering: {
              select: {
                campusId: true,
                id: true,
                processId: true,
                tenantId: true,
              },
            },
            status: true,
            tenantId: true,
          },
          where: { id: applicationId },
        });
        if (application === null) throw new IntakeNotFoundError();
        authorizeHandoff(context, application);

        const offer = await transaction.admissionOffer.findFirst({
          include: { acceptance: true, currentVersion: true },
          where: { applicationId: application.id },
        });
        const currentVersion = offer?.currentVersion;
        const acceptance = offer?.acceptance;
        if (
          application.status !== "SUBMITTED" ||
          offer === null ||
          currentVersion === null ||
          currentVersion === undefined ||
          acceptance === null ||
          acceptance === undefined ||
          acceptance.applicationId !== application.id ||
          acceptance.offerId !== offer.id ||
          acceptance.offerVersionId !== currentVersion.id ||
          currentVersion.lifecycle !== "ACCEPTED"
        ) {
          throw new FunctionalHandoffConflictError("HANDOFF_NOT_ENABLED");
        }

        await assertApplicationAuthorityForCriticalAction(transaction, {
          applicationId: application.id,
          expectedAuthorityUserId: acceptance.actorId,
          now,
          tenantId: context.tenantId,
        });

        const existing = await transaction.integrationHandoff.findFirst({
          where: { offerAcceptanceId: acceptance.id },
        });
        if (existing !== null) return mapHandoff(existing);

        const handoff = await transaction.integrationHandoff.create({
          data: {
            applicationId: application.id,
            offerAcceptanceId: acceptance.id,
            requestedAt: now,
            requestedByActorId: effectiveActor(context),
            tenantId: context.tenantId,
          },
        });
        await transaction.auditEvent.create({
          data: {
            action: "INTEGRATION_HANDOFF_REQUESTED",
            actorId: context.actorId,
            correlationId: context.correlationId,
            effectiveActorId: effectiveActor(context),
            metadata: asJson({
              handoffId: handoff.id,
              offerAcceptanceId: acceptance.id,
            }),
            occurredAt: now,
            purpose: context.purpose,
            resourceId: handoff.id,
            resourceType: "IntegrationHandoff",
            result: "SUCCESS",
            scope: "TENANT",
            tenantId: context.tenantId,
          },
        });
        return mapHandoff(handoff);
      });
    } catch (error) {
      if (isApplicationAuthorityCriticalActionError(error)) {
        await recordApplicationAuthorityCriticalActionDenied(
          this.prisma,
          context,
          applicationId,
          error.code,
          now,
        );
      }
      throw error;
    }
  }
}
