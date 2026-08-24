import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow, ForbiddenError } from "./authorization.js";
import {
  ApplicationAuthorityConflictError,
  ApplicationAuthorityValidationError,
  IntakeNotFoundError,
} from "./domain-errors.js";
import { PERMISSIONS } from "./permission-catalog.js";
import type {
  FamilyExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const APPLICATION_AUTHORITY_SUBJECT_MODES = [
  "MINOR_REPRESENTATIVE",
  "ADULT_STUDENT_SELF",
] as const;
export const APPLICATION_AUTHORITY_RELATIONSHIPS = [
  "MOTHER",
  "FATHER",
  "OTHER_RELATIVE",
  "OTHER",
  "SELF",
] as const;
export const APPLICATION_AUTHORITY_BASES = [
  "PARENT",
  "LEGAL_REPRESENTATIVE",
  "PERSONAL_CARE_HOLDER",
  "AUTHORIZED_BY_AUTHORITY_HOLDER",
  "SELF",
] as const;
export const APPLICATION_AUTHORITY_STATUSES = [
  "NOT_DECLARED",
  "DECLARED",
  "EVIDENCE_PENDING",
  "UNDER_REVIEW",
  "VERIFIED",
  "DISPUTED",
  "REJECTED",
] as const;

export type ApplicationAuthoritySubjectMode =
  (typeof APPLICATION_AUTHORITY_SUBJECT_MODES)[number];
export type ApplicationAuthorityRelationship =
  (typeof APPLICATION_AUTHORITY_RELATIONSHIPS)[number];
export type ApplicationAuthorityBasis =
  (typeof APPLICATION_AUTHORITY_BASES)[number];
export type ApplicationAuthorityStatus =
  (typeof APPLICATION_AUTHORITY_STATUSES)[number];

export interface ApplicationAuthorityDeclarationInput {
  authorityBasis: ApplicationAuthorityBasis;
  expectedConcurrencyVersion?: number | undefined;
  relationship: ApplicationAuthorityRelationship;
  subjectMode: ApplicationAuthoritySubjectMode;
}

export interface ApplicationAuthorityReviewInput {
  evidenceDocumentVersionIds?: readonly string[] | undefined;
  expectedConcurrencyVersion: number;
  reason: string;
  toStatus:
    "EVIDENCE_PENDING" | "UNDER_REVIEW" | "VERIFIED" | "DISPUTED" | "REJECTED";
}

export interface ApplicationAuthorityDto {
  applicationId: string;
  authorityBasis: ApplicationAuthorityBasis | null;
  concurrencyVersion: number | null;
  declaredAt: string | null;
  relationship: ApplicationAuthorityRelationship | null;
  status: ApplicationAuthorityStatus;
  studentAgeCategory: "ADULT" | "MINOR" | "UNKNOWN";
  subjectMode: ApplicationAuthoritySubjectMode | null;
  verifiedAt: string | null;
}

export interface ApplicationAuthorityStaffDto extends ApplicationAuthorityDto {
  authorityUserId: string | null;
  canReview: boolean;
  evidence: readonly { documentVersionId: string; linkedAt: string }[];
  history: readonly {
    actorUserId: string;
    createdAt: string;
    fromStatus: ApplicationAuthorityStatus;
    reason: string | null;
    sequenceNumber: number;
    toStatus: ApplicationAuthorityStatus;
  }[];
}

interface AuthorityApplication {
  familyProfile: { userId: string };
  id: string;
  status: "DRAFT" | "SUBMITTED" | "WITHDRAWN";
  student: { dateOfBirth: Date | null };
  tenantId: string;
}

interface AuthorityRecord {
  applicationId: string;
  authorityBasis: ApplicationAuthorityBasis;
  authorityUserId: string;
  concurrencyVersion: number;
  dateOfBirthSnapshot: Date;
  declaredAt: Date;
  disputedAt: Date | null;
  id: string;
  rejectedAt: Date | null;
  relationship: ApplicationAuthorityRelationship;
  status: ApplicationAuthorityStatus;
  subjectMode: ApplicationAuthoritySubjectMode;
  tenantId: string;
  verifiedAt: Date | null;
}

const allowedTransitions: Readonly<
  Record<
    Exclude<ApplicationAuthorityStatus, "NOT_DECLARED">,
    readonly ApplicationAuthorityStatus[]
  >
> = {
  DECLARED: ["EVIDENCE_PENDING", "UNDER_REVIEW"],
  EVIDENCE_PENDING: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["VERIFIED", "EVIDENCE_PENDING", "DISPUTED", "REJECTED"],
  VERIFIED: ["DISPUTED"],
  DISPUTED: ["UNDER_REVIEW", "VERIFIED", "REJECTED"],
  REJECTED: [],
};

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function dateToCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseCalendarDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new ApplicationAuthorityValidationError("Invalid calendar date");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new ApplicationAuthorityValidationError("Invalid calendar date");
  }
  return [year, month, day];
}

/**
 * Calendar-date age comparison. It deliberately does not use elapsed
 * milliseconds or 365/365.25 arithmetic. A February 29 birth date reaches
 * the next calendar year on March 1 when February has no 29th.
 */
export function isAdultStudent(
  dateOfBirth: string,
  referenceDate: Date | string,
): boolean {
  const [birthYear, birthMonth, birthDay] = parseCalendarDate(dateOfBirth);
  const [referenceYear, referenceMonth, referenceDay] = parseCalendarDate(
    typeof referenceDate === "string"
      ? referenceDate
      : dateToCalendarDate(referenceDate),
  );
  let age = referenceYear - birthYear;
  if (
    referenceMonth < birthMonth ||
    (referenceMonth === birthMonth && referenceDay < birthDay)
  ) {
    age -= 1;
  }
  return age >= 18;
}

function ageCategory(
  dateOfBirth: Date | null,
  now: Date,
): "ADULT" | "MINOR" | "UNKNOWN" {
  if (dateOfBirth === null) return "UNKNOWN";
  return isAdultStudent(dateToCalendarDate(dateOfBirth), now)
    ? "ADULT"
    : "MINOR";
}

function assertExpectedVersion(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    throw new ApplicationAuthorityValidationError(
      "expectedConcurrencyVersion is required",
    );
  }
  return value as number;
}

function normalizeReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length === 0 || normalized.length > 1000) {
    throw new ApplicationAuthorityValidationError(
      "A review reason is required",
    );
  }
  return normalized;
}

function effectiveActor(context: TenantExecutionContext): string {
  return context.effectiveActorId ?? context.actorId;
}

function familyActor(context: FamilyExecutionContext): string {
  return context.effectiveActorId ?? context.actorId;
}

function assertFamilyAuthorityPermission(
  context: FamilyExecutionContext,
  permission: "application.authority.declare" | "application.authority.read",
): void {
  authorizeOrThrow(context, { permission, purpose: context.purpose });
}

function assertFamilyApplicantPermission(
  context: TenantExecutionContext,
  permission: "application.authority.declare" | "application.authority.read",
): void {
  if (context.contextOrigin !== "family_application") {
    throw new ForbiddenError();
  }
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
  });
}

function assertStaffPermission(
  context: TenantExecutionContext,
  permission: "application.authority.read" | "application.authority.review",
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
  });
}

function validateDeclaration(
  input: Pick<
    ApplicationAuthorityDeclarationInput,
    "authorityBasis" | "relationship" | "subjectMode"
  >,
  studentIsAdult: boolean,
): void {
  const adultSelf = input.subjectMode === "ADULT_STUDENT_SELF";
  if (adultSelf) {
    if (
      !studentIsAdult ||
      input.relationship !== "SELF" ||
      input.authorityBasis !== "SELF"
    ) {
      throw new ApplicationAuthorityValidationError(
        "Adult student authority must explicitly be SELF/SELF",
      );
    }
    return;
  }
  if (
    studentIsAdult ||
    input.relationship === "SELF" ||
    input.authorityBasis === "SELF"
  ) {
    throw new ApplicationAuthorityValidationError(
      "Minor representative authority requires a non-SELF combination",
    );
  }
}

function mapAuthority(
  application: AuthorityApplication,
  authority: AuthorityRecord | null,
  now: Date,
): ApplicationAuthorityDto {
  return {
    applicationId: application.id,
    authorityBasis: authority?.authorityBasis ?? null,
    concurrencyVersion: authority?.concurrencyVersion ?? null,
    declaredAt: authority?.declaredAt.toISOString() ?? null,
    relationship: authority?.relationship ?? null,
    status: authority?.status ?? "NOT_DECLARED",
    studentAgeCategory: ageCategory(application.student.dateOfBirth, now),
    subjectMode: authority?.subjectMode ?? null,
    verifiedAt: authority?.verifiedAt?.toISOString() ?? null,
  };
}

async function findApplication(
  transaction: Prisma.TransactionClient,
  applicationId: string,
): Promise<AuthorityApplication> {
  const application = await transaction.application.findFirst({
    include: { familyProfile: { select: { userId: true } }, student: true },
    where: { id: applicationId },
  });
  if (application === null) throw new IntakeNotFoundError();
  return application;
}

async function lockApplication(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  applicationId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM applications
    WHERE tenant_id = ${tenantId}::uuid AND id = ${applicationId}::uuid
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new IntakeNotFoundError();
}

async function lockAuthority(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  applicationId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM application_authorities
    WHERE tenant_id = ${tenantId}::uuid AND application_id = ${applicationId}::uuid
    FOR UPDATE
  `;
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    reasonCode?: string;
    resourceId: string;
    resourceType: string;
  },
  now: Date,
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: effectiveActor(context),
      occurredAt: now,
      purpose: context.purpose,
      ...(input.reasonCode === undefined
        ? {}
        : { reasonCode: input.reasonCode }),
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

async function appendHistory(
  transaction: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    authority: AuthorityRecord;
    evidenceDocumentVersionIds?: readonly string[];
    fromStatus: ApplicationAuthorityStatus;
    reason?: string;
    sequenceNumber: number;
    toStatus: ApplicationAuthorityStatus;
  },
): Promise<void> {
  await transaction.applicationAuthorityReview.create({
    data: {
      actorUserId: input.actorUserId,
      applicationId: input.authority.applicationId,
      authorityBasis: input.authority.authorityBasis,
      authorityId: input.authority.id,
      concurrencyVersion: input.authority.concurrencyVersion,
      ...(input.evidenceDocumentVersionIds === undefined
        ? {}
        : {
            evidenceManifest: asJson({
              evidenceVersionIds: [...input.evidenceDocumentVersionIds],
            }),
          }),
      fromStatus: input.fromStatus,
      relationship: input.authority.relationship,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      sequenceNumber: input.sequenceNumber,
      subjectMode: input.authority.subjectMode,
      tenantId: input.authority.tenantId,
      toStatus: input.toStatus,
    },
  });
}

async function nextSequenceNumber(
  transaction: Prisma.TransactionClient,
  authorityId: string,
): Promise<number> {
  const aggregate = await transaction.applicationAuthorityReview.aggregate({
    _max: { sequenceNumber: true },
    where: { authorityId },
  });
  return (aggregate._max.sequenceNumber ?? 0) + 1;
}

async function assertAndLinkEvidence(
  transaction: Prisma.TransactionClient,
  authority: AuthorityRecord,
  documentVersionIds: readonly string[],
  actorUserId: string,
): Promise<void> {
  for (const documentVersionId of [...new Set(documentVersionIds)]) {
    const version = await transaction.documentVersion.findFirst({
      include: { submission: { select: { applicationId: true } } },
      where: { id: documentVersionId },
    });
    if (
      version === null ||
      version.tenantId !== authority.tenantId ||
      version.submission.applicationId !== authority.applicationId ||
      version.technicalStatus !== "READY_FOR_REVIEW" ||
      version.scanStatus !== "CLEAN"
    ) {
      throw new ApplicationAuthorityConflictError("AUTHORITY_EVIDENCE_INVALID");
    }
    const existing = await transaction.applicationAuthorityEvidence.findFirst({
      where: { authorityId: authority.id, documentVersionId },
    });
    if (existing === null) {
      await transaction.applicationAuthorityEvidence.create({
        data: {
          applicationId: authority.applicationId,
          authorityId: authority.id,
          documentVersionId,
          linkedByActorId: actorUserId,
          tenantId: authority.tenantId,
        },
      });
    }
  }
}

/**
 * Reusable fail-closed guard for final submission, offer acceptance and local
 * handoff. The caller supplies the action timestamp and (where applicable)
 * the family principal performing the action.
 */
export async function assertApplicationAuthorityForCriticalAction(
  transaction: Prisma.TransactionClient,
  input: {
    applicationId: string;
    expectedAuthorityUserId?: string;
    now: Date;
    tenantId: string;
  },
): Promise<{
  authorityId: string;
  authorityUserId: string;
  subjectMode: ApplicationAuthoritySubjectMode;
}> {
  const application = await findApplication(transaction, input.applicationId);
  if (application.tenantId !== input.tenantId) throw new IntakeNotFoundError();
  if (application.student.dateOfBirth === null) {
    throw new ApplicationAuthorityConflictError(
      "STUDENT_DATE_OF_BIRTH_REQUIRED",
    );
  }
  const authority = (await transaction.applicationAuthority.findFirst({
    where: { applicationId: application.id },
  })) as AuthorityRecord | null;
  if (authority === null) {
    throw new ApplicationAuthorityConflictError(
      "APPLICATION_AUTHORITY_NOT_DECLARED",
    );
  }
  if (authority.status !== "VERIFIED") {
    throw new ApplicationAuthorityConflictError(
      "APPLICATION_AUTHORITY_NOT_VERIFIED",
    );
  }
  if (
    dateToCalendarDate(application.student.dateOfBirth) !==
    dateToCalendarDate(authority.dateOfBirthSnapshot)
  ) {
    throw new ApplicationAuthorityConflictError(
      "AUTHORITY_STUDENT_DATA_CHANGED",
    );
  }
  if (authority.authorityUserId !== application.familyProfile.userId) {
    throw new ApplicationAuthorityConflictError("AUTHORITY_PRINCIPAL_MISMATCH");
  }
  if (
    input.expectedAuthorityUserId !== undefined &&
    authority.authorityUserId !== input.expectedAuthorityUserId
  ) {
    throw new ApplicationAuthorityConflictError("AUTHORITY_PRINCIPAL_MISMATCH");
  }
  const adult = isAdultStudent(
    dateToCalendarDate(application.student.dateOfBirth),
    input.now,
  );
  const validMode = adult
    ? authority.subjectMode === "ADULT_STUDENT_SELF" &&
      authority.relationship === "SELF" &&
      authority.authorityBasis === "SELF"
    : authority.subjectMode === "MINOR_REPRESENTATIVE" &&
      authority.relationship !== "SELF" &&
      authority.authorityBasis !== "SELF";
  if (!validMode) {
    throw new ApplicationAuthorityConflictError(
      "APPLICATION_AUTHORITY_MODE_INVALID",
    );
  }
  return {
    authorityId: authority.id,
    authorityUserId: authority.authorityUserId,
    subjectMode: authority.subjectMode,
  };
}

/** Persists only a safe reason code after a critical-action guard rollback. */
export async function recordApplicationAuthorityCriticalActionDenied(
  prisma: PrismaClient,
  context: TenantExecutionContext,
  applicationId: string,
  reasonCode: string,
  now = new Date(),
): Promise<void> {
  await withTenantTransaction(prisma, async (transaction) => {
    await recordAudit(
      transaction,
      context,
      {
        action: "APPLICATION_AUTHORITY_CRITICAL_ACTION_DENIED",
        reasonCode,
        resourceId: applicationId,
        resourceType: "Application",
      },
      now,
    );
  });
}

export function isApplicationAuthorityCriticalActionError(
  error: unknown,
): error is ApplicationAuthorityConflictError {
  return error instanceof ApplicationAuthorityConflictError;
}

export class ApplicationAuthorityService {
  constructor(private readonly prisma: PrismaClient) {}

  async getFamilyAuthority(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ): Promise<ApplicationAuthorityDto> {
    assertFamilyAuthorityPermission(
      family,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
    );
    assertFamilyApplicantPermission(
      applicant,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
    );
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await findApplication(transaction, applicationId);
      if (
        application.tenantId !== applicant.tenantId ||
        application.familyProfile.userId !== family.actorId
      ) {
        throw new IntakeNotFoundError();
      }
      const authority = (await transaction.applicationAuthority.findFirst({
        where: { applicationId },
      })) as AuthorityRecord | null;
      return mapAuthority(application, authority, now);
    });
  }

  async declareApplicationAuthority(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    applicationId: string,
    input: ApplicationAuthorityDeclarationInput,
    now = new Date(),
  ): Promise<ApplicationAuthorityDto> {
    assertFamilyAuthorityPermission(
      family,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
    );
    assertFamilyApplicantPermission(
      applicant,
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
    );
    return withTenantTransaction(this.prisma, async (transaction) => {
      await lockApplication(transaction, applicant.tenantId, applicationId);
      await lockAuthority(transaction, applicant.tenantId, applicationId);
      const application = await findApplication(transaction, applicationId);
      if (
        application.tenantId !== applicant.tenantId ||
        application.familyProfile.userId !== family.actorId
      ) {
        throw new IntakeNotFoundError();
      }
      if (application.student.dateOfBirth === null) {
        throw new ApplicationAuthorityConflictError(
          "STUDENT_DATE_OF_BIRTH_REQUIRED",
        );
      }
      const user = await transaction.platformUser.findUnique({
        where: { id: application.familyProfile.userId },
      });
      if (
        user === null ||
        user.status !== "ACTIVE" ||
        user.emailVerifiedAt === null
      ) {
        throw new ForbiddenError();
      }
      const adult = isAdultStudent(
        dateToCalendarDate(application.student.dateOfBirth),
        now,
      );
      validateDeclaration(input, adult);
      const current = (await transaction.applicationAuthority.findFirst({
        where: { applicationId },
      })) as AuthorityRecord | null;
      if (current !== null) {
        const expected = assertExpectedVersion(
          input.expectedConcurrencyVersion,
        );
        if (current.concurrencyVersion !== expected) {
          throw new ApplicationAuthorityConflictError(
            "AUTHORITY_VERSION_CHANGED",
          );
        }
        const permittedAfterSubmission =
          application.status === "SUBMITTED" &&
          current.subjectMode === "MINOR_REPRESENTATIVE" &&
          adult &&
          input.subjectMode === "ADULT_STUDENT_SELF";
        if (application.status !== "DRAFT" && !permittedAfterSubmission) {
          throw new ApplicationAuthorityConflictError(
            "AUTHORITY_INVALID_TRANSITION",
          );
        }
        const updated = (await transaction.applicationAuthority.update({
          data: {
            authorityBasis: input.authorityBasis,
            concurrencyVersion: { increment: 1 },
            dateOfBirthSnapshot: application.student.dateOfBirth,
            declaredAt: now,
            disputedAt: null,
            rejectedAt: null,
            relationship: input.relationship,
            status: "DECLARED",
            subjectMode: input.subjectMode,
            verifiedAt: null,
          },
          where: { id: current.id },
        })) as AuthorityRecord;
        await appendHistory(transaction, {
          actorUserId: familyActor(family),
          authority: updated,
          fromStatus: current.status,
          sequenceNumber: await nextSequenceNumber(transaction, updated.id),
          toStatus: "DECLARED",
        });
        await recordAudit(
          transaction,
          applicant,
          {
            action: "APPLICATION_AUTHORITY_REDECLARED",
            resourceId: updated.id,
            resourceType: "ApplicationAuthority",
          },
          now,
        );
        return mapAuthority(application, updated, now);
      }
      if (input.expectedConcurrencyVersion !== undefined) {
        throw new ApplicationAuthorityConflictError(
          "AUTHORITY_VERSION_CHANGED",
        );
      }
      const created = (await transaction.applicationAuthority.create({
        data: {
          applicationId,
          authorityBasis: input.authorityBasis,
          authorityUserId: application.familyProfile.userId,
          dateOfBirthSnapshot: application.student.dateOfBirth,
          declaredAt: now,
          relationship: input.relationship,
          status: "DECLARED",
          subjectMode: input.subjectMode,
          tenantId: applicant.tenantId,
        },
      })) as AuthorityRecord;
      await appendHistory(transaction, {
        actorUserId: familyActor(family),
        authority: created,
        fromStatus: "NOT_DECLARED",
        sequenceNumber: 1,
        toStatus: "DECLARED",
      });
      await recordAudit(
        transaction,
        applicant,
        {
          action: "APPLICATION_AUTHORITY_DECLARED",
          resourceId: created.id,
          resourceType: "ApplicationAuthority",
        },
        now,
      );
      return mapAuthority(application, created, now);
    });
  }

  async getStaffAuthority(
    context: TenantExecutionContext,
    applicationId: string,
    now = new Date(),
  ): Promise<ApplicationAuthorityStaffDto> {
    assertStaffPermission(context, PERMISSIONS.APPLICATION_AUTHORITY_READ);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await findApplication(transaction, applicationId);
      if (application.tenantId !== context.tenantId)
        throw new IntakeNotFoundError();
      const authority = (await transaction.applicationAuthority.findFirst({
        include: {
          evidence: { orderBy: { createdAt: "asc" } },
          reviews: { orderBy: { sequenceNumber: "asc" } },
        },
        where: { applicationId },
      })) as
        | (AuthorityRecord & {
            evidence: { createdAt: Date; documentVersionId: string }[];
            reviews: {
              actorUserId: string;
              createdAt: Date;
              fromStatus: ApplicationAuthorityStatus;
              reason: string | null;
              sequenceNumber: number;
              toStatus: ApplicationAuthorityStatus;
            }[];
          })
        | null;
      const dto = mapAuthority(application, authority, now);
      return {
        ...dto,
        authorityUserId: authority?.authorityUserId ?? null,
        canReview:
          context.capabilities?.includes(
            PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
          ) === true,
        evidence:
          authority?.evidence.map((item) => ({
            documentVersionId: item.documentVersionId,
            linkedAt: item.createdAt.toISOString(),
          })) ?? [],
        history:
          authority?.reviews.map((review) => ({
            actorUserId: review.actorUserId,
            createdAt: review.createdAt.toISOString(),
            fromStatus: review.fromStatus,
            reason: review.reason,
            sequenceNumber: review.sequenceNumber,
            toStatus: review.toStatus,
          })) ?? [],
      };
    });
  }

  async reviewApplicationAuthority(
    context: TenantExecutionContext,
    applicationId: string,
    input: ApplicationAuthorityReviewInput,
    now = new Date(),
  ): Promise<ApplicationAuthorityStaffDto> {
    assertStaffPermission(context, PERMISSIONS.APPLICATION_AUTHORITY_REVIEW);
    const expected = assertExpectedVersion(input.expectedConcurrencyVersion);
    const reason = normalizeReason(input.reason);
    return withTenantTransaction(this.prisma, async (transaction) => {
      await lockApplication(transaction, context.tenantId, applicationId);
      await lockAuthority(transaction, context.tenantId, applicationId);
      const application = await findApplication(transaction, applicationId);
      if (application.tenantId !== context.tenantId)
        throw new IntakeNotFoundError();
      const current = (await transaction.applicationAuthority.findFirst({
        where: { applicationId },
      })) as AuthorityRecord | null;
      if (current === null) {
        throw new ApplicationAuthorityConflictError(
          "APPLICATION_AUTHORITY_NOT_DECLARED",
        );
      }
      if (current.concurrencyVersion !== expected) {
        throw new ApplicationAuthorityConflictError(
          "AUTHORITY_VERSION_CHANGED",
        );
      }
      const transitions =
        current.status === "NOT_DECLARED"
          ? []
          : allowedTransitions[current.status];
      if (!transitions.includes(input.toStatus)) {
        throw new ApplicationAuthorityConflictError(
          "AUTHORITY_INVALID_TRANSITION",
        );
      }
      const evidenceIds = input.evidenceDocumentVersionIds ?? [];
      await assertAndLinkEvidence(
        transaction,
        current,
        evidenceIds,
        effectiveActor(context),
      );
      if (evidenceIds.length > 0) {
        await recordAudit(
          transaction,
          context,
          {
            action: "APPLICATION_AUTHORITY_EVIDENCE_LINKED",
            resourceId: current.id,
            resourceType: "ApplicationAuthority",
          },
          now,
        );
      }
      if (
        input.toStatus === "VERIFIED" &&
        current.authorityBasis !== "PARENT" &&
        current.authorityBasis !== "SELF"
      ) {
        const evidenceCount =
          await transaction.applicationAuthorityEvidence.count({
            where: { authorityId: current.id },
          });
        if (evidenceCount < 1) {
          throw new ApplicationAuthorityConflictError(
            "AUTHORITY_EVIDENCE_REQUIRED",
          );
        }
      }
      const updated = (await transaction.applicationAuthority.update({
        data: {
          concurrencyVersion: { increment: 1 },
          ...(input.toStatus === "VERIFIED" ? { verifiedAt: now } : {}),
          ...(input.toStatus === "DISPUTED" ? { disputedAt: now } : {}),
          ...(input.toStatus === "REJECTED" ? { rejectedAt: now } : {}),
          status: input.toStatus,
        },
        where: { id: current.id },
      })) as AuthorityRecord;
      await appendHistory(transaction, {
        actorUserId: effectiveActor(context),
        authority: updated,
        evidenceDocumentVersionIds: evidenceIds,
        fromStatus: current.status,
        reason,
        sequenceNumber: await nextSequenceNumber(transaction, updated.id),
        toStatus: input.toStatus,
      });
      const actionByStatus: Record<
        ApplicationAuthorityReviewInput["toStatus"],
        string
      > = {
        DISPUTED: "APPLICATION_AUTHORITY_DISPUTED",
        EVIDENCE_PENDING: "APPLICATION_AUTHORITY_EVIDENCE_REQUESTED",
        REJECTED: "APPLICATION_AUTHORITY_REJECTED",
        UNDER_REVIEW: "APPLICATION_AUTHORITY_REVIEW_STARTED",
        VERIFIED: "APPLICATION_AUTHORITY_VERIFIED",
      };
      await recordAudit(
        transaction,
        context,
        {
          action: actionByStatus[input.toStatus],
          resourceId: updated.id,
          resourceType: "ApplicationAuthority",
        },
        now,
      );
      return this.getStaffAuthorityInTransaction(
        transaction,
        application,
        updated,
        now,
      );
    });
  }

  private async getStaffAuthorityInTransaction(
    transaction: Prisma.TransactionClient,
    application: AuthorityApplication,
    authority: AuthorityRecord,
    now: Date,
  ): Promise<ApplicationAuthorityStaffDto> {
    const hydrated = (await transaction.applicationAuthority.findFirst({
      include: {
        evidence: { orderBy: { createdAt: "asc" } },
        reviews: { orderBy: { sequenceNumber: "asc" } },
      },
      where: { id: authority.id },
    })) as AuthorityRecord & {
      evidence: { createdAt: Date; documentVersionId: string }[];
      reviews: {
        actorUserId: string;
        createdAt: Date;
        fromStatus: ApplicationAuthorityStatus;
        reason: string | null;
        sequenceNumber: number;
        toStatus: ApplicationAuthorityStatus;
      }[];
    };
    const dto = mapAuthority(application, hydrated, now);
    return {
      ...dto,
      authorityUserId: hydrated.authorityUserId,
      canReview: true,
      evidence: hydrated.evidence.map((item) => ({
        documentVersionId: item.documentVersionId,
        linkedAt: item.createdAt.toISOString(),
      })),
      history: hydrated.reviews.map((review) => ({
        actorUserId: review.actorUserId,
        createdAt: review.createdAt.toISOString(),
        fromStatus: review.fromStatus,
        reason: review.reason,
        sequenceNumber: review.sequenceNumber,
        toStatus: review.toStatus,
      })),
    };
  }
}
