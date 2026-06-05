import { Inject, Body, Controller, Post } from "@nestjs/common";

import { Public } from "@/common/public.decorator";

import { ReportsService } from "./reports.service";

@Controller()
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Public()
  @Post("manual-reports")
  createManualReport(@Body() body: unknown) {
    return this.reportsService.createManualReport(body);
  }

  @Public()
  @Post("sourcemaps")
  uploadSourceMap(@Body() body: unknown) {
    return this.reportsService.uploadSourceMap(body);
  }
}
