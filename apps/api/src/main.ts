import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: "5mb" });
  app.enableCors();
  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port);
}

void bootstrap();
