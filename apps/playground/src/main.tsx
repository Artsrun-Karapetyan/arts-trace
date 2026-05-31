import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { init } from "@artstrace/browser";

function App() {
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
    const apiKey = import.meta.env.VITE_ARTSTRACE_API_KEY ?? "project_public_api_key";

    init({
      apiKey,
      endpoint: `${apiBase}/events`
    });
  }, []);

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>ArtsTrace Playground</h1>
      <p>Use this app to trigger browser errors captured by @artstrace/browser.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => { throw new Error("ArtsTrace Test Error"); }}>
          Throw Error
        </button>
        <button
          onClick={() => {
            Promise.reject(new Error("ArtsTrace Unhandled Rejection"));
          }}
        >
          Unhandled Rejection
        </button>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
