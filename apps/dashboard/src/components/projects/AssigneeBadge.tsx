import { getInitials } from "@/helpers/format";

export function AssigneeBadge({ name }: { name: string }) {
  return (
    <span className="assignee-table-badge">
      <span className="assignee-mini-avatar">{getInitials(name)}</span>
      {name}
    </span>
  );
}
