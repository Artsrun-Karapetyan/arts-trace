import { MAX_NETWORK } from "./constants.ts";
import type { NetworkRequest } from "./types.ts";

const networkRequests: NetworkRequest[] = [];

export function snapshotNetwork(): NetworkRequest[] {
  return networkRequests.slice(-MAX_NETWORK);
}

export function patchFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const started = Date.now();
    const req = args[0];
    const init = args[1];
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof req === "string" ? req : req instanceof URL ? req.toString() : req.url;
    const requestHeaders = headersToRecord(init?.headers ?? (req instanceof Request ? req.headers : undefined));
    const requestBody = normalizeBody(init?.body);

    try {
      const res = await originalFetch(...args);
      const responseBody = await readResponseBody(res);
      pushNetwork({
        method,
        url,
        status: res.status,
        requestHeaders,
        requestBody,
        responseHeaders: headersToRecord(res.headers),
        responseBody,
        duration: Date.now() - started
      });
      return res;
    } catch (error) {
      pushNetwork({
        method,
        url,
        requestHeaders,
        requestBody,
        error: toErrorMessage(error),
        duration: Date.now() - started
      });
      throw error;
    }
  };
}

export function patchXhr(): void {
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  const setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> }).__at_method = method;
    (this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> }).__at_url = String(url);
    (this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> }).__at_request_headers = {};
    return open.apply(this, [method, url, ...rest] as unknown as Parameters<XMLHttpRequest["open"]>);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const self = this as XMLHttpRequest & { __at_request_headers?: Record<string, string> };
    if (!self.__at_request_headers) self.__at_request_headers = {};
    self.__at_request_headers[name.toLowerCase()] = clamp(String(value), 300);
    return setRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (...args: unknown[]) {
    const started = Date.now();
    const self = this as XMLHttpRequest & { __at_method?: string; __at_url?: string; __at_request_headers?: Record<string, string> };

    const done = () => {
      const responseBody = typeof self.responseText === "string" ? clamp(self.responseText, 2_000) : undefined;
      pushNetwork({
        method: (self.__at_method ?? "GET").toUpperCase(),
        url: self.__at_url ?? "unknown",
        status: self.status || undefined,
        requestHeaders: self.__at_request_headers,
        requestBody: normalizeBody(args[0]),
        responseHeaders: headersFromRaw(self.getAllResponseHeaders()),
        responseBody,
        error: self.status === 0 ? "network_error" : undefined,
        duration: Date.now() - started
      });
      self.removeEventListener("loadend", done);
    };

    self.addEventListener("loadend", done);
    return send.call(this, ...(args as []));
  };
}

function pushNetwork(item: Omit<NetworkRequest, "createdAt">): void {
  networkRequests.push({ ...item, createdAt: new Date().toISOString() });
  if (networkRequests.length > MAX_NETWORK) networkRequests.shift();
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value;
}

function headersToRecord(input?: HeadersInit): Record<string, string> | undefined {
  if (!input) return undefined;
  try {
    const headers = new Headers(input);
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = clamp(String(value), 300);
    });
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function headersFromRaw(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  const result: Record<string, string> = {};
  raw
    .split("\r\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(":");
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (!key) return;
      result[key] = clamp(value, 300);
    });
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return clamp(body, 2_000);
  if (body instanceof URLSearchParams) return clamp(body.toString(), 2_000);
  if (body instanceof FormData) return "[FormData]";
  if (body instanceof Blob) return `[Blob ${body.type || "unknown"} ${body.size}b]`;
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength}b]`;
  if (ArrayBuffer.isView(body)) return `[TypedArray ${body.byteLength}b]`;
  return `[${Object.prototype.toString.call(body)}]`;
}

async function readResponseBody(res: Response): Promise<string | undefined> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (!/json|text|xml|html|javascript/i.test(contentType)) return undefined;
    const text = await res.clone().text();
    return clamp(text, 2_000);
  } catch {
    return undefined;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return clamp(error.message, 300);
  return "network_error";
}
