import {
  runWithFamilyContext,
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
  Res,
} from "@nestjs/common";
import { ApiIntakeService } from "./intake.service.js";
import {
  academicYearSchema,
  applicationSchema,
  campusSchema,
  courseLevelSchema,
  draftSchema,
  offeringLifecycleCommandSchema,
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
  method?: string;
}

interface ResponseLike {
  header(name: string, value: string): void;
}

@Controller()
export class IntakeController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly intake: ApiIntakeService,
  ) {}

  @Get("auth/csrf")
  getCsrf(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    response.header("Cache-Control", "no-store, private");
    return this.contexts.issueCsrfToken(request).then((token) => ({ token }));
  }

  @Get("family/tenants/:tenantId/offerings")
  async listOfferings(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const context = await this.publicAdmissionContext(
      request,
      tenantId,
      "family.offerings.read",
    );
    return this.inTenantContext(context, async () => ({
      items: await this.intake.listPublicOfferings(context),
    }));
  }

  @Put("family/profile")
  async saveProfile(@Req() request: RequestLike, @Body() body: unknown) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.requireFamilyContext(
      request,
      "family.profile.write",
    );
    return this.inFamilyContext(context, () =>
      this.intake.getOrCreateFamilyProfile(
        context,
        parseBody(profileSchema, body).displayName,
      ),
    );
  }

  @Get("family/profile")
  async getProfile(@Req() request: RequestLike) {
    const context = await this.requireFamilyContext(
      request,
      "family.profile.read",
      false,
    );
    return this.inFamilyContext(context, () =>
      this.intake.getFamilyProfile(context),
    );
  }

  @Get("family/students")
  async listStudents(@Req() request: RequestLike) {
    const context = await this.requireFamilyContext(
      request,
      "family.students.read",
      false,
    );
    return this.inFamilyContext(context, async () => ({
      items: await this.intake.listStudents(context),
    }));
  }

  @Post("family/students")
  async createStudent(@Req() request: RequestLike, @Body() body: unknown) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.requireFamilyContext(
      request,
      "family.students.write",
      true,
    );
    return this.inFamilyContext(context, () =>
      this.intake.createStudent(context, parseBody(studentSchema, body)),
    );
  }

  @Patch("family/students/:studentId")
  async updateStudent(
    @Req() request: RequestLike,
    @Param("studentId") studentId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.requireFamilyContext(
      request,
      "family.students.write",
      true,
    );
    return this.inFamilyContext(context, () =>
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
    const familyContext = await this.requireFamilyContext(
      request,
      "family.application.create",
      true,
    );
    const publicContext = await this.publicAdmissionContext(
      request,
      tenantId,
      "family.application.create",
    );
    return this.inFamilyContext(familyContext, () =>
      this.intake.createApplicationDraft(
        familyContext,
        publicContext,
        parseBody(applicationSchema, body),
      ),
    );
  }

  @Get("family/tenants/:tenantId/applications")
  async listApplications(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ) {
    const familyContext = await this.requireFamilyContext(
      request,
      "family.application.read",
      true,
    );
    const applicantContext = await this.applicationContext(
      request,
      tenantId,
      "family.application.read",
    );
    return this.inTenantContext(applicantContext, async () => ({
      items: await this.intake.listApplications(
        familyContext,
        applicantContext,
      ),
    }));
  }

  @Get("family/tenants/:tenantId/applications/:applicationId")
  async getApplication(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const familyContext = await this.requireFamilyContext(
      request,
      "family.application.read",
      true,
    );
    const applicantContext = await this.applicationContext(
      request,
      tenantId,
      "family.application.read",
    );
    return this.inTenantContext(applicantContext, () =>
      this.intake.getApplication(
        familyContext,
        applicantContext,
        parseUuid(applicationId),
      ),
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
    const familyContext = await this.requireFamilyContext(
      request,
      "family.application.write",
      true,
    );
    const applicantContext = await this.applicationContext(
      request,
      tenantId,
      "family.application.write",
      "application.write",
    );
    return this.inTenantContext(applicantContext, () =>
      this.intake.saveApplicationDraft(
        familyContext,
        applicantContext,
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

  @Get("admin/tenants/:tenantId/offerings/:offeringId/readiness")
  async getOfferingReadiness(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("offeringId") offeringId: string,
  ) {
    const context = await this.adminContext(
      request,
      tenantId,
      "admission.config.read",
    );
    return this.inTenantContext(context, () =>
      this.intake.getOfferingReadiness(context, parseUuid(offeringId)),
    );
  }

  @Post("admin/tenants/:tenantId/offerings/:offeringId/publish")
  async publishOffering(
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
      this.intake.publishOffering(
        context,
        parseUuid(offeringId),
        parseBody(offeringLifecycleCommandSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/offerings/:offeringId/close")
  async closeOffering(
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
      this.intake.closeOffering(
        context,
        parseUuid(offeringId),
        parseBody(offeringLifecycleCommandSchema, body),
      ),
    );
  }

  private inTenantContext<T>(
    context: TenantExecutionContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    return runWithTenantContext(context, operation);
  }

  private inFamilyContext<T>(
    context: FamilyExecutionContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    return runWithFamilyContext(context, operation);
  }

  private async requireFamilyContext(
    request: RequestLike,
    purpose: string,
    requiresProfile = false,
  ) {
    return this.contexts.requireFamilyContext(request, purpose, {
      requiresProfile,
    });
  }

  private async publicAdmissionContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
  ) {
    return this.contexts.resolvePublicAdmissionContext(
      request,
      parseUuid(tenantId),
      purpose,
    );
  }

  private async applicationContext(
    request: RequestLike,
    tenantId: string,
    purpose: string,
    permission: "application.read" | "application.write" = "application.read",
  ) {
    return this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      purpose,
      permission,
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
