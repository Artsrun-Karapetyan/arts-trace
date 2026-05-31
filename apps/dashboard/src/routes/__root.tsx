import { Link, Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createRootRoute({
  component: RootLayout
});

function RootLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const pidFromSearch = new URLSearchParams(search).get("pid");
  const currentProjectId = match?.[1] ?? pidFromSearch ?? null;

  const inProject = currentProjectId !== null;

  function setLanguage(lang: "en" | "hy") {
    void i18n.changeLanguage(lang);
    localStorage.setItem("artstrace_lang", lang);
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/projects" });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand brand-sidebar">
          <h1>ArtsTrace</h1>
          <span className="badge">v0.2</span>
          <span className="badge badge-new">ARTSTRACE NEW UI</span>
        </div>

        <nav className="side-nav">
          <Link className={`nav-link ${pathname.startsWith("/projects") ? "nav-link-active" : ""}`} to="/projects">
            {t("nav.projects")}
          </Link>
          {inProject ? (
            <div className="side-project">
              <div className="small-note">In Project</div>
              <Link
                className={`nav-link ${pathname.includes("/issues") ? "nav-link-active" : ""}`}
                to="/projects/$id/issues"
                params={{ id: currentProjectId }}
              >
                Issues
              </Link>
              <Link
                className={`nav-link ${pathname.includes("/events") ? "nav-link-active" : ""}`}
                to="/projects/$id/events"
                params={{ id: currentProjectId }}
              >
                Events
              </Link>
              <Link
                className={`nav-link ${pathname.includes("/settings") ? "nav-link-active" : ""}`}
                to="/projects/$id/settings"
                params={{ id: currentProjectId }}
              >
                Settings
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="side-footer">
          <div className="lang-switch">
            <button onClick={() => setLanguage("en")}>EN</button>
            <button onClick={() => setLanguage("hy")}>HY</button>
          </div>
        </div>
      </aside>

      <section className="content-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button className="btn btn-ghost back-btn" onClick={goBack}>
              ← Back
            </button>
            <div className="page-head" style={{ margin: 0 }}>
              <h2>Dashboard</h2>
            </div>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </section>
    </main>
  );
}
