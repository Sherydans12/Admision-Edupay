import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { HealthService } from "./health.service.js";

export interface HealthResponse {
  service: "admission-api";
  status: "ok" | "unavailable";
}

@Controller("health")
export class HealthController {
  constructor(private readonly health = new HealthService()) {}

  @Get()
  getHealth(): HealthResponse {
    return this.health.live();
  }

  @Get("live")
  getLive(): HealthResponse {
    return this.health.live();
  }

  @Get("ready")
  async getReady(): Promise<HealthResponse> {
    const status = await this.health.ready();
    if (status.status !== "ok") {
      throw new ServiceUnavailableException();
    }
    return status;
  }
}
