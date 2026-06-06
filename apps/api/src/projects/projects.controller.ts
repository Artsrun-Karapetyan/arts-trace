import { Inject, Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req} from "@nestjs/common";

import type { AuthedRequest } from "@/common/helpers";

import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projectsService: ProjectsService) {}

  @Post()
  createProject(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.projectsService.createProject(request.authUser!.id, body);
  }

  @Get()
  getProjects(@Req() request: AuthedRequest) {
    return this.projectsService.getProjects(request.authUser!.id);
  }

  @Get(":id")
  getProject(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.getProject(request.authUser!.id, id);
  }

  @Post(":id/rotate-key")
  rotateProjectKey(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.rotateProjectKey(request.authUser!.id, id);
  }

  @Delete(":id")
  deleteProject(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.deleteProject(request.authUser!.id, id);
  }
}
