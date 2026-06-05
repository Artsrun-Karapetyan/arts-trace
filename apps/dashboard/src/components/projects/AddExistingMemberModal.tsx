import { useState } from "react";

import { PROJECT_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/helpers/roles";
import {
  addExistingProjectMember,
  type ProjectMemberRow,
  type ProjectRole,
} from "@/lib";

export interface AddExistingMemberModalProps {
  projectId: string;
  onClose: () => void;
  onMemberAdded: (member: ProjectMemberRow) => void;
}

export function AddExistingMemberModal({
  projectId,
  onClose,
  onMemberAdded,
}: AddExistingMemberModalProps) {
  const [existingEmail, setExistingEmail] = useState("");
  const [existingRole, setExistingRole] = useState<ProjectRole>("MEMBER");
  const [saving, setSaving] = useState(false);

  const addExistingMember = async () => {
    if (!existingEmail.trim()) return;
    setSaving(true);
    try {
      const member = await addExistingProjectMember(projectId, {
        email: existingEmail.trim(),
        role: existingRole,
      });
      onMemberAdded(member);
      setExistingEmail("");
      setExistingRole("MEMBER");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="workflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="existing-member-title"
      >
        <div className="workflow-modal-head">
          <div>
            <h3 id="existing-member-title">Add existing member</h3>
            <p>Directly add a user who already has an account.</p>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="workflow-modal-grid">
          <label className="issue-workflow-field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={existingEmail}
              placeholder="arts@example.com"
              onChange={(event) => setExistingEmail(event.target.value)}
            />
          </label>
          <label className="issue-workflow-field">
            <span>Role</span>
            <select
              className="input"
              value={existingRole}
              onChange={(event) =>
                setExistingRole(event.target.value as ProjectRole)
              }
            >
              {PROJECT_ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </label>

          <div className="role-legend">
            {PROJECT_ROLES.map((item) => (
              <div
                className={`role-legend-item project-role-${item.toLowerCase()}`}
                key={item}
              >
                <div className="role-legend-head">
                  <span
                    className={`project-role-pill project-role-${item.toLowerCase()}`}
                  >
                    {ROLE_LABELS[item]}
                  </span>
                </div>
                <div className="small-note" style={{ marginTop: 6 }}>
                  {ROLE_DESCRIPTIONS[item]}
                </div>
              </div>
            ))}
          </div>

          <div className="confirm-modal-actions">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="btn"
              type="button"
              disabled={saving || !existingEmail.trim()}
              onClick={() => void addExistingMember()}
            >
              {saving ? "Adding..." : "Add member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
