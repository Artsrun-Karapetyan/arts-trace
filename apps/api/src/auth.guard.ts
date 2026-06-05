import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@artstrace/database";
import { createHash } from "node:crypto";

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
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const method = String(request.method ?? "").toUpperCase();
    const path = String(request.url ?? "").split("?")[0] ?? "";

    if (
      (method === "POST" && (path === "/auth/register" || path === "/auth/login")) ||
      (method === "GET" && /^\/invites\/[^/]+$/.test(path)) ||
      (method === "POST" && (path === "/events" || path === "/sourcemaps")) ||
      (method === "POST" && /^\/events\/[^/]+\/replay$/.test(path))
    ) {
      return true;
    }

    const authHeader = request.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      throw new UnauthorizedException("Missing auth token");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true }
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
      createdAt: session.user.createdAt
    };
    return true;
  }
}
