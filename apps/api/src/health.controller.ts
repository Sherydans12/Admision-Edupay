import { Controller, Get } from "@nestjs/common";

export interface HealthResponse {
  service: "admission-api";
  status: "ok";
}

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "admission-api",
      status: "ok",
    };
  }
}
