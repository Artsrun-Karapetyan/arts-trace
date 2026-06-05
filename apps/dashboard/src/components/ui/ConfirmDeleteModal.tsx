export interface DeleteIntent {
  type: "one" | "visible" | "all";
  issueId?: string;
  title: string;
  count: number;
}

export function ConfirmDeleteModal({
  intent,
  deleting,
  onCancel,
  onConfirm,
}: {
  intent: DeleteIntent;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-issue-title"
      >
        <div className="confirm-modal-icon">!</div>
        <div>
          <h3 id="delete-issue-title">{intent.title}</h3>
          <p>
            This will permanently delete {intent.count}{" "}
            {intent.count === 1 ? "issue" : "issues"} with all related events,
            breadcrumbs, replay, and network data.
          </p>
        </div>
        <div className="confirm-modal-actions">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={deleting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
