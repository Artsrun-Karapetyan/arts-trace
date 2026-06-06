import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@artstrace/database";
import { NotFoundException } from "@nestjs/common";
import { z } from "zod";

export const projectRoles = ["MAINTAINER", "MEMBER", "VIEWER"] as const;
export type ProjectRole = (typeof projectRoles)[number];

export type AuthedRequest = {
  authUser?: {
    id: string;
  };
};

export async function ensureProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundException("Project not found");
  }
  if (project.ownerId === userId) {
    return { project, role: "MAINTAINER" as const };
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  });
  if (!member) {
    throw new NotFoundException("Project not found");
  }

  return {
    project,
    role: normalizeProjectRole(member.role),
  };
}

export async function ensureMaintainer(projectId: string, userId: string) {
  const access = await ensureProjectAccess(projectId, userId);
  if (access.role !== "MAINTAINER") {
    throw new NotFoundException("Project not found");
  }
  return access.project;
}

export function normalizeProjectRole(
  role: string | null | undefined,
): ProjectRole {
  if (role === "MAINTAINER" || role === "MEMBER" || role === "VIEWER") {
    return role;
  }
  return "MEMBER";
}

export async function generateUniqueApiKey(): Promise<string> {
  while (true) {
    const candidate = `at_${randomBytes(16).toString("hex")}`;
    const existing = await prisma.project.findUnique({
      where: { apiKey: candidate },
    });
    if (!existing) return candidate;
  }
}

export function getFingerprint(message: string, stack?: string): string {
  const firstStackLine =
    stack?.split("\n").find((line) => line.trim().length > 0) ?? "";
  return createHash("sha256")
    .update(`${message}|${firstStackLine}`)
    .digest("hex");
}

export function getManualReportFingerprint(
  projectId: string,
  title: string,
  url: string,
  description: string | null,
): string {
  return createHash("sha256")
    .update(`manual:${projectId}|${title}|${url}|${description ?? ""}`)
    .digest("hex");
}

export async function resolveExistingUserId(
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function deleteIssuesWithData(issueIds: string[]) {
  if (issueIds.length === 0) return;

  await prisma.$transaction(async (transaction) => {
    const eventIds = (
      await transaction.event.findMany({
        where: { issueId: { in: issueIds } },
        select: { id: true },
      })
    ).map((item) => item.id);

    if (eventIds.length > 0) {
      await transaction.breadcrumb.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await transaction.networkRequest.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await transaction.replayChunk.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await transaction.event.deleteMany({
        where: { issueId: { in: issueIds } },
      });
    }

    await transaction.issueComment.deleteMany({
      where: { issueId: { in: issueIds } },
    });
    await transaction.issue.deleteMany({ where: { id: { in: issueIds } } });
  });
}

// Validation schemas
export const createProjectSchema = z.object({
  name: z.string().min(2),
});

export const updateIssueSchema = z
  .object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "HIGHEST"]).optional(),
    assignee: z.string().max(120).optional(),
  })
  .refine(
    (body) =>
      body.status !== undefined ||
      body.priority !== undefined ||
      body.assignee !== undefined,
    {
      message: "At least one workflow field is required",
    },
  );

export const projectMemberSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.enum(projectRoles).optional(),
});

export const addExistingMemberSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  role: z.enum(projectRoles).optional(),
});

export const updateProjectMemberSchema = z
  .object({
    role: z.enum(projectRoles).optional(),
  })
  .refine((body) => body.role !== undefined, {
    message: "Role is required",
  });

export const projectInviteSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  role: z.enum(projectRoles).optional(),
});

export const issueCommentSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const deleteIssuesSchema = z.object({
  issueIds: z.array(z.string().min(1)).optional(),
});
