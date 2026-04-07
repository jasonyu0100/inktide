'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { SlidesData } from '@/lib/slides-data';
import { BASE_COLORS } from '@/lib/proposition-classify';
import { usePropositionClassification } from '@/hooks/usePropositionClassification';
import type { PropositionBaseCategory } from '@/types/narrative';

const BASE_ORDER: PropositionBaseCategory[] = ['Anchor', 'Seed', 'Close', 'Texture'];

const DESCRIPTIONS: Record<PropositionBaseCategory, string> = {
  Anchor: 'structural spine',
  Seed: 'planting forward',
  Close: 'resolving chains',
  Texture: 'atmosphere',
};

function CategoryChart({ values, base, maxVal }: { values: number[]; base: PropositionBaseCategory; maxVal: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const color = BASE_COLORS[base];
  const n = values.length;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!svgRef.current || n === 0) return;

    const width = 280;
    const height = 80;
    const margin = { top: 4, right: 4, bottom: 4, left: 4 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, n - 1]).range([0, w]);
    const y = d3.scaleLinear().domain([0, maxVal]).range([h, 0]);
    const barW = Math.max(1, w / n - 0.5);

    // Background
    g.append('rect')
      .attr('width', w).attr('height', h)
      .attr('fill', 'rgba(255,255,255,0.02)')
      .attr('rx', 3);

    // Smooth area fill + line
    const area = d3.area<number>()
      .x((_, i) => x(i))
      .y0(h)
      .y1(d => y(d))
      .curve(d3.curveMonotoneX);

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(values)
      .attr('fill', color)
      .attr('opacity', 0.15)
      .attr('d', area);

    g.append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8)
      .attr('d', line);
  }, [values, base, maxVal, n, color]);

  return <svg ref={svgRef} className="w-full h-auto" />;
}

export function PropositionTimelineSlide({ data }: { data: SlidesData }) {
  const { sceneProfiles } = usePropositionClassification();

  const chartData = useMemo(() => {
    // Try classification context first, fall back to SlidesData timeline
    const perCategory: Record<PropositionBaseCategory, number[]> = {
      Anchor: [], Seed: [], Close: [], Texture: [],
    };
    let hasClassified = false;

    if (sceneProfiles && sceneProfiles.size > 0) {
      // Use classification results
      for (const t of data.propositionTimeline) {
        const dist = sceneProfiles.get(data.propositionTimeline[t.sceneIdx]
          ? Object.keys(Object.fromEntries([...sceneProfiles]))[t.sceneIdx]
          : '');
        // Simpler: iterate the timeline and match by index
        for (const base of BASE_ORDER) {
          perCategory[base].push(0);
        }
      }
      // Actually, iterate sceneProfiles in order matching propositionTimeline
      const sceneIds = [...sceneProfiles.keys()];
      for (const base of BASE_ORDER) perCategory[base] = [];
      for (const sid of sceneIds) {
        const dist = sceneProfiles.get(sid)!;
        for (const base of BASE_ORDER) {
          perCategory[base].push(dist[base] ?? 0);
        }
      }
      hasClassified = sceneIds.length > 0 && BASE_ORDER.some(b => perCategory[b].some(v => v > 0));
    }

    if (!hasClassified) {
      // Fall back to raw timeline totals (unclassified)
      for (const base of BASE_ORDER) perCategory[base] = [];
      for (const t of data.propositionTimeline) {
        perCategory.Anchor.push(0);
        perCategory.Seed.push(0);
        perCategory.Close.push(0);
        perCategory.Texture.push(t.total); // Show all as texture when unclassified
      }
    }

    return { perCategory, hasClassified };
  }, [sceneProfiles, data.propositionTimeline]);

  if (data.propositionCount === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white/30 text-sm">No propositions found.</p>
      </div>
    );
  }

  // Global max across all categories for consistent scale comparison
  const globalMax = Math.max(
    ...BASE_ORDER.map(b => Math.max(...chartData.perCategory[b], 1))
  );

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-12">
      <h2 className="text-[10px] uppercase tracking-[0.25em] text-white/25 font-mono">
        {chartData.hasClassified ? 'Proposition Timelines' : 'Proposition Density'}
      </h2>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[620px]">
        {BASE_ORDER.map((base) => {
          const values = chartData.perCategory[base];
          const total = values.reduce((s, v) => s + v, 0);
          const show = chartData.hasClassified || base === 'Texture'; // Only show texture when unclassified

          if (!show) return null;

          return (
            <div key={base} className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] font-medium lowercase" style={{ color: BASE_COLORS[base] }}>
                  {base}
                </span>
                <span className="text-[8px] font-mono text-white/25">{total}</span>
              </div>
              <CategoryChart values={values} base={base} maxVal={globalMax} />
              <div className="text-[7px] text-white/20 mt-0.5 text-center">{DESCRIPTIONS[base]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
