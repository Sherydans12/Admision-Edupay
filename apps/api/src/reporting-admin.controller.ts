import {
  runWithTenantContext,
  SupportElevationService,
  type AuditReadFilters,
  type ReportFilters,
  type TenantExecutionContext,
} from "@admission/database";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";

import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";
import {
  auditQuerySchema,
  parseReportingBody,
  reportExportSchema,
  roleAssignmentCreateSchema,
  roleAssignmentRevokeSchema,
  roleAssignmentUpdateSchema,
  supportElevationCloseSchema,
  supportElevationStartSchema,
} from "./reporting-admin-schemas.js";
import {
  ApiAuditReadService,
  ApiReportingService,
  ApiRoleAssignmentAdminService,
} from "./reporting-admin.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  send(body: string): void;
}

@Controller()
export class ReportingAdminController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly reporting: ApiReportingService,
    private readonly roleAssignments: ApiRoleAssignmentAdminService,
    private readonly audit: ApiAuditReadService,
    private readonly supportElevations: SupportElevationService,
  ) {}

  @Get("staff/tenants/:tenantId/access/me")
  async getOwnAccess(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.tenantContext(
      request,
      tenantId,
      "access.self.read",
    );
    return runWithTenantContext(context, () =>
      this.roleAssignments.getOwnAccess(),
    );
  }

  @Get("staff/tenants/:tenantId/reports")
  async listReports(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.tenantContext(request, tenantId, "report.read");
    return runWithTenantContext(context, () => ({
      items: this.reporting.listCatalog(),
    }));
  }

  @Post("staff/tenants/:tenantId/reports/:reportKey/export")
  async exportReport(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("reportKey") reportKey: string,
    @Body() body: unknown,
    @Res() response: ResponseLike,
  ): Promise<void> {
    await this.contexts.assertMutationSafe(request);
    const input = parseReportingBody(reportExportSchema, body);
    const filters: ReportFilters = {
      ...(input.filters.applicationStatus === undefined
        ? {}
        : { applicationStatus: input.filters.applicationStatus }),
      ...(input.filters.campusId === undefined
        ? {}
        : { campusId: input.filters.campusId }),
      ...(input.filters.courseLevelId === undefined
        ? {}
        : { courseLevelId: input.filters.courseLevelId }),
      ...(input.filters.dateFrom === undefined
        ? {}
        : { dateFrom: input.filters.dateFrom }),
      ...(input.filters.dateTo === undefined
        ? {}
        : { dateTo: input.filters.dateTo }),
      ...(input.filters.offeringId === undefined
        ? {}
        : { offeringId: input.filters.offeringId }),
      ...(input.filters.processId === undefined
        ? {}
        : { processId: input.filters.processId }),
    };
    const context = await this.tenantContext(
      request,
      tenantId,
      "report.export",
    );
    const result = await runWithTenantContext(context, () =>
      this.reporting.generateCsv({
        reportKey,
        filters,
        ...(input.columns === undefined ? {} : { columns: input.columns }),
      }),
    );
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).send(result.content);
  }

  @Get("admin/tenants/:tenantId/access")
  async listAccess(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.tenantContext(
      request,
      tenantId,
      "role_assignment.read",
    );
    return runWithTenantContext(context, async () => ({
      items: await this.roleAssignments.listMembershipAccess(),
    }));
  }

  @Post("admin/tenants/:tenantId/role-assignments")
  async createAssignment(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const input = parseReportingBody(roleAssignmentCreateSchema, body);
    const context = await this.tenantContext(
      request,
      tenantId,
      "role_assignment.manage",
    );
    return runWithTenantContext(context, () =>
      this.roleAssignments.createAssignment({
        membershipId: input.membershipId,
        permissions: input.permissions,
        roleKey: input.roleKey,
        scopes: input.scopes,
        startsAt: input.startsAt,
        ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt }),
      }),
    );
  }

  @Patch("admin/tenants/:tenantId/role-assignments/:assignmentId")
  async updateAssignment(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const input = parseReportingBody(roleAssignmentUpdateSchema, body);
    const context = await this.tenantContext(
      request,
      tenantId,
      "role_assignment.manage",
    );
    return runWithTenantContext(context, () =>
      this.roleAssignments.updateAssignment(parseUuid(assignmentId), {
        expectedUpdatedAt: input.expectedUpdatedAt,
        permissions: input.permissions,
        roleKey: input.roleKey,
        scopes: input.scopes,
        status: input.status,
        ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt }),
      }),
    );
  }

  @Post("admin/tenants/:tenantId/role-assignments/:assignmentId/revoke")
  async revokeAssignment(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const input = parseReportingBody(roleAssignmentRevokeSchema, body);
    const context = await this.tenantContext(
      request,
      tenantId,
      "role_assignment.manage",
    );
    return runWithTenantContext(context, () =>
      this.roleAssignments.revokeAssignment(
        parseUuid(assignmentId),
        input.expectedUpdatedAt,
      ),
    );
  }

  @Get("admin/tenants/:tenantId/audit-events")
  async listAudit(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Query() query: unknown,
  ) {
    const filters = parseReportingBody(auditQuerySchema, query);
    const auditFilters: AuditReadFilters = {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: filters.limit,
      ...(filters.action === undefined ? {} : { action: filters.action }),
      ...(filters.cursor === undefined ? {} : { cursor: filters.cursor }),
      ...(filters.purpose === undefined ? {} : { purpose: filters.purpose }),
      ...(filters.resourceId === undefined
        ? {}
        : { resourceId: filters.resourceId }),
      ...(filters.resourceType === undefined
        ? {}
        : { resourceType: filters.resourceType }),
    };
    const context = await this.tenantContext(request, tenantId, "audit.read");
    return runWithTenantContext(context, () =>
      this.audit.listEvents(auditFilters),
    );
  }

  @Post("platform/support-elevations")
  async startElevation(@Req() request: RequestLike, @Body() body: unknown) {
    await this.contexts.assertMutationSafe(request);
    const input = parseReportingBody(supportElevationStartSchema, body);
    const platformContext = await this.contexts.requirePlatformContext(
      request,
      "platform.support",
    );
    const elevation = await this.supportElevations.startSupportElevation({
      actorContext: platformContext,
      ...input,
    });
    return {
      categories: elevation.categories,
      expiresAt: elevation.expiresAt.toISOString(),
      id: elevation.id,
      purpose: elevation.purpose,
      scopes: elevation.scopes,
      startedAt: elevation.startedAt.toISOString(),
      tenantId: elevation.tenantId,
    };
  }

  @Post("platform/support-elevations/:elevationId/close")
  async closeElevation(
    @Req() request: RequestLike,
    @Param("elevationId") elevationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const input = parseReportingBody(supportElevationCloseSchema, body);
    const actorContext = await this.contexts.requirePlatformContext(
      request,
      "platform.support",
    );
    await this.supportElevations.closeSupportElevation({
      actorContext,
      elevationId: parseUuid(elevationId),
      targetTenantId: input.targetTenantId,
    });
    return { status: "CLOSED" };
  }

  private tenantContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ): Promise<TenantExecutionContext> {
    return this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      purpose,
    );
  }
}
