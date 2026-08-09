import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { CorrelationMiddleware } from "./correlation.middleware.js";
import { GlobalErrorFilter } from "./error.filter.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);

  app.use(new CorrelationMiddleware().use.bind(new CorrelationMiddleware()));
  app.useGlobalFilters(new GlobalErrorFilter());

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
