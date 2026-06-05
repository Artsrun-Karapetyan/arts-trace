import { MAX_EVENT_UPLOAD_BYTES } from "./constants.ts";
import { buildReplayForTransport, fitReplayForUpload } from "./replay.ts";
import type { IngestEventInput } from "./types.ts";

type ReplayWindow = {
  preErrorMs: number;
  postErrorMs: number;
};

export async function sendEvent(endpoint: string, payload: IngestEventInput, replayWindow: ReplayWindow): Promise<void> {
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
          replayWindow.preErrorMs,
          replayWindow.postErrorMs
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

function jsonBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}
