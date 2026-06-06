import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SourceLocation } from "@/components/SourceLocation";
import {
  createIssueComment,
  fetchIssue,
  fetchIssueComments,
  fetchIssueEvents,
  fetchProjectMembers,
  fmt,
  type IssueCommentRow,
  type IssuePriority,
  type IssueStatus,
  type ManualReportRow,
  updateIssue,
} from "@/lib";

export const Route = createFileRoute("/_authenticated/issues/$id")({
  loader: async ({ params }) => {
    const issue = await fetchIssue(params.id);
    const [events, members, comments] = await Promise.all([
      fetchIssueEvents(params.id),
      fetchProjectMembers(issue.projectId),
      fetchIssueComments(params.id),
    ]);

    return { issue, events, members, comments };
  },
  component: IssueDetailPage,
});

function IssueDetailPage() {
  const {
    issue,
    events,
    members,
    comments: initialComments,
  } = Route.useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [priority, setPriority] = useState<IssuePriority>(issue.priority);
  const [assignee, setAssignee] = useState(issue.assignee ?? "");
  const workflowRef = useRef<HTMLDivElement | null>(null);
  const [openWorkflowMenu, setOpenWorkflowMenu] = useState<
    "status" | "priority" | "assignee" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [comments, setComments] = useState<IssueCommentRow[]>(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showAffectedUsers, setShowAffectedUsers] = useState(false);
  const affectedUsers = useMemo(() => getAffectedUsers(events), [events]);
  const primaryAffectedUser = affectedUsers[0] ?? null;
  const assigneeOptions = useMemo(
    () => members.map((member) => member.name),
    [members],
  );
  const visibleComments = showAllComments ? comments : comments.slice(0, 4);
  const hasMoreComments = comments.length > 4;
  const manualReports = issue.manualReports ?? [];
  const latestManualReport = manualReports[0] ?? null;

  useEffect(() => {
    if (!openWorkflowMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      if (workflowRef.current?.contains(event.target as Node)) return;
      setOpenWorkflowMenu(null);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openWorkflowMenu]);

  const saveWorkflowField = async (input: {
    status?: IssueStatus;
    priority?: IssuePriority;
    assignee?: string;
  }) => {
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateIssue(issue.id, input);
      setStatus(updated.status);
      setPriority(updated.priority);
      setAssignee(updated.assignee ?? "");
      setOpenWorkflowMenu(null);
    } catch {
      setSaveError("Could not save workflow changes");
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!commentBody.trim()) return;
    setCommentSaving(true);
    try {
      const created = await createIssueComment(issue.id, {
        body: commentBody.trim(),
      });
      setComments((items) => [created, ...items]);
      setCommentBody("");
    } finally {
      setCommentSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>{t("issues.detail")}</h2>
      </div>
      <div className="card issue-detail-card">
        <div className="issue-detail-hero">
          <div className="issue-detail-main">
            <div className="section-title">{t("common.message")}</div>
            <h3 className="issue-title-row">
              <span>{issue.message}</span>
              {issue.type === "MANUAL" ? (
                <span className="manual-issue-badge">Manual</span>
              ) : null}
            </h3>
            <div className="issue-detail-stats">
              <span>
                <strong>{issue.count}</strong> events
              </span>
              <button
                className="issue-stat-button"
                type="button"
                onClick={() => setShowAffectedUsers(true)}
              >
                <strong>{issue.usersCount}</strong> users
              </button>
              <span>
                First <span className="mono">{fmt(issue.firstSeen)}</span>
              </span>
              <span>
                Last <span className="mono">{fmt(issue.lastSeen)}</span>
              </span>
            </div>
            <div className="affected-user-card">
              <div>
                <div className="section-title">Most recent affected user</div>
                <strong>{primaryAffectedUser?.name ?? "Unknown user"}</strong>
                {primaryAffectedUser?.role ? (
                  <span className="affected-user-role">
                    {primaryAffectedUser.role}
                  </span>
                ) : null}
                {primaryAffectedUser?.id ? (
                  <div className="mono small-note">
                    {primaryAffectedUser.id}
                  </div>
                ) : null}
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowAffectedUsers(true)}
              >
                View all
              </button>
            </div>
          </div>
          <div
            className="issue-workflow-card"
            ref={workflowRef}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest(".workflow-dropdown"))
                return;
              setOpenWorkflowMenu(null);
            }}
          >
            <div className="issue-workflow-card-head">
              <div>
                <div className="section-title">{t("issues.workflow")}</div>
                <div className="issue-workflow-hint">
                  {t("issues.workflowHint")}
                </div>
              </div>
            </div>
            <div className="issue-workflow-summary">
              <div>
                <span>{t("issues.status")}</span>
                <WorkflowDropdown
                  open={openWorkflowMenu === "status"}
                  onToggle={() =>
                    setOpenWorkflowMenu(
                      openWorkflowMenu === "status" ? null : "status",
                    )
                  }
                  trigger={
                    <span
                      className={`workflow-chip workflow-chip-clickable workflow-chip-${status.toLowerCase().replace("_", "-")}`}
                    >
                      {t(`issues.statuses.${status}`)}
                    </span>
                  }
                >
                  {(
                    ["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"] as const
                  ).map((item) => (
                    <button
                      className={`workflow-menu-option workflow-menu-status-${item.toLowerCase().replace("_", "-")} ${status === item ? "workflow-menu-option-active" : ""}`}
                      type="button"
                      disabled={saving}
                      key={item}
                      onClick={() => void saveWorkflowField({ status: item })}
                    >
                      <span className="workflow-choice-dot" />
                      {t(`issues.statuses.${item}`)}
                    </button>
                  ))}
                </WorkflowDropdown>
              </div>
              <div>
                <span>{t("issues.priority")}</span>
                <WorkflowDropdown
                  open={openWorkflowMenu === "priority"}
                  onToggle={() =>
                    setOpenWorkflowMenu(
                      openWorkflowMenu === "priority" ? null : "priority",
                    )
                  }
                  trigger={
                    <IssuePriorityBadge
                      priority={priority}
                      label={t(`issues.priorities.${priority}`)}
                      clickable
                    />
                  }
                >
                  {(["HIGHEST", "HIGH", "MEDIUM", "LOW"] as const).map(
                    (item) => (
                      <button
                        className={`workflow-menu-option workflow-menu-priority-${item.toLowerCase()} ${priority === item ? "workflow-menu-option-active" : ""}`}
                        type="button"
                        disabled={saving}
                        key={item}
                        onClick={() =>
                          void saveWorkflowField({ priority: item })
                        }
                      >
                        <PriorityIcon priority={item} />
                        {t(`issues.priorities.${item}`)}
                      </button>
                    ),
                  )}
                </WorkflowDropdown>
              </div>
              <div>
                <span>{t("issues.assignee")}</span>
                <WorkflowDropdown
                  open={openWorkflowMenu === "assignee"}
                  onToggle={() =>
                    setOpenWorkflowMenu(
                      openWorkflowMenu === "assignee" ? null : "assignee",
                    )
                  }
                  trigger={<AssigneePill name={assignee} clickable />}
                  align="right"
                >
                  {assigneeOptions.length > 0 ? (
                    assigneeOptions.map((name) => (
                      <button
                        className={`workflow-menu-option ${assignee === name ? "workflow-menu-option-active" : ""}`}
                        type="button"
                        disabled={saving}
                        key={name}
                        onClick={() =>
                          void saveWorkflowField({ assignee: name })
                        }
                      >
                        <span className="assignee-mini-avatar">
                          {getInitials(name)}
                        </span>
                        {name}
                      </button>
                    ))
                  ) : (
                    <span className="workflow-menu-empty">
                      Add people from Team first.
                    </span>
                  )}
                  {assignee ? (
                    <button
                      className="workflow-menu-option workflow-menu-muted"
                      type="button"
                      disabled={saving}
                      onClick={() => void saveWorkflowField({ assignee: "" })}
                    >
                      Unassign
                    </button>
                  ) : null}
                </WorkflowDropdown>
              </div>
            </div>
          </div>
        </div>
        {saveError ? (
          <div className="issue-workflow-error">{saveError}</div>
        ) : null}
      </div>
      {showAffectedUsers ? (
        <AffectedUsersModal
          users={affectedUsers}
          onClose={() => setShowAffectedUsers(false)}
        />
      ) : null}

      {latestManualReport ? (
        <>
          <hr className="section-sep" />
          <div className="page-head" style={{ marginTop: 0 }}>
            <h2>Manual report</h2>
          </div>
          <ManualReportPanel
            report={latestManualReport}
            total={manualReports.length}
          />
        </>
      ) : null}

      <hr className="section-sep" />
      <div className="page-head" style={{ marginTop: 0 }}>
        <h2>Comments</h2>
      </div>
      <div className="panel issue-comments-panel">
        <div className="comment-composer">
          <textarea
            value={commentBody}
            maxLength={4000}
            placeholder="Add a note, decision, or debugging context..."
            onChange={(event) => setCommentBody(event.target.value)}
          />
          <div className="comment-composer-actions">
            <span className="small-note" style={{ marginTop: 0 }}>
              {commentBody.length}/4000
            </span>
            <button
              className="btn"
              type="button"
              disabled={commentSaving || !commentBody.trim()}
              onClick={() => void addComment()}
            >
              {commentSaving ? "Posting..." : "Add comment"}
            </button>
          </div>
        </div>
        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="empty-panel">No comments yet.</div>
          ) : (
            <>
              {visibleComments.map((comment) => (
                <div className="comment-card" key={comment.id}>
                  <div className="comment-meta">
                    <strong>{comment.authorName ?? "Unknown"}</strong>
                    <span className="mono">{fmt(comment.createdAt)}</span>
                  </div>
                  <p>{comment.body}</p>
                </div>
              ))}
              {hasMoreComments ? (
                <button
                  className="btn btn-ghost comments-toggle"
                  type="button"
                  onClick={() => setShowAllComments((value) => !value)}
                >
                  {showAllComments
                    ? "See less"
                    : `See more (${comments.length - visibleComments.length})`}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <hr className="section-sep" />
      <div className="page-head" style={{ marginTop: 0 }}>
        <h2>Environment Analytics</h2>
      </div>
      <div className="issue-env-grid">
        <BreakdownCard
          title="Browsers"
          items={issue.environment?.browsers ?? []}
        />
        <BreakdownCard
          title="Operating Systems"
          items={issue.environment?.os ?? []}
        />
        <BreakdownCard
          title="Devices"
          items={issue.environment?.devices ?? []}
        />
      </div>

      <hr className="section-sep" />

      <div className="page-head" style={{ marginTop: 0 }}>
        <h2>{t("issues.latestEvents")}</h2>
      </div>
      <div className="panel">
        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-text">
              No events recorded for this issue yet.
            </div>
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
                    navigate({
                      to: "/events/$id",
                      params: { id: event.id },
                      search: { pid: issue.projectId },
                    });
                  }}
                >
                  <td>
                    <Link
                      className="link-strong"
                      to="/events/$id"
                      params={{ id: event.id }}
                      search={{ pid: issue.projectId }}
                    >
                      {event.message}
                    </Link>
                  </td>
                  <td>
                    <SourceLocation
                      fileName={event.fileName}
                      line={event.line}
                      column={event.column}
                      stack={event.stack}
                    />
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

type AffectedUserSummary = {
  key: string;
  id: string | null;
  name: string;
  role: string | null;
  count: number;
  lastSeen: string;
};

function getAffectedUsers(
  events: Array<{
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    createdAt: string;
  }>,
): AffectedUserSummary[] {
  const users = new Map<string, AffectedUserSummary>();

  for (const event of events) {
    const key = event.userId ?? event.userName ?? "unknown";
    const existing = users.get(key);
    if (existing) {
      existing.count += 1;
      if (
        new Date(event.createdAt).getTime() >
        new Date(existing.lastSeen).getTime()
      ) {
        existing.lastSeen = event.createdAt;
      }
      continue;
    }

    users.set(key, {
      key,
      id: event.userId ?? null,
      name: event.userName ?? event.userId ?? "Unknown user",
      role: event.userRole ?? null,
      count: 1,
      lastSeen: event.createdAt,
    });
  }

  return Array.from(users.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );
}

function AffectedUsersModal({
  users,
  onClose,
}: {
  users: AffectedUserSummary[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="affected-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="affected-users-title"
      >
        <div className="workflow-modal-head">
          <div>
            <h3 id="affected-users-title">Affected users</h3>
            <p>Users who hit this issue, grouped by user id/name.</p>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        </div>
        <div className="affected-users-list">
          {users.length === 0 ? (
            <div className="empty-panel">No user context captured.</div>
          ) : (
            users.map((user) => (
              <div className="affected-user-row" key={user.key}>
                <div>
                  <strong>{user.name}</strong>
                  {user.role ? (
                    <span className="affected-user-role">{user.role}</span>
                  ) : null}
                  {user.id ? (
                    <div className="mono small-note">{user.id}</div>
                  ) : null}
                </div>
                <div className="affected-user-row-meta">
                  <span>{user.count} events</span>
                  <span className="mono">{fmt(user.lastSeen)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ManualReportPanel({
  report,
  total,
}: {
  report: ManualReportRow;
  total: number;
}) {
  return (
    <div className="panel manual-report-panel">
      <div className="manual-report-copy">
        <div>
          <div className="section-title">Latest manual report</div>
          <h3>{report.title}</h3>
          {report.description ? (
            <p>{report.description}</p>
          ) : (
            <p className="small-note">No description provided.</p>
          )}
        </div>
        <div className="manual-report-meta">
          <span>
            {total} {total === 1 ? "report" : "reports"}
          </span>
          <span className="mono">{fmt(report.createdAt)}</span>
          <span className="mono">{report.url}</span>
        </div>
      </div>
      {report.screenshotData ? (
        <div className="manual-report-shot">
          <img src={report.screenshotData} alt="Manual bug report screenshot" />
          <ManualReportAnnotations annotations={report.annotations ?? []} />
        </div>
      ) : (
        <div className="empty-panel">No screenshot attached.</div>
      )}
    </div>
  );
}

function ManualReportAnnotations({
  annotations,
}: {
  annotations: ManualReportRow["annotations"];
}) {
  if (!annotations?.length) return null;

  return (
    <div className="manual-report-annotations">
      {annotations.map((annotation, index) => (
        <span
          className={`manual-report-annotation manual-report-annotation-${annotation.kind}`}
          key={`${annotation.kind}-${index}`}
          style={{
            left: `${annotation.x}%`,
            top: `${annotation.y}%`,
            width:
              annotation.kind === "note"
                ? undefined
                : `${annotation.width ?? 12}%`,
            height:
              annotation.kind === "note"
                ? undefined
                : `${annotation.height ?? 12}%`,
          }}
        >
          {annotation.kind === "note" ? annotation.text || "Note" : null}
        </span>
      ))}
    </div>
  );
}

function WorkflowDropdown({
  open,
  trigger,
  children,
  align = "left",
  onToggle,
}: {
  open: boolean;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  onToggle: () => void;
}) {
  return (
    <span className="workflow-dropdown">
      <button
        className="workflow-dropdown-trigger"
        type="button"
        onClick={onToggle}
      >
        {trigger}
      </button>
      {open ? (
        <span
          className={`workflow-dropdown-menu workflow-dropdown-menu-${align}`}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

function IssuePriorityBadge({
  priority,
  label,
  clickable = false,
}: {
  priority: IssuePriority;
  label: string;
  clickable?: boolean;
}) {
  return (
    <span
      className={`priority-chip ${clickable ? "priority-chip-clickable" : ""} priority-chip-${priority.toLowerCase()}`}
    >
      <PriorityIcon priority={priority} />
      {label}
    </span>
  );
}

function AssigneePill({
  name,
  clickable = false,
}: {
  name: string;
  clickable?: boolean;
}) {
  if (!name) return <em>Unassigned</em>;

  return (
    <span
      className={`assignee-pill ${clickable ? "assignee-pill-clickable" : ""}`}
    >
      <span className="assignee-avatar">{getInitials(name)}</span>
      <span>
        <strong>{name}</strong>
        <small>Assignee</small>
      </span>
    </span>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function PriorityIcon({ priority }: { priority: IssuePriority }) {
  if (priority === "LOW") {
    return (
      <svg
        className="priority-icon"
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 3v10M4 9l4 4 4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (priority === "MEDIUM") {
    return (
      <svg
        className="priority-icon"
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 8h8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (priority === "HIGH") {
    return (
      <svg
        className="priority-icon"
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 13V3M4 7l4-4 4 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      className="priority-icon"
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 13V4M2.5 6.5 5 4l2.5 2.5M11 13V4M8.5 6.5 11 4l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BreakdownCard({
  title,
  items,
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
                <div
                  className="issue-breakdown-bar-fill"
                  style={{ width: `${Math.max(4, item.percent)}%` }}
                />
              </div>
              <div className="small-note" style={{ marginTop: 4 }}>
                {item.count} events
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
