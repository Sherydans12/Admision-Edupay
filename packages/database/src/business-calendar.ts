import { authorizeOrThrow } from "./authorization.js";
import {
  BusinessCalendarConflictError,
  BusinessCalendarNotConfiguredError,
  BusinessCalendarValidationError,
  IntakeNotFoundError,
  InvalidBusinessTimezoneError,
} from "./domain-errors.js";
import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { PERMISSIONS } from "./permission-catalog.js";
import type { TenantExecutionContext } from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const OFFER_REMINDER_PREPARE_TOPIC = "admission.offer.reminder.prepare";

export interface TenantBusinessCalendarDto {
  concurrencyVersion: number;
  createdAt: string;
  id: string;
  tenantId: string;
  timezone: string;
  updatedAt: string;
}

export interface BusinessCalendarExcludedDateDto {
  calendarDate: string; // YYYY-MM-DD
  createdAt: string;
  createdBy: string;
  id: string;
  reason: string;
  tenantId: string;
}

export interface ConfigureBusinessCalendarInput {
  expectedVersion?: number | undefined;
  timezone: string;
}

export interface AddExcludedDateInput {
  calendarDate: string; // YYYY-MM-DD
  reason: string;
}

export interface EffectiveCalendarConfig {
  excludedDates: ReadonlySet<string>;
  timezone: string;
}

/**
 * Validates that a string is a standard IANA timezone identifier recognized by
 * the runtime (e.g. "America/Santiago", "America/New_York", "Europe/Madrid", "UTC").
 * Denies fixed offset strings such as "UTC-3", "GMT-4", "+03:00", or numeric offsets (R3-002).
 */
export function validateIanaTimeZone(timeZone: string): boolean {
  if (
    typeof timeZone !== "string" ||
    timeZone.trim().length === 0 ||
    timeZone.length > 80
  ) {
    return false;
  }
  const trimmed = timeZone.trim();
  // Deny explicit offset specifications
  if (/^(UTC|GMT)[+-]/i.test(trimmed) || /^[+-]\d/i.test(trimmed)) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts that a timezone string is valid IANA or throws InvalidBusinessTimezoneError.
 */
export function assertValidIanaTimeZone(timeZone: string): string {
  const normalized = timeZone.trim();
  if (!validateIanaTimeZone(normalized)) {
    throw new InvalidBusinessTimezoneError(
      `Invalid IANA business timezone: "${timeZone}". Must be a recognized IANA identifier (e.g. "America/Santiago").`,
    );
  }
  return normalized;
}

export interface CivilDateParts {
  day: number;
  hour: number;
  isoDate: string;
  millisecond: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

/**
 * Resolves the civil date and time parts of a UTC Date instant in a specific IANA timezone.
 */
export function getZonedParts(instant: Date, timeZone: string): CivilDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    fractionalSecondDigits: 3,
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  const year = parseInt(map.year ?? "0", 10);
  const month = parseInt(map.month ?? "0", 10);
  const day = parseInt(map.day ?? "0", 10);
  const hour = parseInt(map.hour ?? "0", 10);
  const minute = parseInt(map.minute ?? "0", 10);
  const second = parseInt(map.second ?? "0", 10);
  const millisecond = parseInt(map.fractionalSecond ?? "0", 10);
  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { day, hour, isoDate, millisecond, minute, month, second, year };
}

/**
 * Returns the local civil date string (YYYY-MM-DD) for a given UTC Date instant in the tenant timezone.
 */
export function getLocalDate(instant: Date, timeZone: string): string {
  return getZonedParts(instant, timeZone).isoDate;
}

/**
 * Validates ISO date format YYYY-MM-DD and checks that it represents a real civil date.
 */
export function validateIsoCivilDate(dateStr: string): boolean {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  if (y === undefined || m === undefined || d === undefined) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const test = new Date(Date.UTC(y, m - 1, d));
  return (
    test.getUTCFullYear() === y &&
    test.getUTCMonth() === m - 1 &&
    test.getUTCDate() === d
  );
}

/**
 * Parses YYYY-MM-DD into [year, month, day] or throws BusinessCalendarValidationError.
 */
export function parseIsoCivilDate(dateStr: string): [number, number, number] {
  if (!validateIsoCivilDate(dateStr)) {
    throw new BusinessCalendarValidationError(
      `Invalid civil date format: "${dateStr}". Expected YYYY-MM-DD.`,
    );
  }
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  return [y!, m!, d!];
}

/**
 * Formats [year, month, day] into YYYY-MM-DD.
 */
export function formatIsoCivilDate(
  year: number,
  month: number,
  day: number,
): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Adds or subtracts civil calendar days to a YYYY-MM-DD date.
 */
export function shiftCivilDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = parseIsoCivilDate(dateStr);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return formatIsoCivilDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/**
 * Returns the day of the week for a civil date string (1 = Monday, 7 = Sunday).
 */
export function civilDayOfWeek(dateStr: string): number {
  const [y, m, d] = parseIsoCivilDate(dateStr);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return day === 0 ? 7 : day;
}

/**
 * Determines whether a local civil date is an ordinary business day (Mon-Fri and not excluded) (R3-003, R3-004).
 */
export function isBusinessDate(
  dateStr: string,
  excludedDates?: ReadonlySet<string>,
): boolean {
  const dow = civilDayOfWeek(dateStr);
  if (dow === 6 || dow === 7) return false; // Saturday or Sunday
  if (excludedDates !== undefined && excludedDates.has(dateStr)) {
    return false;
  }
  return true;
}

/**
 * Adds business days starting AFTER the specified startDateStr (R3-006).
 * The start date NEVER counts as business day 1.
 */
export function addBusinessDaysAfter(
  startDateStr: string,
  count: number,
  excludedDates?: ReadonlySet<string>,
): string {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new BusinessCalendarValidationError(
      "Business day count must be a positive integer",
    );
  }
  let current = startDateStr;
  let remaining = count;
  while (remaining > 0) {
    current = shiftCivilDate(current, 1);
    if (isBusinessDate(current, excludedDates)) {
      remaining -= 1;
    }
  }
  return current;
}

/**
 * Finds the nearest previous business date strictly before the given dateStr (R3-009).
 */
export function previousBusinessDate(
  dateStr: string,
  excludedDates?: ReadonlySet<string>,
): string {
  let current = dateStr;
  while (true) {
    current = shiftCivilDate(current, -1);
    if (isBusinessDate(current, excludedDates)) {
      return current;
    }
  }
}

/**
 * Converts a local civil date (YYYY-MM-DD) and time (HH:mm:ss.SSS) in a specific IANA timezone
 * into the corresponding UTC Date instant.
 * Handles DST shifts accurately and verifies round-trip fidelity (R3-007, R3-009, R3-011).
 */
export function civilDateTimeToInstant(
  dateStr: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const [year, month, day] = parseIsoCivilDate(dateStr);
  const targetUtcMs = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  let guessInstantMs = targetUtcMs;

  for (let iter = 0; iter < 4; iter += 1) {
    const zoned = getZonedParts(new Date(guessInstantMs), timeZone);
    const zonedAsUtcMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      zoned.millisecond,
    );
    const diff = zonedAsUtcMs - targetUtcMs;
    if (diff === 0) break;
    guessInstantMs -= diff;
  }

  const finalCheck = getZonedParts(new Date(guessInstantMs), timeZone);
  if (
    finalCheck.year !== year ||
    finalCheck.month !== month ||
    finalCheck.day !== day ||
    finalCheck.hour !== hour ||
    finalCheck.minute !== minute ||
    finalCheck.second !== second ||
    finalCheck.millisecond !== millisecond
  ) {
    throw new BusinessCalendarValidationError(
      `Cannot resolve local time ${dateStr} ${hour}:${minute}:${second}.${millisecond} in timezone ${timeZone} (possible DST gap/nonexistent time)`,
    );
  }

  return new Date(guessInstantMs);
}

/**
 * Calculates a business deadline expiring at 23:59:59.999 local on the final business day (R3-006, R3-007).
 */
export function calculateBusinessDeadline(
  issuedAt: Date,
  businessDays: number,
  calendar: {
    excludedDates?: ReadonlySet<string> | undefined;
    timezone: string;
  },
  excludedDates?: ReadonlySet<string>,
): Date {
  const localIssueDate = getLocalDate(issuedAt, calendar.timezone);
  const effectiveExcluded = excludedDates ?? calendar.excludedDates;
  const finalBusinessDate = addBusinessDaysAfter(
    localIssueDate,
    businessDays,
    effectiveExcluded,
  );
  return civilDateTimeToInstant(
    finalBusinessDate,
    23,
    59,
    59,
    999,
    calendar.timezone,
  );
}

/**
 * Calculates the offer reminder instant: 1 business day before expiry at 10:00:00.000 local (R3-009).
 * If the calculated reminder instant is <= issuedAt, returns null (R3-016).
 */
export function calculateOfferReminderAt(
  issuedAt: Date,
  expiresAt: Date,
  calendar: {
    excludedDates?: ReadonlySet<string> | undefined;
    timezone: string;
  },
  excludedDates?: ReadonlySet<string>,
): Date | null {
  const localExpiryDate = getLocalDate(expiresAt, calendar.timezone);
  const effectiveExcluded = excludedDates ?? calendar.excludedDates;
  const reminderLocalDate = previousBusinessDate(
    localExpiryDate,
    effectiveExcluded,
  );
  const reminderInstant = civilDateTimeToInstant(
    reminderLocalDate,
    10,
    0,
    0,
    0,
    calendar.timezone,
  );

  if (reminderInstant.getTime() <= issuedAt.getTime()) {
    return null;
  }
  return reminderInstant;
}

/**
 * Formats a deadline for family-facing communications and UI (e.g. "Vence el 25-08-2026 a las 23:59") (R3-030).
 */
export function formatLocalizedDeadline(
  deadline: Date,
  timeZone: string,
): string {
  const parts = getZonedParts(deadline, timeZone);
  const dayStr = String(parts.day).padStart(2, "0");
  const monthStr = String(parts.month).padStart(2, "0");
  const hourStr = String(parts.hour).padStart(2, "0");
  const minStr = String(parts.minute).padStart(2, "0");
  return `${dayStr}-${monthStr}-${parts.year} a las ${hourStr}:${minStr}`;
}

function safeReason(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 200 ||
    /<\s*\/?\s*(script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(
      normalized,
    )
  ) {
    throw new BusinessCalendarValidationError("Invalid reason");
  }
  return normalized;
}

export class BusinessCalendarService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Reads tenant business calendar without throwing if not configured.
   */
  async getCalendar(
    context: TenantExecutionContext,
  ): Promise<TenantBusinessCalendarDto | null> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_READ,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    return withTenantTransaction(this.prisma, async (tx) => {
      const row = await tx.tenantBusinessCalendar.findFirst({
        where: { tenantId: context.tenantId },
      });
      if (!row) return null;
      return {
        concurrencyVersion: row.concurrencyVersion,
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        tenantId: row.tenantId,
        timezone: row.timezone,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Resolves the effective calendar and excluded dates for the current tenant.
   * Throws BusinessCalendarNotConfiguredError if missing (fail-closed, R3-006).
   */
  async getEffectiveCalendar(
    context: TenantExecutionContext,
    tx?: Prisma.TransactionClient,
  ): Promise<EffectiveCalendarConfig> {
    const runner = async (transaction: Prisma.TransactionClient) => {
      const calendar = await transaction.tenantBusinessCalendar.findFirst({
        where: { tenantId: context.tenantId },
      });
      if (!calendar) {
        throw new BusinessCalendarNotConfiguredError();
      }
      const excludedRows =
        await transaction.businessCalendarExcludedDate.findMany({
          select: { calendarDate: true },
          where: { tenantId: context.tenantId },
        });
      const excludedDates = new Set<string>();
      for (const row of excludedRows) {
        const d = row.calendarDate;
        const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        excludedDates.add(iso);
      }
      return {
        excludedDates,
        timezone: calendar.timezone,
      };
    };

    if (tx) return runner(tx);
    return withTenantTransaction(this.prisma, runner);
  }

  /**
   * Configures or updates the tenant business calendar timezone with optimistic concurrency (R3-001, R3-023).
   */
  async configureCalendar(
    context: TenantExecutionContext,
    input: ConfigureBusinessCalendarInput,
    now = new Date(),
  ): Promise<TenantBusinessCalendarDto> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_MANAGE,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    const timezone = assertValidIanaTimeZone(input.timezone);

    return withTenantTransaction(this.prisma, async (tx) => {
      const existing = await tx.tenantBusinessCalendar.findFirst({
        where: { tenantId: context.tenantId },
      });

      if (existing) {
        if (
          input.expectedVersion !== undefined &&
          existing.concurrencyVersion !== input.expectedVersion
        ) {
          throw new BusinessCalendarConflictError(
            "BUSINESS_CALENDAR_VERSION_CHANGED",
          );
        }
        const updated = await tx.tenantBusinessCalendar.update({
          data: {
            concurrencyVersion: { increment: 1 },
            timezone,
            updatedAt: now,
          },
          where: { id: existing.id },
        });

        await tx.auditEvent.create({
          data: {
            action: "BUSINESS_CALENDAR_TIMEZONE_UPDATED",
            actorId: context.actorId,
            correlationId: context.correlationId,
            effectiveActorId: context.effectiveActorId ?? context.actorId,
            metadata: {
              newVersion: updated.concurrencyVersion,
              newTimezone: timezone,
              oldTimezone: existing.timezone,
              oldVersion: existing.concurrencyVersion,
            },
            occurredAt: now,
            purpose: context.purpose,
            resourceId: updated.id,
            resourceType: "TenantBusinessCalendar",
            result: "SUCCESS",
            scope: "TENANT",
            tenantId: context.tenantId,
          },
        });

        return {
          concurrencyVersion: updated.concurrencyVersion,
          createdAt: updated.createdAt.toISOString(),
          id: updated.id,
          tenantId: updated.tenantId,
          timezone: updated.timezone,
          updatedAt: updated.updatedAt.toISOString(),
        };
      }

      const created = await tx.tenantBusinessCalendar.create({
        data: {
          concurrencyVersion: 1,
          createdAt: now,
          tenantId: context.tenantId,
          timezone,
          updatedAt: now,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "BUSINESS_CALENDAR_CONFIGURED",
          actorId: context.actorId,
          correlationId: context.correlationId,
          effectiveActorId: context.effectiveActorId ?? context.actorId,
          metadata: { timezone },
          occurredAt: now,
          purpose: context.purpose,
          resourceId: created.id,
          resourceType: "TenantBusinessCalendar",
          result: "SUCCESS",
          scope: "TENANT",
          tenantId: context.tenantId,
        },
      });

      return {
        concurrencyVersion: created.concurrencyVersion,
        createdAt: created.createdAt.toISOString(),
        id: created.id,
        tenantId: created.tenantId,
        timezone: created.timezone,
        updatedAt: created.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Lists all excluded dates configured for the tenant (R3-004).
   */
  async listExcludedDates(
    context: TenantExecutionContext,
  ): Promise<BusinessCalendarExcludedDateDto[]> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_READ,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    return withTenantTransaction(this.prisma, async (tx) => {
      const rows = await tx.businessCalendarExcludedDate.findMany({
        orderBy: { calendarDate: "asc" },
        where: { tenantId: context.tenantId },
      });
      return rows.map((r) => {
        const d = r.calendarDate;
        const calendarDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        return {
          calendarDate,
          createdAt: r.createdAt.toISOString(),
          createdBy: r.createdBy,
          id: r.id,
          reason: r.reason,
          tenantId: r.tenantId,
        };
      });
    });
  }

  /**
   * Adds an excluded date to the tenant calendar (R3-004, R3-024).
   */
  async addExcludedDate(
    context: TenantExecutionContext,
    input: AddExcludedDateInput,
    now = new Date(),
  ): Promise<BusinessCalendarExcludedDateDto> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_MANAGE,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });
    const [y, m, d] = parseIsoCivilDate(input.calendarDate);
    const reason = safeReason(input.reason);
    const calendarDateUtc = new Date(Date.UTC(y, m - 1, d));

    return withTenantTransaction(this.prisma, async (tx) => {
      // Must have calendar configured before adding excluded dates
      const calendar = await tx.tenantBusinessCalendar.findFirst({
        where: { tenantId: context.tenantId },
      });
      if (!calendar) {
        throw new BusinessCalendarNotConfiguredError();
      }

      const existing = await tx.businessCalendarExcludedDate.findFirst({
        where: {
          calendarDate: calendarDateUtc,
          tenantId: context.tenantId,
        },
      });
      if (existing) {
        throw new BusinessCalendarConflictError("EXCLUDED_DATE_ALREADY_EXISTS");
      }

      const created = await tx.businessCalendarExcludedDate.create({
        data: {
          calendarDate: calendarDateUtc,
          createdAt: now,
          createdBy: context.effectiveActorId ?? context.actorId,
          reason,
          tenantId: context.tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "BUSINESS_CALENDAR_EXCLUDED_DATE_ADDED",
          actorId: context.actorId,
          correlationId: context.correlationId,
          effectiveActorId: context.effectiveActorId ?? context.actorId,
          metadata: {
            calendarDate: input.calendarDate,
            reason,
          },
          occurredAt: now,
          purpose: context.purpose,
          resourceId: created.id,
          resourceType: "BusinessCalendarExcludedDate",
          result: "SUCCESS",
          scope: "TENANT",
          tenantId: context.tenantId,
        },
      });

      return {
        calendarDate: input.calendarDate,
        createdAt: created.createdAt.toISOString(),
        createdBy: created.createdBy,
        id: created.id,
        reason: created.reason,
        tenantId: created.tenantId,
      };
    });
  }

  /**
   * Removes an excluded date from the tenant calendar (R3-024).
   */
  async removeExcludedDate(
    context: TenantExecutionContext,
    excludedDateId: string,
    now = new Date(),
  ): Promise<{ id: string; removed: true }> {
    authorizeOrThrow(context, {
      permission: PERMISSIONS.ADMISSION_CONFIG_MANAGE,
      purpose: context.purpose,
      resourceTenantId: context.tenantId,
    });

    return withTenantTransaction(this.prisma, async (tx) => {
      const existing = await tx.businessCalendarExcludedDate.findFirst({
        where: {
          id: excludedDateId,
          tenantId: context.tenantId,
        },
      });
      if (!existing) {
        throw new IntakeNotFoundError();
      }

      await tx.businessCalendarExcludedDate.delete({
        where: { id: existing.id },
      });

      const d = existing.calendarDate;
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      await tx.auditEvent.create({
        data: {
          action: "BUSINESS_CALENDAR_EXCLUDED_DATE_REMOVED",
          actorId: context.actorId,
          correlationId: context.correlationId,
          effectiveActorId: context.effectiveActorId ?? context.actorId,
          metadata: {
            calendarDate: iso,
            reason: existing.reason,
          },
          occurredAt: now,
          purpose: context.purpose,
          resourceId: existing.id,
          resourceType: "BusinessCalendarExcludedDate",
          result: "SUCCESS",
          scope: "TENANT",
          tenantId: context.tenantId,
        },
      });

      return { id: existing.id, removed: true };
    });
  }
}
