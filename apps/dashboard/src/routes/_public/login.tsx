import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/_public/login")({
  component: LoginPage,
});

function LoginPage() {
  return <AuthForm mode="login" />;
}
