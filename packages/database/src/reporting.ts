import {
  ApplicationStatus,
  DocumentFunctionalStatus,
  type Prisma,
  type PrismaClient,
} from "./generated/prisma/client.js";
import { ForbiddenError } from "./authorization.js";
import { sanitizeAuditMetadata } from "./audit-metadata.js";
import {
  PERMISSIONS,
  type PermissionKey,
  type Sensitivity,
} from "./permission-catalog.js";
import {
  getRequiredTenantContext,
  type TenantExecutionContext,
} from "./tenant-execution-context.js";
import { withTenantTransaction } from "./tenant-transaction.js";

export const REPORT_KEYS = [
  "APPLICATIONS_BY_COURSE_STATUS",
  "PENDING_DOCUMENTS",
  "ACTIVITIES",
  "DECISIONS",
  "WAITLIST",
  "CAPACITY_RESERVATIONS",
  "OFFERS",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];
export type ReportFilterKey =
  | "applicationStatus"
  | "campusId"
  | "courseLevelId"
  | "dateFrom"
  | "dateTo"
  | "offeringId"
  | "processId";

export interface ReportFilters {
  applicationStatus?: ApplicationStatus;
  campusId?: string;
  courseLevelId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  offeringId?: string;
  processId?: string;
}

export interface ReportColumnDefinition {
  key: string;
  label: string;
  sensitivity: Sensitivity;
}

export interface ReportDefinition {
  allowedColumns: readonly ReportColumnDefinition[];
  allowedFilters: readonly ReportFilterKey[];
  defaultColumns: readonly string[];
  key: ReportKey;
  label: string;
  requiredPermission: PermissionKey;
}

const BASE_APPLICATION_COLUMNS: readonly ReportColumnDefinition[] = [
  { key: "applicationId", label: "Postulación", sensitivity: "internal" },
  { key: "offering", label: "Oferta", sensitivity: "internal" },
  { key: "courseLevel", label: "Curso o nivel", sensitivity: "internal" },
  { key: "campus", label: "Sede", sensitivity: "internal" },
  { key: "process", label: "Proceso", sensitivity: "internal" },
  {
    key: "studentGivenName",
    label: "Nombre del estudiante",
    sensitivity: "restricted",
  },
  {
    key: "studentFamilyName",
    label: "Apellido del estudiante",
    sensitivity: "restricted",
  },
];

const COMMON_FILTERS: readonly ReportFilterKey[] = [
  "campusId",
  "processId",
  "offeringId",
  "courseLevelId",
  "dateFrom",
  "dateTo",
];

export const REPORT_CATALOG: readonly ReportDefinition[] = [
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      { key: "status", label: "Estado", sensitivity: "internal" },
      { key: "createdAt", label: "Creada", sensitivity: "internal" },
    ],
    allowedFilters: [...COMMON_FILTERS, "applicationStatus"],
    defaultColumns: [
      "applicationId",
      "offering",
      "courseLevel",
      "campus",
      "status",
      "createdAt",
    ],
    key: "APPLICATIONS_BY_COURSE_STATUS",
    label: "Postulaciones por curso y estado",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      {
        key: "documentRequirement",
        label: "Requisito documental",
        sensitivity: "internal",
      },
      { key: "status", label: "Estado", sensitivity: "internal" },
      { key: "dueAt", label: "Plazo de corrección", sensitivity: "internal" },
    ],
    allowedFilters: COMMON_FILTERS,
    defaultColumns: [
      "applicationId",
      "courseLevel",
      "documentRequirement",
      "status",
      "dueAt",
    ],
    key: "PENDING_DOCUMENTS",
    label: "Documentos pendientes",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      { key: "activity", label: "Actividad", sensitivity: "internal" },
      { key: "status", label: "Estado", sensitivity: "internal" },
      { key: "scheduledAt", label: "Cita vigente", sensitivity: "internal" },
    ],
    allowedFilters: COMMON_FILTERS,
    defaultColumns: [
      "applicationId",
      "courseLevel",
      "activity",
      "status",
      "scheduledAt",
    ],
    key: "ACTIVITIES",
    label: "Actividades",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      { key: "decision", label: "Disposición", sensitivity: "internal" },
      { key: "decidedAt", label: "Fecha de decisión", sensitivity: "internal" },
    ],
    allowedFilters: COMMON_FILTERS,
    defaultColumns: ["applicationId", "courseLevel", "decision", "decidedAt"],
    key: "DECISIONS",
    label: "Decisiones",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      {
        key: "waitlistState",
        label: "Estado de espera",
        sensitivity: "internal",
      },
      { key: "enteredAt", label: "Ingreso a espera", sensitivity: "internal" },
    ],
    allowedFilters: COMMON_FILTERS,
    defaultColumns: [
      "applicationId",
      "offering",
      "courseLevel",
      "waitlistState",
      "enteredAt",
    ],
    key: "WAITLIST",
    label: "Lista de espera",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      { key: "capacity", label: "Cupo configurado", sensitivity: "internal" },
      {
        key: "reservationState",
        label: "Estado de reserva",
        sensitivity: "internal",
      },
      { key: "reservedAt", label: "Reserva creada", sensitivity: "internal" },
    ],
    allowedFilters: COMMON_FILTERS,
    defaultColumns: [
      "applicationId",
      "offering",
      "courseLevel",
      "capacity",
      "reservationState",
      "reservedAt",
    ],
    key: "CAPACITY_RESERVATIONS",
    label: "Cupos y reservas",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
  {
    allowedColumns: [
      ...BASE_APPLICATION_COLUMNS,
      { key: "offerOrigin", label: "Origen", sensitivity: "internal" },
      { key: "offerLifecycle", label: "Estado", sensitivity: "internal" },
      { key: "issuedAt", label: "Emisión", sensitivity: "internal" },
      { key: "expiresAt", label: "Vencimiento", sensitivity: "internal" },
    ],
    allowedFilters: COMMON_FILTERS,
    defaultColumns: [
      "applicationId",
      "offering",
      "courseLevel",
      "offerOrigin",
      "offerLifecycle",
      "issuedAt",
      "expiresAt",
    ],
    key: "OFFERS",
    label: "Ofertas",
    requiredPermission: PERMISSIONS.REPORT_EXPORT,
  },
] as const;

export type CsvCell = boolean | number | string | null;
type CsvRow = Readonly<Record<string, CsvCell>>;

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportValidationError";
  }
}

export class ReportExportLimitExceededError extends Error {
  readonly code = "REPORT_EXPORT_LIMIT_EXCEEDED";

  constructor(readonly limit: number) {
    super("Report export exceeds the technical row limit");
    this.name = "ReportExportLimitExceededError";
  }
}

function firstSignificantCharacter(value: string): string | undefined {
  return value.match(/[^ ]/)?.[0];
}

export function neutralizeCsvFormula(value: string): string {
  const first = firstSignificantCharacter(value);
  return first !== undefined &&
    ["=", "+", "-", "@", "\t", "\r", "\n"].includes(first)
    ? `'${value}`
    : value;
}

function serializeCsvCell(value: CsvCell): string {
  const text =
    typeof value === "string"
      ? neutralizeCsvFormula(value)
      : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(
  columns: readonly string[],
  rows: readonly CsvRow[],
): string {
  return [
    columns.map(serializeCsvCell).join(","),
    ...rows.map((row) =>
      columns.map((column) => serializeCsvCell(row[column] ?? null)).join(","),
    ),
  ].join("\r\n");
}

function definitionFor(key: string): ReportDefinition {
  const definition = REPORT_CATALOG.find((item) => item.key === key);
  if (definition === undefined)
    throw new ReportValidationError("Unknown report key");
  return definition;
}

function validateSelection(
  definition: ReportDefinition,
  filters: ReportFilters,
  requestedColumns: readonly string[] | undefined,
): readonly string[] {
  const allowedFilters = new Set(definition.allowedFilters);
  for (const key of Object.keys(filters) as ReportFilterKey[]) {
    if (!allowedFilters.has(key))
      throw new ReportValidationError(`Filter ${key} is not allowed`);
  }
  const columns = requestedColumns ?? definition.defaultColumns;
  if (columns.length === 0 || new Set(columns).size !== columns.length) {
    throw new ReportValidationError(
      "Report columns must be non-empty and unique",
    );
  }
  const allowedColumns = new Set(
    definition.allowedColumns.map((column) => column.key),
  );
  if (columns.some((column) => !allowedColumns.has(column))) {
    throw new ReportValidationError("Unknown report column");
  }
  return columns;
}

function effectiveScopes(context: TenantExecutionContext): readonly string[] {
  return context.supportElevation?.scopes ?? context.scopes ?? [];
}

function applicationScopeWhere(
  context: TenantExecutionContext,
): Prisma.ApplicationWhereInput {
  const scopes = effectiveScopes(context);
  if (scopes.includes("*")) return {};
  const applicationIds = scopes
    .filter((s) => s.startsWith("application:"))
    .map((s) => s.slice(12));
  const offeringIds = scopes
    .filter((s) => s.startsWith("offering:"))
    .map((s) => s.slice(9));
  const processIds = scopes
    .filter((s) => s.startsWith("process:"))
    .map((s) => s.slice(8));
  const campusIds = scopes
    .filter((s) => s.startsWith("campus:"))
    .map((s) => s.slice(7));
  return {
    OR: [
      { id: { in: applicationIds } },
      { offeringId: { in: offeringIds } },
      { processId: { in: processIds } },
      { offering: { campusId: { in: campusIds } } },
    ],
  };
}

function filterApplicationWhere(
  context: TenantExecutionContext,
  filters: ReportFilters,
): Prisma.ApplicationWhereInput {
  const offeringFilter = {
    ...(filters.courseLevelId === undefined
      ? {}
      : { courseLevelId: filters.courseLevelId }),
    ...(filters.campusId === undefined ? {} : { campusId: filters.campusId }),
  };
  return {
    ...applicationScopeWhere(context),
    tenantId: context.tenantId,
    ...(filters.applicationStatus === undefined
      ? {}
      : { status: filters.applicationStatus }),
    ...(filters.offeringId === undefined
      ? {}
      : { offeringId: filters.offeringId }),
    ...(filters.processId === undefined
      ? {}
      : { processId: filters.processId }),
    ...(Object.keys(offeringFilter).length === 0
      ? {}
      : { offering: offeringFilter }),
    ...(filters.dateFrom === undefined && filters.dateTo === undefined
      ? {}
      : {
          createdAt: {
            ...(filters.dateFrom === undefined
              ? {}
              : { gte: filters.dateFrom }),
            ...(filters.dateTo === undefined ? {} : { lte: filters.dateTo }),
          },
        }),
  };
}

function valuesForApplication(application: {
  id: string;
  createdAt: Date;
  status: ApplicationStatus;
  student: { familyName: string; givenName: string };
  offering: {
    title: string;
    campus: { name: string };
    courseLevel: { name: string };
    process: { name: string };
  };
}): Record<string, CsvCell> {
  return {
    applicationId: application.id,
    campus: application.offering.campus.name,
    courseLevel: application.offering.courseLevel.name,
    createdAt: application.createdAt.toISOString(),
    offering: application.offering.title,
    process: application.offering.process.name,
    status: application.status,
    studentFamilyName: application.student.familyName,
    studentGivenName: application.student.givenName,
  };
}

const APPLICATION_INCLUDE = {
  offering: { include: { campus: true, courseLevel: true, process: true } },
  student: true,
} as const;

async function verifyFilterOwnership(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  filters: ReportFilters,
): Promise<void> {
  const checks = await Promise.all([
    filters.campusId === undefined
      ? true
      : transaction.campus
          .count({
            where: { id: filters.campusId, tenantId: context.tenantId },
          })
          .then((n) => n === 1),
    filters.processId === undefined
      ? true
      : transaction.admissionProcess
          .count({
            where: { id: filters.processId, tenantId: context.tenantId },
          })
          .then((n) => n === 1),
    filters.offeringId === undefined
      ? true
      : transaction.admissionOffering
          .count({
            where: { id: filters.offeringId, tenantId: context.tenantId },
          })
          .then((n) => n === 1),
    filters.courseLevelId === undefined
      ? true
      : transaction.courseLevel
          .count({
            where: { id: filters.courseLevelId, tenantId: context.tenantId },
          })
          .then((n) => n === 1),
  ]);
  if (checks.some((allowed) => !allowed)) throw new ForbiddenError();
}

async function queryRows(
  transaction: Prisma.TransactionClient,
  context: TenantExecutionContext,
  reportKey: ReportKey,
  filters: ReportFilters,
  take: number,
): Promise<CsvRow[]> {
  const applicationWhere = filterApplicationWhere(context, filters);
  if (reportKey === "APPLICATIONS_BY_COURSE_STATUS") {
    const rows = await transaction.application.findMany({
      include: APPLICATION_INCLUDE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      where: applicationWhere,
    });
    return rows.map(valuesForApplication);
  }
  if (reportKey === "PENDING_DOCUMENTS") {
    const rows = await transaction.documentSubmission.findMany({
      include: {
        application: { include: APPLICATION_INCLUDE },
        requirement: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      where: {
        application: applicationWhere,
        status: {
          in: [
            DocumentFunctionalStatus.PENDIENTE,
            DocumentFunctionalStatus.CARGADO,
            DocumentFunctionalStatus.EN_REVISION,
            DocumentFunctionalStatus.OBSERVADO,
          ],
        },
        tenantId: context.tenantId,
      },
    });
    return rows.map((row) => ({
      ...valuesForApplication(row.application),
      documentRequirement: row.requirement.name,
      dueAt: row.correctionDueAt?.toISOString() ?? null,
      status: row.status,
    }));
  }
  if (reportKey === "ACTIVITIES") {
    const rows = await transaction.applicationActivity.findMany({
      include: {
        application: { include: APPLICATION_INCLUDE },
        currentAppointment: true,
        definition: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      where: { application: applicationWhere, tenantId: context.tenantId },
    });
    return rows.map((row) => ({
      ...valuesForApplication(row.application),
      activity: row.definition.name,
      scheduledAt:
        row.currentAppointment?.scheduledStartAt.toISOString() ?? null,
      status: row.status,
    }));
  }
  if (reportKey === "DECISIONS") {
    const rows = await transaction.directionDecisionVersion.findMany({
      include: { application: { include: APPLICATION_INCLUDE } },
      orderBy: [{ decidedAt: "asc" }, { id: "asc" }],
      take,
      where: { application: applicationWhere, tenantId: context.tenantId },
    });
    return rows.map((row) => ({
      ...valuesForApplication(row.application),
      decidedAt: row.decidedAt.toISOString(),
      decision: row.disposition,
    }));
  }
  if (reportKey === "WAITLIST") {
    const rows = await transaction.waitlistEntry.findMany({
      include: { application: { include: APPLICATION_INCLUDE } },
      orderBy: [{ enteredAt: "asc" }, { id: "asc" }],
      take,
      where: { application: applicationWhere, tenantId: context.tenantId },
    });
    return rows.map((row) => ({
      ...valuesForApplication(row.application),
      enteredAt: row.enteredAt.toISOString(),
      waitlistState: row.state,
    }));
  }
  if (reportKey === "CAPACITY_RESERVATIONS") {
    const rows = await transaction.seatReservation.findMany({
      include: {
        application: { include: APPLICATION_INCLUDE },
        capacity: true,
      },
      orderBy: [{ reservedAt: "asc" }, { id: "asc" }],
      take,
      where: { application: applicationWhere, tenantId: context.tenantId },
    });
    return rows.map((row) => ({
      ...valuesForApplication(row.application),
      capacity: row.capacity.configuredCapacity,
      reservationState: row.state,
      reservedAt: row.reservedAt.toISOString(),
    }));
  }
  const rows = await transaction.admissionOffer.findMany({
    include: {
      application: { include: APPLICATION_INCLUDE },
      currentVersion: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
    where: { application: applicationWhere, tenantId: context.tenantId },
  });
  return rows.map((row) => ({
    ...valuesForApplication(row.application),
    expiresAt: row.currentVersion?.expiresAt.toISOString() ?? null,
    issuedAt: row.currentVersion?.issuedAt.toISOString() ?? null,
    offerLifecycle: row.currentVersion?.lifecycle ?? null,
    offerOrigin: row.origin,
  }));
}

async function recordReportAudit(
  prisma: PrismaClient,
  context: TenantExecutionContext,
  input: {
    action: string;
    columns?: readonly string[];
    filters?: ReportFilters;
    reasonCode?: string;
    reportKey: string;
    result: "DENY" | "SUCCESS";
    rowCount?: number;
  },
): Promise<void> {
  await withTenantTransaction(prisma, async (transaction) => {
    const metadata = sanitizeAuditMetadata({
      ...(input.columns === undefined ? {} : { columns: [...input.columns] }),
      ...(input.filters === undefined
        ? {}
        : {
            filters: Object.fromEntries(
              Object.entries(input.filters).map(([key, value]) => [
                key,
                value instanceof Date ? value.toISOString() : value,
              ]),
            ),
          }),
      reportKey: input.reportKey,
      ...(input.rowCount === undefined ? {} : { rowCount: input.rowCount }),
    });
    await transaction.auditEvent.create({
      data: {
        action: input.action,
        actorId: context.actorId,
        correlationId: context.correlationId,
        effectiveActorId: context.effectiveActorId ?? context.actorId,
        ...(metadata === undefined
          ? {}
          : { metadata: metadata as Prisma.InputJsonValue }),
        occurredAt: new Date(),
        purpose: context.purpose,
        ...(input.reasonCode === undefined
          ? {}
          : { reasonCode: input.reasonCode }),
        resourceType: "ReportExport",
        result: input.result,
        scope: "TENANT",
        tenantId: context.tenantId,
      },
    });
  });
}

function reportExportLimit(): number {
  const raw = process.env.REPORT_EXPORT_MAX_ROWS ?? "5000";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100_000) {
    throw new TypeError(
      "REPORT_EXPORT_MAX_ROWS must be an integer between 1 and 100000",
    );
  }
  return value;
}

export interface GeneratedReportCsv {
  columns: readonly string[];
  content: string;
  filename: string;
  reportKey: ReportKey;
  rowCount: number;
}

export class ReportingService {
  constructor(private readonly prisma: PrismaClient) {}

  listCatalog(): readonly ReportDefinition[] {
    const context = getRequiredTenantContext();
    if (!(context.capabilities ?? []).includes(PERMISSIONS.REPORT_READ)) {
      throw new ForbiddenError();
    }
    return REPORT_CATALOG;
  }

  async generateCsv(input: {
    columns?: readonly string[];
    filters: ReportFilters;
    reportKey: string;
  }): Promise<GeneratedReportCsv> {
    const context = getRequiredTenantContext();
    const capabilities = context.capabilities ?? [];
    if (
      !capabilities.includes(PERMISSIONS.REPORT_READ) ||
      !capabilities.includes(PERMISSIONS.REPORT_EXPORT)
    ) {
      await recordReportAudit(this.prisma, context, {
        action: "REPORT_EXPORT_DENIED",
        reasonCode: "MISSING_REPORT_PERMISSION",
        reportKey: input.reportKey,
        result: "DENY",
      });
      throw new ForbiddenError();
    }

    let definition: ReportDefinition;
    let columns: readonly string[];
    try {
      definition = definitionFor(input.reportKey);
      columns = validateSelection(definition, input.filters, input.columns);
    } catch (error) {
      await recordReportAudit(this.prisma, context, {
        action: "REPORT_EXPORT_DENIED",
        reasonCode: "INVALID_REPORT_SELECTION",
        reportKey: input.reportKey,
        result: "DENY",
      });
      throw error;
    }

    const restrictedSelected = definition.allowedColumns.some(
      (column) =>
        column.sensitivity === "restricted" && columns.includes(column.key),
    );
    if (
      restrictedSelected &&
      !capabilities.includes(PERMISSIONS.RESTRICTED_READ)
    ) {
      await recordReportAudit(this.prisma, context, {
        action: "REPORT_EXPORT_DENIED",
        columns,
        filters: input.filters,
        reasonCode: "RESTRICTED_READ_REQUIRED",
        reportKey: definition.key,
        result: "DENY",
      });
      throw new ForbiddenError();
    }

    await recordReportAudit(this.prisma, context, {
      action: "REPORT_EXPORT_REQUESTED",
      columns,
      filters: input.filters,
      reportKey: definition.key,
      result: "SUCCESS",
    });

    const limit = reportExportLimit();
    let rows: CsvRow[];
    try {
      rows = await withTenantTransaction(this.prisma, async (transaction) => {
        await verifyFilterOwnership(transaction, context, input.filters);
        return queryRows(
          transaction,
          context,
          definition.key,
          input.filters,
          limit + 1,
        );
      });
    } catch (error) {
      await recordReportAudit(this.prisma, context, {
        action: "REPORT_EXPORT_DENIED",
        columns,
        filters: input.filters,
        reasonCode:
          error instanceof ForbiddenError
            ? "RESOURCE_SCOPE_DENIED"
            : "REPORT_QUERY_FAILED",
        reportKey: definition.key,
        result: "DENY",
      });
      throw error;
    }
    if (rows.length > limit) {
      await recordReportAudit(this.prisma, context, {
        action: "REPORT_EXPORT_DENIED",
        columns,
        filters: input.filters,
        reasonCode: "REPORT_EXPORT_LIMIT_EXCEEDED",
        reportKey: definition.key,
        result: "DENY",
      });
      throw new ReportExportLimitExceededError(limit);
    }

    const content = serializeCsv(columns, rows);
    await recordReportAudit(this.prisma, context, {
      action: "REPORT_EXPORT_GENERATED",
      columns,
      filters: input.filters,
      reportKey: definition.key,
      result: "SUCCESS",
      rowCount: rows.length,
    });
    return {
      columns,
      content,
      filename: `admission-${definition.key.toLowerCase().replaceAll("_", "-")}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      reportKey: definition.key,
      rowCount: rows.length,
    };
  }
}
