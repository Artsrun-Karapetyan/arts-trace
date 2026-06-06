import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { EventsModule } from "./events/events.module";
import { IssuesModule } from "./issues/issues.module";
import { ProjectsModule } from "./projects/projects.module";
import { ReportsModule } from "./reports/reports.module";
import { TeamModule } from "./team/team.module";

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    IssuesModule,
    EventsModule,
    TeamModule,
    ReportsModule,
  ],
})
export class AppModule {}
