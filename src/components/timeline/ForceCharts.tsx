'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { resolveEntry, isScene, type Scene } from '@/types/narrative';
import { detectCubeCorner, computeForceSnapshots, computeWindowedForces } from '@/lib/narrative-utils';
import ForceLineChart from './ForceLineChart';

const FORCE_CONFIG = [
  { key: 'stakes' as const, label: 'Stakes', color: 'var(--color-stakes)' },
  { key: 'pacing' as const, label: 'Pacing', color: 'var(--color-pacing)' },
  { key: 'variety' as const, label: 'Variety', color: 'var(--color-variety)' },
] as const;

type ViewMode = 'local' | 'global';

export default function ForceCharts() {
  const { state } = useStore();
  const narrative = state.activeNarrative;
  const resolvedSceneKeys = state.resolvedSceneKeys;
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [cubeMode, setCubeMode] = useState<ViewMode>('local');

  // All scenes in timeline order
  const allScenes = useMemo(() => {
    if (!narrative) return [];
    return resolvedSceneKeys
      .map((k) => resolveEntry(narrative, k))
      .filter((e): e is Scene => !!e && isScene(e));
  }, [narrative, resolvedSceneKeys]);

  // Map current timeline index → scene-array index
  const currentSceneIdx = useMemo(() => {
    if (allScenes.length === 0 || !narrative) return -1;
    return Math.min(
      allScenes.length - 1,
      resolvedSceneKeys.slice(0, state.currentSceneIndex + 1)
        .filter((k) => resolveEntry(narrative, k)?.kind === 'scene').length - 1,
    );
  }, [allScenes, state.currentSceneIndex, resolvedSceneKeys, narrative]);

  // Windowed forces — always computed for cube position
  const windowed = useMemo(() => {
    if (currentSceneIdx < 0) return null;
    return computeWindowedForces(allScenes, currentSceneIdx);
  }, [allScenes, currentSceneIdx]);

  // Full-history forces for global graph display
  const globalForceData = useMemo(() => {
    if (!narrative) return { stakes: [], pacing: [], variety: [] };
    const stakes: number[] = [];
    const pacing: number[] = [];
    const variety: number[] = [];
    const forceMap = computeForceSnapshots(allScenes);
    let lastForce = { stakes: 0, pacing: 0, variety: 0 };
    for (const k of resolvedSceneKeys) {
      const entry = resolveEntry(narrative, k);
      if (entry && isScene(entry)) {
        lastForce = forceMap[entry.id] ?? lastForce;
      }
      stakes.push(lastForce.stakes);
      pacing.push(lastForce.pacing);
      variety.push(lastForce.variety);
    }
    return { stakes, pacing, variety };
  }, [narrative, allScenes, resolvedSceneKeys]);

  // Window-only forces for local view
  const localForceData = useMemo(() => {
    if (!windowed || !narrative) return { stakes: [], pacing: [], variety: [] };
    const stakes: number[] = [];
    const pacing: number[] = [];
    const variety: number[] = [];
    const windowScenes = allScenes.slice(windowed.windowStart, windowed.windowEnd + 1);
    let lastForce = { stakes: 0, pacing: 0, variety: 0 };
    for (const s of windowScenes) {
      lastForce = windowed.forceMap[s.id] ?? lastForce;
      stakes.push(lastForce.stakes);
      pacing.push(lastForce.pacing);
      variety.push(lastForce.variety);
    }
    return { stakes, pacing, variety };
  }, [windowed, allScenes, narrative]);

  // Map window scene-indices back to timeline indices for global chart highlight
  const windowTimelineRange = useMemo(() => {
    if (!windowed || !narrative) return undefined;
    const windowStartId = allScenes[windowed.windowStart]?.id;
    const windowEndId = allScenes[windowed.windowEnd]?.id;
    let tlStart = 0;
    let tlEnd = resolvedSceneKeys.length - 1;
    for (let i = 0; i < resolvedSceneKeys.length; i++) {
      if (resolvedSceneKeys[i] === windowStartId) { tlStart = i; break; }
    }
    for (let i = resolvedSceneKeys.length - 1; i >= 0; i--) {
      if (resolvedSceneKeys[i] === windowEndId) { tlEnd = i; break; }
    }
    return { start: tlStart, end: tlEnd };
  }, [windowed, allScenes, resolvedSceneKeys, narrative]);

  // Windowed forces for local cube corner
  const windowedForces = useMemo(() => {
    if (!windowed) return null;
    const lastScene = allScenes[windowed.windowEnd];
    return lastScene ? windowed.forceMap[lastScene.id] ?? null : null;
  }, [windowed, allScenes]);

  // Global forces for history cube corner
  const globalForces = useMemo(() => {
    const idx = state.currentSceneIndex;
    if (globalForceData.stakes.length === 0 || idx < 0 || idx >= globalForceData.stakes.length) return null;
    return {
      stakes: globalForceData.stakes[idx],
      pacing: globalForceData.pacing[idx],
      variety: globalForceData.variety[idx],
    };
  }, [globalForceData, state.currentSceneIndex]);

  const cubeCorner = useMemo(() => {
    const forces = cubeMode === 'local' ? windowedForces : globalForces;
    if (!forces) return null;
    return detectCubeCorner(forces);
  }, [cubeMode, windowedForces, globalForces]);

  // Previous scene's cube corner for transition display
  const prevCorner = useMemo(() => {
    if (currentSceneIdx < 1) return null;
    if (cubeMode === 'local') {
      const prev = computeWindowedForces(allScenes, currentSceneIdx - 1);
      const prevScene = allScenes[prev.windowEnd];
      const f = prevScene ? prev.forceMap[prevScene.id] : null;
      return f ? detectCubeCorner(f) : null;
    }
    // Global: use previous index from globalForceData
    const prevIdx = state.currentSceneIndex - 1;
    if (prevIdx < 0 || prevIdx >= globalForceData.stakes.length) return null;
    return detectCubeCorner({
      stakes: globalForceData.stakes[prevIdx],
      pacing: globalForceData.pacing[prevIdx],
      variety: globalForceData.variety[prevIdx],
    });
  }, [cubeMode, currentSceneIdx, allScenes, state.currentSceneIndex, globalForceData]);

  // Select data and indices based on view mode
  const isLocal = viewMode === 'local';
  const chartData = isLocal ? localForceData : globalForceData;
  const chartCurrentIndex = isLocal
    ? (localForceData.stakes.length - 1)  // always last in local view
    : state.currentSceneIndex;

  if (!narrative) {
    return (
      <div className="flex items-center justify-center h-25 shrink-0 glass-panel border-t border-border">
        <span className="text-text-dim text-xs tracking-widest uppercase">
          No force data
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-25 shrink-0 glass-panel border-t border-border">
      {/* Cube state label + view toggle — left */}
      <div className="flex flex-col justify-center px-3 border-r border-border shrink-0 w-36">
        {cubeCorner && (
          <>
            <span className="text-[9px] uppercase tracking-widest text-text-dim">
              {cubeCorner.key.split('').map((c: string, i: number) => {
                const labels = ['S', 'P', 'V'];
                return `${labels[i]}:${c === 'H' ? 'Hi' : 'Lo'}`;
              }).join(' · ')}
            </span>
            <span className="text-[11px] font-semibold text-text-primary leading-tight mt-0.5">
              {prevCorner && prevCorner.key !== cubeCorner.key ? (
                <>
                  <span className="text-text-dim font-normal">{prevCorner.name}</span>
                  <span className="text-text-dim font-normal mx-0.5">&rarr;</span>
                  {cubeCorner.name}
                </>
              ) : (
                cubeCorner.name
              )}
            </span>
          </>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {/* Cube calculation toggle: crosshair (local) / globe (global) */}
          <button
            type="button"
            onClick={() => setCubeMode((m) => m === 'local' ? 'global' : 'local')}
            className="flex items-center gap-0.5 text-[9px] uppercase tracking-widest text-text-dim hover:text-text-primary transition-colors"
            title={cubeMode === 'local' ? 'Cube uses windowed forces' : 'Cube uses full-history forces'}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {cubeMode === 'local' ? (
                /* Crosshair — local/windowed */
                <>
                  <circle cx="8" cy="8" r="5" />
                  <line x1="8" y1="1" x2="8" y2="4" />
                  <line x1="8" y1="12" x2="8" y2="15" />
                  <line x1="1" y1="8" x2="4" y2="8" />
                  <line x1="12" y1="8" x2="15" y2="8" />
                </>
              ) : (
                /* Globe — global/full-history */
                <>
                  <circle cx="8" cy="8" r="6" />
                  <ellipse cx="8" cy="8" rx="3" ry="6" />
                  <line x1="2" y1="8" x2="14" y2="8" />
                </>
              )}
            </svg>
            {cubeMode === 'local' ? 'local' : 'global'}
          </button>
          <span className="text-[9px] text-text-dim opacity-20">|</span>
          {/* Chart view toggle: window (zoom) / history (timeline) */}
          <button
            type="button"
            onClick={() => setViewMode((m) => m === 'local' ? 'global' : 'local')}
            className="flex items-center gap-0.5 text-[9px] uppercase tracking-widest text-text-dim hover:text-text-primary transition-colors"
            title={isLocal ? 'Chart shows window only' : 'Chart shows full history'}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {isLocal ? (
                /* Zoom/magnify — window view */
                <>
                  <circle cx="7" cy="7" r="4.5" />
                  <line x1="10.2" y1="10.2" x2="14" y2="14" />
                </>
              ) : (
                /* Timeline — full history */
                <>
                  <line x1="1" y1="13" x2="15" y2="13" />
                  <polyline points="1,10 4,5 7,8 10,3 13,6 15,2" />
                </>
              )}
            </svg>
            {isLocal ? 'window' : 'history'}
          </button>
        </div>
      </div>

      {/* Force line charts — center */}
      {FORCE_CONFIG.map((cfg, i) => (
        <div
          key={cfg.key}
          className={`flex-1 ${i < FORCE_CONFIG.length - 1 ? 'border-r border-border' : ''}`}
        >
          <ForceLineChart
            data={chartData[cfg.key]}
            color={cfg.color}
            label={cfg.label}
            currentIndex={chartCurrentIndex}
            windowStart={cubeMode === 'local' && !isLocal ? windowTimelineRange?.start : undefined}
            windowEnd={cubeMode === 'local' && !isLocal ? windowTimelineRange?.end : undefined}
          />
        </div>
      ))}

      {/* Cube viewer button — right */}
      <div className="flex items-center px-2 border-l border-border shrink-0">
        <button
          type="button"
          title="Narrative cube — 3D force trajectory"
          onClick={() => window.dispatchEvent(new CustomEvent('open-cube-viewer'))}
          className="w-7 h-7 flex items-center justify-center text-text-dim hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
            <path d="M12 12v10" />
            <path d="M2 7v10" />
            <path d="M22 7v10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
