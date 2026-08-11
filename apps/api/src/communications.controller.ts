import {
  runWithTenantContext,
  type TenantExecutionContext,
} from "@admission/database";
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiCommunicationsService } from "./communications.service.js";
import { parseUuid } from "./intake-schemas.js";
import { RequestContextService } from "./request-context.service.js";
import { z } from "zod";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

const confirmSchema = z
  .object({
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

const deliveryEvidenceSchema = z
  .object({
    evidence: z.record(z.string(), z.unknown()),
    providerReference: z.string().optional(),
  })
  .strict();

const manualContactSchema = z
  .object({
    notes: z.string().max(1000).optional(),
    outcome: z.string().min(1).max(120),
    purpose: z.string().min(1).max(120),
  })
  .strict();

@Controller()
export class CommunicationsController {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly communications: ApiCommunicationsService,
  ) {}

  @Get("staff/tenants/:tenantId/applications/:applicationId/communications")
  async listCommunications(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ): Promise<{ items: unknown[] }> {
    const context = await this.staffContext(
      request,
      tenantId,
      "communication.read",
    );
    return runWithTenantContext(context, async () => ({
      items: await this.communications.listCommunicationsForApplication(
        parseUuid(applicationId),
      ),
    }));
  }

  @Post("staff/tenants/:tenantId/communications/:communicationId/confirm")
  async confirm(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("communicationId") communicationId: string,
    @Body() body: unknown,
  ): Promise<{ item: unknown }> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "communication.confirm",
    );
    const parsed = confirmSchema.parse(body ?? {});
    return runWithTenantContext(context, async () => ({
      item: await this.communications.confirmCommunication({
        communicationId: parseUuid(communicationId),
        ...(parsed.expectedVersion !== undefined
          ? { expectedVersion: parsed.expectedVersion }
          : {}),
      }),
    }));
  }

  @Post("staff/tenants/:tenantId/communications/:communicationId/retry")
  async retry(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("communicationId") communicationId: string,
  ): Promise<{ item: unknown }> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "communication.retry",
    );
    return runWithTenantContext(context, async () => ({
      item: await this.communications.retryCommunication({
        communicationId: parseUuid(communicationId),
      }),
    }));
  }

  @Post("staff/tenants/:tenantId/communications/:communicationId/delivery-evidence")
  async deliveryEvidence(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("communicationId") communicationId: string,
    @Body() body: unknown,
  ): Promise<{ item: unknown }> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "communication.confirm",
    );
    const parsed = deliveryEvidenceSchema.parse(body);
    return runWithTenantContext(context, async () => ({
      item: await this.communications.recordDeliveryEvidence({
        communicationId: parseUuid(communicationId),
        evidence: parsed.evidence,
        ...(parsed.providerReference !== undefined
          ? { providerReference: parsed.providerReference }
          : {}),
      }),
    }));
  }

  @Post("staff/tenants/:tenantId/applications/:applicationId/manual-contacts")
  async recordManualContact(
    @Req() request: RequestLike,
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ): Promise<{ item: unknown }> {
    await this.contexts.assertMutationSafe(request);
    const context = await this.staffContext(
      request,
      tenantId,
      "manual_contact.record",
    );
    const parsed = manualContactSchema.parse(body);
    return runWithTenantContext(context, async () => ({
      item: await this.communications.recordManualContact({
        applicationId: parseUuid(applicationId),
        outcome: parsed.outcome,
        purpose: parsed.purpose,
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
      }),
    }));
  }

  private staffContext(
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
}
