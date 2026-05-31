import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ingestEventSchema, uploadReplaySchema, uploadSourceMapSchema } from "@artstrace/shared";
import { prisma } from "@artstrace/database";
import type { Prisma } from "@artstrace/database";
import { createHash, randomBytes } from "node:crypto";
import { SourceMapConsumer } from "source-map-js";
import { z } from "zod";

@Injectable()
export class AppService {
  async createProject(body: unknown) {
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const apiKey = await generateUniqueApiKey();
    const project = await prisma.project.create({
      data: {
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

    const issue = await prisma.issue.upsert({
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

    const createdEvent = await prisma.event.create({
      data: {
        projectId: project.id,
        issueId: issue.id,
        message: parsed.data.message,
        stack: parsed.data.stack,
        fileName: source?.fileName,
        line: source?.line,
        column: source?.column,
        url: parsed.data.url,
        userAgent: parsed.data.userAgent,
        userId: parsed.data.userId,
        createdAt: new Date(parsed.data.timestamp)
      }
    });

    if (parsed.data.breadcrumbs?.length) {
      await prisma.breadcrumb.createMany({
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
      await persistNetworkRequestsCompat(createdEvent.id, parsed.data.networkRequests);
    }

    if (parsed.data.replayEvents?.length) {
      await prisma.replayChunk.upsert({
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

    return { success: true };
  }

  async getProjects() {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { events: true }
        }
      }
    });

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

  async getProjectEvents(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

    return prisma.event.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  }

  async getProject(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async rotateProjectKey(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

    const apiKey = await generateUniqueApiKey();
    return prisma.project.update({
      where: { id: projectId },
      data: { apiKey }
    });
  }

  async deleteProject(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

    const eventIds = (await prisma.event.findMany({
      where: { projectId },
      select: { id: true }
    })).map((item) => item.id);

    if (eventIds.length > 0) {
      await prisma.breadcrumb.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.networkRequest.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.replayChunk.deleteMany({ where: { eventId: { in: eventIds } } });
    }

    await prisma.event.deleteMany({ where: { projectId } });
    await prisma.issue.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });

    return { success: true };
  }

  async getProjectIssues(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");

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

  async getIssue(issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");

    const uniqueUsers = await prisma.event.findMany({
      where: { issueId },
      select: { userId: true }
    });

    const uniqueCount = new Set(uniqueUsers.map((u) => u.userId).filter(Boolean)).size;

    return {
      ...issue,
      usersCount: uniqueCount
    };
  }

  async getIssueEvents(issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");

    return prisma.event.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async getEvent(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        breadcrumbs: { orderBy: { createdAt: "asc" } },
        replays: true
      }
    });

    if (!event) throw new NotFoundException("Event not found");

    const networkRequests = await getNetworkRequestsCompat(eventId);

    return {
      ...event,
      networkRequests
    };
  }
}

const createProjectSchema = z.object({
  name: z.string().min(2)
});

function getFingerprint(message: string, stack?: string): string {
  const firstStackLine = stack?.split("\n").find((line) => line.trim().length > 0) ?? "";
  return createHash("sha256").update(`${message}|${firstStackLine}`).digest("hex");
}

async function getSource(
  projectId: string,
  release: string | undefined,
  filePath?: string,
  fileName?: string,
  line?: number,
  column?: number,
  stack?: string
): Promise<{ fileName: string; line: number; column: number } | null> {
  if (projectId && release && filePath && line && column) {
    const mapped = await mapWithSourceMap(projectId, release, filePath, line, column);
    if (mapped) return mapped;
  }

  if (fileName && line && column) {
    return { fileName, line, column };
  }

  return extractSourceFromStack(stack);
}

function extractSourceFromStack(stack?: string): { fileName: string; line: number; column: number } | null {
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
  }>
): Promise<void> {
  const hasExtendedColumns = await hasNetworkInspectorColumns();
  if (hasExtendedColumns) {
    await prisma.networkRequest.createMany({
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

  await prisma.networkRequest.createMany({
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

async function mapWithSourceMap(
  projectId: string,
  release: string,
  filePath: string,
  line: number,
  column: number
): Promise<{ fileName: string; line: number; column: number } | null> {
  try {
    const mapRaw = await loadSourceMapFromDb(projectId, release, filePath);
    if (!mapRaw) return null;

    const consumer = await new SourceMapConsumer(JSON.parse(mapRaw));
    const original = consumer.originalPositionFor({ line, column });

    if (!original.source || !original.line || !original.column) return null;

    const sourceName = original.source.split("/").pop() ?? original.source;
    return {
      fileName: sourceName,
      line: original.line,
      column: original.column
    };
  } catch {
    return null;
  }
}

async function loadSourceMapFromDb(projectId: string, release: string, filePath: string): Promise<string | null> {
  const normalized = normalizeFileName(filePath);
  const cacheKey = `${projectId}:${release}:${normalized}`;
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

async function generateUniqueApiKey(): Promise<string> {
  while (true) {
    const candidate = `at_${randomBytes(16).toString("hex")}`;
    const existing = await prisma.project.findUnique({ where: { apiKey: candidate } });
    if (!existing) return candidate;
  }
}
