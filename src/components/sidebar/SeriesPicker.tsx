'use client';

import { useStore } from '@/lib/store';

export default function SeriesPicker() {
  const { state, dispatch } = useStore();

  return (
    <div className="flex flex-col px-2 pt-2">
      {/* Header row with + button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-text-dim uppercase tracking-widest">
          Narratives
        </span>
        <button
          onClick={() => dispatch({ type: 'OPEN_WIZARD' })}
          className="w-7 h-7 rounded flex items-center justify-center bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          +
        </button>
      </div>

      {/* Narrative list */}
      {state.narratives.length === 0 ? (
        <p className="text-xs text-text-dim px-1 py-3">
          Create your first narrative
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {state.narratives.map((entry) => {
            const isActive = state.activeNarrativeId === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() =>
                  dispatch({ type: 'SET_ACTIVE_NARRATIVE', id: entry.id })
                }
                className={`text-left rounded px-2 py-1.5 transition-colors ${
                  isActive ? 'bg-bg-overlay' : 'hover:bg-bg-elevated'
                }`}
              >
                <div className="text-sm text-text-primary truncate">
                  {entry.title}
                </div>
                <div className="text-xs text-text-dim truncate">
                  {entry.description}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
