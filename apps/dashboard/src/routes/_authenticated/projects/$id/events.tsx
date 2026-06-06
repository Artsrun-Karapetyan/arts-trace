import { createFileRoute } from "@tanstack/react-router";

import { EventsLayout } from "@/components/projects/EventsLayout";
import { fetchProjectEvents } from "@/lib";

export const Route = createFileRoute("/_authenticated/projects/$id/events")({
  loader: ({ params }) => fetchProjectEvents(params.id),
  component: ProjectEventsPage,
});

function ProjectEventsPage() {
  const events = Route.useLoaderData();
  const { id } = Route.useParams();

  return <EventsLayout events={events} projectId={id} />;
}
