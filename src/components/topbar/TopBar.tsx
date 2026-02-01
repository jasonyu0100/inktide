'use client';

import { useStore } from '@/lib/store';
import type { ControlMode } from '@/types/narrative';

const modes: { label: string; value: ControlMode }[] = [
  { label: 'AUTO', value: 'auto' },
  { label: 'MANUAL', value: 'manual' },
];

export default function TopBar() {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;

  const activeArc = narrative
    ? Object.values(narrative.arcs).find((a) =>
        a.sceneIds.includes(
          Object.keys(narrative.scenes)[state.currentSceneIndex] ?? ''
        )
      )
    : null;

  return (
    <div className="flex items-center justify-between h-11 bg-bg-panel border-b border-border px-3">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1 text-sm min-w-0">
        {narrative ? (
          <>
            <span className="text-text-primary truncate">{narrative.title}</span>
            {activeArc && (
              <>
                <span className="text-text-dim mx-1">&middot;</span>
                <span className="text-text-secondary truncate">
                  {activeArc.name}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="text-text-primary">Narrative Engine</span>
        )}
      </div>

      {/* Right: control mode toggle */}
      <div className="flex items-center gap-1 bg-bg-elevated rounded-lg p-0.5">
        {modes.map((m) => {
          const isActive = state.controlMode === m.value;
          return (
            <button
              key={m.value}
              onClick={() =>
                dispatch({ type: 'SET_CONTROL_MODE', mode: m.value })
              }
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-bg-overlay text-text-primary rounded-md'
                  : 'text-text-dim'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
