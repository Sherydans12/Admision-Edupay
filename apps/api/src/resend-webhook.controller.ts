import { Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";

import { ResendWebhookService } from "./resend-webhook.service.js";

interface RawWebhookRequest {
  headers?: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

@Controller()
export class ResendWebhookController {
  constructor(private readonly webhooks: ResendWebhookService) {}

  @Post("webhooks/resend")
  @HttpCode(HttpStatus.OK)
  async receive(@Req() request: RawWebhookRequest) {
    const result = await this.webhooks.process(request);
    return {
      accepted: true,
      idempotent: result.idempotent,
      ...("ignored" in result && result.ignored === true
        ? { ignored: true }
        : {}),
    };
  }
}
