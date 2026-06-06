import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_hybrid/")({
  beforeLoad: async ({ context }) => {
    throw redirect({
      to: (await context.auth.resolveUser()) ? "/projects" : "/login",
    });
  },
});
