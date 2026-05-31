import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchEvent, fmt } from "../../lib";

export const Route = createFileRoute("/events/$id")({
  loader: ({ params }) => fetchEvent(params.id),
  component: EventDetailPage
});

function EventDetailPage() {
  const event = Route.useLoaderData();
  const { t } = useTranslation();
  const replayRef = useRef<HTMLDivElement | null>(null);
  const [currentReplayMs, setCurrentReplayMs] = useState<number>(0);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
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
  const selectedRequest = visibleNetworkRows.find((item) => item.id === selectedRequestId) ?? visibleNetworkRows[0] ?? null;
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
    if (!selectedRequestId && visibleNetworkRows.length > 0) {
      setSelectedRequestId(visibleNetworkRows[0].id);
      return;
    }
    if (selectedRequestId && !visibleNetworkRows.some((item) => item.id === selectedRequestId)) {
      setSelectedRequestId(visibleNetworkRows[0]?.id ?? null);
    }
  }, [selectedRequestId, visibleNetworkRows]);

  return (
    <div>
      <div className="page-head">
        <h2>{t("events.detail")}</h2>
      </div>
      <div className="card">
        <div className="meta-grid">
          <p><strong>{t("common.message")}:</strong> {event.message}</p>
          <p><strong>{t("common.source")}:</strong> <span className="mono">{event.fileName ? `${event.fileName}:${event.line ?? "?"}:${event.column ?? "?"}` : "-"}</span></p>
          <p><strong>{t("common.url")}:</strong> <span className="mono">{event.url}</span></p>
          <p><strong>{t("events.userAgent")}:</strong> {event.userAgent ?? "-"}</p>
          <p><strong>{t("common.created")}:</strong> <span className="mono">{fmt(event.createdAt)}</span></p>
        </div>

        <p style={{ marginBottom: 6 }}><strong>{t("events.stack")}:</strong></p>
        <pre>{event.stack ?? t("common.noStack")}</pre>

        <div className="page-head" style={{ marginTop: 16, marginBottom: 8 }}>
          <h2 style={{ fontSize: 18 }}>Replay + Network</h2>
        </div>
        <div className="event-grid">
          {replayEvents.length > 0 ? (
            <div className="panel replay-panel">
              <div ref={replayRef} className="replay-container" />
            </div>
          ) : (
            <div className="panel empty-panel">Replay not captured for this event</div>
          )}

          <div className="panel network-inspector">
            <div className="network-inspector-head">
              <strong>Network Timeline</strong>
              <div className="network-head-right">
                <span className="mono small-note">{visibleNetworkRows.length}/{networkRows.length} requests</span>
                <button className="btn btn-ghost network-toggle" type="button" onClick={() => setShowFutureRequests((v) => !v)}>
                  {showFutureRequests ? "Replay-synced" : "Show all"}
                </button>
              </div>
            </div>
            <div className="network-list">
              {visibleNetworkRows.length === 0 ? (
                <div className="empty-panel">No captured requests for this event</div>
              ) : (
                visibleNetworkRows.map((n) => {
                  const createdTs = new Date(n.createdAt).getTime();
                  const toErrorMs = createdTs - new Date(event.createdAt).getTime();
                  const nearReplayNow = replayNowTs != null ? Math.abs(createdTs - replayNowTs) <= 1200 : false;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={`network-item ${selectedRequest?.id === n.id ? "network-item-active" : ""} ${nearReplayNow ? "network-item-live" : ""}`}
                      onClick={() => setSelectedRequestId(n.id)}
                    >
                      <span className="network-method">{n.method}</span>
                      <span className="network-url mono">{n.url}</span>
                      <span className="network-meta mono">
                        {n.status ?? "-"} · {n.duration ?? "-"}ms · {toErrorMs >= 0 ? "+" : ""}{(toErrorMs / 1000).toFixed(1)}s
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
                    <div className="network-detail-row">
                      <span className="small-note">Request URL</span>
                      <span className="mono">{selectedRequest.url}</span>
                    </div>
                    <div className="network-detail-row">
                      <span className="small-note">Request Method</span>
                      <span>{selectedRequest.method}</span>
                    </div>
                    <div className="network-detail-row">
                      <span className="small-note">Status Code</span>
                      <span>{selectedRequest.status ?? "-"}</span>
                    </div>
                    <div className="network-detail-row">
                      <span className="small-note">Duration</span>
                      <span>{selectedRequest.duration ?? "-"} ms</span>
                    </div>
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

        <div className="page-head" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18 }}>Breadcrumbs</h2>
          {breadcrumbs.length > breadcrumbLimit ? (
            <button className="btn btn-ghost" onClick={() => setShowAllBreadcrumbs((v) => !v)}>
              {showAllBreadcrumbs ? "Show less" : `Show more (${breadcrumbs.length - breadcrumbLimit})`}
            </button>
          ) : null}
        </div>
        <div className="panel">
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
        </div>

      </div>
    </div>
  );
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
