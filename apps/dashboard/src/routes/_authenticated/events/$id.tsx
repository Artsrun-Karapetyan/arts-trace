import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { EventBreadcrumbs } from "@/components/events/EventBreadcrumbs";
import { EventReplayControls } from "@/components/events/EventReplayControls";
import { EventReplayer } from "@/components/events/EventReplayer";
import { NetworkInspector } from "@/components/events/NetworkInspector";
import { SourceLocation } from "@/components/SourceLocation";
import { prepareReplayEvents } from "@/helpers/replay";
import { fetchEvent, fmt } from "@/lib";

export const Route = createFileRoute("/_authenticated/events/$id")({
  loader: ({ params }) => fetchEvent(params.id),
  component: EventDetailPage,
});

function EventDetailPage() {
  const event = Route.useLoaderData();
  const { t } = useTranslation();
  const [currentReplayMs, setCurrentReplayMs] = useState<number>(0);
  const [totalReplayMs, setTotalReplayMs] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [isReplayFullscreen, setIsReplayFullscreen] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const rawReplayEvents = (event.replays?.[0]?.events ?? []) as Array<
    Record<string, unknown>
  >;
  const replayEvents = useMemo(
    () => prepareReplayEvents(rawReplayEvents),
    [rawReplayEvents],
  );
  const replayUnavailableReason =
    rawReplayEvents.length > 0 && replayEvents.length === 0
      ? "Replay is missing its full snapshot. Capture a new event with the updated SDK."
      : null;

  const replayStartTs = useMemo(() => {
    const first = replayEvents.find(
      (item) => typeof item.timestamp === "number",
    );
    return typeof first?.timestamp === "number" ? first.timestamp : null;
  }, [replayEvents]);

  const networkRows = event.networkRequests ?? [];
  const replayNowTs =
    replayStartTs != null ? replayStartTs + currentReplayMs : null;
  const breadcrumbs = event.breadcrumbs ?? [];

  return (
    <div>
      <div className="page-head">
        <h2>{t("events.detail")}</h2>
      </div>
      <div className="card">
        {/* Error message banner */}
        <div className="event-error-banner">
          <div className="event-error-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">{t("common.source")}</div>
              <div className="event-info-value">
                <SourceLocation
                  fileName={event.fileName}
                  line={event.line}
                  column={event.column}
                  stack={event.stack}
                />
              </div>
            </div>
          </div>

          <div className="event-info-item">
            <div className="event-info-icon">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">Affected user</div>
              <div className="event-info-value">
                {event.userName ?? event.userId ?? "-"}
                {event.userRole ? (
                  <span className="chip chip-mid event-user-role">
                    {event.userRole}
                  </span>
                ) : null}
              </div>
              {event.userName && event.userId ? (
                <div className="mono small-note event-user-id">
                  {event.userId}
                </div>
              ) : null}
            </div>
          </div>

          <div className="event-info-item">
            <div className="event-info-icon">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="event-info-content">
              <div className="event-info-label">{t("common.created")}</div>
              <div className="event-info-value mono">
                {fmt(event.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <hr className="section-sep" />

        <div className="event-stack-head">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <strong>Source context</strong>
            </div>
            <div className="source-context">
              <div className="source-context-title mono">
                {event.sourceContext.fileName}:{event.sourceContext.line}:
                {event.sourceContext.column}
              </div>
              <div className="source-context-code">
                {event.sourceContext.lines.map((line) => (
                  <div
                    className={`source-context-line ${line.highlight ? "source-context-line-active" : ""}`}
                    key={line.number}
                  >
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
          {rawReplayEvents.length > 0 ? (
            <div
              className={`panel replay-panel ${isReplayFullscreen ? "replay-panel-fullscreen" : ""}`}
            >
              {(replayUnavailableReason || playerError) && (
                <div
                  className="empty-state"
                  style={{ padding: "32px 20px", color: "var(--red-500)" }}
                >
                  <h4>
                    {replayUnavailableReason
                      ? "Replay unavailable"
                      : "Player Error"}
                  </h4>
                  <p>{replayUnavailableReason ?? playerError}</p>
                </div>
              )}
              {!replayUnavailableReason && (
                <EventReplayer
                  replayEvents={replayEvents}
                  isReplayFullscreen={isReplayFullscreen}
                  onTimeUpdate={(current, total) => {
                    setCurrentReplayMs(current);
                    setTotalReplayMs(total);
                  }}
                  onPlayingChange={setIsReplayPlaying}
                  isReplayPlaying={isReplayPlaying}
                  playerError={playerError}
                  setPlayerError={setPlayerError}
                />
              )}
              {!replayUnavailableReason && !playerError ? (
                <EventReplayControls
                  isReplayPlaying={isReplayPlaying}
                  onToggleReplay={() => setIsReplayPlaying(!isReplayPlaying)}
                  currentReplayMs={currentReplayMs}
                  totalReplayMs={totalReplayMs}
                  isReplayFullscreen={isReplayFullscreen}
                  onToggleFullscreen={() =>
                    setIsReplayFullscreen(!isReplayFullscreen)
                  }
                />
              ) : null}
            </div>
          ) : (
            <div className="panel">
              <div className="empty-state" style={{ padding: "32px 20px" }}>
                <div className="empty-state-icon">🎬</div>
                <div className="empty-state-text">
                  Replay not captured for this event
                </div>
              </div>
            </div>
          )}

          <NetworkInspector
            networkRows={networkRows}
            replayNowTs={replayNowTs}
            eventCreatedAt={event.createdAt}
          />
        </div>

        <hr className="section-sep" />

        <EventBreadcrumbs breadcrumbs={breadcrumbs} />
      </div>
    </div>
  );
}
