import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  addExistingProjectMember,
  createProjectInvite,
  deleteProjectMember,
  fetchProjectMembers,
  fmt,
  updateProjectMember,
  type ProjectInviteRow,
  type ProjectMemberRow,
  type ProjectRole,
  fetchProject
} from "../../../lib";

const PROJECT_ROLES: ProjectRole[] = ["MAINTAINER", "MEMBER", "VIEWER"];
const ROLE_LABELS: Record<ProjectRole, string> = {
  MAINTAINER: "Maintainer",
  MEMBER: "Member",
  VIEWER: "Viewer"
};
const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  MAINTAINER: "Full control: invites, roles, removal, settings, delete project.",
  MEMBER: "Normal project access: can work, comment, and use assigned features.",
  VIEWER: "Read-only: can open the project but cannot change team or settings."
};

export const Route = createFileRoute("/_authenticated/projects/$id/team")({
  loader: async ({ params }) => {
    const [project, members] = await Promise.all([fetchProject(params.id), fetchProjectMembers(params.id)]);
    return { project, members };
  },
  component: ProjectTeamPage
});

function ProjectTeamPage() {
  const { project, members: initialMembers } = Route.useLoaderData();
  const { id } = Route.useParams();
  const [members, setMembers] = useState<ProjectMemberRow[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("MEMBER");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [existingMemberModalOpen, setExistingMemberModalOpen] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<ProjectInviteRow | null>(null);
  const [existingEmail, setExistingEmail] = useState("");
  const [existingRole, setExistingRole] = useState<ProjectRole>("MEMBER");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const canManage = project.accessRole === "MAINTAINER";

  const createInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSaving(true);
    try {
      const invite = await createProjectInvite(id, { email: inviteEmail.trim(), role });
      setCreatedInvite(invite);
      setInviteEmail("");
      setRole("MEMBER");
    } finally {
      setSaving(false);
    }
  };

  const addExistingMember = async () => {
    if (!existingEmail.trim()) return;
    setSaving(true);
    try {
      const member = await addExistingProjectMember(id, { email: existingEmail.trim(), role: existingRole });
      setMembers((items) => [...items, member]);
      setExistingEmail("");
      setExistingRole("MEMBER");
      setExistingMemberModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

  const copyInviteLink = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token));
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 1600);
  };

  const removeMember = async (memberId: string) => {
    setSaving(true);
    try {
      await deleteProjectMember(id, memberId);
      setMembers((items) => items.filter((item) => item.id !== memberId));
    } finally {
      setSaving(false);
    }
  };

  const changeMemberRole = async (memberId: string, nextRole: ProjectRole) => {
    setSaving(true);
    try {
      const updated = await updateProjectMember(id, memberId, { role: nextRole });
      setMembers((items) => items.map((item) => (item.id === memberId ? updated : item)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>Team</h2>
        <div className="project-actions">
          <button className="btn btn-ghost" type="button" disabled={!canManage} onClick={() => setExistingMemberModalOpen(true)}>
            Add existing member
          </button>
          <button className="btn" type="button" disabled={!canManage} onClick={() => setInviteModalOpen(true)}>
            Invite person
          </button>
        </div>
      </div>
      <div className="panel team-list">
        {members.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">+</div>
            <div className="empty-state-text">No team members yet.</div>
          </div>
        ) : (
          members.map((member) => (
            <div className="team-member-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                {member.role ? <span className={`project-role-pill project-role-${member.role.toLowerCase()}`}>{ROLE_LABELS[member.role]}</span> : null}
                <div className="mono small-note">Added {fmt(member.createdAt)}</div>
              </div>
              <div className="team-member-actions">
                <select
                  className="input team-role-select"
                  value={member.role ?? "MEMBER"}
                  disabled={!canManage || saving}
                  onChange={(event) => void changeMemberRole(member.id, event.target.value as ProjectRole)}
                >
                  {PROJECT_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost issue-delete-btn" type="button" disabled={!canManage || saving} onClick={() => void removeMember(member.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {inviteModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="invite-person-title">
            <div className="workflow-modal-head">
              <div>
                <h3 id="invite-person-title">Invite person</h3>
                <p>Create a private invite link for a specific email and project role.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => {
                setInviteModalOpen(false);
                setCreatedInvite(null);
              }} aria-label="Close">x</button>
            </div>
            {createdInvite ? (
              <div className="invite-created-box">
                <div className="section-title">Invite link ready</div>
                <strong>{createdInvite.email}</strong>
                {createdInvite.role ? <span className={`project-role-pill project-role-${createdInvite.role.toLowerCase()}`}>{ROLE_LABELS[createdInvite.role]}</span> : null}
                <div className="mono invite-created-link">{inviteUrl(createdInvite.token)}</div>
                <div className="small-note">Expires {fmt(createdInvite.expiresAt)}</div>
                <div className="confirm-modal-actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    className={`btn invite-primary ${inviteCopied ? "copied" : ""}`}
                    type="button"
                    onClick={() => void copyInviteLink(createdInvite.token)}
                    title={inviteCopied ? "Link copied!" : "Copy invite link"}
                  >
                    {inviteCopied ? "✓ Copied!" : "Copy link"}
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => setCreatedInvite(null)}>
                    Create another
                  </button>
                </div>
              </div>
            ) : (
              <div className="workflow-modal-grid">
                <label className="issue-workflow-field">
                  <span>Email</span>
                  <input className="input" type="email" value={inviteEmail} placeholder="person@company.com" onChange={(event) => setInviteEmail(event.target.value)} />
                </label>
                <label className="issue-workflow-field">
                  <span>Role</span>
                  <select className="input" value={role} onChange={(event) => setRole(event.target.value as ProjectRole)}>
                    {PROJECT_ROLES.map((item) => (
                      <option key={item} value={item}>
                        {ROLE_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="role-legend">
                  {PROJECT_ROLES.map((item) => (
                    <div className={`role-legend-item project-role-${item.toLowerCase()}`} key={item}>
                      <div className="role-legend-head">
                        <span className={`project-role-pill project-role-${item.toLowerCase()}`}>{ROLE_LABELS[item]}</span>
                      </div>
                      <div className="small-note" style={{ marginTop: 6 }}>{ROLE_DESCRIPTIONS[item]}</div>
                    </div>
                  ))}
                </div>
                <div className="confirm-modal-actions">
                  <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => setInviteModalOpen(false)}>Cancel</button>
                  <button className="btn" type="button" disabled={saving || !inviteEmail.trim()} onClick={() => void createInvite()}>
                    {saving ? "Creating..." : "Create link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {existingMemberModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="existing-member-title">
            <div className="workflow-modal-head">
              <div>
                <h3 id="existing-member-title">Add existing member</h3>
                <p>Add a registered user to this project immediately.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setExistingMemberModalOpen(false)} aria-label="Close">x</button>
            </div>

            <div className="workflow-modal-grid">
              <label className="issue-workflow-field">
                <span>Email</span>
                <input className="input" type="email" value={existingEmail} placeholder="arts@example.com" onChange={(event) => setExistingEmail(event.target.value)} />
              </label>
              <label className="issue-workflow-field">
                <span>Role</span>
                <select className="input" value={existingRole} onChange={(event) => setExistingRole(event.target.value as ProjectRole)}>
                  {PROJECT_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="role-legend">
                {PROJECT_ROLES.map((item) => (
                  <div className={`role-legend-item project-role-${item.toLowerCase()}`} key={item}>
                    <div className="role-legend-head">
                      <span className={`project-role-pill project-role-${item.toLowerCase()}`}>{ROLE_LABELS[item]}</span>
                    </div>
                    <div className="small-note" style={{ marginTop: 6 }}>{ROLE_DESCRIPTIONS[item]}</div>
                  </div>
                ))}
              </div>

              <div className="confirm-modal-actions">
                <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => setExistingMemberModalOpen(false)}>Cancel</button>
                <button className="btn" type="button" disabled={saving || !existingEmail.trim()} onClick={() => void addExistingMember()}>
                  {saving ? "Adding..." : "Add member"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
