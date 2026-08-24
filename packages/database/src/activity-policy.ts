import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow } from "./authorization.js";
import {
  ActivityPolicyConflictError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./domain-errors.js";
import { PERMISSIONS } from "./permission-catalog.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const ACTIVITY_POLICY_BASELINES = {
  DIAGNOSTIC_EVALUATION: 60,
  GUARDIAN_INTERVIEW: 30,
} as const;

export type ActivityPolicyKind = keyof typeof ACTIVITY_POLICY_BASELINES;
export type ActivityDurationSourceValue =
  "TENANT_KIND_DEFAULT" | "VERSION_OVERRIDE";

export interface UpsertActivityPolicyInput {
  backupMembershipId: string;
  defaultDurationMinutes: number;
  expectedVersion?: number | undefined;
  primaryMembershipId: string;
}

export interface ActivityPolicyDto {
  backupMembershipId: string;
  concurrencyVersion: number;
  defaultDurationMinutes: number;
  id: string;
  kind: ActivityPolicyKind;
  primaryMembershipId: string;
  readinessBlockers: Array<
    | "ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED"
    | "ACTIVITY_POLICY_EXECUTOR_INACTIVE"
  >;
  ready: boolean;
}

export interface ActivityPolicyMutationDto extends ActivityPolicyDto {
  futureAppointmentsAffected: number;
}

export interface EligibleActivityExecutorDto {
  membershipId: string;
  roleKeys: string[];
}

type PolicyWithExecutors = Prisma.TenantActivityPolicyGetPayload<{
  include: {
    backupMembership: { include: { roleAssignments: true; user: true } };
    primaryMembership: { include: { roleAssignments: true; user: true } };
  };
}>;

const policyExecutorInclude = {
  backupMembership: { include: { roleAssignments: true, user: true } },
  primaryMembership: { include: { roleAssignments: true, user: true } },
} satisfies Prisma.TenantActivityPolicyInclude;

function validateDuration(durationMinutes: number): void {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
    throw new IntakeValidationError(
      "Activity duration must be between 1 and 1440 minutes",
    );
  }
}

function assignmentIsActive(
  assignment: PolicyWithExecutors["primaryMembership"]["roleAssignments"][number],
  now: Date,
): boolean {
  return (
    assignment.status === "ACTIVE" &&
    assignment.startsAt <= now &&
    (assignment.endsAt === null || assignment.endsAt > now)
  );
}

function membershipIsActive(
  membership: PolicyWithExecutors["primaryMembership"],
  now: Date,
): boolean {
  return (
    membership.status === "ACTIVE" &&
    membership.startsAt <= now &&
    (membership.endsAt === null || membership.endsAt > now) &&
    membership.user.status === "ACTIVE"
  );
}

function membershipCanPerform(
  membership: PolicyWithExecutors["primaryMembership"],
  now: Date,
): boolean {
  return membership.roleAssignments.some(
    (assignment) =>
      assignmentIsActive(assignment, now) &&
      assignment.permissions.includes(PERMISSIONS.ACTIVITY_PERFORM),
  );
}

function readinessBlockers(
  policy: PolicyWithExecutors,
  now: Date,
): ActivityPolicyDto["readinessBlockers"] {
  const memberships = [policy.primaryMembership, policy.backupMembership];
  if (memberships.some((membership) => !membershipIsActive(membership, now))) {
    return ["ACTIVITY_POLICY_EXECUTOR_INACTIVE"];
  }
  if (
    memberships.some((membership) => !membershipCanPerform(membership, now))
  ) {
    return ["ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED"];
  }
  return [];
}

function mapPolicy(policy: PolicyWithExecutors, now: Date): ActivityPolicyDto {
  const blockers = readinessBlockers(policy, now);
  return {
    backupMembershipId: policy.backupMembershipId,
    concurrencyVersion: policy.concurrencyVersion,
    defaultDurationMinutes: policy.defaultDurationMinutes,
    id: policy.id,
    kind: policy.kind,
    primaryMembershipId: policy.primaryMembershipId,
    readinessBlockers: blockers,
    ready: blockers.length === 0,
  };
}

function throwForPolicyReadiness(policy: PolicyWithExecutors, now: Date): void {
  const blockers = readinessBlockers(policy, now);
  const blocker = blockers[0];
  if (blocker !== undefined) throw new ActivityPolicyConflictError(blocker);
}

async function findPolicy(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  kind: ActivityPolicyKind,
): Promise<PolicyWithExecutors | null> {
  return transaction.tenantActivityPolicy.findFirst({
    include: policyExecutorInclude,
    where: { kind, tenantId },
  });
}

export function proposedActivityPolicyBaseline(
  kind: ActivityPolicyKind,
): number {
  return ACTIVITY_POLICY_BASELINES[kind];
}

export async function resolveActivityDuration(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  kind: ActivityPolicyKind,
  durationMinutes: number | null | undefined,
): Promise<{
  durationMinutes: number;
  durationSource: ActivityDurationSourceValue;
  policyVersion?: number | undefined;
}> {
  if (durationMinutes !== undefined && durationMinutes !== null) {
    validateDuration(durationMinutes);
    return { durationMinutes, durationSource: "VERSION_OVERRIDE" };
  }
  const policy = await findPolicy(transaction, tenantId, kind);
  if (policy === null) {
    throw new ActivityPolicyConflictError("ACTIVITY_POLICY_REQUIRED");
  }
  return {
    durationMinutes: policy.defaultDurationMinutes,
    durationSource: "TENANT_KIND_DEFAULT",
    policyVersion: policy.concurrencyVersion,
  };
}

/** Revalidates both configured executors and optionally restricts a new assignment. */
export async function assertReadyActivityPolicy(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  kind: ActivityPolicyKind,
  assignedUserId?: string,
  now = new Date(),
): Promise<PolicyWithExecutors> {
  const policy = await findPolicy(transaction, tenantId, kind);
  if (policy === null) {
    throw new ActivityPolicyConflictError("ACTIVITY_POLICY_REQUIRED");
  }
  throwForPolicyReadiness(policy, now);
  if (
    assignedUserId !== undefined &&
    assignedUserId !== policy.primaryMembership.userId &&
    assignedUserId !== policy.backupMembership.userId
  ) {
    throw new ActivityPolicyConflictError(
      "ASSIGNED_EXECUTOR_NOT_PRIMARY_OR_BACKUP",
    );
  }
  return policy;
}

/** Existing appointment snapshots remain valid only while their executor is operational. */
export async function assertExecutorCanPerform(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  assignedUserId: string,
  now = new Date(),
): Promise<void> {
  const membership = await transaction.membership.findFirst({
    include: { roleAssignments: true, user: true },
    where: { tenantId, userId: assignedUserId },
  });
  if (membership === null || !membershipIsActive(membership, now)) {
    throw new ActivityPolicyConflictError("ACTIVITY_POLICY_EXECUTOR_INACTIVE");
  }
  if (!membershipCanPerform(membership, now)) {
    throw new ActivityPolicyConflictError(
      "ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED",
    );
  }
}

function assertPolicyPermission(
  context: TenantExecutionContext,
  permission:
    | typeof PERMISSIONS.ACTIVITY_POLICY_MANAGE
    | typeof PERMISSIONS.ACTIVITY_POLICY_READ,
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
  });
}

async function recordPolicyAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: "TENANT_ACTIVITY_POLICY_CREATED" | "TENANT_ACTIVITY_POLICY_UPDATED";
    metadata: Record<string, number | string>;
    resourceId: string;
  },
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      metadata: input.metadata,
      occurredAt: new Date(),
      purpose: context.purpose,
      resourceId: input.resourceId,
      resourceType: "TenantActivityPolicy",
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

export class ActivityPolicyService {
  constructor(private readonly prisma: PrismaClient) {}

  async listPolicies(
    context: TenantExecutionContext,
  ): Promise<ActivityPolicyDto[]> {
    assertPolicyPermission(context, PERMISSIONS.ACTIVITY_POLICY_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const now = new Date();
      const policies = await transaction.tenantActivityPolicy.findMany({
        include: policyExecutorInclude,
        orderBy: { kind: "asc" },
      });
      return policies.map((policy) => mapPolicy(policy, now));
    });
  }

  async listEligibleExecutors(
    context: TenantExecutionContext,
  ): Promise<EligibleActivityExecutorDto[]> {
    assertPolicyPermission(context, PERMISSIONS.ACTIVITY_POLICY_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const now = new Date();
      const memberships = await transaction.membership.findMany({
        include: { roleAssignments: true, user: true },
        orderBy: { id: "asc" },
        where: { tenantId: context.tenantId },
      });
      return memberships
        .filter(
          (membership) =>
            membershipIsActive(membership, now) &&
            membershipCanPerform(membership, now),
        )
        .map((membership) => ({
          membershipId: membership.id,
          roleKeys: [
            ...new Set(
              membership.roleAssignments
                .filter(
                  (assignment) =>
                    assignmentIsActive(assignment, now) &&
                    assignment.permissions.includes(
                      PERMISSIONS.ACTIVITY_PERFORM,
                    ),
                )
                .map((assignment) => assignment.roleKey),
            ),
          ].sort(),
        }));
    });
  }

  async getPolicy(
    context: TenantExecutionContext,
    kind: ActivityPolicyKind,
  ): Promise<ActivityPolicyDto> {
    assertPolicyPermission(context, PERMISSIONS.ACTIVITY_POLICY_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const now = new Date();
      const policy = await findPolicy(transaction, context.tenantId, kind);
      if (policy === null) throw new IntakeNotFoundError();
      return mapPolicy(policy, now);
    });
  }

  async putPolicy(
    context: TenantExecutionContext,
    kind: ActivityPolicyKind,
    input: UpsertActivityPolicyInput,
  ): Promise<ActivityPolicyMutationDto> {
    assertPolicyPermission(context, PERMISSIONS.ACTIVITY_POLICY_MANAGE);
    validateDuration(input.defaultDurationMinutes);
    if (input.primaryMembershipId === input.backupMembershipId) {
      throw new ActivityPolicyConflictError(
        "ACTIVITY_POLICY_EXECUTORS_MUST_DIFFER",
      );
    }
    return withTenantTransaction(this.prisma, async (transaction) => {
      const now = new Date();
      const candidateMemberships = await transaction.membership.findMany({
        include: { roleAssignments: true, user: true },
        where: {
          id: { in: [input.primaryMembershipId, input.backupMembershipId] },
          tenantId: context.tenantId,
        },
      });
      if (
        candidateMemberships.length !== 2 ||
        candidateMemberships.some(
          (membership) => !membershipIsActive(membership, now),
        )
      ) {
        throw new ActivityPolicyConflictError(
          "ACTIVITY_POLICY_EXECUTOR_INACTIVE",
        );
      }
      if (
        candidateMemberships.some(
          (membership) => !membershipCanPerform(membership, now),
        )
      ) {
        throw new ActivityPolicyConflictError(
          "ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED",
        );
      }

      // Serializes create-vs-create for the tenant so the unique key never
      // escapes as a provider-specific error instead of a canonical conflict.
      const tenantLock = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "tenants" WHERE "id" = ${context.tenantId}::uuid FOR UPDATE`;
      if (tenantLock.length !== 1) throw new IntakeNotFoundError();

      const existing = await findPolicy(transaction, context.tenantId, kind);
      if (existing === null) {
        if (input.expectedVersion !== undefined) {
          throw new ActivityPolicyConflictError(
            "ACTIVITY_POLICY_VERSION_CHANGED",
          );
        }
        const created = await transaction.tenantActivityPolicy.create({
          data: {
            backupMembershipId: input.backupMembershipId,
            createdBy: context.effectiveActorId ?? context.actorId,
            defaultDurationMinutes: input.defaultDurationMinutes,
            kind,
            primaryMembershipId: input.primaryMembershipId,
            tenantId: context.tenantId,
            updatedBy: context.effectiveActorId ?? context.actorId,
          },
          include: policyExecutorInclude,
        });
        await recordPolicyAudit(transaction, context, {
          action: "TENANT_ACTIVITY_POLICY_CREATED",
          metadata: {
            defaultDurationMinutes: created.defaultDurationMinutes,
            kind,
            policyVersion: created.concurrencyVersion,
          },
          resourceId: created.id,
        });
        return { ...mapPolicy(created, now), futureAppointmentsAffected: 0 };
      }

      if (input.expectedVersion === undefined) {
        throw new ActivityPolicyConflictError(
          "ACTIVITY_POLICY_ALREADY_CONFIGURED",
        );
      }
      const oldExecutorUserIds = [
        existing.primaryMembership.userId,
        existing.backupMembership.userId,
      ];
      const newExecutorUserIds = candidateMemberships.map(
        (membership) => membership.userId,
      );
      const removedExecutorUserIds = oldExecutorUserIds.filter(
        (userId) => !newExecutorUserIds.includes(userId),
      );
      const futureAppointmentsAffected =
        removedExecutorUserIds.length === 0
          ? 0
          : await transaction.activityAppointment.count({
              where: {
                activity: { definition: { kind } },
                assignedUserId: { in: removedExecutorUserIds },
                scheduledStartAt: { gt: now },
                status: "PROGRAMADA",
                tenantId: context.tenantId,
              },
            });
      const changed = await transaction.tenantActivityPolicy.updateMany({
        data: {
          backupMembershipId: input.backupMembershipId,
          concurrencyVersion: { increment: 1 },
          defaultDurationMinutes: input.defaultDurationMinutes,
          primaryMembershipId: input.primaryMembershipId,
          updatedBy: context.effectiveActorId ?? context.actorId,
        },
        where: {
          concurrencyVersion: input.expectedVersion,
          id: existing.id,
        },
      });
      if (changed.count !== 1) {
        throw new ActivityPolicyConflictError(
          "ACTIVITY_POLICY_VERSION_CHANGED",
        );
      }
      const updated = await transaction.tenantActivityPolicy.findUniqueOrThrow({
        include: policyExecutorInclude,
        where: { id: existing.id },
      });
      await recordPolicyAudit(transaction, context, {
        action: "TENANT_ACTIVITY_POLICY_UPDATED",
        metadata: {
          defaultDurationMinutes: updated.defaultDurationMinutes,
          kind,
          newVersion: updated.concurrencyVersion,
          oldVersion: existing.concurrencyVersion,
        },
        resourceId: updated.id,
      });
      return {
        ...mapPolicy(updated, now),
        futureAppointmentsAffected,
      };
    });
  }
}
