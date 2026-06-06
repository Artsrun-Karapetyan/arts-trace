import type { ReactNode } from "react";

export function TableWorkflowDropdown({
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
    <span className="workflow-dropdown workflow-dropdown-table">
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
