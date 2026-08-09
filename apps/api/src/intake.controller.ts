import {
  runWithTenantContext,
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
import { ApiIntakeService } from "./intake.service.js";
import {
  academicYearSchema,
  applicationSchema,
  campusSchema,
  courseLevelSchema,
  draftSchema,
  offeringSchema,
  parseBody,
  parseUuid,
  processSchema,
  profileSchema,
  studentSchema,
} from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

@Controller()
export class IntakeController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly intake: ApiIntakeService,
  ) {}

  @Get("auth/csrf")
  getCsrf(@Req() request: RequestLike) {
    return this.contexts.issueCsrfToken(request).then((token) => ({ token }));
  }

  @Get("family/tenants/:tenantId/offerings")
  async listOfferings(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.familyContext(
      request,
      tenantId,
      "family.offerings.read",
    );
    return this.inTenantContext(context, async () => ({
      items: await this.intake.listPublicOfferings(context),
    }));
  }

  @Put("family/tenants/:tenantId/profile")
  async saveProfile(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.familyContext(
      request,
      tenantId,
      "family.profile.write",
    );
    return this.inTenantContext(context, () =>
      this.intake.getOrCreateFamilyProfile(
        context,
        parseBody(profileSchema, body).displayName,
      ),
    );
  }

  @Get("family/tenants/:tenantId/profile")
  async getProfile(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.familyContext(
      request,
      tenantId,
      "family.profile.read",
    );
    return this.inTenantContext(context, () =>
      this.intake.getFamilyProfile(context),
    );
  }

  @Get("family/tenants/:tenantId/students")
  async listStudents(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.familyContext(
      request,
      tenantId,
      "family.students.read",
    );
    return this.inTenantContext(context, async () => ({
      items: await this.intake.listStudents(context),
    }));
  }

  @Post("family/tenants/:tenantId/students")
  async createStudent(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.familyContext(
      request,
      tenantId,
      "family.students.write",
    );
    return this.inTenantContext(context, () =>
      this.intake.createStudent(context, parseBody(studentSchema, body)),
    );
  }

  @Patch("family/tenants/:tenantId/students/:studentId")
  async updateStudent(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.familyContext(
      request,
      tenantId,
      "family.students.write",
    );
    return this.inTenantContext(context, () =>
      this.intake.updateStudent(
        context,
        parseUuid(studentId),
        parseBody(studentSchema, body),
      ),
    );
  }

  @Post("family/tenants/:tenantId/applications")
  async createApplication(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.familyContext(
      request,
      tenantId,
      "family.application.create",
    );
    return this.inTenantContext(context, () =>
      this.intake.createApplicationDraft(
        context,
        parseBody(applicationSchema, body),
      ),
    );
  }

  @Get("family/tenants/:tenantId/applications")
  async listApplications(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.familyContext(
      request,
      tenantId,
      "family.application.read",
    );
    return this.inTenantContext(context, async () => ({
      items: await this.intake.listApplications(context),
    }));
  }

  @Get("family/tenants/:tenantId/applications/:applicationId")
  async getApplication(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const context = await this.familyContext(
      request,
      tenantId,
      "family.application.read",
    );
    return this.inTenantContext(context, () =>
      this.intake.getApplication(context, parseUuid(applicationId)),
    );
  }

  @Patch("family/tenants/:tenantId/applications/:applicationId/draft")
  async saveDraft(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.familyContext(
      request,
      tenantId,
      "family.application.write",
    );
    return this.inTenantContext(context, () =>
      this.intake.saveApplicationDraft(
        context,
        parseUuid(applicationId),
        parseBody(draftSchema, body),
      ),
    );
  }

  @Get("admin/tenants/:tenantId/configuration")
  async getConfiguration(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.read",
    );
    return this.inTenantContext(context, () =>
      this.intake.getConfiguration(context),
    );
  }

  @Post("admin/tenants/:tenantId/campuses")
  async createCampus(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.createCampus(context, parseBody(campusSchema, body)),
    );
  }

  @Patch("admin/tenants/:tenantId/campuses/:campusId")
  async updateCampus(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("campusId") campusId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.updateCampus(
        context,
        parseUuid(campusId),
        parseBody(campusSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/academic-years")
  async createAcademicYear(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.createAcademicYear(
        context,
        parseBody(academicYearSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/course-levels")
  async createCourseLevel(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.createCourseLevel(
        context,
        parseBody(courseLevelSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/processes")
  async createProcess(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.createAdmissionProcess(
        context,
        parseBody(processSchema, body),
      ),
    );
  }

  @Patch("admin/tenants/:tenantId/processes/:processId")
  async updateProcess(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("processId") processId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.updateAdmissionProcess(
        context,
        parseUuid(processId),
        parseBody(processSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/offerings")
  async createOffering(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.createOffering(context, parseBody(offeringSchema, body)),
    );
  }

  @Patch("admin/tenants/:tenantId/offerings/:offeringId")
  async updateOffering(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.manage",
    );
    return this.inTenantContext(context, () =>
      this.intake.updateOffering(
        context,
        parseUuid(offeringId),
        parseBody(offeringSchema, body),
      ),
    );
  }

  private inTenantContext<T>(
    context: TenantExecutionContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    return runWithTenantContext(context, operation);
  }

  private async familyContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ) {
    return this.contexts.requireFamilyTenant(
      request,
      parseUuid(tenantId),
      purpose,
    );
  }

  private async adminContext(
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
