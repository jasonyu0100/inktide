'use client';

import React from 'react';

/**
 * Unique SVG shape for each narrative archetype.
 * Maps force-dominance profiles to visually distinctive icons.
 */

type ArchetypeKey = 'masterwork' | 'epic' | 'chronicle' | 'saga' | 'classic' | 'anthology' | 'atlas' | 'emerging';

interface ArchetypeIconProps {
  archetypeKey: string;
  size?: number;
  color?: string;
  className?: string;
}

/** Default violet-400 matching archetype badge color */
const DEFAULT_COLOR = '#A78BFA';

export function ArchetypeIcon({ archetypeKey, size = 20, color = DEFAULT_COLOR, className }: ArchetypeIconProps) {
  const key = archetypeKey as ArchetypeKey;
  const s = size;
  const half = s / 2;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {SHAPES[key]?.(half, s, color) ?? SHAPES.emerging(half, s, color)}
    </svg>
  );
}

const SHAPES: Record<ArchetypeKey, (half: number, s: number, c: string) => React.ReactNode> = {
  // Masterwork: three overlapping circles (all 3 forces in concert)
  masterwork: (half, s, c) => {
    const r = s * 0.26;
    const cy1 = s * 0.32;
    const cy2 = s * 0.58;
    const cx1 = half - s * 0.18;
    const cx2 = half + s * 0.18;
    return (
      <>
        <circle cx={half} cy={cy1} r={r} stroke={c} strokeWidth={1.2} strokeOpacity={0.8} />
        <circle cx={cx1} cy={cy2} r={r} stroke={c} strokeWidth={1.2} strokeOpacity={0.8} />
        <circle cx={cx2} cy={cy2} r={r} stroke={c} strokeWidth={1.2} strokeOpacity={0.8} />
        <circle cx={half} cy={half} r={s * 0.06} fill={c} fillOpacity={0.9} />
      </>
    );
  },

  // Epic: shield shape (high-stakes payoffs + broad cast)
  epic: (half, s, c) => {
    const pad = s * 0.15;
    return (
      <path
        d={`M ${half} ${pad} L ${s - pad} ${s * 0.3} L ${s - pad} ${s * 0.55} L ${half} ${s - pad} L ${pad} ${s * 0.55} L ${pad} ${s * 0.3} Z`}
        stroke={c}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill={c}
        fillOpacity={0.1}
      />
    );
  },

  // Chronicle: open book (payoff + knowledge — resolutions deepen the world)
  chronicle: (half, s, c) => {
    const top = s * 0.2;
    const bot = s * 0.8;
    const spine = half;
    const left = s * 0.12;
    const right = s - s * 0.12;
    return (
      <>
        <path
          d={`M ${spine} ${top} Q ${(spine + left) / 2} ${top + s * 0.06} ${left} ${top + s * 0.04} L ${left} ${bot - s * 0.04} Q ${(spine + left) / 2} ${bot - s * 0.06} ${spine} ${bot}`}
          stroke={c}
          strokeWidth={1.2}
          fill={c}
          fillOpacity={0.06}
        />
        <path
          d={`M ${spine} ${top} Q ${(spine + right) / 2} ${top + s * 0.06} ${right} ${top + s * 0.04} L ${right} ${bot - s * 0.04} Q ${(spine + right) / 2} ${bot - s * 0.06} ${spine} ${bot}`}
          stroke={c}
          strokeWidth={1.2}
          fill={c}
          fillOpacity={0.06}
        />
        <line x1={spine} y1={top} x2={spine} y2={bot} stroke={c} strokeWidth={1} strokeOpacity={0.4} />
      </>
    );
  },

  // Saga: spiral (expansive in cast and ideas)
  saga: (half, s, c) => {
    const cx = half;
    const cy = half;
    // Approximate a spiral with an arc path
    const r1 = s * 0.08;
    const r2 = s * 0.18;
    const r3 = s * 0.28;
    const r4 = s * 0.38;
    return (
      <path
        d={`M ${cx + r1} ${cy} A ${r1} ${r1} 0 1 1 ${cx - r1} ${cy} A ${r2} ${r2} 0 1 0 ${cx + r2} ${cy} A ${r3} ${r3} 0 1 1 ${cx - r3} ${cy} A ${r4} ${r4} 0 1 0 ${cx + r4} ${cy}`}
        stroke={c}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    );
  },

  // Classic: diamond (clean resolution-driven)
  classic: (half, s, c) => {
    const pad = s * 0.15;
    return (
      <>
        <rect
          x={half - (half - pad)}
          y={half - (half - pad)}
          width={(half - pad) * 2}
          height={(half - pad) * 2}
          transform={`rotate(45 ${half} ${half})`}
          stroke={c}
          strokeWidth={1.2}
          strokeLinejoin="round"
          fill={c}
          fillOpacity={0.1}
        />
        <circle cx={half} cy={half} r={s * 0.06} fill={c} fillOpacity={0.8} />
      </>
    );
  },

  // Anthology: overlapping squares / mosaic (many lives woven)
  anthology: (half, s, c) => {
    const sz = s * 0.32;
    const off = s * 0.12;
    return (
      <>
        <rect x={half - sz / 2 - off} y={half - sz / 2 - off} width={sz} height={sz} rx={1.5} stroke={c} strokeWidth={1} fill={c} fillOpacity={0.08} />
        <rect x={half - sz / 2 + off} y={half - sz / 2 - off} width={sz} height={sz} rx={1.5} stroke={c} strokeWidth={1} fill={c} fillOpacity={0.08} />
        <rect x={half - sz / 2 - off} y={half - sz / 2 + off} width={sz} height={sz} rx={1.5} stroke={c} strokeWidth={1} fill={c} fillOpacity={0.08} />
        <rect x={half - sz / 2 + off} y={half - sz / 2 + off} width={sz} height={sz} rx={1.5} stroke={c} strokeWidth={1} fill={c} fillOpacity={0.08} />
      </>
    );
  },

  // Atlas: hexagon (dense with ideas and systems)
  atlas: (half, s, c) => {
    const r = s * 0.4;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      return `${half + r * Math.cos(angle)},${half + r * Math.sin(angle)}`;
    }).join(' ');
    return (
      <>
        <polygon points={pts} stroke={c} strokeWidth={1.2} strokeLinejoin="round" fill={c} fillOpacity={0.08} />
        {/* Inner connections suggesting a knowledge graph */}
        <line x1={half} y1={half - r * 0.6} x2={half - r * 0.5} y2={half + r * 0.3} stroke={c} strokeWidth={0.8} strokeOpacity={0.3} />
        <line x1={half} y1={half - r * 0.6} x2={half + r * 0.5} y2={half + r * 0.3} stroke={c} strokeWidth={0.8} strokeOpacity={0.3} />
        <line x1={half - r * 0.5} y1={half + r * 0.3} x2={half + r * 0.5} y2={half + r * 0.3} stroke={c} strokeWidth={0.8} strokeOpacity={0.3} />
      </>
    );
  },

  // Emerging: dashed circle (still finding its form)
  emerging: (half, _s, c) => {
    const r = half * 0.65;
    return (
      <circle
        cx={half}
        cy={half}
        r={r}
        stroke={c}
        strokeWidth={1.2}
        strokeDasharray={`${r * 0.5} ${r * 0.3}`}
        strokeLinecap="round"
      />
    );
  },
};
