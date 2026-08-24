import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { configureAdmissionApp } from "./app-bootstrap.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = Number(process.env.PORT ?? 3001);
  configureAdmissionApp(app);

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
