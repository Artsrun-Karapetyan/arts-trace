import { Link, createFileRoute } from "@tanstack/react-router";
import { fetchProjects, fmt } from "../../lib";

export const Route = createFileRoute("/projects/")({
  loader: fetchProjects,
  component: ProjectsPage
});

function ProjectsPage() {
  const projects = Route.useLoaderData();

  return (
    <div>
      <h2>Projects</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Total Errors</th>
            <th>Errors Today</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <Link to="/projects/$id/events" params={{ id: project.id }}>
                  {project.name}
                </Link>
              </td>
              <td>{project.totalErrors}</td>
              <td>{project.errorsToday}</td>
              <td>{fmt(project.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
