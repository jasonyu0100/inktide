'use client';

import { useStore } from '@/lib/store';

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function FloatingPalette() {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;
  const isActive = narrative !== null;
  const isAuto = state.controlMode === 'auto';

  const totalScenes = narrative
    ? Object.keys(narrative.scenes).length
    : 0;

  const wrapperClasses = isActive ? '' : 'opacity-30 pointer-events-none';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className={`glass-pill px-3 py-1.5 flex items-center gap-2 ${wrapperClasses}`}>
        {/* Prev */}
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/[0.06] rounded-md transition-colors"
          onClick={() => dispatch({ type: 'PREV_SCENE' })}
          aria-label="Previous scene"
        >
          &#9664;
        </button>

        {/* Next */}
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/[0.06] rounded-md transition-colors"
          onClick={() => dispatch({ type: 'NEXT_SCENE' })}
          aria-label="Next scene"
        >
          &#9654;
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.12] mx-1" />

        {/* Timer (auto mode only) */}
        {isAuto && (
          <>
            <span className="font-mono text-xs text-text-secondary">
              {formatTimer(state.autoTimer)}
            </span>
            <div className="w-px h-4 bg-white/[0.12] mx-1" />
          </>
        )}

        {/* Play / Stop */}
        <button
          type="button"
          className="text-xs font-semibold text-text-primary bg-white/[0.08] px-2 py-1 rounded-md hover:bg-white/[0.12] transition-colors"
          onClick={() => dispatch({ type: 'TOGGLE_PLAY' })}
        >
          {state.isPlaying ? '\u25A0 Stop' : '\u25B6 Play'}
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.12] mx-1" />

        {/* Scene counter */}
        <span className="text-text-dim text-[10px] whitespace-nowrap">
          Scene {state.currentSceneIndex + 1} / {totalScenes}
        </span>
      </div>
    </div>
  );
}
