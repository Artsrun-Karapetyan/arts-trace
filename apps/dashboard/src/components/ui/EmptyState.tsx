import type { ReactNode } from "react";

export function EmptyState({
  icon,
  text,
  style,
}: {
  icon: ReactNode;
  text: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="empty-state" style={style}>
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-text">{text}</div>
    </div>
  );
}
