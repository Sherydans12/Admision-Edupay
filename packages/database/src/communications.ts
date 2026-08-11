import { DevelopmentEmailAdapter, type EmailAdapter } from "./email-adapter.js";
import { ForbiddenError } from "./authorization.js";
import {
  AdmissionOfferLifecycle,
  CommunicationAttemptStatus,
  CommunicationAudience,
  CommunicationLifecycle,
  CommunicationPurpose,
  DirectionDisposition,
  OperationalTaskStatus,
  OperationalTaskType,
  type Prisma,
  type PrismaClient,
} from "./generated/prisma/client.js";
import { OutboxService } from "./outbox.js";
import { PERMISSIONS } from "./permission-catalog.js";
import { StructuredLogger } from "./structured-logger.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const COMMUNICATION_SEND_TOPIC = "admission.communication.send";

export interface PrepareDecisionCommunicationInput {
  applicationId: string;
  directionDecisionVersionId: string;
}

export interface PrepareOfferCommunicationInput {
  offerVersionId: string;
}

export interface PrepareOfferReminderInput {
  offerVersionId: string;
}

export interface PrepareDocumentCorrectionInput {
  documentSubmissionId: string;
}

export interface PrepareActivityAppointmentInput {
  appointmentId: string;
}

export interface ConfirmCommunicationInput {
  communicationId: string;
  expectedVersion?: number;
}

export interface ProcessOutboxSendInput {
  communicationId: string;
}

export interface RecordDeliveryEvidenceInput {
  communicationId: string;
  evidence: Record<string, unknown>;
  providerReference?: string;
}

export interface RetryCommunicationInput {
  communicationId: string;
}

export interface RecordManualContactInput {
  applicationId: string;
  notes?: string;
  outcome: string;
  purpose: string;
}

async function recordAudit(
  tx: Prisma.TransactionClient,
  context: ReturnType<typeof getRequiredTenantContext>,
  input: {
    action: string;
    metadata?: Record<string, string | number | boolean>;
    resourceId: string;
    resourceType: string;
  },
) {
  await tx.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: context.effectiveActorId ?? context.actorId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
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

export class CommunicationService {
  private readonly logger = new StructuredLogger("admission-communications");

  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailAdapter: EmailAdapter = new DevelopmentEmailAdapter(),
  ) {}

  async prepareDecisionCommunication(params: PrepareDecisionCommunicationInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const decisionVer = await tx.directionDecisionVersion.findFirst({
        include: {
          application: {
            include: {
              familyProfile: {
                include: { user: true },
              },
              student: true,
            },
          },
        },
        where: {
          applicationId: params.applicationId,
          id: params.directionDecisionVersionId,
          tenantId: context.tenantId,
        },
      });

      if (!decisionVer) throw new Error("DIRECTION_DECISION_VERSION_NOT_FOUND");

      let purpose: CommunicationPurpose;
      let subject: string;
      let body: string;

      if (decisionVer.disposition === DirectionDisposition.APROBADO) {
        purpose = CommunicationPurpose.ADMISSION_APPROVED;
        subject = `Admisión Aprobada para ${decisionVer.application.student.givenName}`;
        body = `Nos complace informar que la postulación de ${decisionVer.application.student.givenName} ${decisionVer.application.student.familyName} ha sido APROBADA por la Dirección Institucional. La oferta formal con las condiciones asociadas estará disponible en el Portal Familiar.`;
      } else if (decisionVer.disposition === DirectionDisposition.LISTA_DE_ESPERA) {
        purpose = CommunicationPurpose.WAITLIST_STATUS;
        subject = `Postulación en Lista de Espera para ${decisionVer.application.student.givenName}`;
        body = `Informamos que la postulación de ${decisionVer.application.student.givenName} ${decisionVer.application.student.familyName} ha sido asignada a LISTA DE ESPERA. Les notificaremos oportunamente en caso de producirse una vacante.`;
      } else if (decisionVer.disposition === DirectionDisposition.RECHAZADO) {
        purpose = CommunicationPurpose.ADMISSION_REJECTED;
        subject = `Resultado del Proceso de Admisión para ${decisionVer.application.student.givenName}`;
        body = `Agradecemos el interés en nuestra institución. Informamos que la postulación de ${decisionVer.application.student.givenName} ${decisionVer.application.student.familyName} no ha sido seleccionada en este proceso.`;
      } else {
        // DEVUELTO_A_REVISION is an internal direction state and is not communicated as a final outcome
        return undefined;
      }

      // Check idempotency: exists for this decision version?
      const existing = await tx.communication.findFirst({
        where: {
          directionDecisionVersionId: decisionVer.id,
          tenantId: context.tenantId,
        },
      });
      if (existing) return existing;

      const comm = await tx.communication.create({
        data: {
          applicationId: decisionVer.applicationId,
          audience: CommunicationAudience.FAMILY,
          body,
          directionDecisionVersionId: decisionVer.id,
          lifecycle: CommunicationLifecycle.PREPARED,
          payloadSnapshot: {
            disposition: decisionVer.disposition,
            studentGivenName: decisionVer.application.student.givenName,
          },
          purpose,
          recipientEmail: decisionVer.application.familyProfile.user.emailNormalized,
          subject,
          templateKey: `tpl_decision_${purpose.toLowerCase()}`,
          templateVersion: 1,
          tenantId: context.tenantId,
        },
      });

      await recordAudit(tx, context, {
        action: "communication.prepared",
        metadata: {
          applicationId: decisionVer.applicationId,
          communicationId: comm.id,
          purpose,
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return comm;
    });
  }

  async prepareOfferCommunication(params: PrepareOfferCommunicationInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const offerVer = await tx.admissionOfferVersion.findFirst({
        include: {
          offer: {
            include: {
              application: {
                include: {
                  familyProfile: { include: { user: true } },
                  student: true,
                },
              },
            },
          },
        },
        where: { id: params.offerVersionId, tenantId: context.tenantId },
      });

      if (!offerVer) throw new Error("ADMISSION_OFFER_VERSION_NOT_FOUND");
      if (offerVer.lifecycle !== AdmissionOfferLifecycle.ACTIVE) return undefined;

      const existing = await tx.communication.findFirst({
        where: {
          offerVersionId: offerVer.id,
          purpose: CommunicationPurpose.OFFER_AVAILABLE,
          tenantId: context.tenantId,
        },
      });
      if (existing) return existing;

      const app = offerVer.offer.application;

      const comm = await tx.communication.create({
        data: {
          applicationId: offerVer.applicationId,
          audience: CommunicationAudience.FAMILY,
          body: `Se ha emitido una Oferta de Admisión para ${app.student.givenName}. Vence el ${offerVer.expiresAt.toISOString()}. Ingrese al Portal Familiar para aceptar o rechazar la oferta. Aceptar la oferta no equivale a matrícula o pago.`,
          lifecycle: CommunicationLifecycle.PREPARED,
          offerVersionId: offerVer.id,
          payloadSnapshot: {
            expiresAt: offerVer.expiresAt.toISOString(),
            origin: offerVer.origin,
          },
          purpose: CommunicationPurpose.OFFER_AVAILABLE,
          recipientEmail: app.familyProfile.user.emailNormalized,
          subject: `Oferta de Admisión emitida para ${app.student.givenName}`,
          templateKey: "tpl_offer_issued",
          templateVersion: 1,
          tenantId: context.tenantId,
        },
      });

      await recordAudit(tx, context, {
        action: "communication.prepared",
        metadata: {
          applicationId: offerVer.applicationId,
          communicationId: comm.id,
          offerVersionId: offerVer.id,
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return comm;
    });
  }

  async prepareOfferReminderCommunication(params: PrepareOfferReminderInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const offerVer = await tx.admissionOfferVersion.findFirst({
        include: {
          offer: {
            include: {
              application: {
                include: {
                  familyProfile: { include: { user: true } },
                  student: true,
                },
              },
              currentVersion: true,
            },
          },
        },
        where: { id: params.offerVersionId, tenantId: context.tenantId },
      });

      if (!offerVer) throw new Error("ADMISSION_OFFER_VERSION_NOT_FOUND");
      // Suppress reminder if offer is no longer current or not ACTIVE
      if (
        offerVer.offer.currentVersionId !== offerVer.id ||
        offerVer.lifecycle !== AdmissionOfferLifecycle.ACTIVE
      ) {
        return undefined;
      }

      const existing = await tx.communication.findFirst({
        where: {
          offerVersionId: offerVer.id,
          purpose: CommunicationPurpose.OFFER_REMINDER,
          tenantId: context.tenantId,
        },
      });
      if (existing) return existing;

      const app = offerVer.offer.application;

      const comm = await tx.communication.create({
        data: {
          applicationId: offerVer.applicationId,
          audience: CommunicationAudience.FAMILY,
          body: `Recordatorio: La Oferta de Admisión para ${app.student.givenName} vencerá el ${offerVer.expiresAt.toISOString()}. Por favor confirme su decisión en el Portal Familiar.`,
          lifecycle: CommunicationLifecycle.PREPARED,
          offerVersionId: offerVer.id,
          payloadSnapshot: {
            expiresAt: offerVer.expiresAt.toISOString(),
          },
          purpose: CommunicationPurpose.OFFER_REMINDER,
          recipientEmail: app.familyProfile.user.emailNormalized,
          subject: `Recordatorio: Oferta por vencer para ${app.student.givenName}`,
          templateKey: "tpl_offer_reminder",
          templateVersion: 1,
          tenantId: context.tenantId,
        },
      });

      await recordAudit(tx, context, {
        action: "communication.prepared",
        metadata: {
          applicationId: offerVer.applicationId,
          communicationId: comm.id,
          purpose: "OFFER_REMINDER",
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return comm;
    });
  }

  async prepareDocumentCorrectionCommunication(params: PrepareDocumentCorrectionInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const submission = await tx.documentSubmission.findFirst({
        include: {
          application: {
            include: {
              familyProfile: { include: { user: true } },
              student: true,
            },
          },
          requirement: true,
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        where: { id: params.documentSubmissionId, tenantId: context.tenantId },
      });

      if (!submission) throw new Error("DOCUMENT_SUBMISSION_NOT_FOUND");
      if (submission.status !== "OBSERVADO") return undefined;

      const lastReview = submission.reviews[0];

      const comm = await tx.communication.create({
        data: {
          applicationId: submission.applicationId,
          audience: CommunicationAudience.FAMILY,
          body: `Se ha registrado una observación en el documento '${submission.requirement.name}' para la postulación de ${submission.application.student.givenName}. Motivo: ${lastReview?.reason ?? "Formato o legibilidad no aprobada"}. Plazo máximo de subsanación: ${submission.correctionDueAt?.toISOString() ?? "No especificado"}.`,
          documentSubmissionId: submission.id,
          lifecycle: CommunicationLifecycle.PREPARED,
          payloadSnapshot: {
            correctionDueAt: submission.correctionDueAt?.toISOString() ?? null,
            reason: lastReview?.reason ?? null,
            requirementCode: submission.requirement.code,
          },
          purpose: CommunicationPurpose.DOCUMENT_CORRECTION,
          recipientEmail: submission.application.familyProfile.user.emailNormalized,
          subject: `Observación en documento para ${submission.application.student.givenName}`,
          templateKey: "tpl_document_observed",
          templateVersion: 1,
          tenantId: context.tenantId,
        },
      });

      await recordAudit(tx, context, {
        action: "communication.prepared",
        metadata: {
          applicationId: submission.applicationId,
          communicationId: comm.id,
          documentSubmissionId: submission.id,
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return comm;
    });
  }

  async prepareActivityAppointmentCommunication(params: PrepareActivityAppointmentInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const appointment = await tx.activityAppointment.findFirst({
        include: {
          activity: {
            include: {
              application: {
                include: {
                  familyProfile: { include: { user: true } },
                  student: true,
                },
              },
              definition: true,
            },
          },
        },
        where: { id: params.appointmentId, tenantId: context.tenantId },
      });

      if (!appointment) throw new Error("ACTIVITY_APPOINTMENT_NOT_FOUND");

      const comm = await tx.communication.create({
        data: {
          activityAppointmentId: appointment.id,
          applicationId: appointment.activity.applicationId,
          audience: CommunicationAudience.FAMILY,
          body: `Se ha agendado la actividad '${appointment.activity.definition.name}' para el postulante ${appointment.activity.application.student.givenName}. Fecha: ${appointment.scheduledStartAt.toISOString()}. Lugar: ${appointment.location}.`,
          lifecycle: CommunicationLifecycle.PREPARED,
          payloadSnapshot: {
            activityName: appointment.activity.definition.name,
            location: appointment.location,
            scheduledStartAt: appointment.scheduledStartAt.toISOString(),
          },
          purpose: CommunicationPurpose.APPOINTMENT_SCHEDULED,
          recipientEmail: appointment.activity.application.familyProfile.user.emailNormalized,
          subject: `Cita Agendada: ${appointment.activity.definition.name}`,
          templateKey: "tpl_activity_scheduled",
          templateVersion: 1,
          tenantId: context.tenantId,
        },
      });

      await recordAudit(tx, context, {
        action: "communication.prepared",
        metadata: {
          activityAppointmentId: appointment.id,
          applicationId: appointment.activity.applicationId,
          communicationId: comm.id,
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return comm;
    });
  }

  async confirmCommunication(params: ConfirmCommunicationInput) {
    const context = getRequiredTenantContext();
    if (!(context.capabilities ?? []).includes(PERMISSIONS.COMMUNICATION_CONFIRM)) {
      throw new ForbiddenError();
    }

    try {
      return await withTenantTransaction(this.prisma, async (tx) => {
        const comm = await tx.communication.findFirst({
          where: { id: params.communicationId, tenantId: context.tenantId },
        });

        if (!comm) throw new Error("COMMUNICATION_NOT_FOUND");

        if (
          params.expectedVersion !== undefined &&
          comm.versionNumber !== params.expectedVersion
        ) {
          throw new Error("COMMUNICATION_VERSION_CHANGED");
        }

        if (
          comm.lifecycle === CommunicationLifecycle.CONFIRMED ||
          comm.lifecycle === CommunicationLifecycle.SENT ||
          comm.lifecycle === CommunicationLifecycle.DELIVERED
        ) {
          return comm; // Idempotent
        }

        if (
          comm.lifecycle !== CommunicationLifecycle.PREPARED &&
          comm.lifecycle !== CommunicationLifecycle.FAILED
        ) {
          throw new Error("CANNOT_CONFIRM_NON_PREPARED_COMMUNICATION");
        }

        const now = new Date();
        const updateResult = await tx.communication.updateMany({
          data: {
            confirmedAt: now,
            confirmedBy: context.actorId,
            lifecycle: CommunicationLifecycle.CONFIRMED,
            versionNumber: { increment: 1 },
          },
          where: {
            id: comm.id,
            lifecycle: {
              in: [
                CommunicationLifecycle.PREPARED,
                CommunicationLifecycle.FAILED,
              ],
            },
            tenantId: context.tenantId,
          },
        });

        if (updateResult.count === 0) {
          const alreadyConfirmed = await tx.communication.findFirst({
            where: { id: comm.id, tenantId: context.tenantId },
          });
          if (alreadyConfirmed) return alreadyConfirmed;
        }

        const updated = (await tx.communication.findFirst({
          where: { id: comm.id, tenantId: context.tenantId },
        }))!;

        // Enqueue outbox message with strict idempotency key
        const outbox = new OutboxService(this.prisma);
        await outbox.enqueue({
          idempotencyKey: `comm:send:${comm.id}:${updated.versionNumber}`,
          payload: {
            communicationId: comm.id,
            correlationId: context.correlationId,
          },
          topic: COMMUNICATION_SEND_TOPIC,
        });

        await recordAudit(tx, context, {
          action: "communication.confirmed",
          metadata: {
            communicationId: comm.id,
            versionNumber: updated.versionNumber,
          },
          resourceId: comm.id,
          resourceType: "communication",
        });

        return updated;
      });
    } catch (err: unknown) {
      const current = await this.prisma.communication.findFirst({
        where: { id: params.communicationId, tenantId: context.tenantId },
      });
      if (
        current &&
        (current.lifecycle === CommunicationLifecycle.CONFIRMED ||
          current.lifecycle === CommunicationLifecycle.SENT ||
          current.lifecycle === CommunicationLifecycle.DELIVERED)
      ) {
        return current;
      }
      throw err;
    }
  }

  async processOutboxSend(params: ProcessOutboxSendInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const comm = await tx.communication.findFirst({
        include: {
          attempts: {
            orderBy: { sequence: "desc" },
            take: 1,
          },
        },
        where: { id: params.communicationId, tenantId: context.tenantId },
      });

      if (!comm) throw new Error("COMMUNICATION_NOT_FOUND");

      if (
        comm.lifecycle === CommunicationLifecycle.SENT ||
        comm.lifecycle === CommunicationLifecycle.DELIVERED
      ) {
        return comm; // Already sent
      }

      const nextSequence = (comm.attempts[0]?.sequence ?? 0) + 1;
      const now = new Date();

      const sendResult = await this.emailAdapter.send({
        body: comm.body,
        recipientEmail: comm.recipientEmail,
        subject: comm.subject,
      });

      if (sendResult.status === "SENT") {
        await tx.communicationAttempt.create({
          data: {
            attemptedAt: now,
            communicationId: comm.id,
            completedAt: now,
            deliveryEvidence: {},
            provider: "DEVELOPMENT_EMAIL_ADAPTER",
            providerReference: sendResult.providerReference,
            sequence: nextSequence,
            technicalStatus: CommunicationAttemptStatus.SENT,
            tenantId: context.tenantId,
          },
        });

        const updated = await tx.communication.update({
          data: {
            lifecycle: CommunicationLifecycle.SENT,
          },
          where: { id: comm.id },
        });

        await recordAudit(tx, context, {
          action: "communication.sent",
          metadata: {
            applicationId: comm.applicationId,
            communicationId: comm.id,
            providerReference: sendResult.providerReference,
          },
          resourceId: comm.id,
          resourceType: "communication",
        });

        return updated;
      } else {
        await tx.communicationAttempt.create({
          data: {
            attemptedAt: now,
            communicationId: comm.id,
            completedAt: now,
            deliveryEvidence: {},
            provider: "DEVELOPMENT_EMAIL_ADAPTER",
            providerReference: sendResult.providerReference,
            sanitizedErrorCode: sendResult.sanitizedErrorCode ?? null,
            sequence: nextSequence,
            technicalStatus: CommunicationAttemptStatus.FAILED,
            tenantId: context.tenantId,
          },
        });

        const updated = await tx.communication.update({
          data: {
            lifecycle: CommunicationLifecycle.FAILED,
          },
          where: { id: comm.id },
        });

        // Upsert operational task for deduplicated staff action
        const existingTask = await tx.operationalTask.findFirst({
          where: {
            communicationId: comm.id,
            tenantId: context.tenantId,
            type: OperationalTaskType.COMMUNICATION_FAILED,
          },
        });

        if (!existingTask) {
          await tx.operationalTask.create({
            data: {
              applicationId: comm.applicationId,
              communicationId: comm.id,
              description: `El envío del correo '${comm.subject}' falló: ${sendResult.sanitizedErrorCode}. El portal familiar sigue intacto.`,
              status: OperationalTaskStatus.PENDING,
              tenantId: context.tenantId,
              title: `Fallo en notificación: ${comm.subject}`,
              type: OperationalTaskType.COMMUNICATION_FAILED,
            },
          });
        }

        this.logger.warn("COMMUNICATION_SEND_FAILED_TASK_CREATED", "FAILURE", {
          communicationId: comm.id,
          error: sendResult.sanitizedErrorCode ?? "SEND_FAILED",
        });

        await recordAudit(tx, context, {
          action: "communication.send_failed",
          metadata: {
            communicationId: comm.id,
            error: sendResult.sanitizedErrorCode ?? "SEND_FAILED",
          },
          resourceId: comm.id,
          resourceType: "communication",
        });

        return updated;
      }
    });
  }

  async recordDeliveryEvidence(params: RecordDeliveryEvidenceInput) {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const comm = await tx.communication.findFirst({
        include: {
          attempts: {
            orderBy: { sequence: "desc" },
            take: 1,
          },
        },
        where: { id: params.communicationId, tenantId: context.tenantId },
      });

      if (!comm) throw new Error("COMMUNICATION_NOT_FOUND");
      if (comm.lifecycle === CommunicationLifecycle.DELIVERED) {
        return comm; // Already delivered idempotently
      }
      if (comm.lifecycle !== CommunicationLifecycle.SENT) {
        throw new Error("CANNOT_RECORD_DELIVERY_FOR_UNSENT_COMMUNICATION");
      }

      const nextSequence = (comm.attempts[0]?.sequence ?? 0) + 1;
      const now = new Date();

      await tx.communicationAttempt.create({
        data: {
          attemptedAt: now,
          communicationId: comm.id,
          completedAt: now,
          deliveryEvidence: (params.evidence ?? {}) as Prisma.InputJsonValue,
          provider: "DEVELOPMENT_EMAIL_ADAPTER",
          providerReference: params.providerReference ?? null,
          sequence: nextSequence,
          technicalStatus: CommunicationAttemptStatus.DELIVERED,
          tenantId: context.tenantId,
        },
      });

      const updated = await tx.communication.update({
        data: {
          lifecycle: CommunicationLifecycle.DELIVERED,
        },
        where: { id: comm.id },
      });

      await recordAudit(tx, context, {
        action: "communication.delivered",
        metadata: {
          applicationId: comm.applicationId,
          communicationId: comm.id,
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return updated;
    });
  }

  async retryCommunication(params: RetryCommunicationInput) {
    const context = getRequiredTenantContext();
    if (!(context.capabilities ?? []).includes(PERMISSIONS.COMMUNICATION_RETRY)) {
      throw new ForbiddenError();
    }

    return withTenantTransaction(this.prisma, async (tx) => {
      const comm = await tx.communication.findFirst({
        where: { id: params.communicationId, tenantId: context.tenantId },
      });

      if (!comm) throw new Error("COMMUNICATION_NOT_FOUND");
      if (comm.lifecycle !== CommunicationLifecycle.FAILED) {
        throw new Error("CANNOT_RETRY_NON_FAILED_COMMUNICATION");
      }

      const updated = await tx.communication.update({
        data: {
          lifecycle: CommunicationLifecycle.CONFIRMED,
          versionNumber: { increment: 1 },
        },
        where: { id: comm.id },
      });

      const outbox = new OutboxService(this.prisma);
      await outbox.enqueue({
        idempotencyKey: `comm:retry:${comm.id}:${updated.versionNumber}`,
        payload: {
          communicationId: comm.id,
          correlationId: context.correlationId,
        },
        topic: COMMUNICATION_SEND_TOPIC,
      });

      await recordAudit(tx, context, {
        action: "communication.retried",
        metadata: {
          communicationId: comm.id,
          versionNumber: updated.versionNumber,
        },
        resourceId: comm.id,
        resourceType: "communication",
      });

      return updated;
    });
  }

  async recordManualContact(params: RecordManualContactInput) {
    const context = getRequiredTenantContext();
    if (!(context.capabilities ?? []).includes(PERMISSIONS.MANUAL_CONTACT_RECORD)) {
      throw new Error("FORBIDDEN_MANUAL_CONTACT_RECORD_CAPABILITY_REQUIRED");
    }

    return withTenantTransaction(this.prisma, async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: params.applicationId, tenantId: context.tenantId },
      });
      if (!app) throw new Error("APPLICATION_NOT_FOUND");

      const contact = await tx.manualContact.create({
        data: {
          actorId: context.actorId,
          applicationId: params.applicationId,
          contactedAt: new Date(),
          notes: params.notes ?? null,
          outcome: params.outcome,
          purpose: params.purpose,
          tenantId: context.tenantId,
        },
      });

      await recordAudit(tx, context, {
        action: "manual_contact.recorded",
        metadata: {
          applicationId: params.applicationId,
          outcome: params.outcome,
          purpose: params.purpose,
        },
        resourceId: contact.id,
        resourceType: "manual_contact",
      });

      return contact;
    });
  }

  async listCommunicationsForApplication(applicationId: string) {
    const context = getRequiredTenantContext();
    if (!(context.capabilities ?? []).includes(PERMISSIONS.COMMUNICATION_READ)) {
      throw new ForbiddenError();
    }

    return withTenantTransaction(this.prisma, async (tx) => {
      return tx.communication.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          applicationId,
          tenantId: context.tenantId,
        },
      });
    });
  }
}
