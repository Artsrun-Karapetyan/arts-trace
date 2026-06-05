import { record } from "rrweb";
import { MAX_REPLAY, MAX_REPLAY_UPLOAD_BYTES } from "./constants.ts";

const replayEvents: Array<Record<string, unknown>> = [];
let stopReplay: (() => void) | null = null;

export function startReplayCapture(replayPreErrorMs: number, replayPostErrorMs: number): void {
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

export function snapshotReplay(): Array<Record<string, unknown>> {
  return replayEvents.slice(-MAX_REPLAY);
}

export function buildReplayForTransport(
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

export function fitReplayForUpload(input: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
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

function trimReplayBuffer(): void {
  if (replayEvents.length <= MAX_REPLAY) return;

  const fullSnapshotIndex = replayEvents.findIndex((event) => event.type === 2 || event.type === "FullSnapshot");
  const removeAt = fullSnapshotIndex >= 0 ? fullSnapshotIndex + 1 : 0;
  replayEvents.splice(removeAt, replayEvents.length - MAX_REPLAY);
}

function jsonBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
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
