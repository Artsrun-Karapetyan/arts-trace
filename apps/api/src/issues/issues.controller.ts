import { Inject, Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req} from "@nestjs/common";

import type { AuthedRequest } from "@/common/helpers";

import { IssuesService } from "./issues.service";

@Controller()
export class IssuesController {
  constructor(@Inject(IssuesService) private readonly issuesService: IssuesService) {}

  @Get("projects/:id/issues")
  getProjectIssues(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.issuesService.getProjectIssues(request.authUser!.id, id);
  }

  @Delete("projects/:id/issues")
  deleteProjectIssues(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.issuesService.deleteProjectIssues(
      request.authUser!.id,
      id,
      body,
    );
  }

  @Get("issues/:id")
  getIssue(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.issuesService.getIssue(request.authUser!.id, id);
  }

  @Patch("issues/:id")
  updateIssue(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.issuesService.updateIssue(request.authUser!.id, id, body);
  }

  @Delete("issues/:id")
  deleteIssue(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.issuesService.deleteIssue(request.authUser!.id, id);
  }

  @Get("issues/:id/events")
  getIssueEvents(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.issuesService.getIssueEvents(request.authUser!.id, id);
  }

  @Get("issues/:id/comments")
  getIssueComments(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.issuesService.getIssueComments(request.authUser!.id, id);
  }

  @Post("issues/:id/comments")
  createIssueComment(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.issuesService.createIssueComment(
      request.authUser!.id,
      id,
      body,
    );
  }
}
