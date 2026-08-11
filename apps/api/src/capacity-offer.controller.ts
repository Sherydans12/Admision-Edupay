import {
  PERMISSIONS,
  runWithFamilyContext,
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  capacityAdjustmentSchema,
  capacityCreateSchema,
  offerReopenSchema,
  offerVersionCommandSchema,
  parseCapacityOfferBody,
  waitlistPromotionSchema,
  withdrawalSchema,
} from "./capacity-offer-schemas.js";
import { ApiCapacityOfferService } from "./capacity-offer.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class CapacityOfferController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly capacityOffers: ApiCapacityOfferService,
  ) {}

  @Get("staff/tenants/:tenantId/offerings/:offeringId/capacity")
  async getCapacity(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.capacity.read",
    );
    return runWithTenantContext(context, () =>
      this.capacityOffers.getCapacity(context, parseUuid(offeringId)),
    );
  }

  @Post("staff/tenants/:tenantId/offerings/:offeringId/capacity")
  async createCapacity(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.capacity.manage",
    );
    const input = parseCapacityOfferBody(capacityCreateSchema, body);
    return runWithTenantContext(context, () =>
      this.capacityOffers.createCapacity(context, parseUuid(offeringId), input),
    );
  }

  @Patch("staff/tenants/:tenantId/offerings/:offeringId/capacity")
  async adjustCapacity(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.capacity.manage",
    );
    const input = parseCapacityOfferBody(capacityAdjustmentSchema, body);
    return runWithTenantContext(context, () =>
      this.capacityOffers.adjustCapacity(context, parseUuid(offeringId), input),
    );
  }

  @Get("staff/tenants/:tenantId/offerings/:offeringId/waitlist")
  async listWaitlist(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.waitlist.read",
    );
    return runWithTenantContext(context, async () => ({
      items: await this.capacityOffers.listWaitlist(
        context,
        parseUuid(offeringId),
      ),
    }));
  }

  @Post("staff/tenants/:tenantId/waitlist/:entryId/promote")
  async promote(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("entryId") entryId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.waitlist.promote",
    );
    const input = parseCapacityOfferBody(waitlistPromotionSchema, body);
    return runWithTenantContext(context, () =>
      this.capacityOffers.promoteWaitlistEntry(
        context,
        parseUuid(entryId),
        input,
      ),
    );
  }

  @Get("staff/tenants/:tenantId/applications/:applicationId/admission-offer")
  async staffOffer(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.offer.read",
    );
    return runWithTenantContext(context, () =>
      this.capacityOffers.getStaffOffer(context, parseUuid(applicationId)),
    );
  }

  @Post("staff/tenants/:tenantId/offers/:offerId/reopen")
  async reopen(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offerId") offerId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "staff.offer.reopen",
    );
    const input = parseCapacityOfferBody(offerReopenSchema, body);
    return runWithTenantContext(context, () =>
      this.capacityOffers.reopenOffer(context, parseUuid(offerId), input),
    );
  }

  @Get("family/tenants/:tenantId/applications/:applicationId/admission-status")
  async familyProjection(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.admission-status.read",
    );
    return this.inFamilyTenant(family, applicant, () =>
      this.capacityOffers.getFamilyProjection(
        family,
        applicant,
        parseUuid(applicationId),
      ),
    );
  }

  @Post("family/tenants/:tenantId/offers/:offerId/accept")
  async accept(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offerId") offerId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.offer.accept",
    );
    const input = parseCapacityOfferBody(offerVersionCommandSchema, body);
    return this.inFamilyTenant(family, applicant, () =>
      this.capacityOffers.acceptOffer(
        family,
        applicant,
        parseUuid(offerId),
        input,
      ),
    );
  }

  @Post("family/tenants/:tenantId/offers/:offerId/decline")
  async decline(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offerId") offerId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.offer.decline",
    );
    const input = parseCapacityOfferBody(offerVersionCommandSchema, body);
    return this.inFamilyTenant(family, applicant, () =>
      this.capacityOffers.declineOffer(
        family,
        applicant,
        parseUuid(offerId),
        input,
      ),
    );
  }

  @Post("family/tenants/:tenantId/applications/:applicationId/withdraw")
  async withdraw(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const [family, applicant] = await this.familyContexts(
      request,
      tenantId,
      "family.application.withdraw",
    );
    const input = parseCapacityOfferBody(withdrawalSchema, body);
    return this.inFamilyTenant(family, applicant, () =>
      this.capacityOffers.withdrawApplication(
        family,
        applicant,
        parseUuid(applicationId),
        input.confirmed,
      ),
    );
  }

  private staffContext(
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
