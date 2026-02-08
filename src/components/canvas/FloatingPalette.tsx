'use client';

import { useStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

export default function FloatingPalette() {
  const { state, dispatch } = useStore();
  const access = useFeatureAccess();
  const narrative = state.activeNarrative;
  const isActive = narrative !== null;

  const totalScenes = state.resolvedSceneKeys.length;

  const wrapperClasses = isActive ? '' : 'opacity-30 pointer-events-none';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className={`glass-pill px-3 py-1.5 flex items-center gap-2 ${wrapperClasses}`}>
        {/* Prev */}
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
          onClick={() => dispatch({ type: 'PREV_SCENE' })}
          aria-label="Previous scene"
        >
          &#9664;
        </button>

        {/* Next */}
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
          onClick={() => dispatch({ type: 'NEXT_SCENE' })}
          aria-label="Next scene"
        >
          &#9654;
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.12] mx-1" />

        {/* Scene counter */}
        <span className="text-text-dim text-[10px] whitespace-nowrap">
          Scene {state.currentSceneIndex + 1} / {totalScenes}
        </span>

        {/* Divider */}
        <div className="w-px h-4 bg-white/[0.12] mx-1" />

        {/* Generate */}
        <button
          type="button"
          className="text-xs font-semibold text-pacing bg-pacing/10 px-2 py-1 rounded-md hover:bg-pacing/20 transition-colors uppercase tracking-wider"
          onClick={() => {
            if (access.userApiKeys && !access.hasOpenRouterKey) {
              window.dispatchEvent(new Event('open-api-keys'));
              return;
            }
            window.dispatchEvent(new CustomEvent('open-generate-panel'));
          }}
        >
          Generate
        </button>

        {/* Auto */}
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
          onClick={() => {
            if (access.userApiKeys && !access.hasOpenRouterKey) {
              window.dispatchEvent(new Event('open-api-keys'));
              return;
            }
            window.dispatchEvent(new CustomEvent('open-auto-settings'));
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 8a7 7 0 0 1 12.5-4.3" />
            <path d="M15 8a7 7 0 0 1-12.5 4.3" />
            <polyline points="13.5 1 13.5 4 10.5 4" />
            <polyline points="2.5 15 2.5 12 5.5 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
