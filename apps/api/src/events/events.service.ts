import type { Prisma } from "@artstrace/database";
import { prisma } from "@artstrace/database";
import { ingestEventSchema, uploadReplaySchema } from "@artstrace/shared";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ensureProjectAccess, getFingerprint } from "@/common/helpers";
import {
  getNetworkRequestsCompat,
  hasNetworkInspectorColumns,
  persistNetworkRequestsCompat,
} from "@/common/network";
import { getSource } from "@/common/source";

@Injectable()
export class EventsService {
  async createEvent(body: unknown) {
    const parsed = ingestEventSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { apiKey: parsed.data.apiKey },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const fingerprint = getFingerprint(parsed.data.message, parsed.data.stack);
    const source = await getSource({
      projectId: project.id,
      release: parsed.data.release,
      filePath: parsed.data.filePath,
      fileName: parsed.data.fileName,
      line: parsed.data.line,
      column: parsed.data.column,
      stack: parsed.data.stack,
    });

    const hasExtendedNetworkColumns = parsed.data.networkRequests?.length
      ? await hasNetworkInspectorColumns()
      : false;

    return prisma.$transaction(async (transaction) => {
      const issue = await transaction.issue.upsert({
        where: {
          projectId_fingerprint: {
            projectId: project.id,
            fingerprint,
          },
        },
        create: {
          projectId: project.id,
          fingerprint,
          message: parsed.data.message,
          count: 1,
          firstSeen: new Date(parsed.data.timestamp),
          lastSeen: new Date(parsed.data.timestamp),
        },
        update: {
          count: { increment: 1 },
          message: parsed.data.message,
          lastSeen: new Date(parsed.data.timestamp),
        },
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
          sourceContext: source?.sourceContext as
            | Prisma.InputJsonValue
            | undefined,
          url: parsed.data.url,
          userAgent: parsed.data.userAgent,
          userId: parsed.data.userId,
          userName: parsed.data.userName,
          userRole: parsed.data.userRole,
          createdAt: new Date(parsed.data.timestamp),
        },
      });

      if (parsed.data.breadcrumbs?.length) {
        await transaction.breadcrumb.createMany({
          data: parsed.data.breadcrumbs.map((item) => ({
            eventId: createdEvent.id,
            type: item.type,
            message: item.message,
            data: item.data as Prisma.InputJsonValue | undefined,
            createdAt: new Date(item.createdAt),
          })),
        });
      }

      if (parsed.data.networkRequests?.length) {
        await persistNetworkRequestsCompat(
          transaction,
          createdEvent.id,
          parsed.data.networkRequests,
          hasExtendedNetworkColumns,
        );
      }

      if (parsed.data.replayEvents?.length) {
        await transaction.replayChunk.upsert({
          where: { eventId: createdEvent.id },
          create: {
            eventId: createdEvent.id,
            events: parsed.data.replayEvents as Prisma.InputJsonValue,
          },
          update: {
            events: parsed.data.replayEvents as Prisma.InputJsonValue,
          },
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
      include: { project: true },
    });

    if (!event || event.project.apiKey !== parsed.data.apiKey) {
      throw new NotFoundException("Event not found");
    }

    await prisma.replayChunk.upsert({
      where: { eventId },
      create: {
        eventId,
        events: parsed.data.replayEvents as Prisma.InputJsonValue,
      },
      update: {
        events: parsed.data.replayEvents as Prisma.InputJsonValue,
      },
    });

    return { success: true };
  }

  async getProjectEvents(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);

    return prisma.event.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getEvent(ownerId: string, eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        breadcrumbs: { orderBy: { createdAt: "asc" } },
        replays: true,
      },
    });

    if (!event) throw new NotFoundException("Event not found");
    await ensureProjectAccess(event.projectId, ownerId);

    const networkRequests = await getNetworkRequestsCompat(eventId);

    return {
      ...event,
      networkRequests,
    };
  }
}
