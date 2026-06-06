import { prisma } from "@artstrace/database";
import { BadRequestException, Injectable } from "@nestjs/common";

import {
  createProjectSchema,
  ensureMaintainer,
  ensureProjectAccess,
  generateUniqueApiKey,
} from "@/common/helpers";

@Injectable()
export class ProjectsService {
  async createProject(ownerId: string, body: unknown) {
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const apiKey = await generateUniqueApiKey();
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    const project = await prisma.$transaction(async (transaction) => {
      const createdProject = await transaction.project.create({
        data: {
          ownerId,
          name: parsed.data.name.trim(),
          apiKey,
        },
      });

      await transaction.projectMember.create({
        data: {
          projectId: createdProject.id,
          userId: ownerId,
          email: owner?.email ?? null,
          name: owner?.name?.trim() || owner?.email || "Owner",
          role: "MAINTAINER",
        },
      });

      return createdProject;
    });

    return {
      id: project.id,
      name: project.name,
      apiKey: project.apiKey,
      createdAt: project.createdAt,
    };
  }

  async getProjects(ownerId: string) {
    const ownerProjects = await prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });
    const user = await prisma.user.findUnique({ where: { id: ownerId } });
    const memberRows = user
      ? await prisma.projectMember.findMany({ where: { userId: user.id } })
      : [];
    const memberProjectIds = memberRows
      .map((member) => member.projectId)
      .filter(
        (projectId) =>
          !ownerProjects.some((project) => project.id === projectId),
      );
    const memberProjects = memberProjectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: memberProjectIds } },
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { events: true },
            },
          },
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
            createdAt: { gte: todayStart },
          },
        });

        return {
          id: project.id,
          name: project.name,
          apiKey: project.apiKey,
          createdAt: project.createdAt,
          totalErrors: project._count.events,
          errorsToday,
        };
      }),
    );

    return withToday;
  }

  async getProject(ownerId: string, projectId: string) {
    const access = await ensureProjectAccess(projectId, ownerId);
    const owner = access.project.ownerId
      ? await prisma.user.findUnique({
          where: { id: access.project.ownerId },
          select: { id: true, email: true, name: true },
        })
      : null;
    return {
      ...access.project,
      accessRole: access.role,
      owner,
    };
  }

  async rotateProjectKey(ownerId: string, projectId: string) {
    await ensureMaintainer(projectId, ownerId);

    const apiKey = await generateUniqueApiKey();
    return prisma.project.update({
      where: { id: projectId },
      data: { apiKey },
    });
  }

  async deleteProject(ownerId: string, projectId: string) {
    await ensureMaintainer(projectId, ownerId);

    await prisma.$transaction(async (transaction) => {
      const issueIds = (
        await transaction.issue.findMany({
          where: { projectId },
          select: { id: true },
        })
      ).map((item) => item.id);
      const eventIds = (
        await transaction.event.findMany({
          where: { projectId },
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
      }

      await transaction.issueComment.deleteMany({
        where: { issueId: { in: issueIds } },
      });
      await transaction.event.deleteMany({ where: { projectId } });
      await transaction.issue.deleteMany({ where: { projectId } });
      await transaction.project.delete({ where: { id: projectId } });
    });

    return { success: true };
  }
}
