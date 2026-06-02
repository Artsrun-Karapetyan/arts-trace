import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { fetchProjects, fmt, type ProjectRow } from "../../lib";

export const Route = createFileRoute("/projects/")({
  loader: fetchProjects,
  component: ProjectsPage
});

function ProjectsPage() {
  const initialProjects = Route.useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const projects = initialProjects;

  const totalErrors = projects.reduce((acc, item) => acc + item.totalErrors, 0);
  const totalToday = projects.reduce((acc, item) => acc + item.errorsToday, 0);

  return (
    <div>
      <div className="page-head" style={{ alignItems: "center" }}>
        <h2>{t("projects.title")}</h2>
        <div className="project-actions">
          <Link className="btn" to="/projects/create">
            Create project
          </Link>
        </div>
      </div>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
            Projects
          </div>
          <div className="kpi-value">{projects.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            Total Errors
          </div>
          <div className="kpi-value">{totalErrors}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            Errors Today
          </div>
          <div className="kpi-value">{totalToday}</div>
        </div>
      </section>

      {projects.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">No projects yet. Create one to get started.</div>
          </div>
        </div>
      ) : (
        <div className="project-card-list">
          {projects.map((project) => (
            <article
              key={project.id}
              className="project-card clickable-row"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a, button")) return;
                navigate({ to: "/projects/$id/issues", params: { id: project.id } });
              }}
            >
              <div className="project-card-head">
                <Link className="project-card-title" to="/projects/$id/issues" params={{ id: project.id }}>
                  {project.name}
                </Link>
                <span className="mono small-note">{fmt(project.createdAt)}</span>
              </div>

              <div className="project-card-metrics">
                <div>
                  <div className="small-note" style={{ marginTop: 0 }}>{t("projects.totalErrors")}</div>
                  <div className="project-card-value">{project.totalErrors}</div>
                </div>
                <div>
                  <div className="small-note" style={{ marginTop: 0 }}>{t("projects.errorsToday")}</div>
                  <div className="project-card-value">{project.errorsToday}</div>
                </div>
              </div>

              <div className="project-card-actions">
                <Link className="btn btn-ghost" to="/projects/$id/issues" params={{ id: project.id }}>
                  Issues
                </Link>
                <Link className="btn btn-ghost" to="/projects/$id/events" params={{ id: project.id }}>
                  Events
                </Link>
                <Link className="btn btn-ghost" to="/projects/$id/settings" params={{ id: project.id }}>
                  Settings
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
