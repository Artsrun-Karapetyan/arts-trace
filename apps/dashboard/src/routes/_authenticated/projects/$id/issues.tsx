import { createFileRoute } from "@tanstack/react-router";

import { IssuesLayout } from "@/components/projects/IssuesLayout";
import { fetchProjectIssues, fetchProjectMembers } from "@/lib";

export const Route = createFileRoute("/_authenticated/projects/$id/issues")({
  loader: async ({ params }) => {
    const [issues, members] = await Promise.all([
      fetchProjectIssues(params.id),
      fetchProjectMembers(params.id),
    ]);

    return { issues, members };
  },
  component: ProjectIssuesPage,
});

function ProjectIssuesPage() {
  const { issues: initialIssues, members } = Route.useLoaderData();
  const { id } = Route.useParams();

  return (
    <IssuesLayout
      initialIssues={initialIssues}
      members={members}
      projectId={id}
    />
  );
}
