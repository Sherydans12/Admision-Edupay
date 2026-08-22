import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BusinessCalendarConflictError,
  BusinessCalendarNotConfiguredError,
  BusinessCalendarService,
  CapacityOfferService,
  CommunicationService,
  InvalidBusinessTimezoneError,
  OFFER_EXPIRY_TOPIC,
  OFFER_REMINDER_PREPARE_TOPIC,
  PERMISSIONS,
  addBusinessDaysAfter,
  applyDirectionDispositionEffects,
  assertValidIanaTimeZone,
  calculateBusinessDeadline,
  calculateOfferReminderAt,
  formatLocalizedDeadline,
  getZonedParts,
  isBusinessDate,
  previousBusinessDate,
  runWithTenantContext,
  validateIanaTimeZone,
  withTenantTransaction,
  type TenantExecutionContext,
} from "./index.js";
import { getRequiredEnvironment } from "./environment.js";
import { createAppPrismaClient } from "./prisma-client.js";

const prisma = createAppPrismaClient();
const migrationPool = new Pool({
  connectionString: getRequiredEnvironment("DATABASE_MIGRATION_URL"),
  connectionTimeoutMillis: 5_000,
});

const tenantA = randomUUID();
const tenantB = randomUUID();
const actorA = randomUUID();
const familyUserId = randomUUID();
const familyProfileId = randomUUID();

function makeContext(
  tenantId: string,
  permissions: readonly string[] = [
    PERMISSIONS.ADMISSION_CONFIG_READ,
    PERMISSIONS.ADMISSION_CONFIG_MANAGE,
    PERMISSIONS.CAPACITY_MANAGE,
    PERMISSIONS.CAPACITY_READ,
    PERMISSIONS.APPLICATION_DECIDE,
    PERMISSIONS.APPLICATION_RECOMMEND,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.OFFER_READ,
    PERMISSIONS.OFFER_REOPEN,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_REVIEW,
    PERMISSIONS.COMMUNICATION_READ,
    PERMISSIONS.COMMUNICATION_CONFIRM,
    PERMISSIONS.RESTRICTED_READ,
  ],
): TenantExecutionContext {
  return {
    actorId: actorA,
    capabilities: [...permissions],
    contextOrigin: "synthetic_test",
    correlationId: randomUUID(),
    effectiveActorId: actorA,
    purpose: "testing",
    scopes: ["*"],
    source: "authenticated_request",
    tenantId,
  };
}

async function seedBaseTenant(tenantId: string, name: string) {
  await migrationPool.query(
    `INSERT INTO tenants (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [tenantId, name],
  );
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [actorA, `actor-${tenantId}@example.cl`],
  );
}

beforeAll(async () => {
  await seedBaseTenant(tenantA, "Tenant A");
  await seedBaseTenant(tenantB, "Tenant B");
  await migrationPool.query(
    `INSERT INTO platform_users (id, email_normalized, email_verified_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [familyUserId, `family-${familyUserId}@example.cl`],
  );
  await migrationPool.query(
    `INSERT INTO family_profiles (id, user_id, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [familyProfileId, familyUserId, "Familia Test BC"],
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await migrationPool.end();
});

describe("G5-PC1-R3: Institutional Business Calendar & Timezone Engine (R3-CAL-*)", () => {
  const service = new BusinessCalendarService(prisma);

  it("R3-CAL-01: accepts standard IANA timezones (America/Santiago, UTC, America/New_York, Europe/Madrid)", () => {
    expect(validateIanaTimeZone("America/Santiago")).toBe(true);
    expect(validateIanaTimeZone("UTC")).toBe(true);
    expect(validateIanaTimeZone("America/New_York")).toBe(true);
    expect(validateIanaTimeZone("Europe/Madrid")).toBe(true);
    expect(validateIanaTimeZone("America/Punta_Arenas")).toBe(true);
    expect(validateIanaTimeZone("Pacific/Easter")).toBe(true);
    expect(assertValidIanaTimeZone("America/Santiago")).toBe(
      "America/Santiago",
    );
  });

  it("R3-CAL-02: denies fixed offsets, numeric offsets and invalid strings (UTC-3, GMT-4, +03:00, -04:00, arbitrary numbers)", () => {
    expect(validateIanaTimeZone("UTC-3")).toBe(false);
    expect(validateIanaTimeZone("UTC+3")).toBe(false);
    expect(validateIanaTimeZone("GMT-4")).toBe(false);
    expect(validateIanaTimeZone("+03:00")).toBe(false);
    expect(validateIanaTimeZone("-04:00")).toBe(false);
    expect(validateIanaTimeZone("NotATimezone")).toBe(false);
    expect(validateIanaTimeZone("")).toBe(false);
    expect(() => assertValidIanaTimeZone("UTC-3")).toThrow(
      InvalidBusinessTimezoneError,
    );
  });

  it("R3-CAL-03: validates Monday-Friday as business days and Saturday-Sunday as non-business", () => {
    expect(isBusinessDate("2026-08-24")).toBe(true); // Monday
    expect(isBusinessDate("2026-08-25")).toBe(true); // Tuesday
    expect(isBusinessDate("2026-08-26")).toBe(true); // Wednesday
    expect(isBusinessDate("2026-08-27")).toBe(true); // Thursday
    expect(isBusinessDate("2026-08-28")).toBe(true); // Friday
    expect(isBusinessDate("2026-08-29")).toBe(false); // Saturday
    expect(isBusinessDate("2026-08-30")).toBe(false); // Sunday
  });

  it("R3-CAL-04: excludes configured tenant holiday/recess dates from business days", () => {
    const excluded = new Set(["2026-08-25", "2026-08-26"]);
    expect(isBusinessDate("2026-08-24", excluded)).toBe(true);
    expect(isBusinessDate("2026-08-25", excluded)).toBe(false);
    expect(isBusinessDate("2026-08-26", excluded)).toBe(false);
    expect(isBusinessDate("2026-08-27", excluded)).toBe(true);
  });

  it("R3-CAL-05: addBusinessDaysAfter never counts the start day as day 1 (R3-006)", () => {
    // Issued Monday 2026-08-24 + 1 business day -> Tuesday 2026-08-25
    expect(addBusinessDaysAfter("2026-08-24", 1)).toBe("2026-08-25");
    // Issued Monday 2026-08-24 + 3 business days -> Thursday 2026-08-27
    expect(addBusinessDaysAfter("2026-08-24", 3)).toBe("2026-08-27");
    // Issued Friday 2026-08-28 + 1 business day -> Monday 2026-08-31
    expect(addBusinessDaysAfter("2026-08-28", 1)).toBe("2026-08-31");
  });

  it("R3-CAL-06: previousBusinessDate finds nearest prior working day (R3-009)", () => {
    // Monday 2026-08-24 -> prior business date is Friday 2026-08-21
    expect(previousBusinessDate("2026-08-24")).toBe("2026-08-21");
    // Tuesday 2026-08-25 -> prior business date is Monday 2026-08-24
    expect(previousBusinessDate("2026-08-25")).toBe("2026-08-24");
    // Monday with Friday excluded -> prior business date is Thursday 2026-08-20
    const excluded = new Set(["2026-08-21"]);
    expect(previousBusinessDate("2026-08-24", excluded)).toBe("2026-08-20");
  });

  it("R3-CAL-07: manages calendar CRUD with optimistic concurrency version check", async () => {
    const ctx = makeContext(tenantA);
    const created = await runWithTenantContext(ctx, () =>
      service.configureCalendar(ctx, { timezone: "America/Santiago" }),
    );
    expect(created.timezone).toBe("America/Santiago");
    expect(created.concurrencyVersion).toBe(1);

    // Update with correct expected version
    const updated = await runWithTenantContext(ctx, () =>
      service.configureCalendar(ctx, {
        expectedVersion: 1,
        timezone: "America/Punta_Arenas",
      }),
    );
    expect(updated.timezone).toBe("America/Punta_Arenas");
    expect(updated.concurrencyVersion).toBe(2);

    // Update with stale expected version -> 409 conflict
    await expect(
      runWithTenantContext(ctx, () =>
        service.configureCalendar(ctx, {
          expectedVersion: 1,
          timezone: "America/Santiago",
        }),
      ),
    ).rejects.toBeInstanceOf(BusinessCalendarConflictError);

    // Restore to Santiago
    await runWithTenantContext(ctx, () =>
      service.configureCalendar(ctx, {
        expectedVersion: 2,
        timezone: "America/Santiago",
      }),
    );
  });

  it("R3-CAL-08: manages excluded dates CRUD (list, add, duplicate reject, remove)", async () => {
    const ctx = makeContext(tenantA);
    const added = await runWithTenantContext(ctx, () =>
      service.addExcludedDate(ctx, {
        calendarDate: "2026-09-18",
        reason: "Fiestas Patrias",
      }),
    );
    expect(added.calendarDate).toBe("2026-09-18");
    expect(added.reason).toBe("Fiestas Patrias");

    // Duplicate date rejection
    await expect(
      runWithTenantContext(ctx, () =>
        service.addExcludedDate(ctx, {
          calendarDate: "2026-09-18",
          reason: "Duplicado Fiestas Patrias",
        }),
      ),
    ).rejects.toBeInstanceOf(BusinessCalendarConflictError);

    // List excluded dates
    const list = await runWithTenantContext(ctx, () =>
      service.listExcludedDates(ctx),
    );
    expect(list.some((d) => d.calendarDate === "2026-09-18")).toBe(true);

    // Remove excluded date
    const removed = await runWithTenantContext(ctx, () =>
      service.removeExcludedDate(ctx, added.id),
    );
    expect(removed.removed).toBe(true);

    const listAfter = await runWithTenantContext(ctx, () =>
      service.listExcludedDates(ctx),
    );
    expect(listAfter.some((d) => d.calendarDate === "2026-09-18")).toBe(false);
  });

  it("R3-CAL-09: emits audit events for calendar and excluded date mutations", async () => {
    const ctx = makeContext(tenantA);
    await runWithTenantContext(ctx, () =>
      service.addExcludedDate(ctx, {
        calendarDate: "2026-10-31",
        reason: "Día Nacional de las Iglesias Evangélicas",
      }),
    );

    const audit = await runWithTenantContext(ctx, () =>
      withTenantTransaction(prisma, (tx) =>
        tx.auditEvent.findFirst({
          orderBy: { occurredAt: "desc" },
          where: {
            action: "BUSINESS_CALENDAR_EXCLUDED_DATE_ADDED",
            tenantId: tenantA,
          },
        }),
      ),
    );
    expect(audit).not.toBeNull();
    expect(audit?.action).toBe("BUSINESS_CALENDAR_EXCLUDED_DATE_ADDED");
  });

  it("R3-CAL-10: fail-closed: throws BusinessCalendarNotConfiguredError if tenant calendar missing", async () => {
    const unconfiguredTenant = randomUUID();
    const ctx = makeContext(unconfiguredTenant);
    await seedBaseTenant(unconfiguredTenant, "Unconfigured Tenant");

    await expect(
      runWithTenantContext(ctx, () => service.getEffectiveCalendar(ctx)),
    ).rejects.toBeInstanceOf(BusinessCalendarNotConfiguredError);
  });
});

describe("G5-PC1-R3: Deadline Arithmetic & Santiago DST Engine (R3-DL-*, R3-DST-*)", () => {
  it("R3-DL-01 & R3-DL-02: 3-business-day offer deadline ends at 23:59:59.999 local (issue day not counted)", () => {
    // Issued Monday 2026-08-24 14:00 UTC (10:00 Santiago winter UTC-4)
    const issuedAt = new Date("2026-08-24T14:00:00.000Z");
    const deadline = calculateBusinessDeadline(issuedAt, 3, {
      timezone: "America/Santiago",
    });

    // 3 business days after Monday 24 -> Tuesday 25 (1), Wednesday 26 (2), Thursday 27 (3)
    // Expiry: 2026-08-27 23:59:59.999 Santiago (UTC-4) -> 2026-08-28 03:59:59.999 UTC
    expect(deadline.toISOString()).toBe("2026-08-28T03:59:59.999Z");
    const parts = getZonedParts(deadline, "America/Santiago");
    expect(parts.isoDate).toBe("2026-08-27");
    expect(parts.hour).toBe(23);
    expect(parts.minute).toBe(59);
    expect(parts.second).toBe(59);
    expect(parts.millisecond).toBe(999);
  });

  it("R3-DL-03: weekend traversal correctly pushes deadline", () => {
    // Issued Thursday 2026-08-27 15:00 UTC
    const issuedAt = new Date("2026-08-27T15:00:00.000Z");
    const deadline = calculateBusinessDeadline(issuedAt, 3, {
      timezone: "America/Santiago",
    });

    // Thursday 27 -> Friday 28 (1), Monday 31 (2), Tuesday 01 (3)
    // Expiry: 2026-09-01 23:59:59.999 Santiago (UTC-4) -> 2026-09-02 03:59:59.999 UTC
    expect(deadline.toISOString()).toBe("2026-09-02T03:59:59.999Z");
    const parts = getZonedParts(deadline, "America/Santiago");
    expect(parts.isoDate).toBe("2026-09-01");
  });

  it("R3-DL-04: midweek excluded dates traversal correctly pushes deadline", () => {
    // Issued Monday 2026-08-24, with Wednesday 26 excluded
    const issuedAt = new Date("2026-08-24T14:00:00.000Z");
    const excluded = new Set(["2026-08-26"]);
    const deadline = calculateBusinessDeadline(issuedAt, 3, {
      excludedDates: excluded,
      timezone: "America/Santiago",
    });

    // Monday 24 -> Tuesday 25 (1), [Wed 26 skip], Thursday 27 (2), Friday 28 (3)
    // Expiry: 2026-08-28 23:59:59.999 Santiago -> 2026-08-29 03:59:59.999 UTC
    expect(deadline.toISOString()).toBe("2026-08-29T03:59:59.999Z");
    const parts = getZonedParts(deadline, "America/Santiago");
    expect(parts.isoDate).toBe("2026-08-28");
  });

  it("R3-DST-01: handles America/Santiago winter (UTC-4) correctly", () => {
    // Winter (August): Santiago is UTC-4
    const deadline = calculateBusinessDeadline(
      new Date("2026-08-24T14:00:00.000Z"),
      1,
      { timezone: "America/Santiago" },
    );
    // Tuesday 2026-08-25 23:59:59.999 local -> Wednesday 2026-08-26 03:59:59.999 UTC
    expect(deadline.toISOString()).toBe("2026-08-26T03:59:59.999Z");
  });

  it("R3-DST-02: handles America/Santiago summer (UTC-3) correctly", () => {
    // Summer (November): Santiago is UTC-3 (DST on)
    const deadline = calculateBusinessDeadline(
      new Date("2026-11-23T14:00:00.000Z"), // Monday
      1,
      { timezone: "America/Santiago" },
    );
    // Tuesday 2026-11-24 23:59:59.999 local -> Wednesday 2026-11-25 02:59:59.999 UTC (UTC-3)
    expect(deadline.toISOString()).toBe("2026-11-25T02:59:59.999Z");
  });
});

describe("G5-PC1-R3: Offer Reminder Scheduling & Copy Engine (R3-REM-*)", () => {
  it("R3-REM-01 & R3-REM-02: reminder target is 1 business day before expiry at 10:00:00.000 local", () => {
    // Issued Monday 2026-08-24 14:00 UTC (3 business days -> expires Thursday 2026-08-27 23:59:59.999)
    const issuedAt = new Date("2026-08-24T14:00:00.000Z");
    const expiresAt = calculateBusinessDeadline(issuedAt, 3, {
      timezone: "America/Santiago",
    });

    const reminderAt = calculateOfferReminderAt(issuedAt, expiresAt, {
      timezone: "America/Santiago",
    });
    expect(reminderAt).not.toBeNull();
    // 1 business day before Thursday 27 is Wednesday 26 at 10:00 Santiago (14:00 UTC)
    expect(reminderAt?.toISOString()).toBe("2026-08-26T14:00:00.000Z");
    const parts = getZonedParts(reminderAt!, "America/Santiago");
    expect(parts.isoDate).toBe("2026-08-26");
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(0);
  });

  it("R3-REM-03: Monday expiry has reminder on previous Friday (or Thursday if Friday excluded)", () => {
    // Issued Wednesday 2026-08-26 (3 days -> expires Monday 2026-08-31 23:59:59.999)
    const issuedAt = new Date("2026-08-26T14:00:00.000Z");
    const expiresAt = calculateBusinessDeadline(issuedAt, 3, {
      timezone: "America/Santiago",
    });

    // Reminder on Friday 2026-08-28 at 10:00 Santiago
    const reminderAt = calculateOfferReminderAt(issuedAt, expiresAt, {
      timezone: "America/Santiago",
    });
    expect(reminderAt?.toISOString()).toBe("2026-08-28T14:00:00.000Z");

    // If Friday 28 is excluded -> reminder on Thursday 27
    const excluded = new Set(["2026-08-28"]);
    const reminderAtEx = calculateOfferReminderAt(issuedAt, expiresAt, {
      excludedDates: excluded,
      timezone: "America/Santiago",
    });
    expect(reminderAtEx?.toISOString()).toBe("2026-08-27T14:00:00.000Z");
  });

  it("R3-REM-04: short validity edge case suppresses reminder outbox (returns null)", () => {
    // Issued Monday 2026-08-24 at 15:00 UTC with 1 business day -> expires Tuesday 2026-08-25 23:59:59.999
    // 1 business day before Tuesday is Monday at 10:00 local (14:00 UTC)
    // Since reminder (14:00 UTC) is BEFORE issuedAt (15:00 UTC), reminder is suppressed (null)
    const issuedAt = new Date("2026-08-24T15:00:00.000Z");
    const expiresAt = calculateBusinessDeadline(issuedAt, 1, {
      timezone: "America/Santiago",
    });
    const reminderAt = calculateOfferReminderAt(issuedAt, expiresAt, {
      timezone: "America/Santiago",
    });
    expect(reminderAt).toBeNull();
  });

  it("R3-REM-05: formats localized deadline in Spanish format (DD-MM-YYYY a las HH:mm)", () => {
    const instant = new Date("2026-08-28T03:59:59.999Z"); // 2026-08-27 23:59:59.999 in Santiago
    const formatted = formatLocalizedDeadline(instant, "America/Santiago");
    expect(formatted).toBe("27-08-2026 a las 23:59");
  });
});

describe("G5-PC1-R3: Offer & Document Domain Integration (R3-OFFER-*, R3-DOC-*)", () => {
  const capacityService = new CapacityOfferService(prisma);
  const commService = new CommunicationService(prisma);

  let offeringId: string;
  let applicationId: string;

  beforeAll(async () => {
    const ctx = makeContext(tenantA);
    await runWithTenantContext(ctx, () =>
      withTenantTransaction(prisma, async (tx) => {
        await tx.tenantBusinessCalendar.upsert({
          create: {
            concurrencyVersion: 1,
            tenantId: tenantA,
            timezone: "America/Santiago",
          },
          update: { timezone: "America/Santiago" },
          where: { tenantId: tenantA },
        });

        const campus = await tx.campus.create({
          data: { code: "R3-CAMPUS", name: "Sede R3", tenantId: tenantA },
        });
        const year = await tx.academicYear.create({
          data: {
            code: "R3-YEAR",
            label: "Año R3",
            status: "OPEN",
            tenantId: tenantA,
          },
        });
        const level = await tx.courseLevel.create({
          data: { code: "R3-LEVEL", name: "Nivel R3", tenantId: tenantA },
        });
        const process = await tx.admissionProcess.create({
          data: {
            academicYearId: year.id,
            code: "R3-PROC",
            name: "Proceso R3",
            status: "PUBLISHED",
            tenantId: tenantA,
          },
        });
        const formDef = await tx.formDefinition.create({
          data: { name: "Form R3", purpose: "admission", tenantId: tenantA },
        });
        const formVer = await tx.formVersion.create({
          data: {
            formDefinitionId: formDef.id,
            lifecycle: "PUBLISHED",
            publishedAt: new Date(),
            tenantId: tenantA,
            versionNumber: 1,
          },
        });
        const offering = await tx.admissionOffering.create({
          data: {
            academicYearId: year.id,
            availabilityCategory: "POSTULATIONS_OPEN",
            campusId: campus.id,
            code: "R3-OFFER",
            courseLevelId: level.id,
            formVersionId: formVer.id,
            processId: process.id,
            status: "PUBLISHED",
            tenantId: tenantA,
            title: "Oferta R3 Sintética",
          },
        });
        offeringId = offering.id;

        await tx.admissionCapacity.create({
          data: {
            configuredCapacity: 10,
            concurrencyVersion: 1,
            offeringId: offering.id,
            offerValidityBusinessDays: 3,
            tenantId: tenantA,
          },
        });

        const student = await tx.student.create({
          data: {
            dateOfBirth: new Date("2012-05-15T00:00:00.000Z"),
            familyName: "Sintético R3",
            familyProfileId,
            givenName: "Estudiante R3",
          },
        });

        const app = await tx.application.create({
          data: {
            academicYearId: year.id,
            draftData: { acknowledgedNoGuarantee: true, currentStep: "REVIEW" },
            familyProfileId,
            formVersionId: formVer.id,
            offeringId: offering.id,
            processId: process.id,
            status: "SUBMITTED",
            studentId: student.id,
            submittedAt: new Date(),
            tenantId: tenantA,
          },
        });
        applicationId = app.id;

        await tx.applicationSnapshot.create({
          data: {
            applicationId: app.id,
            formVersionId: formVer.id,
            payload: { answers: {}, fixture: "r3-test" },
            schemaVersion: 1,
            submittedAt: new Date(),
            submittedBy: actorA,
            tenantId: tenantA,
          },
        });
      }),
    );
  });

  it("R3-OFFER-01..03: applyDirectionDispositionEffects (APROBADO) calculates deadline at 23:59:59.999 local and schedules expiry and reminder outbox", async () => {
    const ctx = makeContext(tenantA);
    const issuedAt = new Date("2026-08-24T14:00:00.000Z"); // Monday

    await runWithTenantContext(ctx, () =>
      withTenantTransaction(prisma, async (tx) => {
        await applyDirectionDispositionEffects(tx, ctx, {
          applicationId,
          decisionVersionId: randomUUID(),
          disposition: "APROBADO",
          occurredAt: issuedAt,
          offeringId,
        });
      }),
    );

    const offer = await runWithTenantContext(ctx, () =>
      capacityService.getStaffOffer(ctx, applicationId),
    );
    expect(offer.current).not.toBeNull();

    const expiresAt = new Date(offer.current!.expiresAt);
    const parts = getZonedParts(expiresAt, "America/Santiago");
    expect(parts.isoDate).toBe("2026-08-27");
    expect(parts.hour).toBe(23);
    expect(parts.minute).toBe(59);
    expect(parts.second).toBe(59);
    expect(parts.millisecond).toBe(999);

    // Verify outbox messages
    const expiryMsg = await runWithTenantContext(ctx, () =>
      withTenantTransaction(prisma, (tx) =>
        tx.outboxMessage.findFirst({
          where: {
            idempotencyKey: `offer-expiry:${offer.current!.id}`,
            tenantId: tenantA,
            topic: OFFER_EXPIRY_TOPIC,
          },
        }),
      ),
    );
    expect(expiryMsg).not.toBeNull();
    expect(expiryMsg!.availableAt.toISOString()).toBe(expiresAt.toISOString());

    const reminderMsg = await runWithTenantContext(ctx, () =>
      withTenantTransaction(prisma, (tx) =>
        tx.outboxMessage.findFirst({
          where: {
            idempotencyKey: `offer-reminder-prepare:${offer.current!.id}`,
            tenantId: tenantA,
            topic: OFFER_REMINDER_PREPARE_TOPIC,
          },
        }),
      ),
    );
    expect(reminderMsg).not.toBeNull();
    const remParts = getZonedParts(
      reminderMsg!.availableAt,
      "America/Santiago",
    );
    expect(remParts.isoDate).toBe("2026-08-26");
    expect(remParts.hour).toBe(10);
    expect(remParts.minute).toBe(0);
  });

  it("R3-REM-05..07: prepareOfferReminderCommunication formats localized deadline and is idempotent", async () => {
    const ctx = makeContext(tenantA);
    const offer = await runWithTenantContext(ctx, () =>
      capacityService.getStaffOffer(ctx, applicationId),
    );

    // Prepare reminder communication
    const comm = await runWithTenantContext(ctx, () =>
      commService.prepareOfferReminderCommunication({
        offerVersionId: offer.current!.id,
      }),
    );
    expect(comm).toBeDefined();
    expect(comm?.body).toContain("27-08-2026 a las 23:59");
    expect(comm?.body).not.toContain(".000Z");

    // Idempotent retry
    const comm2 = await runWithTenantContext(ctx, () =>
      commService.prepareOfferReminderCommunication({
        offerVersionId: offer.current!.id,
      }),
    );
    expect(comm2?.id).toBe(comm?.id);
  });
});
