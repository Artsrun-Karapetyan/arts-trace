import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AppService } from "./app.service";

@Module({
  controllers: [AuthController, AppController],
  providers: [AppService, AuthService, Reflector, { provide: APP_GUARD, useClass: AuthGuard }]
})
export class AppModule {}
