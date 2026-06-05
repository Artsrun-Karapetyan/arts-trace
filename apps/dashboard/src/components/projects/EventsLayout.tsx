import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SourceLocation } from "@/components/SourceLocation";
import { EmptyState } from "@/components/ui/EmptyState";
import { type EventRow, fmt } from "@/lib";

interface EventsLayoutProps {
  events: EventRow[];
  projectId: string;
}

export function EventsLayout({ events, projectId }: EventsLayoutProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div>
      <div className="page-head">
        <h2>{t("events.title")}</h2>
        <div className="project-actions">
          <Link
            className="btn btn-ghost"
            to="/projects/$id/issues"
            params={{ id: projectId }}
          >
            Issues
          </Link>
          <Link
            className="icon-btn"
            to="/projects/$id/settings"
            params={{ id: projectId }}
            aria-label="Project settings"
          >
            ⚙
          </Link>
        </div>
      </div>
      <div className="panel">
        {events.length === 0 ? (
          <EmptyState
            icon="📡"
            text="No events captured yet. Trigger an error in your app to see it here."
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.message")}</th>
                <th>{t("common.source")}</th>
                <th>{t("common.url")}</th>
                <th>{t("common.created")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="clickable-row"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, button")) return;
                    navigate({
                      to: "/events/$id",
                      params: { id: event.id },
                      search: { pid: projectId },
                    });
                  }}
                >
                  <td>
                    <Link
                      className="link-strong"
                      to="/events/$id"
                      params={{ id: event.id }}
                      search={{ pid: projectId }}
                    >
                      {event.message}
                    </Link>
                  </td>
                  <td>
                    <SourceLocation
                      fileName={event.fileName}
                      line={event.line}
                      column={event.column}
                      stack={event.stack}
                    />
                  </td>
                  <td className="mono">{event.url}</td>
                  <td className="mono">{fmt(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
