export function ensureRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("ArtsTrace browser SDK can only run in a browser");
  }
}
