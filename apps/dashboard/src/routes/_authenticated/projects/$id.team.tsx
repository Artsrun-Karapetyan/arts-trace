import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createProjectMember, deleteProjectMember, fetchProjectMembers, fmt, type ProjectMemberRow } from "../../../lib";

export const Route = createFileRoute("/_authenticated/projects/$id/team")({
  loader: ({ params }) => fetchProjectMembers(params.id),
  component: ProjectTeamPage
});

function ProjectTeamPage() {
  const initialMembers = Route.useLoaderData();
  const { id } = Route.useParams();
  const [members, setMembers] = useState<ProjectMemberRow[]>(initialMembers);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);

  const addMember = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await createProjectMember(id, { name: name.trim(), role: role.trim() || undefined });
      setMembers((items) => [...items, created]);
      setName("");
      setRole("");
    } finally {
      setSaving(false);
    }
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

  return (
    <div>
      <div className="page-head">
        <h2>Team</h2>
      </div>
      <div className="card team-card">
        <div>
          <div className="section-title">Add assignee</div>
          <p className="small-note">Only these people appear in issue assignee dropdowns.</p>
        </div>
        <div className="team-add-row">
          <input className="input" value={name} placeholder="Name" maxLength={120} onChange={(event) => setName(event.target.value)} />
          <input className="input" value={role} placeholder="Role, optional" maxLength={80} onChange={(event) => setRole(event.target.value)} />
          <button className="btn" type="button" disabled={saving || !name.trim()} onClick={() => void addMember()}>
            Add person
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
                {member.role ? <span className="affected-user-role">{member.role}</span> : null}
                <div className="mono small-note">Added {fmt(member.createdAt)}</div>
              </div>
              <button className="btn btn-ghost issue-delete-btn" type="button" disabled={saving} onClick={() => void removeMember(member.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
