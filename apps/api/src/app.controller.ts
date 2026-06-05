import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { AppService } from "./app.service";

type AuthedRequest = {
  authUser?: {
    id: string;
  };
};

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Post("projects")
  createProject(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.appService.createProject(request.authUser!.id, body);
  }

  @Post("events")
  createEvent(@Body() body: unknown) {
    return this.appService.createEvent(body);
  }

  @Post("sourcemaps")
  uploadSourceMap(@Body() body: unknown) {
    return this.appService.uploadSourceMap(body);
  }

  @Post("events/:id/replay")
  uploadReplay(@Param("id") id: string, @Body() body: unknown) {
    return this.appService.uploadReplay(id, body);
  }

  @Get("projects")
  getProjects(@Req() request: AuthedRequest) {
    return this.appService.getProjects(request.authUser!.id);
  }

  @Get("projects/:id")
  getProject(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getProject(request.authUser!.id, id);
  }

  @Post("projects/:id/rotate-key")
  rotateProjectKey(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.rotateProjectKey(request.authUser!.id, id);
  }

  @Delete("projects/:id")
  deleteProject(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.deleteProject(request.authUser!.id, id);
  }

  @Get("projects/:id/events")
  getProjectEvents(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getProjectEvents(request.authUser!.id, id);
  }

  @Get("projects/:id/issues")
  getProjectIssues(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getProjectIssues(request.authUser!.id, id);
  }

  @Get("projects/:id/members")
  getProjectMembers(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getProjectMembers(request.authUser!.id, id);
  }

  @Post("projects/:id/members")
  createProjectMember(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.appService.createProjectMember(request.authUser!.id, id, body);
  }

  @Delete("projects/:projectId/members/:memberId")
  deleteProjectMember(@Req() request: AuthedRequest, @Param("projectId") projectId: string, @Param("memberId") memberId: string) {
    return this.appService.deleteProjectMember(request.authUser!.id, projectId, memberId);
  }

  @Get("issues/:id")
  getIssue(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getIssue(request.authUser!.id, id);
  }

  @Patch("issues/:id")
  updateIssue(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.appService.updateIssue(request.authUser!.id, id, body);
  }

  @Delete("issues/:id")
  deleteIssue(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.deleteIssue(request.authUser!.id, id);
  }

  @Delete("projects/:id/issues")
  deleteProjectIssues(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.appService.deleteProjectIssues(request.authUser!.id, id, body);
  }

  @Get("issues/:id/events")
  getIssueEvents(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getIssueEvents(request.authUser!.id, id);
  }

  @Get("issues/:id/comments")
  getIssueComments(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getIssueComments(request.authUser!.id, id);
  }

  @Post("issues/:id/comments")
  createIssueComment(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.appService.createIssueComment(request.authUser!.id, id, body);
  }

  @Get("events/:id")
  getEvent(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.appService.getEvent(request.authUser!.id, id);
  }
}
