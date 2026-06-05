import type { ReactNode } from "react";

export function FilterDropdown({
  title,
  value,
  open,
  options,
  onToggle,
}: {
  title: string;
  value: string;
  open: boolean;
  options: Array<{
    label: string;
    active: boolean;
    icon?: ReactNode;
    onClick: () => void;
  }>;
  onToggle: () => void;
}) {
  return (
    <div className="issue-filter-popover">
      <button
        className={`issue-filter-trigger ${open ? "issue-filter-trigger-open" : ""}`}
        type="button"
        onClick={onToggle}
      >
        <span className="issue-filter-label">{title}</span>
        <span className="issue-filter-value">{value}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
