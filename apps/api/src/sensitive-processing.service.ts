import {
  SensitiveProcessingService,
  type SensitiveProcessingPolicyDto,
  type EffectivePolicyEntry,
  type TenantExecutionContext,
  type UpdatePolicyInput,
} from "@admission/database";
import type { PrismaClient } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiSensitiveProcessingService {
  private readonly service: SensitiveProcessingService;

  constructor(prisma: PrismaClient) {
    this.service = new SensitiveProcessingService(prisma);
  }

  readEffectivePolicies(
    context: TenantExecutionContext,
  ): Promise<EffectivePolicyEntry[]> {
    return this.service.readEffectivePolicies(context);
  }

  readPolicies(
    context: TenantExecutionContext,
  ): Promise<SensitiveProcessingPolicyDto[]> {
    return this.service.readPolicies(context);
  }

  updatePolicy(
    context: TenantExecutionContext,
    input: UpdatePolicyInput,
  ): Promise<SensitiveProcessingPolicyDto> {
    return this.service.updatePolicy(context, input);
  }
}
