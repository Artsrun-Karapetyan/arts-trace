import {
  captureClicks,
  captureNavigation,
  patchConsole,
  snapshotBreadcrumbs,
} from "./breadcrumbs.ts";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_REPLAY_POST_ERROR_MS,
  DEFAULT_REPLAY_PRE_ERROR_MS,
} from "./constants.ts";
import { patchFetch, patchXhr, snapshotNetwork } from "./network.ts";
import { snapshotReplay, startReplayCapture } from "./replay.ts";
import { getWindowErrorSource, pickBestSource } from "./source.ts";
import { sendEvent } from "./transport.ts";
import type {
  IngestEventInput,
  InitOptions,
  ManualReportAnnotation,
  ManualReportResponse,
  OpenReportDialogOptions,
  ReportBugInput,
} from "./types.ts";
import { getUserContext, setInitialUser } from "./user.ts";
export { mountReportBugButton } from "./report-bug.ts";
export { clearUser, setUser } from "./user.ts";

let isInitialized = false;
let replayPreErrorMs = DEFAULT_REPLAY_PRE_ERROR_MS;
let replayPostErrorMs = DEFAULT_REPLAY_POST_ERROR_MS;
let currentEndpoint = DEFAULT_ENDPOINT;
let currentApiKey = "";

export function init(options: InitOptions): void {
  if (isInitialized) return;
  if (!options.apiKey) throw new Error("ArtsTrace init requires apiKey");

  currentEndpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  currentApiKey = options.apiKey;
  setInitialUser(options.userId);
  replayPreErrorMs = normalizeDuration(
    options.replayPreErrorMs,
    DEFAULT_REPLAY_PRE_ERROR_MS,
    2_000,
    60_000,
  );
  replayPostErrorMs = normalizeDuration(
    options.replayPostErrorMs,
    DEFAULT_REPLAY_POST_ERROR_MS,
    0,
    30_000,
  );

  patchConsole();
  captureNavigation();
  captureClicks();
  patchFetch();
  patchXhr();
  startReplayCapture(replayPreErrorMs, replayPostErrorMs);

  window.addEventListener("error", (event) => {
    const source =
      pickBestSource(event.error?.stack) ?? getWindowErrorSource(event);

    const payload: IngestEventInput = {
      apiKey: options.apiKey,
      release: options.release,
      message: event.message || "Unknown error",
      stack: event.error?.stack,
      filePath: source?.filePath,
      fileName: source?.fileName,
      line: source?.line,
      column: source?.column,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...getUserContext(),
      breadcrumbs: snapshotBreadcrumbs(),
      networkRequests: snapshotNetwork(),
      replayEvents: snapshotReplay(),
    };

    void sendEvent(currentEndpoint, payload, {
      preErrorMs: replayPreErrorMs,
      postErrorMs: replayPostErrorMs,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = extractMessage(reason);
    const stack = extractStack(reason);
    const source = pickBestSource(stack);

    const payload: IngestEventInput = {
      apiKey: options.apiKey,
      release: options.release,
      message,
      stack,
      filePath: source?.filePath,
      fileName: source?.fileName,
      line: source?.line,
      column: source?.column,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...getUserContext(),
      breadcrumbs: snapshotBreadcrumbs(),
      networkRequests: snapshotNetwork(),
      replayEvents: snapshotReplay(),
    };

    void sendEvent(currentEndpoint, payload, {
      preErrorMs: replayPreErrorMs,
      postErrorMs: replayPostErrorMs,
    });
  });

  isInitialized = true;
}

export async function captureScreenshot(): Promise<string> {
  ensureRuntime();
  const region = await selectScreenshotRegion();
  await waitForNextPaint();
  const html2canvas = await loadHtml2Canvas();
  if (html2canvas) {
    const canvas = await html2canvas(document.body, {
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      allowTaint: false,
      x: region.x + window.scrollX,
      y: region.y + window.scrollY,
      width: region.width,
      height: region.height,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      ignoreElements: isArtstraceElement,
      onclone: (documentClone) => {
        copyAllBackgroundColors(document, documentClone);
        documentClone
          .querySelectorAll(
            "[class*='artstrace-report'], [class*='artstrace-capture']",
          )
          .forEach((node) => node.remove());
      },
    });
    return canvas.toDataURL("image/png");
  }

  const pageCanvas = await renderViewportCanvas();
  const output = document.createElement("canvas");
  const scaleX = pageCanvas.width / window.innerWidth;
  const scaleY = pageCanvas.height / window.innerHeight;
  output.width = Math.max(1, Math.round(region.width * scaleX));
  output.height = Math.max(1, Math.round(region.height * scaleY));

  const context = output.getContext("2d");
  if (!context) {
    throw new Error("Unable to capture screenshot");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);

  context.drawImage(
    pageCanvas,
    Math.round(region.x * scaleX),
    Math.round(region.y * scaleY),
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );

  try {
    return output.toDataURL("image/png");
  } catch {
    const fallback = createFallbackScreenshot(region);
    return fallback.toDataURL("image/png");
  }
}

export async function reportBug(
  input: ReportBugInput,
): Promise<ManualReportResponse> {
  ensureRuntime();
  if (!currentApiKey) {
    throw new Error("ArtsTrace reportBug requires init(apiKey)");
  }
  if (!input.title.trim()) {
    throw new Error("ArtsTrace reportBug requires a title");
  }

  const response = await fetch(
    `${getApiRoot(currentEndpoint)}/manual-reports`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectKey: currentApiKey,
        title: input.title,
        description: input.description,
        screenshotData: input.screenshotData,
        annotations: input.annotations,
        url: input.url ?? window.location.href,
        userAgent: input.userAgent ?? navigator.userAgent,
        createdByUserId: input.createdByUserId,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message
        ? `Failed to submit bug report: ${message}`
        : "Failed to submit bug report",
    );
  }

  return (await response.json()) as ManualReportResponse;
}

export function openReportDialog(options: OpenReportDialogOptions = {}): {
  close: () => void;
} {
  ensureRuntime();
  ensureReportStyles();

  const backdrop = document.createElement("div");
  backdrop.className = "artstrace-report-backdrop";
  backdrop.setAttribute("role", "presentation");

  const modal = document.createElement("div");
  modal.className = "artstrace-report-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="artstrace-report-head">
      <div>
        <div class="artstrace-report-kicker">Manual report</div>
        <h3>Report a bug</h3>
        <p>Capture what is broken, add a note, and send it as a manual issue.</p>
      </div>
      <button type="button" class="artstrace-report-close" aria-label="Close">×</button>
    </div>
    <div class="artstrace-report-screenshot">
      <div class="artstrace-report-screenshot-head">
        <span>Screenshot</span>
        <div class="artstrace-report-screenshot-head-actions">
          <button type="button" class="artstrace-report-secondary artstrace-report-capture">Take screenshot</button>
          <span class="artstrace-report-annotation-count">0 annotations</span>
        </div>
      </div>
      <div class="artstrace-report-toolbar" hidden>
        <button type="button" class="artstrace-report-tool is-active" data-tool="highlight">Highlight</button>
        <button type="button" class="artstrace-report-tool" data-tool="circle">Circle</button>
        <button type="button" class="artstrace-report-tool" data-tool="note">Note</button>
        <button type="button" class="artstrace-report-tool artstrace-report-tool-danger" data-tool="clear">Clear last</button>
      </div>
      <div class="artstrace-report-stage">
        <div class="artstrace-report-screenshot-preview">No screenshot yet</div>
      </div>
    </div>
    <label class="artstrace-report-field">
      <span>Title</span>
      <input type="text" maxlength="140" placeholder="Short bug title" />
    </label>
    <label class="artstrace-report-field">
      <span>Description</span>
      <textarea rows="5" maxlength="4000" placeholder="What happened? What did you expect?"></textarea>
    </label>
    <div class="artstrace-report-actions">
      <button type="button" class="artstrace-report-secondary artstrace-report-cancel">Cancel</button>
      <button type="button" class="artstrace-report-primary">Send report</button>
    </div>
  `;

  const titleInput = modal.querySelector(
    'input[type="text"]',
  ) as HTMLInputElement;
  const descriptionInput = modal.querySelector(
    "textarea",
  ) as HTMLTextAreaElement;
  const closeButton = modal.querySelector(
    ".artstrace-report-close",
  ) as HTMLButtonElement;
  const cancelButton = modal.querySelector(
    ".artstrace-report-cancel",
  ) as HTMLButtonElement;
  const captureButton = modal.querySelector(
    ".artstrace-report-capture",
  ) as HTMLButtonElement;
  const sendButton = modal.querySelector(
    ".artstrace-report-primary",
  ) as HTMLButtonElement;
  const toolbar = modal.querySelector(
    ".artstrace-report-toolbar",
  ) as HTMLDivElement;
  const preview = modal.querySelector(
    ".artstrace-report-screenshot-preview",
  ) as HTMLDivElement;
  const annotationCount = modal.querySelector(
    ".artstrace-report-annotation-count",
  ) as HTMLSpanElement;

  let screenshotData = options.defaultScreenshotData ?? "";
  let annotations = options.defaultAnnotations ?? [];
  let currentTool: ManualReportAnnotation["kind"] = "highlight";
  let isDrawing = false;
  let dragStart: { x: number; y: number } | null = null;
  let activePreviewStage: HTMLDivElement | null = null;
  let activeOverlay: HTMLDivElement | null = null;

  titleInput.value = options.defaultTitle ?? "";
  descriptionInput.value = options.defaultDescription ?? "";
  updatePreview();
  updateAnnotationCount();

  async function handleCapture() {
    try {
      captureButton.disabled = true;
      captureButton.textContent = "Select area...";
      document.documentElement.classList.add("artstrace-capturing-page");
      screenshotData = await captureScreenshot();
      updatePreview();
    } catch (error) {
      preview.textContent =
        error instanceof Error ? error.message : "Could not capture screenshot";
      preview.classList.add("artstrace-report-preview-error");
    } finally {
      document.documentElement.classList.remove("artstrace-capturing-page");
      captureButton.disabled = false;
      captureButton.textContent = "Take screenshot";
    }
  }

  async function handleSubmit() {
    const report = {
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim() || undefined,
      screenshotData: screenshotData || undefined,
      annotations,
      url: window.location.href,
      userAgent: navigator.userAgent,
      createdByUserId: getUserContext().userId,
    } satisfies ReportBugInput;

    if (!report.title) {
      preview.textContent = "Title is required.";
      preview.classList.add("artstrace-report-preview-error");
      return;
    }

    sendButton.disabled = true;
    sendButton.textContent = "Sending...";

    try {
      if (options.onSubmit) {
        await options.onSubmit(report);
      } else {
        await reportBug(report);
      }
      close();
    } catch (error) {
      preview.textContent =
        error instanceof Error ? error.message : "Failed to send report";
      preview.classList.add("artstrace-report-preview-error");
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = "Send report";
    }
  }

  function updatePreview() {
    preview.classList.remove("artstrace-report-preview-error");
    preview.innerHTML = "";
    activePreviewStage = null;
    activeOverlay = null;
    if (!screenshotData) {
      preview.textContent = "No screenshot yet";
      toolbar.hidden = true;
      updateAnnotationCount();
      return;
    }
    toolbar.hidden = false;
    const stage = document.createElement("div");
    stage.className = "artstrace-report-stage-inner";

    const image = document.createElement("img");
    image.alt = "Screenshot preview";
    image.src = screenshotData;
    image.className = "artstrace-report-stage-image";

    const overlay = document.createElement("div");
    overlay.className = "artstrace-report-overlay";

    stage.appendChild(image);
    stage.appendChild(overlay);
    preview.appendChild(stage);
    activePreviewStage = stage;
    activeOverlay = overlay;
    bindAnnotationEvents();
    renderAnnotations();
    updateAnnotationCount();
  }

  function updateAnnotationCount() {
    annotationCount.textContent = `${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`;
  }

  function setTool(tool: ManualReportAnnotation["kind"]) {
    currentTool = tool;
    modal.querySelectorAll(".artstrace-report-tool").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.getAttribute("data-tool") === tool,
      );
    });
  }

  function clearLastAnnotation() {
    annotations = annotations.slice(0, -1);
    renderAnnotations();
    updateAnnotationCount();
  }

  function getStageRect() {
    return activePreviewStage?.getBoundingClientRect() ?? null;
  }

  function getPoint(event: PointerEvent) {
    const rect = getStageRect();
    if (!rect) return null;
    return {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
      ),
    };
  }

  function renderAnnotations() {
    if (!activeOverlay) return;
    activeOverlay.innerHTML = "";
    const rect = activePreviewStage?.getBoundingClientRect();
    if (!rect) return;
    for (const annotation of annotations) {
      const element = document.createElement("div");
      element.className = `artstrace-annotation artstrace-annotation-${annotation.kind}`;
      element.style.left = `${annotation.x}%`;
      element.style.top = `${annotation.y}%`;
      if (annotation.kind === "note") {
        element.textContent = annotation.text || "Note";
      } else {
        element.style.width = `${annotation.width ?? 14}%`;
        element.style.height = `${annotation.height ?? 14}%`;
      }
      if (annotation.kind === "circle") {
        element.style.borderRadius = "999px";
      }
      activeOverlay.appendChild(element);
    }
  }

  function bindAnnotationEvents() {
    const overlay = activeOverlay;
    if (!overlay) return;
    overlay.onpointerdown = null;
    overlay.onpointermove = null;
    overlay.onpointerup = null;

    overlay.onpointerdown = (event) => {
      if (!screenshotData) return;
      const point = getPoint(event);
      if (!point) return;

      if (currentTool === "note") {
        const text = window.prompt("Note text")?.trim();
        if (!text) return;
        annotations = [
          ...annotations,
          { kind: "note", x: point.x, y: point.y, text, color: "#5eead4" },
        ];
        renderAnnotations();
        updateAnnotationCount();
        return;
      }

      if (currentTool === "circle") {
        annotations = [
          ...annotations,
          {
            kind: "circle",
            x: Math.max(0, point.x - 6),
            y: Math.max(0, point.y - 6),
            width: 12,
            height: 12,
            color: "#fbbf24",
          },
        ];
        renderAnnotations();
        updateAnnotationCount();
        return;
      }

      isDrawing = true;
      dragStart = point;
      overlay.setPointerCapture(event.pointerId);
    };

    overlay.onpointermove = (event) => {
      if (!isDrawing || !dragStart) return;
      const point = getPoint(event);
      if (!point) return;
      renderAnnotations();
      const draft = document.createElement("div");
      draft.className =
        "artstrace-annotation artstrace-annotation-highlight artstrace-annotation-draft";
      draft.style.left = `${Math.min(dragStart.x, point.x)}%`;
      draft.style.top = `${Math.min(dragStart.y, point.y)}%`;
      draft.style.width = `${Math.max(2, Math.abs(point.x - dragStart.x))}%`;
      draft.style.height = `${Math.max(2, Math.abs(point.y - dragStart.y))}%`;
      overlay.appendChild(draft);
    };

    overlay.onpointerup = (event) => {
      if (!isDrawing || !dragStart) return;
      const point = getPoint(event);
      if (!point) return;
      isDrawing = false;

      const left = Math.min(dragStart.x, point.x);
      const top = Math.min(dragStart.y, point.y);
      const width = Math.max(2, Math.abs(point.x - dragStart.x));
      const height = Math.max(2, Math.abs(point.y - dragStart.y));

      annotations = [
        ...annotations,
        {
          kind: "highlight",
          x: left,
          y: top,
          width,
          height,
          color: "#f59e0b",
        },
      ];
      dragStart = null;
      renderAnnotations();
      updateAnnotationCount();
      if (overlay.hasPointerCapture(event.pointerId)) {
        overlay.releasePointerCapture(event.pointerId);
      }
    };
  }

  function close() {
    window.removeEventListener("keydown", onKeyDown);
    backdrop.remove();
    options.onClose?.();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
    }
  }

  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);
  captureButton.addEventListener("click", () => void handleCapture());
  sendButton.addEventListener("click", () => void handleSubmit());
  toolbar.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".artstrace-report-tool",
    );
    if (!button) return;
    const tool = button.getAttribute("data-tool");
    if (tool === "clear") {
      clearLastAnnotation();
      return;
    }
    if (tool === "highlight" || tool === "circle" || tool === "note") {
      setTool(tool);
    }
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  window.addEventListener("keydown", onKeyDown);

  titleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  });

  document.body.appendChild(backdrop);
  backdrop.appendChild(modal);
  titleInput.focus();

  return { close };
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

function normalizeDuration(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function ensureRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("ArtsTrace browser SDK can only run in a browser");
  }
}

function getApiRoot(endpoint: string): string {
  const normalized = endpoint.replace(/\/+$/, "");
  return normalized.endsWith("/events")
    ? normalized.slice(0, -"/events".length)
    : normalized;
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function isArtstraceElement(element: Element): boolean {
  return Array.from(element.classList).some(
    (className) =>
      className.startsWith("artstrace-report") ||
      className.startsWith("artstrace-capture"),
  );
}

function copyAllBackgroundColors(
  originalDoc: Document,
  cloneDoc: Document,
): void {
  const origAll = originalDoc.querySelectorAll("*");
  const cloneAll = cloneDoc.querySelectorAll("*");
  const len = Math.min(origAll.length, cloneAll.length);

  for (let i = 0; i < len; i++) {
    const orig = origAll[i];
    const clone = cloneAll[i];
    if (!(orig instanceof HTMLElement) || !(clone instanceof HTMLElement))
      continue;
    if (isArtstraceElement(orig)) continue;

    const bg = window.getComputedStyle(orig).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
      clone.style.backgroundColor = bg;
    }
  }
}

type ScreenshotRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function selectScreenshotRegion(): Promise<ScreenshotRegion> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.className = "artstrace-capture-select";
    overlay.innerHTML = `
      <div class="artstrace-capture-hint">Drag to select screenshot area. Press Esc to cancel.</div>
      <div class="artstrace-capture-box"></div>
    `;

    const box = overlay.querySelector(
      ".artstrace-capture-box",
    ) as HTMLDivElement;
    let start: { x: number; y: number } | null = null;
    let current: { x: number; y: number } | null = null;

    const cleanup = () => {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };

    const toRegion = (): ScreenshotRegion | null => {
      if (!start || !current) return null;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      if (width < 8 || height < 8) return null;
      return { x, y, width, height };
    };

    const renderBox = () => {
      const region = toRegion();
      if (!region) {
        box.style.display = "none";
        return;
      }
      box.style.display = "block";
      box.style.left = `${region.x}px`;
      box.style.top = `${region.y}px`;
      box.style.width = `${region.width}px`;
      box.style.height = `${region.height}px`;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cleanup();
      reject(new Error("Screenshot selection cancelled"));
    };

    overlay.addEventListener("pointerdown", (event) => {
      start = { x: event.clientX, y: event.clientY };
      current = start;
      overlay.setPointerCapture(event.pointerId);
      renderBox();
    });

    overlay.addEventListener("pointermove", (event) => {
      if (!start) return;
      current = { x: event.clientX, y: event.clientY };
      renderBox();
    });

    overlay.addEventListener("pointerup", (event) => {
      if (!start) return;
      current = { x: event.clientX, y: event.clientY };
      const region = toRegion();
      cleanup();
      if (!region) {
        reject(new Error("Selected area is too small"));
        return;
      }
      resolve(region);
    });

    window.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
  });
}

async function renderViewportCanvas(
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

type Html2Canvas = typeof import("html2canvas").default;
let html2CanvasPromise: Promise<Html2Canvas | null> | null = null;

function loadHtml2Canvas(): Promise<Html2Canvas | null> {
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

function sanitizeScreenshotClone(root: HTMLElement): void {
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

function createFallbackScreenshot(region: ScreenshotRegion): HTMLCanvasElement {
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

function ensureReportStyles(): void {
  if (document.getElementById("artstrace-report-styles")) return;

  const style = document.createElement("style");
  style.id = "artstrace-report-styles";
  style.textContent = `
    .artstrace-report-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: grid;
      justify-items: end;
      align-items: stretch;
      padding: 16px;
      background: transparent;
      pointer-events: none;
    }

    .artstrace-report-modal {
      width: min(460px, 100%);
      height: calc(100vh - 32px);
      max-height: calc(100vh - 32px);
      overflow: auto;
      border: 1px solid rgba(94, 234, 212, 0.16);
      border-radius: 22px;
      background:
        radial-gradient(circle at top right, rgba(94, 234, 212, 0.11), transparent 34%),
        linear-gradient(180deg, rgba(11, 17, 23, 0.95), rgba(8, 12, 18, 0.95));
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
      padding: 22px;
      color: #f5f7fb;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: auto;
    }

    .artstrace-report-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .artstrace-report-kicker {
      color: #5eead4;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .artstrace-report-modal h3 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }

    .artstrace-report-modal p {
      margin: 8px 0 0;
      color: #94a3b8;
      line-height: 1.55;
    }

    .artstrace-report-close,
    .artstrace-report-secondary,
    .artstrace-report-primary {
      border: 1px solid transparent;
      border-radius: 14px;
      min-height: 40px;
      padding: 0 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, opacity 160ms ease;
    }

    .artstrace-report-close:hover,
    .artstrace-report-secondary:hover,
    .artstrace-report-primary:hover {
      transform: translateY(-1px);
    }

    .artstrace-report-close {
      width: 40px;
      padding: 0;
      border-color: rgba(148, 163, 184, 0.18);
      background: rgba(15, 23, 42, 0.85);
      color: #e2e8f0;
      font-size: 18px;
      line-height: 1;
      flex-shrink: 0;
    }

    .artstrace-report-field {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .artstrace-report-field span,
    .artstrace-report-screenshot-head span {
      color: #94a3b8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .artstrace-report-field input,
    .artstrace-report-field textarea {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 14px;
      background: rgba(2, 6, 23, 0.62);
      color: #f8fafc;
      padding: 12px 14px;
      outline: none;
      font: inherit;
      resize: vertical;
    }

    .artstrace-report-field input:focus,
    .artstrace-report-field textarea:focus {
      border-color: rgba(94, 234, 212, 0.55);
      box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.12);
    }

    .artstrace-report-screenshot {
      margin-top: 14px;
      padding: 14px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 18px;
      background: rgba(2, 6, 23, 0.2);
    }

    .artstrace-report-screenshot-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .artstrace-report-screenshot-head-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .artstrace-report-annotation-count {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 700;
    }

    .artstrace-report-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .artstrace-report-tool {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.82);
      color: #cbd5e1;
      min-height: 34px;
      padding: 0 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }

    .artstrace-report-tool.is-active {
      border-color: rgba(94, 234, 212, 0.35);
      background: rgba(20, 184, 166, 0.16);
      color: #5eead4;
    }

    .artstrace-report-tool-danger {
      border-color: rgba(248, 113, 113, 0.2);
      color: #fda4af;
    }

    .artstrace-report-stage {
      position: relative;
      min-height: 240px;
    }

    .artstrace-report-stage-inner {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.14);
      background: rgba(15, 23, 42, 0.18);
    }

    .artstrace-report-screenshot-preview {
      min-height: 220px;
      border: 1px dashed rgba(148, 163, 184, 0.16);
      border-radius: 16px;
      overflow: hidden;
      display: grid;
      place-items: center;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.2);
      text-align: center;
      padding: 12px;
    }

    .artstrace-report-screenshot-preview img {
      display: block;
      width: 100%;
      height: auto;
    }

    .artstrace-report-stage-image {
      display: block;
      width: 100%;
      height: auto;
    }

    .artstrace-report-overlay {
      position: absolute;
      inset: 0;
      cursor: crosshair;
    }

    .artstrace-annotation {
      position: absolute;
      box-sizing: border-box;
      pointer-events: none;
    }

    .artstrace-annotation-highlight {
      border: 2px solid rgba(245, 158, 11, 0.95);
      background: rgba(245, 158, 11, 0.18);
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.14);
    }

    .artstrace-annotation-circle {
      border: 2px solid rgba(94, 234, 212, 0.95);
      background: rgba(94, 234, 212, 0.1);
      box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.12);
    }

    .artstrace-annotation-note {
      transform: translate(-50%, -100%);
      min-width: 84px;
      max-width: 220px;
      padding: 6px 8px;
      border-radius: 10px;
      background: rgba(2, 6, 23, 0.88);
      border: 1px solid rgba(94, 234, 212, 0.22);
      color: #e2e8f0;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.35;
      white-space: pre-wrap;
    }

    .artstrace-annotation-draft {
      opacity: 0.65;
      border-style: dashed;
    }

    .artstrace-report-preview-error {
      border-color: rgba(248, 113, 113, 0.4);
      color: #fda4af;
    }

    .artstrace-report-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }

    .artstrace-report-secondary {
      border-color: rgba(148, 163, 184, 0.18);
      background: rgba(15, 23, 42, 0.82);
      color: #e2e8f0;
    }

    .artstrace-report-primary {
      border-color: rgba(20, 184, 166, 0.35);
      background: linear-gradient(135deg, rgba(20, 184, 166, 0.96), rgba(14, 116, 144, 0.96));
      color: #fff;
    }

    .artstrace-capture-select {
      position: fixed;
      inset: 0;
      z-index: 2147483001;
      cursor: crosshair;
      background: rgba(2, 6, 23, 0.18);
      user-select: none;
    }

    .artstrace-capture-hint {
      position: fixed;
      left: 50%;
      top: 18px;
      transform: translateX(-50%);
      border: 1px solid rgba(94, 234, 212, 0.28);
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.86);
      color: #e2e8f0;
      padding: 8px 12px;
      font: 700 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
      pointer-events: none;
    }

    .artstrace-capture-box {
      display: none;
      position: fixed;
      border: 2px solid #5eead4;
      background: rgba(94, 234, 212, 0.08);
      box-shadow:
        0 0 0 9999px rgba(2, 6, 23, 0.32),
        0 0 0 1px rgba(2, 6, 23, 0.55) inset;
      pointer-events: none;
    }

    .artstrace-capturing-page .artstrace-report-backdrop,
    .artstrace-capturing-page .artstrace-report-fab {
      display: none !important;
    }

    .artstrace-report-secondary:disabled,
    .artstrace-report-primary:disabled {
      opacity: 0.6;
      cursor: wait;
    }

    @media (max-width: 640px) {
      .artstrace-report-backdrop {
        padding: 10px;
      }

      .artstrace-report-modal {
        width: 100%;
        height: calc(100vh - 20px);
        max-height: calc(100vh - 20px);
        padding: 16px;
        border-radius: 18px;
      }

      .artstrace-report-head {
        flex-direction: column;
      }

      .artstrace-report-actions {
        flex-direction: column-reverse;
      }

      .artstrace-report-secondary,
      .artstrace-report-primary {
        width: 100%;
      }

      .artstrace-report-screenshot-head {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;

  document.head.appendChild(style);
}
