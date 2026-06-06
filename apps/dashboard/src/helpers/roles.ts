import type { ProjectRole } from "@/lib";

export const PROJECT_ROLES: ProjectRole[] = ["MAINTAINER", "MEMBER", "VIEWER"];

export const ROLE_LABELS: Record<ProjectRole, string> = {
  MAINTAINER: "Maintainer",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  MAINTAINER:
    "Full control: invites, roles, removal, settings, delete project.",
  MEMBER:
    "Normal project access: can work, comment, and use assigned features.",
  VIEWER: "Read-only: can open the project but cannot change team or settings.",
};
