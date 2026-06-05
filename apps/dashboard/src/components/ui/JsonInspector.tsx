import { JsonNode } from "./JsonNode";

export function JsonInspector({ value }: { value: unknown }) {
  if (value == null) return <pre>-</pre>;
  if (typeof value === "string") return <pre>{value}</pre>;
  if (typeof value !== "object") return <pre>{String(value)}</pre>;
  return (
    <div className="json-tree">
      <JsonNode
        name={Array.isArray(value) ? "[root]" : "{root}"}
        value={value}
        level={0}
        defaultOpen
      />
    </div>
  );
}
