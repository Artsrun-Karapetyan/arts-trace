export type Html2Canvas = typeof import("html2canvas").default;
let html2CanvasPromise: Promise<Html2Canvas | null> | null = null;

export function loadHtml2Canvas(): Promise<Html2Canvas | null> {
  html2CanvasPromise ??= import("html2canvas")
    .then((mod) => mod.default)
    .catch(() => {
      const candidate = (window as typeof window & { html2canvas?: unknown })
        .html2canvas;
      return typeof candidate === "function"
        ? (candidate as Html2Canvas)
        : null;
    });

  return html2CanvasPromise;
}
