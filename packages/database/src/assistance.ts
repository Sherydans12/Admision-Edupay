import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { authorizeOrThrow } from "./authorization.js";
import {
  pinDocumentRequirements,
  type DocumentService,
  type UploadDocumentInput,
} from "./documents.js";
import {
  IntakeDuplicateError,
  IntakeNotFoundError,
  IntakeValidationError,
} from "./domain-errors.js";
import { type FormService } from "./forms.js";
import { isAdmissionOfferingCurrent } from "./intake.js";
import { PERMISSIONS } from "./permission-catalog.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

function assertAssist(context: TenantExecutionContext): void {
  authorizeOrThrow(context, {
    permission: PERMISSIONS.APPLICATION_ASSIST,
    purpose: context.purpose,
    resourceTenantId: context.tenantId,
  });
  if (
    context.contextOrigin === "family_application" ||
    context.contextOrigin === "public_admission"
  ) {
    throw new IntakeValidationError(
      "Institutional assistance context is required",
    );
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export class AssistanceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly forms: FormService,
    private readonly documents: DocumentService,
  ) {}

  async startSession(
    context: TenantExecutionContext,
    input: {
      adultPresentConfirmed: boolean;
      authorizationConfirmed: boolean;
      familyProfileId: string;
    },
    now = new Date(),
  ) {
    assertAssist(context);
    if (!input.adultPresentConfirmed) {
      throw new IntakeValidationError("The responsible adult must be present");
    }
    if (!input.authorizationConfirmed) {
      throw new IntakeValidationError("Adult authorization must be confirmed");
    }
    const family = await this.prisma.familyProfile.findUnique({
      select: { id: true, userId: true },
      where: { id: input.familyProfileId },
    });
    if (family === null) throw new IntakeNotFoundError();
    const capabilitySnapshot = [...(context.capabilities ?? [])]
      .sort()
      .join(",")
      .slice(0, 120);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const session = await transaction.assistanceSession.create({
        data: {
          adultPresentConfirmed: true,
          adultResponsibleUserId: family.userId,
          authorizationConfirmed: true,
          authorizationMethod: "IN_PERSON_CONFIRMED",
          authorizationRecordedAt: now,
          correlationId: context.correlationId,
          familyProfileId: family.id,
          operatorRoleSnapshot: capabilitySnapshot || "application.assist",
          operatorUserId: context.effectiveActorId ?? context.actorId,
          startedAt: now,
          tenantId: context.tenantId,
        },
      });
      await recordAudit(transaction, context, {
        action: "ASSISTANCE_SESSION_STARTED",
        metadata: {
          adultPresentConfirmed: true,
          authorizationConfirmed: true,
        },
        resourceId: session.id,
        resourceType: "AssistanceSession",
      });
      return this.mapSession(session);
    });
  }

  async createAssistedApplicationDraft(
    context: TenantExecutionContext,
    assistanceSessionId: string,
    input: { offeringId: string; studentId: string },
    now = new Date(),
  ) {
    assertAssist(context);
    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        const session = await this.lockActiveSession(
          transaction,
          context,
          assistanceSessionId,
        );
        const student = await transaction.student.findFirst({
          where: {
            familyProfileId: session.familyProfileId,
            id: input.studentId,
          },
        });
        if (student === null) throw new IntakeNotFoundError();
        const offering = await transaction.admissionOffering.findFirst({
          include: { academicYear: true, formVersion: true, process: true },
          where: { id: input.offeringId, status: "PUBLISHED" },
        });
        if (offering === null || !isAdmissionOfferingCurrent(offering, now)) {
          throw new IntakeNotFoundError();
        }
        if (
          offering.availabilityCategory === "PROCESS_CLOSED" ||
          offering.formVersionId === null ||
          offering.formVersion?.lifecycle !== "PUBLISHED"
        ) {
          throw new IntakeValidationError(
            "Offering cannot start an assisted draft",
          );
        }
        const application = await transaction.application.create({
          data: {
            academicYearId: offering.academicYearId,
            assistanceSessionId: session.id,
            draftData: asJson({
              acknowledgedNoGuarantee: false,
              currentStep: "CONTEXT",
            }),
            familyProfileId: session.familyProfileId,
            formVersionId: offering.formVersionId,
            offeringId: offering.id,
            origin: "ASSISTED",
            processId: offering.processId,
            studentId: student.id,
            tenantId: context.tenantId,
          },
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
            tenantId: context.tenantId,
          },
          now,
        );
        await recordAudit(transaction, context, {
          action: "ASSISTED_APPLICATION_CREATED",
          metadata: { assistanceSessionId: session.id },
          resourceId: application.id,
          resourceType: "Application",
        });
        return {
          assistanceSessionId: session.id,
          formVersionId: offering.formVersionId,
          id: application.id,
          origin: "ASSISTED" as const,
          status: "DRAFT" as const,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new IntakeDuplicateError();
      throw error;
    }
  }

  async saveAssistedAnswers(
    context: TenantExecutionContext,
    assistanceSessionId: string,
    applicationId: string,
    answers: Array<{ fieldId: string; value: unknown }>,
  ) {
    assertAssist(context);
    const session = await withTenantTransaction(this.prisma, (transaction) =>
      this.requireSessionApplication(
        transaction,
        context,
        assistanceSessionId,
        applicationId,
      ),
    );
    return this.forms.saveAssistedAnswers(
      context,
      session.familyProfileId,
      session.id,
      applicationId,
      answers,
    );
  }

  async getAssistedWorkflow(
    context: TenantExecutionContext,
    assistanceSessionId: string,
    applicationId: string,
  ) {
    assertAssist(context);
    const session = await withTenantTransaction(this.prisma, (transaction) =>
      this.requireSessionApplication(
        transaction,
        context,
        assistanceSessionId,
        applicationId,
      ),
    );
    const [form, documents] = await Promise.all([
      this.forms.getAssistedForm(
        context,
        session.familyProfileId,
        session.id,
        applicationId,
      ),
      this.documents.listAssistedDocuments(context, applicationId),
    ]);
    return { documents, form };
  }

  async uploadAssistedDocument(
    context: TenantExecutionContext,
    assistanceSessionId: string,
    applicationId: string,
    submissionId: string,
    input: Omit<UploadDocumentInput, "origin"> & {
      origin: "ASSISTED" | "PHYSICAL_DOCUMENT";
    },
  ) {
    assertAssist(context);
    authorizeOrThrow(context, {
      permission: PERMISSIONS.DOCUMENT_UPLOAD,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    await withTenantTransaction(this.prisma, (transaction) =>
      this.requireSessionApplication(
        transaction,
        context,
        assistanceSessionId,
        applicationId,
      ),
    );
    return this.documents.uploadStaffDocument(
      context,
      applicationId,
      submissionId,
      input,
    );
  }

  async submitAssistedApplication(
    context: TenantExecutionContext,
    assistanceSessionId: string,
    applicationId: string,
    now = new Date(),
  ) {
    assertAssist(context);
    return this.forms.submitAssistedApplication(
      context,
      {
        applicationId,
        assistanceSessionId,
      },
      now,
    );
  }

  async closeSession(
    context: TenantExecutionContext,
    assistanceSessionId: string,
    now = new Date(),
  ) {
    assertAssist(context);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const session = await this.lockActiveSession(
        transaction,
        context,
        assistanceSessionId,
      );
      const closed = await transaction.assistanceSession.update({
        data: { endedAt: now, status: "CLOSED" },
        where: { id: session.id },
      });
      await recordAudit(transaction, context, {
        action: "ASSISTANCE_SESSION_CLOSED",
        resourceId: session.id,
        resourceType: "AssistanceSession",
      });
      return this.mapSession(closed);
    });
  }

  private async lockActiveSession(
    transaction: Prisma.TransactionClient,
    context: TenantExecutionContext,
    assistanceSessionId: string,
  ) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM assistance_sessions
      WHERE tenant_id = ${context.tenantId}::uuid
        AND id = ${assistanceSessionId}::uuid
        AND status = 'ACTIVE'::"AssistanceSessionStatus"
      FOR UPDATE
    `;
    if (locked.length !== 1) throw new IntakeNotFoundError();
    const session = await transaction.assistanceSession.findFirst({
      where: {
        id: assistanceSessionId,
        operatorUserId: context.effectiveActorId ?? context.actorId,
        status: "ACTIVE",
      },
    });
    if (
      session === null ||
      !session.adultPresentConfirmed ||
      !session.authorizationConfirmed ||
      session.authorizationRecordedAt === null
    ) {
      throw new IntakeNotFoundError();
    }
    return session;
  }

  private async requireSessionApplication(
    transaction: Prisma.TransactionClient,
    context: TenantExecutionContext,
    assistanceSessionId: string,
    applicationId: string,
  ) {
    const session = await this.lockActiveSession(
      transaction,
      context,
      assistanceSessionId,
    );
    const application = await transaction.application.findFirst({
      where: {
        assistanceSessionId: session.id,
        familyProfileId: session.familyProfileId,
        id: applicationId,
        origin: "ASSISTED",
      },
    });
    if (application === null) throw new IntakeNotFoundError();
    return session;
  }

  private mapSession(session: {
    adultPresentConfirmed: boolean;
    authorizationConfirmed: boolean;
    authorizationMethod: string;
    authorizationRecordedAt: Date | null;
    endedAt: Date | null;
    familyProfileId: string;
    id: string;
    operatorUserId: string;
    startedAt: Date;
    status: string;
  }) {
    return {
      adultPresentConfirmed: session.adultPresentConfirmed,
      authorizationConfirmed: session.authorizationConfirmed,
      authorizationMethod: session.authorizationMethod,
      authorizationRecordedAt:
        session.authorizationRecordedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      familyProfileId: session.familyProfileId,
      id: session.id,
      operatorUserId: session.operatorUserId,
      startedAt: session.startedAt.toISOString(),
      status: session.status,
    };
  }
}
