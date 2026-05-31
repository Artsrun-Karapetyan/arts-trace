import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { deleteProject, fetchProject, rotateProjectKey } from "../../lib";

export const Route = createFileRoute("/projects/$id/settings")({
  loader: ({ params }) => fetchProject(params.id),
  component: ProjectSettingsPage
});

function ProjectSettingsPage() {
  const project = Route.useLoaderData();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState(project.apiKey);
  const [busy, setBusy] = useState<"rotate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "snippet" | null>(null);

  async function onRotate() {
    try {
      setBusy("rotate");
      setError(null);
      const updated = await rotateProjectKey(project.id);
      setApiKey(updated.apiKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rotate key");
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this project and all related issues/events?");
    if (!confirmed) return;

    try {
      setBusy("delete");
      setError(null);
      await deleteProject(project.id);
      await navigate({ to: "/projects" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
      setBusy(null);
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
    await copy(apiKey);
    setCopied("key");
    setTimeout(() => setCopied(null), 1200);
  }

  async function copySnippet() {
    await copy(snippet);
    setCopied("snippet");
    setTimeout(() => setCopied(null), 1200);
  }

  const snippet = `import { init } from "@artstrace/browser";

init({
  apiKey: "${apiKey}",
  endpoint: "http://localhost:3100/events"
});`;

  return (
    <div>
      <div className="page-head">
        <h2>Project Settings</h2>
        <div className="project-actions">
          <Link className="btn btn-ghost" to="/projects/$id/issues" params={{ id: project.id }}>
            Issues
          </Link>
          <Link className="btn btn-ghost" to="/projects/$id/events" params={{ id: project.id }}>
            Events
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">Project Identity</div>
        <div className="meta-grid">
          <p><strong>Name:</strong> {project.name}</p>
          <p><strong>Project ID:</strong> <code className="mono">{project.id}</code></p>
        </div>
        <p style={{ marginTop: 10 }}><strong>API Key:</strong> <code className="mono">{apiKey}</code></p>

        <hr className="section-sep" />

        <div className="section-title">Integration</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={copyKey}>
            {copied === "key" ? "✓ Copied" : "Copy API Key"}
          </button>
          <button className="btn btn-ghost" onClick={copySnippet}>
            {copied === "snippet" ? "✓ Copied" : "Copy SDK Snippet"}
          </button>
          <button className="btn" disabled={busy !== null} onClick={onRotate}>
            {busy === "rotate" ? "Rotating..." : "Rotate Key"}
          </button>
        </div>

        {error ? <p className="small-note" style={{ color: "#f87171" }}>{error}</p> : null}
      </div>

      <div className="card card-danger" style={{ marginBottom: 14 }}>
        <div className="section-title">⚠ Danger Zone</div>
        <p className="small-note" style={{ marginTop: 0, marginBottom: 12 }}>Deleting project removes all issues and events permanently.</p>
        <button className="btn btn-danger" disabled={busy !== null} onClick={onDelete}>
          {busy === "delete" ? "Deleting..." : "Delete Project"}
        </button>
      </div>

      <pre>{snippet}</pre>
    </div>
  );
}
