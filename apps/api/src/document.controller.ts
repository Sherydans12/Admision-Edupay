import {
  IntakeValidationError,
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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { ApiAssistanceService } from "./assistance.service.js";
import {
  acceptDocumentSchema,
  assistedAnswersSchema,
  assistedApplicationSchema,
  assistanceStartSchema,
  compactRequirementVersionInput,
  parseDocumentBody,
  requirementSchema,
  requirementVersionSchema,
  observeDocumentSchema,
  reviewReasonSchema,
} from "./document-schemas.js";
import { ApiDocumentService } from "./document.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

interface UploadedDocumentFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

interface DownloadResponse {
  end(bytes: Uint8Array): void;
  setHeader(name: string, value: string): void;
}

const uploadLimit = Number(
  process.env.DOCUMENT_UPLOAD_HARD_MAX_BYTES ?? 10 * 1024 * 1024,
);
const uploadInterceptor = FileInterceptor("file", {
  limits: { fileSize: uploadLimit, files: 1 },
});

function requireUpload(file: UploadedDocumentFile | undefined) {
  if (file === undefined || file.size !== file.buffer.byteLength) {
    throw new IntakeValidationError("A bounded multipart file is required");
  }
  return file;
}

function parseUploadMetadata(body: Record<string, unknown>) {
  const issued =
    typeof body.documentIssuedOn === "string" ? body.documentIssuedOn : null;
  const equivalent =
    typeof body.equivalentOptionCode === "string"
      ? body.equivalentOptionCode
      : null;
  return { documentIssuedOn: issued, equivalentOptionCode: equivalent };
}

@Controller()
export class DocumentController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly documents: ApiDocumentService,
    private readonly assistance: ApiAssistanceService,
  ) {}

  @Get("admin/tenants/:tenantId/document-requirements")
  async listRequirements(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
  ): Promise<unknown> {
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.read",
    );
    return this.inTenant(context, () =>
      this.documents.listRequirements(context),
    );
  }

  @Post("admin/tenants/:tenantId/document-requirements")
  async createRequirement(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.manage",
    );
    return this.inTenant(context, () =>
      this.documents.createRequirement(
        context,
        parseDocumentBody(requirementSchema, body),
      ),
    );
  }

  @Post("admin/tenants/:tenantId/document-requirements/:requirementId/versions")
  async createRequirementVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("requirementId") requirementId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.manage",
    );
    return this.inTenant(context, () =>
      this.documents.createRequirementVersion(
        context,
        parseUuid(requirementId),
        compactRequirementVersionInput(
          parseDocumentBody(requirementVersionSchema, body),
        ),
      ),
    );
  }

  @Get("admin/tenants/:tenantId/document-requirement-versions/:versionId")
  async getRequirementVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ): Promise<unknown> {
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.read",
    );
    return this.inTenant(context, () =>
      this.documents.getRequirementVersion(context, parseUuid(versionId)),
    );
  }

  @Patch("admin/tenants/:tenantId/document-requirement-versions/:versionId")
  async updateRequirementVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.manage",
    );
    return this.inTenant(context, () =>
      this.documents.updateRequirementVersion(
        context,
        parseUuid(versionId),
        compactRequirementVersionInput(
          parseDocumentBody(requirementVersionSchema, body),
        ),
      ),
    );
  }

  @Post(
    "admin/tenants/:tenantId/document-requirement-versions/:versionId/publish",
  )
  async publishRequirementVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ): Promise<unknown> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.publish",
    );
    return this.inTenant(context, () =>
      this.documents.publishRequirementVersion(context, parseUuid(versionId)),
    );
  }

  @Post(
    "admin/tenants/:tenantId/document-requirement-versions/:versionId/archive",
  )
  async archiveRequirementVersion(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ): Promise<unknown> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.requirement.publish",
    );
    return this.inTenant(context, () =>
      this.documents.archiveRequirementVersion(context, parseUuid(versionId)),
    );
  }

  @Get("family/tenants/:tenantId/applications/:applicationId/documents")
  async listFamilyDocuments(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ): Promise<unknown> {
    const family = await this.familyContext(request, "family.document.read");
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.document.read",
    );
    return this.inTenant(applicant, () =>
      this.documents.listFamilyDocuments(
        family,
        applicant,
        parseUuid(applicationId),
      ),
    );
  }

  @Post(
    "family/tenants/:tenantId/applications/:applicationId/document-submissions/:submissionId/upload",
  )
  @UseInterceptors(uploadInterceptor)
  async uploadFamilyDocument(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Param("submissionId") submissionId: string,
    @UploadedFile() uploaded: UploadedDocumentFile | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    await this.contexts.assertMutationSafe(request);
    const file = requireUpload(uploaded);
    const family = await this.familyContext(request, "family.document.upload");
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.document.upload",
    );
    return this.inTenant(applicant, () =>
      this.documents.uploadFamilyDocument(
        family,
        applicant,
        parseUuid(applicationId),
        parseUuid(submissionId),
        {
          bytes: file.buffer,
          declaredMime: file.mimetype,
          ...parseUploadMetadata(body),
          originalFilename: file.originalname,
        },
      ),
    );
  }

  @Get(
    "family/tenants/:tenantId/applications/:applicationId/document-versions/:versionId/download",
  )
  async downloadFamilyDocument(
    @Req() request: RequestLike,
    @Res() response: DownloadResponse,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Param("versionId") versionId: string,
  ) {
    const family = await this.familyContext(request, "family.document.read");
    const applicant = await this.applicationContext(
      request,
      tenantId,
      "family.document.read",
    );
    const result = await this.inTenant(applicant, () =>
      this.documents.downloadFamilyDocument(
        family,
        applicant,
        parseUuid(applicationId),
        parseUuid(versionId),
      ),
    );
    this.sendDownload(response, result);
  }

  @Get("staff/tenants/:tenantId/applications/:applicationId/documents")
  async listStaffDocuments(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ): Promise<unknown> {
    const context = await this.staffContext(request, tenantId, "document.read");
    return this.inTenant(context, () =>
      this.documents.listStaffDocuments(context, parseUuid(applicationId)),
    );
  }

  @Get("staff/tenants/:tenantId/document-versions/:versionId/download")
  async downloadStaffDocument(
    @Req() request: RequestLike,
    @Res() response: DownloadResponse,
    @Param("tenantId") tenantId: string,
    @Param("versionId") versionId: string,
  ) {
    const context = await this.staffContext(request, tenantId, "document.read");
    const result = await this.inTenant(context, () =>
      this.documents.downloadStaffDocument(context, parseUuid(versionId)),
    );
    this.sendDownload(response, result);
  }

  @Post("staff/tenants/:tenantId/document-submissions/:submissionId/accept")
  async accept(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.review",
    );
    return this.inTenant(context, () =>
      this.documents.acceptDocument(
        context,
        parseUuid(submissionId),
        parseDocumentBody(acceptDocumentSchema, body).expectedDocumentVersionId,
      ),
    );
  }

  @Post("staff/tenants/:tenantId/document-submissions/:submissionId/observe")
  async observe(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const parsed = parseDocumentBody(observeDocumentSchema, body);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.review",
    );
    return this.inTenant(context, () =>
      this.documents.observeDocument(
        context,
        parseUuid(submissionId),
        parsed.expectedDocumentVersionId,
        parsed.reason,
      ),
    );
  }

  @Post("staff/tenants/:tenantId/document-submissions/:submissionId/exempt")
  async exempt(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "document.exempt",
    );
    return this.inTenant(context, () =>
      this.documents.exemptDocument(
        context,
        parseUuid(submissionId),
        parseDocumentBody(reviewReasonSchema, body).reason,
      ),
    );
  }

  @Post("staff/tenants/:tenantId/assistance-sessions")
  async startAssistance(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    return this.inTenant(context, () =>
      this.assistance.startSession(
        context,
        parseDocumentBody(assistanceStartSchema, body),
      ),
    );
  }

  @Post("staff/tenants/:tenantId/assistance-sessions/:sessionId/applications")
  async createAssistedApplication(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    return this.inTenant(context, () =>
      this.assistance.createAssistedApplicationDraft(
        context,
        parseUuid(sessionId),
        parseDocumentBody(assistedApplicationSchema, body),
      ),
    );
  }

  @Put(
    "staff/tenants/:tenantId/assistance-sessions/:sessionId/applications/:applicationId/answers",
  )
  async saveAssistedAnswers(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    return this.inTenant(context, () =>
      this.assistance.saveAssistedAnswers(
        context,
        parseUuid(sessionId),
        parseUuid(applicationId),
        parseDocumentBody(assistedAnswersSchema, body).answers,
      ),
    );
  }

  @Get(
    "staff/tenants/:tenantId/assistance-sessions/:sessionId/applications/:applicationId/workflow",
  )
  async getAssistedWorkflow(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Param("applicationId") applicationId: string,
  ): Promise<unknown> {
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    return this.inTenant(context, () =>
      this.assistance.getAssistedWorkflow(
        context,
        parseUuid(sessionId),
        parseUuid(applicationId),
      ),
    );
  }

  @Post(
    "staff/tenants/:tenantId/assistance-sessions/:sessionId/applications/:applicationId/document-submissions/:submissionId/upload",
  )
  @UseInterceptors(uploadInterceptor)
  async uploadAssistedDocument(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Param("applicationId") applicationId: string,
    @Param("submissionId") submissionId: string,
    @UploadedFile() uploaded: UploadedDocumentFile | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    await this.contexts.assertMutationSafe(request);
    const file = requireUpload(uploaded);
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    const origin =
      body.origin === "PHYSICAL_DOCUMENT" ? "PHYSICAL_DOCUMENT" : "ASSISTED";
    return this.inTenant(context, () =>
      this.assistance.uploadAssistedDocument(
        context,
        parseUuid(sessionId),
        parseUuid(applicationId),
        parseUuid(submissionId),
        {
          bytes: file.buffer,
          declaredMime: file.mimetype,
          ...parseUploadMetadata(body),
          origin,
          originalFilename: file.originalname,
        },
      ),
    );
  }

  @Post(
    "staff/tenants/:tenantId/assistance-sessions/:sessionId/applications/:applicationId/submit",
  )
  async submitAssistedApplication(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Param("applicationId") applicationId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    return this.inTenant(context, () =>
      this.assistance.submitAssistedApplication(
        context,
        parseUuid(sessionId),
        parseUuid(applicationId),
      ),
    );
  }

  @Post("staff/tenants/:tenantId/assistance-sessions/:sessionId/close")
  async closeAssistance(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
  ) {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "application.assist",
    );
    return this.inTenant(context, () =>
      this.assistance.closeSession(context, parseUuid(sessionId)),
    );
  }

  private sendDownload(
    response: DownloadResponse,
    result: { bytes: Uint8Array; contentType: string; displayName: string },
  ): void {
    const filename = result.displayName.replaceAll('"', "_");
    response.setHeader("Content-Type", result.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(result.bytes);
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
  ) {
    return this.contexts.requireApplicationTenant(
      request,
      parseUuid(tenantId),
      purpose,
      purpose === "family.document.upload"
        ? "document.upload"
        : "document.read",
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
}
