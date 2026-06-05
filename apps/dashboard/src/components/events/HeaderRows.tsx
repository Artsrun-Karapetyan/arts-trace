export function HeaderRows({
  headers,
}: {
  headers?: Record<string, string> | null;
}) {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0)
    return (
      <div className="network-detail-row">
        <span className="small-note" style={{ marginTop: 0 }}>
          -
        </span>
        <span>-</span>
      </div>
    );

  return entries.map(([key, value]) => (
    <div className="network-detail-row" key={key}>
      <span className="small-note" style={{ marginTop: 0 }}>
        {key}
      </span>
      <span className="mono">{value}</span>
    </div>
  ));
}
