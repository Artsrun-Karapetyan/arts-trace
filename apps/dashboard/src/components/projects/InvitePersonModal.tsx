import { useState } from "react";

import { PROJECT_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/helpers/roles";
import {
  createProjectInvite,
  fmt,
  type ProjectInviteRow,
  type ProjectRole,
} from "@/lib";

export interface InvitePersonModalProps {
  projectId: string;
  onClose: () => void;
}

export function InvitePersonModal({
  projectId,
  onClose,
}: InvitePersonModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("MEMBER");
  const [createdInvite, setCreatedInvite] = useState<ProjectInviteRow | null>(
    null,
  );
  const [inviteCopied, setInviteCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const createInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSaving(true);
    try {
      const invite = await createProjectInvite(projectId, {
        email: inviteEmail.trim(),
        role,
      });
      setCreatedInvite(invite);
      setInviteEmail("");
      setRole("MEMBER");
    } finally {
      setSaving(false);
    }
  };

  const inviteUrl = (token: string) =>
    `${window.location.origin}/invite/${token}`;

  const copyInviteLink = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token));
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="workflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-person-title"
      >
        <div className="workflow-modal-head">
          <div>
            <h3 id="invite-person-title">Invite person</h3>
            <p>
              Create a private invite link for a specific email and project
              role.
            </p>
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
        {createdInvite ? (
          <div className="invite-created-box">
            <div className="section-title">Invite generated</div>
            <strong>{createdInvite.email}</strong>
            {createdInvite.role ? (
              <span
                className={`project-role-pill project-role-${createdInvite.role.toLowerCase()}`}
              >
                {ROLE_LABELS[createdInvite.role]}
              </span>
            ) : null}
            <div className="mono invite-created-link">
              {inviteUrl(createdInvite.token)}
            </div>
            <div className="small-note">
              Expires {fmt(createdInvite.expiresAt)}
            </div>
            <div
              className="confirm-modal-actions"
              style={{ justifyContent: "flex-start" }}
            >
              <button
                className={`btn invite-primary ${inviteCopied ? "copied" : ""}`}
                type="button"
                onClick={() => void copyInviteLink(createdInvite.token)}
              >
                {inviteCopied ? "✓ Copied!" : "Copy link"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setCreatedInvite(null)}
              >
                Create another
              </button>
            </div>
          </div>
        ) : (
          <div className="workflow-modal-grid">
            <label className="issue-workflow-field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={inviteEmail}
                placeholder="person@company.com"
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </label>
            <label className="issue-workflow-field">
              <span>Role</span>
              <select
                className="input"
                value={role}
                onChange={(event) => setRole(event.target.value as ProjectRole)}
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
                disabled={saving || !inviteEmail.trim()}
                onClick={() => void createInvite()}
              >
                {saving ? "Creating..." : "Create link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
