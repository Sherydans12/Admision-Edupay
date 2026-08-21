import { runWithTenantContext } from "@admission/database";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { RequestContextService } from "./request-context.service.js";
import { ApiSensitiveProcessingService } from "./sensitive-processing.service.js";
import { parseBody, parseUuid } from "./intake-schemas.js";
import { updatePolicySchema } from "./sensitive-processing-schemas.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class SensitiveProcessingController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly sensitiveProcessing: ApiSensitiveProcessingService,
  ) {}

  @Get("admin/tenants/:tenantId/sensitive-processing")
  async readPolicies(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.config.read",
    );
    return runWithTenantContext(context, async () => ({
      items: await this.sensitiveProcessing.readEffectivePolicies(context),
    }));
  }

  @Post("admin/tenants/:tenantId/sensitive-processing/policy")
  async updatePolicy(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "admission.sensitive_processing.configure",
    );
    const input = parseBody(updatePolicySchema, body);
    return runWithTenantContext(context, async () =>
      this.sensitiveProcessing.updatePolicy(context, {
        category: input.category,
        enabled: input.enabled,
        purpose: input.purpose,
      }),
    );
  }
}
