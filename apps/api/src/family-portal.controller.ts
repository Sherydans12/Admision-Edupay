import {
  PERMISSIONS,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiFamilyPortalService } from "./family-portal.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class FamilyPortalController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly familyPortal: ApiFamilyPortalService,
  ) {}

  @Get("family/tenants/:tenantId/applications/:applicationId/projection")
  async getProjection(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.application.projection",
    );
    return runWithFamilyContext(family, () =>
      runWithTenantContext(applicant, () =>
        this.familyPortal.getFamilyApplicationProjection(
          parseUuid(applicationId),
        ),
      ),
    );
  }

  private async familyContexts(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ): Promise<[FamilyExecutionContext, TenantExecutionContext]> {
    const family = await this.contexts.requireFamilyContext(request, purpose, {
      requiresProfile: true,
    });
    const applicant = await this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      purpose,
      PERMISSIONS.APPLICATION_READ,
    );
    return [family, applicant];
  }
}
