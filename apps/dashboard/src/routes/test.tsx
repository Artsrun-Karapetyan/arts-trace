import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { init } from "@artstrace/browser";

export const Route = createFileRoute("/test")({
  component: TestPage
});

function TestPage() {
  useEffect(() => {
    const apiKey = import.meta.env.VITE_ARTSTRACE_API_KEY ?? "project_public_api_key";
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

    init({
      apiKey,
      endpoint: `${apiBase}/events`
    });
  }, []);

  return (
    <div>
      <h2>SDK Test</h2>
      <p>This page initializes the browser SDK.</p>
      <button onClick={() => { throw new Error("ArtsTrace Test"); }}>
        Throw JS Error
      </button>
      <button
        onClick={() => {
          Promise.reject(new Error("ArtsTrace Promise Rejection Test"));
        }}
      >
        Trigger Unhandled Rejection
      </button>
    </div>
  );
}
