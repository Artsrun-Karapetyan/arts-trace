import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AddExistingMemberModal } from "@/components/projects/AddExistingMemberModal";
import { InvitePersonModal } from "@/components/projects/InvitePersonModal";
import { PROJECT_ROLES, ROLE_LABELS } from "@/helpers/roles";
import {
  deleteProjectMember,
  fetchProject,
  fetchProjectMembers,
  fmt,
  type ProjectMemberRow,
  type ProjectRole,
  updateProjectMember,
} from "@/lib";

export const Route = createFileRoute("/_authenticated/projects/$id/team")({
  loader: async ({ params }) => {
    const [project, members] = await Promise.all([
      fetchProject(params.id),
      fetchProjectMembers(params.id),
    ]);
    return { project, members };
  },
  component: ProjectTeamPage,
});

function ProjectTeamPage() {
  const { project, members: initialMembers } = Route.useLoaderData();
  const { id } = Route.useParams();
  const [members, setMembers] = useState<ProjectMemberRow[]>(initialMembers);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [existingMemberModalOpen, setExistingMemberModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canManage = project.accessRole === "MAINTAINER";
  const ownerLabel =
    project.owner?.name?.trim() || project.owner?.email || "Owner";
  const editableMembers = members.filter(
    (member) => member.userId !== project.owner?.id,
  );

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
      const updated = await updateProjectMember(id, memberId, {
        role: nextRole,
      });
      setMembers((items) =>
        items.map((item) => (item.id === memberId ? updated : item)),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2>Team</h2>
        <div className="project-actions">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!canManage}
            onClick={() => setExistingMemberModalOpen(true)}
          >
            Add existing member
          </button>
          <button
            className="btn"
            type="button"
            disabled={!canManage}
            onClick={() => setInviteModalOpen(true)}
          >
            Invite person
          </button>
        </div>
      </div>
      {project.owner ? (
        <div className="panel team-owner-panel">
          <div>
            <div className="section-title">Owner</div>
            <strong>{ownerLabel}</strong>
            <div className="mono small-note">{project.owner.email}</div>
          </div>
          <div className="project-role-pill project-role-maintainer">
            Maintainer
          </div>
        </div>
      ) : null}
      <div className="panel team-list">
        {editableMembers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">+</div>
            <div className="empty-state-text">
              No additional team members yet.
            </div>
          </div>
        ) : (
          editableMembers.map((member) => (
            <div className="team-member-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                {member.role ? (
                  <span
                    className={`project-role-pill project-role-${member.role.toLowerCase()}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                ) : null}
                <div className="mono small-note">
                  Added {fmt(member.createdAt)}
                </div>
              </div>
              <div className="team-member-actions">
                <select
                  className="input team-role-select"
                  value={member.role ?? "MEMBER"}
                  disabled={!canManage || saving}
                  onChange={(event) =>
                    void changeMemberRole(
                      member.id,
                      event.target.value as ProjectRole,
                    )
                  }
                >
                  {PROJECT_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost issue-delete-btn"
                  type="button"
                  disabled={!canManage || saving}
                  onClick={() => void removeMember(member.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {inviteModalOpen ? (
        <InvitePersonModal
          projectId={id}
          onClose={() => setInviteModalOpen(false)}
        />
      ) : null}

      {existingMemberModalOpen ? (
        <AddExistingMemberModal
          projectId={id}
          onClose={() => setExistingMemberModalOpen(false)}
          onMemberAdded={(member) => setMembers((items) => [...items, member])}
        />
      ) : null}
    </div>
  );
}
