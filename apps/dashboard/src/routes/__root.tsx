import { Link, Outlet, createRootRoute, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { clearAuthToken, fetchMe, getAuthToken, logout as logoutRequest } from "../lib";
import { useTranslation } from "react-i18next";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const token = getAuthToken();
    const isAuthRoute = location.pathname.startsWith("/login") || location.pathname.startsWith("/register");

    if (isAuthRoute) {
      if (!token) return;
      try {
        await fetchMe();
        throw redirect({ to: "/projects" });
      } catch {
        clearAuthToken();
        return;
      }
    }

    if (!token) {
      throw redirect({ to: "/login" });
    }

    try {
      await fetchMe();
    } catch {
      clearAuthToken();
      throw redirect({ to: "/login" });
    }
  },
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
  const currentLang = i18n.language;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

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

  async function onLogout() {
    try {
      await logoutRequest();
    } catch {
      // no-op
    } finally {
      clearAuthToken();
      await navigate({ to: "/login" });
    }
  }

  if (isAuthRoute) {
    return (
      <main className="auth-shell">
        <Outlet />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand brand-sidebar">
          <h1>ArtsTrace</h1>
          <span className="badge">v0.2</span>
          <span className="badge badge-new">NEW UI</span>
        </div>

        <nav className="side-nav">
          <Link className={`nav-link ${pathname.startsWith("/projects") ? "nav-link-active" : ""}`} to="/projects">
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            {t("nav.projects")}
          </Link>
          {inProject ? (
            <div className="side-project">
              <div className="small-note" style={{ marginTop: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Project Context</div>
              <Link
                className={`nav-link ${pathname.includes("/issues") ? "nav-link-active" : ""}`}
                to="/projects/$id/issues"
                params={{ id: currentProjectId }}
              >
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Issues
              </Link>
              <Link
                className={`nav-link ${pathname.includes("/events") ? "nav-link-active" : ""}`}
                to="/projects/$id/events"
                params={{ id: currentProjectId }}
              >
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Events
              </Link>
              <Link
                className={`nav-link ${pathname.includes("/settings") ? "nav-link-active" : ""}`}
                to="/projects/$id/settings"
                params={{ id: currentProjectId }}
              >
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="side-footer">
          <div className="lang-switch">
            <button className={currentLang === "en" ? "lang-active" : ""} onClick={() => setLanguage("en")}>EN</button>
            <button className={currentLang === "hy" ? "lang-active" : ""} onClick={() => setLanguage("hy")}>HY</button>
          </div>
          <button className="btn btn-ghost side-logout" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <section className="content-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button className="btn btn-ghost back-btn" onClick={goBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </section>
    </main>
  );
}
