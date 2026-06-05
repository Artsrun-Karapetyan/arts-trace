import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { type DeleteIntent } from "@/components/ui/ConfirmDeleteModal";
import { PriorityIcon } from "@/components/ui/PriorityIcon";
import { TableWorkflowDropdown } from "@/components/ui/TableWorkflowDropdown";
import { severityByCount } from "@/helpers/issues";
import {
  fmt,
  type IssuePriority,
  type IssueRow,
  type IssueStatus,
} from "@/lib";

import { AssigneeBadge } from "./AssigneeBadge";
import { PriorityBadge } from "./PriorityBadge";

export interface IssueTableRowProps {
  issue: IssueRow;
  projectId: string;
  deleting: boolean;
  openWorkflowMenu: string | null;
  setOpenWorkflowMenu: (menu: string | null) => void;
  saveIssueWorkflow: (
    issueId: string,
    input: {
      status?: IssueStatus;
      priority?: IssuePriority;
      assignee?: string;
    },
  ) => Promise<void>;
  setDeleteIntent: (intent: DeleteIntent) => void;
  assigneeOptions: string[];
}

export function IssueTableRow({
  issue,
  projectId,
  deleting,
  openWorkflowMenu,
  setOpenWorkflowMenu,
  saveIssueWorkflow,
  setDeleteIntent,
  assigneeOptions,
}: IssueTableRowProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const severity = severityByCount(issue.count);

  return (
    <tr
      className="clickable-row"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        navigate({
          to: "/issues/$id",
          params: { id: issue.id },
          search: { pid: projectId },
        });
      }}
    >
      <td>
        <Link
          className="link-strong"
          to="/issues/$id"
          params={{ id: issue.id }}
          search={{ pid: projectId }}
        >
          {issue.message}
        </Link>
        {issue.type === "MANUAL" ? (
          <span className="manual-issue-badge">Manual</span>
        ) : null}
      </td>
      <td>{issue.count}</td>
      <td>{issue.usersCount}</td>
      <td>
        <span
          className={`chip ${severity === "high" ? "chip-high" : "chip-mid"}`}
        >
          {severity.toUpperCase()}
        </span>
      </td>
      <td>
        <TableWorkflowDropdown
          open={openWorkflowMenu === `${issue.id}:priority`}
          onToggle={() =>
            setOpenWorkflowMenu(
              openWorkflowMenu === `${issue.id}:priority`
                ? null
                : `${issue.id}:priority`,
            )
          }
          trigger={
            <PriorityBadge
              priority={issue.priority}
              label={t(`issues.priorities.${issue.priority}`)}
              clickable
            />
          }
        >
          {(["HIGHEST", "HIGH", "MEDIUM", "LOW"] as const).map((item) => (
            <button
              className={`workflow-menu-option workflow-menu-priority-${item.toLowerCase()} ${issue.priority === item ? "workflow-menu-option-active" : ""}`}
              type="button"
              key={item}
              onClick={() =>
                void saveIssueWorkflow(issue.id, {
                  priority: item,
                })
              }
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
          onToggle={() =>
            setOpenWorkflowMenu(
              openWorkflowMenu === `${issue.id}:status`
                ? null
                : `${issue.id}:status`,
            )
          }
          trigger={
            <span
              className={`workflow-chip workflow-chip-clickable workflow-chip-${issue.status.toLowerCase().replace("_", "-")}`}
            >
              {t(`issues.statuses.${issue.status}`)}
            </span>
          }
        >
          {(["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"] as const).map(
            (item) => (
              <button
                className={`workflow-menu-option workflow-menu-status-${item.toLowerCase().replace("_", "-")} ${issue.status === item ? "workflow-menu-option-active" : ""}`}
                type="button"
                key={item}
                onClick={() =>
                  void saveIssueWorkflow(issue.id, {
                    status: item,
                  })
                }
              >
                <span className="workflow-choice-dot" />
                {t(`issues.statuses.${item}`)}
              </button>
            ),
          )}
        </TableWorkflowDropdown>
      </td>
      <td>
        <TableWorkflowDropdown
          open={openWorkflowMenu === `${issue.id}:assignee`}
          onToggle={() =>
            setOpenWorkflowMenu(
              openWorkflowMenu === `${issue.id}:assignee`
                ? null
                : `${issue.id}:assignee`,
            )
          }
          trigger={
            issue.assignee ? (
              <AssigneeBadge name={issue.assignee} />
            ) : (
              <span className="small-note workflow-inline-empty">
                Unassigned
              </span>
            )
          }
          align="right"
        >
          {assigneeOptions.length > 0 ? (
            assigneeOptions.map((name) => (
              <button
                className={`workflow-menu-option ${issue.assignee === name ? "workflow-menu-option-active" : ""}`}
                type="button"
                key={name}
                onClick={() =>
                  void saveIssueWorkflow(issue.id, {
                    assignee: name,
                  })
                }
              >
                <span className="assignee-mini-avatar">
                  {name[0]?.toUpperCase()}
                </span>
                {name}
              </button>
            ))
          ) : (
            <span className="workflow-menu-empty">
              Add people from Team first.
            </span>
          )}
          {issue.assignee ? (
            <button
              className="workflow-menu-option workflow-menu-muted"
              type="button"
              onClick={() =>
                void saveIssueWorkflow(issue.id, {
                  assignee: "",
                })
              }
            >
              Unassign
            </button>
          ) : null}
        </TableWorkflowDropdown>
      </td>
      <td className="mono">{fmt(issue.firstSeen)}</td>
      <td className="mono">{fmt(issue.lastSeen)}</td>
      <td>
        <button
          className="btn btn-ghost issue-delete-btn"
          type="button"
          disabled={deleting}
          onClick={() =>
            setDeleteIntent({
              type: "one",
              issueId: issue.id,
              title: issue.message,
              count: 1,
            })
          }
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
