import { reportBug } from "../../api/report.js";
import { captureScreenshot } from "../../capture/screenshot/index.js";
import { getUserContext } from "../../context/user.js";
import type {
  ManualReportAnnotation,
  OpenReportDialogOptions,
  ReportBugInput,
} from "../../types/index.js";
import { ensureRuntime } from "../../utils/env.js";
import { ensureReportStyles } from "./styles.js";

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
