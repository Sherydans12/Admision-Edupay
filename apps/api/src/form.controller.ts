import {
  runWithTenantContext,
  type FamilyExecutionContext,
  type TenantExecutionContext,
} from "@admission/database";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  answersSchema,
  draftVersionSchema,
  formDefinitionSchema,
  formFieldSchema,
  formSectionSchema,
  moveFormItemSchema,
  offeringFormVersionSchema,
  parseFormBody,
} from "./form-schemas.js";
import { ApiFormService } from "./form.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

@Controller()
export class FormController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly forms: ApiFormService,
  ) {}

  @Get("admin/tenants/:tenantId/forms")
  async listDefinitions(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ): Promise<unknown> {
    const context = await this.adminContext(request, tenantId, "form.read");
    return this.inTenant(context, async () => ({
      items: await this.forms.listDefinitions(context),
    }));
  }

  @Post("admin/tenants/:tenantId/forms")
  async createDefinition(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    return this.inTenant(context, () =>
      this.forms.createDefinition(
        context,
        parseFormBody(formDefinitionSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/forms/:definitionId/versions")
  async createVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("definitionId") definitionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    const input = parseFormBody(draftVersionSchema, body);
    return this.inTenant(context, () =>
      this.forms.createDraftVersion(
        context,
        parseUuid(definitionId),
        input.sourceVersionId,
      ),
    );
  }

  @Get("admin/tenants/:tenantId/form-versions/:versionId")
  async getVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    const context = await this.adminContext(request, tenantId, "form.read");
    return this.inTenant(context, () =>
      this.forms.getVersion(context, parseUuid(versionId)),
    );
  }

  @Post("admin/tenants/:tenantId/form-versions/:versionId/sections")
  async createSection(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    return this.inTenant(context, () =>
      this.forms.createSection(
        context,
        parseUuid(versionId),
        parseFormBody(formSectionSchema, body),
      ),
    );
  }

  @Patch("admin/tenants/:tenantId/form-sections/:sectionId")
  async updateSection(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    return this.inTenant(context, () =>
      this.forms.updateSection(
        context,
        parseUuid(sectionId),
        parseFormBody(formSectionSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/form-sections/:sectionId/move")
  async moveSection(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    const input = parseFormBody(moveFormItemSchema, body);
    return this.inTenant(context, () =>
      this.forms.moveSection(context, parseUuid(sectionId), input.direction),
    );
  }

  @Post("admin/tenants/:tenantId/form-versions/:versionId/fields")
  async createField(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    return this.inTenant(context, () =>
      this.forms.createField(
        context,
        parseUuid(versionId),
        parseFormBody(formFieldSchema, body),
      ),
    );
  }

  @Patch("admin/tenants/:tenantId/form-fields/:fieldId")
  async updateField(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("fieldId") fieldId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    return this.inTenant(context, () =>
      this.forms.updateField(
        context,
        parseUuid(fieldId),
        parseFormBody(formFieldSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/form-fields/:fieldId/move")
  async moveField(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("fieldId") fieldId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    const input = parseFormBody(moveFormItemSchema, body);
    return this.inTenant(context, () =>
      this.forms.moveField(context, parseUuid(fieldId), input.direction),
    );
  }

  @Get("admin/tenants/:tenantId/form-versions/:versionId/preview")
  async preview(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    const context = await this.adminContext(request, tenantId, "form.read");
    return this.inTenant(context, () =>
      this.forms.previewVersion(context, parseUuid(versionId)),
    );
  }

  @Post("admin/tenants/:tenantId/form-versions/:versionId/publish")
  async publish(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.publish");
    return this.inTenant(context, () =>
      this.forms.publishVersion(context, parseUuid(versionId)),
    );
  }

  @Post("admin/tenants/:tenantId/form-versions/:versionId/archive")
  async archive(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.publish");
    return this.inTenant(context, () =>
      this.forms.archiveVersion(context, parseUuid(versionId)),
    );
  }

  @Put("admin/tenants/:tenantId/offerings/:offeringId/form-version")
  async assignOffering(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(request, tenantId, "form.manage");
    const input = parseFormBody(offeringFormVersionSchema, body);
    return this.inTenant(context, () =>
      this.forms.assignOfferingVersion(
        context,
        parseUuid(offeringId),
        input.formVersionId,
      ),
    );
  }

  @Get("family/tenants/:tenantId/applications/:applicationId/form")
  async familyForm(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const family = await this.familyContext(request, "family.application.read");
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.application.read",
      "application.read",
    );
    return this.inTenant(applicant, () =>
      this.forms.getFamilyForm(family, applicant, parseUuid(applicationId)),
    );
  }

  @Put("family/tenants/:tenantId/applications/:applicationId/answers")
  async saveAnswers(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const family = await this.familyContext(
      request,
      "family.application.write",
    );
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.application.write",
      "application.write",
    );
    const input = parseFormBody(answersSchema, body);
    return this.inTenant(applicant, () =>
      this.forms.saveAnswers(
        family,
        applicant,
        parseUuid(applicationId),
        input.answers,
      ),
    );
  }

  @Get("family/tenants/:tenantId/applications/:applicationId/review")
  async review(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const family = await this.familyContext(request, "family.application.read");
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.application.read",
      "application.read",
    );
    return this.inTenant(applicant, () =>
      this.forms.getReview(family, applicant, parseUuid(applicationId)),
    );
  }

  @Post("family/tenants/:tenantId/applications/:applicationId/submit")
  async submit(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const family = await this.familyContext(
      request,
      "family.application.submit",
    );
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.application.submit",
      "application.submit",
    );
    return this.inTenant(applicant, () =>
      this.forms.submitApplication(family, applicant, parseUuid(applicationId)),
    );
  }

  private inTenant<T>(
    context: TenantExecutionContext,
    operation: () => Promise<T>,
  ) {
    return runWithTenantContext(context, operation);
  }

  private familyContext(
    request: RequestLike,
    purpose: string,
  ): Promise<FamilyExecutionContext> {
    return this.contexts.requireFamilyContext(request, purpose, {
      requiresProfile: true,
    });
  }

  private applicationContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
    permission: "application.read" | "application.submit" | "application.write",
  ) {
    return this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      purpose,
      permission,
    );
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
