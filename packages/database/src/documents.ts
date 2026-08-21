import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow, ForbiddenError } from "./authorization.js";
import {
  IntakeConflictError,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./domain-errors.js";
import {
  createOpaqueObjectKey,
  type MalwareScanner,
  type ObjectStorage,
} from "./operational-adapters.js";
import {
  DOCUMENT_CLASSIFICATIONS,
  PERMISSIONS,
  PROCESSING_CATEGORIES,
  SENSITIVITIES,
  type DocumentClassificationValue,
  type PermissionKey,
  type ProcessingCategoryValue,
  type Sensitivity,
} from "./permission-catalog.js";
import {
  assertDocumentRequirementProcessingAllowed,
  SensitiveProcessingValidationError,
  type SensitiveProcessingPolicyDto,
} from "./sensitive-processing.js";
import type {
  FamilyExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const DOCUMENT_FILE_TYPES = ["PDF", "JPEG", "PNG"] as const;
export type DocumentFileType = (typeof DOCUMENT_FILE_TYPES)[number];
export const DOCUMENT_MIME_BY_TYPE: Readonly<Record<DocumentFileType, string>> =
  {
    JPEG: "image/jpeg",
    PDF: "application/pdf",
    PNG: "image/png",
  };
export const DOCUMENT_PROCESS_TOPIC = "document.process";
export const DEFAULT_DOCUMENT_UPLOAD_HARD_MAX_BYTES = 10 * 1024 * 1024;

type ConditionOperator = "EQUALS" | "IN" | "NOT_EQUALS";
type ConditionValue = boolean | string;

export interface EquivalentOptionInput {
  code: string;
  label: string;
}

export interface DocumentRequirementVersionInput {
  allowedFileTypes: DocumentFileType[];
  allowsEquivalent: boolean;
  condition?: {
    fieldId: string;
    formVersionId: string;
    operator: ConditionOperator;
    value: ConditionValue | ConditionValue[];
  } | null;
  correctionWindowBusinessDays: number;
  documentClassification?: DocumentClassificationValue;
  equivalentOptions?: EquivalentOptionInput[] | null;
  instruction?: string | null;
  maxAgeDays?: number | null;
  maxFileSizeBytes: number;
  processingCategory?: ProcessingCategoryValue | null;
  required: boolean;
  scope?: {
    academicYearId?: string | null;
    courseLevelId?: string | null;
    offeringId?: string | null;
    processId?: string | null;
  };
  sensitivity: Sensitivity;
  validityRule: "LATEST_AVAILABLE" | "MAX_AGE_DAYS" | "NONE";
}

export interface BusinessCalendar {
  addBusinessDays(start: Date, days: number): Date;
}

/** Development-only weekday calendar. Institutional holidays remain deferred. */
export class DevelopmentBusinessCalendar implements BusinessCalendar {
  addBusinessDays(start: Date, days: number): Date {
    if (!Number.isInteger(days) || days < 1) {
      throw new IntakeValidationError("Invalid correction business-day window");
    }
    const result = new Date(start);
    let remaining = days;
    while (remaining > 0) {
      result.setUTCDate(result.getUTCDate() + 1);
      const weekday = result.getUTCDay();
      if (weekday !== 0 && weekday !== 6) remaining -= 1;
    }
    return result;
  }
}

const requirementVersionInclude = {
  conditionField: true,
  requirement: true,
} satisfies Prisma.DocumentRequirementVersionInclude;

const submissionInclude = {
  application: { include: { offering: true } },
  currentDocumentVersion: true,
  requirement: true,
  requirementVersion: { include: requirementVersionInclude },
  reviews: { orderBy: { createdAt: "asc" as const } },
  versions: { orderBy: { versionNumber: "asc" as const } },
} satisfies Prisma.DocumentSubmissionInclude;

type RequirementVersionRecord = Prisma.DocumentRequirementVersionGetPayload<{
  include: typeof requirementVersionInclude;
}>;
type SubmissionRecord = Prisma.DocumentSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

export interface DocumentResourceApplication {
  id: string;
  offering: { campusId: string };
  offeringId: string;
  processId: string;
  tenantId: string;
}

export interface DocumentResourceRequirementVersion {
  sensitivity: string;
}

export interface DocumentResourceAuthorizationInput {
  application: DocumentResourceApplication;
  permission: PermissionKey;
  purpose: string;
  requirementVersion: DocumentResourceRequirementVersion;
  sensitivity: Sensitivity;
}

function documentResourceScopes(
  application: DocumentResourceApplication,
): readonly string[] {
  return [
    `application:${application.id}`,
    `offering:${application.offeringId}`,
    `process:${application.processId}`,
    `campus:${application.offering.campusId}`,
  ];
}

function sensitivityIsRecognized(value: string): value is Sensitivity {
  return Object.values(SENSITIVITIES).includes(value as Sensitivity);
}

function resourceScopeAllowed(
  scopes: readonly string[] | undefined,
  application: DocumentResourceApplication,
): boolean {
  if (scopes?.includes("*") === true) return true;
  const resourceScopes = documentResourceScopes(application);
  return resourceScopes.some((scope) => scopes?.includes(scope) === true);
}

/**
 * E5-C resource authorization. Resource scopes are server-derived and use only:
 * `*`, `application:<uuid>`, `offering:<uuid>`, `process:<uuid>` or
 * `campus:<uuid>`. Request-provided scopes are never accepted here.
 */
export function authorizeDocumentResource(
  context: TenantExecutionContext,
  input: DocumentResourceAuthorizationInput,
): void {
  if (
    input.application.tenantId !== context.tenantId ||
    input.requirementVersion.sensitivity !== input.sensitivity ||
    !sensitivityIsRecognized(input.requirementVersion.sensitivity)
  ) {
    throw new ForbiddenError();
  }

  authorizeOrThrow(context, {
    permission: input.permission,
    purpose: input.purpose,
    resourceTenantId: input.application.tenantId,
  });

  const elevated = context.contextOrigin === "support_elevation";
  const effectiveScopes = elevated
    ? context.supportElevation?.scopes
    : context.scopes;
  if (!resourceScopeAllowed(effectiveScopes, input.application)) {
    throw new ForbiddenError();
  }

  const exposesSensitiveContent =
    input.permission === PERMISSIONS.DOCUMENT_READ ||
    input.permission === PERMISSIONS.DOCUMENT_REVIEW ||
    input.permission === PERMISSIONS.DOCUMENT_EXEMPT;
  if (exposesSensitiveContent && input.sensitivity !== SENSITIVITIES.INTERNAL) {
    const sensitivityAllowed = elevated
      ? context.supportElevation?.categories.includes(input.sensitivity) ===
        true
      : context.capabilities?.includes(PERMISSIONS.RESTRICTED_READ) === true;
    if (!sensitivityAllowed) throw new ForbiddenError();
  }
}

function canAuthorizeDocumentResource(
  context: TenantExecutionContext,
  input: DocumentResourceAuthorizationInput,
): boolean {
  try {
    authorizeDocumentResource(context, input);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError) return false;
    throw error;
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function safeText(
  value: string,
  field: string,
  max: number,
  optional = false,
): string {
  const normalized = value.trim();
  if ((!optional && normalized.length === 0) || normalized.length > max) {
    throw new IntakeValidationError(`Invalid ${field}`);
  }
  if (
    /<\s*\/?\s*(script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(
      normalized,
    )
  ) {
    throw new IntakeValidationError(
      `Active content is not allowed in ${field}`,
    );
  }
  return normalized;
}

function sanitizeDisplayName(value: string): string {
  const leaf = value.replaceAll("\\", "/").split("/").at(-1) ?? "document";
  const withoutControls = [...leaf.normalize("NFKC")]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("");
  const sanitized = withoutControls
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 180);
  return sanitized || "document";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEquivalentOptions(value: unknown): EquivalentOptionInput[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new IntakeValidationError("Invalid equivalent option catalog");
  }
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.code !== "string" ||
      typeof entry.label !== "string"
    ) {
      throw new IntakeValidationError("Invalid equivalent option");
    }
    return { code: entry.code, label: entry.label };
  });
}

function normalizeEquivalentOptions(
  allowsEquivalent: boolean,
  value: EquivalentOptionInput[] | null | undefined,
): EquivalentOptionInput[] | null {
  if (!allowsEquivalent) {
    if ((value?.length ?? 0) > 0) {
      throw new IntakeValidationError(
        "Equivalent options require allowsEquivalent",
      );
    }
    return null;
  }
  if (
    value === null ||
    value === undefined ||
    value.length === 0 ||
    value.length > 20
  ) {
    throw new IntakeValidationError(
      "A controlled equivalent option catalog is required",
    );
  }
  const seen = new Set<string>();
  return value.map((option) => {
    const code = safeText(option.code, "equivalent code", 80);
    const label = safeText(option.label, "equivalent label", 160);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(code) || seen.has(code)) {
      throw new IntakeValidationError("Invalid or duplicate equivalent code");
    }
    seen.add(code);
    return { code, label };
  });
}

function parseAllowedFileTypes(value: unknown): DocumentFileType[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new IntakeValidationError("At least one safe file type is required");
  }
  const types = value.filter(
    (item): item is DocumentFileType =>
      typeof item === "string" &&
      DOCUMENT_FILE_TYPES.includes(item as DocumentFileType),
  );
  if (types.length !== value.length || new Set(types).size !== types.length) {
    throw new IntakeValidationError("Invalid or duplicate safe file type");
  }
  return types;
}

function assertPermission(
  context: TenantExecutionContext,
  permission:
    | "application.assist"
    | "document.exempt"
    | "document.read"
    | "document.requirement.manage"
    | "document.requirement.publish"
    | "document.requirement.read"
    | "document.review"
    | "document.upload",
  sensitivity?: Sensitivity,
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
    ...(sensitivity === undefined ? {} : { sensitivity }),
  });
}

function assertFamilyPermission(
  context: FamilyExecutionContext,
  permission: "document.read" | "document.upload",
): void {
  authorizeOrThrow(context, { permission, purpose: context.purpose });
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    metadata?: Record<string, boolean | number | string>;
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
      ...(input.metadata === undefined
        ? {}
        : { metadata: asJson(input.metadata) }),
      occurredAt: new Date(),
      purpose: context.purpose,
      ...(input.resourceId === undefined
        ? {}
        : { resourceId: input.resourceId }),
      resourceType: input.resourceType,
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

function strictCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}

function validateConditionValue(
  field: {
    options: unknown;
    type: string;
    validationConfig: unknown;
  },
  value: unknown,
): asserts value is ConditionValue {
  if (field.type === "BOOLEAN") {
    if (typeof value !== "boolean")
      throw new IntakeValidationError("Invalid boolean condition operand");
    return;
  }
  if (typeof value !== "string")
    throw new IntakeValidationError("Invalid condition operand");
  if (field.type === "DATE" && !strictCalendarDate(value)) {
    throw new IntakeValidationError("Invalid date condition operand");
  }
  if (field.type === "SELECT" || field.type === "RADIO") {
    const options = Array.isArray(field.options) ? field.options : [];
    if (!options.some((entry) => isRecord(entry) && entry.value === value)) {
      throw new IntakeValidationError(
        "Condition operand is outside the form option catalog",
      );
    }
  }
  if (
    (field.type === "TEXT" || field.type === "TEXTAREA") &&
    isRecord(field.validationConfig)
  ) {
    const length = value.trim().length;
    const min = field.validationConfig.minLength;
    const max = field.validationConfig.maxLength;
    if (
      (typeof min === "number" && length < min) ||
      (typeof max === "number" && length > max)
    ) {
      throw new IntakeValidationError(
        "Condition operand violates source field validation",
      );
    }
  }
}

function validateCondition(
  field: RequirementVersionRecord["conditionField"],
  operator: ConditionOperator | null,
  value: unknown,
): void {
  if (field === null || operator === null) {
    throw new IntakeValidationError("Document condition is incomplete");
  }
  if (operator === "IN") {
    if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
      throw new IntakeValidationError(
        "IN requires a controlled non-empty operand list",
      );
    }
    for (const item of value) validateConditionValue(field, item);
    return;
  }
  if (Array.isArray(value))
    throw new IntakeValidationError("Condition requires one operand");
  validateConditionValue(field, value);
}

function conditionMatches(
  version: RequirementVersionRecord,
  answers: Map<string, ConditionValue>,
): boolean {
  if (version.conditionFieldId === null) return true;
  validateCondition(
    version.conditionField,
    version.conditionOperator,
    version.conditionValue,
  );
  const actual = answers.get(version.conditionFieldId);
  const expected = version.conditionValue;
  if (version.conditionOperator === "IN") {
    return (
      Array.isArray(expected) && expected.some((entry) => actual === entry)
    );
  }
  const matches = actual === expected;
  return version.conditionOperator === "EQUALS" ? matches : !matches;
}

function scopeMatches(
  version: RequirementVersionRecord,
  application: {
    academicYearId: string;
    formVersionId: string | null;
    offeringId: string;
    processId: string;
    offering: { courseLevelId: string };
  },
): boolean {
  return (
    (version.scopeAcademicYearId === null ||
      version.scopeAcademicYearId === application.academicYearId) &&
    (version.scopeProcessId === null ||
      version.scopeProcessId === application.processId) &&
    (version.scopeCourseLevelId === null ||
      version.scopeCourseLevelId === application.offering.courseLevelId) &&
    (version.scopeOfferingId === null ||
      version.scopeOfferingId === application.offeringId)
  );
}

export async function pinDocumentRequirements(
  transaction: Prisma.TransactionClient,
  input: {
    academicYearId: string;
    applicationId: string;
    formVersionId: string | null;
    offeringId: string;
    processId: string;
    courseLevelId: string;
    tenantId: string;
  },
  now = new Date(),
): Promise<number> {
  if (input.formVersionId === null) {
    throw new IntakeValidationError(
      "A published form version is required before document pinning",
    );
  }
  const versions = await transaction.documentRequirementVersion.findMany({
    include: requirementVersionInclude,
    where: { lifecycle: "PUBLISHED" },
  });
  const applicationShape = {
    academicYearId: input.academicYearId,
    formVersionId: input.formVersionId,
    offering: { courseLevelId: input.courseLevelId },
    offeringId: input.offeringId,
    processId: input.processId,
  };
  const scoped = versions.filter((version) =>
    scopeMatches(version, applicationShape),
  );
  for (const version of scoped) {
    if (
      version.conditionFormVersionId !== null &&
      version.conditionFormVersionId !== input.formVersionId
    ) {
      throw new IntakeValidationError(
        "Published document requirement is incompatible with the offering form version",
      );
    }
    await transaction.documentSubmission.create({
      data: {
        applicationId: input.applicationId,
        documentRequirementId: version.documentRequirementId,
        requirementVersionId: version.id,
        tenantId: input.tenantId,
      },
    });
  }
  await transaction.application.update({
    data: { documentRequirementsPinnedAt: now },
    where: { id: input.applicationId },
  });
  return scoped.length;
}

function mapRequirementVersion(version: RequirementVersionRecord) {
  return {
    allowedFileTypes: parseAllowedFileTypes(version.allowedFileTypes),
    allowsEquivalent: version.allowsEquivalent,
    archivedAt: version.archivedAt?.toISOString() ?? null,
    condition:
      version.conditionFormVersionId === null
        ? null
        : {
            fieldId: version.conditionFieldId!,
            formVersionId: version.conditionFormVersionId,
            operator: version.conditionOperator!,
            value: version.conditionValue as ConditionValue | ConditionValue[],
          },
    correctionWindowBusinessDays: version.correctionWindowBusinessDays,
    documentClassification:
      version.documentClassification as DocumentClassificationValue,
    equivalentOptions: parseEquivalentOptions(version.equivalentOptions),
    id: version.id,
    instruction: version.instruction,
    lifecycle: version.lifecycle,
    maxAgeDays: version.maxAgeDays,
    maxFileSizeBytes: Number(version.maxFileSizeBytes),
    processingCategory:
      (version.processingCategory as ProcessingCategoryValue | null) ?? null,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    required: version.required,
    scope: {
      academicYearId: version.scopeAcademicYearId,
      courseLevelId: version.scopeCourseLevelId,
      offeringId: version.scopeOfferingId,
      processId: version.scopeProcessId,
    },
    sensitivity: version.sensitivity as Sensitivity,
    validityRule: version.validityRule,
    versionNumber: version.versionNumber,
  };
}

function mapSubmission(
  submission: SubmissionRecord,
  applicable: boolean,
  now: Date,
) {
  const current = submission.currentDocumentVersion;
  return {
    applicable,
    correctionDueAt: submission.correctionDueAt?.toISOString() ?? null,
    correctionOverdue:
      submission.correctionDueAt !== null && now > submission.correctionDueAt,
    currentDocumentVersion:
      current === null
        ? null
        : {
            detectedMime: current.detectedMime,
            documentIssuedOn:
              current.documentIssuedOn?.toISOString().slice(0, 10) ?? null,
            equivalentOptionCode: current.equivalentOptionCode,
            id: current.id,
            origin: current.origin,
            sizeBytes: Number(current.sizeBytes),
            technicalStatus: current.technicalStatus,
            versionNumber: current.versionNumber,
          },
    history: submission.versions.map((version) => ({
      createdAt: version.createdAt.toISOString(),
      id: version.id,
      origin: version.origin,
      projectedStatus:
        version.replacedAt === null
          ? version.technicalStatus
          : ("REEMPLAZADO" as const),
      technicalStatus: version.technicalStatus,
      versionNumber: version.versionNumber,
    })),
    id: submission.id,
    requirement: {
      code: submission.requirement.code,
      id: submission.requirement.id,
      name: submission.requirement.name,
      purpose: submission.requirement.purpose,
      version: mapRequirementVersion(submission.requirementVersion),
    },
    reviews: submission.reviews.map((review) => ({
      correctionDueAt: review.correctionDueAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      id: review.id,
      reason: review.reason,
      verdict: review.verdict,
    })),
    status: submission.status,
  };
}

function assistedTechnicalStatus(status: string): string {
  if (["UPLOAD_PENDING", "QUARANTINED", "PROCESSING"].includes(status)) {
    return "PROCESSING";
  }
  if (status === "READY_FOR_REVIEW") return "READY";
  if (status.startsWith("BLOCKED_")) return "ACTION_REQUIRED";
  return status;
}

function mapAssistedSubmission(
  submission: SubmissionRecord,
  applicable: boolean,
  now: Date,
) {
  const current = submission.currentDocumentVersion;
  const version = submission.requirementVersion;
  const latestFamilyObservation = [...submission.reviews]
    .reverse()
    .find((review) => review.verdict === "OBSERVED");
  return {
    applicable,
    correctionDueAt: submission.correctionDueAt?.toISOString() ?? null,
    correctionOverdue:
      submission.correctionDueAt !== null && now > submission.correctionDueAt,
    currentDocumentVersion:
      current === null
        ? null
        : {
            documentIssuedOn:
              current.documentIssuedOn?.toISOString().slice(0, 10) ?? null,
            equivalentOptionCode: current.equivalentOptionCode,
            id: current.id,
            technicalStatus: assistedTechnicalStatus(current.technicalStatus),
            versionNumber: current.versionNumber,
          },
    history: [],
    id: submission.id,
    requirement: {
      code: submission.requirement.code,
      id: submission.requirement.id,
      name: submission.requirement.name,
      version: {
        allowedFileTypes: parseAllowedFileTypes(version.allowedFileTypes),
        allowsEquivalent: version.allowsEquivalent,
        equivalentOptions: parseEquivalentOptions(version.equivalentOptions),
        id: version.id,
        instruction: version.instruction,
        maxAgeDays: version.maxAgeDays,
        maxFileSizeBytes: Number(version.maxFileSizeBytes),
        required: version.required,
        validityRule: version.validityRule,
        versionNumber: version.versionNumber,
      },
    },
    reviews:
      latestFamilyObservation === undefined
        ? []
        : [
            {
              correctionDueAt:
                latestFamilyObservation.correctionDueAt?.toISOString() ?? null,
              reason: latestFamilyObservation.reason,
              verdict: latestFamilyObservation.verdict,
            },
          ],
    status: submission.status,
  };
}

function parsePersistedAnswers(
  answers: Array<{ fieldId: string; value: Prisma.JsonValue }>,
): Map<string, ConditionValue> {
  const result = new Map<string, ConditionValue>();
  for (const answer of answers) {
    if (typeof answer.value !== "string" && typeof answer.value !== "boolean") {
      throw new IntakeValidationError(
        "Persisted form answer has an invalid controlled type",
      );
    }
    result.set(answer.fieldId, answer.value);
  }
  return result;
}

function inspectFile(bytes: Uint8Array):
  | { detectedMime: string; errorCode?: never }
  | {
      detectedMime?: never;
      errorCode: "INVALID_FILE" | "PASSWORD_PROTECTED_PDF";
    } {
  if (
    bytes.length >= 5 &&
    new TextDecoder("latin1").decode(bytes.slice(0, 5)) === "%PDF-"
  ) {
    const text = new TextDecoder("latin1").decode(bytes);
    if (/\/Encrypt\b/.test(text))
      return { errorCode: "PASSWORD_PROTECTED_PDF" };
    if (!text.includes("%%EOF")) return { errorCode: "INVALID_FILE" };
    return { detectedMime: DOCUMENT_MIME_BY_TYPE.PDF };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= png.length &&
    png.every((value, index) => bytes[index] === value)
  ) {
    return { detectedMime: DOCUMENT_MIME_BY_TYPE.PNG };
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  ) {
    return { detectedMime: DOCUMENT_MIME_BY_TYPE.JPEG };
  }
  return { errorCode: "INVALID_FILE" };
}

export interface UploadDocumentInput {
  bytes: Uint8Array;
  declaredMime: string;
  documentIssuedOn?: string | null;
  equivalentOptionCode?: string | null;
  originalFilename: string;
  origin: "ASSISTED" | "PHYSICAL_DOCUMENT" | "SELF_SERVICE";
}

interface UploadActor {
  actorId: string;
  context: TenantExecutionContext;
  familyOwned: boolean;
}

export class DocumentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: ObjectStorage,
    private readonly scanner: MalwareScanner,
    private readonly hardMaxBytes = DEFAULT_DOCUMENT_UPLOAD_HARD_MAX_BYTES,
    private readonly calendar: BusinessCalendar = new DevelopmentBusinessCalendar(),
  ) {
    if (!Number.isInteger(hardMaxBytes) || hardMaxBytes < 1) {
      throw new TypeError(
        "Document upload hard cap must be a positive integer",
      );
    }
  }

  async listRequirements(context: TenantExecutionContext) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_READ);
    return withTenantTransaction(this.prisma, async (transaction) => ({
      items: await transaction.documentRequirement
        .findMany({
          include: {
            versions: {
              include: requirementVersionInclude,
              orderBy: { versionNumber: "desc" },
            },
          },
          orderBy: [{ name: "asc" }, { code: "asc" }],
        })
        .then((requirements) =>
          requirements.map((requirement) => ({
            code: requirement.code,
            id: requirement.id,
            name: requirement.name,
            purpose: requirement.purpose,
            versions: requirement.versions.map(mapRequirementVersion),
          })),
        ),
    }));
  }

  async createRequirement(
    context: TenantExecutionContext,
    input: { code: string; name: string; purpose: string },
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE);
    const code = safeText(input.code, "requirement code", 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(code)) {
      throw new IntakeValidationError("Invalid requirement code");
    }
    const name = safeText(input.name, "requirement name", 160);
    const purpose = safeText(input.purpose, "requirement purpose", 160);
    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        const requirement = await transaction.documentRequirement.create({
          data: { code, name, purpose, tenantId: context.tenantId },
        });
        await recordAudit(transaction, context, {
          action: "DOCUMENT_REQUIREMENT_CREATED",
          resourceId: requirement.id,
          resourceType: "DocumentRequirement",
        });
        return { code, id: requirement.id, name, purpose };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new IntakeDuplicateError();
      throw error;
    }
  }

  async createRequirementVersion(
    context: TenantExecutionContext,
    requirementId: string,
    input: DocumentRequirementVersionInput,
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE);
    const normalized = this.normalizeVersionInput(input);
    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM document_requirements
          WHERE tenant_id = ${context.tenantId}::uuid AND id = ${requirementId}::uuid
          FOR UPDATE
        `;
        if (locked.length !== 1) throw new IntakeNotFoundError();
        await this.validateVersionReferences(
          transaction,
          context.tenantId,
          normalized,
        );
        const latest = await transaction.documentRequirementVersion.aggregate({
          _max: { versionNumber: true },
          where: { documentRequirementId: requirementId },
        });
        const version = await transaction.documentRequirementVersion.create({
          data: this.versionCreateData(
            context.tenantId,
            requirementId,
            (latest._max.versionNumber ?? 0) + 1,
            normalized,
          ),
          include: requirementVersionInclude,
        });
        await recordAudit(transaction, context, {
          action: "DOCUMENT_REQUIREMENT_VERSION_CREATED",
          metadata: { versionNumber: version.versionNumber },
          resourceId: version.id,
          resourceType: "DocumentRequirementVersion",
        });
        return mapRequirementVersion(version);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new IntakeDuplicateError();
      throw error;
    }
  }

  async updateRequirementVersion(
    context: TenantExecutionContext,
    versionId: string,
    input: DocumentRequirementVersionInput,
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_MANAGE);
    const normalized = this.normalizeVersionInput(input);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.documentRequirementVersion.findFirst({
        where: { id: versionId, lifecycle: "DRAFT" },
      });
      if (existing === null) throw new IntakeNotFoundError();
      await this.validateVersionReferences(
        transaction,
        context.tenantId,
        normalized,
      );
      const version = await transaction.documentRequirementVersion.update({
        data: this.versionUpdateData(normalized),
        include: requirementVersionInclude,
        where: { id: versionId },
      });
      return mapRequirementVersion(version);
    });
  }

  async getRequirementVersion(
    context: TenantExecutionContext,
    versionId: string,
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.documentRequirementVersion.findFirst({
        include: requirementVersionInclude,
        where: { id: versionId },
      });
      if (version === null) throw new IntakeNotFoundError();
      return mapRequirementVersion(version);
    });
  }

  async publishRequirementVersion(
    context: TenantExecutionContext,
    versionId: string,
    now = new Date(),
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_PUBLISH);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.documentRequirementVersion.findFirst({
        include: requirementVersionInclude,
        where: { id: versionId, lifecycle: "DRAFT" },
      });
      if (version === null) throw new IntakeNotFoundError();
      await this.validatePersistedVersionForPublish(transaction, version);

      const policyRows = await transaction.sensitiveProcessingPolicy.findMany({
        where: { tenantId: context.tenantId },
      });
      const policies: SensitiveProcessingPolicyDto[] = policyRows.map(
        (row) => ({
          activatedAt: row.activatedAt?.toISOString() ?? null,
          activatedBy: row.activatedBy,
          category: row.category as ProcessingCategoryValue,
          enabled: row.enabled,
          id: row.id,
          purpose: row.purpose,
          tenantId: row.tenantId,
        }),
      );
      const personalityReportEnabled =
        await this.isPersonalityReportEnabledForVersionScope(
          transaction,
          context.tenantId,
          version,
        );
      try {
        assertDocumentRequirementProcessingAllowed(
          version.sensitivity,
          version.processingCategory as ProcessingCategoryValue | null,
          version.documentClassification as DocumentClassificationValue,
          policies,
          personalityReportEnabled,
        );
      } catch (cause) {
        if (cause instanceof SensitiveProcessingValidationError) {
          throw new IntakeValidationError(cause.message);
        }
        throw cause;
      }

      const current = await transaction.documentRequirementVersion.findFirst({
        where: {
          documentRequirementId: version.documentRequirementId,
          lifecycle: "PUBLISHED",
        },
      });
      if (current !== null) {
        await transaction.documentRequirementVersion.update({
          data: { archivedAt: now, lifecycle: "ARCHIVED" },
          where: { id: current.id },
        });
        await recordAudit(transaction, context, {
          action: "DOCUMENT_REQUIREMENT_VERSION_ARCHIVED",
          metadata: { versionNumber: current.versionNumber },
          resourceId: current.id,
          resourceType: "DocumentRequirementVersion",
        });
      }
      const published = await transaction.documentRequirementVersion.update({
        data: { lifecycle: "PUBLISHED", publishedAt: now },
        include: requirementVersionInclude,
        where: { id: version.id },
      });
      await recordAudit(transaction, context, {
        action: "DOCUMENT_REQUIREMENT_VERSION_PUBLISHED",
        metadata: { versionNumber: published.versionNumber },
        resourceId: published.id,
        resourceType: "DocumentRequirementVersion",
      });
      return mapRequirementVersion(published);
    });
  }

  async archiveRequirementVersion(
    context: TenantExecutionContext,
    versionId: string,
    now = new Date(),
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_REQUIREMENT_PUBLISH);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.documentRequirementVersion.findFirst({
        include: requirementVersionInclude,
        where: { id: versionId, lifecycle: "PUBLISHED" },
      });
      if (version === null) throw new IntakeNotFoundError();
      const archived = await transaction.documentRequirementVersion.update({
        data: { archivedAt: now, lifecycle: "ARCHIVED" },
        include: requirementVersionInclude,
        where: { id: versionId },
      });
      await recordAudit(transaction, context, {
        action: "DOCUMENT_REQUIREMENT_VERSION_ARCHIVED",
        metadata: { versionNumber: version.versionNumber },
        resourceId: versionId,
        resourceType: "DocumentRequirementVersion",
      });
      return mapRequirementVersion(archived);
    });
  }

  async listFamilyDocuments(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ) {
    assertFamilyPermission(familyContext, PERMISSIONS.DOCUMENT_READ);
    const profile = await this.ownedFamilyProfile(familyContext);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadOwnedApplication(
        transaction,
        profile.id,
        applicationId,
      );
      if (application === null) throw new IntakeNotFoundError();
      return this.projectApplicationDocuments(transaction, application, now);
    });
  }

  async listStaffDocuments(
    context: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadApplication(
        transaction,
        applicationId,
      );
      if (application === null) throw new IntakeNotFoundError();
      const authorizedSubmissions = application.documentSubmissions.filter(
        (submission) =>
          canAuthorizeDocumentResource(context, {
            application,
            permission: PERMISSIONS.DOCUMENT_READ,
            purpose: context.purpose,
            requirementVersion: submission.requirementVersion,
            sensitivity: submission.requirementVersion
              .sensitivity as Sensitivity,
          }),
      );
      return this.projectApplicationDocuments(
        transaction,
        application,
        now,
        authorizedSubmissions,
      );
    });
  }

  async listAssistedDocuments(
    context: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ) {
    assertPermission(context, PERMISSIONS.APPLICATION_ASSIST);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadApplication(
        transaction,
        applicationId,
      );
      if (application === null || application.origin !== "ASSISTED") {
        throw new IntakeNotFoundError();
      }
      const authorizedSubmissions = application.documentSubmissions.filter(
        (submission) =>
          canAuthorizeDocumentResource(context, {
            application,
            permission: PERMISSIONS.APPLICATION_ASSIST,
            purpose: context.purpose,
            requirementVersion: submission.requirementVersion,
            sensitivity: submission.requirementVersion
              .sensitivity as Sensitivity,
          }),
      );
      return this.projectAssistedApplicationDocuments(
        application,
        now,
        authorizedSubmissions,
      );
    });
  }

  async uploadFamilyDocument(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    submissionId: string,
    input: Omit<UploadDocumentInput, "origin">,
  ) {
    assertFamilyPermission(familyContext, PERMISSIONS.DOCUMENT_UPLOAD);
    const profile = await this.ownedFamilyProfile(familyContext);
    await withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadOwnedApplication(
        transaction,
        profile.id,
        applicationId,
      );
      if (application === null) throw new IntakeNotFoundError();
    });
    return this.uploadDocument(
      {
        actorId: familyContext.actorId,
        context: applicantContext,
        familyOwned: true,
      },
      applicationId,
      submissionId,
      { ...input, origin: "SELF_SERVICE" },
    );
  }

  async uploadStaffDocument(
    context: TenantExecutionContext,
    applicationId: string,
    submissionId: string,
    input: UploadDocumentInput,
  ) {
    assertPermission(context, PERMISSIONS.DOCUMENT_UPLOAD);
    if (input.origin === "ASSISTED") {
      assertPermission(context, PERMISSIONS.APPLICATION_ASSIST);
    }
    if (input.origin === "SELF_SERVICE") {
      throw new IntakeValidationError(
        "Staff upload requires assisted or physical origin",
      );
    }
    return this.uploadDocument(
      {
        actorId: context.effectiveActorId ?? context.actorId,
        context,
        familyOwned: false,
      },
      applicationId,
      submissionId,
      input,
    );
  }

  private async uploadDocument(
    actor: UploadActor,
    applicationId: string,
    submissionId: string,
    input: UploadDocumentInput,
  ) {
    assertPermission(actor.context, PERMISSIONS.DOCUMENT_UPLOAD);
    if (input.bytes.byteLength > this.hardMaxBytes) {
      throw new IntakeValidationError(
        "File exceeds the technical upload hard cap",
      );
    }
    const quarantineObjectKey = createOpaqueObjectKey();
    const approvedObjectKey = createOpaqueObjectKey();
    const prepared = await withTenantTransaction(
      this.prisma,
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM document_submissions
        WHERE tenant_id = ${actor.context.tenantId}::uuid
          AND id = ${submissionId}::uuid
          AND application_id = ${applicationId}::uuid
        FOR UPDATE
      `;
        if (locked.length !== 1) throw new IntakeNotFoundError();
        const submission = await transaction.documentSubmission.findFirst({
          include: submissionInclude,
          where: { applicationId, id: submissionId },
        });
        if (submission === null) throw new IntakeNotFoundError();
        if (!actor.familyOwned) {
          authorizeDocumentResource(actor.context, {
            application: submission.application,
            permission: PERMISSIONS.DOCUMENT_UPLOAD,
            purpose: actor.context.purpose,
            requirementVersion: submission.requirementVersion,
            sensitivity: submission.requirementVersion
              .sensitivity as Sensitivity,
          });
          if (input.origin === "ASSISTED") {
            authorizeDocumentResource(actor.context, {
              application: submission.application,
              permission: PERMISSIONS.APPLICATION_ASSIST,
              purpose: actor.context.purpose,
              requirementVersion: submission.requirementVersion,
              sensitivity: submission.requirementVersion
                .sensitivity as Sensitivity,
            });
          }
        }
        const active = submission.versions.some((version) =>
          ["PROCESSING", "QUARANTINED", "UPLOAD_PENDING"].includes(
            version.technicalStatus,
          ),
        );
        if (active)
          throw new IntakeDuplicateError("A document upload is already active");
        if (
          input.bytes.byteLength >
          Number(submission.requirementVersion.maxFileSizeBytes)
        ) {
          throw new IntakeValidationError(
            "File exceeds the requirement size limit",
          );
        }
        const fileTypes = parseAllowedFileTypes(
          submission.requirementVersion.allowedFileTypes,
        );
        if (
          !fileTypes.some(
            (type) => DOCUMENT_MIME_BY_TYPE[type] === input.declaredMime,
          )
        ) {
          throw new IntakeValidationError(
            "Declared MIME is not allowed for this requirement",
          );
        }
        const equivalentOptions = parseEquivalentOptions(
          submission.requirementVersion.equivalentOptions,
        );
        if (
          input.equivalentOptionCode !== null &&
          input.equivalentOptionCode !== undefined
        ) {
          if (
            !submission.requirementVersion.allowsEquivalent ||
            !equivalentOptions.some(
              (option) => option.code === input.equivalentOptionCode,
            )
          ) {
            throw new IntakeValidationError(
              "Equivalent option is not configured",
            );
          }
        }
        const issuedOn =
          input.documentIssuedOn === null ||
          input.documentIssuedOn === undefined
            ? null
            : strictCalendarDate(input.documentIssuedOn)
              ? new Date(`${input.documentIssuedOn}T00:00:00.000Z`)
              : (() => {
                  throw new IntakeValidationError(
                    "Invalid document issue date",
                  );
                })();
        const latest = submission.versions.at(-1);
        const version = await transaction.documentVersion.create({
          data: {
            approvedObjectKey,
            declaredMime: input.declaredMime,
            displayNameSanitized: sanitizeDisplayName(input.originalFilename),
            documentIssuedOn: issuedOn,
            documentSubmissionId: submission.id,
            ...(input.equivalentOptionCode === null ||
            input.equivalentOptionCode === undefined
              ? {}
              : { equivalentOptionCode: input.equivalentOptionCode }),
            origin: input.origin,
            quarantineObjectKey,
            ...(submission.currentDocumentVersionId === null
              ? {}
              : { replacesVersionId: submission.currentDocumentVersionId }),
            sizeBytes: input.bytes.byteLength,
            technicalStatus: "UPLOAD_PENDING",
            tenantId: actor.context.tenantId,
            uploadedBy: actor.actorId,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
          },
        });
        await recordAudit(transaction, actor.context, {
          action: "DOCUMENT_UPLOAD_PREPARED",
          metadata: {
            origin: input.origin,
            versionNumber: version.versionNumber,
          },
          resourceId: version.id,
          resourceType: "DocumentVersion",
        });
        return { id: version.id, versionNumber: version.versionNumber };
      },
    );

    try {
      await this.storage.putQuarantine({
        bytes: input.bytes,
        key: quarantineObjectKey,
      });
    } catch {
      await withTenantTransaction(this.prisma, (transaction) =>
        transaction.documentVersion.updateMany({
          data: {
            safeErrorCode: "STORAGE_WRITE_FAILED",
            technicalStatus: "UPLOAD_FAILED",
          },
          where: { id: prepared.id, technicalStatus: "UPLOAD_PENDING" },
        }),
      );
      throw new IntakeValidationError(
        "Document upload could not be stored safely",
      );
    }

    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        const completed = await transaction.documentVersion.update({
          data: { technicalStatus: "QUARANTINED" },
          where: { id: prepared.id },
        });
        await transaction.documentSubmission.update({
          data: { status: "CARGADO" },
          where: { id: submissionId },
        });
        await transaction.outboxMessage.upsert({
          create: {
            availableAt: new Date(),
            idempotencyKey: `document.process:${prepared.id}`,
            payload: asJson({
              correlationId: actor.context.correlationId,
              documentVersionId: prepared.id,
            }),
            tenantId: actor.context.tenantId,
            topic: DOCUMENT_PROCESS_TOPIC,
          },
          update: {},
          where: {
            tenantId_idempotencyKey: {
              idempotencyKey: `document.process:${prepared.id}`,
              tenantId: actor.context.tenantId,
            },
          },
        });
        await recordAudit(transaction, actor.context, {
          action:
            prepared.versionNumber > 1
              ? "DOCUMENT_REPLACEMENT_UPLOADED"
              : "DOCUMENT_UPLOAD_COMPLETED",
          metadata: {
            origin: input.origin,
            versionNumber: prepared.versionNumber,
          },
          resourceId: prepared.id,
          resourceType: "DocumentVersion",
        });
        if (input.origin !== "SELF_SERVICE") {
          await recordAudit(transaction, actor.context, {
            action:
              input.origin === "PHYSICAL_DOCUMENT"
                ? "PHYSICAL_DOCUMENT_DIGITIZED"
                : "ASSISTED_DOCUMENT_UPLOADED",
            metadata: { origin: input.origin },
            resourceId: prepared.id,
            resourceType: "DocumentVersion",
          });
        }
        return {
          documentVersionId: completed.id,
          functionalStatus: "CARGADO" as const,
          technicalStatus: "QUARANTINED" as const,
          versionNumber: prepared.versionNumber,
        };
      });
    } catch (error) {
      try {
        await this.storage.deleteQuarantine(quarantineObjectKey);
      } catch {
        // Orphan cleanup is deliberately best-effort and never presented as success.
      }
      throw error;
    }
  }

  async processDocument(
    context: TenantExecutionContext,
    documentVersionId: string,
  ) {
    if (
      context.source !== "trusted_job" ||
      context.contextOrigin !== "trusted_job"
    ) {
      throw new IntakeValidationError(
        "Trusted document worker context is required",
      );
    }
    const prepared = await withTenantTransaction(
      this.prisma,
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM document_versions
        WHERE tenant_id = ${context.tenantId}::uuid AND id = ${documentVersionId}::uuid
        FOR UPDATE
      `;
        if (locked.length !== 1) throw new IntakeNotFoundError();
        const version = await transaction.documentVersion.findFirst({
          include: { submission: { include: { requirementVersion: true } } },
          where: { id: documentVersionId },
        });
        if (version === null) throw new IntakeNotFoundError();
        if (
          version.technicalStatus === "READY_FOR_REVIEW" ||
          version.technicalStatus.startsWith("BLOCKED_")
        ) {
          return { terminal: true as const, version };
        }
        if (
          version.technicalStatus !== "QUARANTINED" &&
          version.technicalStatus !== "PROCESSING"
        ) {
          throw new IntakeValidationError(
            "Document version is not ready for processing",
          );
        }
        const processing = await transaction.documentVersion.update({
          data: { technicalStatus: "PROCESSING" },
          include: { submission: { include: { requirementVersion: true } } },
          where: { id: version.id },
        });
        return { terminal: false as const, version: processing };
      },
    );
    if (prepared.terminal) {
      return {
        documentVersionId,
        technicalStatus: prepared.version.technicalStatus,
      };
    }

    const version = prepared.version;
    let bytes: Uint8Array;
    try {
      bytes = await this.storage.readQuarantine(version.quarantineObjectKey);
    } catch {
      return this.blockDocument(
        context,
        version.id,
        "BLOCKED_INVALID",
        "ERROR",
        "QUARANTINE_OBJECT_MISSING",
      );
    }
    if (
      bytes.byteLength !== Number(version.sizeBytes) ||
      bytes.byteLength > this.hardMaxBytes ||
      bytes.byteLength >
        Number(version.submission.requirementVersion.maxFileSizeBytes)
    ) {
      return this.blockDocument(
        context,
        version.id,
        "BLOCKED_INVALID",
        "ERROR",
        "SIZE_INVALID",
      );
    }
    const inspection = inspectFile(bytes);
    if (inspection.detectedMime === undefined) {
      return this.blockDocument(
        context,
        version.id,
        "BLOCKED_INVALID",
        "ERROR",
        inspection.errorCode,
      );
    }
    const allowedTypes = parseAllowedFileTypes(
      version.submission.requirementVersion.allowedFileTypes,
    );
    const detectedAllowed = allowedTypes.some(
      (type) => DOCUMENT_MIME_BY_TYPE[type] === inspection.detectedMime,
    );
    if (!detectedAllowed || inspection.detectedMime !== version.declaredMime) {
      return this.blockDocument(
        context,
        version.id,
        "BLOCKED_INVALID",
        "ERROR",
        "MIME_SIGNATURE_MISMATCH",
        inspection.detectedMime,
      );
    }
    const scan = await this.scanner.scan(bytes);
    if (scan.status !== "CLEAN") {
      const status =
        scan.status === "INFECTED"
          ? "BLOCKED_INFECTED"
          : scan.status === "UNSCANNABLE"
            ? "BLOCKED_UNSCANNABLE"
            : "BLOCKED_SCAN_ERROR";
      return this.blockDocument(
        context,
        version.id,
        status,
        scan.status,
        `SCAN_${scan.status}`,
        inspection.detectedMime,
        scan,
      );
    }
    await this.storage.promote({
      approvedKey: version.approvedObjectKey!,
      quarantineKey: version.quarantineObjectKey,
    });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const readyAt = new Date();
    const result = await withTenantTransaction(
      this.prisma,
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM document_versions
        WHERE tenant_id = ${context.tenantId}::uuid AND id = ${documentVersionId}::uuid
        FOR UPDATE
      `;
        if (locked.length !== 1) throw new IntakeNotFoundError();
        const durable = await transaction.documentVersion.findFirst({
          where: { id: documentVersionId },
        });
        if (durable === null) throw new IntakeNotFoundError();
        if (
          durable.technicalStatus === "READY_FOR_REVIEW" ||
          durable.technicalStatus.startsWith("BLOCKED_")
        ) {
          return durable;
        }
        if (durable.technicalStatus !== "PROCESSING") {
          throw new IntakeValidationError(
            "Document processing state changed concurrently",
          );
        }
        const ready = await transaction.documentVersion.update({
          data: {
            detectedMime: inspection.detectedMime,
            readyAt,
            safeErrorCode: null,
            ...(scan.engineVersion === undefined
              ? {}
              : { scanEngineVersion: scan.engineVersion }),
            scanProvider: scan.provider,
            ...(scan.signatureVersion === undefined
              ? {}
              : { scanSignatureVersion: scan.signatureVersion }),
            scanStatus: "CLEAN",
            sha256,
            sizeBytes: bytes.byteLength,
            technicalStatus: "READY_FOR_REVIEW",
          },
          where: { id: durable.id },
        });
        const submission =
          await transaction.documentSubmission.findUniqueOrThrow({
            where: { id: ready.documentSubmissionId },
          });
        if (
          submission.currentDocumentVersionId !== null &&
          submission.currentDocumentVersionId !== ready.id
        ) {
          await transaction.documentVersion.update({
            data: { replacedAt: readyAt },
            where: { id: submission.currentDocumentVersionId },
          });
        }
        await transaction.documentSubmission.update({
          data: {
            correctionDueAt: null,
            currentDocumentVersionId: ready.id,
            status: "EN_REVISION",
          },
          where: { id: submission.id },
        });
        await recordAudit(transaction, context, {
          action: "DOCUMENT_SCAN_CLEAN",
          resourceId: ready.id,
          resourceType: "DocumentVersion",
        });
        await recordAudit(transaction, context, {
          action: "DOCUMENT_PROMOTED",
          resourceId: ready.id,
          resourceType: "DocumentVersion",
        });
        return ready;
      },
    );
    try {
      await this.storage.deleteQuarantine(version.quarantineObjectKey);
    } catch {
      // Approved state remains durable; quarantine orphan cleanup is deferred.
    }
    return {
      documentVersionId: result.id,
      technicalStatus: result.technicalStatus,
    };
  }

  private async blockDocument(
    context: TenantExecutionContext,
    documentVersionId: string,
    technicalStatus:
      | "BLOCKED_INFECTED"
      | "BLOCKED_INVALID"
      | "BLOCKED_SCAN_ERROR"
      | "BLOCKED_UNSCANNABLE",
    scanStatus: "ERROR" | "INFECTED" | "UNSCANNABLE",
    safeErrorCode: string,
    detectedMime?: string,
    scan?: {
      engineVersion?: string;
      provider: string;
      signatureVersion?: string;
    },
  ) {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM document_versions
        WHERE tenant_id = ${context.tenantId}::uuid AND id = ${documentVersionId}::uuid
        FOR UPDATE
      `;
      if (locked.length !== 1) throw new IntakeNotFoundError();
      const durable = await transaction.documentVersion.findFirst({
        where: { id: documentVersionId },
      });
      if (durable === null) throw new IntakeNotFoundError();
      if (
        durable.technicalStatus === "READY_FOR_REVIEW" ||
        durable.technicalStatus.startsWith("BLOCKED_")
      ) {
        return {
          documentVersionId: durable.id,
          technicalStatus: durable.technicalStatus,
        };
      }
      if (durable.technicalStatus !== "PROCESSING") {
        throw new IntakeValidationError(
          "Document processing state changed concurrently",
        );
      }
      const updated = await transaction.documentVersion.update({
        data: {
          ...(detectedMime === undefined ? {} : { detectedMime }),
          safeErrorCode,
          ...(scan === undefined
            ? {}
            : {
                scanEngineVersion: scan.engineVersion,
                scanProvider: scan.provider,
                scanSignatureVersion: scan.signatureVersion,
              }),
          scanStatus,
          technicalStatus,
        },
        where: { id: durable.id },
      });
      await recordAudit(transaction, context, {
        action: "DOCUMENT_SCAN_BLOCKED",
        metadata: { safeErrorCode, technicalStatus },
        resourceId: updated.id,
        resourceType: "DocumentVersion",
      });
      return { documentVersionId: updated.id, technicalStatus };
    });
  }

  async acceptDocument(
    context: TenantExecutionContext,
    submissionId: string,
    expectedDocumentVersionId: string,
  ) {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const submission = await this.lockSubmission(
        transaction,
        context,
        submissionId,
      );
      const current = submission.currentDocumentVersion;
      this.assertExpectedReviewVersion(submission, expectedDocumentVersionId);
      if (current === null || current.technicalStatus !== "READY_FOR_REVIEW") {
        throw new IntakeValidationError(
          "A ready current document version is required",
        );
      }
      authorizeDocumentResource(context, {
        application: submission.application,
        permission: PERMISSIONS.DOCUMENT_REVIEW,
        purpose: context.purpose,
        requirementVersion: submission.requirementVersion,
        sensitivity: submission.requirementVersion.sensitivity as Sensitivity,
      });
      await transaction.documentReview.create({
        data: {
          actorId: context.effectiveActorId ?? context.actorId,
          documentSubmissionId: submission.id,
          documentVersionId: current.id,
          tenantId: context.tenantId,
          verdict: "ACCEPTED",
        },
      });
      await transaction.documentSubmission.update({
        data: { correctionDueAt: null, status: "ACEPTADO" },
        where: { id: submission.id },
      });
      await recordAudit(transaction, context, {
        action: "DOCUMENT_ACCEPTED",
        resourceId: submission.id,
        resourceType: "DocumentSubmission",
      });
      return {
        documentVersionId: current.id,
        documentSubmissionId: submission.id,
        status: "ACEPTADO" as const,
      };
    });
  }

  async observeDocument(
    context: TenantExecutionContext,
    submissionId: string,
    expectedDocumentVersionId: string,
    reasonInput: string,
    now = new Date(),
  ) {
    const reason = safeText(
      reasonInput,
      "family-facing observation reason",
      1000,
    );
    return withTenantTransaction(this.prisma, async (transaction) => {
      const submission = await this.lockSubmission(
        transaction,
        context,
        submissionId,
      );
      const current = submission.currentDocumentVersion;
      this.assertExpectedReviewVersion(submission, expectedDocumentVersionId);
      if (current === null || current.technicalStatus !== "READY_FOR_REVIEW") {
        throw new IntakeValidationError(
          "A ready current document version is required",
        );
      }
      authorizeDocumentResource(context, {
        application: submission.application,
        permission: PERMISSIONS.DOCUMENT_REVIEW,
        purpose: context.purpose,
        requirementVersion: submission.requirementVersion,
        sensitivity: submission.requirementVersion.sensitivity as Sensitivity,
      });
      const correctionDueAt = this.calendar.addBusinessDays(
        now,
        submission.requirementVersion.correctionWindowBusinessDays,
      );
      await transaction.documentReview.create({
        data: {
          actorId: context.effectiveActorId ?? context.actorId,
          correctionDueAt,
          documentSubmissionId: submission.id,
          documentVersionId: current.id,
          reason,
          tenantId: context.tenantId,
          verdict: "OBSERVED",
        },
      });
      await transaction.documentSubmission.update({
        data: { correctionDueAt, status: "OBSERVADO" },
        where: { id: submission.id },
      });
      await recordAudit(transaction, context, {
        action: "DOCUMENT_OBSERVED",
        metadata: {
          correctionWindowBusinessDays:
            submission.requirementVersion.correctionWindowBusinessDays,
        },
        resourceId: submission.id,
        resourceType: "DocumentSubmission",
      });
      return {
        correctionDueAt: correctionDueAt.toISOString(),
        documentVersionId: current.id,
        documentSubmissionId: submission.id,
        status: "OBSERVADO" as const,
      };
    });
  }

  async exemptDocument(
    context: TenantExecutionContext,
    submissionId: string,
    reasonInput: string,
  ) {
    const reason = safeText(reasonInput, "exemption reason", 1000);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const submission = await this.lockSubmission(
        transaction,
        context,
        submissionId,
      );
      authorizeDocumentResource(context, {
        application: submission.application,
        permission: PERMISSIONS.DOCUMENT_EXEMPT,
        purpose: context.purpose,
        requirementVersion: submission.requirementVersion,
        sensitivity: submission.requirementVersion.sensitivity as Sensitivity,
      });
      if (
        submission.versions.some((version) =>
          ["UPLOAD_PENDING", "QUARANTINED", "PROCESSING"].includes(
            version.technicalStatus,
          ),
        )
      ) {
        throw new IntakeConflictError("DOCUMENT_PROCESSING_IN_PROGRESS");
      }
      await transaction.documentReview.create({
        data: {
          actorId: context.effectiveActorId ?? context.actorId,
          documentSubmissionId: submission.id,
          ...(submission.currentDocumentVersionId === null
            ? {}
            : { documentVersionId: submission.currentDocumentVersionId }),
          reason,
          tenantId: context.tenantId,
          verdict: "EXEMPTED",
        },
      });
      await transaction.documentSubmission.update({
        data: { correctionDueAt: null, status: "EXENTO" },
        where: { id: submission.id },
      });
      await recordAudit(transaction, context, {
        action: "DOCUMENT_EXEMPTED",
        resourceId: submission.id,
        resourceType: "DocumentSubmission",
      });
      return { documentSubmissionId: submission.id, status: "EXENTO" as const };
    });
  }

  async downloadFamilyDocument(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    documentVersionId: string,
  ) {
    assertFamilyPermission(familyContext, PERMISSIONS.DOCUMENT_READ);
    const profile = await this.ownedFamilyProfile(familyContext);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.documentVersion.findFirst({
        include: { submission: { include: { application: true } } },
        where: {
          id: documentVersionId,
          submission: {
            applicationId,
            application: { familyProfileId: profile.id },
          },
        },
      });
      if (version === null) throw new IntakeNotFoundError();
      return this.authorizeAndReadApproved(
        transaction,
        applicantContext,
        version,
      );
    });
  }

  async downloadStaffDocument(
    context: TenantExecutionContext,
    documentVersionId: string,
  ) {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.documentVersion.findFirst({
        include: {
          submission: {
            include: {
              application: { include: { offering: true } },
              requirementVersion: true,
            },
          },
        },
        where: { id: documentVersionId },
      });
      if (version === null) throw new IntakeNotFoundError();
      authorizeDocumentResource(context, {
        application: version.submission.application,
        permission: PERMISSIONS.DOCUMENT_READ,
        purpose: context.purpose,
        requirementVersion: version.submission.requirementVersion,
        sensitivity: version.submission.requirementVersion
          .sensitivity as Sensitivity,
      });
      return this.authorizeAndReadApproved(transaction, context, version);
    });
  }

  private async authorizeAndReadApproved(
    transaction: Prisma.TransactionClient,
    context: TenantExecutionContext,
    version: {
      approvedObjectKey: string | null;
      declaredMime: string;
      detectedMime: string | null;
      displayNameSanitized: string;
      id: string;
      technicalStatus: string;
    },
  ) {
    if (
      version.technicalStatus !== "READY_FOR_REVIEW" ||
      version.approvedObjectKey === null ||
      version.detectedMime === null
    ) {
      throw new IntakeNotFoundError();
    }
    const bytes = await this.storage.readApproved(version.approvedObjectKey);
    await recordAudit(transaction, context, {
      action: "DOCUMENT_DOWNLOADED",
      resourceId: version.id,
      resourceType: "DocumentVersion",
    });
    return {
      bytes,
      contentType: version.detectedMime,
      displayName: version.displayNameSanitized,
    };
  }

  private async lockSubmission(
    transaction: Prisma.TransactionClient,
    context: TenantExecutionContext,
    submissionId: string,
  ): Promise<SubmissionRecord> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM document_submissions
      WHERE tenant_id = ${context.tenantId}::uuid AND id = ${submissionId}::uuid
      FOR UPDATE
    `;
    if (locked.length !== 1) throw new IntakeNotFoundError();
    const submission = await transaction.documentSubmission.findFirst({
      include: submissionInclude,
      where: { id: submissionId },
    });
    if (submission === null) throw new IntakeNotFoundError();
    return submission;
  }

  private assertExpectedReviewVersion(
    submission: SubmissionRecord,
    expectedDocumentVersionId: string,
  ): void {
    const current = submission.currentDocumentVersion;
    if (
      current === null ||
      submission.currentDocumentVersionId !== expectedDocumentVersionId ||
      current.id !== expectedDocumentVersionId ||
      submission.versions.some(
        (version) =>
          version.versionNumber > current.versionNumber &&
          [
            "UPLOAD_PENDING",
            "QUARANTINED",
            "PROCESSING",
            "READY_FOR_REVIEW",
          ].includes(version.technicalStatus),
      )
    ) {
      throw new IntakeConflictError("DOCUMENT_VERSION_CHANGED");
    }
  }

  private async ownedFamilyProfile(context: FamilyExecutionContext) {
    const profile = await this.prisma.familyProfile.findUnique({
      select: { id: true },
      where: { userId: context.actorId },
    });
    if (profile === null) throw new IntakeNotFoundError();
    return profile;
  }

  private loadOwnedApplication(
    transaction: Prisma.TransactionClient,
    familyProfileId: string,
    applicationId: string,
  ) {
    return transaction.application.findFirst({
      include: {
        draftAnswers: true,
        offering: true,
        documentSubmissions: { include: submissionInclude },
      },
      where: { familyProfileId, id: applicationId },
    });
  }

  private loadApplication(
    transaction: Prisma.TransactionClient,
    applicationId: string,
  ) {
    return transaction.application.findFirst({
      include: {
        draftAnswers: true,
        offering: true,
        documentSubmissions: { include: submissionInclude },
      },
      where: { id: applicationId },
    });
  }

  private async projectApplicationDocuments(
    _transaction: Prisma.TransactionClient,
    application: NonNullable<
      Awaited<ReturnType<DocumentService["loadApplication"]>>
    >,
    now: Date,
    submissions = application.documentSubmissions,
  ) {
    if (application.documentRequirementsPinnedAt === null) {
      throw new IntakeValidationError(
        "Legacy development draft has no pinned document requirements and must be recreated",
      );
    }
    const answers = parsePersistedAnswers(application.draftAnswers);
    return {
      applicationId: application.id,
      items: submissions.map((submission) =>
        mapSubmission(
          submission,
          conditionMatches(submission.requirementVersion, answers),
          now,
        ),
      ),
      pinnedAt: application.documentRequirementsPinnedAt.toISOString(),
    };
  }

  private projectAssistedApplicationDocuments(
    application: NonNullable<
      Awaited<ReturnType<DocumentService["loadApplication"]>>
    >,
    now: Date,
    submissions: readonly SubmissionRecord[],
  ) {
    if (application.documentRequirementsPinnedAt === null) {
      throw new IntakeValidationError(
        "Legacy development draft has no pinned document requirements and must be recreated",
      );
    }
    const answers = parsePersistedAnswers(application.draftAnswers);
    return {
      applicationId: application.id,
      items: submissions.map((submission) =>
        mapAssistedSubmission(
          submission,
          conditionMatches(submission.requirementVersion, answers),
          now,
        ),
      ),
      pinnedAt: application.documentRequirementsPinnedAt.toISOString(),
    };
  }

  private normalizeVersionInput(input: DocumentRequirementVersionInput) {
    const allowedFileTypes = parseAllowedFileTypes(input.allowedFileTypes);
    if (
      !Number.isSafeInteger(input.maxFileSizeBytes) ||
      input.maxFileSizeBytes < 1 ||
      input.maxFileSizeBytes > this.hardMaxBytes
    ) {
      throw new IntakeValidationError(
        "Requirement file size must fit the technical hard cap",
      );
    }
    if (
      !Number.isInteger(input.correctionWindowBusinessDays) ||
      input.correctionWindowBusinessDays < 1
    ) {
      throw new IntakeValidationError("Invalid correction business-day window");
    }
    if (!Object.values(SENSITIVITIES).includes(input.sensitivity)) {
      throw new IntakeValidationError("Invalid document sensitivity");
    }
    const processingCategory =
      input.processingCategory === undefined ||
      input.processingCategory === null
        ? null
        : input.processingCategory;
    if (
      processingCategory !== null &&
      !Object.values(PROCESSING_CATEGORIES).includes(processingCategory)
    ) {
      throw new IntakeValidationError(
        "Invalid document requirement processing category",
      );
    }
    const documentClassification =
      input.documentClassification ?? DOCUMENT_CLASSIFICATIONS.GENERIC;
    if (
      !Object.values(DOCUMENT_CLASSIFICATIONS).includes(documentClassification)
    ) {
      throw new IntakeValidationError(
        "Invalid document requirement classification",
      );
    }
    if (
      (input.validityRule === "MAX_AGE_DAYS") !==
      (input.maxAgeDays !== null && input.maxAgeDays !== undefined)
    ) {
      throw new IntakeValidationError(
        "MAX_AGE_DAYS requires maxAgeDays exclusively",
      );
    }
    if (
      input.maxAgeDays !== null &&
      input.maxAgeDays !== undefined &&
      (!Number.isInteger(input.maxAgeDays) || input.maxAgeDays < 1)
    ) {
      throw new IntakeValidationError("Invalid maximum document age");
    }
    const equivalentOptions = normalizeEquivalentOptions(
      input.allowsEquivalent,
      input.equivalentOptions,
    );
    if (input.condition !== null && input.condition !== undefined) {
      if (
        input.scope?.offeringId === null ||
        input.scope?.offeringId === undefined
      ) {
        throw new IntakeValidationError(
          "A form condition requires offering scope",
        );
      }
      if (
        input.condition.operator === "IN"
          ? !Array.isArray(input.condition.value)
          : Array.isArray(input.condition.value)
      ) {
        throw new IntakeValidationError("Invalid controlled condition shape");
      }
    }
    return {
      ...input,
      allowedFileTypes,
      condition: input.condition ?? null,
      documentClassification,
      equivalentOptions,
      instruction:
        input.instruction === null || input.instruction === undefined
          ? null
          : safeText(input.instruction, "document instruction", 1000, true) ||
            null,
      maxAgeDays: input.maxAgeDays ?? null,
      processingCategory,
      scope: {
        academicYearId: input.scope?.academicYearId ?? null,
        courseLevelId: input.scope?.courseLevelId ?? null,
        offeringId: input.scope?.offeringId ?? null,
        processId: input.scope?.processId ?? null,
      },
    };
  }

  private versionCreateData(
    tenantId: string,
    requirementId: string,
    versionNumber: number,
    input: ReturnType<DocumentService["normalizeVersionInput"]>,
  ): Prisma.DocumentRequirementVersionUncheckedCreateInput {
    return {
      allowedFileTypes: asJson(input.allowedFileTypes),
      allowsEquivalent: input.allowsEquivalent,
      conditionFieldId: input.condition?.fieldId ?? null,
      conditionFormVersionId: input.condition?.formVersionId ?? null,
      conditionOperator: input.condition?.operator ?? null,
      conditionValue:
        input.condition === null
          ? Prisma.DbNull
          : asJson(input.condition.value),
      correctionWindowBusinessDays: input.correctionWindowBusinessDays,
      documentClassification: input.documentClassification,
      documentRequirementId: requirementId,
      equivalentOptions:
        input.equivalentOptions === null
          ? Prisma.DbNull
          : asJson(input.equivalentOptions),
      instruction: input.instruction,
      maxAgeDays: input.maxAgeDays,
      maxFileSizeBytes: input.maxFileSizeBytes,
      processingCategory: input.processingCategory,
      required: input.required,
      scopeAcademicYearId: input.scope.academicYearId,
      scopeCourseLevelId: input.scope.courseLevelId,
      scopeOfferingId: input.scope.offeringId,
      scopeProcessId: input.scope.processId,
      sensitivity: input.sensitivity,
      tenantId,
      validityRule: input.validityRule,
      versionNumber,
    };
  }

  private versionUpdateData(
    input: ReturnType<DocumentService["normalizeVersionInput"]>,
  ): Prisma.DocumentRequirementVersionUncheckedUpdateInput {
    const create = this.versionCreateData(
      "00000000-0000-4000-8000-000000000000",
      "00000000-0000-4000-8000-000000000000",
      1,
      input,
    );
    const {
      documentRequirementId: _,
      tenantId: __,
      versionNumber: ___,
      ...update
    } = create;
    return update;
  }

  private async validateVersionReferences(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    input: ReturnType<DocumentService["normalizeVersionInput"]>,
  ): Promise<void> {
    const [year, process, course, offering] = await Promise.all([
      input.scope.academicYearId === null
        ? null
        : transaction.academicYear.findFirst({
            where: { id: input.scope.academicYearId },
          }),
      input.scope.processId === null
        ? null
        : transaction.admissionProcess.findFirst({
            where: { id: input.scope.processId },
          }),
      input.scope.courseLevelId === null
        ? null
        : transaction.courseLevel.findFirst({
            where: { id: input.scope.courseLevelId },
          }),
      input.scope.offeringId === null
        ? null
        : transaction.admissionOffering.findFirst({
            where: { id: input.scope.offeringId },
          }),
    ]);
    if (
      (input.scope.academicYearId !== null && year === null) ||
      (input.scope.processId !== null && process === null) ||
      (input.scope.courseLevelId !== null && course === null) ||
      (input.scope.offeringId !== null && offering === null)
    ) {
      throw new IntakeValidationError("Document requirement scope is invalid");
    }
    if (
      (process !== null &&
        year !== null &&
        process.academicYearId !== year.id) ||
      (offering !== null &&
        ((year !== null && offering.academicYearId !== year.id) ||
          (process !== null && offering.processId !== process.id) ||
          (course !== null && offering.courseLevelId !== course.id)))
    ) {
      throw new IntakeValidationError(
        "Document requirement scopes are incoherent",
      );
    }
    if (input.condition !== null) {
      const version = await transaction.formVersion.findFirst({
        where: {
          id: input.condition.formVersionId,
          lifecycle: { in: ["ARCHIVED", "PUBLISHED"] },
        },
      });
      const field = await transaction.formField.findFirst({
        where: {
          formVersionId: input.condition.formVersionId,
          id: input.condition.fieldId,
        },
      });
      if (version === null || field === null) {
        throw new IntakeValidationError(
          "Document condition must reference a published form field",
        );
      }
      validateCondition(field, input.condition.operator, input.condition.value);
    }
    void tenantId;
  }

  private async isPersonalityReportEnabledForVersionScope(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    version: {
      scopeAcademicYearId: string | null;
      scopeCourseLevelId: string | null;
      scopeOfferingId: string | null;
      scopeProcessId: string | null;
    },
  ): Promise<boolean> {
    if (version.scopeOfferingId === null) return false;
    const existing = await transaction.documentRequirementVersion.findFirst({
      where: {
        documentClassification:
          DOCUMENT_CLASSIFICATIONS.PERSONALITY_DEVELOPMENT_REPORT,
        lifecycle: "PUBLISHED",
        scopeOfferingId: version.scopeOfferingId,
        tenantId,
      },
      take: 1,
    });
    return existing !== null;
  }

  private async validatePersistedVersionForPublish(
    transaction: Prisma.TransactionClient,
    version: RequirementVersionRecord,
  ): Promise<void> {
    parseAllowedFileTypes(version.allowedFileTypes);
    parseEquivalentOptions(version.equivalentOptions);
    if (Number(version.maxFileSizeBytes) > this.hardMaxBytes) {
      throw new IntakeValidationError(
        "Requirement exceeds the technical upload hard cap",
      );
    }
    if (version.conditionFieldId !== null) {
      validateCondition(
        version.conditionField,
        version.conditionOperator,
        version.conditionValue,
      );
      const form = await transaction.formVersion.findFirst({
        where: {
          id: version.conditionFormVersionId!,
          lifecycle: { in: ["ARCHIVED", "PUBLISHED"] },
        },
      });
      if (form === null)
        throw new IntakeValidationError(
          "Document condition form is not publishable",
        );
    }
  }
}

export async function evaluateDocumentSubmissionReadiness(
  transaction: Prisma.TransactionClient,
  input: {
    applicationId: string;
    formVersionId: string;
    now?: Date;
    tenantId: string;
  },
) {
  const application = await transaction.application.findFirst({
    include: {
      draftAnswers: true,
      documentSubmissions: { include: submissionInclude },
    },
    where: { id: input.applicationId },
  });
  if (application === null) throw new IntakeNotFoundError();
  if (
    application.tenantId !== input.tenantId ||
    application.formVersionId !== input.formVersionId ||
    application.documentRequirementsPinnedAt === null
  ) {
    throw new IntakeValidationError(
      "Application document requirements are not pinned consistently",
    );
  }
  const answers = parsePersistedAnswers(application.draftAnswers);
  const evidence: Array<Record<string, unknown>> = [];
  const blocking: string[] = [];
  const today = new Date(input.now ?? new Date());
  today.setUTCHours(0, 0, 0, 0);
  for (const submission of application.documentSubmissions) {
    if (
      submission.tenantId !== input.tenantId ||
      submission.applicationId !== application.id ||
      submission.requirementVersion.documentRequirementId !==
        submission.documentRequirementId
    ) {
      throw new IntakeValidationError("Document binding is inconsistent");
    }
    const applicable = conditionMatches(submission.requirementVersion, answers);
    const current = submission.currentDocumentVersion;
    const ready = current?.technicalStatus === "READY_FOR_REVIEW";
    const validitySatisfied =
      submission.requirementVersion.validityRule !== "MAX_AGE_DAYS" ||
      (current?.documentIssuedOn !== null &&
        current?.documentIssuedOn !== undefined &&
        submission.requirementVersion.maxAgeDays !== null &&
        current.documentIssuedOn <= today &&
        today.getTime() - current.documentIssuedOn.getTime() <=
          submission.requirementVersion.maxAgeDays * 86_400_000);
    if (applicable && submission.requirementVersion.required) {
      const satisfied =
        submission.status === "EXENTO" ||
        ((submission.status === "EN_REVISION" ||
          submission.status === "ACEPTADO") &&
          ready &&
          validitySatisfied);
      if (!satisfied) blocking.push(submission.id);
    }
    if (applicable) {
      evidence.push({
        detectedMime: current?.detectedMime ?? null,
        documentSubmissionId: submission.id,
        documentVersionId: current?.id ?? null,
        functionalStatus: submission.status,
        origin: current?.origin ?? null,
        requirementVersionId: submission.requirementVersionId,
        sha256: current?.sha256 ?? null,
        sizeBytes: current === null ? null : Number(current.sizeBytes),
      });
    }
  }
  if (blocking.length > 0) {
    throw new IntakeValidationError(
      "Required applicable documents are not ready for submission",
    );
  }
  return { evidence };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
