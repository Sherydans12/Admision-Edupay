import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  directionDecisionSchema,
  parseRecommendationBody,
  recommendationDraftSchema,
} from "./recommendation-schemas.js";
import { ApiRecommendationService } from "./recommendation.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class RecommendationController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly recommendations: ApiRecommendationService,
  ) {}

  @Get(
    "staff/tenants/:tenantId/applications/:applicationId/recommendation-workspace",
  )
  async recommendationWorkspace(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.recommendation.read",
    );
    return runWithTenantContext(context, () =>
      this.recommendations.getRecommendationWorkspace(
        context,
        parseUuid(applicationId),
      ),
    );
  }

  @Get("staff/tenants/:tenantId/applications/:applicationId/recommendations")
  async recommendationHistory(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.recommendation.read",
    );
    return runWithTenantContext(context, async () => {
      const workspace = await this.recommendations.getRecommendationWorkspace(
        context,
        parseUuid(applicationId),
      );
      return { items: workspace.recommendation.history };
    });
  }

  @Post(
    "staff/tenants/:tenantId/applications/:applicationId/recommendations/drafts",
  )
  async createDraft(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    return this.mutate(
      request,
      tenantId,
      "staff.recommendation.write",
      async (context) =>
        this.recommendations.createDraft(
          context,
          parseUuid(applicationId),
          parseRecommendationBody(recommendationDraftSchema, body),
        ),
    );
  }

  @Patch("staff/tenants/:tenantId/recommendation-versions/:versionId")
  async updateDraft(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ) {
    return this.mutate(
      request,
      tenantId,
      "staff.recommendation.write",
      async (context) =>
        this.recommendations.updateDraft(
          context,
          parseUuid(versionId),
          parseRecommendationBody(recommendationDraftSchema, body),
        ),
    );
  }

  @Post("staff/tenants/:tenantId/recommendation-versions/:versionId/submit")
  async submit(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.mutate(
      request,
      tenantId,
      "staff.recommendation.write",
      async (context) =>
        this.recommendations.submitRecommendation(
          context,
          parseUuid(versionId),
        ),
    );
  }

  @Get(
    "staff/tenants/:tenantId/applications/:applicationId/direction-workspace",
  )
  async directionWorkspace(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.direction.read",
    );
    return runWithTenantContext(context, () =>
      this.recommendations.getDirectionWorkspace(
        context,
        parseUuid(applicationId),
      ),
    );
  }

  @Post(
    "staff/tenants/:tenantId/applications/:applicationId/direction-decisions",
  )
  async decide(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    return this.mutate(
      request,
      tenantId,
      "staff.direction.write",
      async (context) =>
        this.recommendations.recordDirectionDecision(
          context,
          parseUuid(applicationId),
          parseRecommendationBody(directionDecisionSchema, body),
        ),
    );
  }

  private async staffContext(
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

  private async mutate<TResult>(
    request: RequestLike,
    tenantId: string,
    purpose: string,
    operation: (context: TenantExecutionContext) => Promise<TResult>,
  ): Promise<TResult> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(request, tenantId, purpose);
    return runWithTenantContext(context, () => operation(context));
  }
}
