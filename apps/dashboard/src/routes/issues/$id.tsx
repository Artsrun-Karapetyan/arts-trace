import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchIssue, fetchIssueEvents, fmt, updateIssue, type IssueStatus } from "../../lib";
import { SourceLocation } from "../../components/SourceLocation";

export const Route = createFileRoute("/issues/$id")({
  loader: async ({ params }) => {
    const [issue, events] = await Promise.all([
      fetchIssue(params.id),
      fetchIssueEvents(params.id)
    ]);

    return { issue, events };
  },
  component: IssueDetailPage
});

function IssueDetailPage() {
  const { issue, events } = Route.useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [assignee, setAssignee] = useState(issue.assignee ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const saveWorkflow = async (input: { status?: IssueStatus; assignee?: string }) => {
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateIssue(issue.id, input);
      setStatus(updated.status);
      setAssignee(updated.assignee ?? "");
    } catch {
      setSaveError("Could not save workflow changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>{t("issues.detail")}</h2>
      </div>
      <div className="card">
        <div className="issue-workflow">
          <div>
            <div className="section-title">{t("issues.workflow")}</div>
            <div className="issue-workflow-hint">{t("issues.workflowHint")}</div>
          </div>
          <label className="issue-workflow-field">
            <span>{t("issues.status")}</span>
            <select
              className="input issue-workflow-select"
              value={status}
              disabled={saving}
              onChange={(event) => {
                const next = event.target.value as IssueStatus;
                setStatus(next);
                void saveWorkflow({ status: next });
              }}
            >
              <option value="OPEN">{t("issues.statuses.OPEN")}</option>
              <option value="IN_PROGRESS">{t("issues.statuses.IN_PROGRESS")}</option>
              <option value="RESOLVED">{t("issues.statuses.RESOLVED")}</option>
              <option value="IGNORED">{t("issues.statuses.IGNORED")}</option>
            </select>
          </label>
          <label className="issue-workflow-field issue-assignee-field">
            <span>{t("issues.assignee")}</span>
            <div className="issue-assignee-row">
              <input
                className="input"
                value={assignee}
                maxLength={120}
                placeholder={t("issues.assigneePlaceholder")}
                onChange={(event) => setAssignee(event.target.value)}
              />
              <button className="btn" type="button" disabled={saving} onClick={() => void saveWorkflow({ assignee })}>
                {saving ? t("issues.saving") : t("issues.save")}
              </button>
            </div>
          </label>
        </div>
        {saveError ? <div className="issue-workflow-error">{saveError}</div> : null}
        <hr className="section-sep" />
        <div className="meta-grid">
          <p><strong>{t("common.message")}:</strong> {issue.message}</p>
          <p><strong>{t("common.count")}:</strong> {issue.count}</p>
          <p><strong>{t("common.usersAffected")}:</strong> {issue.usersCount}</p>
          <p><strong>{t("common.firstSeen")}:</strong> <span className="mono">{fmt(issue.firstSeen)}</span></p>
          <p><strong>{t("common.lastSeen")}:</strong> <span className="mono">{fmt(issue.lastSeen)}</span></p>
        </div>
      </div>

      <hr className="section-sep" />
      <div className="page-head" style={{ marginTop: 0 }}>
        <h2>Environment Analytics</h2>
      </div>
      <div className="issue-env-grid">
        <BreakdownCard title="Browsers" items={issue.environment?.browsers ?? []} />
        <BreakdownCard title="Operating Systems" items={issue.environment?.os ?? []} />
        <BreakdownCard title="Devices" items={issue.environment?.devices ?? []} />
      </div>

      <hr className="section-sep" />

      <div className="page-head" style={{ marginTop: 0 }}>
        <h2>{t("issues.latestEvents")}</h2>
      </div>
      <div className="panel">
        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-text">No events recorded for this issue yet.</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.message")}</th>
                <th>{t("common.source")}</th>
                <th>{t("common.url")}</th>
                <th>{t("common.created")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="clickable-row"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, button")) return;
                    navigate({ to: "/events/$id", params: { id: event.id }, search: { pid: issue.projectId } });
                  }}
                >
                  <td>
                    <Link className="link-strong" to="/events/$id" params={{ id: event.id }} search={{ pid: issue.projectId }}>
                      {event.message}
                    </Link>
                  </td>
                  <td>
                    <SourceLocation fileName={event.fileName} line={event.line} column={event.column} stack={event.stack} />
                  </td>
                  <td className="mono">{event.url}</td>
                  <td className="mono">{fmt(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  items
}: {
  title: string;
  items: Array<{ name: string; count: number; percent: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="panel issue-breakdown-card">
      <div className="issue-breakdown-head">
        <h3>{title}</h3>
        <span className="mono">{total} events</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-panel">No data yet</div>
      ) : (
        <div className="issue-breakdown-list">
          {items.map((item) => (
            <div key={item.name} className="issue-breakdown-row">
              <div className="issue-breakdown-label-row">
                <span>{item.name}</span>
                <span className="mono">{item.percent}%</span>
              </div>
              <div className="issue-breakdown-bar-track">
                <div className="issue-breakdown-bar-fill" style={{ width: `${Math.max(4, item.percent)}%` }} />
              </div>
              <div className="small-note" style={{ marginTop: 4 }}>{item.count} events</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
