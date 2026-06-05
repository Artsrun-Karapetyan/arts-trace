import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ConfirmDeleteModal,
  type DeleteIntent,
} from "@/components/ui/ConfirmDeleteModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import { PriorityIcon } from "@/components/ui/PriorityIcon";
import { severityByCount } from "@/helpers/issues";
import {
  deleteIssue,
  deleteProjectIssues,
  type IssuePriority,
  type IssueRow,
  type IssueStatus,
  type ProjectMemberRow,
  updateIssue,
} from "@/lib";

import { IssueTableRow } from "./IssueTableRow";

type SeverityFilter = "all" | "high" | "mid";
type StatusFilter = "all" | IssueStatus;
type PriorityFilter = "all" | IssuePriority;
type FilterMenu = "severity" | "status" | "priority" | null;

interface IssuesLayoutProps {
  initialIssues: IssueRow[];
  members: ProjectMemberRow[];
  projectId: string;
}

export function IssuesLayout({
  initialIssues,
  members,
  projectId,
}: IssuesLayoutProps) {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<IssueRow[]>(initialIssues);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState<FilterMenu>(null);
  const [openWorkflowMenu, setOpenWorkflowMenu] = useState<string | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
  const assigneeOptions = useMemo(
    () => members.map((member) => member.name),
    [members],
  );

  useEffect(() => {
    if (!openWorkflowMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest(".workflow-dropdown-table"))
        return;
      setOpenWorkflowMenu(null);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openWorkflowMenu]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filter !== "all" && severityByCount(issue.count) !== filter)
        return false;
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (priorityFilter !== "all" && issue.priority !== priorityFilter)
        return false;
      return true;
    });
  }, [issues, filter, priorityFilter, statusFilter]);

  const runDelete = async () => {
    if (!deleteIntent) return;
    setDeleting(true);
    try {
      if (deleteIntent.type === "one" && deleteIntent.issueId) {
        await deleteIssue(deleteIntent.issueId);
        setIssues((items) =>
          items.filter((item) => item.id !== deleteIntent.issueId),
        );
      } else if (deleteIntent.type === "visible") {
        const ids = filteredIssues.map((issue) => issue.id);
        await deleteProjectIssues(projectId, ids);
        setIssues((items) => items.filter((item) => !ids.includes(item.id)));
      } else {
        await deleteProjectIssues(projectId);
        setIssues([]);
      }
      setDeleteIntent(null);
    } finally {
      setDeleting(false);
    }
  };

  const saveIssueWorkflow = async (
    issueId: string,
    input: {
      status?: IssueStatus;
      priority?: IssuePriority;
      assignee?: string;
    },
  ) => {
    const updated = await updateIssue(issueId, input);
    setIssues((items) =>
      items.map((item) =>
        item.id === issueId ? { ...item, ...updated } : item,
      ),
    );
    setOpenWorkflowMenu(null);
  };

  return (
    <div>
      <div className="page-head">
        <h2>{t("issues.title")}</h2>
        <div className="project-actions">
          <Link
            className="btn btn-ghost"
            to="/projects/$id/events"
            params={{ id: projectId }}
          >
            Events
          </Link>
          <Link
            className="icon-btn"
            to="/projects/$id/settings"
            params={{ id: projectId }}
            aria-label="Project settings"
          >
            ⚙
          </Link>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="issue-toolbar">
          <div className="issue-toolbar-left">
            <FilterDropdown
              title="Severity"
              value={
                filter === "all" ? "All" : filter === "high" ? "High" : "Mid"
              }
              open={openMenu === "severity"}
              onToggle={() =>
                setOpenMenu(openMenu === "severity" ? null : "severity")
              }
              options={[
                {
                  label: "All",
                  active: filter === "all",
                  onClick: () => setFilter("all"),
                },
                {
                  label: "High",
                  active: filter === "high",
                  onClick: () => setFilter("high"),
                },
                {
                  label: "Mid",
                  active: filter === "mid",
                  onClick: () => setFilter("mid"),
                },
              ]}
            />
            <FilterDropdown
              title="Status"
              value={
                statusFilter === "all"
                  ? "All"
                  : t(`issues.statuses.${statusFilter}`)
              }
              open={openMenu === "status"}
              onToggle={() =>
                setOpenMenu(openMenu === "status" ? null : "status")
              }
              options={(
                ["all", "OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"] as const
              ).map((item) => ({
                label: item === "all" ? "All" : t(`issues.statuses.${item}`),
                active: statusFilter === item,
                onClick: () => setStatusFilter(item),
              }))}
            />
            <FilterDropdown
              title="Priority"
              value={
                priorityFilter === "all"
                  ? "All"
                  : t(`issues.priorities.${priorityFilter}`)
              }
              open={openMenu === "priority"}
              onToggle={() =>
                setOpenMenu(openMenu === "priority" ? null : "priority")
              }
              options={(
                ["all", "LOW", "MEDIUM", "HIGH", "HIGHEST"] as const
              ).map((item) => ({
                label: item === "all" ? "All" : t(`issues.priorities.${item}`),
                active: priorityFilter === item,
                icon:
                  item === "all" ? undefined : <PriorityIcon priority={item} />,
                onClick: () => setPriorityFilter(item),
              }))}
            />
          </div>
          <div className="issue-toolbar-actions">
            <span className="mono small-note" style={{ marginTop: 0 }}>
              {filteredIssues.length}/{issues.length}
            </span>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={deleting || filteredIssues.length === 0}
              onClick={() =>
                setDeleteIntent({
                  type: "visible",
                  title: "Delete shown issues",
                  count: filteredIssues.length,
                })
              }
            >
              Delete shown
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={deleting || issues.length === 0}
              onClick={() =>
                setDeleteIntent({
                  type: "all",
                  title: "Delete all issues",
                  count: issues.length,
                })
              }
            >
              Delete all issues
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel issues-table-panel">
        {filteredIssues.length === 0 ? (
          <EmptyState
            icon={filter === "all" ? "🎉" : "🔍"}
            text={
              filter === "all"
                ? "No issues found. Your app is running clean!"
                : `No ${filter.toUpperCase()} severity issues.`
            }
          />
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
              {filteredIssues.map((issue) => (
                <IssueTableRow
                  key={issue.id}
                  issue={issue}
                  projectId={projectId}
                  deleting={deleting}
                  openWorkflowMenu={openWorkflowMenu}
                  setOpenWorkflowMenu={setOpenWorkflowMenu}
                  saveIssueWorkflow={saveIssueWorkflow}
                  setDeleteIntent={setDeleteIntent}
                  assigneeOptions={assigneeOptions}
                />
              ))}
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
