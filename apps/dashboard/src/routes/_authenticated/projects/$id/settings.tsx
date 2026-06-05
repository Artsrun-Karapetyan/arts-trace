import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ProjectSetupCard } from "@/components/ProjectSetupCard";
import { deleteProject, fetchProject, rotateProjectKey } from "@/lib";

export const Route = createFileRoute("/_authenticated/projects/$id/settings")({
  loader: ({ params }) => fetchProject(params.id),
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const project = Route.useLoaderData();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState(project.apiKey);
  const [busy, setBusy] = useState<"rotate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canManage = project.accessRole === "MAINTAINER";

  useEffect(() => {
    if (!deleteOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteOpen]);

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

  return (
    <div>
      <div className="page-head">
        <h2>Project Settings</h2>
        <div className="project-actions">
          <Link
            className="btn btn-ghost"
            to="/projects/$id/issues"
            params={{ id: project.id }}
          >
            Issues
          </Link>
          <Link
            className="btn btn-ghost"
            to="/projects/$id/events"
            params={{ id: project.id }}
          >
            Events
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">Project Identity</div>
        <div className="meta-grid">
          <p>
            <strong>Name:</strong> {project.name}
          </p>
          <p>
            <strong>Project ID:</strong>{" "}
            <code className="mono">{project.id}</code>
          </p>
          <p>
            <strong>Access:</strong>{" "}
            <span
              className={`project-role-pill project-role-${(project.accessRole ?? "MEMBER").toLowerCase()}`}
            >
              {project.accessRole ?? "Member"}
            </span>
          </p>
        </div>
        {error ? (
          <p className="small-note" style={{ color: "#f87171" }}>
            {error}
          </p>
        ) : null}
      </div>

      <ProjectSetupCard
        projectId={project.id}
        projectName={project.name}
        apiKey={apiKey}
        variant="settings"
        onRotate={onRotate}
        rotating={busy === "rotate"}
        disabled={!canManage}
      />

      {canManage ? (
        <div className="card card-danger" style={{ marginBottom: 14 }}>
          <div className="section-title">⚠ Danger Zone</div>
          <p className="small-note" style={{ marginTop: 0, marginBottom: 12 }}>
            Deleting project removes all issues and events permanently.
          </p>
          <button
            className="btn btn-danger"
            disabled={busy !== null}
            onClick={() => setDeleteOpen(true)}
          >
            {busy === "delete" ? "Deleting..." : "Delete Project"}
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title">Permissions</div>
          <p className="small-note" style={{ marginTop: 0, marginBottom: 0 }}>
            Your role is read-only for project settings.
          </p>
        </div>
      )}

      {deleteOpen ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && busy !== "delete") {
              setDeleteOpen(false);
            }
          }}
        >
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <div className="section-title">Confirm deletion</div>
                <h3 className="modal-title">Delete {project.name}?</h3>
              </div>
              <button
                className="icon-btn modal-close"
                type="button"
                onClick={() => busy !== "delete" && setDeleteOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="modal-copy">
              This removes the project, all issues, events, replays,
              breadcrumbs, and network data permanently.
            </p>

            <div className="modal-summary">
              <div>
                <div className="modal-summary-label">Project</div>
                <div className="modal-summary-value">{project.name}</div>
              </div>
              <div>
                <div className="modal-summary-label">Project ID</div>
                <code className="mono modal-summary-code">{project.id}</code>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={busy === "delete"}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={busy === "delete"}
                onClick={onDelete}
              >
                {busy === "delete" ? "Deleting..." : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
