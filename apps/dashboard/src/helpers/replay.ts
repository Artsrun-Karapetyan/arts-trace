export function prepareReplayEvents(
  events: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  if (events.length === 0) return [];

  const fullSnapshotIndex = findLastReplayIndex(events, isFullSnapshotEvent);
  if (fullSnapshotIndex < 0) return [];

  const metaIndex = findLastReplayIndex(
    events.slice(0, fullSnapshotIndex + 1),
    isMetaEvent,
  );
  const startIndex = metaIndex >= 0 ? metaIndex : fullSnapshotIndex;
  return events.slice(startIndex);
}

export function isFullSnapshotEvent(event: Record<string, unknown>): boolean {
  return event.type === 2 || event.type === "FullSnapshot";
}

export function isMetaEvent(event: Record<string, unknown>): boolean {
  return event.type === 4 || event.type === "Meta";
}

export function findLastReplayIndex(
  events: Array<Record<string, unknown>>,
  predicate: (event: Record<string, unknown>) => boolean,
): number {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (predicate(events[i])) return i;
  }
  return -1;
}

export function formatReplayTime(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
