import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public")({
  beforeLoad: async ({ context }) => {
    if (await context.auth.resolveUser()) {
      throw redirect({ to: "/projects" });
    }
  },
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <main className="auth-shell">
      <Outlet />
    </main>
  );
}
