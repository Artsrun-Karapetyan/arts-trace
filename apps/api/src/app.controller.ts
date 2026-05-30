import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Post("events")
  createEvent(@Body() body: unknown) {
    return this.appService.createEvent(body);
  }

  @Get("projects")
  getProjects() {
    return this.appService.getProjects();
  }

  @Get("projects/:id/events")
  getProjectEvents(@Param("id") id: string) {
    return this.appService.getProjectEvents(id);
  }

  @Get("events/:id")
  getEvent(@Param("id") id: string) {
    return this.appService.getEvent(id);
  }
}
 
