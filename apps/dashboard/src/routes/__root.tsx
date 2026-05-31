import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createRootRoute({
  component: RootLayout
});

function RootLayout() {
  const { t, i18n } = useTranslation();

  function setLanguage(lang: "en" | "hy") {
    void i18n.changeLanguage(lang);
    localStorage.setItem("artstrace_lang", lang);
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
          <Link className="nav-link" to="/projects">{t("nav.projects")}</Link>
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
          <div className="page-head" style={{ margin: 0 }}>
            <h2>Dashboard</h2>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </section>
    </main>
  );
}
