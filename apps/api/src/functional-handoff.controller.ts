import { runWithTenantContext } from "@admission/database";
import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiFunctionalHandoffService } from "./functional-handoff.service.js";
import { parseFunctionalHandoffBody } from "./functional-handoff-schemas.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class FunctionalHandoffController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly handoffs: ApiFunctionalHandoffService,
  ) {}

  @Post("staff/tenants/:tenantId/applications/:applicationId/handoff")
  async request(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "staff.application.handoff.request",
    );
    parseFunctionalHandoffBody(body);
    return runWithTenantContext(context, () =>
      this.handoffs.requestFunctionalHandoff(context, parseUuid(applicationId)),
    );
  }
}
