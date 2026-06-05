import { prisma } from "@artstrace/database";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { buildEnvironmentAnalytics } from "@/common/analytics";
import {
  deleteIssuesSchema,
  deleteIssuesWithData,
  ensureMaintainer,
  ensureProjectAccess,
  issueCommentSchema,
  updateIssueSchema,
} from "@/common/helpers";

@Injectable()
export class IssuesService {
  async getProjectIssues(ownerId: string, projectId: string) {
    await ensureProjectAccess(projectId, ownerId);

    const issues = await prisma.issue.findMany({
      where: { projectId },
      orderBy: { lastSeen: "desc" },
    });

    const events = await prisma.event.findMany({
      where: {
        projectId,
        issueId: { in: issues.map((i) => i.id) },
      },
      select: {
        issueId: true,
        userId: true,
      },
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

    const manualReportRows = await Promise.all(
      issues.map((issue) =>
        prisma.manualReport.findMany({
          where: { issueId: issue.id },
          orderBy: { createdAt: "desc" },
        }),
      ),
    );
    const manualReportsByIssueId = new Map(
      issues.map((issue, index) => [issue.id, manualReportRows[index] ?? []]),
    );

    return issues.map((issue) => {
      const manualReports = manualReportsByIssueId.get(issue.id) ?? [];
      return {
        ...issue,
        type: manualReports.length > 0 ? "MANUAL" : "AUTOMATIC",
        manualReports,
        usersCount: uniqueUsersMap[issue.id]?.size ?? 0,
      };
    });
  }

  async getIssue(ownerId: string, issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    const issueEvents = await prisma.event.findMany({
      where: { issueId },
      select: {
        userId: true,
        userAgent: true,
      },
    });
    const manualReports = await prisma.manualReport.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" },
    });

    const uniqueCount = new Set(
      issueEvents.map((u) => u.userId).filter(Boolean),
    ).size;
    const environment = buildEnvironmentAnalytics(
      issueEvents.map((item) => item.userAgent),
    );

    return {
      ...issue,
      type: manualReports.length > 0 ? "MANUAL" : "AUTOMATIC",
      manualReports,
      usersCount: uniqueCount,
      environment,
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
        assignee:
          parsed.data.assignee === undefined
            ? undefined
            : parsed.data.assignee.trim() || null,
      },
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
        ...(parsed.data.issueIds?.length
          ? { id: { in: parsed.data.issueIds } }
          : {}),
      },
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
      take: 50,
    });
  }

  async getIssueComments(ownerId: string, issueId: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException("Issue not found");
    await ensureProjectAccess(issue.projectId, ownerId);

    const comments = await prisma.issueComment.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" },
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
        body: parsed.data.body.trim(),
      },
    });

    return this.enrichIssueComments([created]).then((comments) => comments[0]);
  }

  private async enrichIssueComments(
    comments: Array<{
      id: string;
      issueId: string;
      authorId: string | null;
      body: string;
      createdAt: Date;
    }>,
  ) {
    if (comments.length === 0) return [];

    const authorIds = Array.from(
      new Set(
        comments
          .map((comment) => comment.authorId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    type AuthorRow = {
      id: string;
      name: string | null;
      email: string;
    };
    const authors = authorIds.length
      ? ((await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true },
        })) as AuthorRow[])
      : [];
    const authorMap = new Map<string, AuthorRow>(
      authors.map((user) => [user.id, user]),
    );

    return comments.map((comment) => {
      const author = comment.authorId ? authorMap.get(comment.authorId) : null;
      return {
        id: comment.id,
        issueId: comment.issueId,
        authorId: comment.authorId,
        authorName: author?.name?.trim() || author?.email || null,
        body: comment.body,
        createdAt: comment.createdAt,
      };
    });
  }
}
