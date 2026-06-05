export type SourceLocation = {
  filePath: string;
  fileName: string;
  line: number;
  column: number;
};

export function getWindowErrorSource(event: ErrorEvent): SourceLocation | null {
  if (!event.filename || event.lineno <= 0 || event.colno <= 0) return null;
  return {
    filePath: event.filename,
    fileName: getFileName(event.filename),
    line: event.lineno,
    column: event.colno,
  };
}

export function pickBestSource(stack?: string): SourceLocation | null {
  if (!stack) return null;

  const frames = stack
    .split("\n")
    .map((line) => line.trim())
    .map(parseStackFrame)
    .filter(
      (x): x is { filePath: string; line: number; column: number } =>
        x !== null,
    );

  if (frames.length === 0) return null;
  const preferred = frames.find((frame) => isPreferredFrame(frame.filePath));
  const selected = preferred ?? frames[0];

  return {
    filePath: selected.filePath,
    fileName: getFileName(selected.filePath),
    line: selected.line,
    column: selected.column,
  };
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function parseStackFrame(
  line: string,
): { filePath: string; line: number; column: number } | null {
  const match = line.match(/((?:https?:\/\/|\/)[^)\s]+):(\d+):(\d+)/);
  if (!match) return null;

  const lineNumber = Number(match[2]);
  const columnNumber = Number(match[3]);
  if (Number.isNaN(lineNumber) || Number.isNaN(columnNumber)) return null;

  return {
    filePath: match[1],
    line: lineNumber,
    column: columnNumber,
  };
}

function isPreferredFrame(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  if (lowered.includes("/src/")) return true;
  const blocked = ["node_modules", "@vite", "/vite/", "react-dom", "chunk-"];
  return !blocked.some((token) => lowered.includes(token));
}
