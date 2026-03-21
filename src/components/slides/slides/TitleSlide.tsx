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
    <div className="flex items-center justify-center h-full px-12 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 45%, ${dominantColors[dominant]}08 0%, transparent 70%)`,
        }}
      />

      <div className={`flex items-center gap-10 relative ${data.coverImageUrl ? '' : 'flex-col text-center'}`}>
        {/* Cover image */}
        {data.coverImageUrl && (
          <div className="w-56 shrink-0 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <img src={data.coverImageUrl} alt="" className="w-full aspect-3/4 object-cover" />
          </div>
        )}

        {/* Title & description */}
        <div className={data.coverImageUrl ? 'text-left' : ''}>
          <h1 className="text-5xl font-bold text-text-primary mb-3 leading-tight max-w-2xl">
            {data.title}
          </h1>

          {data.description && (
            <p className="text-lg text-text-secondary max-w-xl leading-relaxed">
              {data.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
