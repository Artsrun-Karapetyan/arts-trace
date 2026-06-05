import { useEffect, useRef, useState } from "react";

type DirectReplayerInstance = {
  destroy?: () => void;
  getMetaData?: () => { totalTime?: number };
  getCurrentTime?: () => number;
  iframe?: HTMLIFrameElement;
  pause?: (timeOffset?: number) => void;
  play?: (timeOffset?: number) => void;
  wrapper?: HTMLElement;
};

interface EventReplayerProps {
  replayEvents: Array<Record<string, unknown>>;
  isReplayFullscreen: boolean;
  onTimeUpdate: (currentMs: number, totalMs: number) => void;
  onPlayingChange: (isPlaying: boolean) => void;
  isReplayPlaying: boolean;
  playerError: string | null;
  setPlayerError: (error: string | null) => void;
}

export function EventReplayer({
  replayEvents,
  isReplayFullscreen,
  onTimeUpdate,
  onPlayingChange,
  isReplayPlaying,
  playerError,
  setPlayerError,
}: EventReplayerProps) {
  const replayRef = useRef<HTMLDivElement | null>(null);
  const replayerRef = useRef<DirectReplayerInstance | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(420);
  const [localTotalMs, setLocalTotalMs] = useState<number>(0);

  useEffect(() => {
    if (!replayRef.current || replayEvents.length === 0) return;

    let disposed = false;
    let onResize: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let frameId: number | null = null;

    const destroyPlayer = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (replayerRef.current?.destroy) replayerRef.current.destroy();
      replayerRef.current = null;
      onPlayingChange(false);
    };

    const scaleReplay = () => {
      const replayer = replayerRef.current;
      const container = replayRef.current?.parentElement;
      if (!replayer?.wrapper || !replayer.iframe || !container) return;

      const frameWidth =
        Number(replayer.iframe.getAttribute("width")) ||
        replayer.iframe.offsetWidth ||
        1024;
      const frameHeight =
        Number(replayer.iframe.getAttribute("height")) ||
        replayer.iframe.offsetHeight ||
        768;
      const viewportHeight = isReplayFullscreen
        ? Math.max(360, window.innerHeight - 96)
        : Math.min(
            Math.max(420, Math.round(container.clientWidth * 0.58)),
            760,
          );
      const availableWidth = Math.max(320, container.clientWidth - 4);
      const availableHeight = Math.max(320, viewportHeight - 4);
      const scale = Math.min(
        availableWidth / frameWidth,
        availableHeight / frameHeight,
      );
      const offsetX = Math.max(0, (availableWidth - frameWidth * scale) / 2);
      const offsetY = Math.max(0, (availableHeight - frameHeight * scale) / 2);

      const inner = replayRef.current;
      if (!inner) return;

      inner.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      inner.style.transformOrigin = "top left";
      inner.style.width = `${frameWidth}px`;
      inner.style.height = `${frameHeight}px`;

      replayer.wrapper.style.width = "100%";
      replayer.wrapper.style.height = "100%";
      replayer.wrapper.style.margin = "0";
      replayer.wrapper.style.background = "#ffffff";
      replayer.iframe.style.background = "#ffffff";
      setContainerHeight(viewportHeight);
    };

    void import("@rrweb/replay")
      .then(({ Replayer }) => {
        if (disposed || !replayRef.current) return;

        const mount = () => {
          if (!replayRef.current) return;
          destroyPlayer();
          replayRef.current.innerHTML = "";

          try {
            replayerRef.current = new Replayer(
              replayEvents as never[],
              {
                root: replayRef.current,
                skipInactive: false,
                speed: 1,
                mouseTail: false,
              } as never,
            ) as DirectReplayerInstance;
            const meta = replayerRef.current.getMetaData?.();
            const totalTime = meta?.totalTime ?? 0;
            setLocalTotalMs(totalTime);
            onTimeUpdate(0, totalTime);
            replayerRef.current.pause?.(0);
            setPlayerError(null);
          } catch (err: any) {
            console.error("rrweb replayer crash:", err);
            setPlayerError(err?.message || String(err));
            return;
          }

          frameId = requestAnimationFrame(() => {
            frameId = null;
            scaleReplay();
            onTimeUpdate(0, localTotalMs);

            const replayer = replayerRef.current;
            if (!replayer?.getCurrentTime) return;
            pollTimer = setInterval(() => {
              if (disposed) return;
              const time = replayer.getCurrentTime?.();
              if (typeof time !== "number") return;
              // Use fresh localTotalMs value or rely on the state closure from mount.
              // Actually better to use replayer.getMetaData() again or just trust it.
              const meta = replayer.getMetaData?.();
              const totalTime = meta?.totalTime ?? 0;
              const clampedTime =
                totalTime > 0 ? Math.min(time, totalTime) : time;

              onTimeUpdate(clampedTime, totalTime);
              if (totalTime > 0 && clampedTime >= totalTime - 50) {
                replayer.pause?.(0);
                onTimeUpdate(0, totalTime);
                onPlayingChange(false);
              }
            }, 200);
          });
        };

        mount();
        onResize = () => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(scaleReplay, 150);
        };
        window.addEventListener("resize", onResize);
      })
      .catch((err) => {
        console.error("Failed to load rrweb replayer module:", err);
        setPlayerError(err?.message || String(err));
      });

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (onResize) window.removeEventListener("resize", onResize);
      destroyPlayer();
      if (replayRef.current) replayRef.current.innerHTML = "";
    };
  }, [isReplayFullscreen, replayEvents]); // localTotalMs removed from deps to avoid re-mount

  useEffect(() => {
    const replayer = replayerRef.current;
    if (!replayer) return;

    if (isReplayPlaying) {
      replayer.play?.();
    } else {
      replayer.pause?.();
    }
  }, [isReplayPlaying]);

  return (
    <div
      className="replay-container"
      style={{
        display: playerError ? "none" : undefined,
        height: isReplayFullscreen ? "auto" : containerHeight,
      }}
    >
      <div ref={replayRef} className="replay-inner" />
    </div>
  );
}
