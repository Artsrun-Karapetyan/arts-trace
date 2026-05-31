import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { fetchProjectIssues, fmt } from "../../lib";

export const Route = createFileRoute("/projects/$id/issues")({
  loader: ({ params }) => fetchProjectIssues(params.id),
  component: ProjectIssuesPage
});

function severityByCount(count: number): "high" | "mid" {
  return count >= 5 ? "high" : "mid";
}

function ProjectIssuesPage() {
  const issues = Route.useLoaderData();
  const { t } = useTranslation();
  const { id } = Route.useParams();

  return (
    <div>
      <div className="page-head">
        <h2>{t("issues.title")}</h2>
        <div className="project-actions">
          <Link className="btn btn-ghost" to="/projects/$id/events" params={{ id }}>
            Events
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
              <th>{t("common.count")}</th>
              <th>Severity</th>
              <th>{t("common.firstSeen")}</th>
              <th>{t("common.lastSeen")}</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => {
              const severity = severityByCount(issue.count);
              return (
                <tr key={issue.id}>
                  <td>
                    <Link className="link-strong" to="/issues/$id" params={{ id: issue.id }} search={{ pid: id }}>
                      {issue.message}
                    </Link>
                  </td>
                  <td>{issue.count}</td>
                  <td>
                    <span className={`chip ${severity === "high" ? "chip-high" : "chip-mid"}`}>
                      {severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="mono">{fmt(issue.firstSeen)}</td>
                  <td className="mono">{fmt(issue.lastSeen)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
