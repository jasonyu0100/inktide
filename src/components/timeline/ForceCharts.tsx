'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { resolveEntry, isScene } from '@/types/narrative';
import { detectCubeCorner } from '@/lib/narrative-utils';
import ForceLineChart from './ForceLineChart';

const FORCE_CONFIG = [
  { key: 'pressure' as const, label: 'Pressure', color: 'var(--color-pressure)' },
  { key: 'momentum' as const, label: 'Momentum', color: 'var(--color-momentum)' },
  { key: 'flux' as const, label: 'Flux', color: 'var(--color-flux)' },
] as const;

export default function ForceCharts() {
  const { state } = useStore();
  const narrative = state.activeNarrative;

  const resolvedSceneKeys = state.resolvedSceneKeys;

  const forceData = useMemo(() => {
    if (!narrative) {
      return { pressure: [], momentum: [], flux: [] };
    }
    const pressure: number[] = [];
    const momentum: number[] = [];
    const flux: number[] = [];
    let lastForce = { pressure: 0, momentum: 0, flux: 0 };
    for (const k of resolvedSceneKeys) {
      const entry = resolveEntry(narrative, k);
      if (entry && isScene(entry)) {
        lastForce = entry.forceSnapshot;
      }
      pressure.push(lastForce.pressure);
      momentum.push(lastForce.momentum);
      flux.push(lastForce.flux);
    }
    return { pressure, momentum, flux };
  }, [narrative, resolvedSceneKeys]);

  const currentForces = useMemo(() => {
    const idx = state.currentSceneIndex;
    if (forceData.pressure.length === 0 || idx < 0 || idx >= forceData.pressure.length) return null;
    return {
      pressure: forceData.pressure[idx],
      momentum: forceData.momentum[idx],
      flux: forceData.flux[idx],
    };
  }, [forceData, state.currentSceneIndex]);

  const cubeCorner = useMemo(() => {
    if (!currentForces) return null;
    return detectCubeCorner(currentForces);
  }, [currentForces]);

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
      {/* Cube state label — left */}
      {cubeCorner && (
        <div className="flex flex-col justify-center px-3 border-r border-border shrink-0 w-36">
          <span className="text-[9px] uppercase tracking-widest text-text-dim">
            {cubeCorner.key.split('').map((c: string, i: number) => {
              const labels = ['P', 'M', 'F'];
              return `${labels[i]}:${c === 'H' ? 'Hi' : 'Lo'}`;
            }).join(' · ')}
          </span>
          <span className="text-[11px] font-semibold text-text-primary leading-tight mt-0.5">
            {cubeCorner.name}
          </span>
        </div>
      )}

      {/* Force line charts — center */}
      {FORCE_CONFIG.map((cfg, i) => (
        <div
          key={cfg.key}
          className={`flex-1 ${i < FORCE_CONFIG.length - 1 ? 'border-r border-border' : ''}`}
        >
          <ForceLineChart
            data={forceData[cfg.key]}
            color={cfg.color}
            label={cfg.label}
            currentIndex={state.currentSceneIndex}
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
