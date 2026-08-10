import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow } from "./authorization.js";
import { evaluateDocumentSubmissionReadiness } from "./documents.js";
import {
  isAdmissionOfferingCurrent,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./intake.js";
import {
  PERMISSIONS,
  SENSITIVITIES,
  type Sensitivity,
} from "./permission-catalog.js";
import type {
  FamilyExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const FORM_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "RADIO",
  "BOOLEAN",
  "DATE",
] as const;
export const FORM_CONDITION_OPERATORS = ["EQUALS", "NOT_EQUALS", "IN"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];
export type FormConditionOperator = (typeof FORM_CONDITION_OPERATORS)[number];
export type FormLifecycle = "ARCHIVED" | "DRAFT" | "PUBLISHED";
export type AnswerValue = boolean | string;

export interface FormOptionInput {
  label: string;
  order: number;
  value: string;
}

export interface FormConditionInput {
  fieldId: string;
  operator: FormConditionOperator;
  value: AnswerValue | AnswerValue[];
}

export interface FormFieldInput {
  condition?: FormConditionInput | null | undefined;
  helpText?: string | null | undefined;
  key: string;
  label: string;
  options?: FormOptionInput[] | null | undefined;
  order: number;
  purpose: string;
  required: boolean;
  sectionId: string;
  sensitivity: Sensitivity;
  type: FormFieldType;
  validation?:
    | { maxLength?: number | undefined; minLength?: number | undefined }
    | null
    | undefined;
}

export interface FormSectionInput {
  description?: string | null | undefined;
  order: number;
  title: string;
}

export interface FormFieldDto {
  condition: FormConditionInput | null;
  helpText: string | null;
  id: string;
  key: string;
  label: string;
  options: FormOptionInput[];
  order: number;
  purpose: string;
  required: boolean;
  sensitivity: Sensitivity;
  type: FormFieldType;
  validation: { maxLength?: number; minLength?: number } | null;
}

export interface FormSectionDto {
  description: string | null;
  fields: FormFieldDto[];
  id: string;
  order: number;
  title: string;
}

export interface FormVersionDto {
  archivedAt: string | null;
  formDefinitionId: string;
  id: string;
  lifecycle: FormLifecycle;
  publishedAt: string | null;
  sections: FormSectionDto[];
  versionNumber: number;
}

export interface FamilyFormDto {
  answers: Array<{ fieldId: string; value: AnswerValue }>;
  applicationId: string;
  form: FormVersionDto;
}

export interface ReviewDto {
  applicationId: string;
  missingRequired: Array<{ fieldId: string; label: string; sectionId: string }>;
  offering: {
    academicYear: string;
    campus: string;
    courseLevel: string;
    process: string;
    title: string;
  };
  sections: Array<{
    fields: Array<FormFieldDto & { applicable: boolean; value?: AnswerValue }>;
    id: string;
    title: string;
  }>;
  student: { familyName: string; givenName: string; id: string };
  warning: "Postular no garantiza vacante.";
}

const ACTIVE_CONTENT =
  /<\s*\/?\s*(script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i;
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const OPTION_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OPTIONS = 50;
const MAX_ANSWERS_PER_PATCH = 100;

function isStrictIsoCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1]!;
}

const versionInclude = {
  sections: {
    include: {
      fields: {
        orderBy: [{ order: "asc" as const }, { key: "asc" as const }],
      },
    },
    orderBy: [{ order: "asc" as const }, { title: "asc" as const }],
  },
} satisfies Prisma.FormVersionInclude;

type VersionWithContent = Prisma.FormVersionGetPayload<{
  include: typeof versionInclude;
}>;
type FieldRecord = VersionWithContent["sections"][number]["fields"][number];

function requireSafeText(
  value: string,
  field: string,
  maxLength: number,
  optional = false,
): string {
  const normalized = value.trim();
  if ((!optional && normalized.length === 0) || normalized.length > maxLength) {
    throw new IntakeValidationError(`Invalid ${field}`);
  }
  if (ACTIVE_CONTENT.test(normalized)) {
    throw new IntakeValidationError(
      `Active content is not allowed in ${field}`,
    );
  }
  return normalized;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptions(value: unknown): FormOptionInput[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value))
    throw new IntakeValidationError("Invalid field options");
  return value.map((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.value !== "string" ||
      typeof candidate.label !== "string" ||
      typeof candidate.order !== "number"
    ) {
      throw new IntakeValidationError("Invalid field option");
    }
    return {
      label: candidate.label,
      order: candidate.order,
      value: candidate.value,
    };
  });
}

function parseValidation(value: unknown): FormFieldDto["validation"] {
  if (value === null || value === undefined) return null;
  if (!isRecord(value))
    throw new IntakeValidationError("Invalid validation config");
  const minLength = value.minLength;
  const maxLength = value.maxLength;
  if (
    (minLength !== undefined &&
      (!Number.isInteger(minLength) || (minLength as number) < 0)) ||
    (maxLength !== undefined &&
      (!Number.isInteger(maxLength) || (maxLength as number) < 1))
  ) {
    throw new IntakeValidationError("Invalid validation config");
  }
  return {
    ...(maxLength === undefined ? {} : { maxLength: maxLength as number }),
    ...(minLength === undefined ? {} : { minLength: minLength as number }),
  };
}

function parseCondition(field: FieldRecord): FormConditionInput | null {
  if (
    field.conditionOperator === null ||
    field.conditionFieldId === null ||
    field.conditionValue === null
  ) {
    return null;
  }
  const value = field.conditionValue;
  if (
    typeof value !== "string" &&
    typeof value !== "boolean" &&
    !(
      Array.isArray(value) &&
      value.every(
        (item) => typeof item === "string" || typeof item === "boolean",
      )
    )
  ) {
    throw new IntakeValidationError("Invalid persisted form condition");
  }
  return {
    fieldId: field.conditionFieldId,
    operator: field.conditionOperator,
    value: value as AnswerValue | AnswerValue[],
  };
}

function mapField(field: FieldRecord): FormFieldDto {
  return {
    condition: parseCondition(field),
    helpText: field.helpText,
    id: field.id,
    key: field.key,
    label: field.label,
    options: parseOptions(field.options),
    order: field.order,
    purpose: field.purpose,
    required: field.required,
    sensitivity: field.sensitivity as Sensitivity,
    type: field.type,
    validation: parseValidation(field.validationConfig),
  };
}

function mapSection(section: {
  description: string | null;
  fields: FieldRecord[];
  id: string;
  order: number;
  title: string;
}): FormSectionDto {
  return {
    description: section.description,
    fields: section.fields.map(mapField),
    id: section.id,
    order: section.order,
    title: section.title,
  };
}

function mapVersion(version: VersionWithContent): FormVersionDto {
  return {
    archivedAt: version.archivedAt?.toISOString() ?? null,
    formDefinitionId: version.formDefinitionId,
    id: version.id,
    lifecycle: version.lifecycle,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    sections: version.sections.map(mapSection),
    versionNumber: version.versionNumber,
  };
}

function assertFormPermission(
  context: TenantExecutionContext,
  permission: "form.manage" | "form.publish" | "form.read",
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
  });
}

function assertApplicantPermission(
  context: TenantExecutionContext,
  permission: "application.read" | "application.submit" | "application.write",
): void {
  if (context.contextOrigin !== "family_application") {
    throw new IntakeValidationError("Applicant context is required");
  }
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
  });
}

function assertFamilyPermission(
  context: FamilyExecutionContext,
  permission: "application.read" | "application.submit" | "application.write",
): void {
  authorizeOrThrow(context, { permission, purpose: context.purpose });
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

function validateOptions(
  type: FormFieldType,
  options: FormOptionInput[] | null | undefined,
): FormOptionInput[] {
  const normalized = options ?? [];
  const needsOptions = type === "SELECT" || type === "RADIO";
  if (needsOptions !== normalized.length > 0) {
    throw new IntakeValidationError(
      needsOptions
        ? "SELECT and RADIO require options"
        : "This field type does not accept options",
    );
  }
  if (normalized.length > MAX_OPTIONS)
    throw new IntakeValidationError("Too many field options");
  const values = new Set<string>();
  const orders = new Set<number>();
  for (const option of normalized) {
    const value = requireSafeText(option.value, "option value", 80);
    const label = requireSafeText(option.label, "option label", 160);
    if (
      !OPTION_VALUE_PATTERN.test(value) ||
      !Number.isInteger(option.order) ||
      option.order < 1
    ) {
      throw new IntakeValidationError("Invalid field option");
    }
    if (values.has(value) || orders.has(option.order)) {
      throw new IntakeValidationError("Duplicate field option value or order");
    }
    values.add(value);
    orders.add(option.order);
    option.value = value;
    option.label = label;
  }
  return [...normalized].sort((a, b) => a.order - b.order);
}

function validateConditionShape(
  condition: FormConditionInput | null | undefined,
): FormConditionInput | null {
  if (condition === null || condition === undefined) return null;
  if (condition.operator === "IN") {
    if (
      !Array.isArray(condition.value) ||
      condition.value.length === 0 ||
      condition.value.length > MAX_OPTIONS
    ) {
      throw new IntakeValidationError(
        "IN condition requires a controlled non-empty value list",
      );
    }
  } else if (Array.isArray(condition.value)) {
    throw new IntakeValidationError("Condition requires one controlled value");
  }
  return condition;
}

function normalizeFieldInput(input: FormFieldInput): FormFieldInput {
  const key = requireSafeText(input.key, "field key", 80);
  if (!KEY_PATTERN.test(key))
    throw new IntakeValidationError("Invalid field key");
  if (!Number.isInteger(input.order) || input.order < 1)
    throw new IntakeValidationError("Invalid field order");
  const label = requireSafeText(input.label, "field label", 200);
  const helpText =
    input.helpText === null || input.helpText === undefined
      ? null
      : requireSafeText(input.helpText, "field help", 500, true) || null;
  const purpose = requireSafeText(input.purpose, "field purpose", 160);
  if (!Object.values(SENSITIVITIES).includes(input.sensitivity)) {
    throw new IntakeValidationError("Invalid field sensitivity");
  }
  const validation = input.validation ?? null;
  if (validation !== null) {
    if (input.type !== "TEXT" && input.type !== "TEXTAREA") {
      throw new IntakeValidationError(
        "Length validation is only allowed for text fields",
      );
    }
    if (
      validation.minLength !== undefined &&
      (!Number.isInteger(validation.minLength) || validation.minLength < 0)
    )
      throw new IntakeValidationError("Invalid minimum length");
    if (
      validation.maxLength !== undefined &&
      (!Number.isInteger(validation.maxLength) || validation.maxLength < 1)
    )
      throw new IntakeValidationError("Invalid maximum length");
    if (
      validation.minLength !== undefined &&
      validation.maxLength !== undefined &&
      validation.minLength > validation.maxLength
    )
      throw new IntakeValidationError("Minimum length exceeds maximum length");
  }
  return {
    ...input,
    condition: validateConditionShape(input.condition),
    helpText,
    key,
    label,
    options: validateOptions(input.type, input.options),
    purpose,
    validation,
  };
}

function answerIsMissing(value: AnswerValue | undefined): boolean {
  return (
    value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

function validateAnswer(field: FormFieldDto, value: unknown): AnswerValue {
  if (field.type === "BOOLEAN") {
    if (typeof value !== "boolean")
      throw new IntakeValidationError(`Invalid answer for ${field.key}`);
    return value;
  }
  if (typeof value !== "string")
    throw new IntakeValidationError(`Invalid answer for ${field.key}`);
  if (field.type === "DATE") {
    if (!isStrictIsoCalendarDate(value)) {
      throw new IntakeValidationError(`Invalid date answer for ${field.key}`);
    }
  }
  if (field.type === "SELECT" || field.type === "RADIO") {
    if (!field.options.some((option) => option.value === value)) {
      throw new IntakeValidationError(
        `Answer is outside the published option catalog for ${field.key}`,
      );
    }
  }
  if (field.type === "TEXT" || field.type === "TEXTAREA") {
    const length = value.trim().length;
    if (
      field.validation?.minLength !== undefined &&
      length < field.validation.minLength
    ) {
      throw new IntakeValidationError(`Answer is too short for ${field.key}`);
    }
    if (
      field.validation?.maxLength !== undefined &&
      length > field.validation.maxLength
    ) {
      throw new IntakeValidationError(`Answer is too long for ${field.key}`);
    }
  }
  return value;
}

function validateConditionAgainstSourceField(
  condition: FormConditionInput,
  sourceField: FormFieldDto,
): void {
  const normalized = validateConditionShape(condition)!;
  const values = Array.isArray(normalized.value)
    ? normalized.value
    : [normalized.value];
  if (normalized.operator === "IN") {
    if (!Array.isArray(normalized.value)) {
      throw new IntakeValidationError(
        "IN condition requires a controlled value list",
      );
    }
  } else if (Array.isArray(normalized.value)) {
    throw new IntakeValidationError("Condition requires one controlled value");
  }
  for (const value of values) validateAnswer(sourceField, value);
}

function equalValue(
  left: AnswerValue | undefined,
  right: AnswerValue,
): boolean {
  return left === right;
}

function calculateApplicability(
  form: FormVersionDto,
  answers: Map<string, AnswerValue>,
): Map<string, boolean> {
  const fields = new Map(
    form.sections
      .flatMap((section) => section.fields)
      .map((field) => [field.id, field]),
  );
  const result = new Map<string, boolean>();
  const visiting = new Set<string>();
  const visit = (field: FormFieldDto): boolean => {
    const existing = result.get(field.id);
    if (existing !== undefined) return existing;
    if (visiting.has(field.id))
      throw new IntakeValidationError("Form conditions contain a cycle");
    visiting.add(field.id);
    const condition = field.condition;
    let applicable = true;
    if (condition !== null) {
      const source = fields.get(condition.fieldId);
      if (source === undefined)
        throw new IntakeValidationError(
          "Condition field does not belong to this form version",
        );
      const sourceApplicable = visit(source);
      const sourceValue = answers.get(source.id);
      applicable =
        sourceApplicable &&
        (condition.operator === "EQUALS"
          ? !Array.isArray(condition.value) &&
            equalValue(sourceValue, condition.value)
          : condition.operator === "NOT_EQUALS"
            ? !Array.isArray(condition.value) &&
              !equalValue(sourceValue, condition.value)
            : Array.isArray(condition.value) &&
              condition.value.some((item) => equalValue(sourceValue, item)));
    }
    visiting.delete(field.id);
    result.set(field.id, applicable);
    return applicable;
  };
  for (const field of fields.values()) visit(field);
  return result;
}

function validatePublishedStructure(form: FormVersionDto): void {
  if (
    form.sections.length === 0 ||
    form.sections.every((section) => section.fields.length === 0)
  ) {
    throw new IntakeValidationError(
      "A published form requires at least one section and field",
    );
  }
  const fieldIds = new Set(
    form.sections.flatMap((section) => section.fields).map((field) => field.id),
  );
  const fieldsById = new Map(
    form.sections
      .flatMap((section) => section.fields)
      .map((field) => [field.id, field]),
  );
  const fieldPositions = new Map(
    form.sections
      .flatMap((section) => section.fields)
      .map((field, index) => [field.id, index]),
  );
  const keys = new Set<string>();
  for (const section of form.sections) {
    requireSafeText(section.title, "section title", 160);
    if (section.description !== null)
      requireSafeText(section.description, "section description", 500, true);
    for (const field of section.fields) {
      if (keys.has(field.key))
        throw new IntakeValidationError("Field keys must be unique");
      keys.add(field.key);
      requireSafeText(field.label, "field label", 200);
      requireSafeText(field.purpose, "field purpose", 160);
      validateOptions(field.type, field.options);
      if (field.condition !== null && !fieldIds.has(field.condition.fieldId)) {
        throw new IntakeValidationError(
          "Condition field does not belong to this form version",
        );
      }
      if (field.condition !== null) {
        validateConditionAgainstSourceField(
          field.condition,
          fieldsById.get(field.condition.fieldId)!,
        );
      }
      if (
        field.condition !== null &&
        (fieldPositions.get(field.condition.fieldId) ??
          Number.MAX_SAFE_INTEGER) >= (fieldPositions.get(field.id) ?? -1)
      ) {
        throw new IntakeValidationError(
          "A condition must depend on a previous field",
        );
      }
    }
  }
  calculateApplicability(form, new Map());
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export class FormService {
  constructor(private readonly prisma: PrismaClient) {}

  async listDefinitions(context: TenantExecutionContext) {
    assertFormPermission(context, PERMISSIONS.FORM_READ);
    return withTenantTransaction(this.prisma, async (transaction) =>
      transaction.formDefinition
        .findMany({
          include: { versions: { orderBy: { versionNumber: "desc" } } },
          orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        })
        .then((items) =>
          items.map((item) => ({
            id: item.id,
            name: item.name,
            purpose: item.purpose,
            versions: item.versions.map((version) => ({
              archivedAt: version.archivedAt?.toISOString() ?? null,
              id: version.id,
              lifecycle: version.lifecycle,
              publishedAt: version.publishedAt?.toISOString() ?? null,
              versionNumber: version.versionNumber,
            })),
          })),
        ),
    );
  }

  async createDefinition(
    context: TenantExecutionContext,
    input: { name: string; purpose: string },
  ) {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    const name = requireSafeText(input.name, "form name", 160);
    const purpose = requireSafeText(input.purpose, "form purpose", 120);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const definition = await transaction.formDefinition.create({
        data: { name, purpose, tenantId: context.tenantId },
      });
      await recordAudit(transaction, context, {
        action: "FORM_DEFINITION_CREATED",
        resourceId: definition.id,
        resourceType: "FormDefinition",
      });
      return {
        id: definition.id,
        name: definition.name,
        purpose: definition.purpose,
      };
    });
  }

  async createDraftVersion(
    context: TenantExecutionContext,
    formDefinitionId: string,
    sourceVersionId?: string,
  ): Promise<FormVersionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "form_definitions"
          WHERE "tenant_id" = ${context.tenantId}::uuid AND "id" = ${formDefinitionId}::uuid
          FOR UPDATE
        `;
        if (locked.length !== 1) throw new IntakeNotFoundError();
        const latest = await transaction.formVersion.aggregate({
          _max: { versionNumber: true },
          where: { formDefinitionId },
        });
        const version = await transaction.formVersion.create({
          data: {
            formDefinitionId,
            tenantId: context.tenantId,
            versionNumber: (latest._max.versionNumber ?? 0) + 1,
          },
        });

        if (sourceVersionId !== undefined) {
          const source = await transaction.formVersion.findFirst({
            include: versionInclude,
            where: {
              formDefinitionId,
              id: sourceVersionId,
              lifecycle: { in: ["PUBLISHED", "ARCHIVED"] },
            },
          });
          if (source === null) throw new IntakeNotFoundError();
          const sectionIds = new Map<string, string>();
          const fieldIds = new Map<string, string>();
          for (const section of source.sections) {
            const copy = await transaction.formSection.create({
              data: {
                description: section.description,
                formVersionId: version.id,
                order: section.order,
                tenantId: context.tenantId,
                title: section.title,
              },
            });
            sectionIds.set(section.id, copy.id);
          }
          for (const section of source.sections) {
            for (const field of section.fields) {
              const copy = await transaction.formField.create({
                data: {
                  formVersionId: version.id,
                  helpText: field.helpText,
                  key: field.key,
                  label: field.label,
                  options:
                    field.options === null
                      ? Prisma.JsonNull
                      : asJson(field.options),
                  order: field.order,
                  purpose: field.purpose,
                  required: field.required,
                  sectionId: sectionIds.get(section.id) as string,
                  sensitivity: field.sensitivity,
                  tenantId: context.tenantId,
                  type: field.type,
                  validationConfig:
                    field.validationConfig === null
                      ? Prisma.JsonNull
                      : asJson(field.validationConfig),
                },
              });
              fieldIds.set(field.id, copy.id);
            }
          }
          for (const section of source.sections) {
            for (const field of section.fields) {
              if (field.conditionFieldId !== null) {
                await transaction.formField.update({
                  data: {
                    conditionFieldId: fieldIds.get(
                      field.conditionFieldId,
                    ) as string,
                    conditionOperator: field.conditionOperator,
                    conditionValue: asJson(
                      field.conditionValue as AnswerValue | AnswerValue[],
                    ),
                  },
                  where: { id: fieldIds.get(field.id) as string },
                });
              }
            }
          }
        }

        await recordAudit(transaction, context, {
          action: "FORM_VERSION_CREATED",
          metadata: { versionNumber: version.versionNumber },
          resourceId: version.id,
          resourceType: "FormVersion",
        });
        const result = await transaction.formVersion.findUniqueOrThrow({
          include: versionInclude,
          where: { id: version.id },
        });
        return mapVersion(result);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new IntakeDuplicateError();
      throw error;
    }
  }

  async getVersion(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<FormVersionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.formVersion.findFirst({
        include: versionInclude,
        where: { id: versionId },
      });
      if (version === null) throw new IntakeNotFoundError();
      return mapVersion(version);
    });
  }

  async createSection(
    context: TenantExecutionContext,
    versionId: string,
    input: FormSectionInput,
  ): Promise<FormSectionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    const title = requireSafeText(input.title, "section title", 160);
    const description =
      input.description === undefined || input.description === null
        ? null
        : requireSafeText(
            input.description,
            "section description",
            500,
            true,
          ) || null;
    if (!Number.isInteger(input.order) || input.order < 1)
      throw new IntakeValidationError("Invalid section order");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.formVersion.findFirst({
        where: { id: versionId, lifecycle: "DRAFT" },
      });
      if (version === null) throw new IntakeNotFoundError();
      const section = await transaction.formSection.create({
        data: {
          description,
          formVersionId: versionId,
          order: input.order,
          tenantId: context.tenantId,
          title,
        },
      });
      await recordAudit(transaction, context, {
        action: "FORM_SECTION_CREATED",
        resourceId: section.id,
        resourceType: "FormSection",
      });
      return {
        description: section.description,
        fields: [],
        id: section.id,
        order: section.order,
        title: section.title,
      };
    });
  }

  async updateSection(
    context: TenantExecutionContext,
    sectionId: string,
    input: FormSectionInput,
  ): Promise<FormSectionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    const title = requireSafeText(input.title, "section title", 160);
    const description =
      input.description == null
        ? null
        : requireSafeText(
            input.description,
            "section description",
            500,
            true,
          ) || null;
    if (!Number.isInteger(input.order) || input.order < 1)
      throw new IntakeValidationError("Invalid section order");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const section = await transaction.formSection.findFirst({
        include: { fields: { orderBy: { order: "asc" } }, formVersion: true },
        where: { id: sectionId },
      });
      if (section === null || section.formVersion.lifecycle !== "DRAFT")
        throw new IntakeNotFoundError();
      const updated = await transaction.formSection.update({
        data: { description, order: input.order, title },
        include: { fields: { orderBy: { order: "asc" } } },
        where: { id: sectionId },
      });
      await recordAudit(transaction, context, {
        action: "FORM_SECTION_UPDATED",
        resourceId: updated.id,
        resourceType: "FormSection",
      });
      return {
        description: updated.description,
        fields: updated.fields.map(mapField),
        id: updated.id,
        order: updated.order,
        title: updated.title,
      };
    });
  }

  async moveSection(
    context: TenantExecutionContext,
    sectionId: string,
    direction: "UP" | "DOWN",
  ): Promise<FormSectionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const section = await transaction.formSection.findFirst({
        include: { fields: { orderBy: { order: "asc" } }, formVersion: true },
        where: { id: sectionId },
      });
      if (section === null || section.formVersion.lifecycle !== "DRAFT")
        throw new IntakeNotFoundError();
      const neighbor = await transaction.formSection.findFirst({
        orderBy: { order: direction === "UP" ? "desc" : "asc" },
        where: {
          formVersionId: section.formVersionId,
          order:
            direction === "UP" ? { lt: section.order } : { gt: section.order },
        },
      });
      if (neighbor === null) return mapSection(section);
      const temporaryOrder =
        (
          await transaction.formSection.aggregate({
            _max: { order: true },
            where: { formVersionId: section.formVersionId },
          })
        )._max.order! + 1;
      await transaction.formSection.update({
        data: { order: temporaryOrder },
        where: { id: section.id },
      });
      await transaction.formSection.update({
        data: { order: section.order },
        where: { id: neighbor.id },
      });
      const moved = await transaction.formSection.update({
        data: { order: neighbor.order },
        include: { fields: { orderBy: { order: "asc" } } },
        where: { id: section.id },
      });
      await recordAudit(transaction, context, {
        action: "FORM_SECTION_REORDERED",
        metadata: { direction },
        resourceId: moved.id,
        resourceType: "FormSection",
      });
      return mapSection(moved);
    });
  }

  async createField(
    context: TenantExecutionContext,
    versionId: string,
    input: FormFieldInput,
  ): Promise<FormFieldDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    const normalized = normalizeFieldInput(input);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const [version, section] = await Promise.all([
        transaction.formVersion.findFirst({
          where: { id: versionId, lifecycle: "DRAFT" },
        }),
        transaction.formSection.findFirst({
          where: { formVersionId: versionId, id: normalized.sectionId },
        }),
      ]);
      if (version === null || section === null) throw new IntakeNotFoundError();
      if (normalized.condition !== null && normalized.condition !== undefined) {
        const source = await transaction.formField.findFirst({
          where: { formVersionId: versionId, id: normalized.condition.fieldId },
        });
        if (source === null)
          throw new IntakeValidationError(
            "Condition field must belong to the same form version",
          );
        validateConditionAgainstSourceField(
          normalized.condition,
          mapField(source),
        );
      }
      const field = await transaction.formField.create({
        data: {
          conditionFieldId: normalized.condition?.fieldId ?? null,
          conditionOperator: normalized.condition?.operator ?? null,
          conditionValue:
            normalized.condition == null
              ? Prisma.DbNull
              : asJson(normalized.condition.value),
          formVersionId: versionId,
          helpText: normalized.helpText ?? null,
          key: normalized.key,
          label: normalized.label,
          options:
            normalized.options == null
              ? Prisma.JsonNull
              : asJson(normalized.options),
          order: normalized.order,
          purpose: normalized.purpose,
          required: normalized.required,
          sectionId: normalized.sectionId,
          sensitivity: normalized.sensitivity,
          tenantId: context.tenantId,
          type: normalized.type,
          validationConfig:
            normalized.validation == null
              ? Prisma.JsonNull
              : asJson(normalized.validation),
        },
      });
      await recordAudit(transaction, context, {
        action: "FORM_FIELD_CREATED",
        resourceId: field.id,
        resourceType: "FormField",
      });
      return mapField(field);
    });
  }

  async updateField(
    context: TenantExecutionContext,
    fieldId: string,
    input: FormFieldInput,
  ): Promise<FormFieldDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    const normalized = normalizeFieldInput(input);
    if (normalized.condition?.fieldId === fieldId)
      throw new IntakeValidationError("A field cannot depend on itself");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.formField.findFirst({
        include: { formVersion: true },
        where: { id: fieldId },
      });
      if (existing === null || existing.formVersion.lifecycle !== "DRAFT")
        throw new IntakeNotFoundError();
      const section = await transaction.formSection.findFirst({
        where: {
          formVersionId: existing.formVersionId,
          id: normalized.sectionId,
        },
      });
      if (section === null) throw new IntakeNotFoundError();
      if (normalized.condition !== null && normalized.condition !== undefined) {
        const source = await transaction.formField.findFirst({
          where: {
            formVersionId: existing.formVersionId,
            id: normalized.condition.fieldId,
          },
        });
        if (source === null)
          throw new IntakeValidationError(
            "Condition field must belong to the same form version",
          );
        validateConditionAgainstSourceField(
          normalized.condition,
          mapField(source),
        );
      }
      const field = await transaction.formField.update({
        data: {
          conditionFieldId: normalized.condition?.fieldId ?? null,
          conditionOperator: normalized.condition?.operator ?? null,
          conditionValue:
            normalized.condition == null
              ? Prisma.DbNull
              : asJson(normalized.condition.value),
          helpText: normalized.helpText ?? null,
          key: normalized.key,
          label: normalized.label,
          options:
            normalized.options == null
              ? Prisma.JsonNull
              : asJson(normalized.options),
          order: normalized.order,
          purpose: normalized.purpose,
          required: normalized.required,
          sectionId: normalized.sectionId,
          sensitivity: normalized.sensitivity,
          type: normalized.type,
          validationConfig:
            normalized.validation == null
              ? Prisma.JsonNull
              : asJson(normalized.validation),
        },
        where: { id: fieldId },
      });
      await recordAudit(transaction, context, {
        action: "FORM_FIELD_UPDATED",
        resourceId: field.id,
        resourceType: "FormField",
      });
      return mapField(field);
    });
  }

  async moveField(
    context: TenantExecutionContext,
    fieldId: string,
    direction: "UP" | "DOWN",
  ): Promise<FormFieldDto> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const field = await transaction.formField.findFirst({
        include: { formVersion: true },
        where: { id: fieldId },
      });
      if (field === null || field.formVersion.lifecycle !== "DRAFT")
        throw new IntakeNotFoundError();
      const neighbor = await transaction.formField.findFirst({
        orderBy: { order: direction === "UP" ? "desc" : "asc" },
        where: {
          formVersionId: field.formVersionId,
          sectionId: field.sectionId,
          order: direction === "UP" ? { lt: field.order } : { gt: field.order },
        },
      });
      if (neighbor === null) return mapField(field);
      const temporaryOrder =
        (
          await transaction.formField.aggregate({
            _max: { order: true },
            where: {
              formVersionId: field.formVersionId,
              sectionId: field.sectionId,
            },
          })
        )._max.order! + 1;
      await transaction.formField.update({
        data: { order: temporaryOrder },
        where: { id: field.id },
      });
      await transaction.formField.update({
        data: { order: field.order },
        where: { id: neighbor.id },
      });
      const moved = await transaction.formField.update({
        data: { order: neighbor.order },
        where: { id: field.id },
      });
      await recordAudit(transaction, context, {
        action: "FORM_FIELD_REORDERED",
        metadata: { direction },
        resourceId: moved.id,
        resourceType: "FormField",
      });
      return mapField(moved);
    });
  }

  async previewVersion(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<FormVersionDto & { preview: true }> {
    assertFormPermission(context, PERMISSIONS.FORM_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.formVersion.findFirst({
        include: versionInclude,
        where: { id: versionId, lifecycle: "DRAFT" },
      });
      if (version === null) throw new IntakeNotFoundError();
      return { ...mapVersion(version), preview: true as const };
    });
  }

  async publishVersion(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<FormVersionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_PUBLISH);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const version = await transaction.formVersion.findFirst({
        include: versionInclude,
        where: { id: versionId, lifecycle: "DRAFT" },
      });
      if (version === null) throw new IntakeNotFoundError();
      const mapped = mapVersion(version);
      validatePublishedStructure(mapped);
      const publishedAt = new Date();
      await transaction.formVersion.update({
        data: { lifecycle: "PUBLISHED", publishedAt },
        where: { id: versionId },
      });
      const fieldCount = mapped.sections.reduce(
        (total, section) => total + section.fields.length,
        0,
      );
      await recordAudit(transaction, context, {
        action: "FORM_VERSION_PUBLISHED",
        metadata: { fieldCount, versionNumber: version.versionNumber },
        resourceId: version.id,
        resourceType: "FormVersion",
      });
      return {
        ...mapped,
        lifecycle: "PUBLISHED",
        publishedAt: publishedAt.toISOString(),
      };
    });
  }

  async archiveVersion(
    context: TenantExecutionContext,
    versionId: string,
  ): Promise<FormVersionDto> {
    assertFormPermission(context, PERMISSIONS.FORM_PUBLISH);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.formVersion.findFirst({
        include: versionInclude,
        where: { id: versionId, lifecycle: "PUBLISHED" },
      });
      if (existing === null) throw new IntakeNotFoundError();
      const archivedAt = new Date();
      await transaction.formVersion.update({
        data: { archivedAt, lifecycle: "ARCHIVED" },
        where: { id: versionId },
      });
      await recordAudit(transaction, context, {
        action: "FORM_VERSION_ARCHIVED",
        metadata: { versionNumber: existing.versionNumber },
        resourceId: versionId,
        resourceType: "FormVersion",
      });
      return {
        ...mapVersion(existing),
        archivedAt: archivedAt.toISOString(),
        lifecycle: "ARCHIVED",
      };
    });
  }

  async assignOfferingVersion(
    context: TenantExecutionContext,
    offeringId: string,
    versionId: string,
  ): Promise<{ formVersionId: string; offeringId: string }> {
    assertFormPermission(context, PERMISSIONS.FORM_MANAGE);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const [offering, version] = await Promise.all([
        transaction.admissionOffering.findFirst({ where: { id: offeringId } }),
        transaction.formVersion.findFirst({
          where: { id: versionId, lifecycle: "PUBLISHED" },
        }),
      ]);
      if (offering === null || version === null)
        throw new IntakeValidationError(
          "Offering and published form version are required",
        );
      const incompatibleRequirements =
        await transaction.documentRequirementVersion.count({
          where: {
            conditionFormVersionId: { not: versionId },
            lifecycle: "PUBLISHED",
            scopeOfferingId: offeringId,
          },
        });
      if (incompatibleRequirements > 0) {
        throw new IntakeValidationError(
          "Published document requirements are incompatible with this form version",
        );
      }
      await transaction.admissionOffering.update({
        data: { formVersionId: versionId },
        where: { id: offeringId },
      });
      await recordAudit(transaction, context, {
        action: "OFFERING_FORM_VERSION_ASSIGNED",
        metadata: { formVersionId: versionId },
        resourceId: offeringId,
        resourceType: "AdmissionOffering",
      });
      return { formVersionId: versionId, offeringId };
    });
  }

  private async ownedFamilyProfile(
    context: FamilyExecutionContext,
  ): Promise<{ id: string }> {
    const profile = await this.prisma.familyProfile.findUnique({
      select: { id: true },
      where: { userId: context.actorId },
    });
    if (profile === null) throw new IntakeNotFoundError();
    return profile;
  }

  private async loadOwnedApplication(
    transaction: Prisma.TransactionClient,
    familyProfileId: string,
    applicationId: string,
  ) {
    return transaction.application.findFirst({
      include: {
        academicYear: true,
        draftAnswers: true,
        formVersion: { include: versionInclude },
        offering: {
          include: {
            academicYear: true,
            campus: true,
            courseLevel: true,
            process: true,
          },
        },
        student: true,
      },
      where: { familyProfileId, id: applicationId },
    });
  }

  async getFamilyForm(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
  ): Promise<FamilyFormDto> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_READ);
    assertApplicantPermission(applicantContext, PERMISSIONS.APPLICATION_READ);
    const profile = await this.ownedFamilyProfile(familyContext);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadOwnedApplication(
        transaction,
        profile.id,
        applicationId,
      );
      if (application === null) throw new IntakeNotFoundError();
      if (application.formVersion === null)
        throw new IntakeValidationError(
          "Legacy development draft has no form version and cannot continue",
        );
      return {
        answers: application.draftAnswers.map((answer) => ({
          fieldId: answer.fieldId,
          value: answer.value as AnswerValue,
        })),
        applicationId,
        form: mapVersion(application.formVersion),
      };
    });
  }

  async getAssistedForm(
    context: TenantExecutionContext,
    familyProfileId: string,
    assistanceSessionId: string,
    applicationId: string,
  ): Promise<FamilyFormDto> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.APPLICATION_ASSIST,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadOwnedApplication(
        transaction,
        familyProfileId,
        applicationId,
      );
      if (
        application === null ||
        application.status !== "DRAFT" ||
        application.assistanceSessionId !== assistanceSessionId
      ) {
        throw new IntakeNotFoundError();
      }
      if (application.formVersion === null) {
        throw new IntakeValidationError(
          "Assisted draft has no form version and cannot continue",
        );
      }
      return {
        answers: application.draftAnswers.map((answer) => ({
          fieldId: answer.fieldId,
          value: answer.value as AnswerValue,
        })),
        applicationId,
        form: mapVersion(application.formVersion),
      };
    });
  }

  async saveAnswers(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    input: Array<{ fieldId: string; value: unknown }>,
  ): Promise<FamilyFormDto> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_WRITE);
    assertApplicantPermission(applicantContext, PERMISSIONS.APPLICATION_WRITE);
    if (input.length === 0 || input.length > MAX_ANSWERS_PER_PATCH)
      throw new IntakeValidationError("Invalid answer patch size");
    const fieldIds = new Set(input.map((answer) => answer.fieldId));
    if (fieldIds.size !== input.length)
      throw new IntakeValidationError("Duplicate field answer in request");
    const profile = await this.ownedFamilyProfile(familyContext);
    return this.saveAnswersCore(
      applicantContext,
      profile.id,
      applicationId,
      input,
    );
  }

  async saveAssistedAnswers(
    context: TenantExecutionContext,
    familyProfileId: string,
    assistanceSessionId: string,
    applicationId: string,
    input: Array<{ fieldId: string; value: unknown }>,
  ): Promise<FamilyFormDto> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.APPLICATION_ASSIST,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    if (input.length === 0 || input.length > MAX_ANSWERS_PER_PATCH)
      throw new IntakeValidationError("Invalid answer patch size");
    const fieldIds = new Set(input.map((answer) => answer.fieldId));
    if (fieldIds.size !== input.length)
      throw new IntakeValidationError("Duplicate field answer in request");
    return this.saveAnswersCore(
      context,
      familyProfileId,
      applicationId,
      input,
      assistanceSessionId,
    );
  }

  private saveAnswersCore(
    applicantContext: TenantExecutionContext,
    familyProfileId: string,
    applicationId: string,
    input: Array<{ fieldId: string; value: unknown }>,
    assistanceSessionId?: string,
  ): Promise<FamilyFormDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadOwnedApplication(
        transaction,
        familyProfileId,
        applicationId,
      );
      if (application === null || application.status !== "DRAFT")
        throw new IntakeNotFoundError();
      if (
        assistanceSessionId !== undefined &&
        application.assistanceSessionId !== assistanceSessionId
      ) {
        throw new IntakeNotFoundError();
      }
      if (
        application.formVersion === null ||
        application.formVersionId === null
      ) {
        throw new IntakeValidationError(
          "Legacy development draft has no form version and cannot be submitted",
        );
      }
      const form = mapVersion(application.formVersion);
      const fields = new Map(
        form.sections
          .flatMap((section) => section.fields)
          .map((field) => [field.id, field]),
      );
      const normalized = input.map((answer) => {
        const field = fields.get(answer.fieldId);
        if (field === undefined)
          throw new IntakeValidationError(
            "Answer field does not belong to the pinned form version",
          );
        return {
          fieldId: answer.fieldId,
          value:
            answer.value === null ||
            (typeof answer.value === "string" && answer.value.trim() === "")
              ? null
              : validateAnswer(field, answer.value),
        };
      });
      for (const answer of normalized) {
        if (answer.value === null) {
          await transaction.applicationDraftAnswer.deleteMany({
            where: {
              applicationId,
              fieldId: answer.fieldId,
              tenantId: applicantContext.tenantId,
            },
          });
          continue;
        }
        await transaction.applicationDraftAnswer.upsert({
          create: {
            applicationId,
            fieldId: answer.fieldId,
            formVersionId: application.formVersionId,
            tenantId: applicantContext.tenantId,
            value: asJson(answer.value),
          },
          update: { value: asJson(answer.value) },
          where: {
            tenantId_applicationId_fieldId: {
              applicationId,
              fieldId: answer.fieldId,
              tenantId: applicantContext.tenantId,
            },
          },
        });
      }
      await recordAudit(transaction, applicantContext, {
        action:
          assistanceSessionId === undefined
            ? "APPLICATION_DRAFT_ANSWERS_SAVED"
            : "ASSISTED_FORM_ANSWERS_SAVED",
        metadata: {
          clearedCount: normalized.filter((answer) => answer.value === null)
            .length,
          fieldCount: normalized.length,
          ...(assistanceSessionId === undefined ? {} : { assistanceSessionId }),
        },
        resourceId: applicationId,
        resourceType: "Application",
      });
      const answers = await transaction.applicationDraftAnswer.findMany({
        where: { applicationId },
        orderBy: { createdAt: "asc" },
      });
      return {
        answers: answers.map((answer) => ({
          fieldId: answer.fieldId,
          value: answer.value as AnswerValue,
        })),
        applicationId,
        form,
      };
    });
  }

  private buildReview(
    application: NonNullable<
      Awaited<ReturnType<FormService["loadOwnedApplication"]>>
    >,
    validatedAnswers?: Map<string, AnswerValue>,
  ): ReviewDto {
    if (application.formVersion === null)
      throw new IntakeValidationError(
        "Legacy development draft has no form version and cannot be submitted",
      );
    const form = mapVersion(application.formVersion);
    const answers =
      validatedAnswers ??
      new Map(
        application.draftAnswers.map((answer) => [
          answer.fieldId,
          answer.value as AnswerValue,
        ]),
      );
    const applicability = calculateApplicability(form, answers);
    const missingRequired: ReviewDto["missingRequired"] = [];
    const sections = form.sections.map((section) => ({
      fields: section.fields.map((field) => {
        const applicable = applicability.get(field.id) ?? true;
        const value = answers.get(field.id);
        if (applicable && field.required && answerIsMissing(value)) {
          missingRequired.push({
            fieldId: field.id,
            label: field.label,
            sectionId: section.id,
          });
        }
        return {
          ...field,
          applicable,
          ...(applicable && value !== undefined ? { value } : {}),
        };
      }),
      id: section.id,
      title: section.title,
    }));
    return {
      applicationId: application.id,
      missingRequired,
      offering: {
        academicYear: application.offering.academicYear.label,
        campus: application.offering.campus.name,
        courseLevel: application.offering.courseLevel.name,
        process: application.offering.process.name,
        title: application.offering.title,
      },
      sections,
      student: {
        familyName: application.student.familyName,
        givenName: application.student.givenName,
        id: application.student.id,
      },
      warning: "Postular no garantiza vacante.",
    };
  }

  async getReview(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
  ): Promise<ReviewDto> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_READ);
    assertApplicantPermission(applicantContext, PERMISSIONS.APPLICATION_READ);
    const profile = await this.ownedFamilyProfile(familyContext);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await this.loadOwnedApplication(
        transaction,
        profile.id,
        applicationId,
      );
      if (application === null) throw new IntakeNotFoundError();
      return this.buildReview(application);
    });
  }

  async submitApplication(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ): Promise<{
    applicationId: string;
    snapshotId: string;
    status: "SUBMITTED";
    submittedAt: string;
  }> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_SUBMIT);
    assertApplicantPermission(applicantContext, PERMISSIONS.APPLICATION_SUBMIT);
    const profile = await this.ownedFamilyProfile(familyContext);
    return this.submitApplicationCore(
      {
        applicantContext,
        applicationId,
        familyProfileId: profile.id,
        submissionMode: "SELF_SERVICE",
        submittedBy: familyContext.effectiveActorId ?? familyContext.actorId,
      },
      now,
    );
  }

  async submitAssistedApplication(
    context: TenantExecutionContext,
    input: {
      applicationId: string;
      assistanceSessionId: string;
    },
    now = new Date(),
  ): Promise<{
    applicationId: string;
    snapshotId: string;
    status: "SUBMITTED";
    submittedAt: string;
  }> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.APPLICATION_ASSIST,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    return this.submitApplicationCore(
      {
        applicantContext: context,
        applicationId: input.applicationId,
        assistanceSessionId: input.assistanceSessionId,
        submissionMode: "ASSISTED",
      },
      now,
    );
  }

  private submitApplicationCore(
    input:
      | {
          applicantContext: TenantExecutionContext;
          applicationId: string;
          assistanceSessionId: string;
          submissionMode: "ASSISTED";
        }
      | {
          applicantContext: TenantExecutionContext;
          applicationId: string;
          familyProfileId: string;
          submissionMode: "SELF_SERVICE";
          submittedBy: string;
        },
    now: Date,
  ): Promise<{
    applicationId: string;
    snapshotId: string;
    status: "SUBMITTED";
    submittedAt: string;
  }> {
    const { applicantContext, applicationId } = input;
    return withTenantTransaction(this.prisma, async (transaction) => {
      let verifiedAssistanceSession:
        | NonNullable<
            Awaited<
              ReturnType<
                Prisma.TransactionClient["assistanceSession"]["findFirst"]
              >
            >
          >
        | undefined;
      if (input.submissionMode === "ASSISTED") {
        const sessionLock = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "assistance_sessions"
          WHERE "tenant_id" = ${applicantContext.tenantId}::uuid
            AND "id" = ${input.assistanceSessionId}::uuid
          FOR UPDATE
        `;
        if (sessionLock.length !== 1) throw new IntakeNotFoundError();
        const session = await transaction.assistanceSession.findFirst({
          where: { id: input.assistanceSessionId },
        });
        if (
          session === null ||
          session.tenantId !== applicantContext.tenantId ||
          session.status !== "ACTIVE" ||
          session.operatorUserId !==
            (applicantContext.effectiveActorId ?? applicantContext.actorId) ||
          !session.adultPresentConfirmed ||
          !session.authorizationConfirmed ||
          session.authorizationRecordedAt === null
        ) {
          throw new IntakeNotFoundError();
        }
        verifiedAssistanceSession = session;
      }

      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "applications"
        WHERE "tenant_id" = ${applicantContext.tenantId}::uuid AND "id" = ${applicationId}::uuid
        FOR UPDATE
      `;
      if (locked.length !== 1) throw new IntakeNotFoundError();
      const familyProfileId =
        verifiedAssistanceSession?.familyProfileId ??
        (input.submissionMode === "SELF_SERVICE"
          ? input.familyProfileId
          : (() => {
              throw new IntakeNotFoundError();
            })());
      const application = await this.loadOwnedApplication(
        transaction,
        familyProfileId,
        applicationId,
      );
      if (application === null) throw new IntakeNotFoundError();
      if (input.submissionMode === "ASSISTED") {
        if (
          verifiedAssistanceSession === undefined ||
          application.tenantId !== verifiedAssistanceSession.tenantId ||
          application.origin !== "ASSISTED" ||
          application.assistanceSessionId !== verifiedAssistanceSession.id ||
          application.familyProfileId !==
            verifiedAssistanceSession.familyProfileId
        ) {
          throw new IntakeNotFoundError();
        }
      }
      const profileSnapshot = await transaction.familyProfile.findUnique({
        where: { id: application.familyProfileId },
      });
      if (profileSnapshot === null) throw new IntakeNotFoundError();
      if (
        verifiedAssistanceSession !== undefined &&
        profileSnapshot.userId !==
          verifiedAssistanceSession.adultResponsibleUserId
      ) {
        throw new IntakeNotFoundError();
      }
      if (application.status === "SUBMITTED") {
        const snapshot = await transaction.applicationSnapshot.findUnique({
          where: { applicationId },
        });
        if (snapshot === null)
          throw new IntakeValidationError(
            "Submitted application snapshot is unavailable",
          );
        return {
          applicationId,
          snapshotId: snapshot.id,
          status: "SUBMITTED" as const,
          submittedAt: snapshot.submittedAt.toISOString(),
        };
      }
      if (
        application.formVersion === null ||
        application.formVersionId === null
      ) {
        throw new IntakeValidationError(
          "Legacy development draft has no form version and cannot be submitted",
        );
      }
      if (
        application.formVersion.lifecycle !== "PUBLISHED" &&
        application.formVersion.lifecycle !== "ARCHIVED"
      )
        throw new IntakeValidationError(
          "Pinned form version is not a valid historical version",
        );
      if (
        !isAdmissionOfferingCurrent(application.offering, now) ||
        application.offering.availabilityCategory === "PROCESS_CLOSED"
      )
        throw new IntakeValidationError(
          "Admission offering is no longer open for submission",
        );
      const form = mapVersion(application.formVersion);
      const fields = new Map(
        form.sections
          .flatMap((section) => section.fields)
          .map((field) => [field.id, field]),
      );
      const answerMap = new Map<string, AnswerValue>();
      for (const answer of application.draftAnswers) {
        const field = fields.get(answer.fieldId);
        if (
          answer.tenantId !== applicantContext.tenantId ||
          answer.applicationId !== application.id ||
          answer.formVersionId !== application.formVersionId ||
          field === undefined
        ) {
          throw new IntakeValidationError(
            "Persisted answer is inconsistent with the pinned form version",
          );
        }
        answerMap.set(answer.fieldId, validateAnswer(field, answer.value));
      }
      const review = this.buildReview(application, answerMap);
      if (review.missingRequired.length > 0)
        throw new IntakeValidationError(
          "Required applicable answers are missing",
        );
      const applicability = calculateApplicability(form, answerMap);
      const documentReadiness = await evaluateDocumentSubmissionReadiness(
        transaction,
        {
          applicationId,
          formVersionId: application.formVersionId,
          now,
          tenantId: applicantContext.tenantId,
        },
      );
      const submittedBy =
        verifiedAssistanceSession?.operatorUserId ??
        (input.submissionMode === "SELF_SERVICE"
          ? input.submittedBy
          : (() => {
              throw new IntakeNotFoundError();
            })());
      const payload = {
        applicationId,
        familyProfile: { displayName: profileSnapshot.displayName },
        form: {
          ...form,
          sections: form.sections.map((section) => ({
            ...section,
            fields: section.fields.map((field) => ({
              ...field,
              applicability:
                applicability.get(field.id) === false
                  ? "NOT_APPLICABLE"
                  : "APPLICABLE",
              ...(applicability.get(field.id) !== false &&
              answerMap.has(field.id)
                ? { value: answerMap.get(field.id) }
                : {}),
            })),
          })),
        },
        offering: {
          academicYear: {
            code: application.offering.academicYear.code,
            id: application.academicYearId,
            label: application.offering.academicYear.label,
          },
          campus: {
            id: application.offering.campus.id,
            name: application.offering.campus.name,
          },
          courseLevel: {
            id: application.offering.courseLevel.id,
            name: application.offering.courseLevel.name,
          },
          id: application.offering.id,
          process: {
            id: application.offering.process.id,
            name: application.offering.process.name,
          },
          title: application.offering.title,
        },
        documents: documentReadiness.evidence,
        schemaVersion: 2,
        ...(input.submissionMode === "ASSISTED"
          ? {
              adultResponsibleUserId:
                verifiedAssistanceSession!.adultResponsibleUserId,
              assistanceSessionId: verifiedAssistanceSession!.id,
              operatorUserId: verifiedAssistanceSession!.operatorUserId,
            }
          : {}),
        submissionMode: input.submissionMode,
        student: {
          familyName: application.student.familyName,
          givenName: application.student.givenName,
          id: application.student.id,
        },
        submittedAt: now.toISOString(),
        submittedBy,
        tenantId: applicantContext.tenantId,
      };
      const snapshot = await transaction.applicationSnapshot.create({
        data: {
          applicationId,
          formVersionId: application.formVersionId,
          payload: asJson(payload),
          schemaVersion: 2,
          submittedAt: now,
          submittedBy,
          tenantId: applicantContext.tenantId,
        },
      });
      await transaction.application.update({
        data: { status: "SUBMITTED", submittedAt: now },
        where: { id: applicationId },
      });
      await recordAudit(transaction, applicantContext, {
        action: "APPLICATION_SUBMITTED",
        metadata: {
          fieldCount: form.sections.reduce(
            (sum, section) => sum + section.fields.length,
            0,
          ),
          versionNumber: form.versionNumber,
        },
        resourceId: applicationId,
        resourceType: "Application",
      });
      if (input.submissionMode === "ASSISTED") {
        await recordAudit(transaction, applicantContext, {
          action: "ASSISTED_SUBMISSION_CONFIRMED",
          metadata: {
            assistanceSessionId: verifiedAssistanceSession!.id,
          },
          resourceId: applicationId,
          resourceType: "Application",
        });
      }
      return {
        applicationId,
        snapshotId: snapshot.id,
        status: "SUBMITTED" as const,
        submittedAt: now.toISOString(),
      };
    });
  }
}
