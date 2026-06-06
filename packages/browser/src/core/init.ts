import {
  captureClicks,
  captureNavigation,
  patchConsole,
  snapshotBreadcrumbs,
} from "../capture/breadcrumbs.js";
import { patchFetch, patchXhr, snapshotNetwork } from "../capture/network.js";
import { snapshotReplay, startReplayCapture } from "../capture/replay.js";
import { getWindowErrorSource, pickBestSource } from "../capture/source.js";
import { getUserContext, setInitialUser } from "../context/user.js";
import type { IngestEventInput, InitOptions } from "../types/index.js";
import { extractMessage, extractStack } from "../utils/error.js";
import { normalizeDuration } from "../utils/time.js";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_REPLAY_POST_ERROR_MS,
  DEFAULT_REPLAY_PRE_ERROR_MS,
} from "./constants.js";
import { sendEvent } from "./transport.js";

let isInitialized = false;
let replayPreErrorMs = DEFAULT_REPLAY_PRE_ERROR_MS;
let replayPostErrorMs = DEFAULT_REPLAY_POST_ERROR_MS;
let currentEndpoint = DEFAULT_ENDPOINT;
let currentApiKey = "";

export { currentApiKey, currentEndpoint };

export function init(options: InitOptions): void {
  if (isInitialized) return;
  if (!options.apiKey) throw new Error("ArtsTrace init requires apiKey");

  currentEndpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  currentApiKey = options.apiKey;
  setInitialUser(options.userId);
  replayPreErrorMs = normalizeDuration(
    options.replayPreErrorMs,
    DEFAULT_REPLAY_PRE_ERROR_MS,
    2_000,
    60_000,
  );
  replayPostErrorMs = normalizeDuration(
    options.replayPostErrorMs,
    DEFAULT_REPLAY_POST_ERROR_MS,
    0,
    30_000,
  );

  patchConsole();
  captureNavigation();
  captureClicks();
  patchFetch();
  patchXhr();
  startReplayCapture(replayPreErrorMs, replayPostErrorMs);

  window.addEventListener("error", (event) => {
    const source =
      pickBestSource(event.error?.stack) ?? getWindowErrorSource(event);

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
      replayEvents: snapshotReplay(),
    };

    void sendEvent(currentEndpoint, payload, {
      preErrorMs: replayPreErrorMs,
      postErrorMs: replayPostErrorMs,
    });
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
      replayEvents: snapshotReplay(),
    };

    void sendEvent(currentEndpoint, payload, {
      preErrorMs: replayPreErrorMs,
      postErrorMs: replayPostErrorMs,
    });
  });

  isInitialized = true;
}
