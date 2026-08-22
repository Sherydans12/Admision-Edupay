import { runWithTenantContext } from "@admission/database";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { RequestContextService } from "./request-context.service.js";
import { ApiBusinessCalendarService } from "./business-calendar.service.js";
import { parseBody, parseUuid } from "./intake-schemas.js";
import {
  addExcludedDateSchema,
  configureBusinessCalendarSchema,
} from "./business-calendar-schemas.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class BusinessCalendarController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly calendarService: ApiBusinessCalendarService,
  ) {}

  @Get("admin/tenants/:tenantId/business-calendar")
  async getCalendar(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.config.read",
    );
    return runWithTenantContext(context, async () => {
      const item = await this.calendarService.getCalendar(context);
      return { item };
    });
  }

  @Post("admin/tenants/:tenantId/business-calendar")
  async configureCalendar(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.config.manage",
    );
    const input = parseBody(configureBusinessCalendarSchema, body);
    return runWithTenantContext(context, async () =>
      this.calendarService.configureCalendar(context, {
        timezone: input.timezone,
        ...(input.expectedVersion !== undefined
          ? { expectedVersion: input.expectedVersion }
          : {}),
      }),
    );
  }

  @Get("admin/tenants/:tenantId/business-calendar/excluded-dates")
  async listExcludedDates(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.config.read",
    );
    return runWithTenantContext(context, async () => ({
      items: await this.calendarService.listExcludedDates(context),
    }));
  }

  @Post("admin/tenants/:tenantId/business-calendar/excluded-dates")
  async addExcludedDate(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.config.manage",
    );
    const input = parseBody(addExcludedDateSchema, body);
    return runWithTenantContext(context, async () =>
      this.calendarService.addExcludedDate(context, input),
    );
  }

  @Delete(
    "admin/tenants/:tenantId/business-calendar/excluded-dates/:excludedDateId",
  )
  async removeExcludedDate(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("excludedDateId") excludedDateId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.config.manage",
    );
    const parsedExcludedDateId = parseUuid(excludedDateId);
    return runWithTenantContext(context, async () =>
      this.calendarService.removeExcludedDate(context, parsedExcludedDateId),
    );
  }
}
