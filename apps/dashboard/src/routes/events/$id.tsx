import { createFileRoute } from "@tanstack/react-router";
import { fetchEvent, fmt } from "../../lib";

export const Route = createFileRoute("/events/$id")({
  loader: ({ params }) => fetchEvent(params.id),
  component: EventDetailPage
});

function EventDetailPage() {
  const event = Route.useLoaderData();

  return (
    <div>
      <h2>Event Detail</h2>
      <div className="card">
        <p><strong>Message:</strong> {event.message}</p>
        <p><strong>URL:</strong> {event.url}</p>
        <p><strong>User Agent:</strong> {event.userAgent ?? "-"}</p>
        <p><strong>Created:</strong> {fmt(event.createdAt)}</p>
        <p><strong>Stack:</strong></p>
        <pre>{event.stack ?? "No stack trace"}</pre>
      </div>
    </div>
  );
}
