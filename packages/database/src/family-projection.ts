import { ForbiddenError } from "./authorization.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";
import {
  AdmissionOfferLifecycle,
  DirectionDisposition,
  DocumentFunctionalStatus,
  type PrismaClient,
} from "./generated/prisma/client.js";

export interface FamilyDocumentProjection {
  correctionDueAt: string | null;
  id: string;
  observedReason: string | null;
  requirementCode: string;
  requirementName: string;
  status: DocumentFunctionalStatus;
}

export interface FamilyActivityProjection {
  activityName: string;
  activityType: string;
  id: string;
  location: string;
  scheduledStartAt: string;
  status: string;
}

export interface FamilyOfferProjection {
  acceptedAt: string | null;
  acceptanceNotice: string;
  allowedActions: ("ACCEPT" | "DECLINE")[];
  expiresAt: string;
  id: string;
  lifecycle: AdmissionOfferLifecycle;
  origin: "NORMAL" | "WAITLIST";
  secondsRemaining: number;
}

export interface FamilyHistoryEventProjection {
  description: string;
  id: string;
  timestamp: string;
  type: string;
}

export interface FamilyApplicationProjection {
  academicYearLabel: string;
  activities: FamilyActivityProjection[];
  applicationId: string;
  campusName: string;
  communicableResult: "APROBADO" | "LISTA_DE_ESPERA" | "RECHAZADO" | null;
  courseLevelName: string;
  documents: FamilyDocumentProjection[];
  history: FamilyHistoryEventProjection[];
  offeringTitle: string;
  offerProjection: FamilyOfferProjection | null;
  status: string;
  studentGivenName: string;
  submittedAt: string | null;
  waitlistActive: boolean;
}

export class FamilyApplicationProjectionService {
  constructor(private readonly prisma: PrismaClient) {}

  async getFamilyApplicationProjection(
    applicationId: string,
    now = new Date(),
  ): Promise<FamilyApplicationProjection> {
    const context = getRequiredTenantContext();

    return withTenantTransaction(this.prisma, async (tx) => {
      const app = await tx.application.findFirst({
        include: {
          academicYear: true,
          activities: {
            include: {
              currentAppointment: true,
              definition: true,
            },
          },
          admissionOffers: {
            include: {
              acceptance: true,
              currentVersion: true,
            },
          },
          communications: {
            orderBy: { createdAt: "asc" },
            where: {
              lifecycle: { in: ["SENT", "DELIVERED"] },
            },
          },
          directionDecision: {
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          },
          documentSubmissions: {
            include: {
              requirement: true,
              reviews: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
          familyProfile: true,
          offering: {
            include: {
              campus: true,
              courseLevel: true,
            },
          },
          process: true,
          student: true,
          waitlistEntries: {
            where: { state: "ACTIVE" },
          },
          withdrawals: true,
        },
        where: {
          id: applicationId,
          tenantId: context.tenantId,
        },
      });

      if (!app) {
        throw new Error("APPLICATION_NOT_FOUND");
      }

      // Check family ownership
      if (app.familyProfile.userId !== context.actorId) {
        throw new ForbiddenError();
      }

      // Determine communicable result only if direction decision exists and has been communicated or is ready
      const latestDecisionVer = app.directionDecision?.versions[0];
      let communicableResult: "APROBADO" | "LISTA_DE_ESPERA" | "RECHAZADO" | null = null;

      if (latestDecisionVer) {
        if (latestDecisionVer.disposition === DirectionDisposition.APROBADO) {
          communicableResult = "APROBADO";
        } else if (latestDecisionVer.disposition === DirectionDisposition.LISTA_DE_ESPERA) {
          communicableResult = "LISTA_DE_ESPERA";
        } else if (latestDecisionVer.disposition === DirectionDisposition.RECHAZADO) {
          communicableResult = "RECHAZADO";
        }
        // DEVUELTO_A_REVISION remains null for communicableResult
      }

      // Documents projection (omits internal technical errors/notes)
      const documents: FamilyDocumentProjection[] = app.documentSubmissions.map((sub) => {
        const lastReview = sub.reviews[0];
        const observedReason =
          sub.status === DocumentFunctionalStatus.OBSERVADO && lastReview
            ? lastReview.reason
            : null;
        return {
          correctionDueAt: sub.correctionDueAt?.toISOString() ?? null,
          id: sub.id,
          observedReason,
          requirementCode: sub.requirement.code,
          requirementName: sub.requirement.name,
          status: sub.status,
        };
      });

      // Activities projection (omits results, comments, internal scores)
      const activities: FamilyActivityProjection[] = app.activities
        .filter((act) => act.currentAppointment !== null)
        .map((act) => ({
          activityName: act.definition.name,
          activityType: act.definition.kind,
          id: act.id,
          location: act.currentAppointment!.location,
          scheduledStartAt: act.currentAppointment!.scheduledStartAt.toISOString(),
          status: act.currentAppointment!.status,
        }));

      // Offer projection
      let offerProjection: FamilyOfferProjection | null = null;
      const offer = app.admissionOffers[0];
      if (offer && offer.currentVersion) {
        const curVer = offer.currentVersion;
        const secondsRemaining = Math.max(
          0,
          Math.floor((curVer.expiresAt.getTime() - now.getTime()) / 1000),
        );

        const allowedActions: ("ACCEPT" | "DECLINE")[] = [];
        if (curVer.lifecycle === AdmissionOfferLifecycle.ACTIVE && secondsRemaining > 0) {
          allowedActions.push("ACCEPT", "DECLINE");
        }

        offerProjection = {
          acceptedAt: offer.acceptance?.acceptedAt.toISOString() ?? null,
          acceptanceNotice: "Aceptar no equivale a matrícula/pago.",
          allowedActions,
          expiresAt: curVer.expiresAt.toISOString(),
          id: offer.id,
          lifecycle: curVer.lifecycle,
          origin: offer.origin,
          secondsRemaining,
        };
      }

      // Safe history construction
      const history: FamilyHistoryEventProjection[] = [];
      if (app.submittedAt) {
        history.push({
          description: "Postulación enviada correctamente",
          id: `hist-sub-${app.id}`,
          timestamp: app.submittedAt.toISOString(),
          type: "APPLICATION_SUBMITTED",
        });
      }

      for (const comm of app.communications) {
        history.push({
          description: comm.subject,
          id: `hist-comm-${comm.id}`,
          timestamp: comm.createdAt.toISOString(),
          type: `COMMUNICATION_${comm.purpose}`,
        });
      }

      const withdrawal = app.withdrawals[0];
      if (withdrawal) {
        history.push({
          description: "Postulación retirada a solicitud de la familia",
          id: `hist-wdr-${withdrawal.id}`,
          timestamp: withdrawal.confirmedAt.toISOString(),
          type: "APPLICATION_WITHDRAWN",
        });
      }

      // Derive projected status
      let status = "EN_REVISION";
      if (app.status === "WITHDRAWN") {
        status = "RETIRADA";
      } else if (offerProjection?.lifecycle === AdmissionOfferLifecycle.ACCEPTED) {
        status = "OFERTA_ACEPTADA";
      } else if (offerProjection?.lifecycle === AdmissionOfferLifecycle.ACTIVE) {
        status = "OFERTA_EMITIDA";
      } else if (offerProjection?.lifecycle === AdmissionOfferLifecycle.EXPIRED) {
        status = "OFERTA_EXPIRADA";
      } else if (communicableResult === "LISTA_DE_ESPERA" || app.waitlistEntries.length > 0) {
        status = "LISTA_DE_ESPERA";
      } else if (communicableResult === "RECHAZADO") {
        status = "NO_ADMITIDO";
      } else if (communicableResult === "APROBADO") {
        status = "APROBADO";
      }

      return {
        academicYearLabel: app.academicYear.label,
        activities,
        applicationId: app.id,
        campusName: app.offering.campus.name,
        communicableResult,
        courseLevelName: app.offering.courseLevel.name,
        documents,
        history,
        offeringTitle: app.offering.title,
        offerProjection,
        status,
        studentGivenName: app.student.givenName,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        waitlistActive: app.waitlistEntries.length > 0,
      };
    });
  }
}
