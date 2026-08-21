import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow } from "./authorization.js";
import {
  DOCUMENT_CLASSIFICATIONS,
  PERMISSIONS,
  PROCESSING_CATEGORIES,
  RESTRICTED_DOCUMENT_CLASSIFICATIONS,
  SENSITIVE_PROCESSING_CATEGORIES,
  SENSITIVITIES,
  type DocumentClassificationValue,
  type ProcessingCategoryValue,
} from "./permission-catalog.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export class SensitiveProcessingValidationError extends Error {
  constructor(
    public readonly code: SensitiveProcessingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SensitiveProcessingValidationError";
  }
}

export type SensitiveProcessingErrorCode =
  | "PROCESSING_CATEGORY_DISABLED"
  | "PROCESSING_CATEGORY_REQUIRED"
  | "AUTHORITY_REQUIRED_FOR_SENSITIVE_PROCESSING"
  | "SENSITIVE_PROCESSING_NOT_ALLOWED"
  | "DOCUMENT_CLASSIFICATION_DISABLED"
  | "INVALID_PROCESSING_CATEGORY"
  | "INVALID_DOCUMENT_CLASSIFICATION";

export interface SensitiveProcessingPolicyDto {
  activatedAt: string | null;
  activatedBy: string | null;
  category: ProcessingCategoryValue;
  enabled: boolean;
  id: string;
  purpose: string | null;
  tenantId: string;
}

export interface UpdatePolicyInput {
  category: ProcessingCategoryValue;
  enabled: boolean;
  purpose: string | null;
}

export interface EffectivePolicyEntry {
  category: ProcessingCategoryValue;
  enabled: boolean;
}

const ALL_CATEGORIES: readonly ProcessingCategoryValue[] = [
  PROCESSING_CATEGORIES.ORDINARY_ADMISSION,
  PROCESSING_CATEGORIES.SUPPORT_ACCOMMODATION,
  PROCESSING_CATEGORIES.PIE_NEE_DIAGNOSTIC,
  PROCESSING_CATEGORIES.HEALTH,
];

const IMPLICITLY_ENABLED_CATEGORIES: readonly ProcessingCategoryValue[] = [
  PROCESSING_CATEGORIES.ORDINARY_ADMISSION,
  PROCESSING_CATEGORIES.SUPPORT_ACCOMMODATION,
];

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    metadata?: Record<string, number | string>;
    resourceId?: string;
    resourceType: string;
  },
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      occurredAt: new Date(),
      purpose: context.purpose,
      resourceType: input.resourceType,
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
      ...(input.metadata === undefined
        ? {}
        : { metadata: asJson(input.metadata) }),
      ...(input.resourceId === undefined
        ? {}
        : { resourceId: input.resourceId }),
    },
  });
}

function mapPolicy(policy: {
  activatedAt: Date | null;
  activatedBy: string | null;
  category: string;
  enabled: boolean;
  id: string;
  purpose: string | null;
  tenantId: string;
}): SensitiveProcessingPolicyDto {
  return {
    activatedAt: policy.activatedAt?.toISOString() ?? null,
    activatedBy: policy.activatedBy,
    category: policy.category as ProcessingCategoryValue,
    enabled: policy.enabled,
    id: policy.id,
    purpose: policy.purpose,
    tenantId: policy.tenantId,
  };
}

/**
 * Resolve the effective enabled state for a processing category within a tenant.
 * ORDINARY_ADMISSION and SUPPORT_ACCOMMODATION are implicitly enabled.
 * HEALTH and PIE_NEE_DIAGNOSTIC are disabled when no policy row exists (R4-003/004).
 */
export function isCategoryEffectivelyEnabled(
  category: ProcessingCategoryValue,
  policies: readonly SensitiveProcessingPolicyDto[],
): boolean {
  if (IMPLICITLY_ENABLED_CATEGORIES.includes(category)) return true;
  const policy = policies.find((row) => row.category === category);
  return policy?.enabled === true;
}

/**
 * Validate that a form field's processing category is valid for publication.
 * Returns the category if valid, throws SensitiveProcessingValidationError otherwise.
 */
export function assertFieldProcessingCategoryAllowed(
  sensitivity: string,
  processingCategory: ProcessingCategoryValue | null,
  policies: readonly SensitiveProcessingPolicyDto[],
): void {
  if (sensitivity === SENSITIVITIES.HIGHLY_RESTRICTED) {
    if (processingCategory === null) {
      throw new SensitiveProcessingValidationError(
        "PROCESSING_CATEGORY_REQUIRED",
        "HIGHLY_RESTRICTED field requires an explicit processing category",
      );
    }
  }

  if (processingCategory === null) return;

  if (!ALL_CATEGORIES.includes(processingCategory)) {
    throw new SensitiveProcessingValidationError(
      "INVALID_PROCESSING_CATEGORY",
      `Invalid processing category: ${processingCategory}`,
    );
  }

  if (
    SENSITIVE_PROCESSING_CATEGORIES.includes(
      processingCategory as (typeof SENSITIVE_PROCESSING_CATEGORIES)[number],
    ) &&
    !isCategoryEffectivelyEnabled(processingCategory, policies)
  ) {
    throw new SensitiveProcessingValidationError(
      "PROCESSING_CATEGORY_DISABLED",
      `Processing category ${processingCategory} is disabled for this tenant`,
    );
  }
}

/**
 * Validate that a document requirement's processing category and classification
 * are valid for publication.
 */
export function assertDocumentRequirementProcessingAllowed(
  sensitivity: string,
  processingCategory: ProcessingCategoryValue | null,
  documentClassification: DocumentClassificationValue,
  policies: readonly SensitiveProcessingPolicyDto[],
  personalityReportEnabled: boolean,
): void {
  if (sensitivity === SENSITIVITIES.HIGHLY_RESTRICTED) {
    if (processingCategory === null) {
      throw new SensitiveProcessingValidationError(
        "PROCESSING_CATEGORY_REQUIRED",
        "HIGHLY_RESTRICTED document requirement requires an explicit processing category",
      );
    }
  }

  if (processingCategory !== null) {
    if (!ALL_CATEGORIES.includes(processingCategory)) {
      throw new SensitiveProcessingValidationError(
        "INVALID_PROCESSING_CATEGORY",
        `Invalid processing category: ${processingCategory}`,
      );
    }

    if (
      SENSITIVE_PROCESSING_CATEGORIES.includes(
        processingCategory as (typeof SENSITIVE_PROCESSING_CATEGORIES)[number],
      ) &&
      !isCategoryEffectivelyEnabled(processingCategory, policies)
    ) {
      throw new SensitiveProcessingValidationError(
        "PROCESSING_CATEGORY_DISABLED",
        `Processing category ${processingCategory} is disabled for this tenant`,
      );
    }
  }

  if (
    RESTRICTED_DOCUMENT_CLASSIFICATIONS.includes(
      documentClassification as (typeof RESTRICTED_DOCUMENT_CLASSIFICATIONS)[number],
    ) &&
    !personalityReportEnabled
  ) {
    throw new SensitiveProcessingValidationError(
      "DOCUMENT_CLASSIFICATION_DISABLED",
      `Document classification ${documentClassification} is not enabled for this scope`,
    );
  }
}

export class SensitiveProcessingService {
  constructor(private readonly prisma: PrismaClient) {}

  async readEffectivePolicies(
    context: TenantExecutionContext,
  ): Promise<EffectivePolicyEntry[]> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_READ,
    });
    return withTenantTransaction(this.prisma, async (transaction) => {
      const rows = await transaction.sensitiveProcessingPolicy.findMany({
        where: { tenantId: context.tenantId },
      });
      const policies = rows.map(mapPolicy);
      return ALL_CATEGORIES.map((category) => ({
        category,
        enabled: isCategoryEffectivelyEnabled(category, policies),
      }));
    });
  }

  async readPolicies(
    context: TenantExecutionContext,
  ): Promise<SensitiveProcessingPolicyDto[]> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_READ,
    });
    return withTenantTransaction(this.prisma, async (transaction) => {
      const rows = await transaction.sensitiveProcessingPolicy.findMany({
        where: { tenantId: context.tenantId },
      });
      return rows.map(mapPolicy);
    });
  }

  async updatePolicy(
    context: TenantExecutionContext,
    input: UpdatePolicyInput,
  ): Promise<SensitiveProcessingPolicyDto> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_SENSITIVE_PROCESSING_CONFIGURE,
    });

    if (!ALL_CATEGORIES.includes(input.category)) {
      throw new SensitiveProcessingValidationError(
        "INVALID_PROCESSING_CATEGORY",
        `Invalid processing category: ${input.category}`,
      );
    }

    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.sensitiveProcessingPolicy.findUnique({
        where: {
          tenantId_category: {
            category: input.category,
            tenantId: context.tenantId,
          },
        },
      });

      const previousEnabled = existing?.enabled ?? false;
      const now = new Date();

      const policy = await transaction.sensitiveProcessingPolicy.upsert({
        create: {
          activatedAt: input.enabled ? now : null,
          activatedBy: input.enabled ? context.actorId : null,
          category: input.category,
          enabled: input.enabled,
          purpose: input.purpose,
          tenantId: context.tenantId,
        },
        update: {
          ...(input.enabled && !previousEnabled
            ? { activatedAt: now, activatedBy: context.actorId }
            : {}),
          enabled: input.enabled,
          purpose: input.purpose,
        },
        where: {
          tenantId_category: {
            category: input.category,
            tenantId: context.tenantId,
          },
        },
      });

      await recordAudit(transaction, context, {
        action: input.enabled
          ? "SENSITIVE_PROCESSING_CATEGORY_ENABLED"
          : "SENSITIVE_PROCESSING_CATEGORY_DISABLED",
        metadata: {
          category: input.category,
          previousEnabled: previousEnabled ? 1 : 0,
        },
        resourceId: policy.id,
        resourceType: "SensitiveProcessingPolicy",
      });

      return mapPolicy(policy);
    });
  }

  async isPersonalityReportEnabledForScope(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    scope: {
      offeringId?: string;
      processId?: string;
      courseLevelId?: string;
      academicYearId?: string;
    },
  ): Promise<boolean> {
    const rows = await transaction.documentRequirementVersion.findMany({
      where: {
        documentClassification:
          DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT,
        lifecycle: "PUBLISHED",
        tenantId,
        ...(scope.offeringId !== undefined
          ? { scopeOfferingId: scope.offeringId }
          : {}),
        ...(scope.processId !== undefined
          ? { scopeProcessId: scope.processId }
          : {}),
        ...(scope.courseLevelId !== undefined
          ? { scopeCourseLevelId: scope.courseLevelId }
          : {}),
        ...(scope.academicYearId !== undefined
          ? { scopeAcademicYearId: scope.academicYearId }
          : {}),
      },
      take: 1,
    });
    return rows.length > 0;
  }
}
