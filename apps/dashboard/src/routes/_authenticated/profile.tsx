import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage
});

function ProfilePage() {
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(auth.user?.name ?? "");
  }, [auth.user?.name]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await auth.updateProfile({ name: name.trim() || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Profile</h2>
          <p className="small-note">Update your display name for comments and team assignment.</p>
        </div>
      </div>

      <div className="panel profile-panel">
        <aside className="profile-aside">
          <div className="profile-avatar">{(auth.user?.name?.trim()?.[0] ?? auth.user?.email?.[0] ?? "U").toUpperCase()}</div>
          <div>
            <div className="section-title">Signed in as</div>
            <div className="profile-aside-name">{auth.user?.name?.trim() || "Unnamed user"}</div>
            <div className="mono profile-aside-email">{auth.user?.email ?? "-"}</div>
          </div>
          <div className="profile-aside-pill">Display name</div>
        </aside>

        <form className="profile-form" onSubmit={onSubmit}>
          <div>
            <div className="section-title">Profile details</div>
            <p className="small-note" style={{ marginTop: 0 }}>
              Name is used in comments, assignees, and team displays.
            </p>
          </div>

          <label className="auth-field">
            <span>Name</span>
            <input
              className="input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={120}
            />
          </label>

          <div className="profile-readonly">
            <div className="profile-readonly-label">Email</div>
            <div className="profile-readonly-value">{auth.user?.email ?? "-"}</div>
          </div>

          {error ? <p className="small-note auth-error">{error}</p> : null}
          {saved ? <p className="small-note" style={{ color: "#6ee7b7" }}>Profile saved.</p> : null}

          <div className="confirm-modal-actions profile-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
