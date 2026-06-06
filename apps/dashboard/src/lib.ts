const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3100";
const AUTH_TOKEN_KEY = "artstrace_auth_token";
export const AUTH_UNAUTHORIZED_EVENT = "artstrace:unauthorized";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = typeof window !== "undefined" ? getAuthToken() : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...init,
    headers,
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      clearAuthToken();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new Error(readApiError(body, res.status, url));
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON from ${url}, got ${contentType || "unknown"} (starts with: ${body.slice(0, 40)})`,
    );
  }

  return JSON.parse(body) as T;
}

function readApiError(body: string, status: number, url: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(", ");
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // no-op
  }

  return `API ${status} for ${url}`;
}

export type ProjectRow = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  totalErrors: number;
  errorsToday: number;
  accessRole?: ProjectRole;
  owner?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
};

export type CreateProjectInput = {
  name: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

export type IssueRow = {
  id: string;
  projectId: string;
  fingerprint: string;
  message: string;
  type?: IssueType;
  manualReports?: ManualReportRow[];
  status: IssueStatus;
  priority: IssuePriority;
  assignee?: string | null;
  count: number;
  usersCount: number;
  firstSeen: string;
  lastSeen: string;
  environment?: {
    browsers: Array<{ name: string; count: number; percent: number }>;
    os: Array<{ name: string; count: number; percent: number }>;
    devices: Array<{ name: string; count: number; percent: number }>;
  };
};

export type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
export type IssueType = "AUTOMATIC" | "MANUAL";
export type ProjectRole = "MAINTAINER" | "MEMBER" | "VIEWER";

export type ManualReportAnnotation = {
  kind: "highlight" | "arrow" | "circle" | "note";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
};

export type ManualReportRow = {
  id: string;
  issueId: string;
  title: string;
  description?: string | null;
  screenshotData?: string | null;
  annotations?: ManualReportAnnotation[] | null;
  url: string;
  userAgent?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
};

export type ProjectMemberRow = {
  id: string;
  projectId: string;
  userId?: string | null;
  email?: string | null;
  name: string;
  role?: ProjectRole | null;
  createdAt: string;
};

export type IssueCommentRow = {
  id: string;
  issueId: string;
  authorId?: string | null;
  authorName?: string | null;
  body: string;
  createdAt: string;
};

export type ProjectInviteRow = {
  id: string;
  projectId: string;
  token: string;
  email: string;
  role?: ProjectRole | null;
  acceptedByUserId?: string | null;
  acceptedAt?: string | null;
  expiresAt: string;
  createdAt: string;
};

export type PublicInviteRow = {
  token: string;
  projectId: string;
  projectName: string;
  email: string;
  role?: ProjectRole | null;
  expiresAt: string;
};

export type EventRow = {
  id: string;
  projectId: string;
  issueId?: string | null;
  message: string;
  stack?: string | null;
  fileName?: string | null;
  line?: number | null;
  column?: number | null;
  sourceContext?: {
    fileName: string;
    line: number;
    column: number;
    lines: Array<{
      number: number;
      text: string;
      highlight: boolean;
    }>;
  } | null;
  url: string;
  userAgent?: string | null;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  createdAt: string;
  breadcrumbs?: Array<{
    id: string;
    type: string;
    message: string;
    data?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  networkRequests?: Array<{
    id: string;
    method: string;
    url: string;
    status?: number | null;
    requestHeaders?: Record<string, string> | null;
    requestBody?: string | null;
    responseHeaders?: Record<string, string> | null;
    responseBody?: string | null;
    error?: string | null;
    duration?: number | null;
    createdAt: string;
  }>;
  replays?: Array<{
    id: string;
    eventId: string;
    events: Array<Record<string, unknown>>;
    createdAt: string;
  }>;
};

export async function fetchProjects(): Promise<ProjectRow[]> {
  return fetchJson<ProjectRow[]>("/projects");
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectRow> {
  return fetchJson<ProjectRow>("/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function fetchProject(projectId: string): Promise<ProjectRow> {
  return fetchJson<ProjectRow>(`/projects/${projectId}`);
}

export async function rotateProjectKey(projectId: string): Promise<ProjectRow> {
  return fetchJson<ProjectRow>(`/projects/${projectId}/rotate-key`, {
    method: "POST",
  });
}

export async function deleteProject(
  projectId: string,
): Promise<{ success: true }> {
  return fetchJson<{ success: true }>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function fetchProjectIssues(
  projectId: string,
): Promise<IssueRow[]> {
  return fetchJson<IssueRow[]>(`/projects/${projectId}/issues`);
}

export async function fetchIssue(issueId: string): Promise<IssueRow> {
  return fetchJson<IssueRow>(`/issues/${issueId}`);
}

export async function fetchProjectMembers(
  projectId: string,
): Promise<ProjectMemberRow[]> {
  return fetchJson<ProjectMemberRow[]>(`/projects/${projectId}/members`);
}

export async function createProjectMember(
  projectId: string,
  input: { name: string; role?: ProjectRole },
): Promise<ProjectMemberRow> {
  return fetchJson<ProjectMemberRow>(`/projects/${projectId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function addExistingProjectMember(
  projectId: string,
  input: { email: string; role?: ProjectRole },
): Promise<ProjectMemberRow> {
  return fetchJson<ProjectMemberRow>(
    `/projects/${projectId}/members/existing`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectMember(
  projectId: string,
  memberId: string,
  input: { role: ProjectRole },
): Promise<ProjectMemberRow> {
  return fetchJson<ProjectMemberRow>(
    `/projects/${projectId}/members/${memberId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function deleteProjectMember(
  projectId: string,
  memberId: string,
): Promise<{ success: true }> {
  return fetchJson<{ success: true }>(
    `/projects/${projectId}/members/${memberId}`,
    {
      method: "DELETE",
    },
  );
}

export async function fetchProjectInvites(
  projectId: string,
): Promise<ProjectInviteRow[]> {
  return fetchJson<ProjectInviteRow[]>(`/projects/${projectId}/invites`);
}

export async function createProjectInvite(
  projectId: string,
  input: { email: string; role?: ProjectRole },
): Promise<ProjectInviteRow> {
  return fetchJson<ProjectInviteRow>(`/projects/${projectId}/invites`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchInvite(token: string): Promise<PublicInviteRow> {
  return fetchJson<PublicInviteRow>(`/invites/${token}`);
}

export async function acceptInvite(
  token: string,
): Promise<{ success: true; projectId: string }> {
  return fetchJson<{ success: true; projectId: string }>(
    `/invites/${token}/accept`,
    {
      method: "POST",
    },
  );
}

export async function fetchIssueComments(
  issueId: string,
): Promise<IssueCommentRow[]> {
  return fetchJson<IssueCommentRow[]>(`/issues/${issueId}/comments`);
}

export async function createIssueComment(
  issueId: string,
  input: { body: string },
): Promise<IssueCommentRow> {
  return fetchJson<IssueCommentRow>(`/issues/${issueId}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateIssue(
  issueId: string,
  input: { status?: IssueStatus; priority?: IssuePriority; assignee?: string },
): Promise<IssueRow> {
  return fetchJson<IssueRow>(`/issues/${issueId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteIssue(issueId: string): Promise<{ success: true }> {
  return fetchJson<{ success: true }>(`/issues/${issueId}`, {
    method: "DELETE",
  });
}

export async function deleteProjectIssues(
  projectId: string,
  issueIds?: string[],
): Promise<{ success: true; deleted: number }> {
  return fetchJson<{ success: true; deleted: number }>(
    `/projects/${projectId}/issues`,
    {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(issueIds?.length ? { issueIds } : {}),
    },
  );
}

export async function fetchIssueEvents(issueId: string): Promise<EventRow[]> {
  return fetchJson<EventRow[]>(`/issues/${issueId}/events`);
}

export async function fetchProjectEvents(
  projectId: string,
): Promise<EventRow[]> {
  return fetchJson<EventRow[]>(`/projects/${projectId}/events`);
}

export async function fetchEvent(eventId: string): Promise<EventRow> {
  return fetchJson<EventRow>(`/events/${eventId}`);
}

export async function register(
  input: RegisterInput,
): Promise<{ token: string; user: AuthUser }> {
  return fetchJson<{ token: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function login(
  input: RegisterInput,
): Promise<{ token: string; user: AuthUser }> {
  return fetchJson<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<{ success: true }> {
  return fetchJson<{ success: true }>("/auth/logout", {
    method: "POST",
  });
}

export async function fetchMe(): Promise<AuthUser> {
  return fetchJson<AuthUser>("/auth/me");
}

export async function updateMe(input: {
  name?: string | null;
}): Promise<AuthUser> {
  return fetchJson<AuthUser>("/auth/me", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}
