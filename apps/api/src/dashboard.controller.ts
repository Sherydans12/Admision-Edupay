import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOperationalDashboardService } from "./dashboard.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class DashboardController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly dashboard: ApiOperationalDashboardService,
  ) {}

  @Get("staff/tenants/:tenantId/dashboard/metrics")
  async getMetrics(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "dashboard.read",
    );
    return runWithTenantContext(context, () =>
      this.dashboard.getDashboardMetrics(),
    );
  }

  private staffContext(
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
