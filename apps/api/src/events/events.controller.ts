import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";

import type { AuthedRequest } from "@/common/helpers";
import { Public } from "@/common/public.decorator";

import { EventsService } from "./events.service";

@Controller()
export class EventsController {
  constructor(
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  @Public()
  @Post("events")
  createEvent(@Body() body: unknown) {
    return this.eventsService.createEvent(body);
  }

  @Public()
  @Post("events/:id/replay")
  uploadReplay(@Param("id") id: string, @Body() body: unknown) {
    return this.eventsService.uploadReplay(id, body);
  }

  @Get("projects/:id/events")
  getProjectEvents(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.eventsService.getProjectEvents(request.authUser!.id, id);
  }

  @Get("events/:id")
  getEvent(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.eventsService.getEvent(request.authUser!.id, id);
  }
}
