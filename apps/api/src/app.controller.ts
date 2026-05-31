import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Post("projects")
  createProject(@Body() body: unknown) {
    return this.appService.createProject(body);
  }

  @Post("events")
  createEvent(@Body() body: unknown) {
    return this.appService.createEvent(body);
  }

  @Post("events/:id/replay")
  uploadReplay(@Param("id") id: string, @Body() body: unknown) {
    return this.appService.uploadReplay(id, body);
  }

  @Get("projects")
  getProjects() {
    return this.appService.getProjects();
  }

  @Get("projects/:id")
  getProject(@Param("id") id: string) {
    return this.appService.getProject(id);
  }

  @Post("projects/:id/rotate-key")
  rotateProjectKey(@Param("id") id: string) {
    return this.appService.rotateProjectKey(id);
  }

  @Delete("projects/:id")
  deleteProject(@Param("id") id: string) {
    return this.appService.deleteProject(id);
  }

  @Get("projects/:id/events")
  getProjectEvents(@Param("id") id: string) {
    return this.appService.getProjectEvents(id);
  }

  @Get("projects/:id/issues")
  getProjectIssues(@Param("id") id: string) {
    return this.appService.getProjectIssues(id);
  }

  @Get("issues/:id")
  getIssue(@Param("id") id: string) {
    return this.appService.getIssue(id);
  }

  @Get("issues/:id/events")
  getIssueEvents(@Param("id") id: string) {
    return this.appService.getIssueEvents(id);
  }

  @Get("events/:id")
  getEvent(@Param("id") id: string) {
    return this.appService.getEvent(id);
  }
}
