export function extractMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return "Unhandled rejection";
  }
}

export function extractStack(reason: unknown): string | undefined {
  if (reason instanceof Error) return reason.stack;
  return undefined;
}
