import { MAX_BREADCRUMBS } from "./constants.ts";
import type { Breadcrumb } from "./types.ts";

const breadcrumbs: Breadcrumb[] = [];

export function snapshotBreadcrumbs(): Breadcrumb[] {
  return breadcrumbs.slice(-MAX_BREADCRUMBS);
}

export function patchConsole(): void {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    try {
      const message = args
        .map((a) => {
          if (typeof a === "string") return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" ")
        .slice(0, 300);

      pushBreadcrumb({
        type: "console.error",
        message: message || "console.error",
        data: { argsCount: args.length },
      });
    } catch {
      // no-op
    }
    originalError(...args);
  };
}

export function captureNavigation(): void {
  const push = () => {
    pushBreadcrumb({
      type: "navigation",
      message: window.location.href,
    });
  };

  push();
  window.addEventListener("popstate", push);
  window.addEventListener("hashchange", push);
}

export function captureClicks(): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase() ?? "unknown";
      const text = (target.textContent ?? "").trim().slice(0, 80);
      const id = target.id ? `#${target.id}` : "";
      const cls =
        target.className && typeof target.className === "string"
          ? `.${target.className.split(" ").slice(0, 2).join(".")}`
          : "";

      pushBreadcrumb({
        type: "click",
        message: `${tag}${id}${cls}`,
        data: {
          text,
        },
      });
    },
    { capture: true },
  );
}

function pushBreadcrumb(item: Omit<Breadcrumb, "createdAt">): void {
  breadcrumbs.push({ ...item, createdAt: new Date().toISOString() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}
