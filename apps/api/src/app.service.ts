import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ingestEventSchema, uploadReplaySchema, uploadSourceMapSchema } from "@artstrace/shared";
import { prisma } from "@artstrace/database";
import type { Prisma } from "@artstrace/database";
import { createHash, randomBytes } from "node:crypto";
import { SourceMapConsumer } from "source-map-js";
import type { RawSourceMap } from "source-map-js";
import { z } from "zod";

const projectRoles = ["MAINTAINER", "MEMBER", "VIEWER"] as const;
type ProjectRole = (typeof projectRoles)[number];

@Injectable()
export class AppService {
  async createProject(ownerId: string, body: unknown) {
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const apiKey = await generateUniqueApiKey();
    const project = await prisma.project.create({
      data: {
        ownerId,
        name: parsed.data.name.trim(),
        apiKey
      }
    });

    return {
      id: project.id,
      name: project.name,
      apiKey: project.apiKey,
      createdAt: project.createdAt
    };
  }

  async createEvent(body: unknown) {
    const parsed = ingestEventSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { apiKey: parsed.data.apiKey }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const fingerprint = getFingerprint(parsed.data.message, parsed.data.stack);
    const source = await getSource(
      project.id,
      parsed.data.release,
      parsed.data.filePath,
      parsed.data.fileName,
      parsed.data.line,
      parsed.data.column,
      parsed.data.stack
    );

    const hasExtendedNetworkColumns = parsed.data.networkRequests?.length
      ? await hasNetworkInspectorColumns()
      : false;

    return prisma.$transaction(async (transaction) => {
      const issue = await transaction.issue.upsert({
        where: {
          projectId_fingerprint: {
            projectId: project.id,
            fingerprint
          }
        },
        create: {
          projectId: project.id,
          fingerprint,
          message: parsed.data.message,
          count: 1,
          firstSeen: new Date(parsed.data.timestamp),
          lastSeen: new Date(parsed.data.timestamp)
        },
        update: {
          count: { increment: 1 },
          message: parsed.data.message,
          lastSeen: new Date(parsed.data.timestamp)
        }
      });

      const createdEvent = await transaction.event.create({
        data: {
          projectId: project.id,
          issueId: issue.id,
          message: parsed.data.message,
          stack: parsed.data.stack,
          fileName: source?.fileName,
          line: source?.line,
          column: source?.column,
          sourceContext: source?.sourceContext as Prisma.InputJsonValue | undefined,
          url: parsed.data.url,
          userAgent: parsed.data.userAgent,
          userId: parsed.data.userId,
          userName: parsed.data.userName,
          userRole: parsed.data.userRole,
          createdAt: new Date(parsed.data.timestamp)
        }
      });

      if (parsed.data.breadcrumbs?.length) {
        await transaction.breadcrumb.createMany({
          data: parsed.data.breadcrumbs.map((item) => ({
            eventId: createdEvent.id,
            type: item.type,
            message: item.message,
            data: item.data as Prisma.InputJsonValue | undefined,
            createdAt: new Date(item.createdAt)
          }))
        });
      }

      if (parsed.data.networkRequests?.length) {
        await persistNetworkRequestsCompat(
          transaction,
          createdEvent.id,
          parsed.data.networkRequests,
          hasExtendedNetworkColumns
        );
      }

      if (parsed.data.replayEvents?.length) {
        await transaction.replayChunk.upsert({
          where: { eventId: createdEvent.id },
          create: {
            eventId: createdEvent.id,
            events: parsed.data.replayEvents as Prisma.InputJsonValue
          },
          update: {
            events: parsed.data.replayEvents as Prisma.InputJsonValue
          }
        });
      }

      return { success: true, eventId: createdEvent.id };
    });
  }

  async uploadReplay(eventId: string, body: unknown) {
    const parsed = uploadReplaySchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { project: true }
    });

    if (!event || event.project.apiKey !== parsed.data.apiKey) {
      throw new NotFoundException("Event not found");
    }

    await prisma.replayChunk.upsert({
      where: { eventId },
      create: {
        eventId,
        events: parsed.data.replayEvents as Prisma.InputJsonValue
      },
      update: {
        events: parsed.data.replayEvents as Prisma.InputJsonValue
      }
    });

    return { success: true };
  }

  async uploadSourceMap(body: unknown) {
    const parsed = uploadSourceMapSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { apiKey: parsed.data.apiKey }
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const fileName = normalizeFileName(parsed.data.fileName);
    await prisma.sourceMap.upsert({
      where: {
        projectId_release_fileName: {
          projectId: project.id,
          release: parsed.data.release,
          fileName
        }
      },
      create: {
        projectId: project.id,
        release: parsed.data.release,
        fileName,
        content: parsed.data.content
      },
      update: {
        content: parsed.data.content
      }
    });
    sourceMapCache.delete(getSourceMapCacheKey(project.id, parsed.data.release, fileName));

    return { success: true };
  }

  async getProjects(ownerId: string) {
    const ownerProjects = await prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { events: true }
        }
      }
    });
    const user = await prisma.user.findUnique({ where: { id: ownerId } });
    const memberRows = user
      ? await prisma.projectMember.findMany({ where: { userId: user.id } })
      : [];
    const memberProjectIds = memberRows
      .map((member) => member.projectId)
      .filter((projectId) => !ownerProjects.some((project) => project.id === projectId));
    const memberProjects = memberProjectIds.length
      ? await prisma.project.findMany({
        where: { id: { in: memberProjectIds } },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { events: true }
          }
        }
      })
      : [];
    const projects = [...ownerProjects, ...memberProjects];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const withToday = await Promise.all(
      projects.map(async (project) => {
        const errorsToday = await prisma.event.count({
          where: {
            projectId: project.id,
            createdAt: { gte: todayStart }
          }
        });

        return {
          id: project.id,
          name: project.name,
          apiKey: project.apiKey,
          createdAt: project.createdAt,
          totalErrors: project._count.events,
          errorsToday
        };
      })
    );

    return withToday;
  }

  async getProjectEvents(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);

    return prisma.event.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  }

  async getProject(ownerId: string, projectId: string) {
    const access = await ensureProjectAccess(projectId, ownerId);
    return {
      ...access.project,
      accessRole: access.role
    };
  }

  async rotateProjectKey(ownerId: string, projectId: string) {
    await ensureMaintainer(projectId, ownerId);

    const apiKey = await generateUniqueApiKey();
    return prisma.project.update({
      where: { id: projectId },
      data: { apiKey }
    });
  }

  async deleteProject(ownerId: string, projectId: string) {
    await ensureMaintainer(projectId, ownerId);

    await prisma.$transaction(async (transaction) => {
      const issueIds = (await transaction.issue.findMany({
        where: { projectId },
        select: { id: true }
      })).map((item) => item.id);
      const eventIds = (await transaction.event.findMany({
        where: { projectId },
        select: { id: true }
      })).map((item) => item.id);

      if (eventIds.length > 0) {
        await transaction.breadcrumb.deleteMany({ where: { eventId: { in: eventIds } } });
        await transaction.networkRequest.deleteMany({ where: { eventId: { in: eventIds } } });
        await transaction.replayChunk.deleteMany({ where: { eventId: { in: eventIds } } });
      }

      await transaction.issueComment.deleteMany({ where: { issueId: { in: issueIds } } });
      await transaction.event.deleteMany({ where: { projectId } });
      await transaction.issue.deleteMany({ where: { projectId } });
      await transaction.project.delete({ where: { id: projectId } });
    });

    return { success: true };
  }

  async getProjectIssues(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);

    const issues = await prisma.issue.findMany({
      where: { projectId },
      orderBy: { lastSeen: "desc" }
    });

    const events = await prisma.event.findMany({
      where: {
        projectId,
        issueId: { in: issues.map((i) => i.id) }
      },
      select: {
        issueId: true,
        userId: true
      }
    });

    const uniqueUsersMap: Record<string, Set<string>> = {};
    for (const e of events) {
      if (!e.issueId) continue;
      if (!uniqueUsersMap[e.issueId]) {
        uniqueUsersMap[e.issueId] = new Set();
      }
      if (e.userId) {
        uniqueUsersMap[e.issueId].add(e.userId);
      }
    }

    return issues.map((issue) => ({
      ...issue,
      usersCount: uniqueUsersMap[issue.id]?.size ?? 0
    }));
  }

  async getProjectMembers(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);
    return prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" }
    });
  }

  async createProjectMember(ownerId: string, projectId: string, body: unknown) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = projectMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return prisma.projectMember.create({
      data: {
        projectId,
        name: parsed.data.name.trim(),
        role: parsed.data.role ?? "MEMBER"
      }
    });
  }

  async addExistingProjectMember(ownerId: string, projectId: string, body: unknown) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = addExistingMemberSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email }
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existing = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id
      }
    });
    if (existing) {
      throw new BadRequestException("User is already a project member");
    }

    const name = user.name?.trim() || user.email.split("@")[0] || user.email;
    return prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        email: user.email,
        name,
        role: parsed.data.role ?? "MEMBER"
      }
    });
  }

  async updateProjectMember(ownerId: string, projectId: string, memberId: string, body: unknown) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = updateProjectMemberSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const member = await prisma.projectMember.findUnique({ where: { id: memberId } });
    if (!member || member.projectId !== projectId) {
      throw new NotFoundException("Member not found");
    }

    return prisma.projectMember.update({
      where: { id: memberId },
      data: {
        role: parsed.data.role
      }
    });
  }

  async deleteProjectMember(ownerId: string, projectId: string, memberId: string) {
    await ensureMaintainer(projectId, ownerId);
    await prisma.projectMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async getProjectInvites(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);
    return prisma.projectInvite.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  }

  async createProjectInvite(ownerId: string, projectId: string, body: unknown) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = projectInviteSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return prisma.projectInvite.create({
      data: {
        projectId,
        token: randomBytes(24).toString("base64url"),
        email: parsed.data.email,
        role: parsed.data.role ?? "MEMBER",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48)
      }
    });
  }

  async getInvite(token: string) {
    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: { project: true }
    });
    if (!invite || invite.expiresAt.getTime() <= Date.now() || invite.acceptedAt) {
      throw new NotFoundException("Invite not found");
    }

    return {
      token: invite.token,
      projectId: invite.projectId,
      projectName: invite.project?.name ?? "Project",
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt
    };
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: { project: true }
    });
    if (!invite || invite.expiresAt.getTime() <= Date.now() || invite.acceptedAt) {
      throw new NotFoundException("Invite not found");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new BadRequestException("This invite was created for another email");
    }

    const name = user.name?.trim() || user.email.split("@")[0] || user.email;
    await prisma.$transaction(async (transaction) => {
      await transaction.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId,
          email: user.email,
          name,
          role: invite.role ?? "MEMBER"
        }
      });
      await transaction.projectInvite.update({
        where: { id: invite.id },
        data: {
          acceptedByUserId: userId,
          acceptedAt: new Date()
        }
      });
    });

    return { success: true, projectId: invite.projectId };
  }

  async getIssue(ownerId: string, issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    const issueEvents = await prisma.event.findMany({
      where: { issueId },
      select: {
        userId: true,
        userAgent: true
      }
    });

    const uniqueCount = new Set(issueEvents.map((u) => u.userId).filter(Boolean)).size;
    const environment = buildEnvironmentAnalytics(issueEvents.map((item) => item.userAgent));

    return {
      ...issue,
      usersCount: uniqueCount,
      environment
    };
  }

  async updateIssue(ownerId: string, issueId: string, body: unknown) {
    const parsed = updateIssueSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    return prisma.issue.update({
      where: { id: issueId },
      data: {
        status: parsed.data.status,
        priority: parsed.data.priority,
        assignee: parsed.data.assignee === undefined
          ? undefined
          : parsed.data.assignee.trim() || null
      }
    });
  }

  async deleteIssue(ownerId: string, issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    await deleteIssuesWithData([issueId]);
    return { success: true };
  }

  async deleteProjectIssues(ownerId: string, projectId: string, body: unknown) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = deleteIssuesSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const issues = await prisma.issue.findMany({
      where: {
        projectId,
        ...(parsed.data.issueIds?.length ? { id: { in: parsed.data.issueIds } } : {})
      }
    });

    await deleteIssuesWithData(issues.map((issue) => issue.id));
    return { success: true, deleted: issues.length };
  }

  async getIssueEvents(ownerId: string, issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    return prisma.event.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async getIssueComments(ownerId: string, issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    const comments = await prisma.issueComment.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" }
    });

    return this.enrichIssueComments(comments);
  }

  async createIssueComment(ownerId: string, issueId: string, body: unknown) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);
    const parsed = issueCommentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const created = await prisma.issueComment.create({
      data: {
        issueId,
        authorId: ownerId,
        body: parsed.data.body.trim()
      }
    });

    return this.enrichIssueComments([created]).then((comments) => comments[0]);
  }

  async getEvent(ownerId: string, eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        breadcrumbs: { orderBy: { createdAt: "asc" } },
        replays: true
      }
    });

    if (!event) throw new NotFoundException("Event not found");
    await ensureProjectAccess(event.projectId, ownerId);

    const networkRequests = await getNetworkRequestsCompat(eventId);

    return {
      ...event,
      networkRequests
    };
  }

  private async enrichIssueComments(comments: Array<{ id: string; issueId: string; authorId: string | null; body: string; createdAt: Date }>) {
    if (comments.length === 0) return [];

    const authorIds = Array.from(new Set(comments.map((comment) => comment.authorId).filter((id): id is string => Boolean(id))));
    type AuthorRow = {
      id: string;
      name: string | null;
      email: string;
    };
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true }
        }) as AuthorRow[]
      : [];
    const authorMap = new Map<string, AuthorRow>(authors.map((user) => [user.id, user]));

    return comments.map((comment) => {
      const author = comment.authorId ? authorMap.get(comment.authorId) : null;
      return {
        id: comment.id,
        issueId: comment.issueId,
        authorId: comment.authorId,
        authorName: author?.name?.trim() || author?.email || null,
        body: comment.body,
        createdAt: comment.createdAt
      };
    });
  }
}

async function deleteIssuesWithData(issueIds: string[]) {
  if (issueIds.length === 0) return;

  await prisma.$transaction(async (transaction) => {
    const eventIds = (await transaction.event.findMany({
      where: { issueId: { in: issueIds } },
      select: { id: true }
    })).map((item) => item.id);

    if (eventIds.length > 0) {
      await transaction.breadcrumb.deleteMany({ where: { eventId: { in: eventIds } } });
      await transaction.networkRequest.deleteMany({ where: { eventId: { in: eventIds } } });
      await transaction.replayChunk.deleteMany({ where: { eventId: { in: eventIds } } });
      await transaction.event.deleteMany({ where: { issueId: { in: issueIds } } });
    }

    await transaction.issueComment.deleteMany({ where: { issueId: { in: issueIds } } });
    await transaction.issue.deleteMany({ where: { id: { in: issueIds } } });
  });
}

async function ensureProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundException("Project not found");
  }
  if (project.ownerId === userId) {
    return { project, role: "MAINTAINER" as const };
  }

  const member = await prisma.projectMember.findFirst({ where: { projectId, userId } });
  if (!member) {
    throw new NotFoundException("Project not found");
  }

  return {
    project,
    role: normalizeProjectRole(member.role)
  };
}

async function ensureMaintainer(projectId: string, userId: string) {
  const access = await ensureProjectAccess(projectId, userId);
  if (access.role !== "MAINTAINER") {
    throw new NotFoundException("Project not found");
  }
  return access.project;
}

const createProjectSchema = z.object({
  name: z.string().min(2)
});

const updateIssueSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "HIGHEST"]).optional(),
  assignee: z.string().max(120).optional()
}).refine((body) => body.status !== undefined || body.priority !== undefined || body.assignee !== undefined, {
  message: "At least one workflow field is required"
});

const projectMemberSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.enum(projectRoles).optional()
});

const addExistingMemberSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(projectRoles).optional()
});

const updateProjectMemberSchema = z.object({
  role: z.enum(projectRoles).optional()
}).refine((body) => body.role !== undefined, {
  message: "Role is required"
});

const projectInviteSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(projectRoles).optional()
});

const issueCommentSchema = z.object({
  body: z.string().min(1).max(4000)
});

const deleteIssuesSchema = z.object({
  issueIds: z.array(z.string().min(1)).optional()
});

function getFingerprint(message: string, stack?: string): string {
  const firstStackLine = stack?.split("\n").find((line) => line.trim().length > 0) ?? "";
  return createHash("sha256").update(`${message}|${firstStackLine}`).digest("hex");
}

function normalizeProjectRole(role: string | null | undefined): ProjectRole {
  if (role === "MAINTAINER" || role === "MEMBER" || role === "VIEWER") {
    return role;
  }

  return "MEMBER";
}

async function getSource(
  projectId: string,
  release: string | undefined,
  filePath?: string,
  fileName?: string,
  line?: number,
  column?: number,
  stack?: string
): Promise<ResolvedSource | null> {
  if (!release) {
    if (filePath && line && column) {
      const mapped = await mapWithInlineSourceMap(filePath, line, column);
      if (mapped) return mapped;
    }
    if (fileName && line && column) {
      return { fileName, line, column };
    }
    return extractSourceFromStack(stack);
  }

  if (projectId && release && filePath && line && column) {
    const mapped = await mapWithSourceMap(projectId, release, filePath, line, column);
    if (mapped) return mapped;
  }

  // Prod fallback when sourcemap was not found.
  const fromStack = extractSourceFromStack(stack);
  if (fromStack) return fromStack;

  if (fileName && line && column) {
    return { fileName, line, column };
  }

  return null;
}

function extractSourceFromStack(stack?: string): ResolvedSource | null {
  if (!stack) return null;

  const frames = stack
    .split("\n")
    .map((item) => item.trim())
    .map(parseStackFrame)
    .filter((item): item is { filePath: string; line: number; column: number } => item !== null);

  if (frames.length === 0) return null;

  const preferred = frames.find((frame) => isPreferredFrame(frame.filePath));
  const selected = preferred ?? frames[0];
  const fileName = selected.filePath.split("/").pop() ?? selected.filePath;

  return {
    fileName,
    line: selected.line,
    column: selected.column
  };
}

function parseStackFrame(line: string): { filePath: string; line: number; column: number } | null {
  const match = line.match(/((?:https?:\/\/|\/)[^)\s]+):(\d+):(\d+)/);
  if (!match) return null;

  const filePath = match[1];
  const lineNumber = Number(match[2]);
  const columnNumber = Number(match[3]);

  if (Number.isNaN(lineNumber) || Number.isNaN(columnNumber)) return null;

  return {
    filePath,
    line: lineNumber,
    column: columnNumber
  };
}

function isPreferredFrame(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  const blockedTokens = [
    "/node_modules/",
    "react-dom",
    "scheduler",
    "@vite",
    "/vite/",
    "chunk-",
    "internal/",
    "webpack"
  ];

  return !blockedTokens.some((token) => lowered.includes(token));
}

async function persistNetworkRequestsCompat(
  database: Pick<typeof prisma, "networkRequest">,
  eventId: string,
  items: Array<{
    method: string;
    url: string;
    status?: number;
    requestHeaders?: Record<string, string>;
    requestBody?: string;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    error?: string;
    duration?: number;
    createdAt: string;
  }>,
  hasExtendedColumns: boolean
): Promise<void> {
  if (hasExtendedColumns) {
    await database.networkRequest.createMany({
      data: items.map((item) => ({
        eventId,
        method: item.method,
        url: item.url,
        status: item.status,
        requestHeaders: item.requestHeaders as Prisma.InputJsonValue | undefined,
        requestBody: item.requestBody,
        responseHeaders: item.responseHeaders as Prisma.InputJsonValue | undefined,
        responseBody: item.responseBody,
        error: item.error,
        duration: item.duration,
        createdAt: new Date(item.createdAt)
      }))
    });
    return;
  }

  await database.networkRequest.createMany({
    data: items.map((item) => ({
      eventId,
      method: item.method,
      url: item.url,
      status: item.status,
      duration: item.duration,
      createdAt: new Date(item.createdAt)
    }))
  });
}

async function getNetworkRequestsCompat(eventId: string): Promise<Array<{
  id: string;
  method: string;
  url: string;
  status: number | null;
  requestHeaders: Record<string, string> | null;
  requestBody: string | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  error: string | null;
  duration: number | null;
  createdAt: Date;
}>> {
  const hasExtendedColumns = await hasNetworkInspectorColumns();
  if (hasExtendedColumns) {
    return await prisma.$queryRawUnsafe<Array<{
      id: string;
      method: string;
      url: string;
      status: number | null;
      requestHeaders: Record<string, string> | null;
      requestBody: string | null;
      responseHeaders: Record<string, string> | null;
      responseBody: string | null;
      error: string | null;
      duration: number | null;
      createdAt: Date;
    }>>(
      `
      SELECT
        id,
        method,
        url,
        status,
        "requestHeaders",
        "requestBody",
        "responseHeaders",
        "responseBody",
        error,
        duration,
        "createdAt"
      FROM "NetworkRequest"
      WHERE "eventId" = $1
      ORDER BY "createdAt" ASC
      `,
      eventId
    );
  }

  const legacy = await prisma.$queryRawUnsafe<Array<{
    id: string;
    method: string;
    url: string;
    status: number | null;
    duration: number | null;
    createdAt: Date;
  }>>(
    `
    SELECT
      id,
      method,
      url,
      status,
      duration,
      "createdAt"
    FROM "NetworkRequest"
    WHERE "eventId" = $1
    ORDER BY "createdAt" ASC
    `,
    eventId
  );

  return legacy.map((item) => ({
    ...item,
    requestHeaders: null,
    requestBody: null,
    responseHeaders: null,
    responseBody: null,
    error: null
  }));
}

let networkInspectorColumnsAvailable: boolean | null = null;

async function hasNetworkInspectorColumns(): Promise<boolean> {
  if (networkInspectorColumnsAvailable != null) return networkInspectorColumnsAvailable;

  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'NetworkRequest'
        AND column_name = 'requestHeaders'
    ) AS "exists"
    `
  );

  networkInspectorColumnsAvailable = rows[0]?.exists === true;
  return networkInspectorColumnsAvailable;
}

const sourceMapCache = new Map<string, string>();

async function mapWithInlineSourceMap(
  filePath: string,
  line: number,
  column: number
): Promise<ResolvedSource | null> {
  try {
    const mapRaw = await loadInlineSourceMap(filePath);
    if (!mapRaw) return null;
    return getOriginalPosition(mapRaw, line, column);
  } catch {
    return null;
  }
}

async function mapWithSourceMap(
  projectId: string,
  release: string,
  filePath: string,
  line: number,
  column: number
): Promise<ResolvedSource | null> {
  try {
    const mapRaw = await loadSourceMapFromDb(projectId, release, filePath);
    if (!mapRaw) return null;
    return getOriginalPosition(mapRaw, line, column);
  } catch {
    return null;
  }
}

function getOriginalPosition(
  mapRaw: string,
  line: number,
  column: number
): ResolvedSource | null {
  const map = JSON.parse(mapRaw) as RawSourceMap;
  const consumer = new SourceMapConsumer(map);
  const original = consumer.originalPositionFor({ line, column });
  if (!original.source || !original.line || original.column == null) return null;

  const fileName = original.source.split("/").pop() ?? original.source;
  const sourceContent = getSourceContent(map, original.source);

  return {
    fileName,
    line: original.line,
    column: original.column,
    sourceContext: sourceContent ? buildSourceContext(fileName, original.line, original.column, sourceContent) : null
  };
}

type ResolvedSource = {
  fileName: string;
  line: number;
  column: number;
  sourceContext?: SourceContext | null;
};

type SourceContext = {
  fileName: string;
  line: number;
  column: number;
  lines: Array<{
    number: number;
    text: string;
    highlight: boolean;
  }>;
};

function getSourceContent(map: RawSourceMap, source: string): string | null {
  const index = map.sources?.findIndex((item) => item === source) ?? -1;
  if (index < 0) return null;
  return map.sourcesContent?.[index] ?? null;
}

function buildSourceContext(fileName: string, line: number, column: number, sourceContent: string): SourceContext | null {
  const sourceLines = sourceContent.split(/\r?\n/);
  if (line < 1 || line > sourceLines.length) return null;

  const start = Math.max(1, line - 5);
  const end = Math.min(sourceLines.length, line + 5);
  const lines = [];

  for (let number = start; number <= end; number += 1) {
    lines.push({
      number,
      text: truncateSourceLine(sourceLines[number - 1] ?? ""),
      highlight: number === line
    });
  }

  return {
    fileName,
    line,
    column,
    lines
  };
}

function truncateSourceLine(value: string): string {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

async function loadInlineSourceMap(filePath: string): Promise<string | null> {
  const normalized = filePath.trim();
  const response = await fetch(normalized);
  if (!response.ok) return null;
  const code = await response.text();
  const match = code.match(/sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/);
  if (!match) return null;

  return Buffer.from(match[1], "base64").toString("utf8");
}

async function loadSourceMapFromDb(projectId: string, release: string, filePath: string): Promise<string | null> {
  const normalized = normalizeFileName(filePath);
  const cacheKey = getSourceMapCacheKey(projectId, release, normalized);
  if (sourceMapCache.has(cacheKey)) return sourceMapCache.get(cacheKey) ?? null;

  const sourceMap = await prisma.sourceMap.findUnique({
    where: {
      projectId_release_fileName: {
        projectId,
        release,
        fileName: normalized
      }
    },
    select: { content: true }
  });
  if (!sourceMap) return null;

  sourceMapCache.set(cacheKey, sourceMap.content);
  return sourceMap.content;
}

function normalizeFileName(filePathOrName: string): string {
  const noQuery = filePathOrName.split("?")[0]?.split("#")[0] ?? filePathOrName;
  return noQuery.split("/").pop() ?? noQuery;
}

function getSourceMapCacheKey(projectId: string, release: string, fileName: string): string {
  return `${projectId}:${release}:${normalizeFileName(fileName)}`;
}

function buildEnvironmentAnalytics(userAgents: Array<string | null>): {
  browsers: Array<{ name: string; count: number; percent: number }>;
  os: Array<{ name: string; count: number; percent: number }>;
  devices: Array<{ name: string; count: number; percent: number }>;
} {
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();

  let total = 0;
  for (const raw of userAgents) {
    if (!raw) continue;
    total += 1;
    const browser = detectBrowser(raw);
    const os = detectOs(raw);
    const device = detectDevice(raw);
    browserCounts.set(browser, (browserCounts.get(browser) ?? 0) + 1);
    osCounts.set(os, (osCounts.get(os) ?? 0) + 1);
    deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);
  }

  return {
    browsers: toSortedPercentList(browserCounts, total),
    os: toSortedPercentList(osCounts, total),
    devices: toSortedPercentList(deviceCounts, total)
  };
}

function toSortedPercentList(counts: Map<string, number>, total: number): Array<{ name: string; count: number; percent: number }> {
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100)
    }));
}

function detectBrowser(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("edg/")) return "Edge";
  if (s.includes("opr/") || s.includes("opera")) return "Opera";
  if (s.includes("firefox/")) return "Firefox";
  if (s.includes("chrome/") && !s.includes("edg/") && !s.includes("opr/")) return "Chrome";
  if (s.includes("safari/") && !s.includes("chrome/")) return "Safari";
  return "Other";
}

function detectOs(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("windows")) return "Windows";
  if (s.includes("mac os") || s.includes("macintosh")) return "macOS";
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ios")) return "iOS";
  if (s.includes("linux")) return "Linux";
  return "Other";
}

function detectDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("ipad") || s.includes("tablet")) return "Tablet";
  if (s.includes("mobi") || s.includes("iphone") || s.includes("android")) return "Mobile";
  return "Desktop";
}

async function generateUniqueApiKey(): Promise<string> {
  while (true) {
    const candidate = `at_${randomBytes(16).toString("hex")}`;
    const existing = await prisma.project.findUnique({ where: { apiKey: candidate } });
    if (!existing) return candidate;
  }
}
