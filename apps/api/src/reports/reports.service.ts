import type { Prisma } from "@artstrace/database";
import { prisma } from "@artstrace/database";
import { manualReportSchema, uploadSourceMapSchema } from "@artstrace/shared";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  getManualReportFingerprint,
  resolveExistingUserId,
} from "@/common/helpers";
import {
  getSourceMapCacheKey,
  normalizeFileName,
  sourceMapCache,
} from "@/common/source";

@Injectable()
export class ReportsService {
  async uploadSourceMap(body: unknown) {
    const parsed = uploadSourceMapSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { apiKey: parsed.data.apiKey },
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
          fileName,
        },
      },
      create: {
        projectId: project.id,
        release: parsed.data.release,
        fileName,
        content: parsed.data.content,
      },
      update: {
        content: parsed.data.content,
      },
    });
    sourceMapCache.delete(
      getSourceMapCacheKey(project.id, parsed.data.release, fileName),
    );

    return { success: true };
  }

  async createManualReport(body: unknown) {
    const parsed = manualReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { apiKey: parsed.data.projectKey },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const title = parsed.data.title.trim();
    const description = parsed.data.description?.trim() || null;
    const fingerprint = getManualReportFingerprint(
      project.id,
      title,
      parsed.data.url,
      description,
    );
    const createdByUserId = parsed.data.createdByUserId?.trim()
      ? await resolveExistingUserId(parsed.data.createdByUserId.trim())
      : null;

    const issue = await prisma.issue.upsert({
      where: {
        projectId_fingerprint: {
          projectId: project.id,
          fingerprint,
        },
      },
      create: {
        projectId: project.id,
        fingerprint,
        message: title,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
      },
      update: {
        message: title,
        lastSeen: new Date(),
        count: { increment: 1 },
      },
    });

    const report = await prisma.manualReport.create({
      data: {
        issueId: issue.id,
        title,
        description,
        screenshotData: parsed.data.screenshotData ?? null,
        annotations: parsed.data.annotations as
          | Prisma.InputJsonValue
          | null
          | undefined,
        url: parsed.data.url,
        userAgent: parsed.data.userAgent,
        createdByUserId,
      },
    });

    return {
      success: true,
      issueId: issue.id,
      manualReportId: report.id,
    };
  }
}
