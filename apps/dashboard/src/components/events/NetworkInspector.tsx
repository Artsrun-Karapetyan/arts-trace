import { useMemo, useState } from "react";

import { JsonInspector } from "@/components/ui/JsonInspector";
import { toInspectableValue } from "@/helpers/format";
import {
  formatSize,
  formatStatus,
  getRequestName,
  getRequestType,
  isNetworkError,
} from "@/helpers/network";
import type { EventRow } from "@/lib";

import { HeaderRows } from "./HeaderRows";

interface NetworkInspectorProps {
  networkRows: NonNullable<EventRow["networkRequests"]>;
  replayNowTs: number | null;
  eventCreatedAt: string;
}

export function NetworkInspector({
  networkRows,
  replayNowTs,
  eventCreatedAt,
}: NetworkInspectorProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [isNetworkPinned, setIsNetworkPinned] = useState(false);
  const [showFutureRequests, setShowFutureRequests] = useState(false);
  const [networkTab, setNetworkTab] = useState<
    "headers" | "payload" | "preview"
  >("headers");

  const visibleNetworkRows = useMemo(() => {
    if (showFutureRequests || replayNowTs == null) return networkRows;
    return networkRows.filter(
      (item: NonNullable<EventRow["networkRequests"]>[number]) =>
        new Date(item.createdAt).getTime() <= replayNowTs + 250,
    );
  }, [networkRows, replayNowTs, showFutureRequests]);

  const syncedRequestId = useMemo(() => {
    if (replayNowTs == null || visibleNetworkRows.length === 0) return null;
    const nearest = visibleNetworkRows.reduce<{
      id: string;
      distance: number;
    } | null>(
      (best, item: NonNullable<EventRow["networkRequests"]>[number]) => {
        const distance = Math.abs(
          new Date(item.createdAt).getTime() - replayNowTs,
        );
        if (distance > 1200) return best;
        if (!best || distance < best.distance) return { id: item.id, distance };
        return best;
      },
      null,
    );
    return nearest?.id ?? null;
  }, [replayNowTs, visibleNetworkRows]);

  const selectedRequest =
    visibleNetworkRows.find(
      (item: NonNullable<EventRow["networkRequests"]>[number]) =>
        item.id === (isNetworkPinned ? selectedRequestId : syncedRequestId),
    ) ??
    visibleNetworkRows[0] ??
    null;

  return (
    <div className="panel network-inspector">
      <div className="network-inspector-head">
        <strong>Network</strong>
        <div className="network-head-right">
          <span className="mono small-note" style={{ marginTop: 0 }}>
            {visibleNetworkRows.length}/{networkRows.length} requests
          </span>
          {isNetworkPinned ? (
            <button
              className="btn btn-ghost network-toggle"
              type="button"
              onClick={() => setIsNetworkPinned(false)}
            >
              Follow replay
            </button>
          ) : null}
          <button
            className="btn btn-ghost network-toggle"
            type="button"
            onClick={() => setShowFutureRequests((v) => !v)}
          >
            {showFutureRequests ? "Replay-synced" : "Show all"}
          </button>
        </div>
      </div>
      <div className="network-table">
        <div className="network-table-head">
          <span>Name</span>
          <span>Status</span>
          <span>Type</span>
          <span>Size</span>
          <span>Time</span>
        </div>
        {visibleNetworkRows.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 16px" }}>
            <div className="empty-state-icon" style={{ fontSize: 24 }}>
              -
            </div>
            <div className="empty-state-text">No captured requests</div>
          </div>
        ) : (
          visibleNetworkRows.map(
            (n: NonNullable<EventRow["networkRequests"]>[number]) => {
              const createdTs = new Date(n.createdAt).getTime();
              const toErrorMs = createdTs - new Date(eventCreatedAt).getTime();
              const nearReplayNow =
                replayNowTs != null
                  ? Math.abs(createdTs - replayNowTs) <= 1200
                  : false;
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
                    <span
                      className={`network-request-dot ${hasNetworkError ? "network-request-dot-error" : ""}`}
                    />
                    {getRequestName(n.url)}
                  </span>
                  <span
                    className={`network-status mono ${hasNetworkError ? "network-status-error" : ""}`}
                  >
                    {formatStatus(n)}
                  </span>
                  <span className="network-cell mono">{getRequestType(n)}</span>
                  <span className="network-cell mono">{formatSize(n)}</span>
                  <span
                    className="network-cell mono"
                    title={`${toErrorMs >= 0 ? "+" : ""}${(toErrorMs / 1000).toFixed(1)}s from error`}
                  >
                    {n.duration ?? "-"}ms
                  </span>
                </button>
              );
            },
          )
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
                <span className="small-note" style={{ marginTop: 0 }}>
                  Request URL
                </span>
                <span className="mono">{selectedRequest.url}</span>
              </div>
              <div className="network-detail-row">
                <span className="small-note" style={{ marginTop: 0 }}>
                  Request Method
                </span>
                <span>{selectedRequest.method}</span>
              </div>
              <div className="network-detail-row">
                <span className="small-note" style={{ marginTop: 0 }}>
                  Status Code
                </span>
                <span
                  className={
                    isNetworkError(selectedRequest)
                      ? "network-status-error"
                      : ""
                  }
                >
                  {selectedRequest.status ?? "Failed"}
                </span>
              </div>
              <div className="network-detail-row">
                <span className="small-note" style={{ marginTop: 0 }}>
                  Duration
                </span>
                <span>{selectedRequest.duration ?? "-"} ms</span>
              </div>
              {selectedRequest.error ? (
                <div className="network-detail-row">
                  <span className="small-note" style={{ marginTop: 0 }}>
                    Error
                  </span>
                  <span className="network-status-error">
                    {selectedRequest.error}
                  </span>
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
                <p>
                  <strong>Request Payload</strong>
                </p>
                <JsonInspector
                  value={toInspectableValue(selectedRequest.requestBody || "-")}
                />
              </div>
            </div>
          ) : null}

          {networkTab === "preview" ? (
            <div className="network-raw-grid">
              <div>
                <p>
                  <strong>Response Preview</strong>
                </p>
                <JsonInspector
                  value={toInspectableValue(
                    selectedRequest.responseBody ||
                      selectedRequest.error ||
                      "-",
                  )}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
