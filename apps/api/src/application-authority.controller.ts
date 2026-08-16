import {
  PERMISSIONS,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import {
  authorityDeclarationSchema,
  authorityReviewSchema,
  parseAuthorityBody,
} from "./application-authority-schemas.js";
import { ApiApplicationAuthorityService } from "./application-authority.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class ApplicationAuthorityController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly authorities: ApiApplicationAuthorityService,
  ) {}

  @Get("family/tenants/:tenantId/applications/:applicationId/authority")
  async getFamilyAuthority(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.application.authority.read",
      PERMISSIONS.APPLICATION_AUTHORITY_READ,
    );
    return this.inFamilyTenant(family, applicant, () =>
      this.authorities.getFamilyAuthority(
        family,
        applicant,
        parseUuid(applicationId),
      ),
    );
  }

  @Post("family/tenants/:tenantId/applications/:applicationId/authority")
  async declareAuthority(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.application.authority.declare",
      PERMISSIONS.APPLICATION_AUTHORITY_DECLARE,
    );
    const input = parseAuthorityBody(authorityDeclarationSchema, body);
    return this.inFamilyTenant(family, applicant, () =>
      this.authorities.declareApplicationAuthority(
        family,
        applicant,
        parseUuid(applicationId),
        input,
      ),
    );
  }

  @Get("staff/tenants/:tenantId/applications/:applicationId/authority")
  async getStaffAuthority(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "staff.application.authority.read",
    );
    return runWithTenantContext(context, () =>
      this.authorities.getStaffAuthority(context, parseUuid(applicationId)),
    );
  }

  @Post("staff/tenants/:tenantId/applications/:applicationId/authority/review")
  async reviewAuthority(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.contexts.requireAdminTenant(
      request,
      parseUuid(tenantId),
      "staff.application.authority.review",
    );
    const input = parseAuthorityBody(authorityReviewSchema, body);
    return runWithTenantContext(context, () =>
      this.authorities.reviewApplicationAuthority(
        context,
        parseUuid(applicationId),
        input,
      ),
    );
  }

  private async familyContexts(
    request: RequestLike,
    tenantId: string,
    purpose: string,
    permission: "application.authority.declare" | "application.authority.read",
  ): Promise<[FamilyExecutionContext, TenantExecutionContext]> {
    const family = await this.contexts.requireFamilyContext(request, purpose, {
      requiresProfile: true,
    });
    const applicant = await this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      purpose,
      permission,
    );
    return [family, applicant];
  }

  private inFamilyTenant<T>(
    family: FamilyExecutionContext,
    applicant: TenantExecutionContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    return runWithFamilyContext(family, () =>
      runWithTenantContext(applicant, operation),
    );
  }
}
