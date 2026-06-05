import { PriorityIcon } from "@/components/ui/PriorityIcon";
import type { IssuePriority } from "@/lib";

export function PriorityBadge({
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
