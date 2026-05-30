import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ingestEventSchema } from "@artstrace/shared";
import { prisma } from "@artstrace/database";

@Injectable()
export class AppService {
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

    await prisma.event.create({
      data: {
        projectId: project.id,
        message: parsed.data.message,
        stack: parsed.data.stack,
        url: parsed.data.url,
        userAgent: parsed.data.userAgent,
        createdAt: new Date(parsed.data.timestamp)
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

  async getEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }
}
