import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow } from "./authorization.js";
import {
  IntakeConflictError,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./domain-errors.js";
import { pinDocumentRequirements } from "./documents.js";
import { PERMISSIONS } from "./permission-catalog.js";
import type {
  FamilyExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
import { runWithTenantContext } from "./tenant-execution-context.js";
import {
  withPlatformAuditTransaction,
  withTenantTransaction,
} from "./tenant-transaction.js";

export const AVAILABILITY_LABELS = {
  LIMITED_CAPACITY: "Cupos limitados",
  POSTULATIONS_OPEN: "Postulaciones abiertas",
  PROCESS_CLOSED: "Proceso cerrado",
  WAITLIST: "Lista de espera",
} as const;

export type AvailabilityCategory = keyof typeof AVAILABILITY_LABELS;
export type DraftStep = "CONTEXT" | "STUDENT_DETAILS" | "REVIEW";

export interface DraftData {
  acknowledgedNoGuarantee: boolean;
  currentStep: DraftStep;
}

export interface CampusInput {
  code: string;
  name: string;
}

export interface AcademicYearInput {
  code: string;
  label: string;
  status?: "DRAFT" | "OPEN" | "CLOSED" | undefined;
}

export interface CourseLevelInput {
  code: string;
  name: string;
}

export interface AdmissionProcessInput {
  academicYearId: string;
  code: string;
  name: string;
  status?: "DRAFT" | "PUBLISHED" | "CLOSED" | undefined;
  opensAt?: Date | undefined;
  closesAt?: Date | undefined;
}

export interface AdmissionOfferingInput {
  academicYearId: string;
  campusId: string;
  code: string;
  courseLevelId: string;
  availabilityCategory: AvailabilityCategory;
  processId: string;
  status?: "DRAFT" | "PUBLISHED" | "CLOSED" | undefined;
  title: string;
}

export interface StudentInput {
  dateOfBirth?: string | undefined;
  familyName: string;
  givenName: string;
}

export interface DraftPatch {
  acknowledgedNoGuarantee: boolean;
  currentStep: DraftStep;
}

export interface CampusDto {
  code: string;
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface AcademicYearDto {
  code: string;
  id: string;
  label: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
}

export interface CourseLevelDto {
  code: string;
  id: string;
  name: string;
}

export interface ProcessDto {
  academicYearId: string;
  code: string;
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
}

export interface OfferingDto {
  academicYear: string;
  availabilityCategory: AvailabilityCategory;
  availabilityLabel: string;
  campus: string;
  code: string;
  concurrencyVersion: number;
  courseLevel: string;
  id: string;
  process: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  title: string;
}

export interface OfferingLifecycleCommandInput {
  expectedOfferingVersion: number;
}

export type OfferingCapacityState =
  | "CAPACITY_NOT_CONFIGURED"
  | "CAPACITY_CONFIGURED_ZERO"
  | "CAPACITY_CONFIGURED_POSITIVE";

export interface OfferingReadinessDto {
  blockers: Array<"CAPACITY_CONFIGURATION_REQUIRED">;
  capacityState: OfferingCapacityState;
  capacityVersion: number | null;
  lifecycle: "DRAFT" | "PUBLISHED" | "CLOSED";
  offeringId: string;
  offeringVersion: number;
  publishable: boolean;
}

export interface StudentDto {
  dateOfBirth: string | null;
  familyName: string;
  givenName: string;
  id: string;
}

export interface ConfigurationDto {
  academicYears: AcademicYearDto[];
  campuses: CampusDto[];
  courseLevels: CourseLevelDto[];
  offerings: OfferingDto[];
  processes: ProcessDto[];
}

export interface ApplicationDto {
  createdAt: string;
  draft: DraftData;
  formVersionId: string | null;
  id: string;
  offering: OfferingDto;
  status: "DRAFT" | "SUBMITTED" | "WITHDRAWN";
  student: StudentDto;
  submittedAt: string | null;
  updatedAt: string;
}

export {
  IntakeConflictError,
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
  type IntakeConflictCode,
} from "./domain-errors.js";

export interface AdmissionOfferingValidityCandidate {
  academicYear: { status: "DRAFT" | "OPEN" | "CLOSED" };
  process: {
    closesAt: Date | null;
    opensAt: Date | null;
    status: "DRAFT" | "PUBLISHED" | "CLOSED";
  };
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
}

/**
 * Defines structural offering validity for discovery and new applications.
 * opensAt is inclusive and closesAt is exclusive.
 */
export function isAdmissionOfferingCurrent(
  offering: AdmissionOfferingValidityCandidate,
  now = new Date(),
): boolean {
  return (
    offering.status === "PUBLISHED" &&
    offering.process.status === "PUBLISHED" &&
    offering.academicYear.status === "OPEN" &&
    (offering.process.opensAt === null || offering.process.opensAt <= now) &&
    (offering.process.closesAt === null || offering.process.closesAt > now)
  );
}

const offeringProjection = {
  academicYear: { select: { label: true, status: true } },
  campus: { select: { name: true } },
  courseLevel: { select: { name: true } },
  process: {
    select: { closesAt: true, name: true, opensAt: true, status: true },
  },
} as const;

const publicOfferingProjection = {
  ...offeringProjection,
  formVersion: { select: { lifecycle: true } },
} as const;

type OfferingWithProjection = Prisma.AdmissionOfferingGetPayload<{
  include: typeof offeringProjection;
}>;

const applicationProjection = {
  offering: { include: offeringProjection },
  student: {
    select: { dateOfBirth: true, familyName: true, givenName: true, id: true },
  },
} as const;

type ApplicationWithProjection = Prisma.ApplicationGetPayload<{
  include: typeof applicationProjection;
}>;

function requireText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized === "" || normalized.length > maxLength) {
    throw new IntakeValidationError(`Invalid ${field}`);
  }
  return normalized;
}

function validateAdmissionProcessWindow(
  opensAt: Date | undefined,
  closesAt: Date | undefined,
): void {
  if (opensAt !== undefined && closesAt !== undefined && opensAt >= closesAt) {
    throw new IntakeValidationError(
      "Admission process opensAt must be before closesAt",
    );
  }
}

function toDraftData(value: unknown): DraftData {
  if (typeof value !== "object" || value === null) {
    throw new IntakeValidationError("Invalid draft data");
  }
  const candidate = value as Record<string, unknown>;
  const currentStep = candidate.currentStep;
  if (
    currentStep !== "CONTEXT" &&
    currentStep !== "STUDENT_DETAILS" &&
    currentStep !== "REVIEW"
  ) {
    throw new IntakeValidationError("Invalid draft step");
  }
  if (typeof candidate.acknowledgedNoGuarantee !== "boolean") {
    throw new IntakeValidationError("Invalid draft acknowledgement");
  }
  return {
    acknowledgedNoGuarantee: candidate.acknowledgedNoGuarantee,
    currentStep,
  };
}

function mapOffering(offering: OfferingWithProjection): OfferingDto {
  const availabilityCategory =
    offering.availabilityCategory as AvailabilityCategory;
  return {
    academicYear: offering.academicYear.label,
    availabilityCategory,
    availabilityLabel: AVAILABILITY_LABELS[availabilityCategory],
    campus: offering.campus.name,
    code: offering.code,
    concurrencyVersion: offering.concurrencyVersion,
    courseLevel: offering.courseLevel.name,
    id: offering.id,
    process: offering.process.name,
    status: offering.status,
    title: offering.title,
  };
}

function mapStudent(student: {
  dateOfBirth: Date | null;
  familyName: string;
  givenName: string;
  id: string;
}): StudentDto {
  return {
    dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    familyName: student.familyName,
    givenName: student.givenName,
    id: student.id,
  };
}

function parseDateOfBirth(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) throw new IntakeValidationError("Invalid dateOfBirth");
  const candidate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    candidate.getUTCFullYear() !== Number(match[1]) ||
    candidate.getUTCMonth() !== Number(match[2]) - 1 ||
    candidate.getUTCDate() !== Number(match[3])
  ) {
    throw new IntakeValidationError("Invalid dateOfBirth");
  }
  return candidate;
}

function mapCampus(campus: {
  code: string;
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
}): CampusDto {
  return {
    code: campus.code,
    id: campus.id,
    name: campus.name,
    status: campus.status,
  };
}

function mapAcademicYear(year: {
  code: string;
  id: string;
  label: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
}): AcademicYearDto {
  return {
    code: year.code,
    id: year.id,
    label: year.label,
    status: year.status,
  };
}

function mapCourseLevel(level: {
  code: string;
  id: string;
  name: string;
}): CourseLevelDto {
  return { code: level.code, id: level.id, name: level.name };
}

function mapProcess(process: {
  academicYearId: string;
  code: string;
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
}): ProcessDto {
  return {
    academicYearId: process.academicYearId,
    code: process.code,
    id: process.id,
    name: process.name,
    status: process.status,
  };
}

function mapApplication(
  application: ApplicationWithProjection,
): ApplicationDto {
  return {
    createdAt: application.createdAt.toISOString(),
    draft: toDraftData(application.draftData),
    formVersionId: application.formVersionId,
    id: application.id,
    offering: mapOffering(application.offering),
    status: application.status,
    student: mapStudent(application.student),
    submittedAt: application.submittedAt?.toISOString() ?? null,
    updatedAt: application.updatedAt.toISOString(),
  };
}

function assertConfigPermission(
  context: TenantExecutionContext,
  permission:
    | "admission.config.manage"
    | "admission.config.read" = "admission.config.manage",
): void {
  authorizeOrThrow(context, {
    permission,
    resourceTenantId: context.tenantId,
    purpose: context.purpose,
  });
}

function assertFamilyPermission(
  context: FamilyExecutionContext,
  permission:
    | "application.create"
    | "application.read"
    | "application.write"
    | "family.profile.read"
    | "family.profile.write"
    | "student.read"
    | "student.write",
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
  });
}

function assertAdmissionPermission(
  context: TenantExecutionContext,
  permission:
    | "application.create"
    | "application.read"
    | "application.write"
    | "offering.public.read",
): void {
  authorizeOrThrow(context, {
    permission,
    resourceTenantId: context.tenantId,
    purpose: context.purpose,
  });
}

function assertPublicAdmissionContext(context: TenantExecutionContext): void {
  if (context.contextOrigin !== "public_admission") {
    throw new IntakeValidationError("Public admission context is required");
  }
  assertAdmissionPermission(context, PERMISSIONS.OFFERING_PUBLIC_READ);
}

function assertApplicantContext(
  context: TenantExecutionContext,
  permission: "application.create" | "application.read" | "application.write",
): void {
  if (context.contextOrigin !== "family_application") {
    throw new IntakeValidationError("Applicant context is required");
  }
  assertAdmissionPermission(context, permission);
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    metadata?: Record<string, string>;
    reasonCode?: string;
    resourceId?: string;
    resourceType: string;
    result: "ALLOW" | "DENY" | "SUCCESS";
  },
): Promise<void> {
  const data: Prisma.AuditEventUncheckedCreateInput = {
    action: input.action,
    actorId: context.actorId,
    correlationId: context.correlationId,
    effectiveActorId: context.effectiveActorId ?? context.actorId,
    occurredAt: new Date(),
    purpose: context.purpose,
    resourceType: input.resourceType,
    result: input.result,
    tenantId: context.tenantId,
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
    ...(input.resourceId === undefined ? {} : { resourceId: input.resourceId }),
  };
  await transaction.auditEvent.create({
    data: { ...data, scope: "TENANT" },
  });
}

async function recordPlatformAudit(
  transaction: Prisma.TransactionClient,
  context: FamilyExecutionContext,
  input: {
    action:
      | "FAMILY_PROFILE_CREATED"
      | "FAMILY_PROFILE_UPDATED"
      | "STUDENT_CREATED"
      | "STUDENT_UPDATED";
    resourceId?: string;
    resourceType: string;
    result: "DENY" | "SUCCESS";
  },
): Promise<void> {
  await transaction.$executeRaw`
    INSERT INTO "audit_events" (
      "id", "tenant_id", "scope", "actor_id", "effective_actor_id", "action",
      "purpose", "resource_type", "resource_id", "result", "correlation_id",
      "occurred_at"
    ) VALUES (
      ${randomUUID()}::uuid, NULL, 'PLATFORM_GLOBAL'::"AuditEventScope", ${context.actorId}::uuid,
      ${context.effectiveActorId ?? context.actorId}::uuid, ${input.action},
      ${context.purpose}, ${input.resourceType}, ${input.resourceId ?? null}::uuid,
      ${input.result}, ${context.correlationId}, CURRENT_TIMESTAMP
    )
  `;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function ensureAdmissionProcessYear(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  academicYearId: string,
): Promise<void> {
  const year = await transaction.academicYear.findFirst({
    where: { id: academicYearId, tenantId },
  });
  if (year === null) throw new IntakeNotFoundError();
}

async function ensureOfferingReferences(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  input: AdmissionOfferingInput,
): Promise<void> {
  const process = await transaction.admissionProcess.findFirst({
    where: { id: input.processId, tenantId },
  });
  if (process === null) {
    throw new IntakeNotFoundError();
  }
  if (process.academicYearId !== input.academicYearId) {
    throw new IntakeValidationError(
      "Offering process and academic year must match",
    );
  }
  const [year, campus, courseLevel] = await Promise.all([
    transaction.academicYear.findFirst({
      where: { id: input.academicYearId, tenantId },
    }),
    transaction.campus.findFirst({ where: { id: input.campusId, tenantId } }),
    transaction.courseLevel.findFirst({
      where: { id: input.courseLevelId, tenantId },
    }),
  ]);
  if (year === null || campus === null || courseLevel === null) {
    throw new IntakeNotFoundError();
  }
}

function assertOfferingVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new IntakeValidationError("Invalid expectedOfferingVersion");
  }
}

async function lockOffering(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  offeringId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT id
    FROM admission_offerings
    WHERE tenant_id = ${tenantId}::uuid AND id = ${offeringId}::uuid
    FOR UPDATE
  `;
}

async function assertPublishedOfferingsHaveCapacity(
  transaction: Prisma.TransactionClient,
  scope: { academicYearId?: string; processId?: string },
): Promise<void> {
  const inconsistent = await transaction.admissionOffering.findFirst({
    select: { id: true },
    where: {
      admissionCapacity: { is: null },
      ...scope,
      status: "PUBLISHED",
    },
  });
  if (inconsistent !== null) {
    throw new IntakeConflictError("PUBLISHED_OFFERING_CAPACITY_REQUIRED");
  }
}

export class IntakeService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateFamilyProfile(
    context: FamilyExecutionContext,
    displayName: string,
  ): Promise<{ displayName: string; id: string; userId: string }> {
    assertFamilyPermission(context, PERMISSIONS.FAMILY_PROFILE_WRITE);
    const normalizedName = requireText(displayName, "displayName", 160);
    return withPlatformAuditTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.familyProfile.findUnique({
        where: { userId: context.actorId },
      });
      const profile =
        existing === null
          ? await transaction.familyProfile.create({
              data: {
                displayName: normalizedName,
                userId: context.actorId,
              },
            })
          : await transaction.familyProfile.update({
              data: { displayName: normalizedName },
              where: { id: existing.id },
            });
      await recordPlatformAudit(transaction, context, {
        action:
          existing === null
            ? "FAMILY_PROFILE_CREATED"
            : "FAMILY_PROFILE_UPDATED",
        resourceId: profile.id,
        resourceType: "FamilyProfile",
        result: "SUCCESS",
      });
      return {
        displayName: profile.displayName,
        id: profile.id,
        userId: profile.userId,
      };
    });
  }

  async getFamilyProfile(
    context: FamilyExecutionContext,
  ): Promise<{ displayName: string; id: string; userId: string }> {
    assertFamilyPermission(context, PERMISSIONS.FAMILY_PROFILE_READ);
    const profile = await this.prisma.familyProfile.findUnique({
      where: { userId: context.actorId },
    });
    if (profile === null) throw new IntakeNotFoundError();
    return {
      displayName: profile.displayName,
      id: profile.id,
      userId: profile.userId,
    };
  }

  async listStudents(context: FamilyExecutionContext): Promise<StudentDto[]> {
    assertFamilyPermission(context, PERMISSIONS.STUDENT_READ);
    const profile = await this.prisma.familyProfile.findUnique({
      where: { userId: context.actorId },
    });
    if (profile === null) return [];
    const students = await this.prisma.student.findMany({
      orderBy: [{ familyName: "asc" }, { givenName: "asc" }],
      where: { familyProfileId: profile.id },
    });
    return students.map(mapStudent);
  }

  async createStudent(
    context: FamilyExecutionContext,
    input: StudentInput,
  ): Promise<StudentDto> {
    assertFamilyPermission(context, PERMISSIONS.STUDENT_WRITE);
    const givenName = requireText(input.givenName, "givenName", 120);
    const familyName = requireText(input.familyName, "familyName", 160);
    const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
    return withPlatformAuditTransaction(this.prisma, async (transaction) => {
      const profile = await transaction.familyProfile.findUnique({
        where: { userId: context.actorId },
      });
      if (profile === null) throw new IntakeNotFoundError();
      const student = await transaction.student.create({
        data: {
          ...(dateOfBirth === undefined ? {} : { dateOfBirth }),
          familyName,
          familyProfileId: profile.id,
          givenName,
        },
      });
      await recordPlatformAudit(transaction, context, {
        action: "STUDENT_CREATED",
        resourceId: student.id,
        resourceType: "Student",
        result: "SUCCESS",
      });
      return mapStudent(student);
    });
  }

  async updateStudent(
    context: FamilyExecutionContext,
    studentId: string,
    input: StudentInput,
  ): Promise<StudentDto> {
    assertFamilyPermission(context, PERMISSIONS.STUDENT_WRITE);
    const givenName = requireText(input.givenName, "givenName", 120);
    const familyName = requireText(input.familyName, "familyName", 160);
    const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
    return withPlatformAuditTransaction(this.prisma, async (transaction) => {
      const profile = await transaction.familyProfile.findUnique({
        where: { userId: context.actorId },
      });
      if (profile === null) throw new IntakeNotFoundError();
      const owned = await transaction.student.findFirst({
        where: { familyProfileId: profile.id, id: studentId },
      });
      if (owned === null) throw new IntakeNotFoundError();
      const student = await transaction.student.update({
        data: {
          ...(dateOfBirth === undefined ? {} : { dateOfBirth }),
          familyName,
          givenName,
        },
        where: { id: studentId },
      });
      await recordPlatformAudit(transaction, context, {
        action: "STUDENT_UPDATED",
        resourceId: student.id,
        resourceType: "Student",
        result: "SUCCESS",
      });
      return mapStudent(student);
    });
  }

  async createCampus(
    context: TenantExecutionContext,
    input: CampusInput,
  ): Promise<CampusDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 80);
    const name = requireText(input.name, "name", 160);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: { code, name, tenantId: context.tenantId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_CAMPUS_CREATED",
        resourceId: campus.id,
        resourceType: "Campus",
        result: "SUCCESS",
      });
      return campus;
    });
  }

  async updateCampus(
    context: TenantExecutionContext,
    campusId: string,
    input: CampusInput,
  ): Promise<CampusDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 80);
    const name = requireText(input.name, "name", 160);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const campus = await transaction.campus.updateMany({
        data: { code, name },
        where: { id: campusId, tenantId: context.tenantId },
      });
      if (campus.count !== 1) throw new IntakeNotFoundError();
      const updated = await transaction.campus.findUniqueOrThrow({
        where: { id: campusId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_CAMPUS_UPDATED",
        resourceId: updated.id,
        resourceType: "Campus",
        result: "SUCCESS",
      });
      return updated;
    });
  }

  async createAcademicYear(
    context: TenantExecutionContext,
    input: AcademicYearInput,
  ): Promise<AcademicYearDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 40);
    const label = requireText(input.label, "label", 80);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const year = await transaction.academicYear.create({
        data: {
          code,
          label,
          status: input.status ?? "DRAFT",
          tenantId: context.tenantId,
        },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_ACADEMIC_YEAR_CREATED",
        resourceId: year.id,
        resourceType: "AcademicYear",
        result: "SUCCESS",
      });
      return year;
    });
  }

  async createCourseLevel(
    context: TenantExecutionContext,
    input: CourseLevelInput,
  ): Promise<CourseLevelDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 80);
    const name = requireText(input.name, "name", 120);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const level = await transaction.courseLevel.create({
        data: { code, name, tenantId: context.tenantId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_COURSE_LEVEL_CREATED",
        resourceId: level.id,
        resourceType: "CourseLevel",
        result: "SUCCESS",
      });
      return level;
    });
  }

  async updateAcademicYear(
    context: TenantExecutionContext,
    academicYearId: string,
    input: AcademicYearInput,
  ): Promise<AcademicYearDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 40);
    const label = requireText(input.label, "label", 80);
    return withTenantTransaction(this.prisma, async (transaction) => {
      if (input.status === "OPEN") {
        await assertPublishedOfferingsHaveCapacity(transaction, {
          academicYearId,
        });
      }
      const result = await transaction.academicYear.updateMany({
        data: { code, label, status: input.status ?? "DRAFT" },
        where: { id: academicYearId, tenantId: context.tenantId },
      });
      if (result.count !== 1) throw new IntakeNotFoundError();
      const year = await transaction.academicYear.findUniqueOrThrow({
        where: { id: academicYearId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_ACADEMIC_YEAR_UPDATED",
        resourceId: year.id,
        resourceType: "AcademicYear",
        result: "SUCCESS",
      });
      return year;
    });
  }

  async createAdmissionProcess(
    context: TenantExecutionContext,
    input: AdmissionProcessInput,
  ): Promise<ProcessDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 80);
    const name = requireText(input.name, "name", 160);
    validateAdmissionProcessWindow(input.opensAt, input.closesAt);
    return withTenantTransaction(this.prisma, async (transaction) => {
      await ensureAdmissionProcessYear(
        transaction,
        context.tenantId,
        input.academicYearId,
      );
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: input.academicYearId,
          closesAt: input.closesAt ?? null,
          code,
          name,
          opensAt: input.opensAt ?? null,
          status: input.status ?? "DRAFT",
          tenantId: context.tenantId,
        },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_PROCESS_CREATED",
        resourceId: process.id,
        resourceType: "AdmissionProcess",
        result: "SUCCESS",
      });
      return process;
    });
  }

  async updateAdmissionProcess(
    context: TenantExecutionContext,
    processId: string,
    input: AdmissionProcessInput,
  ): Promise<ProcessDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 80);
    const name = requireText(input.name, "name", 160);
    validateAdmissionProcessWindow(input.opensAt, input.closesAt);
    return withTenantTransaction(this.prisma, async (transaction) => {
      await ensureAdmissionProcessYear(
        transaction,
        context.tenantId,
        input.academicYearId,
      );
      if (input.status === "PUBLISHED") {
        await assertPublishedOfferingsHaveCapacity(transaction, { processId });
      }
      const result = await transaction.admissionProcess.updateMany({
        data: {
          academicYearId: input.academicYearId,
          closesAt: input.closesAt ?? null,
          code,
          name,
          opensAt: input.opensAt ?? null,
          status: input.status ?? "DRAFT",
        },
        where: { id: processId, tenantId: context.tenantId },
      });
      if (result.count !== 1) throw new IntakeNotFoundError();
      const process = await transaction.admissionProcess.findUniqueOrThrow({
        where: { id: processId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_PROCESS_UPDATED",
        resourceId: process.id,
        resourceType: "AdmissionProcess",
        result: "SUCCESS",
      });
      return process;
    });
  }

  async createOffering(
    context: TenantExecutionContext,
    input: AdmissionOfferingInput,
  ): Promise<OfferingDto> {
    assertConfigPermission(context);
    if (input.status !== undefined && input.status !== "DRAFT") {
      throw new IntakeConflictError("OFFERING_EXPLICIT_PUBLISH_REQUIRED");
    }
    const code = requireText(input.code, "code", 80);
    const title = requireText(input.title, "title", 160);
    return withTenantTransaction(this.prisma, async (transaction) => {
      await ensureOfferingReferences(transaction, context.tenantId, input);
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: input.academicYearId,
          availabilityCategory: input.availabilityCategory,
          campusId: input.campusId,
          code,
          courseLevelId: input.courseLevelId,
          processId: input.processId,
          status: "DRAFT",
          tenantId: context.tenantId,
          title,
        },
        include: offeringProjection,
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_OFFERING_CREATED",
        resourceId: offering.id,
        resourceType: "AdmissionOffering",
        result: "SUCCESS",
      });
      return mapOffering(offering);
    });
  }

  async updateOffering(
    context: TenantExecutionContext,
    offeringId: string,
    input: AdmissionOfferingInput,
  ): Promise<OfferingDto> {
    assertConfigPermission(context);
    const code = requireText(input.code, "code", 80);
    const title = requireText(input.title, "title", 160);
    return withTenantTransaction(this.prisma, async (transaction) => {
      await ensureOfferingReferences(transaction, context.tenantId, input);
      await lockOffering(transaction, context.tenantId, offeringId);
      const current = await transaction.admissionOffering.findFirst({
        where: { id: offeringId, tenantId: context.tenantId },
      });
      if (current === null) throw new IntakeNotFoundError();
      if (input.status !== undefined && input.status !== current.status) {
        throw new IntakeConflictError("OFFERING_EXPLICIT_PUBLISH_REQUIRED");
      }
      const result = await transaction.admissionOffering.updateMany({
        data: {
          academicYearId: input.academicYearId,
          availabilityCategory: input.availabilityCategory,
          campusId: input.campusId,
          code,
          concurrencyVersion: { increment: 1 },
          courseLevelId: input.courseLevelId,
          processId: input.processId,
          title,
        },
        where: { id: offeringId, tenantId: context.tenantId },
      });
      if (result.count !== 1) throw new IntakeNotFoundError();
      const offering = await transaction.admissionOffering.findUniqueOrThrow({
        include: offeringProjection,
        where: { id: offeringId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_OFFERING_UPDATED",
        resourceId: offering.id,
        resourceType: "AdmissionOffering",
        result: "SUCCESS",
      });
      return mapOffering(offering);
    });
  }

  async publishOffering(
    context: TenantExecutionContext,
    offeringId: string,
    input: OfferingLifecycleCommandInput,
  ): Promise<OfferingDto> {
    assertConfigPermission(context);
    assertOfferingVersion(input.expectedOfferingVersion);
    return withTenantTransaction(this.prisma, async (transaction) => {
      // R5 lock order is stable: offering first, capacity second.
      await lockOffering(transaction, context.tenantId, offeringId);
      const offering = await transaction.admissionOffering.findFirst({
        include: offeringProjection,
        where: { id: offeringId, tenantId: context.tenantId },
      });
      if (offering === null) throw new IntakeNotFoundError();
      if (offering.concurrencyVersion !== input.expectedOfferingVersion) {
        throw new IntakeConflictError("OFFERING_VERSION_CHANGED");
      }
      if (offering.status !== "DRAFT") {
        throw new IntakeValidationError(
          "Only a DRAFT offering can be published",
        );
      }
      const capacities = await transaction.$queryRaw<
        Array<{
          concurrency_version: number;
          configured_capacity: number;
          id: string;
        }>
      >`
        SELECT id, configured_capacity, concurrency_version
        FROM admission_capacities
        WHERE tenant_id = ${context.tenantId}::uuid
          AND offering_id = ${offeringId}::uuid
        FOR UPDATE
      `;
      const capacity = capacities[0];
      if (capacity === undefined) {
        throw new IntakeConflictError("CAPACITY_CONFIGURATION_REQUIRED");
      }
      const result = await transaction.admissionOffering.updateMany({
        data: {
          concurrencyVersion: { increment: 1 },
          status: "PUBLISHED",
        },
        where: {
          concurrencyVersion: input.expectedOfferingVersion,
          id: offeringId,
          status: "DRAFT",
          tenantId: context.tenantId,
        },
      });
      if (result.count !== 1) {
        throw new IntakeConflictError("OFFERING_VERSION_CHANGED");
      }
      const published = await transaction.admissionOffering.findUniqueOrThrow({
        include: offeringProjection,
        where: { id: offeringId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_OFFERING_PUBLISHED",
        metadata: {
          capacityState:
            capacity.configured_capacity === 0
              ? "CAPACITY_CONFIGURED_ZERO"
              : "CAPACITY_CONFIGURED_POSITIVE",
          capacityVersion: String(capacity.concurrency_version),
          offeringVersion: String(published.concurrencyVersion),
        },
        resourceId: offeringId,
        resourceType: "AdmissionOffering",
        result: "SUCCESS",
      });
      return mapOffering(published);
    });
  }

  async closeOffering(
    context: TenantExecutionContext,
    offeringId: string,
    input: OfferingLifecycleCommandInput,
  ): Promise<OfferingDto> {
    assertConfigPermission(context);
    assertOfferingVersion(input.expectedOfferingVersion);
    return withTenantTransaction(this.prisma, async (transaction) => {
      await lockOffering(transaction, context.tenantId, offeringId);
      const offering = await transaction.admissionOffering.findFirst({
        where: { id: offeringId, tenantId: context.tenantId },
      });
      if (offering === null) throw new IntakeNotFoundError();
      if (offering.concurrencyVersion !== input.expectedOfferingVersion) {
        throw new IntakeConflictError("OFFERING_VERSION_CHANGED");
      }
      if (offering.status === "CLOSED") {
        throw new IntakeValidationError("Offering is already closed");
      }
      const updated = await transaction.admissionOffering.update({
        data: {
          concurrencyVersion: { increment: 1 },
          status: "CLOSED",
        },
        include: offeringProjection,
        where: { id: offeringId },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_OFFERING_CLOSED",
        metadata: { offeringVersion: String(updated.concurrencyVersion) },
        resourceId: offeringId,
        resourceType: "AdmissionOffering",
        result: "SUCCESS",
      });
      return mapOffering(updated);
    });
  }

  async getOfferingReadiness(
    context: TenantExecutionContext,
    offeringId: string,
  ): Promise<OfferingReadinessDto> {
    assertConfigPermission(context, "admission.config.read");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const offering = await transaction.admissionOffering.findFirst({
        include: {
          admissionCapacity: {
            select: {
              concurrencyVersion: true,
              configuredCapacity: true,
            },
          },
        },
        where: { id: offeringId, tenantId: context.tenantId },
      });
      if (offering === null) throw new IntakeNotFoundError();
      const capacityState: OfferingCapacityState =
        offering.admissionCapacity === null
          ? "CAPACITY_NOT_CONFIGURED"
          : offering.admissionCapacity.configuredCapacity === 0
            ? "CAPACITY_CONFIGURED_ZERO"
            : "CAPACITY_CONFIGURED_POSITIVE";
      const blockers: OfferingReadinessDto["blockers"] =
        capacityState === "CAPACITY_NOT_CONFIGURED"
          ? ["CAPACITY_CONFIGURATION_REQUIRED"]
          : [];
      return {
        blockers,
        capacityState,
        capacityVersion: offering.admissionCapacity?.concurrencyVersion ?? null,
        lifecycle: offering.status,
        offeringId: offering.id,
        offeringVersion: offering.concurrencyVersion,
        publishable: offering.status === "DRAFT" && blockers.length === 0,
      };
    });
  }

  async getConfiguration(
    context: TenantExecutionContext,
  ): Promise<ConfigurationDto> {
    assertConfigPermission(context, "admission.config.read");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const [campuses, academicYears, courseLevels, processes, offerings] =
        await Promise.all([
          transaction.campus.findMany({ orderBy: { code: "asc" } }),
          transaction.academicYear.findMany({ orderBy: { code: "asc" } }),
          transaction.courseLevel.findMany({ orderBy: { code: "asc" } }),
          transaction.admissionProcess.findMany({ orderBy: { code: "asc" } }),
          transaction.admissionOffering.findMany({
            include: offeringProjection,
            orderBy: { code: "asc" },
          }),
        ]);
      return {
        academicYears: academicYears.map(mapAcademicYear),
        campuses: campuses.map(mapCampus),
        courseLevels: courseLevels.map(mapCourseLevel),
        offerings: offerings.map(mapOffering),
        processes: processes.map(mapProcess),
      };
    });
  }

  async listPublicOfferings(
    context: TenantExecutionContext,
    now = new Date(),
  ): Promise<OfferingDto[]> {
    assertPublicAdmissionContext(context);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const offerings = await transaction.admissionOffering.findMany({
        include: publicOfferingProjection,
        orderBy: [{ title: "asc" }, { code: "asc" }],
        where: {
          admissionCapacity: { isNot: null },
          status: "PUBLISHED",
        },
      });
      return offerings
        .filter(
          (offering) =>
            isAdmissionOfferingCurrent(offering, now) &&
            offering.formVersionId !== null &&
            offering.formVersion?.lifecycle === "PUBLISHED",
        )
        .map(mapOffering);
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

  private applicantContext(
    familyContext: FamilyExecutionContext,
    tenantId: string,
    purpose: string,
    permission: "application.create" | "application.read" | "application.write",
  ): TenantExecutionContext {
    return {
      actorId: familyContext.actorId,
      capabilities: [permission],
      contextOrigin: "family_application",
      correlationId: familyContext.correlationId,
      effectiveActorId: familyContext.effectiveActorId ?? familyContext.actorId,
      purpose,
      source: familyContext.source,
      tenantId,
    };
  }

  async createApplicationDraft(
    familyContext: FamilyExecutionContext,
    publicContext: TenantExecutionContext,
    input: { offeringId: string; studentId: string },
    now = new Date(),
  ): Promise<ApplicationDto> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_CREATE);
    assertPublicAdmissionContext(publicContext);
    const profile = await this.ownedFamilyProfile(familyContext);
    const student = await this.prisma.student.findFirst({
      where: { familyProfileId: profile.id, id: input.studentId },
    });
    if (student === null) throw new IntakeNotFoundError();

    let applicantContext: TenantExecutionContext | undefined;
    try {
      return await runWithTenantContext(publicContext, async () => {
        const offering = await withTenantTransaction(
          this.prisma,
          async (transaction) =>
            transaction.admissionOffering.findFirst({
              include: { academicYear: true, formVersion: true, process: true },
              where: {
                admissionCapacity: { isNot: null },
                id: input.offeringId,
                status: "PUBLISHED",
              },
            }),
        );
        if (offering === null) throw new IntakeNotFoundError();
        if (offering.tenantId !== publicContext.tenantId) {
          throw new IntakeNotFoundError();
        }
        if (!isAdmissionOfferingCurrent(offering, now)) {
          throw new IntakeValidationError("Offering is not currently valid");
        }
        if (offering.availabilityCategory === "PROCESS_CLOSED") {
          throw new IntakeValidationError("Offering is closed");
        }
        if (
          offering.formVersionId === null ||
          offering.formVersion?.lifecycle !== "PUBLISHED"
        ) {
          throw new IntakeValidationError(
            "Offering does not have a published form version",
          );
        }
        applicantContext = this.applicantContext(
          familyContext,
          offering.tenantId,
          familyContext.purpose,
          PERMISSIONS.APPLICATION_CREATE,
        );
        return runWithTenantContext(applicantContext, () =>
          withTenantTransaction(this.prisma, async (transaction) => {
            assertApplicantContext(
              applicantContext as TenantExecutionContext,
              PERMISSIONS.APPLICATION_CREATE,
            );
            const application = await transaction.application.create({
              data: {
                academicYearId: offering.academicYearId,
                draftData: {
                  acknowledgedNoGuarantee: false,
                  currentStep: "CONTEXT",
                } as unknown as Prisma.InputJsonValue,
                familyProfileId: profile.id,
                formVersionId: offering.formVersionId,
                offeringId: offering.id,
                processId: offering.processId,
                studentId: student.id,
                tenantId: offering.tenantId,
              },
              include: applicationProjection,
            });
            await pinDocumentRequirements(
              transaction,
              {
                academicYearId: offering.academicYearId,
                applicationId: application.id,
                courseLevelId: offering.courseLevelId,
                formVersionId: offering.formVersionId,
                offeringId: offering.id,
                processId: offering.processId,
                tenantId: offering.tenantId,
              },
              now,
            );
            await recordAudit(
              transaction,
              applicantContext as TenantExecutionContext,
              {
                action: "APPLICATION_DRAFT_CREATED",
                resourceId: application.id,
                resourceType: "Application",
                result: "SUCCESS",
              },
            );
            return mapApplication(application);
          }),
        );
      });
    } catch (error) {
      if (!isUniqueViolation(error) || applicantContext === undefined) {
        throw error;
      }
      await runWithTenantContext(applicantContext, () =>
        withTenantTransaction(this.prisma, (transaction) =>
          recordAudit(transaction, applicantContext as TenantExecutionContext, {
            action: "APPLICATION_DRAFT_DUPLICATE_DENIED",
            metadata: {
              offeringId: input.offeringId,
              studentId: input.studentId,
            },
            reasonCode: "ACTIVE_DRAFT_EXISTS",
            resourceType: "Application",
            result: "DENY",
          }),
        ),
      );
      throw new IntakeDuplicateError();
    }
  }

  async listApplications(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
  ): Promise<ApplicationDto[]> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_READ);
    assertApplicantContext(applicantContext, PERMISSIONS.APPLICATION_READ);
    const profile = await this.ownedFamilyProfile(familyContext);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const applications = await transaction.application.findMany({
        include: applicationProjection,
        orderBy: { updatedAt: "desc" },
        where: { familyProfileId: profile.id },
      });
      return applications.map(mapApplication);
    });
  }

  async getApplication(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
  ): Promise<ApplicationDto> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_READ);
    assertApplicantContext(applicantContext, PERMISSIONS.APPLICATION_READ);
    const profile = await this.ownedFamilyProfile(familyContext);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await transaction.application.findFirst({
        include: applicationProjection,
        where: { familyProfileId: profile.id, id: applicationId },
      });
      if (application === null) throw new IntakeNotFoundError();
      return mapApplication(application);
    });
  }

  async saveApplicationDraft(
    familyContext: FamilyExecutionContext,
    applicantContext: TenantExecutionContext,
    applicationId: string,
    input: DraftPatch,
  ): Promise<ApplicationDto> {
    assertFamilyPermission(familyContext, PERMISSIONS.APPLICATION_WRITE);
    assertApplicantContext(applicantContext, PERMISSIONS.APPLICATION_WRITE);
    const profile = await this.ownedFamilyProfile(familyContext);
    const draftData = toDraftData(input);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const existing = await transaction.application.findFirst({
        where: {
          familyProfileId: profile.id,
          id: applicationId,
          status: "DRAFT",
        },
      });
      if (existing === null) throw new IntakeNotFoundError();
      const application = await transaction.application.update({
        data: { draftData: draftData as unknown as Prisma.InputJsonValue },
        where: { id: applicationId },
      });
      const applicationWithProjection =
        await transaction.application.findUniqueOrThrow({
          include: applicationProjection,
          where: { id: application.id },
        });
      await recordAudit(transaction, applicantContext, {
        action: "APPLICATION_DRAFT_UPDATED",
        metadata: { currentStep: draftData.currentStep },
        resourceId: application.id,
        resourceType: "Application",
        result: "SUCCESS",
      });
      return mapApplication(applicationWithProjection);
    });
  }
}
