'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import ForceLineChart from './ForceLineChart';

const FORCE_CONFIG = [
  { key: 'pressure' as const, label: 'Pressure', color: 'var(--color-pressure)' },
  { key: 'momentum' as const, label: 'Momentum', color: 'var(--color-momentum)' },
  { key: 'flux' as const, label: 'Flux', color: 'var(--color-flux)' },
] as const;

export default function ForceCharts() {
  const { state } = useStore();
  const narrative = state.activeNarrative;

  const forceData = useMemo(() => {
    if (!narrative) {
      return { pressure: [], momentum: [], flux: [] };
    }
    const scenes = Object.values(narrative.scenes);
    return {
      pressure: scenes.map((s) => s.forceSnapshot.pressure),
      momentum: scenes.map((s) => s.forceSnapshot.momentum),
      flux: scenes.map((s) => s.forceSnapshot.flux),
    };
  }, [narrative]);

  if (!narrative) {
    return (
      <div className="flex items-center justify-center h-[100px] bg-bg-panel border-t border-border">
        <span className="text-text-dim text-xs tracking-widest uppercase">
          No force data
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-[100px] bg-bg-panel border-t border-border">
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
    </div>
  );
}
