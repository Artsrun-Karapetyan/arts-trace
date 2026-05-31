import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchProjectIssues, fmt } from "../../lib";

export const Route = createFileRoute("/projects/$id/issues")({
  loader: ({ params }) => fetchProjectIssues(params.id),
  component: ProjectIssuesPage
});

function severityByCount(count: number): "high" | "mid" {
  return count >= 5 ? "high" : "mid";
}

type SeverityFilter = "all" | "high" | "mid";

function ProjectIssuesPage() {
  const issues = Route.useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const filteredIssues = useMemo(() => {
    if (filter === "all") return issues;
    return issues.filter((issue) => severityByCount(issue.count) === filter);
  }, [issues, filter]);

  const highCount = useMemo(() => issues.filter((i) => severityByCount(i.count) === "high").length, [issues]);
  const midCount = useMemo(() => issues.filter((i) => severityByCount(i.count) === "mid").length, [issues]);

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

      {issues.length > 0 ? (
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-btn ${filter === "all" ? "filter-btn-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
            <span className="filter-count">{issues.length}</span>
          </button>
          <button
            type="button"
            className={`filter-btn filter-btn-high ${filter === "high" ? "filter-btn-active" : ""}`}
            onClick={() => setFilter("high")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            High
            <span className="filter-count">{highCount}</span>
          </button>
          <button
            type="button"
            className={`filter-btn filter-btn-mid ${filter === "mid" ? "filter-btn-active" : ""}`}
            onClick={() => setFilter("mid")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Mid
            <span className="filter-count">{midCount}</span>
          </button>
        </div>
      ) : null}

      <div className="panel">
        {filteredIssues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{filter === "all" ? "🎉" : "🔍"}</div>
            <div className="empty-state-text">
              {filter === "all"
                ? "No issues found. Your app is running clean!"
                : `No ${filter.toUpperCase()} severity issues.`}
            </div>
          </div>
        ) : (
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
              {filteredIssues.map((issue) => {
                const severity = severityByCount(issue.count);
                return (
                  <tr
                    key={issue.id}
                    className="clickable-row"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      navigate({ to: "/issues/$id", params: { id: issue.id }, search: { pid: id } });
                    }}
                  >
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
        )}
      </div>
    </div>
  );
}
