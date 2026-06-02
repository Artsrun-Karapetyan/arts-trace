import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

type ProjectSetupCardProps = {
  projectId: string;
  projectName: string;
  apiKey: string;
  variant?: "create" | "settings";
  onRotate?: () => Promise<void> | void;
  rotating?: boolean;
};

export function ProjectSetupCard({
  projectId,
  projectName,
  apiKey,
  variant = "create",
  onRotate,
  rotating = false
}: ProjectSetupCardProps) {
  const [copied, setCopied] = useState<"key" | "snippet" | null>(null);

  const snippet = useMemo(
    () => `import { clearUser, init, setUser } from "@artstrace/browser";

init({
  apiKey: "${apiKey}",
  endpoint: "http://localhost:3100/events"
});

setUser({
  id: authenticatedUser.id,
  fullName: authenticatedUser.fullName,
  role: authenticatedUser.role
});

// Call on logout:
clearUser();`,
    [apiKey]
  );
  const snippetRows = useMemo(
    () => [
      [
        <span className="code-token code-keyword" key="k1">import</span>,
        " { ",
        <span className="code-token code-function" key="f0">clearUser</span>,
        ", ",
        <span className="code-token code-function" key="f1">init</span>,
        ", ",
        <span className="code-token code-function" key="f2">setUser</span>,
        " } ",
        <span className="code-token code-keyword" key="k2">from</span>,
        " ",
        <span className="code-token code-string" key="s1">"@artstrace/browser"</span>,
        ";"
      ],
      [],
      [
        <span className="code-token code-function" key="f3">init</span>,
        <span className="code-token code-punct" key="p1">{"("}</span>,
        <span className="code-token code-punct" key="p2">{"{"}</span>
      ],
      [
        "  ",
        <span className="code-token code-prop" key="p3">apiKey</span>,
        <span className="code-token code-punct" key="p4">:</span>,
        " ",
        <span className="code-token code-string" key="s2">`{apiKey}`</span>,
        <span className="code-token code-punct" key="p5">,</span>
      ],
      [
        "  ",
        <span className="code-token code-prop" key="p6">endpoint</span>,
        <span className="code-token code-punct" key="p7">:</span>,
        " ",
        <span className="code-token code-string" key="s3">"http://localhost:3100/events"</span>,
      ],
      [
        <span className="code-token code-punct" key="p8">{`});`}</span>
      ],
      [],
      [
        <span className="code-token code-function" key="f4">setUser</span>,
        <span className="code-token code-punct" key="p9">{"("}</span>,
        <span className="code-token code-punct" key="p10">{"{"}</span>
      ],
      [
        "  ",
        <span className="code-token code-prop" key="p11">id</span>,
        <span className="code-token code-punct" key="p12">:</span>,
        " authenticatedUser.id,"
      ],
      [
        "  ",
        <span className="code-token code-prop" key="p13">fullName</span>,
        <span className="code-token code-punct" key="p14">:</span>,
        " authenticatedUser.fullName,"
      ],
      [
        "  ",
        <span className="code-token code-prop" key="p15">role</span>,
        <span className="code-token code-punct" key="p16">:</span>,
        " authenticatedUser.role"
      ],
      [
        <span className="code-token code-punct" key="p17">{`});`}</span>
      ],
      [],
      [
        <span className="code-token code-function" key="f5">clearUser</span>,
        <span className="code-token code-punct" key="p18">{`();`}</span>
      ]
    ],
    [apiKey]
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  }

  async function copyKey() {
    await copy(apiKey);
    setCopied("key");
    setTimeout(() => setCopied(null), 1200);
  }

  async function copySnippet() {
    await copy(snippet);
    setCopied("snippet");
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <div className="card card-flow project-setup-card">
      <div className="project-setup-head">
        <div>
          <div className="section-title">{variant === "settings" ? "Integration" : "Project ready"}</div>
          <h3 className="project-setup-title">{projectName}</h3>
          <p className="small-note project-setup-desc">
            {variant === "settings"
              ? "Copy the API key or update it, then paste the snippet into your app."
              : "Copy the API key and paste the snippet into your app."}
          </p>
        </div>
        <div className="project-setup-actions">
          <Link className="btn btn-ghost" to="/projects/$id/issues" params={{ id: projectId }}>
            Issues
          </Link>
          <Link className="btn btn-ghost" to="/projects/$id/events" params={{ id: projectId }}>
            Events
          </Link>
          <Link className="btn btn-ghost" to="/projects/$id/settings" params={{ id: projectId }}>
            Settings
          </Link>
          {onRotate ? (
            <button className="btn" type="button" disabled={rotating} onClick={onRotate}>
              {rotating ? "Rotating..." : "Rotate key"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="project-setup-grid">
        <div className="project-setup-pane">
          <div className="section-title">API key</div>
          <code className="mono project-setup-key">{apiKey}</code>
          <button className="btn btn-ghost project-setup-copy-btn" type="button" onClick={copyKey}>
            {copied === "key" ? "✓ Copied" : "Copy API key"}
          </button>
        </div>

        <div className="project-setup-pane">
          <div className="section-title">SDK snippet</div>
          <div className="project-setup-editor">
            <div className="project-setup-editor-head">
              <div className="project-setup-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="project-setup-editor-title">sdk.ts</div>
              <div className="project-setup-editor-path">/app</div>
            </div>
            <div className="project-setup-snippet">
              {snippetRows.map((line, index) => (
                <div key={index} className={`project-setup-snippet-row ${line.length === 0 ? "is-empty" : ""}`}>
                  <span className="project-setup-snippet-line">{String(index + 1).padStart(2, "0")}</span>
                  <span className="project-setup-snippet-code">{line.length > 0 ? line : "\u00a0"}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost project-setup-copy-btn" type="button" onClick={copySnippet}>
            {copied === "snippet" ? "✓ Copied" : "Copy snippet"}
          </button>
          <div className="project-setup-identity-note">
            <strong>Track affected users correctly.</strong>
            <span>Call <code>setUser({`{ id, fullName, role }`})</code> after login or session restore, and <code>clearUser()</code> on logout.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
