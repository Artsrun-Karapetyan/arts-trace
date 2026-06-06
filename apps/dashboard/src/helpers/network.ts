import type { EventRow } from "@/lib";

export function isNetworkError(
  request: NonNullable<EventRow["networkRequests"]>[number],
): boolean {
  return (
    Boolean(request.error) ||
    (typeof request.status === "number" && request.status >= 400)
  );
}

export function getRequestName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
  } catch {
    return url.split("?")[0]?.split("/").filter(Boolean).pop() || url;
  }
}

export function formatStatus(
  request: NonNullable<EventRow["networkRequests"]>[number],
): string {
  if (request.status) return String(request.status);
  return request.error ? "failed" : "-";
}

export function getRequestType(
  request: NonNullable<EventRow["networkRequests"]>[number],
): string {
  const contentType =
    request.responseHeaders?.["content-type"] ??
    request.responseHeaders?.["Content-Type"] ??
    request.requestHeaders?.["content-type"] ??
    request.requestHeaders?.["Content-Type"];
  if (!contentType) return request.method;
  if (contentType.includes("application/json")) return "json";
  if (contentType.includes("text/html")) return "html";
  if (contentType.includes("text/")) return "text";
  return contentType.split(";")[0]?.split("/").pop() ?? request.method;
}

export function formatSize(
  request: NonNullable<EventRow["networkRequests"]>[number],
): string {
  const bytes =
    byteLength(request.responseBody) +
    byteLength(request.requestBody) +
    byteLength(request.error);
  if (bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

export function byteLength(value?: string | null): number {
  return value ? new Blob([value]).size : 0;
}
