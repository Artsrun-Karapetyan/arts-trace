import { randomBytes } from "node:crypto";

import { prisma } from "@artstrace/database";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  addExistingMemberSchema,
  ensureMaintainer,
  ensureProjectAccess,
  projectInviteSchema,
  projectMemberSchema,
  updateProjectMemberSchema,
} from "@/common/helpers";

@Injectable()
export class TeamService {
  async getProjectMembers(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    const hasOwner = project?.ownerId
      ? members.some((member) => member.userId === project.ownerId)
      : true;
    if (!project?.ownerId || hasOwner) {
      return members;
    }

    const owner = await prisma.user.findUnique({
      where: { id: project.ownerId },
    });
    if (!owner) {
      return members;
    }

    return [
      {
        id: `${project.id}:owner`,
        projectId: project.id,
        userId: owner.id,
        email: owner.email,
        name: owner.name?.trim() || owner.email,
        role: "MAINTAINER",
        createdAt: project.createdAt,
      },
      ...members,
    ];
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
        role: parsed.data.role ?? "MEMBER",
      },
    });
  }

  async addExistingProjectMember(
    ownerId: string,
    projectId: string,
    body: unknown,
  ) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = addExistingMemberSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existing = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
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
        role: parsed.data.role ?? "MEMBER",
      },
    });
  }

  async updateProjectMember(
    ownerId: string,
    projectId: string,
    memberId: string,
    body: unknown,
  ) {
    await ensureMaintainer(projectId, ownerId);
    const parsed = updateProjectMemberSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.projectId !== projectId) {
      throw new NotFoundException("Member not found");
    }

    return prisma.projectMember.update({
      where: { id: memberId },
      data: {
        role: parsed.data.role,
      },
    });
  }

  async deleteProjectMember(
    ownerId: string,
    projectId: string,
    memberId: string,
  ) {
    await ensureMaintainer(projectId, ownerId);
    await prisma.projectMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async getProjectInvites(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);
    return prisma.projectInvite.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
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
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
      },
    });
  }

  async getInvite(token: string) {
    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: { project: true },
    });
    if (
      !invite ||
      invite.expiresAt.getTime() <= Date.now() ||
      invite.acceptedAt
    ) {
      throw new NotFoundException("Invite not found");
    }

    return {
      token: invite.token,
      projectId: invite.projectId,
      projectName: invite.project?.name ?? "Project",
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: { project: true },
    });
    if (
      !invite ||
      invite.expiresAt.getTime() <= Date.now() ||
      invite.acceptedAt
    ) {
      throw new NotFoundException("Invite not found");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new BadRequestException(
        "This invite was created for another email",
      );
    }

    const name = user.name?.trim() || user.email.split("@")[0] || user.email;
    await prisma.$transaction(async (transaction) => {
      await transaction.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId,
          email: user.email,
          name,
          role: invite.role ?? "MEMBER",
        },
      });
      await transaction.projectInvite.update({
        where: { id: invite.id },
        data: {
          acceptedByUserId: userId,
          acceptedAt: new Date(),
        },
      });
    });

    return { success: true, projectId: invite.projectId };
  }
}
