import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { acceptInvite, fetchInvite, fmt } from "../../../lib";

const ROLE_LABELS = {
  MAINTAINER: "Maintainer",
  MEMBER: "Member",
  VIEWER: "Viewer"
} as const;

export const Route = createFileRoute("/_hybrid/invite/$token")({
  loader: ({ params }) => fetchInvite(params.token),
  component: InvitePage
});

function InvitePage() {
  const invite = Route.useLoaderData();
  const { token } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const isAuthed = Boolean(auth.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const savePendingInvite = () => {
    localStorage.setItem("artstrace_pending_invite", token);
    localStorage.setItem("artstrace_pending_invite_email", invite.email);
  };

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const accepted = await acceptInvite(token);
      await navigate({ to: "/projects/$id/issues", params: { id: accepted.projectId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="invite-shell">
      <div className="invite-card">
        <div className="invite-badge">Project invite</div>
        <h1>Join {invite.projectName}</h1>
        <p>
          This invite is tied to <strong>{invite.email}</strong>. Log in or create an account with that email to join the project Team and get assigned.
        </p>

        <div className="invite-summary">
          <div>
            <span>Project</span>
            <strong>{invite.projectName}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{invite.email}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{invite.role ? ROLE_LABELS[invite.role] : "Member"}</strong>
          </div>
          <div>
            <span>Expires</span>
            <strong className="mono">{fmt(invite.expiresAt)}</strong>
          </div>
        </div>

        {error ? <p className="small-note auth-error">{error}</p> : null}

        {isAuthed ? (
          <button className="btn invite-primary" type="button" disabled={busy} onClick={() => void accept()}>
            {busy ? "Joining..." : "Accept invite"}
          </button>
        ) : (
          <div className="invite-actions">
            <Link className="btn invite-primary" to="/login" onClick={savePendingInvite}>
              Login to accept
            </Link>
            <Link className="btn btn-ghost" to="/register" onClick={savePendingInvite}>
              Create account
            </Link>
          </div>
        )}

        <div className="invite-note">
          Private invite link. Use the invited email to accept before it expires.
        </div>
      </div>
    </main>
  );
}
