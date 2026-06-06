import type { ScreenshotRegion } from "./region.js";

export function sanitizeScreenshotClone(root: HTMLElement): void {
  root
    .querySelectorAll(
      'link[rel="stylesheet"], link[rel="preload"], link[rel="modulepreload"], iframe, object, embed',
    )
    .forEach((node) => {
      node.remove();
    });

  root.querySelectorAll("style").forEach((node) => {
    node.textContent = (node.textContent ?? "")
      .replace(/@font-face\s*{[^}]*}/gi, "")
      .replace(/url\((?!['"]?data:)[^)]+\)/gi, "none");
  });

  root.querySelectorAll("img, source").forEach((node) => {
    node.removeAttribute("src");
    node.removeAttribute("srcset");
  });

  root.querySelectorAll("video").forEach((node) => {
    node.removeAttribute("poster");
    node.textContent = "";
  });

  root.querySelectorAll("canvas").forEach((node) => {
    const placeholder = document.createElement("div");
    placeholder.setAttribute(
      "style",
      "width:100%;height:100%;background:rgba(148,163,184,0.12);",
    );
    node.replaceWith(placeholder);
  });

  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.style.backgroundImage = "none";
    node.style.maskImage = "none";
    node.style.webkitMaskImage = "none";
  });
}

export function createFallbackScreenshot(
  region: ScreenshotRegion,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width));
  canvas.height = Math.max(1, Math.round(region.height));
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#94a3b8";
  context.setLineDash([8, 8]);
  context.strokeRect(
    12,
    12,
    Math.max(1, canvas.width - 24),
    Math.max(1, canvas.height - 24),
  );
  context.setLineDash([]);
  context.fillStyle = "#334155";
  context.font = "14px sans-serif";
  context.fillText("Selected page area", 24, 38);
  context.fillStyle = "#64748b";
  context.font = "12px sans-serif";
  context.fillText(
    "Browser blocked exact canvas export for this page.",
    24,
    60,
  );
  return canvas;
}

export async function renderViewportCanvas(
  safeMode = false,
): Promise<HTMLCanvasElement> {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const source = document.documentElement.cloneNode(true) as HTMLElement;

  source
    .querySelectorAll(
      "script, .artstrace-report-backdrop, .artstrace-report-fab, .artstrace-capture-select",
    )
    .forEach((node) => node.remove());
  if (safeMode) {
    sanitizeScreenshotClone(source);
  }
  source.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const docWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
    width,
  );
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    height,
  );
  const serialized = new XMLSerializer().serializeToString(source);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="${-window.scrollX}" y="${-window.scrollY}" width="${docWidth}" height="${docHeight}">
        ${serialized}
      </foreignObject>
    </svg>
  `;

  const image = new Image();
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Could not render this page screenshot"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to capture screenshot");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    context.drawImage(image, 0, 0, width, height);
    try {
      canvas.toDataURL("image/png");
    } catch {
      if (!safeMode) {
        return renderViewportCanvas(true);
      }
      return createFallbackScreenshot({ x: 0, y: 0, width, height });
    }
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
