'use client';

import React from 'react';
import type { SlidesData } from '@/lib/slides-data';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';

const gradeColor = (v: number) => {
  if (v >= 90) return '#22C55E';
  if (v >= 80) return '#A3E635';
  if (v >= 70) return '#FACC15';
  if (v >= 60) return '#F97316';
  return '#EF4444';
};

export function TitleSlide({ data }: { data: SlidesData }) {
  const dominant = (['payoff', 'change', 'knowledge'] as const)
    .reduce((a, b) => data.overallGrades[a] > data.overallGrades[b] ? a : b);
  const dominantColors: Record<string, string> = { payoff: '#EF4444', change: '#22C55E', knowledge: '#3B82F6' };

  return (
    <div className="flex flex-col items-center justify-center h-full px-12 text-center relative overflow-hidden">
      {/* Subtle radial glow behind title */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 45%, ${dominantColors[dominant]}08 0%, transparent 70%)`,
        }}
      />

      {/* Cover image */}
      {data.coverImageUrl && (
        <div className="w-32 h-32 rounded-2xl overflow-hidden mb-8 border border-white/10 shadow-2xl relative">
          <img src={data.coverImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Title */}
      <h1 className="text-5xl font-bold text-text-primary mb-3 leading-tight max-w-3xl relative">
        {data.title}
      </h1>

      {data.description && (
        <p className="text-lg text-text-secondary max-w-2xl mb-8 leading-relaxed relative">
          {data.description}
        </p>
      )}
    </div>
  );
}
