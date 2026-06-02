const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const AUTH_TOKEN_KEY = "artstrace_auth_token";

export type AuthUser = {
  id: string;
  email: string;
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
    headers
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      clearAuthToken();
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
        window.location.assign("/login");
      }
    }
    throw new Error(readApiError(body, res.status, url));
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON from ${url}, got ${contentType || "unknown"} (starts with: ${body.slice(0, 40)})`);
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
};

export type CreateProjectInput = {
  name: string;
};

export type RegisterInput = {
  email: string;
  password: string;
};

export type IssueRow = {
  id: string;
  projectId: string;
  fingerprint: string;
  message: string;
  status: IssueStatus;
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
  return fetchJson<ProjectRow>("/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function fetchProject(projectId: string): Promise<ProjectRow> {
  return fetchJson<ProjectRow>(`/projects/${projectId}`);
}

export async function rotateProjectKey(projectId: string): Promise<ProjectRow> {
  return fetchJson<ProjectRow>(`/projects/${projectId}/rotate-key`, {
    method: "POST"
  });
}

export async function deleteProject(projectId: string): Promise<{ success: true }> {
  return fetchJson<{ success: true }>(`/projects/${projectId}`, {
    method: "DELETE"
  });
}

export async function fetchProjectIssues(projectId: string): Promise<IssueRow[]> {
  return fetchJson<IssueRow[]>(`/projects/${projectId}/issues`);
}

export async function fetchIssue(issueId: string): Promise<IssueRow> {
  return fetchJson<IssueRow>(`/issues/${issueId}`);
}

export async function updateIssue(
  issueId: string,
  input: { status?: IssueStatus; assignee?: string }
): Promise<IssueRow> {
  return fetchJson<IssueRow>(`/issues/${issueId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
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

export async function register(input: RegisterInput): Promise<{ token: string; user: AuthUser }> {
  const data = await fetchJson<{ token: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  setAuthToken(data.token);
  return data;
}

export async function login(input: RegisterInput): Promise<{ token: string; user: AuthUser }> {
  const data = await fetchJson<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  setAuthToken(data.token);
  return data;
}

export async function logout(): Promise<{ success: true }> {
  try {
    const data = await fetchJson<{ success: true }>("/auth/logout", {
      method: "POST"
    });
    clearAuthToken();
    return data;
  } catch (error) {
    clearAuthToken();
    throw error;
  }
}

export async function fetchMe(): Promise<AuthUser> {
  return fetchJson<AuthUser>("/auth/me");
}

export function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour12: false });
}
