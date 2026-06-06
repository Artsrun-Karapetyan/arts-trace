import { useState } from "react";

import type { EventRow } from "@/lib";
import { fmt } from "@/lib";

interface EventBreadcrumbsProps {
  breadcrumbs: NonNullable<EventRow["breadcrumbs"]>;
}

export function EventBreadcrumbs({ breadcrumbs }: EventBreadcrumbsProps) {
  const [showAllBreadcrumbs, setShowAllBreadcrumbs] = useState(false);
  const breadcrumbLimit = 10;
  const visibleBreadcrumbs = showAllBreadcrumbs
    ? breadcrumbs
    : breadcrumbs.slice(-breadcrumbLimit);

  return (
    <>
      <div className="page-head" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: 17 }}>Breadcrumbs</h2>
        {breadcrumbs.length > breadcrumbLimit ? (
          <button
            className="btn btn-ghost"
            onClick={() => setShowAllBreadcrumbs((v) => !v)}
          >
            {showAllBreadcrumbs
              ? "Show less"
              : `Show more (${breadcrumbs.length - breadcrumbLimit})`}
          </button>
        ) : null}
      </div>
      <div className="panel">
        {breadcrumbs.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 16px" }}>
            <div className="empty-state-icon" style={{ fontSize: 24 }}>
              🍞
            </div>
            <div className="empty-state-text">No breadcrumbs captured</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {visibleBreadcrumbs.map(
                (b: NonNullable<EventRow["breadcrumbs"]>[number]) => (
                  <tr key={b.id}>
                    <td className="mono">{fmt(b.createdAt)}</td>
                    <td>{b.type}</td>
                    <td>{b.message}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
