export function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function isArtstraceElement(element: Element): boolean {
  return Array.from(element.classList).some(
    (className) =>
      className.startsWith("artstrace-report") ||
      className.startsWith("artstrace-capture"),
  );
}

export function copyAllBackgroundColors(
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
