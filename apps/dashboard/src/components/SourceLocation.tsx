import React, { useState } from "react";

interface SourceLocationProps {
  fileName?: string | null;
  line?: number | null;
  column?: number | null;
  stack?: string | null;
  message?: string | null;
}

function getAbsolutePath(fileName: string, stack?: string | null): string {
  if (stack) {
    const lines = stack.split("\n");
    for (const line of lines) {
      if (line.includes(fileName)) {
        const match = line.match(/((?:https?:\/\/|\/)[^)\s]+):(\d+):(\d+)/);
        if (match) {
          let parsedPath = match[1];
          // Remove protocol and host if it's a URL
          parsedPath = parsedPath.replace(/^https?:\/[^/]+/, "");
          // Remove query params
          parsedPath = parsedPath.split("?")[0];

          if (parsedPath.startsWith("/src/")) {
            return `/Users/artsrunkarapetyan/Documents/projects/bankruptcy-web${parsedPath}`;
          }
          if (parsedPath.startsWith("src/")) {
            return `/Users/artsrunkarapetyan/Documents/projects/bankruptcy-web/${parsedPath}`;
          }
          if (parsedPath.startsWith("/Users/")) {
            return parsedPath;
          }
        }
      }
    }
  }

  // Fallback: guess the path based on user workspace structure
  return `/Users/artsrunkarapetyan/Documents/projects/bankruptcy-web/src/components/Reminders/AddReminder/${fileName}`;
}

export function SourceLocation({
  fileName,
  line,
  column,
  stack,
  message,
}: SourceLocationProps) {
  const [copied, setCopied] = useState(false);
  if (!fileName) return <span>-</span>;

  const displayName = fileName.split("/").pop() ?? fileName;
  const absolutePath = getAbsolutePath(displayName, stack);

  const handleAntigravityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const prompt = `Please help me debug and fix this error: "${message ?? "Unknown error"}" in file:
${absolutePath}:${line ?? 1}:${column ?? 1}

Here is the error stack trace:
${stack ?? "No stack trace available"}`;

    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="source-location-container">
      <div
        className="source-location-badge"
        title={`Full path: ${absolutePath}`}
      >
        <span className="source-file">{displayName}</span>
        {line !== undefined && line !== null && (
          <span className="source-pos-badge source-line">
            <span className="source-pos-label">Line</span>
            {line}
          </span>
        )}
        {column !== undefined && column !== null && (
          <span className="source-pos-badge source-column">
            <span className="source-pos-label">Col</span>
            {column}
          </span>
        )}

        <button
          type="button"
          className={`ai-prompt-btn ${copied ? "copied" : ""}`}
          onClick={handleAntigravityClick}
          title={copied ? "Prompt copied!" : "Copy AI Prompt to debug"}
        >
          <span className="ai-icon">{copied ? "✅" : "🔮"}</span>
          <span>{copied ? "Copied!" : "AI Prompt"}</span>
        </button>
      </div>
    </div>
  );
}
