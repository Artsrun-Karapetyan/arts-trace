const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`API ${res.status} for ${url}`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON from ${url}, got ${contentType || "unknown"} (starts with: ${body.slice(0, 40)})`);
  }

  return JSON.parse(body) as T;
}

export type ProjectRow = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  totalErrors: number;
  errorsToday: number;
};

export type CreateProjectInput = {
  name: string;
};

export type IssueRow = {
  id: string;
  projectId: string;
  fingerprint: string;
  message: string;
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

export type EventRow = {
  id: string;
  projectId: string;
  issueId?: string | null;
  message: string;
  stack?: string | null;
  fileName?: string | null;
  line?: number | null;
  column?: number | null;
  url: string;
  userAgent?: string | null;
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

export async function createProject(input: CreateProjectInput): Promise<ProjectRow> {
  const url = `${API_BASE}/projects`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${url}`);
  }

  return JSON.parse(body) as ProjectRow;
}

export async function fetchProject(projectId: string): Promise<ProjectRow> {
  return fetchJson<ProjectRow>(`/projects/${projectId}`);
}

export async function rotateProjectKey(projectId: string): Promise<ProjectRow> {
  const url = `${API_BASE}/projects/${projectId}/rotate-key`;
  const res = await fetch(url, { method: "POST" });
  const body = await res.text();
  if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
  return JSON.parse(body) as ProjectRow;
}

export async function deleteProject(projectId: string): Promise<{ success: true }> {
  const url = `${API_BASE}/projects/${projectId}`;
  const res = await fetch(url, { method: "DELETE" });
  const body = await res.text();
  if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
  return JSON.parse(body) as { success: true };
}

export async function fetchProjectIssues(projectId: string): Promise<IssueRow[]> {
  return fetchJson<IssueRow[]>(`/projects/${projectId}/issues`);
}

export async function fetchIssue(issueId: string): Promise<IssueRow> {
  return fetchJson<IssueRow>(`/issues/${issueId}`);
}

export async function fetchIssueEvents(issueId: string): Promise<EventRow[]> {
  return fetchJson<EventRow[]>(`/issues/${issueId}/events`);
}

export async function fetchProjectEvents(projectId: string): Promise<EventRow[]> {
  return fetchJson<EventRow[]>(`/projects/${projectId}/events`);
}

export async function fetchEvent(eventId: string): Promise<EventRow> {
  return fetchJson<EventRow>(`/events/${eventId}`);
}

export function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}
