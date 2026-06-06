import type { IngestEventInput, UserContext } from "../types/index.js";

let currentUser: UserContext | undefined = undefined;

export function setUser(user: string | UserContext): void {
  currentUser = typeof user === "string" ? { id: user } : user;
}

export function clearUser(): void {
  currentUser = undefined;
}

export function setInitialUser(userId?: string): void {
  if (userId) {
    currentUser = { id: userId };
  }
}

export function getUserContext(): Pick<
  IngestEventInput,
  "userId" | "userName" | "userRole"
> {
  return {
    userId: currentUser?.id ?? getOrCreateSessionId(),
    userName: currentUser?.name ?? currentUser?.fullName,
    userRole: currentUser?.role,
  };
}

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem("artstrace_session_id");
    if (!id) {
      id = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem("artstrace_session_id", id);
    }
    return id;
  } catch {
    return `anon_temp_${Math.random().toString(36).slice(2)}`;
  }
}
