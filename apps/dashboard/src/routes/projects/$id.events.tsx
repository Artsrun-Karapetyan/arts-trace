import { Link, createFileRoute } from "@tanstack/react-router";
import { fetchProjectEvents, fmt } from "../../lib";

export const Route = createFileRoute("/projects/$id/events")({
  loader: ({ params }) => fetchProjectEvents(params.id),
  component: ProjectEventsPage
});

function ProjectEventsPage() {
  const events = Route.useLoaderData();

  return (
    <div>
      <h2>Events</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Message</th>
            <th>URL</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <Link to="/events/$id" params={{ id: event.id }}>
                  {event.message}
                </Link>
              </td>
              <td>{event.url}</td>
              <td>{fmt(event.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
