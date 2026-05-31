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

      <div className="card card-flow" style={{ marginBottom: 14 }}>
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
        {createError ? <p className="small-note" style={{ color: "#ef5b6a" }}>{createError}</p> : null}
        {lastCreated ? (
          <div style={{ marginTop: 10 }}>
            <div className="section-title">2. Copy Credentials</div>
            <p className="small-note">
              Created: <strong>{lastCreated.name}</strong> | API key: <code className="mono">{lastCreated.apiKey}</code>
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn btn-ghost" onClick={copyKey}>
                {copied === "key" ? "Copied" : "Copy API Key"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={copySnippet}
              >
                {copied === "snippet" ? "Copied" : "Copy SDK Snippet"}
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
          <div className="kpi-label">Projects</div>
          <div className="kpi-value">{projects.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Errors</div>
          <div className="kpi-value">{totalErrors}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Errors Today</div>
          <div className="kpi-value">{totalToday}</div>
        </div>
      </section>

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
                <div className="small-note">{t("projects.totalErrors")}</div>
                <div className="project-card-value">{project.totalErrors}</div>
              </div>
              <div>
                <div className="small-note">{t("projects.errorsToday")}</div>
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
    </div>
  );
}
