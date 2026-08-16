import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ApplicationAuthorityService,
  CapacityOfferService,
  DevelopmentBusinessCalendar,
  PERMISSIONS,
  RecommendationService,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
  withTenantTransaction,
} from "@admission/database";

import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});
const tenantId = randomUUID();
const familyUserId = randomUUID();
const otherFamilyUserId = randomUUID();
const admissionUserId = randomUUID();
const directionUserId = randomUUID();
const familyProfileId = randomUUID();
let campusId = "";
let yearId = "";
let levelId = "";

function tenantContext(
  actorId: string,
  capabilities: readonly string[],
): TenantExecutionContext {
  return {
    actorId,
    capabilities,
    contextOrigin: "synthetic_test",
    correlationId: `e5f-${randomUUID()}`,
    effectiveActorId: actorId,
    purpose: "E5F_TEST",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

const admission = () =>
  tenantContext(admissionUserId, [
    PERMISSIONS.APPLICATION_RECOMMEND,
    PERMISSIONS.RESTRICTED_READ,
  ]);
const staff = () =>
  tenantContext(directionUserId, [
    PERMISSIONS.APPLICATION_DECIDE,
    PERMISSIONS.APPLICATION_AUTHORITY_REVIEW,
    PERMISSIONS.CAPACITY_MANAGE,
    PERMISSIONS.CAPACITY_READ,
    PERMISSIONS.OFFER_READ,
    PERMISSIONS.OFFER_REOPEN,
    PERMISSIONS.RESTRICTED_READ,
    PERMISSIONS.WAITLIST_PROMOTE,
    PERMISSIONS.WAITLIST_READ,
  ]);
const applicant = (actorId = familyUserId) =>
  ({
    ...tenantContext(actorId, [
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
      PERMISSIONS.APPLICATION_READ,
    ]),
    contextOrigin: "family_application",
  }) as TenantExecutionContext;
const family = (actorId = familyUserId): FamilyExecutionContext => ({
  actorId,
  contextOrigin: "synthetic_test",
  correlationId: `e5f-family-${randomUUID()}`,
  effectiveActorId: actorId,
  familyCapabilities: [
    PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
    PERMISSIONS.APPLICATION_AUTHORITY_READ,
    PERMISSIONS.APPLICATION_READ,
  ],
  purpose: "E5F_TEST",
  source: "authenticated_request",
});
const job = (): TenantExecutionContext => ({
  actorId: "00000000-0000-4000-8000-000000000005",
  capabilities: [],
  contextOrigin: "trusted_job",
  correlationId: `e5f-job-${randomUUID()}`,
  purpose: "E5F_OFFER_EXPIRY",
  source: "trusted_job",
  tenantId,
});

const capacityService = new CapacityOfferService(prisma);
const recommendationService = new RecommendationService(prisma);
const authorityService = new ApplicationAuthorityService(prisma);

async function createOffering(configuredCapacity = 1, validity = 3) {
  const ids = await runWithTenantContext(staff(), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const suffix = randomUUID().slice(0, 8);
      const form = await transaction.formDefinition.create({
        data: {
          name: `Formulario E5-F ${suffix}`,
          purpose: "admission_application",
          tenantId,
        },
      });
      const formVersion = await transaction.formVersion.create({
        data: {
          formDefinitionId: form.id,
          lifecycle: "PUBLISHED",
          publishedAt: new Date(),
          tenantId,
          versionNumber: 1,
        },
      });
      const process = await transaction.admissionProcess.create({
        data: {
          academicYearId: yearId,
          code: `P-${suffix}`,
          name: `Proceso E5-F ${suffix}`,
          status: "PUBLISHED",
          tenantId,
        },
      });
      const offering = await transaction.admissionOffering.create({
        data: {
          academicYearId: yearId,
          availabilityCategory: "POSTULATIONS_OPEN",
          campusId,
          code: `O-${suffix}`,
          courseLevelId: levelId,
          formVersionId: formVersion.id,
          processId: process.id,
          status: "PUBLISHED",
          tenantId,
          title: `Oferta E5-F ${suffix}`,
        },
      });
      return { formVersionId: formVersion.id, offeringId: offering.id };
    }),
  );
  const capacity = await runWithTenantContext(staff(), () =>
    capacityService.createCapacity(staff(), ids.offeringId, {
      configuredCapacity,
      offerValidityBusinessDays: validity,
    }),
  );
  return { ...ids, capacity };
}

async function createSubmittedApplication(
  offeringId: string,
  formVersionId: string,
) {
  const applicationId = await runWithTenantContext(admission(), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const offering = await transaction.admissionOffering.findUniqueOrThrow({
        where: { id: offeringId },
      });
      const student = await transaction.student.create({
        data: {
          dateOfBirth: new Date("2012-08-09T00:00:00.000Z"),
          familyName: "Sintético",
          familyProfileId,
          givenName: `E5-F ${randomUUID().slice(0, 6)}`,
        },
      });
      const submittedAt = new Date();
      const application = await transaction.application.create({
        data: {
          academicYearId: offering.academicYearId,
          draftData: { acknowledgedNoGuarantee: true, currentStep: "REVIEW" },
          familyProfileId,
          formVersionId,
          offeringId,
          processId: offering.processId,
          status: "DRAFT",
          studentId: student.id,
          submittedAt: null,
          tenantId,
        },
      });
      await transaction.applicationSnapshot.create({
        data: {
          applicationId: application.id,
          formVersionId,
          payload: { answers: {}, fixture: "synthetic-e5f" },
          schemaVersion: 1,
          submittedAt,
          submittedBy: admissionUserId,
          tenantId,
        },
      });
      return application.id;
    }),
  );
  const declaration = await runWithFamilyContext(family(), () =>
    runWithTenantContext(applicant(), () =>
      authorityService.declareApplicationAuthority(
        family(),
        applicant(),
        applicationId,
        {
          authorityBasis: "PARENT",
          relationship: "MOTHER",
          subjectMode: "MINOR_REPRESENTATIVE",
        },
      ),
    ),
  );
  const review = await runWithTenantContext(staff(), () =>
    authorityService.reviewApplicationAuthority(staff(), applicationId, {
      expectedConcurrencyVersion: declaration.concurrencyVersion!,
      reason: "Fixture de autoridad E5-F",
      toStatus: "UNDER_REVIEW",
    }),
  );
  await runWithTenantContext(staff(), () =>
    authorityService.reviewApplicationAuthority(staff(), applicationId, {
      expectedConcurrencyVersion: review.concurrencyVersion!,
      reason: "Verificación de fixture E5-F",
      toStatus: "VERIFIED",
    }),
  );
  await runWithTenantContext(staff(), () =>
    withTenantTransaction(prisma, (transaction) =>
      transaction.application.update({
        data: { status: "SUBMITTED", submittedAt: new Date() },
        where: { id: applicationId },
      }),
    ),
  );
  return applicationId;
}

async function decide(
  applicationId: string,
  disposition: "APROBADO" | "LISTA_DE_ESPERA",
) {
  const draft = await runWithTenantContext(admission(), () =>
    recommendationService.createDraft(admission(), applicationId, {
      foundation: "Fundamento sintético E5-F.",
      option: "RECOMENDAR_ADMISION",
    }),
  );
  const submitted = await runWithTenantContext(admission(), () =>
    recommendationService.submitRecommendation(admission(), draft.id),
  );
  return runWithTenantContext(staff(), () =>
    recommendationService.recordDirectionDecision(staff(), applicationId, {
      disposition,
      expectedRecommendationVersionId: submitted.id,
    }),
  );
}

async function rawState(applicationId: string) {
  return runWithTenantContext(staff(), () =>
    withTenantTransaction(prisma, async (transaction) => ({
      acceptance: await transaction.offerAcceptance.findFirst({
        where: { applicationId },
      }),
      application: await transaction.application.findUniqueOrThrow({
        where: { id: applicationId },
      }),
      reservation: await transaction.seatReservation.findFirst({
        where: { applicationId },
      }),
      withdrawal: await transaction.applicationWithdrawal.findFirst({
        where: { applicationId },
      }),
    })),
  );
}

beforeAll(async () => {
  await migrationPool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
    tenantId,
    "Tenant E5-F sintético",
  ]);
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, email_verified_at)
     VALUES ($1,$2,CURRENT_TIMESTAMP),($3,$4,CURRENT_TIMESTAMP),($5,$6,CURRENT_TIMESTAMP),($7,$8,CURRENT_TIMESTAMP)`,
    [
      familyUserId,
      `e5f-family-${familyUserId}@example.invalid`,
      otherFamilyUserId,
      `e5f-other-${otherFamilyUserId}@example.invalid`,
      admissionUserId,
      `e5f-admission-${admissionUserId}@example.invalid`,
      directionUserId,
      `e5f-direction-${directionUserId}@example.invalid`,
    ],
  );
  await migrationPool.query(
    "INSERT INTO family_profiles (id, user_id, display_name) VALUES ($1,$2,$3)",
    [familyProfileId, familyUserId, "Familia E5-F sintética"],
  );
  await runWithTenantContext(staff(), () =>
    withTenantTransaction(prisma, async (transaction) => {
      const campus = await transaction.campus.create({
        data: { code: "E5F-CAMPUS", name: "Sede E5-F", tenantId },
      });
      const year = await transaction.academicYear.create({
        data: {
          code: "E5F-YEAR",
          label: "Año E5-F",
          status: "OPEN",
          tenantId,
        },
      });
      const level = await transaction.courseLevel.create({
        data: { code: "E5F-LEVEL", name: "Nivel E5-F", tenantId },
      });
      campusId = campus.id;
      yearId = year.id;
      levelId = level.id;
    }),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe.sequential("E5-F capacity, waitlist, offers and withdrawal", () => {
  it("CAP-01..06: configures once, validates versions, and preserves adjustment evidence", async () => {
    const fixture = await createOffering(2);
    expect(fixture.capacity).toMatchObject({
      availableCount: 2,
      configuredCapacity: 2,
      consumedCount: 0,
      offerValidityBusinessDays: 3,
    });
    await expect(
      runWithTenantContext(staff(), () =>
        capacityService.createCapacity(staff(), fixture.offeringId, {
          configuredCapacity: 2,
        }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_ALREADY_CONFIGURED" });
    const adjusted = await runWithTenantContext(staff(), () =>
      capacityService.adjustCapacity(staff(), fixture.offeringId, {
        configuredCapacity: 3,
        expectedVersion: fixture.capacity.concurrencyVersion,
        offerValidityBusinessDays: 5,
        reason: "Ajuste sintético aprobado.",
      }),
    );
    expect(adjusted).toMatchObject({
      configuredCapacity: 3,
      concurrencyVersion: 2,
      offerValidityBusinessDays: 5,
    });
    expect(adjusted.adjustments).toHaveLength(1);
    await expect(
      runWithTenantContext(staff(), () =>
        capacityService.adjustCapacity(staff(), fixture.offeringId, {
          configuredCapacity: 4,
          expectedVersion: 1,
          reason: "Versión obsoleta sintética.",
        }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_VERSION_CHANGED" });
  });

  it("RES-01..04 and CON-01: twenty approvals cannot oversubscribe the last seat", async () => {
    const fixture = await createOffering(1);
    const applicationIds = await Promise.all(
      Array.from({ length: 20 }, () =>
        createSubmittedApplication(fixture.offeringId, fixture.formVersionId),
      ),
    );
    const results = await Promise.allSettled(
      applicationIds.map((applicationId) => decide(applicationId, "APROBADO")),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const counts = await runWithTenantContext(staff(), () =>
      withTenantTransaction(prisma, async (transaction) => ({
        activeReservations: await transaction.seatReservation.count({
          where: { offeringId: fixture.offeringId, state: "ACTIVE" },
        }),
        offers: await transaction.admissionOffer.count({
          where: { offeringId: fixture.offeringId },
        }),
      })),
    );
    expect(counts).toEqual({ activeReservations: 1, offers: 1 });
    const capacity = await runWithTenantContext(staff(), () =>
      capacityService.getCapacity(staff(), fixture.offeringId),
    );
    expect(capacity).toMatchObject({ availableCount: 0, consumedCount: 1 });
    await expect(
      runWithTenantContext(staff(), () =>
        capacityService.adjustCapacity(staff(), fixture.offeringId, {
          configuredCapacity: 0,
          expectedVersion: capacity.concurrencyVersion,
          reason: "No debe bajar bajo consumo.",
        }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_BELOW_CONSUMED_SEATS" });
  });

  it("WAIT-01..09: orders internally, promotes only the first, and keeps family projection rank-free", async () => {
    const fixture = await createOffering(1);
    const firstApplication = await createSubmittedApplication(
      fixture.offeringId,
      fixture.formVersionId,
    );
    const secondApplication = await createSubmittedApplication(
      fixture.offeringId,
      fixture.formVersionId,
    );
    await decide(firstApplication, "LISTA_DE_ESPERA");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await decide(secondApplication, "LISTA_DE_ESPERA");
    const ordered = await runWithTenantContext(staff(), () =>
      capacityService.listWaitlist(staff(), fixture.offeringId),
    );
    expect(ordered.map((entry) => entry.internalPosition)).toEqual([1, 2]);
    await expect(
      runWithTenantContext(staff(), () =>
        capacityService.promoteWaitlistEntry(staff(), ordered[1]!.id, {
          expectedCapacityVersion: fixture.capacity.concurrencyVersion,
          expectedWaitlistEntryVersion: ordered[1]!.concurrencyVersion,
        }),
      ),
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_NOT_FIRST" });
    const promoted = await runWithTenantContext(staff(), () =>
      capacityService.promoteWaitlistEntry(staff(), ordered[0]!.id, {
        expectedCapacityVersion: fixture.capacity.concurrencyVersion,
        expectedWaitlistEntryVersion: ordered[0]!.concurrencyVersion,
      }),
    );
    expect(promoted).toMatchObject({ origin: "WAITLIST" });
    expect(promoted.current.origin).toBe("WAITLIST");
    const projection = await runWithTenantContext(applicant(), () =>
      capacityService.getFamilyProjection(
        family(),
        applicant(),
        secondApplication,
      ),
    );
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toMatch(
      /position|priority|capacity|availableCount/i,
    );
    expect(projection.waitlist?.state).toBe("ACTIVE");
    await expect(
      runWithTenantContext(staff(), () =>
        capacityService.promoteWaitlistEntry(staff(), ordered[0]!.id, {
          expectedCapacityVersion: fixture.capacity.concurrencyVersion,
          expectedWaitlistEntryVersion: ordered[0]!.concurrencyVersion,
        }),
      ),
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_VERSION_CHANGED" });
  });

  it("OFF-01..06: issues an auditable version with exact configurable business-day expiry", async () => {
    const calendar = new DevelopmentBusinessCalendar();
    expect(
      calendar.addBusinessDays(new Date("2026-08-14T15:00:00.000Z"), 3),
    ).toEqual(new Date("2026-08-19T15:00:00.000Z"));
    const fixture = await createOffering(1, 5);
    const applicationId = await createSubmittedApplication(
      fixture.offeringId,
      fixture.formVersionId,
    );
    await decide(applicationId, "APROBADO");
    const offer = await runWithTenantContext(staff(), () =>
      capacityService.getStaffOffer(staff(), applicationId),
    );
    expect(offer.current).toMatchObject({
      lifecycle: "ACTIVE",
      origin: "NORMAL",
      previousVersionId: null,
      versionNumber: 1,
    });
    const issuedAt = new Date(offer.current.issuedAt);
    expect(new Date(offer.current.expiresAt)).toEqual(
      calendar.addBusinessDays(issuedAt, 5),
    );
    const outbox = await runWithTenantContext(staff(), () =>
      withTenantTransaction(prisma, (transaction) =>
        transaction.outboxMessage.findFirst({
          where: { idempotencyKey: `offer-expiry:${offer.current.id}` },
        }),
      ),
    );
    expect(outbox).toMatchObject({ topic: "admission.offer.expire" });
  });

  it("OFF-07..10 and OFF-CON-01: accepts once, commits one seat, and rejects a competing decline", async () => {
    const fixture = await createOffering(1);
    const applicationId = await createSubmittedApplication(
      fixture.offeringId,
      fixture.formVersionId,
    );
    await decide(applicationId, "APROBADO");
    const offer = await runWithTenantContext(staff(), () =>
      capacityService.getStaffOffer(staff(), applicationId),
    );
    const expected = { expectedOfferVersionId: offer.current.id };
    const results = await Promise.allSettled([
      runWithTenantContext(applicant(), () =>
        capacityService.acceptOffer(family(), applicant(), offer.id, expected),
      ),
      runWithTenantContext(applicant(), () =>
        capacityService.declineOffer(family(), applicant(), offer.id, expected),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const current = await runWithTenantContext(staff(), () =>
      capacityService.getStaffOffer(staff(), applicationId),
    );
    expect(["ACCEPTED", "DECLINED"]).toContain(current.current.lifecycle);
    const state = await rawState(applicationId);
    if (current.current.lifecycle === "ACCEPTED") {
      expect(state.acceptance).not.toBeNull();
      expect(state.reservation?.state).toBe("COMMITTED");
      await expect(
        runWithTenantContext(applicant(), () =>
          capacityService.acceptOffer(
            family(),
            applicant(),
            offer.id,
            expected,
          ),
        ),
      ).resolves.toMatchObject({ current: { lifecycle: "ACCEPTED" } });
    } else {
      expect(state.acceptance).toBeNull();
      expect(state.reservation?.state).toBe("RELEASED");
    }
  });

  it("OFF-11..14 and OFF-CON-02: expiry releases once; reopen creates a new linked version and stale jobs no-op", async () => {
    const fixture = await createOffering(1);
    const applicationId = await createSubmittedApplication(
      fixture.offeringId,
      fixture.formVersionId,
    );
    await decide(applicationId, "APROBADO");
    const original = await runWithTenantContext(staff(), () =>
      capacityService.getStaffOffer(staff(), applicationId),
    );
    await expect(
      runWithTenantContext(job(), () =>
        capacityService.expireOfferVersion(
          job(),
          original.current.id,
          new Date(original.current.expiresAt),
        ),
      ),
    ).resolves.toBe("EXPIRED");
    await expect(
      runWithTenantContext(job(), () =>
        capacityService.expireOfferVersion(
          job(),
          original.current.id,
          new Date(original.current.expiresAt),
        ),
      ),
    ).resolves.toBe("NOOP_TERMINAL");
    const capacity = await runWithTenantContext(staff(), () =>
      capacityService.getCapacity(staff(), fixture.offeringId),
    );
    expect(capacity.availableCount).toBe(1);
    const reopened = await runWithTenantContext(staff(), () =>
      capacityService.reopenOffer(staff(), original.id, {
        expectedCapacityVersion: capacity.concurrencyVersion,
        expectedOfferVersionId: original.current.id,
        reason: "Reapertura sintética autorizada.",
      }),
    );
    expect(reopened.history).toHaveLength(2);
    expect(reopened.current).toMatchObject({
      lifecycle: "ACTIVE",
      previousVersionId: original.current.id,
      reopenReason: "Reapertura sintética autorizada.",
      versionNumber: 2,
    });
    await expect(
      runWithTenantContext(job(), () =>
        capacityService.expireOfferVersion(
          job(),
          original.current.id,
          new Date(reopened.current.expiresAt),
        ),
      ),
    ).resolves.toBe("NOOP_STALE");
  });

  it("WDR-01..04: confirmed withdrawal is idempotent and releases an active offer exactly once", async () => {
    const fixture = await createOffering(1);
    const applicationId = await createSubmittedApplication(
      fixture.offeringId,
      fixture.formVersionId,
    );
    await decide(applicationId, "APROBADO");
    await expect(
      runWithTenantContext(applicant(), () =>
        capacityService.withdrawApplication(
          family(),
          applicant(),
          applicationId,
          false,
        ),
      ),
    ).rejects.toThrow("Explicit confirmation is required");
    const first = await runWithTenantContext(applicant(), () =>
      capacityService.withdrawApplication(
        family(),
        applicant(),
        applicationId,
        true,
      ),
    );
    const second = await runWithTenantContext(applicant(), () =>
      capacityService.withdrawApplication(
        family(),
        applicant(),
        applicationId,
        true,
      ),
    );
    expect(second.id).toBe(first.id);
    const state = await rawState(applicationId);
    expect(state.application.status).toBe("WITHDRAWN");
    expect(state.reservation?.state).toBe("RELEASED");
    expect(state.withdrawal?.id).toBe(first.id);
  });

  it("WDR-05..07: withdrawal removes an active waitlist entry, enforces ownership, and races safely with acceptance", async () => {
    const waitFixture = await createOffering(1);
    const waitingApplication = await createSubmittedApplication(
      waitFixture.offeringId,
      waitFixture.formVersionId,
    );
    await decide(waitingApplication, "LISTA_DE_ESPERA");
    await expect(
      runWithTenantContext(applicant(otherFamilyUserId), () =>
        capacityService.withdrawApplication(
          family(otherFamilyUserId),
          applicant(otherFamilyUserId),
          waitingApplication,
          true,
        ),
      ),
    ).rejects.toThrow();
    await runWithTenantContext(applicant(), () =>
      capacityService.withdrawApplication(
        family(),
        applicant(),
        waitingApplication,
        true,
      ),
    );
    const waitlist = await runWithTenantContext(staff(), () =>
      capacityService.listWaitlist(staff(), waitFixture.offeringId),
    );
    expect(waitlist[0]?.state).toBe("WITHDRAWN");

    const offerFixture = await createOffering(1);
    const offeredApplication = await createSubmittedApplication(
      offerFixture.offeringId,
      offerFixture.formVersionId,
    );
    await decide(offeredApplication, "APROBADO");
    const offer = await runWithTenantContext(staff(), () =>
      capacityService.getStaffOffer(staff(), offeredApplication),
    );
    const outcomes = await Promise.allSettled([
      runWithTenantContext(applicant(), () =>
        capacityService.acceptOffer(family(), applicant(), offer.id, {
          expectedOfferVersionId: offer.current.id,
        }),
      ),
      runWithTenantContext(applicant(), () =>
        capacityService.withdrawApplication(
          family(),
          applicant(),
          offeredApplication,
          true,
        ),
      ),
    ]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const final = await rawState(offeredApplication);
    expect(Boolean(final.acceptance) !== Boolean(final.withdrawal)).toBe(true);
  });
});
