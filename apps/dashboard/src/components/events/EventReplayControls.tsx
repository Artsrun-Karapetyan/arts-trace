import { formatReplayTime } from "@/helpers/replay";

interface EventReplayControlsProps {
  isReplayPlaying: boolean;
  onToggleReplay: () => void;
  currentReplayMs: number;
  totalReplayMs: number;
  isReplayFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function EventReplayControls({
  isReplayPlaying,
  onToggleReplay,
  currentReplayMs,
  totalReplayMs,
  isReplayFullscreen,
  onToggleFullscreen,
}: EventReplayControlsProps) {
  return (
    <div className="replay-controls">
      <button
        className="icon-btn replay-play-btn"
        type="button"
        onClick={onToggleReplay}
        title={isReplayPlaying ? "Pause" : "Play"}
      >
        {isReplayPlaying ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>
      <input
        aria-label="Replay timeline"
        className="replay-timeline"
        max={totalReplayMs}
        min={0}
        type="range"
        value={currentReplayMs}
        readOnly
      />
      <div className="replay-time">
        {formatReplayTime(currentReplayMs)} / {formatReplayTime(totalReplayMs)}
      </div>
      <button
        className="icon-btn replay-fullscreen-btn"
        type="button"
        onClick={onToggleFullscreen}
        title={isReplayFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isReplayFullscreen ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>
    </div>
  );
}
