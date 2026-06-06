import { useState } from "react";

import { formatPrimitive } from "@/helpers/format";

export function JsonNode({
  name,
  value,
  level,
  defaultOpen = false,
}: {
  name: string;
  value: unknown;
  level: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isObject = typeof value === "object" && value !== null;

  if (!isObject) {
    return (
      <div className="json-row" style={{ paddingLeft: level * 14 }}>
        <span className="json-key">{name}</span>
        <span className="json-sep">: </span>
        <span className="json-value">{formatPrimitive(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, idx) => [String(idx), item] as const)
    : Object.entries(value as Record<string, unknown>);

  const bracketOpen = Array.isArray(value) ? "[" : "{";
  const bracketClose = Array.isArray(value) ? "]" : "}";

  return (
    <div>
      <div className="json-row" style={{ paddingLeft: level * 14 }}>
        <button
          type="button"
          className="json-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "▾" : "▸"}
        </button>
        <span className="json-key">{name}</span>
        <span className="json-sep">: </span>
        <span className="json-bracket">{bracketOpen}</span>
        {!open && (
          <span className="json-collapsed">… {entries.length} items</span>
        )}
        {!open && <span className="json-bracket">{bracketClose}</span>}
      </div>
      {open &&
        entries.map(([k, v]) => (
          <JsonNode key={`${name}-${k}`} name={k} value={v} level={level + 1} />
        ))}
      {open && (
        <div className="json-row" style={{ paddingLeft: level * 14 }}>
          <span className="json-bracket">{bracketClose}</span>
        </div>
      )}
    </div>
  );
}
