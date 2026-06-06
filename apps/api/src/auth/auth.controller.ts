import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Post,
  Req,
} from "@nestjs/common";

import { Public } from "@/common/public.decorator";

import { AuthService } from "./auth.service";

type AuthedRequest = {
  authUser?: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  authToken?: string;
};

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() body: unknown) {
    return this.authService.register(body);
  }

  @Public()
  @Post("login")
  login(@Body() body: unknown) {
    return this.authService.login(body);
  }

  @Get("me")
  me(@Req() request: AuthedRequest) {
    return this.authService.me(request.authUser!);
  }

  @Patch("me")
  updateMe(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.authService.updateMe(request.authUser!, body);
  }

  @Post("logout")
  logout(@Headers("authorization") authorization: string | undefined) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    return this.authService.logout(token);
  }
}
