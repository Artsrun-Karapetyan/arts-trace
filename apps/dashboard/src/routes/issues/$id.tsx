import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { fetchIssue, fetchIssueEvents, fmt } from "../../lib";

export const Route = createFileRoute("/issues/$id")({
  loader: async ({ params }) => {
    const [issue, events] = await Promise.all([
      fetchIssue(params.id),
      fetchIssueEvents(params.id)
    ]);

    return { issue, events };
  },
  component: IssueDetailPage
});

function IssueDetailPage() {
  const { issue, events } = Route.useLoaderData();
  const { t } = useTranslation();

  return (
    <div>
      <div className="page-head">
        <h2>{t("issues.detail")}</h2>
      </div>
      <div className="card">
        <div className="meta-grid">
          <p><strong>{t("common.message")}:</strong> {issue.message}</p>
          <p><strong>{t("common.count")}:</strong> {issue.count}</p>
          <p><strong>{t("common.firstSeen")}:</strong> <span className="mono">{fmt(issue.firstSeen)}</span></p>
          <p><strong>{t("common.lastSeen")}:</strong> <span className="mono">{fmt(issue.lastSeen)}</span></p>
        </div>
      </div>

      <hr className="section-sep" />

      <div className="page-head" style={{ marginTop: 0 }}>
        <h2>{t("issues.latestEvents")}</h2>
      </div>
      <div className="panel">
        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-text">No events recorded for this issue yet.</div>
          </div>
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
                <tr key={event.id}>
                  <td>
                    <Link className="link-strong" to="/events/$id" params={{ id: event.id }} search={{ pid: issue.projectId }}>
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
        )}
      </div>
    </div>
  );
}
