export type ScreenshotRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function selectScreenshotRegion(): Promise<ScreenshotRegion> {
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
