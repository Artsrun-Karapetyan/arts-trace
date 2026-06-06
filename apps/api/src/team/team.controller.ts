import { Inject, Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req} from "@nestjs/common";

import type { AuthedRequest } from "@/common/helpers";
import { Public } from "@/common/public.decorator";

import { TeamService } from "./team.service";

@Controller()
export class TeamController {
  constructor(@Inject(TeamService) private readonly teamService: TeamService) {}

  @Get("projects/:id/members")
  getProjectMembers(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.teamService.getProjectMembers(request.authUser!.id, id);
  }

  @Get("projects/:id/invites")
  getProjectInvites(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.teamService.getProjectInvites(request.authUser!.id, id);
  }

  @Post("projects/:id/invites")
  createProjectInvite(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.teamService.createProjectInvite(request.authUser!.id, id, body);
  }

  @Public()
  @Get("invites/:token")
  getInvite(@Param("token") token: string) {
    return this.teamService.getInvite(token);
  }

  @Post("invites/:token/accept")
  acceptInvite(@Req() request: AuthedRequest, @Param("token") token: string) {
    return this.teamService.acceptInvite(request.authUser!.id, token);
  }

  @Post("projects/:id/members")
  createProjectMember(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.teamService.createProjectMember(request.authUser!.id, id, body);
  }

  @Post("projects/:id/members/existing")
  addExistingProjectMember(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.teamService.addExistingProjectMember(
      request.authUser!.id,
      id,
      body,
    );
  }

  @Patch("projects/:projectId/members/:memberId")
  updateProjectMember(
    @Req() request: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
  ) {
    return this.teamService.updateProjectMember(
      request.authUser!.id,
      projectId,
      memberId,
      body,
    );
  }

  @Delete("projects/:projectId/members/:memberId")
  deleteProjectMember(
    @Req() request: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
  ) {
    return this.teamService.deleteProjectMember(
      request.authUser!.id,
      projectId,
      memberId,
    );
  }
}
