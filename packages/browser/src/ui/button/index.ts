import type { MountReportBugButtonOptions } from "../../types/index.js";

export function mountReportBugButton(
  options: MountReportBugButtonOptions = {},
): { destroy: () => void } {
  ensureRuntime();

  const target = resolveTarget(options.target);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "artstrace-report-fab";
  button.textContent = options.label ?? "Report bug";
  button.setAttribute("aria-label", options.label ?? "Report bug");

  const openDialog = () => {
    options.onOpen?.();
    void import("../dialog/index.js").then(({ openReportDialog }) => {
      openReportDialog({
        defaultTitle: options.title,
        defaultDescription: options.description,
        defaultScreenshotData: options.defaultScreenshotData,
        defaultAnnotations: options.defaultAnnotations,
        onSubmit: options.onSubmit,
        onClose: options.onClose,
      });
    });
  };

  button.addEventListener("click", () => {
    openDialog();
  });

  ensureButtonStyles();
  target.appendChild(button);

  return {
    destroy() {
      button.remove();
    },
  };
}

function resolveTarget(target?: HTMLElement | string): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("ArtsTrace browser SDK can only run in a browser");
  }

  if (!target) return document.body;
  if (target instanceof HTMLElement) return target;

  const element = document.querySelector<HTMLElement>(target);
  if (!element) {
    throw new Error(`ArtsTrace could not find target element: ${target}`);
  }
  return element;
}

function ensureRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("ArtsTrace browser SDK can only run in a browser");
  }
}

function ensureButtonStyles(): void {
  if (document.getElementById("artstrace-report-fab-styles")) return;

  const style = document.createElement("style");
  style.id = "artstrace-report-fab-styles";
  style.textContent = `
    .artstrace-report-fab {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147482999;
      border: 1px solid rgba(94, 234, 212, 0.28);
      border-radius: 999px;
      padding: 0 16px;
      height: 44px;
      background: linear-gradient(135deg, rgba(20, 184, 166, 0.98), rgba(14, 116, 144, 0.98));
      color: #fff;
      font: inherit;
      font-weight: 800;
      letter-spacing: 0.01em;
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.35);
      cursor: pointer;
    }

    .artstrace-report-fab:hover {
      transform: translateY(-1px);
    }

    .artstrace-report-fab:active {
      transform: translateY(0);
    }

    @media (max-width: 640px) {
      .artstrace-report-fab {
        right: 14px;
        bottom: 14px;
      }
    }
  `;
  document.head.appendChild(style);
}
