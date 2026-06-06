export function ensureReportStyles(): void {
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
