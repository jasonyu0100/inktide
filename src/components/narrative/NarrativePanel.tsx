'use client';

import { useStore } from '@/lib/store';

export default function NarrativePanel() {
  const { state } = useStore();
  const narrative = state.activeNarrative;

  if (!narrative) return null;

  const sceneKeys = Object.keys(narrative.scenes);
  const currentKey = sceneKeys[state.currentSceneIndex];
  const scene = currentKey ? narrative.scenes[currentKey] : null;

  if (!scene) return null;

  const location = narrative.locations[scene.locationId];
  const arc = Object.values(narrative.arcs).find((a) =>
    a.sceneIds.includes(scene.id),
  );

  return (
    <div className="h-[180px] bg-bg-panel border-t border-border overflow-y-auto px-4 py-3">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[10px] text-text-dim">{scene.id}</span>
        {arc && (
          <span className="text-[10px] text-text-dim uppercase tracking-wider">
            {arc.name}
          </span>
        )}
        {location && (
          <>
            <span className="text-text-dim text-[10px]">&middot;</span>
            <span className="text-[10px] text-text-secondary">{location.name}</span>
          </>
        )}
      </div>
      <p className="text-sm leading-relaxed text-text-primary">{scene.summary}</p>
    </div>
  );
}
