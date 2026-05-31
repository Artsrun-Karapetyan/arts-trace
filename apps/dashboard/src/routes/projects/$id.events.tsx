import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { fetchProjectEvents, fmt } from "../../lib";

export const Route = createFileRoute("/projects/$id/events")({
  loader: ({ params }) => fetchProjectEvents(params.id),
  component: ProjectEventsPage
});

function ProjectEventsPage() {
  const events = Route.useLoaderData();
  const { t } = useTranslation();
  const { id } = Route.useParams();

  return (
    <div>
      <div className="page-head">
        <h2>{t("events.title")}</h2>
        <div className="project-actions">
          <Link className="btn btn-ghost" to="/projects/$id/issues" params={{ id }}>
            Issues
          </Link>
          <Link className="icon-btn" to="/projects/$id/settings" params={{ id }} aria-label="Project settings">
            ⚙
          </Link>
        </div>
      </div>
      <div className="panel">
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
              <tr key={event.id}>
                <td>
                  <Link className="link-strong" to="/events/$id" params={{ id: event.id }} search={{ pid: id }}>
                    {event.message}
                  </Link>
                </td>
                <td className="mono">{event.fileName ? `${event.fileName}:${event.line ?? "?"}:${event.column ?? "?"}` : "-"}</td>
                <td className="mono">{event.url}</td>
                <td className="mono">{fmt(event.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
