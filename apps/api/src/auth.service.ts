import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@artstrace/database";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional()
});

const updateMeSchema = z.object({
  name: z.string().max(120).optional()
});

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  async register(body: unknown) {
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const password = hashPassword(parsed.data.password);
    const result = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name?.trim() || null,
          passwordHash: password.hash,
          passwordSalt: password.salt
        }
      });
      const session = await createSession(transaction, user.id);
      return { user, session };
    });

    return {
      user: toUser(result.user),
      token: result.session.token
    };
  }

  async login(body: unknown) {
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const verified = verifyPassword(parsed.data.password, user.passwordHash, user.passwordSalt);
    if (!verified) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const session = await createSession(prisma, user.id);
    return {
      user: toUser(user),
      token: session.token
    };
  }

  async logout(token: string) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
    return { success: true };
  }

  async me(user: AuthUser) {
    return user;
  }

  async updateMe(user: AuthUser, body: unknown) {
    const parsed = updateMeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name === undefined ? undefined : parsed.data.name.trim() || null
      }
    });

    return toUser(updated);
  }
}

function toUser(user: { id: string; email: string; name?: string | null; createdAt: Date }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    createdAt: user.createdAt
  };
}

function createSession(database: Pick<typeof prisma, "session">, userId: string): Promise<{ token: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  return database.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  }).then(() => ({ token }));
}

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password: string, passwordHash: string, passwordSalt: string): boolean {
  const hash = scryptSync(password, passwordSalt, 64);
  const expected = Buffer.from(passwordHash, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
