import {
  PERMISSIONS,
  runWithFamilyContext,
  runWithTenantContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  activityDefinitionSchema,
  activityVersionSchema,
  closeSchema,
  completedSchema,
  familyRescheduleRequestSchema,
  noShowSchema,
  notCompletedSchema,
  parseActivityBody,
  repeatSchema,
  scheduleSchema,
} from "./activity-schemas.js";
import { ApiActivityService } from "./activity.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class ActivityController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly activities: ApiActivityService,
  ) {}

  @Get("family/tenants/:tenantId/applications/:applicationId/activities")
  async familyActivities(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const family = await this.contexts.requireFamilyContext(
      request,
      "family.activities.read",
      { requiresProfile: true },
    );
    const applicant = await this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      "family.activities.read",
      PERMISSIONS.APPLICATION_READ,
    );
    return runWithFamilyContext(family, () =>
      runWithTenantContext(applicant, () =>
        this.activities.listFamilyActivities(
          family,
          applicant,
          parseUuid(applicationId),
        ),
      ),
    );
  }

  @Get(
    "family/tenants/:tenantId/applications/:applicationId/activities/:activityId",
  )
  async familyActivity(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Param("activityId") activityId: string,
  ) {
    const family = await this.contexts.requireFamilyContext(
      request,
      "family.activities.read",
      { requiresProfile: true },
    );
    const applicant = await this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      "family.activities.read",
      PERMISSIONS.APPLICATION_READ,
    );
    return runWithFamilyContext(family, () =>
      runWithTenantContext(applicant, () =>
        this.activities.getFamilyActivity(
          family,
          applicant,
          parseUuid(applicationId),
          parseUuid(activityId),
        ),
      ),
    );
  }

  @Post(
    "family/tenants/:tenantId/applications/:applicationId/activities/:activityId/appointments/:expectedAppointmentId/reschedule-requests",
  )
  async requestReschedule(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Param("activityId") activityId: string,
    @Param("expectedAppointmentId") expectedAppointmentId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const family = await this.contexts.requireFamilyContext(
      request,
      "family.activities.reschedule",
      { requiresProfile: true },
    );
    const applicant = await this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      "family.activities.reschedule",
      PERMISSIONS.APPLICATION_READ,
    );
    const input = parseActivityBody(familyRescheduleRequestSchema, body);
    return runWithFamilyContext(family, () =>
      runWithTenantContext(applicant, () =>
        this.activities.requestFamilyReschedule(
          family,
          applicant,
          parseUuid(applicationId),
          parseUuid(activityId),
          parseUuid(expectedAppointmentId),
          input.reason,
        ),
      ),
    );
  }

  @Get("staff/tenants/:tenantId/applications/:applicationId/activities")
  async staffActivities(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.read",
    );
    return runWithTenantContext(context, () =>
      this.activities.listStaffActivities(context, parseUuid(applicationId)),
    );
  }

  @Get("staff/tenants/:tenantId/activities/:activityId")
  async staffActivity(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.read",
    );
    return runWithTenantContext(context, () =>
      this.activities.getStaffActivity(context, parseUuid(activityId)),
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/schedule")
  async schedule(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    return this.mutateStaff(
      request,
      tenantId,
      activityId,
      "staff.activities.schedule",
      scheduleSchema,
      (context, input) =>
        this.activities.schedule(context, parseUuid(activityId), input),
      body,
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/reprogram")
  async reprogram(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    return this.mutateStaff(
      request,
      tenantId,
      activityId,
      "staff.activities.reprogram",
      scheduleSchema,
      (context, input) =>
        this.activities.reprogram(context, parseUuid(activityId), input),
      body,
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/record-no-show")
  async noShow(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.record",
    );
    const input = parseActivityBody(noShowSchema, body);
    return runWithTenantContext(context, () =>
      this.activities.recordOutcome(context, parseUuid(activityId), {
        ...input,
        operationalOutcome: "INASISTENCIA",
      }),
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/record-completed")
  async completed(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.record",
    );
    const input = parseActivityBody(completedSchema, body);
    return runWithTenantContext(context, () =>
      this.activities.recordOutcome(context, parseUuid(activityId), {
        ...input,
        operationalOutcome: "REALIZADA",
      }),
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/record-not-completed")
  async notCompleted(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.record",
    );
    const input = parseActivityBody(notCompletedSchema, body);
    return runWithTenantContext(context, () =>
      this.activities.recordOutcome(context, parseUuid(activityId), {
        ...input,
        operationalOutcome: "NO_COMPLETADA",
        result: "INCONCLUSO",
      }),
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/repeat")
  async repeat(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.repeat",
    );
    const input = parseActivityBody(repeatSchema, body);
    return runWithTenantContext(context, () =>
      this.activities.repeat(context, parseUuid(activityId), input),
    );
  }

  @Post("staff/tenants/:tenantId/activities/:activityId/close")
  async close(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.activities.close",
    );
    const input = parseActivityBody(closeSchema, body);
    return runWithTenantContext(context, () =>
      this.activities.closeActivityAfterNoShows(
        context,
        parseUuid(activityId),
        input.reason,
      ),
    );
  }

  @Get("admin/tenants/:tenantId/activities")
  async listDefinitions(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.adminContext(
      request,
      tenantId,
      "activity.definition.read",
    );
    return runWithTenantContext(context, async () => ({
      items: await this.activities.listDefinitions(context),
    }));
  }

  @Post("admin/tenants/:tenantId/activities")
  async createDefinition(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "activity.definition.manage",
    );
    return runWithTenantContext(context, () =>
      this.activities.createDefinition(
        context,
        parseActivityBody(activityDefinitionSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/activities/:definitionId/versions")
  async createVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("definitionId") definitionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "activity.definition.manage",
    );
    const input = parseActivityBody(activityVersionSchema, body);
    return runWithTenantContext(context, () =>
      this.activities.createVersion(context, parseUuid(definitionId), input),
    );
  }

  @Patch("admin/tenants/:tenantId/activity-versions/:versionId")
  async updateDraft(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "activity.definition.manage",
    );
    return runWithTenantContext(context, () =>
      this.activities.updateDraftVersion(
        context,
        parseUuid(versionId),
        parseActivityBody(activityVersionSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/activity-versions/:versionId/publish")
  async publish(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "activity.definition.publish",
    );
    return runWithTenantContext(context, () =>
      this.activities.publishVersion(context, parseUuid(versionId)),
    );
  }

  @Post("admin/tenants/:tenantId/activity-versions/:versionId/archive")
  async archive(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "activity.definition.publish",
    );
    return runWithTenantContext(context, () =>
      this.activities.archiveVersion(context, parseUuid(versionId)),
    );
  }

  private async mutateStaff<TSchema extends import("zod").ZodType, TResult>(
    request: RequestLike,
    tenantId: string,
    activityId: string,
    purpose: string,
    schema: TSchema,
    operation: (
      context: TenantExecutionContext,
      input: import("zod").output<TSchema>,
    ) => Promise<TResult>,
    body?: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(request, tenantId, purpose);
    const parsed = parseActivityBody(schema, body);
    return runWithTenantContext(context, () => operation(context, parsed));
  }

  private staffContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ) {
    return this.adminContext(request, tenantId, purpose);
  }

  private adminContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ) {
    return this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      purpose,
    );
  }
}
