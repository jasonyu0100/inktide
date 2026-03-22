'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import type { NarrativeState, CubeCornerKey, ForceSnapshot, Scene } from '@/types/narrative';
import { NARRATIVE_CUBE, resolveEntry, isScene } from '@/types/narrative';
import { computeForceSnapshots, detectCubeCorner } from '@/lib/narrative-utils';

// ── Types ────────────────────────────────────────────────────────────────────

type TransitionMatrix = Record<CubeCornerKey, Record<CubeCornerKey, number>>;
type TransitionRow = Record<CubeCornerKey, number>;

type Props = {
  narrative: NarrativeState;
  resolvedKeys: string[];
  currentSceneIndex: number;
  onClose: () => void;
};

// ── Constants ────────────────────────────────────────────────────────────────

const CORNERS: CubeCornerKey[] = ['HHH', 'HHL', 'HLH', 'HLL', 'LHH', 'LHL', 'LLH', 'LLL'];

const CORNER_COLORS: Record<CubeCornerKey, string> = {
  HHH: '#f59e0b', HHL: '#ef4444', HLH: '#a855f7', HLL: '#6366f1',
  LHH: '#22d3ee', LHL: '#22c55e', LLH: '#3b82f6', LLL: '#6b7280',
};

function probToHeatColor(prob: number): string {
  if (prob === 0) return 'transparent';
  const intensity = Math.round(20 + prob * 80);
  return `rgba(52, 211, 153, ${intensity / 100})`;
}

function probToTextColor(prob: number): string {
  if (prob >= 0.25) return '#ffffff';
  if (prob > 0.05) return '#d1d5db';
  return '#4b5563';
}

// ── Computation ──────────────────────────────────────────────────────────────

function buildTransitionMatrix(scenes: { id: string; forces: ForceSnapshot }[]): TransitionMatrix {
  const counts = {} as TransitionMatrix;
  for (const from of CORNERS) {
    counts[from] = {} as Record<CubeCornerKey, number>;
    for (const to of CORNERS) counts[from][to] = 0;
  }
  for (let i = 0; i < scenes.length - 1; i++) {
    const fromCorner = detectCubeCorner(scenes[i].forces).key;
    const toCorner = detectCubeCorner(scenes[i + 1].forces).key;
    counts[fromCorner][toCorner]++;
  }
  return counts;
}

function normalizeRow(row: Record<CubeCornerKey, number>): TransitionRow {
  const total = Object.values(row).reduce((s, v) => s + v, 0);
  if (total === 0) {
    const result = {} as TransitionRow;
    for (const c of CORNERS) result[c] = 0;
    return result;
  }
  const result = {} as TransitionRow;
  for (const c of CORNERS) result[c] = row[c] / total;
  return result;
}

function cornerSequence(scenes: { id: string; forces: ForceSnapshot }[]): CubeCornerKey[] {
  return scenes.map((s) => detectCubeCorner(s.forces).key);
}

function stationaryDistribution(matrix: TransitionMatrix, iterations = 100): Record<CubeCornerKey, number> {
  let dist = {} as Record<CubeCornerKey, number>;
  for (const c of CORNERS) dist[c] = 1 / CORNERS.length;
  for (let iter = 0; iter < iterations; iter++) {
    const next = {} as Record<CubeCornerKey, number>;
    for (const to of CORNERS) {
      let sum = 0;
      for (const from of CORNERS) sum += dist[from] * normalizeRow(matrix[from])[to];
      next[to] = sum;
    }
    dist = next;
  }
  return dist;
}

// ── Rhythm Diagnosis ─────────────────────────────────────────────────────────

function diagnoseRhythm(
  stationary: Record<CubeCornerKey, number>,
  sequence: CubeCornerKey[],
): string[] {
  const insights: string[] = [];
  if (sequence.length < 3) return ['Too few scenes to analyse rhythm.'];

  const sorted = CORNERS
    .filter((c) => stationary[c] > 0.01)
    .sort((a, b) => stationary[b] - stationary[a]);

  const top = sorted[0];
  const topPct = stationary[top] * 100;

  if (topPct > 40) {
    insights.push(`Dominated by ${NARRATIVE_CUBE[top].name} (${topPct.toFixed(0)}%). The story circles a single mode — consider breaking the pattern.`);
  }

  // Check for missing modes
  const absent = CORNERS.filter((c) => stationary[c] < 0.02);
  if (absent.length >= 4) {
    const names = absent.map((c) => NARRATIVE_CUBE[c].name).join(', ');
    insights.push(`Never visits: ${names}. A narrow range — the rhythm has limited variety.`);
  }

  // Check for payoff drought (no Epoch/Climax/Revelation/Closure)
  const payoffModes: CubeCornerKey[] = ['HHH', 'HHL', 'HLH', 'HLL'];
  const payoffPct = payoffModes.reduce((s, c) => s + stationary[c], 0) * 100;
  if (payoffPct < 15 && sequence.length > 10) {
    insights.push(`Only ${payoffPct.toFixed(0)}% payoff modes. Threads may be building without release.`);
  }

  // Check for no breathing room
  const restPct = (stationary['LLL'] + stationary['LLH']) * 100;
  if (restPct < 5 && sequence.length > 10) {
    insights.push('Almost no Rest or Lore. The story may feel exhausting without breathing room.');
  }

  // Self-loop check
  let selfLoopTotal = 0;
  for (const c of CORNERS) selfLoopTotal += (normalizeRow({} as Record<CubeCornerKey, number>)[c] ?? 0);
  // Actually check from sequence
  let repeats = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] === sequence[i - 1]) repeats++;
  }
  const repeatPct = (repeats / Math.max(sequence.length - 1, 1)) * 100;
  if (repeatPct > 50) {
    insights.push(`${repeatPct.toFixed(0)}% of transitions are self-loops. The story tends to stay in the same mode.`);
  }

  if (insights.length === 0) {
    insights.push('Balanced rhythm with good variety across narrative modes.');
  }

  return insights;
}

// ── Graph Layout ─────────────────────────────────────────────────────────────

type NodePos = { x: number; y: number };

function circleLayout(width: number, height: number): Record<CubeCornerKey, NodePos> {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.34;
  const positions = {} as Record<CubeCornerKey, NodePos>;
  CORNERS.forEach((c, i) => {
    const angle = (i / CORNERS.length) * Math.PI * 2 - Math.PI / 2;
    positions[c] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return positions;
}

// ── SVG Graph ────────────────────────────────────────────────────────────────

function TransitionGraph({
  matrix,
  sequence,
  stationary,
  width,
  height,
  focusedCorner,
  onFocusCorner,
}: {
  matrix: TransitionMatrix;
  sequence: CubeCornerKey[];
  stationary: Record<CubeCornerKey, number>;
  width: number;
  height: number;
  focusedCorner: CubeCornerKey | null;
  onFocusCorner: (c: CubeCornerKey | null) => void;
}) {
  const positions = useMemo(() => circleLayout(width, height), [width, height]);
  const [hoveredCorner, setHoveredCorner] = useState<CubeCornerKey | null>(null);

  const activeCorner = focusedCorner ?? hoveredCorner;

  const maxCount = useMemo(() => {
    let max = 0;
    for (const from of CORNERS)
      for (const to of CORNERS)
        if (from !== to && matrix[from][to] > max) max = matrix[from][to];
    return Math.max(max, 1);
  }, [matrix]);

  const selfLoops = useMemo(() => {
    const loops = {} as Record<CubeCornerKey, number>;
    for (const c of CORNERS) loops[c] = matrix[c][c];
    return loops;
  }, [matrix]);

  const visitCounts = useMemo(() => {
    const counts = {} as Record<CubeCornerKey, number>;
    for (const c of CORNERS) counts[c] = 0;
    for (const c of sequence) counts[c]++;
    return counts;
  }, [sequence]);

  const maxVisits = Math.max(...Object.values(visitCounts), 1);
  const currentMode = sequence.length > 0 ? sequence[sequence.length - 1] : null;

  return (
    <svg width={width} height={height} className="select-none">
      <defs>
        <marker id="arrow-heat" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 3 L 0 6 z" fill="rgba(52, 211, 153, 0.7)" />
        </marker>
      </defs>

      {/* Edges */}
      {CORNERS.map((from) =>
        CORNERS.filter((to) => to !== from && matrix[from][to] > 0).map((to) => {
          const count = matrix[from][to];
          const prob = normalizeRow(matrix[from])[to];
          const p1 = positions[from];
          const p2 = positions[to];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len;
          const ny = dx / len;
          const offset = 5;

          const nodeR = 16 + (visitCounts[to] / maxVisits) * 8;
          const ratio = Math.max(0, (len - nodeR - 8) / len);
          const sx = p1.x + offset * nx;
          const sy = p1.y + offset * ny;
          const ex = p1.x + dx * ratio + offset * nx;
          const ey = p1.y + dy * ratio + offset * ny;

          const isRelevant = activeCorner === from || activeCorner === to;
          const baseOpacity = 0.1 + 0.8 * (count / maxCount);
          const opacity = activeCorner ? (isRelevant ? Math.max(baseOpacity, 0.5) : 0.02) : baseOpacity;
          const strokeWidth = 1 + 2.5 * (count / maxCount);

          return (
            <g key={`${from}-${to}`}>
              <line
                x1={sx} y1={sy} x2={ex} y2={ey}
                stroke="rgba(52, 211, 153, 1)"
                strokeWidth={strokeWidth}
                opacity={opacity}
                markerEnd="url(#arrow-heat)"
                className="transition-opacity duration-150"
              />
              {isRelevant && prob > 0.05 && (
                <text
                  x={(sx + ex) / 2 + nx * 14} y={(sy + ey) / 2 + ny * 14}
                  fill="#ffffff" fontSize="10" fontWeight="500"
                  textAnchor="middle" dominantBaseline="middle"
                  className="pointer-events-none"
                >
                  {(prob * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        }),
      )}

      {/* Nodes */}
      {CORNERS.map((c) => {
        const pos = positions[c];
        const corner = NARRATIVE_CUBE[c];
        const visits = visitCounts[c];
        const r = 16 + (visits / maxVisits) * 8;
        const isHighlighted = activeCorner === c || activeCorner === null;
        const isCurrent = currentMode === c;
        const isFocused = focusedCorner === c;

        return (
          <g
            key={c}
            className="cursor-pointer transition-opacity duration-150"
            opacity={isHighlighted ? 1 : 0.2}
            onMouseEnter={() => setHoveredCorner(c)}
            onMouseLeave={() => setHoveredCorner(null)}
            onClick={() => onFocusCorner(isFocused ? null : c)}
          >
            {isCurrent && (
              <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={CORNER_COLORS[c]} strokeWidth={2} opacity={0.5}>
                <animate attributeName="r" values={`${r + 4};${r + 10};${r + 4}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            {isFocused && (
              <circle cx={pos.x} cy={pos.y} r={r + 4} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.6} />
            )}
            {selfLoops[c] > 0 && (
              <circle
                cx={pos.x} cy={pos.y}
                r={r + 3 + (selfLoops[c] / maxCount) * 5}
                fill="none" stroke={CORNER_COLORS[c]}
                strokeWidth={1 + (selfLoops[c] / maxCount) * 1.5}
                strokeDasharray="4 3" opacity={0.35}
              />
            )}
            <circle cx={pos.x} cy={pos.y} r={r} fill={CORNER_COLORS[c]} opacity={0.9}
              stroke={isFocused ? '#ffffff' : hoveredCorner === c ? '#ffffff' : 'transparent'}
              strokeWidth={isFocused ? 2.5 : 2}
            />
            <text x={pos.x} y={pos.y} fill="#fff" fontSize="10" fontWeight="600"
              textAnchor="middle" dominantBaseline="middle" className="pointer-events-none">
              {corner.name.length > 6 ? corner.name.slice(0, 5) : corner.name}
            </text>
            <text x={pos.x} y={pos.y + r + 13} fill="#9ca3af" fontSize="9"
              textAnchor="middle" className="pointer-events-none">
              {visits > 0 ? `${visits}×` : '—'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Focus Panel (shown when a corner is selected) ────────────────────────────

function FocusPanel({
  corner,
  matrix,
  stationary,
  sequence,
  onClose,
}: {
  corner: CubeCornerKey;
  matrix: TransitionMatrix;
  stationary: Record<CubeCornerKey, number>;
  sequence: CubeCornerKey[];
  onClose: () => void;
}) {
  const cube = NARRATIVE_CUBE[corner];
  const outgoing = normalizeRow(matrix[corner]);
  const outgoingCount = Object.values(matrix[corner]).reduce((s, v) => s + v, 0);

  // Incoming
  const incoming = {} as Record<CubeCornerKey, number>;
  const incomingCounts = {} as Record<CubeCornerKey, number>;
  for (const from of CORNERS) {
    incomingCounts[from] = matrix[from][corner];
  }
  const inTotal = Object.values(incomingCounts).reduce((s, v) => s + v, 0);
  for (const from of CORNERS) {
    incoming[from] = inTotal > 0 ? incomingCounts[from] / inTotal : 0;
  }

  // Visit count
  const visits = sequence.filter((c) => c === corner).length;

  // Average dwell time (consecutive runs)
  let runs = 0;
  let runLength = 0;
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] === corner) {
      runLength++;
    } else if (runLength > 0) {
      runs++;
      runLength = 0;
    }
  }
  if (runLength > 0) runs++;
  const avgDwell = runs > 0 ? (visits / runs).toFixed(1) : '—';

  const sortedOutgoing = CORNERS
    .map((c) => ({ corner: c, prob: outgoing[c], count: matrix[corner][c] }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.prob - a.prob);

  const sortedIncoming = CORNERS
    .map((c) => ({ corner: c, prob: incoming[c], count: incomingCounts[c] }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.prob - a.prob);

  return (
    <div className="border-t border-white/5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CORNER_COLORS[corner] }} />
          <span className="text-[13px] font-semibold" style={{ color: CORNER_COLORS[corner] }}>
            {cube.name}
          </span>
          <span className="text-[11px] text-text-dim">{cube.description.slice(0, 80)}…</span>
        </div>
        <button onClick={onClose} className="text-[10px] text-text-dim hover:text-text-primary px-2 py-0.5 rounded hover:bg-white/5">
          Clear
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3 text-[11px]">
        <div>
          <span className="text-text-dim">Visits: </span>
          <span className="text-text-primary font-medium">{visits}</span>
        </div>
        <div>
          <span className="text-text-dim">Equilibrium: </span>
          <span className="text-text-primary font-medium">{(stationary[corner] * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-text-dim">Avg dwell: </span>
          <span className="text-text-primary font-medium">{avgDwell} scenes</span>
        </div>
        <div>
          <span className="text-text-dim">Self-loop: </span>
          <span className="text-text-primary font-medium">
            {outgoingCount > 0 ? `${(outgoing[corner] * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Outgoing + Incoming side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5 font-medium">
            Outgoing ({outgoingCount})
          </div>
          <div className="space-y-1">
            {sortedOutgoing.map(({ corner: to, prob, count }) => (
              <div key={to} className="flex items-center gap-2 text-[11px]">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CORNER_COLORS[to] }} />
                <span className="w-16 truncate" style={{ color: CORNER_COLORS[to] }}>{NARRATIVE_CUBE[to].name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${prob * 100}%`, backgroundColor: 'rgba(52, 211, 153, 0.7)' }}
                  />
                </div>
                <span className="text-text-dim tabular-nums w-8 text-right">{(prob * 100).toFixed(0)}%</span>
                <span className="text-text-dim/50 tabular-nums w-4 text-right text-[10px]">{count}</span>
              </div>
            ))}
            {sortedOutgoing.length === 0 && (
              <span className="text-[10px] text-text-dim">No outgoing transitions</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5 font-medium">
            Incoming ({inTotal})
          </div>
          <div className="space-y-1">
            {sortedIncoming.map(({ corner: from, prob, count }) => (
              <div key={from} className="flex items-center gap-2 text-[11px]">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CORNER_COLORS[from] }} />
                <span className="w-16 truncate" style={{ color: CORNER_COLORS[from] }}>{NARRATIVE_CUBE[from].name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${prob * 100}%`, backgroundColor: 'rgba(52, 211, 153, 0.7)' }}
                  />
                </div>
                <span className="text-text-dim tabular-nums w-8 text-right">{(prob * 100).toFixed(0)}%</span>
                <span className="text-text-dim/50 tabular-nums w-4 text-right text-[10px]">{count}</span>
              </div>
            ))}
            {sortedIncoming.length === 0 && (
              <span className="text-[10px] text-text-dim">No incoming transitions</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sequence Strip (compact) ─────────────────────────────────────────────────

function SequenceStrip({ sequence }: { sequence: CubeCornerKey[] }) {
  return (
    <div className="flex gap-px items-center h-4 overflow-x-auto">
      {sequence.map((c, i) => (
        <div
          key={i}
          className="shrink-0 w-1.5 h-full rounded-sm"
          style={{ backgroundColor: CORNER_COLORS[c], opacity: 0.5 + 0.5 * (i / Math.max(sequence.length - 1, 1)) }}
          title={`Scene ${i + 1}: ${NARRATIVE_CUBE[c].name}`}
        />
      ))}
    </div>
  );
}

// ── Transition Table ─────────────────────────────────────────────────────────

function TransitionTable({
  matrix,
  focusedCorner,
  onFocusCorner,
}: {
  matrix: TransitionMatrix;
  focusedCorner: CubeCornerKey | null;
  onFocusCorner: (c: CubeCornerKey | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="p-1 text-left text-text-dim font-medium w-16">→</th>
            {CORNERS.map((c) => (
              <th key={c} className="p-1 text-center font-medium" style={{ color: CORNER_COLORS[c] }}>
                {NARRATIVE_CUBE[c].name.slice(0, 4)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CORNERS.map((from) => {
            const row = normalizeRow(matrix[from]);
            const totalCount = Object.values(matrix[from]).reduce((s, v) => s + v, 0);
            const isFocused = focusedCorner === from;
            return (
              <tr
                key={from}
                className={`border-t border-white/5 cursor-pointer transition-colors ${
                  isFocused ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
                onClick={() => onFocusCorner(isFocused ? null : from)}
              >
                <td className="p-1 font-medium" style={{ color: CORNER_COLORS[from] }}>
                  {NARRATIVE_CUBE[from].name.slice(0, 5)}
                </td>
                {CORNERS.map((to) => {
                  const prob = row[to];
                  return (
                    <td
                      key={to}
                      className="p-1 text-center tabular-nums"
                      style={{
                        backgroundColor: probToHeatColor(prob),
                        color: probToTextColor(prob),
                      }}
                      title={`${NARRATIVE_CUBE[from].name} → ${NARRATIVE_CUBE[to].name}: ${(prob * 100).toFixed(1)}%`}
                    >
                      {totalCount > 0 && prob > 0 ? `${(prob * 100).toFixed(0)}` : totalCount > 0 ? '·' : '–'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Equilibrium Bars ─────────────────────────────────────────────────────────

function StationaryBars({ stationary }: { stationary: Record<CubeCornerKey, number> }) {
  const maxPct = Math.max(...Object.values(stationary)) * 100;
  return (
    <div className="flex items-end gap-1.5 h-16">
      {CORNERS.map((c) => {
        const pct = stationary[c] * 100;
        const h = maxPct > 0 ? (pct / maxPct) * 50 : 0;
        return (
          <div key={c} className="flex-1 flex flex-col items-center gap-0.5">
            {pct > 1 && (
              <span className="text-[8px] tabular-nums text-text-dim">{pct.toFixed(0)}%</span>
            )}
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(h, pct > 0 ? 2 : 0)}px`,
                backgroundColor: CORNER_COLORS[c],
                opacity: 0.85,
              }}
            />
            <span className="text-[7px] text-text-dim font-medium leading-none">
              {NARRATIVE_CUBE[c].name.slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Prediction Panel ─────────────────────────────────────────────────────────

function PredictionPanel({
  currentMode,
  matrix,
}: {
  currentMode: CubeCornerKey;
  matrix: TransitionMatrix;
}) {
  const row = normalizeRow(matrix[currentMode]);
  const sorted = CORNERS
    .map((c) => ({ corner: c, prob: row[c] }))
    .filter((o) => o.prob > 0.01)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 4);

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-text-dim uppercase tracking-wider font-medium">
        Next from {NARRATIVE_CUBE[currentMode].name}
      </div>
      {sorted.map(({ corner, prob }) => (
        <div key={corner} className="flex items-center gap-2 text-[11px]">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CORNER_COLORS[corner] }} />
          <span className="w-16" style={{ color: CORNER_COLORS[corner] }}>{NARRATIVE_CUBE[corner].name}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${prob * 100}%`, backgroundColor: CORNER_COLORS[corner], opacity: 0.7 }}
            />
          </div>
          <span className="text-text-dim tabular-nums text-[10px] w-8 text-right">{(prob * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────

export function MarkovChainModal({ narrative, resolvedKeys, currentSceneIndex, onClose }: Props) {
  const [focusedCorner, setFocusedCorner] = useState<CubeCornerKey | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ width: 480, height: 360 });

  useEffect(() => {
    if (!graphRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setGraphSize({ width: Math.max(width, 280), height: Math.max(height, 280) });
      }
    });
    ro.observe(graphRef.current);
    return () => ro.disconnect();
  }, []);

  const { matrix, sequence: cornerSeq, stationary, totalTransitions } = useMemo(() => {
    const scenes = resolvedKeys
      .map((k) => resolveEntry(narrative, k))
      .filter((e): e is Scene => !!e && isScene(e));
    if (scenes.length === 0) {
      const emptyMatrix = {} as TransitionMatrix;
      for (const from of CORNERS) {
        emptyMatrix[from] = {} as Record<CubeCornerKey, number>;
        for (const to of CORNERS) emptyMatrix[from][to] = 0;
      }
      return {
        matrix: emptyMatrix,
        sequence: [] as CubeCornerKey[],
        stationary: {} as Record<CubeCornerKey, number>,
        totalTransitions: 0,
      };
    }

    const snapshots = computeForceSnapshots(scenes);
    const scenesWithForces = scenes.map((s) => ({
      id: s.id,
      forces: snapshots[s.id] || { payoff: 0, change: 0, knowledge: 0 },
    }));

    const mat = buildTransitionMatrix(scenesWithForces);
    const seq = cornerSequence(scenesWithForces);
    const stat = stationaryDistribution(mat);
    const total = CORNERS.reduce(
      (s, from) => s + CORNERS.reduce((s2, to) => s2 + mat[from][to], 0), 0,
    );

    return { matrix: mat, sequence: seq, stationary: stat, totalTransitions: total };
  }, [narrative, resolvedKeys]);

  const currentMode = cornerSeq.length > 0 ? cornerSeq[cornerSeq.length - 1] : null;
  const diagnosis = useMemo(() => diagnoseRhythm(stationary, cornerSeq), [stationary, cornerSeq]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-panel rounded-2xl flex flex-col w-full max-w-5xl"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">State Machine</h2>
            {currentMode && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CORNER_COLORS[currentMode] }} />
                <span className="text-text-dim">Now:</span>
                <span style={{ color: CORNER_COLORS[currentMode] }} className="font-medium">
                  {NARRATIVE_CUBE[currentMode].name}
                </span>
              </div>
            )}
            <span className="text-[10px] text-text-dim">
              {cornerSeq.length} scenes · {totalTransitions} transitions
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMatrix((v) => !v)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                showMatrix ? 'bg-white/10 text-text-primary' : 'text-text-dim hover:text-text-primary hover:bg-white/5'
              }`}
            >
              Matrix
            </button>
            <button
              onClick={onClose}
              className="ml-2 p-1 rounded hover:bg-white/10 text-text-dim hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content — two-column layout */}
        <div className="flex-1 overflow-auto">
          <div className="flex">
            {/* Left: graph */}
            <div className="flex-1 min-w-0">
              <div ref={graphRef} className="min-h-[360px] p-1">
                <TransitionGraph
                  matrix={matrix}
                  sequence={cornerSeq}
                  stationary={stationary}
                  width={graphSize.width}
                  height={graphSize.height}
                  focusedCorner={focusedCorner}
                  onFocusCorner={setFocusedCorner}
                />
              </div>
            </div>

            {/* Right: sidebar panels */}
            <div className="w-64 border-l border-white/5 p-4 space-y-5 shrink-0">
              {/* Prediction */}
              {currentMode && (
                <PredictionPanel currentMode={currentMode} matrix={matrix} />
              )}

              {/* Equilibrium */}
              <div>
                <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5 font-medium">
                  Equilibrium
                </div>
                <StationaryBars stationary={stationary} />
              </div>

              {/* Diagnosis */}
              <div>
                <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5 font-medium">
                  Rhythm
                </div>
                <div className="space-y-1">
                  {diagnosis.map((d, i) => (
                    <p key={i} className="text-[10px] text-text-secondary leading-snug">{d}</p>
                  ))}
                </div>
              </div>

              {/* Sequence strip */}
              <div>
                <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5 font-medium">
                  Timeline
                </div>
                <SequenceStrip sequence={cornerSeq} />
              </div>
            </div>
          </div>

          {/* Focus panel (appears when a node is clicked) */}
          {focusedCorner && (
            <FocusPanel
              corner={focusedCorner}
              matrix={matrix}
              stationary={stationary}
              sequence={cornerSeq}
              onClose={() => setFocusedCorner(null)}
            />
          )}

          {/* Matrix (toggleable) */}
          {showMatrix && (
            <div className="border-t border-white/5 p-4">
              <TransitionTable
                matrix={matrix}
                focusedCorner={focusedCorner}
                onFocusCorner={setFocusedCorner}
              />
              <div className="flex items-center gap-3 mt-2 text-[9px] text-text-dim">
                <span>Probability:</span>
                <div className="flex items-center gap-1">
                  <div className="w-10 h-2 rounded-sm" style={{ background: 'linear-gradient(to right, rgba(52,211,153,0.05), rgba(52,211,153,0.9))' }} />
                  <span>0%</span>
                  <span className="ml-6">100%</span>
                </div>
                <span className="ml-auto">Click a row to focus</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
