import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SourceLocation } from "../../../components/SourceLocation";
import { fetchEvent, fmt } from "../../../lib";
import type { EventRow } from "../../../lib";

export const Route = createFileRoute("/_authenticated/events/$id")({
  loader: ({ params }) => fetchEvent(params.id),
  component: EventDetailPage
});

function EventDetailPage() {
  const event = Route.useLoaderData();
  const { t } = useTranslation();
  const replayRef = useRef<HTMLDivElement | null>(null);
  const networkTableRef = useRef<HTMLDivElement | null>(null);
  const [currentReplayMs, setCurrentReplayMs] = useState<number>(0);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isNetworkPinned, setIsNetworkPinned] = useState(false);
  const [showFutureRequests, setShowFutureRequests] = useState(false);
  const [networkTab, setNetworkTab] = useState<"headers" | "payload" | "preview">("headers");
  const [showAllBreadcrumbs, setShowAllBreadcrumbs] = useState(false);
  const replayEvents = (event.replays?.[0]?.events ?? []) as Array<Record<string, unknown>>;
  const replayStartTs = useMemo(() => {
    const first = replayEvents.find((item) => typeof item.timestamp === "number");
    return typeof first?.timestamp === "number" ? first.timestamp : null;
  }, [replayEvents]);
  const networkRows = event.networkRequests ?? [];
  const replayNowTs = replayStartTs != null ? replayStartTs + currentReplayMs : null;
  const visibleNetworkRows = useMemo(() => {
    if (showFutureRequests || replayNowTs == null) return networkRows;
    return networkRows.filter((item) => new Date(item.createdAt).getTime() <= replayNowTs + 250);
  }, [networkRows, replayNowTs, showFutureRequests]);
  const syncedRequestId = useMemo(() => {
    if (replayNowTs == null || visibleNetworkRows.length === 0) return null;
    const nearest = visibleNetworkRows.reduce<{ id: string; distance: number } | null>((best, item) => {
      const distance = Math.abs(new Date(item.createdAt).getTime() - replayNowTs);
      if (distance > 1200) return best;
      if (!best || distance < best.distance) return { id: item.id, distance };
      return best;
    }, null);
    return nearest?.id ?? null;
  }, [replayNowTs, visibleNetworkRows]);
  const selectedRequest = visibleNetworkRows.find((item) => item.id === (isNetworkPinned ? selectedRequestId : syncedRequestId)) ?? visibleNetworkRows[0] ?? null;
  const breadcrumbs = event.breadcrumbs ?? [];
  const breadcrumbLimit = 10;
  const visibleBreadcrumbs = showAllBreadcrumbs ? breadcrumbs : breadcrumbs.slice(-breadcrumbLimit);
  useEffect(() => {
    if (!replayRef.current || replayEvents.length === 0) return;

    let disposed = false;
    let player: { $destroy?: () => void; addEventListener?: (name: string, fn: (event: unknown) => void) => void } | null = null;
    let onResize: (() => void) | null = null;
    const onTimeUpdate = (eventLike: unknown) => {
      const payload = typeof eventLike === "object" && eventLike !== null && "payload" in (eventLike as Record<string, unknown>)
        ? (eventLike as { payload?: unknown }).payload
        : undefined;
      if (typeof payload === "number") setCurrentReplayMs(payload);
    };
    const onPlayerStateUpdate = (eventLike: unknown) => {
      const payload = typeof eventLike === "object" && eventLike !== null && "payload" in (eventLike as Record<string, unknown>)
        ? (eventLike as { payload?: unknown }).payload
        : undefined;
      if (payload === "playing") setIsNetworkPinned(false);
    };

    void import("rrweb-player").then(({ default: RRWebPlayer }) => {
      if (disposed || !replayRef.current) return;

      const mount = () => {
        if (!replayRef.current) return;
        const width = Math.max(560, replayRef.current.clientWidth - 4);
        const height = Math.max(640, Math.floor(width * 0.68));
        if (player?.$destroy) player.$destroy();
        replayRef.current.innerHTML = "";
        player = new RRWebPlayer({
          target: replayRef.current,
          props: {
            events: replayEvents as never[],
            autoPlay: false,
            skipInactive: false,
            inactivePeriodThreshold: 120_000,
            width,
            height
          }
        }) as unknown as { $destroy?: () => void; addEventListener?: (name: string, fn: (event: unknown) => void) => void };
        player.addEventListener?.("ui-update-current-time", onTimeUpdate);
        player.addEventListener?.("ui-update-player-state", onPlayerStateUpdate);
      };

      mount();
      onResize = () => mount();
      window.addEventListener("resize", onResize);
    });

    return () => {
      disposed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      if (player?.$destroy) player.$destroy();
      if (replayRef.current) replayRef.current.innerHTML = "";
    };
  }, [replayEvents]);

  useEffect(() => {
    if (selectedRequestId && !visibleNetworkRows.some((item) => item.id === selectedRequestId)) {
      setSelectedRequestId(visibleNetworkRows[0]?.id ?? null);
      setIsNetworkPinned(false);
    }
  }, [selectedRequestId, visibleNetworkRows]);

  useEffect(() => {
    const table = networkTableRef.current;
    if (!syncedRequestId || !table) return;
    const row = table.querySelector<HTMLElement>(`[data-network-id="${CSS.escape(syncedRequestId)}"]`);
    if (!row) return;

    table.scrollTop = row.offsetTop - table.clientHeight / 2 + row.clientHeight / 2;
  }, [syncedRequestId]);

  return (
    <div>
      <div className="page-head">
        <h2>{t("events.detail")}</h2>
      </div>
      <div className="card">
        {/* Error message banner */}
        <div className="event-error-banner">
          <div className="event-error-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="event-error-content">
            <div className="event-error-label">{t("common.message")}</div>
            <div className="event-error-message">{event.message}</div>
          </div>
        </div>

        {/* Info rows */}
        <div className="event-info-grid">
          <div className="event-info-item">
            <div className="event-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">{t("common.source")}</div>
              <div className="event-info-value">
                <SourceLocation fileName={event.fileName} line={event.line} column={event.column} stack={event.stack} />
              </div>
            </div>
          </div>

          <div className="event-info-item">
            <div className="event-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">{t("common.url")}</div>
              <div className="event-info-value mono">{event.url}</div>
            </div>
          </div>

          <div className="event-info-item">
            <div className="event-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">{t("events.userAgent")}</div>
              <div className="event-info-value">{event.userAgent ?? "-"}</div>
            </div>
          </div>

          <div className="event-info-item">
            <div className="event-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">Affected user</div>
              <div className="event-info-value">
                {event.userName ?? event.userId ?? "-"}
                {event.userRole ? <span className="chip chip-mid event-user-role">{event.userRole}</span> : null}
              </div>
              {event.userName && event.userId ? <div className="mono small-note event-user-id">{event.userId}</div> : null}
            </div>
          </div>

          <div className="event-info-item">
            <div className="event-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">{t("common.created")}</div>
              <div className="event-info-value mono">{fmt(event.createdAt)}</div>
            </div>
          </div>
        </div>

        <hr className="section-sep" />

        <div className="event-stack-head">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <strong>{t("events.stack")}</strong>
        </div>
        <pre>{event.stack ?? t("common.noStack")}</pre>

        {event.sourceContext ? (
          <>
            <hr className="section-sep" />
            <div className="event-stack-head">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <strong>Source context</strong>
            </div>
            <div className="source-context">
              <div className="source-context-title mono">
                {event.sourceContext.fileName}:{event.sourceContext.line}:{event.sourceContext.column}
              </div>
              <div className="source-context-code">
                {event.sourceContext.lines.map((line) => (
                  <div className={`source-context-line ${line.highlight ? "source-context-line-active" : ""}`} key={line.number}>
                    <span className="source-context-number">{line.number}</span>
                    <code>{line.text || " "}</code>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <hr className="section-sep" />

        <div className="page-head" style={{ marginTop: 0, marginBottom: 10 }}>
          <h2 style={{ fontSize: 17 }}>Replay + Network</h2>
        </div>
        <div className="event-grid">
          {replayEvents.length > 0 ? (
            <div className="panel replay-panel">
              <div ref={replayRef} className="replay-container" />
            </div>
          ) : (
            <div className="panel">
              <div className="empty-state" style={{ padding: "32px 20px" }}>
                <div className="empty-state-icon">🎬</div>
                <div className="empty-state-text">Replay not captured for this event</div>
              </div>
            </div>
          )}

          <div className="panel network-inspector">
            <div className="network-inspector-head">
              <strong>Network</strong>
              <div className="network-head-right">
                <span className="mono small-note" style={{ marginTop: 0 }}>{visibleNetworkRows.length}/{networkRows.length} requests</span>
                {isNetworkPinned ? (
                  <button className="btn btn-ghost network-toggle" type="button" onClick={() => setIsNetworkPinned(false)}>
                    Follow replay
                  </button>
                ) : null}
                <button className="btn btn-ghost network-toggle" type="button" onClick={() => setShowFutureRequests((v) => !v)}>
                  {showFutureRequests ? "Replay-synced" : "Show all"}
                </button>
              </div>
            </div>
            <div className="network-table" ref={networkTableRef}>
              <div className="network-table-head">
                <span>Name</span>
                <span>Status</span>
                <span>Type</span>
                <span>Size</span>
                <span>Time</span>
              </div>
              {visibleNetworkRows.length === 0 ? (
                <div className="empty-state" style={{ padding: "24px 16px" }}>
                  <div className="empty-state-icon" style={{ fontSize: 24 }}>-</div>
                  <div className="empty-state-text">No captured requests</div>
                </div>
              ) : (
                visibleNetworkRows.map((n) => {
                  const createdTs = new Date(n.createdAt).getTime();
                  const toErrorMs = createdTs - new Date(event.createdAt).getTime();
                  const nearReplayNow = replayNowTs != null ? Math.abs(createdTs - replayNowTs) <= 1200 : false;
                  const hasNetworkError = isNetworkError(n);
                  const isSyncedRequest = syncedRequestId === n.id;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      data-network-id={n.id}
                      className={`network-item ${selectedRequest?.id === n.id ? "network-item-active" : ""} ${nearReplayNow || isSyncedRequest ? "network-item-live" : ""} ${hasNetworkError ? "network-item-error" : ""}`}
                      onClick={() => {
                        setSelectedRequestId(n.id);
                        setIsNetworkPinned(true);
                      }}
                    >
                      <span className="network-name mono" title={n.url}>
                        <span className={`network-request-dot ${hasNetworkError ? "network-request-dot-error" : ""}`} />
                        {getRequestName(n.url)}
                      </span>
                      <span className={`network-status mono ${hasNetworkError ? "network-status-error" : ""}`}>{formatStatus(n)}</span>
                      <span className="network-cell mono">{getRequestType(n)}</span>
                      <span className="network-cell mono">{formatSize(n)}</span>
                      <span className="network-cell mono" title={`${toErrorMs >= 0 ? "+" : ""}${(toErrorMs / 1000).toFixed(1)}s from error`}>
                        {n.duration ?? "-"}ms
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {selectedRequest ? (
              <div className="network-detail">
                <div className="network-tabs">
                  <button
                    type="button"
                    className={`network-tab ${networkTab === "headers" ? "network-tab-active" : ""}`}
                    onClick={() => setNetworkTab("headers")}
                  >
                    Headers
                  </button>
                  <button
                    type="button"
                    className={`network-tab ${networkTab === "payload" ? "network-tab-active" : ""}`}
                    onClick={() => setNetworkTab("payload")}
                  >
                    Payload
                  </button>
                  <button
                    type="button"
                    className={`network-tab ${networkTab === "preview" ? "network-tab-active" : ""}`}
                    onClick={() => setNetworkTab("preview")}
                  >
                    Preview
                  </button>
                </div>

                {networkTab === "headers" ? (
                  <div className="network-general">
                    <div className="network-detail-section">General</div>
                    <div className="network-detail-row">
                      <span className="small-note" style={{ marginTop: 0 }}>Request URL</span>
                      <span className="mono">{selectedRequest.url}</span>
                    </div>
                    <div className="network-detail-row">
                      <span className="small-note" style={{ marginTop: 0 }}>Request Method</span>
                      <span>{selectedRequest.method}</span>
                    </div>
                    <div className="network-detail-row">
                      <span className="small-note" style={{ marginTop: 0 }}>Status Code</span>
                      <span className={isNetworkError(selectedRequest) ? "network-status-error" : ""}>{selectedRequest.status ?? "Failed"}</span>
                    </div>
                    <div className="network-detail-row">
                      <span className="small-note" style={{ marginTop: 0 }}>Duration</span>
                      <span>{selectedRequest.duration ?? "-"} ms</span>
                    </div>
                    {selectedRequest.error ? (
                      <div className="network-detail-row">
                        <span className="small-note" style={{ marginTop: 0 }}>Error</span>
                        <span className="network-status-error">{selectedRequest.error}</span>
                      </div>
                    ) : null}
                    <div className="network-detail-section">Request Headers</div>
                    <HeaderRows headers={selectedRequest.requestHeaders} />
                    <div className="network-detail-section">Response Headers</div>
                    <HeaderRows headers={selectedRequest.responseHeaders} />
                  </div>
                ) : null}

                {networkTab === "payload" ? (
                  <div className="network-raw-grid">
                    <div>
                      <p><strong>Request Payload</strong></p>
                      <JsonInspector value={toInspectableValue(selectedRequest.requestBody || "-")} />
                    </div>
                  </div>
                ) : null}

                {networkTab === "preview" ? (
                  <div className="network-raw-grid">
                    <div>
                      <p><strong>Response Preview</strong></p>
                      <JsonInspector value={toInspectableValue(selectedRequest.responseBody || selectedRequest.error || "-")} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <hr className="section-sep" />

        <div className="page-head" style={{ marginTop: 0 }}>
          <h2 style={{ fontSize: 17 }}>Breadcrumbs</h2>
          {breadcrumbs.length > breadcrumbLimit ? (
            <button className="btn btn-ghost" onClick={() => setShowAllBreadcrumbs((v) => !v)}>
              {showAllBreadcrumbs ? "Show less" : `Show more (${breadcrumbs.length - breadcrumbLimit})`}
            </button>
          ) : null}
        </div>
        <div className="panel">
          {breadcrumbs.length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 16px" }}>
              <div className="empty-state-icon" style={{ fontSize: 24 }}>🍞</div>
              <div className="empty-state-text">No breadcrumbs captured</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {visibleBreadcrumbs.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{fmt(b.createdAt)}</td>
                    <td>{b.type}</td>
                    <td>{b.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

function isNetworkError(request: NonNullable<EventRow["networkRequests"]>[number]): boolean {
  return Boolean(request.error) || (typeof request.status === "number" && request.status >= 400);
}

function getRequestName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
  } catch {
    return url.split("?")[0]?.split("/").filter(Boolean).pop() || url;
  }
}

function formatStatus(request: NonNullable<EventRow["networkRequests"]>[number]): string {
  if (request.status) return String(request.status);
  return request.error ? "failed" : "-";
}

function getRequestType(request: NonNullable<EventRow["networkRequests"]>[number]): string {
  const contentType = request.responseHeaders?.["content-type"] ?? request.responseHeaders?.["Content-Type"] ?? request.requestHeaders?.["content-type"] ?? request.requestHeaders?.["Content-Type"];
  if (!contentType) return request.method;
  if (contentType.includes("application/json")) return "json";
  if (contentType.includes("text/html")) return "html";
  if (contentType.includes("text/")) return "text";
  return contentType.split(";")[0]?.split("/").pop() ?? request.method;
}

function formatSize(request: NonNullable<EventRow["networkRequests"]>[number]): string {
  const bytes = byteLength(request.responseBody) + byteLength(request.requestBody) + byteLength(request.error);
  if (bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function byteLength(value?: string | null): number {
  return value ? new Blob([value]).size : 0;
}

function HeaderRows({ headers }: { headers?: Record<string, string> | null }) {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0) return <div className="network-detail-row"><span className="small-note" style={{ marginTop: 0 }}>-</span><span>-</span></div>;

  return entries.map(([key, value]) => (
    <div className="network-detail-row" key={key}>
      <span className="small-note" style={{ marginTop: 0 }}>{key}</span>
      <span className="mono">{value}</span>
    </div>
  ));
}

function jsonPretty(value: unknown): string {
  if (!value) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toInspectableValue(raw: string): unknown {
  if (!raw) return "-";
  const trimmed = raw.trim();
  if (!trimmed) return "-";
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

function JsonInspector({ value }: { value: unknown }) {
  if (value == null) return <pre>-</pre>;
  if (typeof value === "string") return <pre>{value}</pre>;
  if (typeof value !== "object") return <pre>{String(value)}</pre>;
  return (
    <div className="json-tree">
      <JsonNode name={Array.isArray(value) ? "[root]" : "{root}"} value={value} level={0} defaultOpen />
    </div>
  );
}

function JsonNode({
  name,
  value,
  level,
  defaultOpen = false
}: {
  name: string;
  value: unknown;
  level: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isObject = typeof value === "object" && value !== null;

  if (!isObject) {
    return (
      <div className="json-row" style={{ paddingLeft: level * 14 }}>
        <span className="json-key">{name}</span>
        <span className="json-sep">: </span>
        <span className="json-value">{formatPrimitive(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, idx) => [String(idx), item] as const)
    : Object.entries(value as Record<string, unknown>);

  const bracketOpen = Array.isArray(value) ? "[" : "{";
  const bracketClose = Array.isArray(value) ? "]" : "}";

  return (
    <div>
      <div className="json-row" style={{ paddingLeft: level * 14 }}>
        <button type="button" className="json-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "▾" : "▸"}
        </button>
        <span className="json-key">{name}</span>
        <span className="json-sep">: </span>
        <span className="json-bracket">{bracketOpen}</span>
        {!open && <span className="json-collapsed">… {entries.length} items</span>}
        {!open && <span className="json-bracket">{bracketClose}</span>}
      </div>
      {open && entries.map(([k, v]) => <JsonNode key={`${name}-${k}`} name={k} value={v} level={level + 1} />)}
      {open && (
        <div className="json-row" style={{ paddingLeft: level * 14 }}>
          <span className="json-bracket">{bracketClose}</span>
        </div>
      )}
    </div>
  );
}

function formatPrimitive(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return String(value);
}
