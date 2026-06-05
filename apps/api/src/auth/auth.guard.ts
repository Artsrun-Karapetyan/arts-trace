import { createHash } from "node:crypto";

import { prisma } from "@artstrace/database";
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "@/common/public.decorator";

type AuthedRequest = {
  method?: string;
  url?: string;
  headers: {
    authorization?: string;
  };
  authUser?: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  authToken?: string;
  authSessionId?: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const authHeader = request.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      throw new UnauthorizedException("Missing auth token");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) {
        await prisma.session.delete({ where: { tokenHash } });
      }
      throw new UnauthorizedException("Session expired");
    }

    request.authToken = token;
    request.authSessionId = session.id;
    request.authUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      createdAt: session.user.createdAt,
    };
    return true;
  }
}
