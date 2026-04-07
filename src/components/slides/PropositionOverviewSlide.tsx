'use client';

import React, { useMemo } from 'react';
import type { SlidesData } from '@/lib/slides-data';
import { BASE_COLORS, BASE_COLORS_GLOBAL, classificationLabel, ALL_PROFILE_LABELS } from '@/lib/proposition-classify';
import { usePropositionClassification } from '@/hooks/usePropositionClassification';
import type { PropositionBaseCategory } from '@/types/narrative';
import { resolveEntry, isScene } from '@/types/narrative';

const BASE_ORDER: PropositionBaseCategory[] = ['Anchor', 'Seed', 'Close', 'Texture'];

export function PropositionOverviewSlide({ data }: { data: SlidesData }) {
  const { sceneProfiles, getClassification } = usePropositionClassification();

  const { totals, total, arcTrajectory, labelCounts } = useMemo(() => {
    const t: Record<PropositionBaseCategory, number> = { Anchor: 0, Seed: 0, Close: 0, Texture: 0 };
    let sum = 0;

    if (sceneProfiles && sceneProfiles.size > 0) {
      for (const dist of sceneProfiles.values()) {
        for (const base of BASE_ORDER) {
          const v = dist[base] ?? 0;
          t[base] += v;
          sum += v;
        }
      }
    }

    if (sum === 0) sum = data.propositionCount;

    // Compute per-arc trajectory from sceneProfiles + narrative arcs
    const perCategory: Record<PropositionBaseCategory, number[]> = { Anchor: [], Seed: [], Close: [], Texture: [] };
    let arcCount = 0;

    if (sceneProfiles && sceneProfiles.size > 0 && data.scenes.length > 0) {
      // Group scenes by arcId
      const arcMap = new Map<string, string[]>();
      for (const scene of data.scenes) {
        const arcId = scene.arcId ?? '_ungrouped';
        if (!arcMap.has(arcId)) arcMap.set(arcId, []);
        arcMap.get(arcId)!.push(scene.id);
      }

      for (const [, sceneIds] of arcMap) {
        let arcTotal = 0;
        const counts: Record<PropositionBaseCategory, number> = { Anchor: 0, Seed: 0, Close: 0, Texture: 0 };
        for (const sid of sceneIds) {
          const dist = sceneProfiles.get(sid);
          if (!dist) continue;
          for (const b of BASE_ORDER) { counts[b] += dist[b]; arcTotal += dist[b]; }
        }
        for (const b of BASE_ORDER) {
          perCategory[b].push(arcTotal > 0 ? (counts[b] / arcTotal) * 100 : 0);
        }
        arcCount++;
      }
    }

    // Count all 8 labels by scanning propositions
    const lc: Record<string, number> = {};
    for (const p of ALL_PROFILE_LABELS) lc[p.label] = 0;

    if (sceneProfiles && sceneProfiles.size > 0) {
      for (const scene of data.scenes) {
        const plan = scene.planVersions?.[scene.planVersions.length - 1]?.plan;
        if (!plan?.beats) continue;
        for (let bi = 0; bi < plan.beats.length; bi++) {
          const beat = plan.beats[bi];
          if (!beat.propositions) continue;
          for (let pi = 0; pi < beat.propositions.length; pi++) {
            const cls = getClassification(scene.id, bi, pi);
            if (cls) {
              const label = classificationLabel(cls.base, cls.reach);
              lc[label] = (lc[label] ?? 0) + 1;
            }
          }
        }
      }
    }

    return { totals: t, total: sum, arcTrajectory: arcCount >= 2 ? perCategory : null, labelCounts: lc };
  }, [sceneProfiles, data.propositionCount, data.scenes, getClassification]);

  const hasClassified = Object.values(totals).some(v => v > 0);

  if (total === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white/30 text-sm">No propositions found.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-16">
      <div className="flex items-center gap-3">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-white/25 font-mono">
          Propositions
        </h2>
        <span className="text-[12px] font-mono text-white/40">{total.toLocaleString()}</span>
      </div>

      {hasClassified ? (
        <>
        <div className="grid grid-cols-2 gap-5 w-full max-w-[720px]">
          {BASE_ORDER.map((base) => {
            const count = totals[base];
            const pct = total > 0 ? (count / total) * 100 : 0;
            const values = arcTrajectory?.[base];
            const maxVal = values ? Math.max(...values, 1) : 1;
            const trend = values ? values[values.length - 1] - values[0] : 0;

            return (
              <div key={base} className="rounded-xl p-5 border border-white/5 bg-white/2">
                {/* Header: name + percentage + count */}
                <div className="flex items-baseline justify-between mb-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[28px] font-bold font-mono" style={{ color: BASE_COLORS[base] }}>
                      {pct.toFixed(0)}%
                    </span>
                    <span className="text-[13px] font-medium lowercase" style={{ color: BASE_COLORS[base] }}>{base}</span>
                  </div>
                  <span className="text-[11px] font-mono text-white/20">{count}</span>
                </div>

                {/* Arc trajectory bars */}
                {values && values.length >= 2 && (
                  <>
                    <div className="flex items-end gap-1 h-20">
                      {values.map((v, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t"
                          style={{
                            height: `${Math.max(6, (v / maxVal) * 100)}%`,
                            backgroundColor: BASE_COLORS[base],
                            opacity: 0.35 + (i / values.length) * 0.65,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] font-mono text-white/25 mt-2">
                      {trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend).toFixed(1)}% across arcs
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 8-label distribution — horizontal bars */}
        {Object.values(labelCounts).some(v => v > 0) && (
          <div className="w-full max-w-[720px] grid grid-cols-2 gap-x-6 gap-y-1">
            {ALL_PROFILE_LABELS.map(({ label, color }) => {
              const count = labelCounts[label] ?? 0;
              const maxLabel = Math.max(...Object.values(labelCounts), 1);
              const barPct = (count / maxLabel) * 100;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[9px] w-20 text-right font-medium" style={{ color }}>{label}</span>
                  <div className="flex-1 h-3 bg-white/3 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.7 }} />
                  </div>
                  <span className="text-[8px] font-mono text-white/20 w-8">{count}</span>
                </div>
              );
            })}
          </div>
        )}
        </>
      ) : (
        <div className="text-center">
          <div className="text-[28px] font-bold font-mono text-white/50">{total.toLocaleString()}</div>
          <div className="text-[9px] text-white/25 mt-1">propositions (classification pending)</div>
        </div>
      )}
    </div>
  );
}
