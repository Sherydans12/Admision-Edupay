import { authorizeOrThrow, ForbiddenError } from "./authorization.js";
import { applyDirectionDispositionEffects } from "./capacity-offer.js";
import {
  IntakeNotFoundError,
  RecommendationConflictError,
  RecommendationValidationError,
} from "./domain-errors.js";
import {
  PERMISSIONS,
  SENSITIVITIES,
  type PermissionKey,
} from "./permission-catalog.js";
import type {
  AdmissionRecommendationVersion,
  DirectionDecisionVersion,
  Prisma,
  PrismaClient,
} from "./generated/prisma/client.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";
import {
  DevelopmentBusinessCalendar,
  type BusinessCalendar,
} from "./documents.js";

export const RECOMMENDATION_OPTIONS = [
  "RECOMENDAR_ADMISION",
  "NO_RECOMENDAR_ADMISION",
  "DEVOLVER_A_REVISION",
] as const;
export type RecommendationOption = (typeof RECOMMENDATION_OPTIONS)[number];

export const DIRECTION_DISPOSITIONS = [
  "APROBADO",
  "LISTA_DE_ESPERA",
  "RECHAZADO",
  "DEVUELTO_A_REVISION",
] as const;
export type DirectionDisposition = (typeof DIRECTION_DISPOSITIONS)[number];

export type RecommendationVersionLifecycle = "DRAFT" | "SUBMITTED";

export interface RecommendationDraftInput {
  foundation: string;
  option: RecommendationOption;
}

export interface DirectionDecisionInput {
  disposition: DirectionDisposition;
  expectedRecommendationVersionId: string;
  foundation?: string | null | undefined;
  reason?: string | null | undefined;
}

export interface RecommendationVersionDto {
  createdAt: string;
  createdBy: string;
  evidenceManifest: Record<string, unknown>;
  foundation: string;
  id: string;
  lifecycle: RecommendationVersionLifecycle;
  option: RecommendationOption;
  previousVersionId: string | null;
  recommendationId: string;
  submittedAt: string | null;
  submittedBy: string | null;
  versionNumber: number;
}

export interface DirectionDecisionVersionDto {
  decidedAt: string;
  decidedBy: string;
  disposition: DirectionDisposition;
  evidenceManifest: Record<string, unknown>;
  foundation: string | null;
  id: string;
  previousVersionId: string | null;
  reason: string | null;
  recommendationVersionId: string;
  versionNumber: number;
}

export interface RecommendationWorkspaceDto {
  application: ApplicationContextDto;
  direction: {
    current: DirectionDecisionVersionDto | null;
    history: DirectionDecisionVersionDto[];
  };
  readiness: ReadinessDto;
  recommendation: {
    currentSubmitted: RecommendationVersionDto | null;
    draft: RecommendationVersionDto | null;
    history: RecommendationVersionDto[];
  };
}

export interface ApplicationContextDto {
  id: string;
  offering: {
    campus: string;
    courseLevel: string;
    process: string;
    title: string;
  };
  status: string;
  student: { familyName: string; givenName: string };
  submittedAt: string | null;
}

export interface ReadinessDto {
  activities: Array<{ id: string; status: string }>;
  applicationSubmitted: boolean;
  documentStatuses: Array<{ id: string; status: string }>;
  sensitiveActivityResultsIncluded: boolean;
  warning: "ANTECEDENTS_REQUIRE_REVIEW" | null;
}

type ApplicationResource = {
  id: string;
  tenantId: string;
  academicYearId: string;
  processId: string;
  offeringId: string;
  status: string;
  submittedAt: Date | null;
  student: { givenName: string; familyName: string };
  offering: {
    campusId: string;
    title: string;
    courseLevel: { name: string };
    process: { name: string };
    campus: { name: string };
  };
  snapshot: { id: string } | null;
};

const applicationSelect = {
  id: true,
  tenantId: true,
  academicYearId: true,
  processId: true,
  offeringId: true,
  status: true,
  submittedAt: true,
  student: { select: { givenName: true, familyName: true } },
  offering: {
    select: {
      campusId: true,
      title: true,
      courseLevel: { select: { name: true } },
      process: { select: { name: true } },
      campus: { select: { name: true } },
    },
  },
  snapshot: { select: { id: true } },
} satisfies Prisma.ApplicationSelect;

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function safeText(value: string | null | undefined, field: string): string {
  if (value === undefined || value === null) {
    throw new RecommendationValidationError(`Missing ${field}`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 2000) {
    throw new RecommendationValidationError(`Invalid ${field}`);
  }
  if (
    /<\s*\/?\s*(script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(
      normalized,
    )
  ) {
    throw new RecommendationValidationError(`Invalid ${field}`);
  }
  return normalized;
}

function optionalSafeText(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  return safeText(value, field);
}

function assertRecommendationOption(
  value: string,
): asserts value is RecommendationOption {
  if (!RECOMMENDATION_OPTIONS.includes(value as RecommendationOption)) {
    throw new RecommendationValidationError("Invalid recommendation option");
  }
}

function assertDisposition(
  value: string,
): asserts value is DirectionDisposition {
  if (!DIRECTION_DISPOSITIONS.includes(value as DirectionDisposition)) {
    throw new RecommendationValidationError("Invalid direction disposition");
  }
}

function resourceScopes(application: ApplicationResource): readonly string[] {
  return [
    `application:${application.id}`,
    `offering:${application.offeringId}`,
    `process:${application.processId}`,
    `campus:${application.offering.campusId}`,
  ];
}

function assertResourceScope(
  context: TenantExecutionContext,
  application: ApplicationResource,
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

function authorizeApplicationResource(
  context: TenantExecutionContext,
  application: ApplicationResource,
  permission: PermissionKey,
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: application.tenantId,
    sensitivity: SENSITIVITIES.HIGHLY_RESTRICTED,
  });
  assertResourceScope(context, application);
}

function canReadActivityResults(
  context: TenantExecutionContext,
  application: ApplicationResource,
): boolean {
  try {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ACTIVITY_RESULT_READ,
      purpose: context.purpose,
      resourceTenantId: application.tenantId,
      sensitivity: SENSITIVITIES.HIGHLY_RESTRICTED,
    });
    assertResourceScope(context, application);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError) return false;
    throw error;
  }
}

async function lockApplication(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  applicationId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT "id" FROM "applications"
    WHERE "tenant_id" = ${tenantId}::uuid AND "id" = ${applicationId}::uuid
    FOR UPDATE
  `;
}

async function findApplication(
  transaction: Prisma.TransactionClient,
  applicationId: string,
): Promise<ApplicationResource> {
  const application = await transaction.application.findFirst({
    select: applicationSelect,
    where: { id: applicationId },
  });
  if (application === null) throw new IntakeNotFoundError();
  return application;
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    metadata?: Record<string, string | number>;
    resourceId: string;
    resourceType: string;
  },
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      ...(input.metadata === undefined
        ? {}
        : { metadata: asJson(input.metadata) }),
      occurredAt: new Date(),
      purpose: context.purpose,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

async function buildEvidenceManifest(
  transaction: Prisma.TransactionClient,
  application: ApplicationResource,
  includeSensitiveResults: boolean,
  recommendationVersionId?: string,
): Promise<Record<string, unknown>> {
  const documents = await transaction.documentSubmission.findMany({
    select: { id: true, currentDocumentVersionId: true },
    where: { applicationId: application.id },
  });
  const activities = await transaction.applicationActivity.findMany({
    select: {
      id: true,
      attempts: { select: { id: true } },
    },
    where: { applicationId: application.id },
  });
  const results = includeSensitiveResults
    ? await transaction.activityResult.findMany({
        select: { id: true },
        where: { activity: { applicationId: application.id } },
      })
    : [];
  return {
    applicationActivityIds: activities.map((activity) => activity.id),
    applicationSnapshotId: application.snapshot?.id ?? null,
    attemptIds: activities.flatMap((activity) =>
      activity.attempts.map((attempt) => attempt.id),
    ),
    documentEvidenceIds: documents.map(
      (document) => document.currentDocumentVersionId ?? document.id,
    ),
    ...(recommendationVersionId === undefined
      ? {}
      : { recommendationVersionId }),
    activityResultIds: results.map((result) => result.id),
  };
}

function mapEvidence(
  value: Prisma.JsonValue,
  includeSensitiveResults = true,
): Record<string, unknown> {
  const evidence = (
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? value
      : {}
  ) as Record<string, unknown>;
  if (includeSensitiveResults) return evidence;
  const { activityResultIds: _activityResultIds, ...redacted } = evidence;
  return redacted;
}

function mapRecommendationVersion(
  version: AdmissionRecommendationVersion,
  includeSensitiveResults = true,
): RecommendationVersionDto {
  return {
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy,
    evidenceManifest: mapEvidence(
      version.evidenceManifest,
      includeSensitiveResults,
    ),
    foundation: version.foundation,
    id: version.id,
    lifecycle: version.lifecycle,
    option: version.option,
    previousVersionId: version.previousVersionId,
    recommendationId: version.recommendationId,
    submittedAt: version.submittedAt?.toISOString() ?? null,
    submittedBy: version.submittedBy,
    versionNumber: version.versionNumber,
  };
}

function mapDecisionVersion(
  version: DirectionDecisionVersion,
  includeSensitiveResults = true,
): DirectionDecisionVersionDto {
  return {
    decidedAt: version.decidedAt.toISOString(),
    decidedBy: version.decidedBy,
    disposition: version.disposition,
    evidenceManifest: mapEvidence(
      version.evidenceManifest,
      includeSensitiveResults,
    ),
    foundation: version.foundation,
    id: version.id,
    previousVersionId: version.previousVersionId,
    reason: version.reason,
    recommendationVersionId: version.recommendationVersionId,
    versionNumber: version.versionNumber,
  };
}

async function readWorkspace(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  application: ApplicationResource,
  permission: PermissionKey,
): Promise<RecommendationWorkspaceDto> {
  authorizeApplicationResource(context, application, permission);
  const documents = await transaction.documentSubmission.findMany({
    select: { id: true, status: true },
    where: { applicationId: application.id },
    orderBy: { createdAt: "asc" },
  });
  const activities = await transaction.applicationActivity.findMany({
    select: { id: true, status: true },
    where: { applicationId: application.id },
    orderBy: { createdAt: "asc" },
  });
  const includeSensitiveResults = canReadActivityResults(context, application);
  const recommendation = await transaction.admissionRecommendation.findFirst({
    include: {
      versions: { orderBy: { versionNumber: "asc" } },
    },
    where: { applicationId: application.id },
  });
  const decision = await transaction.directionDecision.findFirst({
    include: { versions: { orderBy: { versionNumber: "asc" } } },
    where: { applicationId: application.id },
  });
  const warning =
    documents.some((document) =>
      ["PENDIENTE", "EN_REVISION", "OBSERVADO"].includes(document.status),
    ) ||
    activities.some(
      (activity) =>
        activity.status !== "REALIZADA" &&
        activity.status !== "EXENTA" &&
        activity.status !== "CERRADA",
    )
      ? "ANTECEDENTS_REQUIRE_REVIEW"
      : null;
  const recommendationVersions = (recommendation?.versions ?? []).filter(
    (version) =>
      permission !== PERMISSIONS.APPLICATION_DECIDE ||
      version.lifecycle === "SUBMITTED",
  );
  const directionVersions = decision?.versions ?? [];
  const currentSubmitted =
    recommendationVersions.find(
      (version) => version.id === recommendation?.currentVersionId,
    ) ?? null;
  const draft =
    permission === PERMISSIONS.APPLICATION_RECOMMEND
      ? (recommendationVersions.find(
          (version) => version.lifecycle === "DRAFT",
        ) ?? null)
      : null;
  return {
    application: {
      id: application.id,
      offering: {
        campus: application.offering.campus.name,
        courseLevel: application.offering.courseLevel.name,
        process: application.offering.process.name,
        title: application.offering.title,
      },
      status: application.status,
      student: application.student,
      submittedAt: application.submittedAt?.toISOString() ?? null,
    },
    direction: {
      current:
        directionVersions.at(-1) === undefined
          ? null
          : mapDecisionVersion(
              directionVersions.at(-1)!,
              includeSensitiveResults,
            ),
      history: directionVersions.map((version) =>
        mapDecisionVersion(version, includeSensitiveResults),
      ),
    },
    readiness: {
      activities,
      applicationSubmitted: application.status === "SUBMITTED",
      documentStatuses: documents,
      sensitiveActivityResultsIncluded: includeSensitiveResults,
      warning,
    },
    recommendation: {
      currentSubmitted:
        currentSubmitted === null
          ? null
          : mapRecommendationVersion(currentSubmitted, includeSensitiveResults),
      draft:
        draft === null
          ? null
          : mapRecommendationVersion(draft, includeSensitiveResults),
      history: recommendationVersions.map((version) =>
        mapRecommendationVersion(version, includeSensitiveResults),
      ),
    },
  };
}

export class RecommendationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendar: BusinessCalendar = new DevelopmentBusinessCalendar(),
  ) {}

  async getRecommendationWorkspace(
    context: TenantExecutionContext,
    applicationId: string,
  ): Promise<RecommendationWorkspaceDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await findApplication(transaction, applicationId);
      return readWorkspace(
        transaction,
        context,
        application,
        PERMISSIONS.APPLICATION_RECOMMEND,
      );
    });
  }

  async getDirectionWorkspace(
    context: TenantExecutionContext,
    applicationId: string,
  ): Promise<RecommendationWorkspaceDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await findApplication(transaction, applicationId);
      return readWorkspace(
        transaction,
        context,
        application,
        PERMISSIONS.APPLICATION_DECIDE,
      );
    });
  }

  async listRecommendations(
    context: TenantExecutionContext,
  ): Promise<RecommendationWorkspaceDto["recommendation"][]> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const applications = await transaction.application.findMany({
        select: applicationSelect,
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "asc" },
      });
      const items: RecommendationWorkspaceDto["recommendation"][] = [];
      for (const application of applications) {
        try {
          authorizeApplicationResource(
            context,
            application,
            PERMISSIONS.APPLICATION_RECOMMEND,
          );
        } catch (error) {
          if (error instanceof ForbiddenError) continue;
          throw error;
        }
        const recommendation =
          await transaction.admissionRecommendation.findFirst({
            include: { versions: { orderBy: { versionNumber: "asc" } } },
            where: { applicationId: application.id },
          });
        const includeSensitiveResults = canReadActivityResults(
          context,
          application,
        );
        const versions = recommendation?.versions ?? [];
        const current =
          versions.find(
            (version) => version.id === recommendation?.currentVersionId,
          ) ?? null;
        const draft =
          versions.find((version) => version.lifecycle === "DRAFT") ?? null;
        items.push({
          currentSubmitted:
            current === null
              ? null
              : mapRecommendationVersion(current, includeSensitiveResults),
          draft:
            draft === null
              ? null
              : mapRecommendationVersion(draft, includeSensitiveResults),
          history: versions.map((version) =>
            mapRecommendationVersion(version, includeSensitiveResults),
          ),
        });
      }
      return items;
    });
  }

  async createDraft(
    context: TenantExecutionContext,
    applicationId: string,
    input: RecommendationDraftInput,
  ): Promise<RecommendationVersionDto> {
    assertRecommendationOption(input.option);
    const foundation = safeText(input.foundation, "foundation");
    return withTenantTransaction(this.prisma, async (transaction) => {
      await lockApplication(transaction, context.tenantId, applicationId);
      const application = await findApplication(transaction, applicationId);
      authorizeApplicationResource(
        context,
        application,
        PERMISSIONS.APPLICATION_RECOMMEND,
      );
      if (application.status !== "SUBMITTED") {
        throw new RecommendationConflictError("RECOMMENDATION_NOT_SUBMITTED");
      }
      const root = await transaction.admissionRecommendation.findFirst({
        include: { versions: { orderBy: { versionNumber: "desc" } } },
        where: { applicationId },
      });
      const existingDraft = root?.versions.find(
        (version) => version.lifecycle === "DRAFT",
      );
      if (existingDraft !== undefined)
        return mapRecommendationVersion(existingDraft);
      const currentSubmitted = root?.versions.find(
        (version) =>
          version.id === root.currentVersionId &&
          version.lifecycle === "SUBMITTED",
      );
      if (currentSubmitted !== undefined) {
        const lastDecision =
          await transaction.directionDecisionVersion.findFirst({
            orderBy: { versionNumber: "desc" },
            where: { applicationId },
          });
        if (lastDecision?.disposition !== "DEVUELTO_A_REVISION") {
          throw new RecommendationValidationError(
            "A submitted recommendation can only be corrected after return to review",
          );
        }
      }
      const recommendation =
        root ??
        (await transaction.admissionRecommendation.create({
          data: { applicationId, tenantId: context.tenantId },
          include: { versions: true },
        }));
      const previousVersionId = currentSubmitted?.id ?? null;
      const version = await transaction.admissionRecommendationVersion.create({
        data: {
          applicationId,
          createdBy: context.effectiveActorId ?? context.actorId,
          evidenceManifest: asJson(
            await buildEvidenceManifest(
              transaction,
              application,
              canReadActivityResults(context, application),
            ),
          ),
          foundation,
          option: input.option,
          previousVersionId,
          recommendationId: recommendation.id,
          tenantId: context.tenantId,
          versionNumber: (root?.versions[0]?.versionNumber ?? 0) + 1,
        },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_RECOMMENDATION_DRAFT_CREATED",
        metadata: { versionNumber: version.versionNumber },
        resourceId: version.id,
        resourceType: "AdmissionRecommendationVersion",
      });
      return mapRecommendationVersion(version);
    });
  }

  async updateDraft(
    context: TenantExecutionContext,
    versionId: string,
    input: RecommendationDraftInput,
  ): Promise<RecommendationVersionDto> {
    assertRecommendationOption(input.option);
    const foundation = safeText(input.foundation, "foundation");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const initial =
        await transaction.admissionRecommendationVersion.findFirst({
          where: { id: versionId },
        });
      if (initial === null) throw new IntakeNotFoundError();
      await lockApplication(
        transaction,
        context.tenantId,
        initial.applicationId,
      );
      const version =
        await transaction.admissionRecommendationVersion.findFirst({
          where: { id: versionId },
        });
      if (version === null) throw new IntakeNotFoundError();
      const application = await findApplication(
        transaction,
        version.applicationId,
      );
      authorizeApplicationResource(
        context,
        application,
        PERMISSIONS.APPLICATION_RECOMMEND,
      );
      if (application.status !== "SUBMITTED")
        throw new RecommendationConflictError("RECOMMENDATION_NOT_SUBMITTED");
      if (version.lifecycle !== "DRAFT") {
        throw new RecommendationValidationError(
          "Submitted recommendation versions are immutable",
        );
      }
      const updated = await transaction.admissionRecommendationVersion.update({
        data: { foundation, option: input.option },
        where: { id: version.id },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_RECOMMENDATION_DRAFT_UPDATED",
        metadata: { versionNumber: updated.versionNumber },
        resourceId: updated.id,
        resourceType: "AdmissionRecommendationVersion",
      });
      return mapRecommendationVersion(updated);
    });
  }

  async submitRecommendation(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<RecommendationVersionDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const initial =
        await transaction.admissionRecommendationVersion.findFirst({
          where: { id: versionId },
        });
      if (initial === null) throw new IntakeNotFoundError();
      await lockApplication(
        transaction,
        context.tenantId,
        initial.applicationId,
      );
      const version =
        await transaction.admissionRecommendationVersion.findFirst({
          where: { id: versionId },
        });
      if (version === null) throw new IntakeNotFoundError();
      const application = await findApplication(
        transaction,
        version.applicationId,
      );
      authorizeApplicationResource(
        context,
        application,
        PERMISSIONS.APPLICATION_RECOMMEND,
      );
      if (version.lifecycle === "SUBMITTED")
        return mapRecommendationVersion(version);
      if (application.status !== "SUBMITTED")
        throw new RecommendationConflictError("RECOMMENDATION_NOT_SUBMITTED");
      const evidenceManifest = await buildEvidenceManifest(
        transaction,
        application,
        canReadActivityResults(context, application),
      );
      const submittedAt = new Date();
      const submitted = await transaction.admissionRecommendationVersion.update(
        {
          data: {
            evidenceManifest: asJson(evidenceManifest),
            lifecycle: "SUBMITTED",
            submittedAt,
            submittedBy: context.effectiveActorId ?? context.actorId,
          },
          where: { id: version.id },
        },
      );
      await transaction.admissionRecommendation.update({
        data: { currentVersionId: submitted.id },
        where: { id: version.recommendationId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_RECOMMENDATION_SUBMITTED",
        metadata: { versionNumber: submitted.versionNumber },
        resourceId: submitted.id,
        resourceType: "AdmissionRecommendationVersion",
      });
      return mapRecommendationVersion(submitted);
    });
  }

  async recordDirectionDecision(
    context: TenantExecutionContext,
    applicationId: string,
    input: DirectionDecisionInput,
  ): Promise<DirectionDecisionVersionDto> {
    assertDisposition(input.disposition);
    if (input.expectedRecommendationVersionId.trim() === "") {
      throw new RecommendationValidationError(
        "expectedRecommendationVersionId is required",
      );
    }
    const foundation = optionalSafeText(input.foundation, "foundation");
    const reason = optionalSafeText(input.reason, "reason");
    if (input.disposition === "RECHAZADO" && foundation === null) {
      throw new RecommendationValidationError("RECHAZADO requires foundation");
    }
    if (input.disposition === "DEVUELTO_A_REVISION" && reason === null) {
      throw new RecommendationValidationError(
        "DEVUELTO_A_REVISION requires reason",
      );
    }
    return withTenantTransaction(this.prisma, async (transaction) => {
      await lockApplication(transaction, context.tenantId, applicationId);
      const application = await findApplication(transaction, applicationId);
      authorizeApplicationResource(
        context,
        application,
        PERMISSIONS.APPLICATION_DECIDE,
      );
      if (application.status !== "SUBMITTED")
        throw new RecommendationConflictError("RECOMMENDATION_NOT_SUBMITTED");
      const recommendation =
        await transaction.admissionRecommendation.findFirst({
          where: { applicationId },
        });
      const currentRecommendation =
        recommendation?.currentVersionId === null ||
        recommendation?.currentVersionId === undefined
          ? null
          : await transaction.admissionRecommendationVersion.findFirst({
              where: {
                id: recommendation.currentVersionId,
                applicationId,
                lifecycle: "SUBMITTED",
              },
            });
      if (currentRecommendation === null)
        throw new RecommendationConflictError("RECOMMENDATION_NOT_SUBMITTED");
      if (currentRecommendation.id !== input.expectedRecommendationVersionId) {
        throw new RecommendationConflictError("RECOMMENDATION_VERSION_CHANGED");
      }
      authorizeOrThrow(context, {
        permission: PERMISSIONS.APPLICATION_DECIDE,
        purpose: context.purpose,
        resourceTenantId: context.tenantId,
        sensitivity: SENSITIVITIES.HIGHLY_RESTRICTED,
        ...(currentRecommendation.submittedBy === null
          ? {}
          : {
              separationOfDuties: {
                recommenderActorId: currentRecommendation.submittedBy,
              },
            }),
      });
      const decision = await transaction.directionDecision.findFirst({
        include: { versions: { orderBy: { versionNumber: "desc" } } },
        where: { applicationId },
      });
      const previous = decision?.versions[0];
      if (previous !== undefined) {
        if (
          ["APROBADO", "LISTA_DE_ESPERA", "RECHAZADO"].includes(
            previous.disposition,
          )
        ) {
          if (
            previous.disposition === input.disposition &&
            previous.recommendationVersionId === currentRecommendation.id &&
            previous.foundation === foundation &&
            previous.reason === reason
          ) {
            return mapDecisionVersion(previous);
          }
          throw new RecommendationConflictError("DECISION_ALREADY_FINAL");
        }
        if (
          previous.disposition === "DEVUELTO_A_REVISION" &&
          previous.recommendationVersionId === currentRecommendation.id
        ) {
          throw new RecommendationConflictError("CASE_RETURNED_TO_REVIEW");
        }
      }
      const root =
        decision ??
        (await transaction.directionDecision.create({
          data: { applicationId, tenantId: context.tenantId },
          include: { versions: true },
        }));
      const version = await transaction.directionDecisionVersion.create({
        data: {
          applicationId,
          decidedBy: context.effectiveActorId ?? context.actorId,
          decidedAt: new Date(),
          disposition: input.disposition,
          evidenceManifest: asJson(
            await buildEvidenceManifest(
              transaction,
              application,
              canReadActivityResults(context, application),
              currentRecommendation.id,
            ),
          ),
          foundation,
          previousVersionId: previous?.id ?? null,
          reason,
          recommendationVersionId: currentRecommendation.id,
          directionDecisionId: root.id,
          tenantId: context.tenantId,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
        },
      });
      await transaction.directionDecision.update({
        data: { currentVersionId: version.id },
        where: { id: root.id },
      });
      await applyDirectionDispositionEffects(transaction, context, {
        applicationId,
        calendar: this.calendar,
        decisionVersionId: version.id,
        disposition: version.disposition,
        offeringId: application.offeringId,
        occurredAt: version.decidedAt,
      });
      await recordAudit(transaction, context, {
        action: "DIRECTION_DECISION_RECORDED",
        metadata: { versionNumber: version.versionNumber },
        resourceId: version.id,
        resourceType: "DirectionDecisionVersion",
      });
      return mapDecisionVersion(version);
    });
  }
}
