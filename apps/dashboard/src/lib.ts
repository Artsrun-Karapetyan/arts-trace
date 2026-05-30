const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export type ProjectRow = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  totalErrors: number;
  errorsToday: number;
};

export type EventRow = {
  id: string;
  projectId: string;
  message: string;
  stack?: string | null;
  url: string;
  userAgent?: string | null;
  createdAt: string;
};

export async function fetchProjects(): Promise<ProjectRow[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchProjectEvents(projectId: string): Promise<EventRow[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/events`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function fetchEvent(eventId: string): Promise<EventRow> {
  const res = await fetch(`${API_BASE}/events/${eventId}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json();
}

export function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}
