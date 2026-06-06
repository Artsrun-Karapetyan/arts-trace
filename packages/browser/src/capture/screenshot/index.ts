import {
  copyAllBackgroundColors,
  isArtstraceElement,
  waitForNextPaint,
} from "../../utils/dom.js";
import { ensureRuntime } from "../../utils/env.js";
import { createFallbackScreenshot, renderViewportCanvas } from "./canvas.js";
import { loadHtml2Canvas } from "./html2canvas.js";
import { selectScreenshotRegion } from "./region.js";

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
      onclone: (documentClone: Document) => {
        copyAllBackgroundColors(document, documentClone);
        documentClone
          .querySelectorAll(
            "[class*='artstrace-report'], [class*='artstrace-capture']",
          )
          .forEach((node: Element) => node.remove());
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

export { createFallbackScreenshot };
