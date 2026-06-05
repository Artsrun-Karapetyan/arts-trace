import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";

import { ProjectSetupCard } from "@/components/ProjectSetupCard";
import { createProject } from "@/lib";

export const Route = createFileRoute("/_authenticated/projects/create")({
  component: CreateProjectPage,
});

function CreateProjectPage() {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{
    id: string;
    name: string;
    apiKey: string;
  } | null>(null);

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
      setLastCreated(project);
      setName("");
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create project",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-head" style={{ alignItems: "center" }}>
        <div>
          <h2>Create project</h2>
          <p className="small-note" style={{ margin: "6px 0 0" }}>
            Create a project, then copy the setup below.
          </p>
        </div>
        <div className="project-actions">
          <Link className="btn btn-ghost" to="/projects">
            Back to projects
          </Link>
        </div>
      </div>

      <div className="create-project-stack">
        <div className="card card-flow create-project-card">
          <div className="section-title">Project details</div>
          <form className="create-project-form" onSubmit={onCreateProject}>
            <input
              className="input create-project-input"
              placeholder="Project name (e.g. Bankruptcy Web)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Project name"
            />
            <button
              className="btn create-project-btn"
              type="submit"
              disabled={creating}
            >
              {creating ? "Creating..." : "Create project"}
            </button>
          </form>

          {createError ? (
            <p className="small-note create-project-error">{createError}</p>
          ) : null}
        </div>

        {lastCreated ? (
          <ProjectSetupCard
            projectId={lastCreated.id}
            projectName={lastCreated.name}
            apiKey={lastCreated.apiKey}
          />
        ) : null}
      </div>
    </div>
  );
}
