import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteIssue,
  deleteProjectIssues,
  fetchProjectIssues,
  fetchProjectMembers,
  fmt,
  updateIssue,
  type IssuePriority,
  type IssueRow,
  type IssueStatus
} from "../../../lib";

export const Route = createFileRoute("/_authenticated/projects/$id/issues")({
  loader: async ({ params }) => {
    const [issues, members] = await Promise.all([
      fetchProjectIssues(params.id),
      fetchProjectMembers(params.id)
    ]);

    return { issues, members };
  },
  component: ProjectIssuesPage
});

function severityByCount(count: number): "high" | "mid" {
  return count >= 5 ? "high" : "mid";
}

type SeverityFilter = "all" | "high" | "mid";
type StatusFilter = "all" | IssueStatus;
type PriorityFilter = "all" | IssuePriority;
type FilterMenu = "severity" | "status" | "priority" | null;
type DeleteIntent =
  | { type: "one"; issueId: string; title: string; count: number }
  | { type: "visible"; title: string; count: number }
  | { type: "all"; title: string; count: number }
  | null;

function ProjectIssuesPage() {
  const { issues: initialIssues, members } = Route.useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const [issues, setIssues] = useState<IssueRow[]>(initialIssues);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState<FilterMenu>(null);
  const [openWorkflowMenu, setOpenWorkflowMenu] = useState<string | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent>(null);
  const assigneeOptions = useMemo(() => members.map((member) => member.name), [members]);

  useEffect(() => {
    if (!openWorkflowMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest(".workflow-dropdown-table")) return;
      setOpenWorkflowMenu(null);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openWorkflowMenu]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filter !== "all" && severityByCount(issue.count) !== filter) return false;
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
      return true;
    });
  }, [issues, filter, priorityFilter, statusFilter]);

  const runDelete = async () => {
    if (!deleteIntent) return;
    setDeleting(true);
    try {
      if (deleteIntent.type === "one") {
        await deleteIssue(deleteIntent.issueId);
        setIssues((items) => items.filter((item) => item.id !== deleteIntent.issueId));
      } else if (deleteIntent.type === "visible") {
        const ids = filteredIssues.map((issue) => issue.id);
        await deleteProjectIssues(id, ids);
        setIssues((items) => items.filter((item) => !ids.includes(item.id)));
      } else {
        await deleteProjectIssues(id);
        setIssues([]);
      }
      setDeleteIntent(null);
    } finally {
      setDeleting(false);
    }
  };

  const saveIssueWorkflow = async (
    issueId: string,
    input: { status?: IssueStatus; priority?: IssuePriority; assignee?: string }
  ) => {
    const updated = await updateIssue(issueId, input);
    setIssues((items) => items.map((item) => item.id === issueId ? { ...item, ...updated } : item));
    setOpenWorkflowMenu(null);
  };

  return (
    <div>
      <div className="page-head">
        <h2>{t("issues.title")}</h2>
        <div className="project-actions">
          <Link className="btn btn-ghost" to="/projects/$id/events" params={{ id }}>
            Events
          </Link>
          <Link className="icon-btn" to="/projects/$id/settings" params={{ id }} aria-label="Project settings">
            ⚙
          </Link>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="issue-toolbar">
          <div className="issue-toolbar-left">
            <FilterDropdown
              title="Severity"
              value={filter === "all" ? "All" : filter === "high" ? "High" : "Mid"}
              open={openMenu === "severity"}
              onToggle={() => setOpenMenu(openMenu === "severity" ? null : "severity")}
              options={[
                { label: "All", active: filter === "all", onClick: () => setFilter("all") },
                { label: "High", active: filter === "high", onClick: () => setFilter("high") },
                { label: "Mid", active: filter === "mid", onClick: () => setFilter("mid") }
              ]}
            />
            <FilterDropdown
              title="Status"
              value={statusFilter === "all" ? "All" : t(`issues.statuses.${statusFilter}`)}
              open={openMenu === "status"}
              onToggle={() => setOpenMenu(openMenu === "status" ? null : "status")}
              options={(["all", "OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"] as const).map((item) => ({
                label: item === "all" ? "All" : t(`issues.statuses.${item}`),
                active: statusFilter === item,
                onClick: () => setStatusFilter(item)
              }))}
            />
            <FilterDropdown
              title="Priority"
              value={priorityFilter === "all" ? "All" : t(`issues.priorities.${priorityFilter}`)}
              open={openMenu === "priority"}
              onToggle={() => setOpenMenu(openMenu === "priority" ? null : "priority")}
              options={(["all", "LOW", "MEDIUM", "HIGH", "HIGHEST"] as const).map((item) => ({
                label: item === "all" ? "All" : t(`issues.priorities.${item}`),
                active: priorityFilter === item,
                icon: item === "all" ? null : <PriorityIcon priority={item} />,
                onClick: () => setPriorityFilter(item)
              }))}
            />
          </div>
          <div className="issue-toolbar-actions">
            <span className="mono small-note" style={{ marginTop: 0 }}>{filteredIssues.length}/{issues.length}</span>
            <button className="btn btn-ghost" type="button" disabled={deleting || filteredIssues.length === 0} onClick={() => setDeleteIntent({ type: "visible", title: "Delete shown issues", count: filteredIssues.length })}>
              Delete shown
            </button>
            <button className="btn btn-danger" type="button" disabled={deleting || issues.length === 0} onClick={() => setDeleteIntent({ type: "all", title: "Delete all issues", count: issues.length })}>
              Delete all issues
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel issues-table-panel">
        {filteredIssues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{filter === "all" ? "🎉" : "🔍"}</div>
            <div className="empty-state-text">
              {filter === "all"
                ? "No issues found. Your app is running clean!"
                : `No ${filter.toUpperCase()} severity issues.`}
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.message")}</th>
                <th>{t("common.count")}</th>
                <th>{t("common.users")}</th>
                <th>Severity</th>
                <th>{t("issues.priority")}</th>
                <th>{t("issues.status")}</th>
                <th>{t("issues.assignee")}</th>
                <th>{t("common.firstSeen")}</th>
                <th>{t("common.lastSeen")}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue) => {
                const severity = severityByCount(issue.count);
                return (
                  <tr
                    key={issue.id}
                    className="clickable-row"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      navigate({ to: "/issues/$id", params: { id: issue.id }, search: { pid: id } });
                    }}
                  >
                    <td>
                      <Link className="link-strong" to="/issues/$id" params={{ id: issue.id }} search={{ pid: id }}>
                        {issue.message}
                      </Link>
                    </td>
                    <td>{issue.count}</td>
                    <td>{issue.usersCount}</td>
                    <td>
                      <span className={`chip ${severity === "high" ? "chip-high" : "chip-mid"}`}>
                        {severity.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <TableWorkflowDropdown
                        open={openWorkflowMenu === `${issue.id}:priority`}
                        onToggle={() => setOpenWorkflowMenu(openWorkflowMenu === `${issue.id}:priority` ? null : `${issue.id}:priority`)}
                        trigger={<PriorityBadge priority={issue.priority} label={t(`issues.priorities.${issue.priority}`)} clickable />}
                      >
                        {(["HIGHEST", "HIGH", "MEDIUM", "LOW"] as const).map((item) => (
                          <button
                            className={`workflow-menu-option workflow-menu-priority-${item.toLowerCase()} ${issue.priority === item ? "workflow-menu-option-active" : ""}`}
                            type="button"
                            key={item}
                            onClick={() => void saveIssueWorkflow(issue.id, { priority: item })}
                          >
                            <PriorityIcon priority={item} />
                            {t(`issues.priorities.${item}`)}
                          </button>
                        ))}
                      </TableWorkflowDropdown>
                    </td>
                    <td>
                      <TableWorkflowDropdown
                        open={openWorkflowMenu === `${issue.id}:status`}
                        onToggle={() => setOpenWorkflowMenu(openWorkflowMenu === `${issue.id}:status` ? null : `${issue.id}:status`)}
                        trigger={(
                          <span className={`workflow-chip workflow-chip-clickable workflow-chip-${issue.status.toLowerCase().replace("_", "-")}`}>
                            {t(`issues.statuses.${issue.status}`)}
                          </span>
                        )}
                      >
                        {(["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"] as const).map((item) => (
                          <button
                            className={`workflow-menu-option workflow-menu-status-${item.toLowerCase().replace("_", "-")} ${issue.status === item ? "workflow-menu-option-active" : ""}`}
                            type="button"
                            key={item}
                            onClick={() => void saveIssueWorkflow(issue.id, { status: item })}
                          >
                            <span className="workflow-choice-dot" />
                            {t(`issues.statuses.${item}`)}
                          </button>
                        ))}
                      </TableWorkflowDropdown>
                    </td>
                    <td>
                      <TableWorkflowDropdown
                        open={openWorkflowMenu === `${issue.id}:assignee`}
                        onToggle={() => setOpenWorkflowMenu(openWorkflowMenu === `${issue.id}:assignee` ? null : `${issue.id}:assignee`)}
                        trigger={issue.assignee ? <AssigneeBadge name={issue.assignee} /> : <span className="small-note workflow-inline-empty">Unassigned</span>}
                        align="right"
                      >
                        {assigneeOptions.length > 0 ? assigneeOptions.map((name) => (
                          <button
                            className={`workflow-menu-option ${issue.assignee === name ? "workflow-menu-option-active" : ""}`}
                            type="button"
                            key={name}
                            onClick={() => void saveIssueWorkflow(issue.id, { assignee: name })}
                          >
                            <span className="assignee-mini-avatar">{getInitials(name)}</span>
                            {name}
                          </button>
                        )) : <span className="workflow-menu-empty">Add people from Team first.</span>}
                        {issue.assignee ? (
                          <button className="workflow-menu-option workflow-menu-muted" type="button" onClick={() => void saveIssueWorkflow(issue.id, { assignee: "" })}>
                            Unassign
                          </button>
                        ) : null}
                      </TableWorkflowDropdown>
                    </td>
                    <td className="mono">{fmt(issue.firstSeen)}</td>
                    <td className="mono">{fmt(issue.lastSeen)}</td>
                    <td>
                      <button className="btn btn-ghost issue-delete-btn" type="button" disabled={deleting} onClick={() => setDeleteIntent({ type: "one", issueId: issue.id, title: issue.message, count: 1 })}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {deleteIntent ? (
        <ConfirmDeleteModal
          intent={deleteIntent}
          deleting={deleting}
          onCancel={() => setDeleteIntent(null)}
          onConfirm={() => void runDelete()}
        />
      ) : null}
    </div>
  );
}

function TableWorkflowDropdown({
  open,
  trigger,
  children,
  align = "left",
  onToggle
}: {
  open: boolean;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  onToggle: () => void;
}) {
  return (
    <span className="workflow-dropdown workflow-dropdown-table">
      <button className="workflow-dropdown-trigger" type="button" onClick={onToggle}>
        {trigger}
      </button>
      {open ? <span className={`workflow-dropdown-menu workflow-dropdown-menu-${align}`}>{children}</span> : null}
    </span>
  );
}

function FilterDropdown({
  title,
  value,
  open,
  options,
  onToggle
}: {
  title: string;
  value: string;
  open: boolean;
  options: Array<{ label: string; active: boolean; icon?: ReactNode; onClick: () => void }>;
  onToggle: () => void;
}) {
  return (
    <div className="issue-filter-popover">
      <button className={`issue-filter-trigger ${open ? "issue-filter-trigger-open" : ""}`} type="button" onClick={onToggle}>
        <span className="issue-filter-label">{title}</span>
        <span className="issue-filter-value">{value}</span>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="issue-filter-menu">
          {options.map((option) => (
            <button
              key={option.label}
              className={`issue-filter-option ${option.active ? "issue-filter-option-active" : ""}`}
              type="button"
              onClick={() => {
                option.onClick();
                onToggle();
              }}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConfirmDeleteModal({
  intent,
  deleting,
  onCancel,
  onConfirm
}: {
  intent: NonNullable<DeleteIntent>;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-issue-title">
        <div className="confirm-modal-icon">!</div>
        <div>
          <h3 id="delete-issue-title">{intent.title}</h3>
          <p>
            This will permanently delete {intent.count} {intent.count === 1 ? "issue" : "issues"} with all related events,
            breadcrumbs, replay, and network data.
          </p>
        </div>
        <div className="confirm-modal-actions">
          <button className="btn btn-ghost" type="button" disabled={deleting} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" type="button" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority, label, clickable = false }: { priority: IssuePriority; label: string; clickable?: boolean }) {
  return (
    <span className={`priority-chip ${clickable ? "priority-chip-clickable" : ""} priority-chip-${priority.toLowerCase()}`}>
      <PriorityIcon priority={priority} />
      {label}
    </span>
  );
}

function AssigneeBadge({ name }: { name: string }) {
  return (
    <span className="assignee-table-badge">
      <span className="assignee-mini-avatar">{getInitials(name)}</span>
      {name}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function PriorityIcon({ priority }: { priority: IssuePriority }) {
  if (priority === "LOW") {
    return (
      <svg className="priority-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (priority === "MEDIUM") {
    return (
      <svg className="priority-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 8h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (priority === "HIGH") {
    return (
      <svg className="priority-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className="priority-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 13V4M2.5 6.5 5 4l2.5 2.5M11 13V4M8.5 6.5 11 4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
