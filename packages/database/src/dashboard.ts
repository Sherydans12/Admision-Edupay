import { PERMISSIONS } from "./permission-catalog.js";
import { getRequiredTenantContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";
import {
  AdmissionOfferLifecycle,
  ApplicationStatus,
  DocumentFunctionalStatus,
  WaitlistEntryState,
  type PrismaClient,
} from "./generated/prisma/client.js";

export interface OperationalDashboardMetrics {
  documentCorrectionsExpiringCount: number;
  documentsPendingReviewCount: number;
  newApplicationsCount: number;
  offersExpiringCount: number;
  upcomingAppointmentsCount: number;
  waitingDecisionCount: number;
  waitlistCount: number;
}

export class OperationalDashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDashboardMetrics(
    now = new Date(),
  ): Promise<OperationalDashboardMetrics> {
    const context = getRequiredTenantContext();

    if (!(context.capabilities ?? []).includes(PERMISSIONS.DASHBOARD_READ)) {
      throw new Error("FORBIDDEN_DASHBOARD_READ_CAPABILITY_REQUIRED");
    }

    return withTenantTransaction(this.prisma, async (tx) => {
      const tenantId = context.tenantId;

      // 1. New applications count (submitted applications)
      const newApplicationsCount = await tx.application.count({
        where: {
          status: ApplicationStatus.SUBMITTED,
          tenantId,
        },
      });

      // 2. Documents pending review count (CARGADO or EN_REVISION)
      const documentsPendingReviewCount = await tx.documentSubmission.count({
        where: {
          status: {
            in: [
              DocumentFunctionalStatus.CARGADO,
              DocumentFunctionalStatus.EN_REVISION,
            ],
          },
          tenantId,
        },
      });

      // 3. Document corrections expiring count (OBSERVADO with correctionDueAt set)
      const correctionLeadWindow = new Date(
        now.getTime() + 72 * 60 * 60 * 1000,
      ); // 72h window
      const documentCorrectionsExpiringCount =
        await tx.documentSubmission.count({
          where: {
            correctionDueAt: {
              lte: correctionLeadWindow,
            },
            status: DocumentFunctionalStatus.OBSERVADO,
            tenantId,
          },
        });

      // 4. Upcoming appointments count (PROGRAMADA or REPROGRAMADA)
      const upcomingAppointmentsCount = await tx.activityAppointment.count({
        where: {
          scheduledStartAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
          status: {
            in: ["PROGRAMADA", "REPROGRAMADA"],
          },
          tenantId,
        },
      });

      // 5. Waiting decision count (Applications SUBMITTED without a final DirectionDecision)
      const waitingDecisionCount = await tx.application.count({
        where: {
          directionDecision: {
            is: null,
          },
          status: ApplicationStatus.SUBMITTED,
          tenantId,
        },
      });

      // 6. Offers expiring count (ACTIVE offer versions expiring within 48h)
      const offerExpiryWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const offersExpiringCount = await tx.admissionOfferVersion.count({
        where: {
          expiresAt: {
            lte: offerExpiryWindow,
          },
          lifecycle: AdmissionOfferLifecycle.ACTIVE,
          tenantId,
        },
      });

      // 7. Waitlist count (ACTIVE waitlist entries)
      const waitlistCount = await tx.waitlistEntry.count({
        where: {
          state: WaitlistEntryState.ACTIVE,
          tenantId,
        },
      });

      return {
        documentCorrectionsExpiringCount,
        documentsPendingReviewCount,
        newApplicationsCount,
        offersExpiringCount,
        upcomingAppointmentsCount,
        waitingDecisionCount,
        waitlistCount,
      };
    });
  }
}
