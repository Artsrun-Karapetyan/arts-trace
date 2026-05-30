import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <main className="app-shell">
      <header className="topbar">
        <h1>ArtsTrace</h1>
        <Link to="/projects">Projects</Link>
        <Link to="/test">Test SDK</Link>
      </header>
      <section className="content">
        <Outlet />
      </section>
    </main>
  )
});
