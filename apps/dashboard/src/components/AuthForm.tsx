import { Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { acceptInvite } from "../lib";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem("artstrace_pending_invite_email") ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "login") {
        await auth.login({ email, password });
      } else {
        await auth.register({ email, password, name });
      }
      const pendingInvite = localStorage.getItem("artstrace_pending_invite");
      if (pendingInvite) {
        localStorage.removeItem("artstrace_pending_invite");
        localStorage.removeItem("artstrace_pending_invite_email");
        const accepted = await acceptInvite(pendingInvite);
        await navigate({ to: "/projects/$id/issues", params: { id: accepted.projectId } });
        return;
      }
      await navigate({ to: "/projects" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-hero">
        <div className="section-title">{mode === "login" ? "Welcome back" : "Create account"}</div>
        <h1 className="auth-title">{mode === "login" ? "Sign in to ArtsTrace" : "Register your workspace"}</h1>
        <p className="small-note auth-copy">
          {mode === "login"
            ? "Use your email and password to open the dashboard."
            : "Create your account with email and password to start tracking errors."}
        </p>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "register" ? (
          <label className="auth-field">
            <span>Name optional</span>
            <input
              className="input"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={120}
            />
          </label>
        ) : null}

        <label className="auth-field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>

        {error ? <p className="small-note auth-error">{error}</p> : null}

        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Login" : "Register"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <Link to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Register" : "Login"}</Link>
        </p>
      </form>
    </div>
  );
}
