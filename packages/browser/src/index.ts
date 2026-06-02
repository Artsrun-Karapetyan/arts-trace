import { record } from "rrweb";

type IngestEventInput = {
  apiKey: string;
  release?: string;
  message: string;
  stack?: string;
  filePath?: string;
  fileName?: string;
  line?: number;
  column?: number;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  breadcrumbs?: Array<{
    type: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: string;
  }>;
  networkRequests?: Array<{
    method: string;
    url: string;
    status?: number;
    requestHeaders?: Record<string, string>;
    requestBody?: string;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    error?: string;
    duration?: number;
    createdAt: string;
  }>;
  replayEvents?: Array<Record<string, unknown>>;
};

type InitOptions = {
  apiKey: string;
  endpoint?: string;
  userId?: string;
  release?: string;
  replayPreErrorMs?: number;
  replayPostErrorMs?: number;
};

type UserContext = {
  id: string;
  name?: string;
  fullName?: string;
  role?: string;
};

type Breadcrumb = NonNullable<IngestEventInput["breadcrumbs"]>[number];
type NetworkRequest = NonNullable<IngestEventInput["networkRequests"]>[number];

const DEFAULT_ENDPOINT = "http://localhost:3000/events";
const MAX_BREADCRUMBS = 40;
const MAX_NETWORK = 50;
const MAX_REPLAY = 2000;
const MAX_REPLAY_UPLOAD_BYTES = 4_000_000;
const MAX_EVENT_UPLOAD_BYTES = 60_000;
const DEFAULT_REPLAY_PRE_ERROR_MS = 15_000;
const DEFAULT_REPLAY_POST_ERROR_MS = 2_000;

let isInitialized = false;
let replayPreErrorMs = DEFAULT_REPLAY_PRE_ERROR_MS;
let replayPostErrorMs = DEFAULT_REPLAY_POST_ERROR_MS;

const breadcrumbs: Breadcrumb[] = [];
const networkRequests: NetworkRequest[] = [];
const replayEvents: Array<Record<string, unknown>> = [];
let stopReplay: (() => void) | null = null;

let currentUser: UserContext | undefined = undefined;

export function setUser(user: string | UserContext): void {
  currentUser = typeof user === "string" ? { id: user } : user;
}

export function clearUser(): void {
  currentUser = undefined;
}

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem("artstrace_session_id");
    if (!id) {
      id = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("artstrace_session_id", id);
    }
    return id;
  } catch {
    return "anon_temp_" + Math.random().toString(36).slice(2);
  }
}

export function init(options: InitOptions): void {
  if (isInitialized) return;
  if (!options.apiKey) throw new Error("ArtsTrace init requires apiKey");

  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  if (options.userId) {
    currentUser = { id: options.userId };
  }
  replayPreErrorMs = normalizeDuration(options.replayPreErrorMs, DEFAULT_REPLAY_PRE_ERROR_MS, 2_000, 60_000);
  replayPostErrorMs = normalizeDuration(options.replayPostErrorMs, DEFAULT_REPLAY_POST_ERROR_MS, 0, 30_000);

  patchConsole();
  captureNavigation();
  captureClicks();
  patchFetch();
  patchXhr();
  startReplayCapture();

  window.addEventListener("error", (event) => {
    const source = pickBestSource(event.error?.stack) ?? getWindowErrorSource(event);

    const payload: IngestEventInput = {
      apiKey: options.apiKey,
      release: options.release,
      message: event.message || "Unknown error",
      stack: event.error?.stack,
      filePath: source?.filePath,
      fileName: source?.fileName,
      line: source?.line,
      column: source?.column,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...getUserContext(),
      breadcrumbs: snapshotBreadcrumbs(),
      networkRequests: snapshotNetwork(),
      replayEvents: snapshotReplay()
    };

    void sendEvent(endpoint, payload);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = extractMessage(reason);
    const stack = extractStack(reason);
    const source = pickBestSource(stack);

    const payload: IngestEventInput = {
      apiKey: options.apiKey,
      release: options.release,
      message,
      stack,
      filePath: source?.filePath,
      fileName: source?.fileName,
      line: source?.line,
      column: source?.column,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...getUserContext(),
      breadcrumbs: snapshotBreadcrumbs(),
      networkRequests: snapshotNetwork(),
      replayEvents: snapshotReplay()
    };

    void sendEvent(endpoint, payload);
  });

  isInitialized = true;
}

function getUserContext(): Pick<IngestEventInput, "userId" | "userName" | "userRole"> {
  return {
    userId: currentUser?.id ?? getOrCreateSessionId(),
    userName: currentUser?.name ?? currentUser?.fullName,
    userRole: currentUser?.role
  };
}

function startReplayCapture(): void {
  try {
    if (stopReplay) return;
    stopReplay = record({
      // Force periodic full snapshots so "pre-error window" can start near the error.
      checkoutEveryNms: Math.max(10_000, replayPreErrorMs + replayPostErrorMs),
      emit(event) {
        replayEvents.push(event as Record<string, unknown>);
        trimReplayBuffer();
      }
    }) ?? null;
  } catch {
    // no-op
  }
}

function pushBreadcrumb(item: Omit<Breadcrumb, "createdAt">): void {
  breadcrumbs.push({ ...item, createdAt: new Date().toISOString() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

function pushNetwork(item: Omit<NetworkRequest, "createdAt">): void {
  networkRequests.push({ ...item, createdAt: new Date().toISOString() });
  if (networkRequests.length > MAX_NETWORK) networkRequests.shift();
}

function snapshotBreadcrumbs(): Breadcrumb[] {
  return breadcrumbs.slice(-MAX_BREADCRUMBS);
}

function snapshotNetwork(): NetworkRequest[] {
  return networkRequests.slice(-MAX_NETWORK);
}

function snapshotReplay(): Array<Record<string, unknown>> {
  return replayEvents.slice(-MAX_REPLAY);
}

function patchConsole(): void {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    try {
      const message = args
        .map((a) => {
          if (typeof a === "string") return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" ")
        .slice(0, 300);

      pushBreadcrumb({
        type: "console.error",
        message: message || "console.error",
        data: { argsCount: args.length }
      });
    } catch {
      // no-op
    }
    originalError(...args);
  };
}

function captureNavigation(): void {
  const push = () => {
    pushBreadcrumb({
      type: "navigation",
      message: window.location.href
    });
  };

  push();
  window.addEventListener("popstate", push);
  window.addEventListener("hashchange", push);
}

function captureClicks(): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase() ?? "unknown";
      const text = (target.textContent ?? "").trim().slice(0, 80);
      const id = target.id ? `#${target.id}` : "";
      const cls = target.className && typeof target.className === "string" ? `.${target.className.split(" ").slice(0, 2).join(".")}` : "";

      pushBreadcrumb({
        type: "click",
        message: `${tag}${id}${cls}`,
        data: {
          text
        }
      });
    },
    { capture: true }
  );
}

function patchFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const started = Date.now();
    const req = args[0];
    const init = args[1];
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof req === "string" ? req : req instanceof URL ? req.toString() : req.url;
    const requestHeaders = headersToRecord(init?.headers ?? (req instanceof Request ? req.headers : undefined));
    const requestBody = normalizeBody(init?.body);

    try {
      const res = await originalFetch(...args);
      const responseBody = await readResponseBody(res);
      pushNetwork({
        method,
        url,
        status: res.status,
        requestHeaders,
        requestBody,
        responseHeaders: headersToRecord(res.headers),
        responseBody,
        duration: Date.now() - started
      });
      return res;
    } catch (error) {
      pushNetwork({
        method,
        url,
        requestHeaders,
        requestBody,
        error: toErrorMessage(error),
        duration: Date.now() - started
      });
      throw error;
    }
  };
}

function patchXhr(): void {
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  const setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> }).__at_method = method;
    (this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> }).__at_url = String(url);
    (this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> }).__at_request_headers = {};
    return open.apply(this, [method, url, ...rest] as unknown as Parameters<XMLHttpRequest["open"]>);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const self = this as XMLHttpRequest & { __at_request_headers?: Record<string, string> };
    if (!self.__at_request_headers) self.__at_request_headers = {};
    self.__at_request_headers[name.toLowerCase()] = clamp(String(value), 300);
    return setRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (...args: unknown[]) {
    const started = Date.now();
    const self = this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> };

    const done = () => {
      const responseBody = typeof self.responseText === "string" ? clamp(self.responseText, 2_000) : undefined;
      pushNetwork({
        method: (self.__at_method ?? "GET").toUpperCase(),
        url: self.__at_url ?? "unknown",
        status: self.status || undefined,
        requestHeaders: self.__at_request_headers,
        requestBody: normalizeBody(args[0]),
        responseHeaders: headersFromRaw(self.getAllResponseHeaders()),
        responseBody,
        error: self.status === 0 ? "network_error" : undefined,
        duration: Date.now() - started
      });
      self.removeEventListener("loadend", done);
    };

    self.addEventListener("loadend", done);
    return send.call(this, ...(args as []));
  };
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value;
}

function headersToRecord(input?: HeadersInit): Record<string, string> | undefined {
  if (!input) return undefined;
  try {
    const headers = new Headers(input);
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = clamp(String(value), 300);
    });
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function headersFromRaw(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  const result: Record<string, string> = {};
  raw
    .split("\r\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(":");
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (!key) return;
      result[key] = clamp(value, 300);
    });
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return clamp(body, 2_000);
  if (body instanceof URLSearchParams) return clamp(body.toString(), 2_000);
  if (body instanceof FormData) return "[FormData]";
  if (body instanceof Blob) return `[Blob ${body.type || "unknown"} ${body.size}b]`;
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength}b]`;
  if (ArrayBuffer.isView(body)) return `[TypedArray ${body.byteLength}b]`;
  return `[${Object.prototype.toString.call(body)}]`;
}

async function readResponseBody(res: Response): Promise<string | undefined> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (!/json|text|xml|html|javascript/i.test(contentType)) return undefined;
    const text = await res.clone().text();
    return clamp(text, 2_000);
  } catch {
    return undefined;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return clamp(error.message, 300);
  return "network_error";
}

function extractMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return "Unhandled rejection";
  }
}

function extractStack(reason: unknown): string | undefined {
  if (reason instanceof Error) return reason.stack;
  return undefined;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function getWindowErrorSource(event: ErrorEvent): { filePath: string; fileName: string; line: number; column: number } | null {
  if (!event.filename || event.lineno <= 0 || event.colno <= 0) return null;
  return {
    filePath: event.filename,
    fileName: getFileName(event.filename),
    line: event.lineno,
    column: event.colno
  };
}

function pickBestSource(stack?: string): { filePath: string; fileName: string; line: number; column: number } | null {
  if (!stack) return null;

  const frames = stack
    .split("\n")
    .map((line) => line.trim())
    .map(parseStackFrame)
    .filter((x): x is { filePath: string; line: number; column: number } => x !== null);

  if (frames.length === 0) return null;
  const preferred = frames.find((frame) => isPreferredFrame(frame.filePath));
  const selected = preferred ?? frames[0];

  return {
    filePath: selected.filePath,
    fileName: getFileName(selected.filePath),
    line: selected.line,
    column: selected.column
  };
}

function parseStackFrame(line: string): { filePath: string; line: number; column: number } | null {
  const match = line.match(/((?:https?:\/\/|\/)[^)\s]+):(\d+):(\d+)/);
  if (!match) return null;

  const lineNumber = Number(match[2]);
  const columnNumber = Number(match[3]);
  if (Number.isNaN(lineNumber) || Number.isNaN(columnNumber)) return null;

  return {
    filePath: match[1],
    line: lineNumber,
    column: columnNumber
  };
}

function isPreferredFrame(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  if (lowered.includes("/src/")) return true;
  const blocked = ["node_modules", "@vite", "/vite/", "react-dom", "chunk-"];
  return !blocked.some((token) => lowered.includes(token));
}

async function sendEvent(endpoint: string, payload: IngestEventInput): Promise<void> {
  const replay = payload.replayEvents ?? [];
  const eventPayload = toCompactEventPayload(payload);

  try {
    const body = JSON.stringify(eventPayload);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body,
        keepalive: true,
        signal: controller.signal
      });

      if (!response.ok) return;
      const result = await response.json() as { eventId?: string };
      if (result.eventId) {
        void uploadReplay(
          endpoint,
          result.eventId,
          payload.apiKey,
          replay,
          Date.parse(payload.timestamp),
          replayPreErrorMs,
          replayPostErrorMs
        );
      }
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    try {
      const body = JSON.stringify(eventPayload);
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
    } catch {
      // no-op: monitoring should never break the host app
    }
  }
}

function toCompactEventPayload(payload: IngestEventInput): IngestEventInput {
  const draft: IngestEventInput = {
    ...payload
  };

  delete draft.replayEvents;
  if (draft.stack && draft.stack.length > 12_000) draft.stack = draft.stack.slice(0, 12_000);
  if (jsonBytes(draft) <= MAX_EVENT_UPLOAD_BYTES) return draft;
  draft.networkRequests = (draft.networkRequests ?? []).slice(-20);
  draft.breadcrumbs = (draft.breadcrumbs ?? []).slice(-20);
  if (jsonBytes(draft) <= MAX_EVENT_UPLOAD_BYTES) return draft;
  draft.networkRequests = [];
  draft.breadcrumbs = [];
  if (draft.stack && draft.stack.length > 2_000) draft.stack = draft.stack.slice(0, 2_000);
  return draft;
}

async function uploadReplay(
  endpoint: string,
  eventId: string,
  apiKey: string,
  input: Array<Record<string, unknown>>,
  errorTs: number,
  preErrorMs: number,
  postErrorMs: number
): Promise<void> {
  const replay = fitReplayForUpload(buildReplayForTransport(input, errorTs, preErrorMs, postErrorMs));
  if (replay.length < 2) return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);

  try {
    await fetch(`${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(eventId)}/replay`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ apiKey, replayEvents: replay }),
      signal: controller.signal
    });
  } catch {
    // no-op: replay failure should not affect the host app or error ingestion
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildReplayForTransport(
  input: Array<Record<string, unknown>>,
  errorTs: number,
  preErrorMs: number,
  postErrorMs: number
): Array<Record<string, unknown>> {
  if (input.length === 0) return [];

  const events = input.filter(isReplayEvent);
  if (events.length === 0) return [];

  const safeErrorTs = Number.isFinite(errorTs) ? errorTs : events[events.length - 1]?.timestamp ?? Date.now();
  const startTs = safeErrorTs - preErrorMs;
  const endTs = safeErrorTs + postErrorMs;

  let firstInWindow = events.findIndex((e) => e.timestamp >= startTs);
  if (firstInWindow < 0) firstInWindow = Math.max(0, events.length - 1);

  let lastInWindow = findLastIndex(events, (e) => e.timestamp <= endTs);
  if (lastInWindow < firstInWindow) lastInWindow = events.length - 1;

  const fullSnapshotIndex = findLastIndex(
    events.slice(0, firstInWindow + 1),
    (e) => e.type === 2 || e.type === "FullSnapshot"
  );
  const fullSnapshotAbs = fullSnapshotIndex >= 0 ? fullSnapshotIndex : firstInWindow;
  const metaIndex = findLastIndex(events.slice(0, fullSnapshotAbs + 1), (e) => e.type === 4 || e.type === "Meta");
  let startIndex = metaIndex >= 0 ? metaIndex : fullSnapshotAbs;

  // If the nearest snapshot is too old, cut to the requested window anyway.
  const startEventTs = events[startIndex]?.timestamp ?? safeErrorTs;
  if (safeErrorTs - startEventTs > preErrorMs + 2_000) {
    startIndex = firstInWindow;
  }

  return events.slice(startIndex, Math.min(lastInWindow + 1, events.length));
}

function trimReplayBuffer(): void {
  if (replayEvents.length <= MAX_REPLAY) return;

  const fullSnapshotIndex = replayEvents.findIndex((event) => event.type === 2 || event.type === "FullSnapshot");
  const removeAt = fullSnapshotIndex >= 0 ? fullSnapshotIndex + 1 : 0;
  replayEvents.splice(removeAt, replayEvents.length - MAX_REPLAY);
}

function fitReplayForUpload(input: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (input.length === 0) return [];
  if (jsonBytes(input) <= MAX_REPLAY_UPLOAD_BYTES) return input;

  const fullSnapshotIndex = input.findIndex((event) => event.type === 2 || event.type === "FullSnapshot");
  if (fullSnapshotIndex < 0) return [];

  const head = input.slice(0, fullSnapshotIndex + 1);
  let tail = input.slice(fullSnapshotIndex + 1);

  while (tail.length > 0 && jsonBytes([...head, ...tail]) > MAX_REPLAY_UPLOAD_BYTES) {
    tail = tail.slice(Math.max(1, Math.ceil(tail.length * 0.1)));
  }

  return jsonBytes([...head, ...tail]) <= MAX_REPLAY_UPLOAD_BYTES ? [...head, ...tail] : [];
}

function jsonBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}

function normalizeDuration(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isReplayEvent(value: Record<string, unknown>): value is Record<string, unknown> & { type: number | string; timestamp: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    ("type" in value) &&
    ("timestamp" in value) &&
    (typeof value.timestamp === "number")
  );
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
