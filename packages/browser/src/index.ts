import {
  captureClicks,
  captureNavigation,
  patchConsole,
  snapshotBreadcrumbs
} from "./breadcrumbs.ts";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_REPLAY_POST_ERROR_MS,
  DEFAULT_REPLAY_PRE_ERROR_MS
} from "./constants.ts";
import { patchFetch, patchXhr, snapshotNetwork } from "./network.ts";
import { snapshotReplay, startReplayCapture } from "./replay.ts";
import { getWindowErrorSource, pickBestSource } from "./source.ts";
import { sendEvent } from "./transport.ts";
import { getUserContext, setInitialUser } from "./user.ts";
import type { IngestEventInput, InitOptions } from "./types.ts";
export { clearUser, setUser } from "./user.ts";

let isInitialized = false;
let replayPreErrorMs = DEFAULT_REPLAY_PRE_ERROR_MS;
let replayPostErrorMs = DEFAULT_REPLAY_POST_ERROR_MS;

export function init(options: InitOptions): void {
  if (isInitialized) return;
  if (!options.apiKey) throw new Error("ArtsTrace init requires apiKey");

  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  setInitialUser(options.userId);
  replayPreErrorMs = normalizeDuration(options.replayPreErrorMs, DEFAULT_REPLAY_PRE_ERROR_MS, 2_000, 60_000);
  replayPostErrorMs = normalizeDuration(options.replayPostErrorMs, DEFAULT_REPLAY_POST_ERROR_MS, 0, 30_000);

  patchConsole();
  captureNavigation();
  captureClicks();
  patchFetch();
  patchXhr();
  startReplayCapture(replayPreErrorMs, replayPostErrorMs);

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

    void sendEvent(endpoint, payload, { preErrorMs: replayPreErrorMs, postErrorMs: replayPostErrorMs });
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

    void sendEvent(endpoint, payload, { preErrorMs: replayPreErrorMs, postErrorMs: replayPostErrorMs });
  });

  isInitialized = true;
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

function normalizeDuration(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
