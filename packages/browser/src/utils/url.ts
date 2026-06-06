export function getApiRoot(endpoint: string): string {
  const normalized = endpoint.replace(/\/+$/, "");
  return normalized.endsWith("/events")
    ? normalized.slice(0, -"/events".length)
    : normalized;
}
