import type { IngestEventInput } from "@artstrace/shared";

type InitOptions = {
  apiKey: string;
  endpoint?: string;
};

const DEFAULT_ENDPOINT = "http://localhost:3000/events";

let isInitialized = false;

export function init(options: InitOptions): void {
  if (isInitialized) return;
  if (!options.apiKey) throw new Error("ArtsTrace init requires apiKey");

  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  window.addEventListener("error", (event) => {
    const payload: IngestEventInput = {
      apiKey: options.apiKey,
      message: event.message || "Unknown error",
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    void sendEvent(endpoint, payload);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = extractMessage(reason);
    const stack = extractStack(reason);

    const payload: IngestEventInput = {
      apiKey: options.apiKey,
      message,
      stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    void sendEvent(endpoint, payload);
  });

  isInitialized = true;
}

function extractMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return "Unhandled rejection";
  }
}

function extractStack(reason: unknown): string | undefined {
  if (reason instanceof Error) return reason.stack;
  return undefined;
}

async function sendEvent(endpoint: string, payload: IngestEventInput): Promise<void> {
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // no-op: monitoring should never break the host app
  }
}
