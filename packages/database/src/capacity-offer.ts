import { authorizeOrThrow, ForbiddenError } from "./authorization.js";
import {
  assertApplicationAuthorityForCriticalAction,
  isApplicationAuthorityCriticalActionError,
  recordApplicationAuthorityCriticalActionDenied,
} from "./application-authority.js";
import {
  CapacityOfferConflictError,
  CapacityOfferValidationError,
  IntakeNotFoundError,
} from "./domain-errors.js";
import {
  DevelopmentBusinessCalendar,
  type BusinessCalendar,
} from "./documents.js";
import {
  calculateBusinessDeadline,
  calculateOfferReminderAt,
  OFFER_REMINDER_PREPARE_TOPIC,
} from "./business-calendar.js";
import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import {
  PERMISSIONS,
  SENSITIVITIES,
  type PermissionKey,
} from "./permission-catalog.js";
import type {
  FamilyExecutionContext,
  TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const OFFER_EXPIRY_TOPIC = "admission.offer.expire";
export { OFFER_REMINDER_PREPARE_TOPIC };
export const DEFAULT_OFFER_VALIDITY_BUSINESS_DAYS = 3;

export interface CapacityInput {
  configuredCapacity: number;
  offerValidityBusinessDays?: number | undefined;
}

export interface CapacityAdjustmentInput extends CapacityInput {
  expectedVersion: number;
  reason: string;
}

export interface PromoteWaitlistInput {
  expectedCapacityVersion: number;
  expectedWaitlistEntryVersion: number;
}

export interface OfferVersionCommandInput {
  expectedOfferVersionId: string;
}

export interface ReopenOfferInput extends OfferVersionCommandInput {
  expectedCapacityVersion: number;
  reason: string;
}

export interface CapacityDto {
  adjustments: Array<{
    actorId: string;
    createdAt: string;
    id: string;
    newValue: number;
    previousValue: number;
    reason: string;
  }>;
  availableCount: number;
  concurrencyVersion: number;
  configuredCapacity: number;
  consumedCount: number;
  id: string;
  offerValidityBusinessDays: number;
  offeringId: string;
}

export interface WaitlistEntryDto {
  applicationId: string;
  concurrencyVersion: number;
  directionDecisionVersionId: string;
  enteredAt: string;
  id: string;
  internalPosition: number;
  offeringId: string;
  promotedAt: string | null;
  state: "ACTIVE" | "PROMOTED" | "WITHDRAWN";
}

export interface OfferVersionDto {
  expiresAt: string;
  id: string;
  issuedAt: string;
  lifecycle: "ACTIVE" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  origin: "NORMAL" | "WAITLIST";
  previousVersionId: string | null;
  reopenReason: string | null;
  reservationId: string;
  terminalAt: string | null;
  terminalReason:
    | "FAMILY_ACCEPTED"
    | "FAMILY_DECLINED"
    | "DEADLINE_EXPIRED"
    | "APPLICATION_WITHDRAWN"
    | null;
  versionNumber: number;
}

export interface OfferDto {
  applicationId: string;
  concurrencyVersion: number;
  current: OfferVersionDto;
  history: OfferVersionDto[];
  id: string;
  offeringId: string;
  origin: "NORMAL" | "WAITLIST";
}

export interface FamilyAdmissionProjectionDto {
  applicationId: string;
  applicationStatus: string;
  offer: OfferDto | null;
  waitlist: null | {
    enteredAt: string;
    state: "ACTIVE" | "PROMOTED" | "WITHDRAWN";
    updatedAt: string;
  };
  withdrawal: null | { confirmedAt: string };
}

type OfferingResource = {
  campusId: string;
  id: string;
  processId: string;
  tenantId: string;
};

type ApplicationResource = {
  familyProfile: { userId: string };
  id: string;
  offering: OfferingResource;
  offeringId: string;
  status: string;
  tenantId: string;
};

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function assertNonNegativeInteger(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CapacityOfferValidationError(
      "Capacity must be a non-negative integer",
    );
  }
}

function assertBusinessDays(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 30) {
    throw new CapacityOfferValidationError(
      "Offer validity must be between 1 and 30 business days",
    );
  }
}

function safeReason(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1000 ||
    /<\s*\/?\s*(script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(
      normalized,
    )
  ) {
    throw new CapacityOfferValidationError("Invalid reason");
  }
  return normalized;
}

function assertVersion(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CapacityOfferValidationError(`Invalid ${field}`);
  }
}

function effectiveActor(context: TenantExecutionContext): string {
  return context.effectiveActorId ?? context.actorId;
}

function resourceScopes(resource: OfferingResource): readonly string[] {
  return [
    `offering:${resource.id}`,
    `process:${resource.processId}`,
    `campus:${resource.campusId}`,
  ];
}

function assertResourceScope(
  context: TenantExecutionContext,
  resource: OfferingResource,
): void {
  const scopes =
    context.contextOrigin === "support_elevation"
      ? context.supportElevation?.scopes
      : context.scopes;
  if (
    scopes?.includes("*") !== true &&
    !resourceScopes(resource).some((scope) => scopes?.includes(scope))
  ) {
    throw new ForbiddenError();
  }
}

function authorizeStaff(
  context: TenantExecutionContext,
  resource: OfferingResource,
  permission: PermissionKey,
  sensitivity: "internal" | "restricted" = SENSITIVITIES.INTERNAL,
): void {
  authorizeOrThrow(context, {
    permission,
    purpose: context.purpose,
    resourceTenantId: resource.tenantId,
    sensitivity,
  });
  assertResourceScope(context, resource);
}

function assertFamilyOwnership(
  family: FamilyExecutionContext,
  applicant: TenantExecutionContext,
  application: ApplicationResource,
): void {
  authorizeOrThrow(family, {
    permission: PERMISSIONS.APPLICATION_READ,
    purpose: family.purpose,
  });
  authorizeOrThrow(applicant, {
    permission: PERMISSIONS.APPLICATION_READ,
    purpose: applicant.purpose,
    resourceTenantId: application.tenantId,
  });
  if (
    application.familyProfile.userId !==
    (family.effectiveActorId ?? family.actorId)
  ) {
    throw new IntakeNotFoundError();
  }
}

async function findOffering(
  transaction: Prisma.TransactionClient,
  offeringId: string,
): Promise<OfferingResource> {
  const offering = await transaction.admissionOffering.findFirst({
    select: { campusId: true, id: true, processId: true, tenantId: true },
    where: { id: offeringId },
  });
  if (offering === null) throw new IntakeNotFoundError();
  return offering;
}

async function findApplication(
  transaction: Prisma.TransactionClient,
  applicationId: string,
): Promise<ApplicationResource> {
  const application = await transaction.application.findFirst({
    select: {
      familyProfile: { select: { userId: true } },
      id: true,
      offering: {
        select: { campusId: true, id: true, processId: true, tenantId: true },
      },
      offeringId: true,
      status: true,
      tenantId: true,
    },
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
  await transaction.$queryRaw`
    SELECT id FROM applications
    WHERE tenant_id = ${tenantId}::uuid AND id = ${applicationId}::uuid
    FOR UPDATE
  `;
}

async function lockCapacityForOffering(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  offeringId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM admission_capacities
    WHERE tenant_id = ${tenantId}::uuid AND offering_id = ${offeringId}::uuid
    FOR UPDATE
  `;
}

async function lockOffer(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  offerId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM admission_offers
    WHERE tenant_id = ${tenantId}::uuid AND id = ${offerId}::uuid
    FOR UPDATE
  `;
}

async function lockWaitlistEntry(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  entryId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM waitlist_entries
    WHERE tenant_id = ${tenantId}::uuid AND id = ${entryId}::uuid
    FOR UPDATE
  `;
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    metadata?: Record<string, unknown> | undefined;
    occurredAt: Date;
    resourceId: string;
    resourceType: string;
  },
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      action: input.action,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveActorId: effectiveActor(context),
      ...(input.metadata === undefined
        ? {}
        : { metadata: asJson(input.metadata) }),
      occurredAt: input.occurredAt,
      purpose: context.purpose,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      result: "SUCCESS",
      scope: "TENANT",
      tenantId: context.tenantId,
    },
  });
}

async function consumedSeats(
  transaction: Prisma.TransactionClient,
  capacityId: string,
): Promise<number> {
  return transaction.seatReservation.count({
    where: { capacityId, state: { in: ["ACTIVE", "COMMITTED"] } },
  });
}

function mapOfferVersion(version: {
  expiresAt: Date;
  id: string;
  issuedAt: Date;
  lifecycle: "ACTIVE" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  origin: "NORMAL" | "WAITLIST";
  previousVersionId: string | null;
  reopenReason: string | null;
  reservationId: string;
  terminalAt: Date | null;
  terminalReason:
    | "FAMILY_ACCEPTED"
    | "FAMILY_DECLINED"
    | "DEADLINE_EXPIRED"
    | "APPLICATION_WITHDRAWN"
    | null;
  versionNumber: number;
}): OfferVersionDto {
  return {
    expiresAt: version.expiresAt.toISOString(),
    id: version.id,
    issuedAt: version.issuedAt.toISOString(),
    lifecycle: version.lifecycle,
    origin: version.origin,
    previousVersionId: version.previousVersionId,
    reopenReason: version.reopenReason,
    reservationId: version.reservationId,
    terminalAt: version.terminalAt?.toISOString() ?? null,
    terminalReason: version.terminalReason,
    versionNumber: version.versionNumber,
  };
}

function mapOffer(offer: {
  applicationId: string;
  concurrencyVersion: number;
  currentVersionId: string | null;
  id: string;
  offeringId: string;
  origin: "NORMAL" | "WAITLIST";
  versions: Array<Parameters<typeof mapOfferVersion>[0]>;
}): OfferDto {
  const current = offer.versions.find(
    (version) => version.id === offer.currentVersionId,
  );
  if (current === undefined) {
    throw new Error("OFFER_CURRENT_VERSION_MISSING");
  }
  return {
    applicationId: offer.applicationId,
    concurrencyVersion: offer.concurrencyVersion,
    current: mapOfferVersion(current),
    history: offer.versions.map(mapOfferVersion),
    id: offer.id,
    offeringId: offer.offeringId,
    origin: offer.origin,
  };
}

async function enqueueExpiry(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: { expiresAt: Date; offerId: string; offerVersionId: string },
): Promise<void> {
  await transaction.outboxMessage.create({
    data: {
      availableAt: input.expiresAt,
      idempotencyKey: `offer-expiry:${input.offerVersionId}`,
      payload: asJson({
        correlationId: context.correlationId,
        offerId: input.offerId,
        offerVersionId: input.offerVersionId,
      }),
      tenantId: context.tenantId,
      topic: OFFER_EXPIRY_TOPIC,
    },
  });
}

async function enqueueOfferReminder(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: { availableAt: Date; offerId: string; offerVersionId: string },
): Promise<void> {
  await transaction.outboxMessage.create({
    data: {
      availableAt: input.availableAt,
      idempotencyKey: `offer-reminder-prepare:${input.offerVersionId}`,
      payload: asJson({
        correlationId: context.correlationId,
        offerId: input.offerId,
        offerVersionId: input.offerVersionId,
      }),
      tenantId: context.tenantId,
      topic: OFFER_REMINDER_PREPARE_TOPIC,
    },
  });
}

async function resolveTenantCalendar(
  transaction: Prisma.TransactionClient,
  tenantId: string,
): Promise<{ excludedDates: Set<string>; timezone: string }> {
  const calendar = await transaction.tenantBusinessCalendar.findFirst({
    where: { tenantId },
  });
  if (!calendar) {
    throw new CapacityOfferConflictError("BUSINESS_CALENDAR_NOT_CONFIGURED");
  }
  const excludedRows = await transaction.businessCalendarExcludedDate.findMany({
    select: { calendarDate: true },
    where: { tenantId },
  });
  const excludedDates = new Set<string>();
  for (const row of excludedRows) {
    const d = row.calendarDate;
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    excludedDates.add(iso);
  }
  return { excludedDates, timezone: calendar.timezone };
}

async function reserveAndIssue(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    applicationId: string;
    calendar?: BusinessCalendar | undefined;
    expectedCapacityVersion?: number | undefined;
    issuedAt: Date;
    offeringId: string;
    origin: "NORMAL" | "WAITLIST";
  },
): Promise<{ offerId: string; offerVersionId: string; reservationId: string }> {
  await lockCapacityForOffering(
    transaction,
    context.tenantId,
    input.offeringId,
  );
  const capacity = await transaction.admissionCapacity.findFirst({
    where: { offeringId: input.offeringId },
  });
  if (capacity === null) {
    throw new CapacityOfferConflictError("CAPACITY_NOT_CONFIGURED");
  }
  if (
    input.expectedCapacityVersion !== undefined &&
    capacity.concurrencyVersion !== input.expectedCapacityVersion
  ) {
    throw new CapacityOfferConflictError("CAPACITY_VERSION_CHANGED");
  }
  const existingReservation = await transaction.seatReservation.findFirst({
    where: {
      applicationId: input.applicationId,
      state: { in: ["ACTIVE", "COMMITTED"] },
    },
  });
  if (existingReservation !== null) {
    throw new CapacityOfferConflictError("RESERVATION_ALREADY_EXISTS");
  }
  if (
    (await consumedSeats(transaction, capacity.id)) >=
    capacity.configuredCapacity
  ) {
    throw new CapacityOfferConflictError("NO_ADMISSION_SEAT_AVAILABLE");
  }
  const existingOffer = await transaction.admissionOffer.findFirst({
    where: { applicationId: input.applicationId },
  });
  if (existingOffer !== null) {
    throw new CapacityOfferConflictError("RESERVATION_ALREADY_EXISTS");
  }

  const reservation = await transaction.seatReservation.create({
    data: {
      applicationId: input.applicationId,
      capacityId: capacity.id,
      offeringId: input.offeringId,
      reservedAt: input.issuedAt,
      tenantId: context.tenantId,
    },
  });
  const offer = await transaction.admissionOffer.create({
    data: {
      applicationId: input.applicationId,
      offeringId: input.offeringId,
      origin: input.origin,
      tenantId: context.tenantId,
    },
  });

  const cal = await resolveTenantCalendar(transaction, context.tenantId);
  const expiresAt = calculateBusinessDeadline(
    input.issuedAt,
    capacity.offerValidityBusinessDays,
    cal,
    cal.excludedDates,
  );
  const reminderAt = calculateOfferReminderAt(
    input.issuedAt,
    expiresAt,
    cal,
    cal.excludedDates,
  );

  const version = await transaction.admissionOfferVersion.create({
    data: {
      applicationId: input.applicationId,
      expiresAt,
      issuedAt: input.issuedAt,
      issuedBy: effectiveActor(context),
      offerId: offer.id,
      offeringId: input.offeringId,
      origin: input.origin,
      reservationId: reservation.id,
      tenantId: context.tenantId,
      versionNumber: 1,
    },
  });
  await transaction.admissionOffer.update({
    data: { currentVersionId: version.id },
    where: { id: offer.id },
  });
  await transaction.admissionCapacity.update({
    data: { concurrencyVersion: { increment: 1 } },
    where: { id: capacity.id },
  });
  await enqueueExpiry(transaction, context, {
    expiresAt,
    offerId: offer.id,
    offerVersionId: version.id,
  });
  if (reminderAt !== null) {
    await enqueueOfferReminder(transaction, context, {
      availableAt: reminderAt,
      offerId: offer.id,
      offerVersionId: version.id,
    });
  }
  await recordAudit(transaction, context, {
    action: "SEAT_RESERVED",
    occurredAt: input.issuedAt,
    resourceId: reservation.id,
    resourceType: "SeatReservation",
  });
  await recordAudit(transaction, context, {
    action: "ADMISSION_OFFER_CREATED",
    metadata: { origin: input.origin, versionNumber: 1 },
    occurredAt: input.issuedAt,
    resourceId: offer.id,
    resourceType: "AdmissionOffer",
  });
  return {
    offerId: offer.id,
    offerVersionId: version.id,
    reservationId: reservation.id,
  };
}

async function releaseReservation(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  reservation: { capacityId: string; id: string; state: string },
  reason: "FAMILY_DECLINED" | "DEADLINE_EXPIRED" | "APPLICATION_WITHDRAWN",
  now: Date,
): Promise<boolean> {
  if (reservation.state !== "ACTIVE") return false;
  const result = await transaction.seatReservation.updateMany({
    data: {
      releaseReason: reason,
      releasedAt: now,
      state: "RELEASED",
    },
    where: { id: reservation.id, state: "ACTIVE" },
  });
  if (result.count === 0) return false;
  await transaction.admissionCapacity.update({
    data: { concurrencyVersion: { increment: 1 } },
    where: { id: reservation.capacityId },
  });
  await recordAudit(transaction, context, {
    action: "SEAT_RELEASED",
    metadata: { reason },
    occurredAt: now,
    resourceId: reservation.id,
    resourceType: "SeatReservation",
  });
  return true;
}

export async function applyDirectionDispositionEffects(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  input: {
    applicationId: string;
    calendar?: BusinessCalendar | undefined;
    decisionVersionId: string;
    disposition:
      "APROBADO" | "LISTA_DE_ESPERA" | "RECHAZADO" | "DEVUELTO_A_REVISION";
    offeringId: string;
    occurredAt: Date;
  },
): Promise<void> {
  if (input.disposition === "APROBADO") {
    await reserveAndIssue(transaction, context, {
      applicationId: input.applicationId,
      calendar: input.calendar ?? new DevelopmentBusinessCalendar(),
      issuedAt: input.occurredAt,
      offeringId: input.offeringId,
      origin: "NORMAL",
    });
    return;
  }
  if (input.disposition !== "LISTA_DE_ESPERA") return;
  const entry = await transaction.waitlistEntry.create({
    data: {
      applicationId: input.applicationId,
      directionDecisionVersionId: input.decisionVersionId,
      enteredAt: input.occurredAt,
      offeringId: input.offeringId,
      tenantId: context.tenantId,
    },
  });
  await recordAudit(transaction, context, {
    action: "WAITLIST_ENTRY_CREATED",
    occurredAt: input.occurredAt,
    resourceId: entry.id,
    resourceType: "WaitlistEntry",
  });
}

export class CapacityOfferService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendar: BusinessCalendar = new DevelopmentBusinessCalendar(),
  ) {}

  async createCapacity(
    context: TenantExecutionContext,
    offeringId: string,
    input: CapacityInput,
    now = new Date(),
  ): Promise<CapacityDto> {
    assertNonNegativeInteger(input.configuredCapacity);
    const businessDays =
      input.offerValidityBusinessDays ?? DEFAULT_OFFER_VALIDITY_BUSINESS_DAYS;
    assertBusinessDays(businessDays);
    return withTenantTransaction(this.prisma, async (transaction) => {
      const offering = await findOffering(transaction, offeringId);
      authorizeStaff(context, offering, PERMISSIONS.CAPACITY_MANAGE);
      if (
        (await transaction.admissionCapacity.findFirst({
          where: { offeringId },
        })) !== null
      ) {
        throw new CapacityOfferConflictError("CAPACITY_ALREADY_CONFIGURED");
      }
      const capacity = await transaction.admissionCapacity.create({
        data: {
          configuredCapacity: input.configuredCapacity,
          offerValidityBusinessDays: businessDays,
          offeringId,
          tenantId: context.tenantId,
        },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_CAPACITY_CREATED",
        occurredAt: now,
        resourceId: capacity.id,
        resourceType: "AdmissionCapacity",
      });
      return this.mapCapacity(transaction, capacity);
    });
  }

  async adjustCapacity(
    context: TenantExecutionContext,
    offeringId: string,
    input: CapacityAdjustmentInput,
    now = new Date(),
  ): Promise<CapacityDto> {
    assertNonNegativeInteger(input.configuredCapacity);
    assertVersion(input.expectedVersion, "expectedVersion");
    const reason = safeReason(input.reason);
    if (input.offerValidityBusinessDays !== undefined) {
      assertBusinessDays(input.offerValidityBusinessDays);
    }
    return withTenantTransaction(this.prisma, async (transaction) => {
      const offering = await findOffering(transaction, offeringId);
      authorizeStaff(context, offering, PERMISSIONS.CAPACITY_MANAGE);
      await lockCapacityForOffering(transaction, context.tenantId, offeringId);
      const capacity = await transaction.admissionCapacity.findFirst({
        where: { offeringId },
      });
      if (capacity === null) {
        throw new CapacityOfferConflictError("CAPACITY_NOT_CONFIGURED");
      }
      if (capacity.concurrencyVersion !== input.expectedVersion) {
        throw new CapacityOfferConflictError("CAPACITY_VERSION_CHANGED");
      }
      if (
        input.configuredCapacity <
        (await consumedSeats(transaction, capacity.id))
      ) {
        throw new CapacityOfferConflictError("CAPACITY_BELOW_CONSUMED_SEATS");
      }
      const validity =
        input.offerValidityBusinessDays ?? capacity.offerValidityBusinessDays;
      if (
        capacity.configuredCapacity === input.configuredCapacity &&
        capacity.offerValidityBusinessDays === validity
      ) {
        return this.mapCapacity(transaction, capacity);
      }
      await transaction.admissionCapacityAdjustment.create({
        data: {
          actorId: effectiveActor(context),
          capacityId: capacity.id,
          newValue: input.configuredCapacity,
          offeringId,
          previousValue: capacity.configuredCapacity,
          reason,
          tenantId: context.tenantId,
        },
      });
      const updated = await transaction.admissionCapacity.update({
        data: {
          concurrencyVersion: { increment: 1 },
          configuredCapacity: input.configuredCapacity,
          offerValidityBusinessDays: validity,
        },
        where: { id: capacity.id },
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_CAPACITY_ADJUSTED",
        metadata: {
          newValue: input.configuredCapacity,
          previousValue: capacity.configuredCapacity,
        },
        occurredAt: now,
        resourceId: capacity.id,
        resourceType: "AdmissionCapacity",
      });
      return this.mapCapacity(transaction, updated);
    });
  }

  async getCapacity(
    context: TenantExecutionContext,
    offeringId: string,
  ): Promise<CapacityDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const offering = await findOffering(transaction, offeringId);
      authorizeStaff(context, offering, PERMISSIONS.CAPACITY_READ);
      const capacity = await transaction.admissionCapacity.findFirst({
        where: { offeringId },
      });
      if (capacity === null) throw new IntakeNotFoundError();
      return this.mapCapacity(transaction, capacity);
    });
  }

  async listWaitlist(
    context: TenantExecutionContext,
    offeringId: string,
  ): Promise<WaitlistEntryDto[]> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const offering = await findOffering(transaction, offeringId);
      authorizeStaff(
        context,
        offering,
        PERMISSIONS.WAITLIST_READ,
        SENSITIVITIES.RESTRICTED,
      );
      const entries = await transaction.waitlistEntry.findMany({
        orderBy: [{ enteredAt: "asc" }, { id: "asc" }],
        where: { offeringId },
      });
      let activePosition = 0;
      return entries.map((entry) => {
        if (entry.state === "ACTIVE") activePosition += 1;
        return {
          applicationId: entry.applicationId,
          concurrencyVersion: entry.concurrencyVersion,
          directionDecisionVersionId: entry.directionDecisionVersionId,
          enteredAt: entry.enteredAt.toISOString(),
          id: entry.id,
          internalPosition: entry.state === "ACTIVE" ? activePosition : 0,
          offeringId: entry.offeringId,
          promotedAt: entry.promotedAt?.toISOString() ?? null,
          state: entry.state,
        };
      });
    });
  }

  async promoteWaitlistEntry(
    context: TenantExecutionContext,
    entryId: string,
    input: PromoteWaitlistInput,
    now = new Date(),
  ): Promise<OfferDto> {
    assertVersion(input.expectedCapacityVersion, "expectedCapacityVersion");
    assertVersion(
      input.expectedWaitlistEntryVersion,
      "expectedWaitlistEntryVersion",
    );
    return withTenantTransaction(this.prisma, async (transaction) => {
      const initial = await transaction.waitlistEntry.findFirst({
        where: { id: entryId },
      });
      if (initial === null) throw new IntakeNotFoundError();
      const offering = await findOffering(transaction, initial.offeringId);
      authorizeStaff(
        context,
        offering,
        PERMISSIONS.WAITLIST_PROMOTE,
        SENSITIVITIES.RESTRICTED,
      );
      await lockWaitlistEntry(transaction, context.tenantId, entryId);
      const entry = await transaction.waitlistEntry.findFirst({
        where: { id: entryId },
      });
      if (entry === null) throw new IntakeNotFoundError();
      if (entry.concurrencyVersion !== input.expectedWaitlistEntryVersion) {
        throw new CapacityOfferConflictError("WAITLIST_ENTRY_VERSION_CHANGED");
      }
      if (entry.state !== "ACTIVE") {
        throw new CapacityOfferConflictError("WAITLIST_ENTRY_NOT_ACTIVE");
      }
      const application = await findApplication(
        transaction,
        entry.applicationId,
      );
      if (application.status === "WITHDRAWN") {
        throw new CapacityOfferConflictError("APPLICATION_WITHDRAWN");
      }
      const first = await transaction.waitlistEntry.findFirst({
        orderBy: [{ enteredAt: "asc" }, { id: "asc" }],
        where: { offeringId: entry.offeringId, state: "ACTIVE" },
      });
      if (first?.id !== entry.id) {
        throw new CapacityOfferConflictError("WAITLIST_ENTRY_NOT_FIRST");
      }
      const issued = await reserveAndIssue(transaction, context, {
        applicationId: entry.applicationId,
        calendar: this.calendar,
        expectedCapacityVersion: input.expectedCapacityVersion,
        issuedAt: now,
        offeringId: entry.offeringId,
        origin: "WAITLIST",
      });
      await transaction.waitlistEntry.update({
        data: {
          concurrencyVersion: { increment: 1 },
          promotedAt: now,
          promotedBy: effectiveActor(context),
          state: "PROMOTED",
        },
        where: { id: entry.id },
      });
      await recordAudit(transaction, context, {
        action: "WAITLIST_ENTRY_PROMOTED",
        occurredAt: now,
        resourceId: entry.id,
        resourceType: "WaitlistEntry",
      });
      return this.readOffer(transaction, issued.offerId);
    });
  }

  async getStaffOffer(
    context: TenantExecutionContext,
    applicationId: string,
  ): Promise<OfferDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await findApplication(transaction, applicationId);
      authorizeStaff(
        context,
        application.offering,
        PERMISSIONS.OFFER_READ,
        SENSITIVITIES.RESTRICTED,
      );
      const offer = await transaction.admissionOffer.findFirst({
        where: { applicationId },
      });
      if (offer === null) throw new IntakeNotFoundError();
      return this.readOffer(transaction, offer.id);
    });
  }

  async getFamilyProjection(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    applicationId: string,
  ): Promise<FamilyAdmissionProjectionDto> {
    return withTenantTransaction(this.prisma, async (transaction) => {
      const application = await findApplication(transaction, applicationId);
      assertFamilyOwnership(family, applicant, application);
      const [waitlist, offer, withdrawal] = await Promise.all([
        transaction.waitlistEntry.findFirst({
          orderBy: { enteredAt: "desc" },
          where: { applicationId },
        }),
        transaction.admissionOffer.findFirst({ where: { applicationId } }),
        transaction.applicationWithdrawal.findFirst({
          where: { applicationId },
        }),
      ]);
      return {
        applicationId,
        applicationStatus: application.status,
        offer:
          offer === null ? null : await this.readOffer(transaction, offer.id),
        waitlist:
          waitlist === null
            ? null
            : {
                enteredAt: waitlist.enteredAt.toISOString(),
                state: waitlist.state,
                updatedAt: (
                  waitlist.promotedAt ??
                  waitlist.withdrawnAt ??
                  waitlist.enteredAt
                ).toISOString(),
              },
        withdrawal:
          withdrawal === null
            ? null
            : { confirmedAt: withdrawal.confirmedAt.toISOString() },
      };
    });
  }

  async acceptOffer(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    offerId: string,
    input: OfferVersionCommandInput,
    now = new Date(),
  ): Promise<OfferDto> {
    return this.respondToOffer(
      family,
      applicant,
      offerId,
      input,
      "ACCEPT",
      now,
    );
  }

  async declineOffer(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    offerId: string,
    input: OfferVersionCommandInput,
    now = new Date(),
  ): Promise<OfferDto> {
    return this.respondToOffer(
      family,
      applicant,
      offerId,
      input,
      "DECLINE",
      now,
    );
  }

  async reopenOffer(
    context: TenantExecutionContext,
    offerId: string,
    input: ReopenOfferInput,
    now = new Date(),
  ): Promise<OfferDto> {
    const reason = safeReason(input.reason);
    assertVersion(input.expectedCapacityVersion, "expectedCapacityVersion");
    return withTenantTransaction(this.prisma, async (transaction) => {
      const initial = await transaction.admissionOffer.findFirst({
        where: { id: offerId },
      });
      if (initial === null) throw new IntakeNotFoundError();
      const application = await findApplication(
        transaction,
        initial.applicationId,
      );
      authorizeStaff(
        context,
        application.offering,
        PERMISSIONS.OFFER_REOPEN,
        SENSITIVITIES.RESTRICTED,
      );
      await lockApplication(transaction, context.tenantId, application.id);
      await lockOffer(transaction, context.tenantId, offerId);
      const offer = await transaction.admissionOffer.findFirst({
        include: { acceptance: true, versions: true },
        where: { id: offerId },
      });
      if (offer === null) throw new IntakeNotFoundError();
      if (offer.currentVersionId !== input.expectedOfferVersionId) {
        throw new CapacityOfferConflictError("OFFER_VERSION_CHANGED");
      }
      const previous = offer.versions.find(
        (version) => version.id === offer.currentVersionId,
      );
      if (previous === undefined)
        throw new Error("OFFER_CURRENT_VERSION_MISSING");
      if (offer.acceptance !== null || previous.lifecycle === "ACCEPTED") {
        throw new CapacityOfferConflictError("OFFER_ALREADY_ACCEPTED");
      }
      if (previous.lifecycle !== "EXPIRED") {
        throw new CapacityOfferConflictError("OFFER_NOT_EXPIRED");
      }
      if (application.status === "WITHDRAWN") {
        throw new CapacityOfferConflictError("APPLICATION_WITHDRAWN");
      }
      await lockCapacityForOffering(
        transaction,
        context.tenantId,
        application.offeringId,
      );
      const capacity = await transaction.admissionCapacity.findFirst({
        where: { offeringId: application.offeringId },
      });
      if (capacity === null) {
        throw new CapacityOfferConflictError("CAPACITY_NOT_CONFIGURED");
      }
      if (capacity.concurrencyVersion !== input.expectedCapacityVersion) {
        throw new CapacityOfferConflictError("CAPACITY_VERSION_CHANGED");
      }
      if (
        (await consumedSeats(transaction, capacity.id)) >=
        capacity.configuredCapacity
      ) {
        throw new CapacityOfferConflictError("NO_ADMISSION_SEAT_AVAILABLE");
      }
      const reservation = await transaction.seatReservation.create({
        data: {
          applicationId: application.id,
          capacityId: capacity.id,
          offeringId: application.offeringId,
          reservedAt: now,
          tenantId: context.tenantId,
        },
      });
      const cal = await resolveTenantCalendar(transaction, context.tenantId);
      const expiresAt = calculateBusinessDeadline(
        now,
        capacity.offerValidityBusinessDays,
        cal,
        cal.excludedDates,
      );
      const reminderAt = calculateOfferReminderAt(
        now,
        expiresAt,
        cal,
        cal.excludedDates,
      );
      const version = await transaction.admissionOfferVersion.create({
        data: {
          applicationId: application.id,
          expiresAt,
          issuedAt: now,
          issuedBy: effectiveActor(context),
          offerId,
          offeringId: application.offeringId,
          origin: offer.origin,
          previousVersionId: previous.id,
          reopenReason: reason,
          reservationId: reservation.id,
          tenantId: context.tenantId,
          versionNumber: previous.versionNumber + 1,
        },
      });
      await transaction.admissionOffer.update({
        data: {
          concurrencyVersion: { increment: 1 },
          currentVersionId: version.id,
        },
        where: { id: offer.id },
      });
      await transaction.admissionCapacity.update({
        data: { concurrencyVersion: { increment: 1 } },
        where: { id: capacity.id },
      });
      await enqueueExpiry(transaction, context, {
        expiresAt,
        offerId,
        offerVersionId: version.id,
      });
      if (reminderAt !== null) {
        await enqueueOfferReminder(transaction, context, {
          availableAt: reminderAt,
          offerId,
          offerVersionId: version.id,
        });
      }
      await recordAudit(transaction, context, {
        action: "SEAT_RESERVED",
        occurredAt: now,
        resourceId: reservation.id,
        resourceType: "SeatReservation",
      });
      await recordAudit(transaction, context, {
        action: "ADMISSION_OFFER_REOPENED",
        metadata: { versionNumber: version.versionNumber },
        occurredAt: now,
        resourceId: offer.id,
        resourceType: "AdmissionOffer",
      });
      return this.readOffer(transaction, offer.id);
    });
  }

  async expireOfferVersion(
    context: TenantExecutionContext,
    offerVersionId: string,
    now = new Date(),
  ): Promise<"EXPIRED" | "NOOP_NOT_DUE" | "NOOP_STALE" | "NOOP_TERMINAL"> {
    if (context.contextOrigin !== "trusted_job") throw new ForbiddenError();
    return withTenantTransaction(this.prisma, async (transaction) => {
      const initial = await transaction.admissionOfferVersion.findFirst({
        where: { id: offerVersionId },
      });
      if (initial === null) return "NOOP_STALE";
      await lockApplication(
        transaction,
        context.tenantId,
        initial.applicationId,
      );
      await lockOffer(transaction, context.tenantId, initial.offerId);
      const offer = await transaction.admissionOffer.findFirst({
        where: { id: initial.offerId },
      });
      if (offer?.currentVersionId !== offerVersionId) return "NOOP_STALE";
      const version = await transaction.admissionOfferVersion.findFirst({
        where: { id: offerVersionId },
      });
      if (version === null) return "NOOP_STALE";
      if (version.lifecycle !== "ACTIVE") return "NOOP_TERMINAL";
      if (version.expiresAt > now) return "NOOP_NOT_DUE";
      const reservation = await transaction.seatReservation.findFirst({
        where: { id: version.reservationId },
      });
      if (reservation === null) throw new Error("OFFER_RESERVATION_MISSING");
      await transaction.admissionOfferVersion.update({
        data: {
          lifecycle: "EXPIRED",
          terminalAt: now,
          terminalReason: "DEADLINE_EXPIRED",
        },
        where: { id: version.id },
      });
      await releaseReservation(
        transaction,
        context,
        reservation,
        "DEADLINE_EXPIRED",
        now,
      );
      await recordAudit(transaction, context, {
        action: "ADMISSION_OFFER_EXPIRED",
        metadata: { versionNumber: version.versionNumber },
        occurredAt: now,
        resourceId: offer.id,
        resourceType: "AdmissionOffer",
      });
      return "EXPIRED";
    });
  }

  async withdrawApplication(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    applicationId: string,
    confirmed: boolean,
    now = new Date(),
  ): Promise<{ confirmedAt: string; id: string }> {
    if (!confirmed) {
      throw new CapacityOfferValidationError(
        "Explicit confirmation is required",
      );
    }
    return withTenantTransaction(this.prisma, async (transaction) => {
      await lockApplication(transaction, applicant.tenantId, applicationId);
      const application = await findApplication(transaction, applicationId);
      assertFamilyOwnership(family, applicant, application);
      const existing = await transaction.applicationWithdrawal.findFirst({
        where: { applicationId },
      });
      if (existing !== null) {
        return {
          confirmedAt: existing.confirmedAt.toISOString(),
          id: existing.id,
        };
      }
      if (application.status !== "SUBMITTED") {
        throw new CapacityOfferConflictError("APPLICATION_WITHDRAWN");
      }
      const offer = await transaction.admissionOffer.findFirst({
        include: { currentVersion: true },
        where: { applicationId },
      });
      if (offer?.currentVersion?.lifecycle === "ACCEPTED") {
        throw new CapacityOfferConflictError("OFFER_ALREADY_ACCEPTED");
      }
      const waitlist = await transaction.waitlistEntry.findFirst({
        where: { applicationId, state: "ACTIVE" },
      });
      let reservation =
        offer?.currentVersion === null || offer?.currentVersion === undefined
          ? null
          : await transaction.seatReservation.findFirst({
              where: { id: offer.currentVersion.reservationId },
            });
      reservation ??= await transaction.seatReservation.findFirst({
        where: { applicationId, state: "ACTIVE" },
      });
      if (offer?.currentVersion?.lifecycle === "ACTIVE") {
        await transaction.admissionOfferVersion.update({
          data: {
            lifecycle: "DECLINED",
            terminalAt: now,
            terminalReason: "APPLICATION_WITHDRAWN",
          },
          where: { id: offer.currentVersion.id },
        });
        await recordAudit(transaction, applicant, {
          action: "ADMISSION_OFFER_DECLINED",
          metadata: { reason: "APPLICATION_WITHDRAWN" },
          occurredAt: now,
          resourceId: offer.id,
          resourceType: "AdmissionOffer",
        });
      }
      if (reservation !== null) {
        await releaseReservation(
          transaction,
          applicant,
          reservation,
          "APPLICATION_WITHDRAWN",
          now,
        );
      }
      if (waitlist !== null) {
        await transaction.waitlistEntry.update({
          data: {
            concurrencyVersion: { increment: 1 },
            state: "WITHDRAWN",
            withdrawnAt: now,
          },
          where: { id: waitlist.id },
        });
        await recordAudit(transaction, applicant, {
          action: "WAITLIST_ENTRY_WITHDRAWN",
          occurredAt: now,
          resourceId: waitlist.id,
          resourceType: "WaitlistEntry",
        });
      }
      const withdrawal = await transaction.applicationWithdrawal.create({
        data: {
          actorId: family.effectiveActorId ?? family.actorId,
          applicationId,
          confirmedAt: now,
          offerId: offer?.id ?? null,
          offeringId: application.offeringId,
          offerVersionId: offer?.currentVersion?.id ?? null,
          reservationId: reservation?.id ?? null,
          tenantId: applicant.tenantId,
          waitlistEntryId: waitlist?.id ?? null,
        },
      });
      await transaction.application.update({
        data: { status: "WITHDRAWN" },
        where: { id: applicationId },
      });
      await recordAudit(transaction, applicant, {
        action: "APPLICATION_WITHDRAWN",
        occurredAt: now,
        resourceId: applicationId,
        resourceType: "Application",
      });
      return {
        confirmedAt: withdrawal.confirmedAt.toISOString(),
        id: withdrawal.id,
      };
    });
  }

  private async mapCapacity(
    transaction: Prisma.TransactionClient,
    capacity: {
      concurrencyVersion: number;
      configuredCapacity: number;
      id: string;
      offerValidityBusinessDays: number;
      offeringId: string;
    },
  ): Promise<CapacityDto> {
    const [consumedCount, adjustments] = await Promise.all([
      consumedSeats(transaction, capacity.id),
      transaction.admissionCapacityAdjustment.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { capacityId: capacity.id },
      }),
    ]);
    return {
      adjustments: adjustments.map((adjustment) => ({
        actorId: adjustment.actorId,
        createdAt: adjustment.createdAt.toISOString(),
        id: adjustment.id,
        newValue: adjustment.newValue,
        previousValue: adjustment.previousValue,
        reason: adjustment.reason,
      })),
      availableCount: Math.max(0, capacity.configuredCapacity - consumedCount),
      concurrencyVersion: capacity.concurrencyVersion,
      configuredCapacity: capacity.configuredCapacity,
      consumedCount,
      id: capacity.id,
      offerValidityBusinessDays: capacity.offerValidityBusinessDays,
      offeringId: capacity.offeringId,
    };
  }

  private async readOffer(
    transaction: Prisma.TransactionClient,
    offerId: string,
  ): Promise<OfferDto> {
    const offer = await transaction.admissionOffer.findFirst({
      include: { versions: { orderBy: { versionNumber: "asc" } } },
      where: { id: offerId },
    });
    if (offer === null) throw new IntakeNotFoundError();
    return mapOffer(offer);
  }

  private async respondToOffer(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    offerId: string,
    input: OfferVersionCommandInput,
    action: "ACCEPT" | "DECLINE",
    now: Date,
  ): Promise<OfferDto> {
    if (input.expectedOfferVersionId.trim() === "") {
      throw new CapacityOfferValidationError(
        "expectedOfferVersionId is required",
      );
    }
    try {
      return await withTenantTransaction(this.prisma, async (transaction) => {
        const initial = await transaction.admissionOffer.findFirst({
          where: { id: offerId },
        });
        if (initial === null) throw new IntakeNotFoundError();
        await lockApplication(
          transaction,
          applicant.tenantId,
          initial.applicationId,
        );
        const application = await findApplication(
          transaction,
          initial.applicationId,
        );
        assertFamilyOwnership(family, applicant, application);
        await lockOffer(transaction, applicant.tenantId, offerId);
        const offer = await transaction.admissionOffer.findFirst({
          include: {
            acceptance: true,
            versions: { orderBy: { versionNumber: "asc" } },
          },
          where: { id: offerId },
        });
        if (offer === null) throw new IntakeNotFoundError();
        const current = offer.versions.find(
          (version) => version.id === offer.currentVersionId,
        );
        if (current === undefined)
          throw new Error("OFFER_CURRENT_VERSION_MISSING");
        if (offer.currentVersionId !== input.expectedOfferVersionId) {
          throw new CapacityOfferConflictError("OFFER_VERSION_CHANGED");
        }
        if (
          action === "ACCEPT" &&
          offer.acceptance?.offerVersionId === input.expectedOfferVersionId
        ) {
          return mapOffer(offer);
        }
        if (
          action === "DECLINE" &&
          current.lifecycle === "DECLINED" &&
          current.terminalReason === "FAMILY_DECLINED"
        ) {
          return mapOffer(offer);
        }
        if (application.status === "WITHDRAWN") {
          throw new CapacityOfferConflictError("APPLICATION_WITHDRAWN");
        }
        if (current.lifecycle !== "ACTIVE") {
          throw new CapacityOfferConflictError("OFFER_NOT_ACTIVE");
        }
        if (current.expiresAt <= now) {
          throw new CapacityOfferConflictError("OFFER_EXPIRED");
        }
        const reservation = await transaction.seatReservation.findFirst({
          where: { id: current.reservationId },
        });
        if (reservation === null || reservation.state !== "ACTIVE") {
          throw new CapacityOfferConflictError("OFFER_NOT_ACTIVE");
        }
        if (action === "ACCEPT") {
          await assertApplicationAuthorityForCriticalAction(transaction, {
            applicationId: application.id,
            expectedAuthorityUserId: family.effectiveActorId ?? family.actorId,
            now,
            tenantId: applicant.tenantId,
          });
          await transaction.admissionOfferVersion.update({
            data: {
              lifecycle: "ACCEPTED",
              terminalAt: now,
              terminalReason: "FAMILY_ACCEPTED",
            },
            where: { id: current.id },
          });
          await transaction.offerAcceptance.create({
            data: {
              acceptedAt: now,
              actorId: family.effectiveActorId ?? family.actorId,
              applicationId: application.id,
              offerId: offer.id,
              offeringId: application.offeringId,
              offerVersionId: current.id,
              reservationId: reservation.id,
              tenantId: applicant.tenantId,
            },
          });
          await transaction.seatReservation.update({
            data: { committedAt: now, state: "COMMITTED" },
            where: { id: reservation.id },
          });
          await transaction.admissionCapacity.update({
            data: { concurrencyVersion: { increment: 1 } },
            where: { id: reservation.capacityId },
          });
          await recordAudit(transaction, applicant, {
            action: "ADMISSION_OFFER_ACCEPTED",
            metadata: { versionNumber: current.versionNumber },
            occurredAt: now,
            resourceId: offer.id,
            resourceType: "AdmissionOffer",
          });
          await recordAudit(transaction, applicant, {
            action: "SEAT_COMMITTED",
            occurredAt: now,
            resourceId: reservation.id,
            resourceType: "SeatReservation",
          });
        } else {
          await transaction.admissionOfferVersion.update({
            data: {
              lifecycle: "DECLINED",
              terminalAt: now,
              terminalReason: "FAMILY_DECLINED",
            },
            where: { id: current.id },
          });
          await releaseReservation(
            transaction,
            applicant,
            reservation,
            "FAMILY_DECLINED",
            now,
          );
          await recordAudit(transaction, applicant, {
            action: "ADMISSION_OFFER_DECLINED",
            metadata: { versionNumber: current.versionNumber },
            occurredAt: now,
            resourceId: offer.id,
            resourceType: "AdmissionOffer",
          });
        }
        return this.readOffer(transaction, offer.id);
      });
    } catch (error) {
      if (
        action === "ACCEPT" &&
        isApplicationAuthorityCriticalActionError(error)
      ) {
        const initial = await withTenantTransaction(
          this.prisma,
          (transaction) =>
            transaction.admissionOffer.findFirst({
              select: { applicationId: true },
              where: { id: offerId },
            }),
        );
        if (initial !== null) {
          await recordApplicationAuthorityCriticalActionDenied(
            this.prisma,
            applicant,
            initial.applicationId,
            error.code,
            now,
          );
        }
      }
      throw error;
    }
  }
}
