import type { INestApplication } from "@nestjs/common";

import { CorrelationMiddleware } from "./correlation.middleware.js";
import { GlobalErrorFilter } from "./error.filter.js";

export function configureAdmissionApp(app: INestApplication): void {
  app.enableCors({
    credentials: true,
    origin: process.env.ADMISSION_WEB_ORIGIN ?? "http://localhost:3000",
  });

  const correlationMiddleware = new CorrelationMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));
  app.useGlobalFilters(new GlobalErrorFilter());
}
