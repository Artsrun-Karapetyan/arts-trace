import { Link, createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { createProject, fetchProjects, fmt, type ProjectRow } from "../../lib";

export const Route = createFileRoute("/projects/")({
  loader: fetchProjects,
  component: ProjectsPage
});

function ProjectsPage() {
  const initialProjects = Route.useLoaderData();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<ProjectRow | null>(null);
  const [copied, setCopied] = useState<"key" | "snippet" | null>(null);

  const totalErrors = projects.reduce((acc, item) => acc + item.totalErrors, 0);
  const totalToday = projects.reduce((acc, item) => acc + item.errorsToday, 0);

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setCreateError("Project name must be at least 2 characters.");
      return;
    }

    try {
      setCreating(true);
      const project = await createProject({ name: trimmed });
      setProjects((prev) => [project, ...prev]);
      setLastCreated(project);
      setName("");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  }

  async function copyKey() {
    if (!lastCreated) return;
    await copy(lastCreated.apiKey);
    setCopied("key");
    setTimeout(() => setCopied(null), 1200);
  }

  async function copySnippet() {
    if (!lastCreated) return;
    await copy(`import { init } from "@artstrace/browser";\n\ninit({\n  apiKey: "${lastCreated.apiKey}",\n  endpoint: "http://localhost:3100/events"\n});`);
    setCopied("snippet");
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <div>
      <div className="page-head">
        <h2>{t("projects.title")}</h2>
      </div>

      <div className="card card-flow" style={{ marginBottom: 16 }}>
        <div className="section-title">1. Create Project</div>
        <form onSubmit={onCreateProject} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            placeholder="Project name (e.g. Bankruptcy Web)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Project"}
          </button>
        </form>
        {createError ? <p className="small-note" style={{ color: "#f87171" }}>{createError}</p> : null}
        {lastCreated ? (
          <div style={{ marginTop: 12 }}>
            <div className="section-title">2. Copy Credentials</div>
            <p className="small-note" style={{ marginTop: 0 }}>
              Created: <strong>{lastCreated.name}</strong> | API key: <code className="mono">{lastCreated.apiKey}</code>
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className="btn btn-ghost" onClick={copyKey}>
                {copied === "key" ? "✓ Copied" : "Copy API Key"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={copySnippet}
              >
                {copied === "snippet" ? "✓ Copied" : "Copy SDK Snippet"}
              </button>
            </div>
            <div className="section-title">3. Paste Into Your App</div>
            <pre>{`import { init } from "@artstrace/browser";

init({
  apiKey: "${lastCreated.apiKey}",
  endpoint: "http://localhost:3100/events"
});`}</pre>
            <p className="small-note">
              Then trigger a frontend error in your app and open this dashboard.
            </p>
          </div>
        ) : null}
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
            <div className="empty-state-text">No projects yet. Create one above to get started.</div>
          </div>
        </div>
      ) : (
        <div className="project-card-list">
          {projects.map((project) => (
            <article key={project.id} className="project-card">
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
