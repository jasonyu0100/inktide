'use client';

/**
 * Market dashboard — a Polymarket-esque canvas view of the prediction-market
 * portfolio. Replaces the old ThreadGraphModal. Reactive to the current scene
 * index: scrubbing replays every thread's belief up to that point and the
 * dashboard animates alongside it.
 *
 * Layout:
 *   ┌─────────────────────────────┬──────────────┐
 *   │  Featured market            │  Breaking    │
 *   │    outcomes + trajectory    │  Hot topics  │
 *   ├─────────────────────────────┴──────────────┤
 *   │  All markets (filter bar + card grid)       │
 *   └─────────────────────────────────────────────┘
 *
 * We're passive observers right now — the dashboard reads the narrative but
 * never dispatches evidence. Future iterations will add controls for
 * operators to influence the markets directly.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NarrativeState, Thread } from '@/types/narrative';
import { useStore } from '@/lib/store';
import {
  buildPortfolioRows,
  buildThreadTrajectory,
  computePortfolioSnapshot,
  currentFocusIds,
  replayThreadsAtIndex,
  type PortfolioRow,
  type ThreadTrajectoryPoint,
} from '@/lib/portfolio-analytics';
import {
  THREAD_CATEGORY_HEX,
  THREAD_CATEGORY_LABEL,
  THREAD_CATEGORY_DESCRIPTION,
  type ThreadCategory,
} from '@/lib/thread-category';
import { getMarketBelief, getMarketMargin, getMarketProbs, countScenes, sceneOrdinalAt } from '@/lib/narrative-utils';

// ── Palette ────────────────────────────────────────────────────────────────

// Per-outcome colours for the probability trajectory + outcome list. Top
// outcome in the featured market's distribution takes the brightest slot.
const OUTCOME_HEX = [
  '#38BDF8', // sky — leader
  '#FBBF24', // amber
  '#2DD4BF', // teal
  '#A78BFA', // violet
  '#FB7185', // rose
  '#34D399', // emerald
];

// ── Category filter chips ──────────────────────────────────────────────────

type CategoryFilter = 'all' | ThreadCategory;

const CATEGORY_FILTER_ORDER: CategoryFilter[] = [
  'all',
  'saturating',
  'contested',
  'volatile',
  'committed',
  'dormant',
  'resolved',
  'abandoned',
];

function CategoryFilterBar({
  active,
  onChange,
  counts,
}: {
  active: CategoryFilter;
  onChange: (c: CategoryFilter) => void;
  counts: Record<CategoryFilter, number>;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {CATEGORY_FILTER_ORDER.map((cat) => {
        if (cat !== 'all' && counts[cat] === 0) return null;
        const isActive = active === cat;
        const color = cat === 'all' ? undefined : THREAD_CATEGORY_HEX[cat];
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
              isActive
                ? 'border-white/30 bg-white/10 text-text-primary'
                : 'border-transparent text-text-dim hover:text-text-secondary hover:bg-white/5'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
              <span className="capitalize">{cat}</span>
              <span className="text-text-dim/60 tabular-nums">{counts[cat]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Probability trajectory (stacked-area chart) ────────────────────────────

function FeaturedTrajectory({
  thread,
  points,
}: {
  thread: Thread;
  points: ThreadTrajectoryPoint[];
}) {
  // Measure the container so viewBox maps 1:1 to pixels. Without this,
  // preserveAspectRatio="none" stretches glyphs non-uniformly and text looks
  // squished/elongated.
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ W: 720, H: 280 });
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setDims({ W: Math.round(r.width), H: Math.round(r.height) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H } = dims;
  const PAD_L = 36;
  const PAD_R = 56;
  const PAD_T = 12;
  const PAD_B = 24;
  const plotW = Math.max(0, W - PAD_L - PAD_R);
  const plotH = Math.max(0, H - PAD_T - PAD_B);

  if (points.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-[11px] text-text-dim">
        No trajectory yet — this market hasn&apos;t received any evidence.
      </div>
    );
  }

  const n = points.length;
  const xAt = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (p: number) => PAD_T + (1 - p) * plotH;

  // Per-outcome vertical nudge so tied probabilities render as parallel strokes
  // rather than collapsing onto each other. 3.5px keeps tied lines legible
  // without falsifying the data meaningfully (≈1.4pp on a 0–100% axis).
  const numOutcomes = thread.outcomes.length;
  const lineOffset = (k: number) => (k - (numOutcomes - 1) / 2) * 3.5;

  // Build one polyline per outcome — the probability of that outcome over
  // time. Readers can trace which outcome surged when.
  const lines = thread.outcomes.map((_, k) => {
    const off = lineOffset(k);
    const d = points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(pt.probs[k] ?? 0) + off}`)
      .join(' ');
    return { k, d };
  });

  return (
    <div ref={containerRef} className="w-full h-72">
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none">
      {/* Plot background */}
      <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="transparent" />
      {/* Horizontal grid at 0, 25, 50, 75, 100 */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_T + (1 - f) * plotH}
            y2={PAD_T + (1 - f) * plotH}
            stroke="#fff"
            strokeWidth={0.5}
            opacity={0.05}
            strokeDasharray={f === 0 || f === 1 ? undefined : '2 4'}
          />
          <text
            x={PAD_L - 6}
            y={PAD_T + (1 - f) * plotH + 3}
            textAnchor="end"
            className="text-[9px] tabular-nums"
            fill="#555"
          >
            {Math.round(f * 100)}%
          </text>
        </g>
      ))}
      {/* Outcome lines */}
      {lines.map(({ k, d }) => (
        <path
          key={k}
          d={d}
          fill="none"
          stroke={OUTCOME_HEX[k % OUTCOME_HEX.length]}
          strokeWidth={1.75}
          opacity={0.85}
          strokeLinecap="round"
        />
      ))}
      {/* Endpoint dots — labels live in the left-side outcome list, so we only
          mark the current position here. */}
      {thread.outcomes.map((_, k) => {
        const p = points[points.length - 1].probs[k] ?? 0;
        return (
          <circle
            key={k}
            cx={xAt(points.length - 1)}
            cy={yAt(p) + lineOffset(k)}
            r={2.5}
            fill={OUTCOME_HEX[k % OUTCOME_HEX.length]}
            opacity={0.9}
          />
        );
      })}
      {/* X axis labels — first + last scene (scene-only ordinals, world
          commits don't count). */}
      <text x={PAD_L} y={H - 4} className="text-[9px]" fill="#555">
        scene {points[0].sceneOrdinal}
      </text>
      <text x={W - PAD_R} y={H - 4} textAnchor="end" className="text-[9px]" fill="#555">
        scene {points[points.length - 1].sceneOrdinal}
      </text>
    </svg>
    </div>
  );
}

// ── Featured market panel ──────────────────────────────────────────────────

function FeaturedMarket({
  thread,
  points,
  category,
}: {
  thread: Thread;
  points: ThreadTrajectoryPoint[];
  category: ThreadCategory;
}) {
  const probs = getMarketProbs(thread);
  const belief = getMarketBelief(thread);
  const { margin } = getMarketMargin(thread);
  const ranked = thread.outcomes
    .map((o, i) => ({ outcome: o, idx: i, prob: probs[i] ?? 0 }))
    .sort((a, b) => b.prob - a.prob);
  const catColor = THREAD_CATEGORY_HEX[category];

  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/2.5 backdrop-blur-xl p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-24px_rgba(0,0,0,0.7)] overflow-hidden">
      {/* Top highlight — Apple-style lit edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 text-[10px] text-text-dim uppercase tracking-wider">
              <span className="font-mono">{thread.id}</span>
              <span className="text-text-dim/40">·</span>
              <span
                className="font-medium"
                style={{ color: catColor }}
                title={THREAD_CATEGORY_DESCRIPTION[category]}
              >
                {THREAD_CATEGORY_LABEL[category]}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-text-primary leading-tight mt-1 wrap-break-word">
              {thread.description}
            </h2>
          </div>
        </div>
        <div className="flex items-baseline gap-4 text-[10px] text-text-dim shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-sm text-text-primary font-mono tabular-nums">
              {(belief?.volume ?? 0).toFixed(1)}
            </span>
            <span>volume</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-text-primary font-mono tabular-nums">
              Δ{margin.toFixed(1)}
            </span>
            <span>margin</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-text-primary font-mono tabular-nums">
              {(belief?.volatility ?? 0).toFixed(2)}
            </span>
            <span>volatility</span>
          </div>
        </div>
      </div>

      {/* Body: outcomes (left) + trajectory (right). Outcomes are vertically
          centered alongside the chart so the legend sits at the chart's visual
          midline rather than floating at the top. */}
      <div className="grid grid-cols-[minmax(220px,280px)_1fr] gap-4 items-center">
        {/* Outcome list */}
        <div className="flex flex-col gap-2 self-center">
          {ranked.map(({ outcome, idx, prob }) => (
            <div key={`${outcome}-${idx}`} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: OUTCOME_HEX[idx % OUTCOME_HEX.length] }}
              />
              <span className="text-xs text-text-primary truncate flex-1">{outcome}</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-text-primary">
                {Math.round(prob * 100)}%
              </span>
            </div>
          ))}
          {thread.closedAt && (
            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-text-dim">
              Closed at <span className="font-mono">{thread.closedAt}</span> →{' '}
              <span style={{ color: catColor }}>
                {thread.outcomes[thread.closeOutcome ?? 0]}
              </span>
              {thread.resolutionQuality !== undefined && (
                <>
                  {' '}· quality{' '}
                  <span className="font-mono tabular-nums">
                    {Math.round(thread.resolutionQuality * 100)}%
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Trajectory */}
        <div className="min-w-0">
          <FeaturedTrajectory thread={thread} points={points} />
        </div>
      </div>
    </div>
  );
}

// ── All-markets grid card ──────────────────────────────────────────────────

function MarketCard({
  row,
  inFocus,
  onSelect,
}: {
  row: PortfolioRow;
  inFocus: boolean;
  onSelect: () => void;
}) {
  const { thread, probs, topIdx, margin, volume, category } = row;
  const catColor = THREAD_CATEGORY_HEX[category];
  const dimmed = category === 'resolved' || category === 'abandoned';

  return (
    <button
      onClick={onSelect}
      className={`group text-left flex flex-col gap-2 p-3 rounded-lg border border-white/6 hover:border-white/15 hover:bg-white/3 transition-colors ${
        dimmed ? 'opacity-60' : ''
      }`}
      style={inFocus ? { borderLeft: `3px solid ${catColor}` } : undefined}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] text-text-dim">
        <span className="font-mono">{thread.id}</span>
        <div className="flex items-center gap-1.5">
          <span
            className="font-medium"
            style={{ color: catColor }}
            title={THREAD_CATEGORY_DESCRIPTION[category]}
          >
            {THREAD_CATEGORY_LABEL[category]}
          </span>
          {inFocus && (
            <>
              <span className="text-text-dim/40">·</span>
              <span style={{ color: catColor }}>focus</span>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-text-primary leading-snug line-clamp-2 wrap-break-word">
        {thread.description}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-dim truncate min-w-0 flex-1">
          <span className="text-text-secondary font-mono">{thread.outcomes[topIdx]}</span>{' '}
          <span className="font-mono tabular-nums text-text-primary">
            {Math.round((probs[topIdx] ?? 0) * 100)}%
          </span>
        </span>
        <span className="text-[9px] text-text-dim font-mono tabular-nums shrink-0">
          Δ{margin.toFixed(1)}
        </span>
        <span className="text-[9px] text-text-dim font-mono tabular-nums shrink-0">
          vol {volume.toFixed(1)}
        </span>
      </div>
      <div className="h-1 w-full flex rounded-full overflow-hidden bg-white/5">
        {probs.map((p, i) => (
          <div
            key={i}
            style={{
              width: `${p * 100}%`,
              background: OUTCOME_HEX[i % OUTCOME_HEX.length],
              opacity: i === topIdx ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </button>
  );
}

// ── Market list sidebar (in-view switcher) ─────────────────────────────────

function MarketListSidebar({
  rows,
  focusIds,
  selectedId,
  onSelect,
}: {
  rows: PortfolioRow[];
  focusIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? rows.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.thread.id.toLowerCase().includes(q) ||
          r.thread.description.toLowerCase().includes(q)
        );
      })
    : rows;
  // Partition filtered rows into focus / other — each rendered as its own
  // labelled section in the sidebar.
  const focusRows = filtered.filter((r) => focusIds.has(r.thread.id));
  const otherRows = filtered.filter((r) => !focusIds.has(r.thread.id));

  const renderRow = (row: PortfolioRow) => {
    const isSelected = selectedId === row.thread.id;
    const catColor = THREAD_CATEGORY_HEX[row.category];
    const topProb = row.probs[row.topIdx] ?? 0;
    const dimmed =
      row.category === 'resolved' || row.category === 'abandoned';
    return (
      <button
        key={row.thread.id}
        onClick={() => onSelect(row.thread.id)}
        className={`group flex items-start gap-2 py-1.5 px-2 rounded-md transition-colors text-left border-l-2 ${
          isSelected
            ? 'bg-white/8'
            : 'hover:bg-white/3 border-transparent'
        } ${dimmed ? 'opacity-55' : ''}`}
        style={
          isSelected
            ? { borderLeftColor: catColor }
            : { borderLeftColor: 'transparent' }
        }
      >
        <span
          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
          style={{ background: catColor }}
          title={THREAD_CATEGORY_DESCRIPTION[row.category]}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
            <span className="font-mono">{row.thread.id}</span>
            <span
              className="capitalize"
              style={{ color: catColor }}
              title={THREAD_CATEGORY_DESCRIPTION[row.category]}
            >
              {THREAD_CATEGORY_LABEL[row.category]}
            </span>
          </div>
          <p className="text-[11px] text-text-primary leading-snug line-clamp-2 wrap-break-word">
            {row.thread.description}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-text-dim">
            <span className="font-mono truncate">
              {row.thread.outcomes[row.topIdx]}
            </span>
            <span className="ml-auto font-mono tabular-nums text-text-primary shrink-0">
              {Math.round(topProb * 100)}%
            </span>
          </div>
        </div>
      </button>
    );
  };

  const renderSection = (
    title: string,
    sectionRows: PortfolioRow[],
    accentColor?: string,
  ) => {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
          <span
            className="text-[9px] uppercase tracking-[0.14em] font-medium"
            style={{ color: accentColor ?? 'var(--color-text-dim)' }}
          >
            {title}
          </span>
          <span className="flex-1 h-px bg-white/5" />
          <span className="text-[9px] text-text-dim font-mono tabular-nums">
            {sectionRows.length}
          </span>
        </div>
        {sectionRows.length === 0 ? (
          <p className="text-[10px] text-text-dim/70 italic px-2 pb-2">
            No markets.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sectionRows.map(renderRow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/2.5 backdrop-blur-xl h-full overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-24px_rgba(0,0,0,0.7)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
      <div className="absolute inset-0 flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-text-dim">
            Markets
          </h3>
          <span className="text-[10px] text-text-dim font-mono tabular-nums">
            {filtered.length}
            {filtered.length !== rows.length ? ` / ${rows.length}` : ''}
          </span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets…"
          className="text-[11px] bg-transparent border-b border-white/8 px-2 py-1.5 text-text-primary placeholder:text-text-dim focus:outline-none focus:border-white/20 transition-colors"
        />
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col pr-1">
          {filtered.length === 0 ? (
            <p className="text-[10px] text-text-dim italic px-2 py-3">
              No matches.
            </p>
          ) : (
            <>
              {renderSection('In focus', focusRows, '#FBBF24')}
              {renderSection('Out of focus', otherRows)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Economic dashboard tiles ───────────────────────────────────────────────

function KPITile({
  label,
  value,
  sub,
  hint,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div
      className="relative flex flex-col gap-1 p-3.5 rounded-xl border border-white/8 bg-white/2.5 backdrop-blur-xl min-w-0 overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_12px_30px_-18px_rgba(0,0,0,0.6)]"
      title={hint}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />
      <span className="text-[10px] uppercase tracking-widest text-text-dim truncate">
        {label}
      </span>
      <span
        className="text-lg font-mono tabular-nums leading-tight"
        style={{ color: accent ?? '#e8e8e8' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] text-text-dim font-mono tabular-nums truncate">
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Instrument: category distribution ──────────────────────────────────────

function CategoryBreakdown({ rows }: { rows: PortfolioRow[] }) {
  const total = rows.length || 1;
  const counts: Record<ThreadCategory, number> = {
    saturating: 0,
    contested: 0,
    volatile: 0,
    committed: 0,
    developing: 0,
    dormant: 0,
    resolved: 0,
    abandoned: 0,
  };
  for (const r of rows) counts[r.category]++;
  const order: ThreadCategory[] = [
    'saturating',
    'volatile',
    'contested',
    'committed',
    'developing',
    'dormant',
    'resolved',
    'abandoned',
  ];
  return (
    <div className="relative flex flex-col gap-3 p-4 rounded-xl border border-white/8 bg-white/2.5 backdrop-blur-xl overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_12px_30px_-18px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-text-dim">
          Category mix
        </h3>
        <span className="text-[10px] text-text-dim font-mono tabular-nums">
          {total} markets
        </span>
      </div>
      {/* Stacked bar */}
      <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-white/5">
        {order.map((cat) =>
          counts[cat] === 0 ? null : (
            <div
              key={cat}
              title={`${THREAD_CATEGORY_LABEL[cat]} · ${counts[cat]}`}
              style={{
                width: `${(counts[cat] / total) * 100}%`,
                background: THREAD_CATEGORY_HEX[cat],
              }}
            />
          ),
        )}
      </div>
      {/* Legend with counts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {order.map((cat) => (
          <div key={cat} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: THREAD_CATEGORY_HEX[cat] }}
            />
            <span className="text-text-secondary capitalize flex-1">{cat}</span>
            <span className="font-mono tabular-nums text-text-primary">
              {counts[cat]}
            </span>
            <span className="text-text-dim font-mono tabular-nums w-8 text-right">
              {Math.round((counts[cat] / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Instrument: resolution quality bands ───────────────────────────────────

function ResolutionQualityPanel({
  snapshot,
}: {
  snapshot: ReturnType<typeof computePortfolioSnapshot>;
}) {
  const bands = snapshot.resolutionQualityBands;
  const total = bands.earned + bands.adequate + bands.thin;
  const avg = snapshot.averageResolutionQuality;
  const items: Array<{ label: string; count: number; color: string; hint: string }> = [
    { label: 'Earned', count: bands.earned, color: '#34D399', hint: 'Resolution quality ≥ 0.7' },
    { label: 'Adequate', count: bands.adequate, color: '#FBBF24', hint: '0.4 ≤ quality < 0.7' },
    { label: 'Thin', count: bands.thin, color: '#FB7185', hint: 'Quality < 0.4' },
  ];
  return (
    <div className="relative flex flex-col gap-3 p-4 rounded-xl border border-white/8 bg-white/2.5 backdrop-blur-xl overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_12px_30px_-18px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-text-dim">
          Resolution quality
        </h3>
        <span className="text-[10px] text-text-dim font-mono tabular-nums">
          {avg !== null ? `avg ${Math.round(avg * 100)}%` : 'no closures'}
        </span>
      </div>
      {total === 0 ? (
        <p className="text-[11px] text-text-dim">
          No markets have closed yet. Quality is scored at payoff.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col gap-1" title={it.hint}>
              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: it.color }}
                />
                <span className="text-text-secondary flex-1">{it.label}</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {it.count}
                </span>
                <span className="text-text-dim font-mono tabular-nums w-8 text-right">
                  {Math.round((it.count / total) * 100)}%
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${(it.count / total) * 100}%`,
                    background: it.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Instrument: volatility leaders ─────────────────────────────────────────

function VolatilityLeaders({
  rows,
  onSelect,
}: {
  rows: PortfolioRow[];
  onSelect: (id: string) => void;
}) {
  const leaders = rows
    .filter((r) => r.category !== 'resolved' && r.category !== 'abandoned')
    .slice()
    .sort((a, b) => b.volatility - a.volatility)
    .slice(0, 5);
  return (
    <div className="relative flex flex-col gap-3 p-4 rounded-xl border border-white/8 bg-white/2.5 backdrop-blur-xl overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_12px_30px_-18px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-text-dim">
          Volatility leaders
        </h3>
        <span className="text-[10px] text-text-dim">top {leaders.length}</span>
      </div>
      {leaders.length === 0 ? (
        <p className="text-[11px] text-text-dim">No live markets.</p>
      ) : (
        <div className="flex flex-col">
          {leaders.map((row, i) => {
            const maxVol = leaders[0].volatility || 1;
            const pct = (row.volatility / maxVol) * 100;
            return (
              <button
                key={row.thread.id}
                onClick={() => onSelect(row.thread.id)}
                className="group flex items-center gap-2 py-1.5 border-b border-white/4 last:border-b-0 hover:bg-white/3 transition-colors text-left -mx-1 px-1"
              >
                <span className="text-[10px] text-text-dim font-mono tabular-nums w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[11px] text-text-primary truncate">
                    {row.thread.description}
                  </span>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: THREAD_CATEGORY_HEX[row.category],
                      }}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-text-primary shrink-0">
                  σ{row.volatility.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Instrument: entropy distribution (how contested is the portfolio) ──────

function EntropyHistogram({ rows }: { rows: PortfolioRow[] }) {
  const live = rows.filter(
    (r) => r.category !== 'resolved' && r.category !== 'abandoned',
  );
  const bins = [0, 0, 0, 0, 0]; // 0–20 / 20–40 / 40–60 / 60–80 / 80–100
  for (const r of live) {
    const b = Math.min(4, Math.floor(r.entropy * 5));
    bins[b]++;
  }
  const maxBin = Math.max(1, ...bins);
  const labels = ['0–20', '20–40', '40–60', '60–80', '80–100'];
  return (
    <div className="relative flex flex-col gap-3 p-4 rounded-xl border border-white/8 bg-white/2.5 backdrop-blur-xl overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_12px_30px_-18px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-text-dim">
          Uncertainty distribution
        </h3>
        <span className="text-[10px] text-text-dim font-mono tabular-nums">
          {live.length} live
        </span>
      </div>
      {live.length === 0 ? (
        <p className="text-[11px] text-text-dim">No live markets.</p>
      ) : (
        <div className="flex items-end gap-1.5 h-20">
          {bins.map((count, i) => {
            const h = (count / maxBin) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
                title={`${labels[i]}% entropy · ${count} markets`}
              >
                <span className="text-[9px] text-text-dim font-mono tabular-nums">
                  {count}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${Math.max(h, 2)}%`,
                      background: '#38BDF8',
                      opacity: 0.4 + 0.12 * i,
                    }}
                  />
                </div>
                <span className="text-[9px] text-text-dim font-mono tabular-nums">
                  {labels[i]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Portfolio headline (stats across top) ──────────────────────────────────

function PortfolioHeadline({
  snapshot,
  focusCount,
  focusK,
}: {
  snapshot: ReturnType<typeof computePortfolioSnapshot>;
  focusCount: number;
  focusK: number;
}) {
  const uncertaintyPct = Math.round(snapshot.averageEntropy * 100);
  const item = (value: string, label: string, hint?: string) => (
    <div className="flex flex-col" title={hint}>
      <span className="text-base text-text-primary font-mono tabular-nums">{value}</span>
      <span className="text-[10px] text-text-dim">{label}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-6 flex-wrap">
      {item(String(snapshot.totalThreads), 'markets')}
      <span className="text-text-dim/30">|</span>
      {item(String(snapshot.activeThreads), 'open')}
      <span className="text-text-dim/30">|</span>
      {item(`${focusCount}/${focusK}`, 'in focus')}
      <span className="text-text-dim/30">|</span>
      {item(
        `${uncertaintyPct}%`,
        'uncertain',
        'Average entropy across open markets — higher = more contested.',
      )}
      <span className="text-text-dim/30">|</span>
      {item(snapshot.marketCap.toFixed(0), 'attention', 'Total volume across open markets.')}
      {snapshot.closedThreads > 0 && (
        <>
          <span className="text-text-dim/30">|</span>
          {item(String(snapshot.closedThreads), 'resolved')}
        </>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function MarketView() {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;
  const resolvedKeys = state.resolvedEntryKeys;
  const currentIndex = state.viewState.currentSceneIndex;

  // Point-in-time replay — the whole dashboard moves with the scrubber.
  // We include every thread in the narrative (introduced or not) so the list
  // mirrors what the graph view shows. Threads that haven't opened yet appear
  // at uniform prior with no volume — they'll land in "Out of focus".
  const scrubbedNarrative: NarrativeState | null = useMemo(() => {
    if (!narrative) return null;
    const threadsAtIndex = replayThreadsAtIndex(narrative, resolvedKeys, currentIndex);
    return { ...narrative, threads: threadsAtIndex };
  }, [narrative, resolvedKeys, currentIndex]);

  const rows = useMemo(() => {
    if (!scrubbedNarrative) return [];
    return buildPortfolioRows(scrubbedNarrative, resolvedKeys, currentIndex);
  }, [scrubbedNarrative, resolvedKeys, currentIndex]);

  const snapshot = useMemo(() => {
    if (!scrubbedNarrative) return null;
    return computePortfolioSnapshot(scrubbedNarrative);
  }, [scrubbedNarrative]);

  const focusIds = useMemo(() => {
    if (!scrubbedNarrative) return new Set<string>();
    return currentFocusIds(scrubbedNarrative, resolvedKeys, currentIndex);
  }, [scrubbedNarrative, resolvedKeys, currentIndex]);

  // Featured thread — local to this view. A right-side list inside this tab
  // lets the user switch between markets without leaving the dashboard.
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const featuredId =
    selectedThreadId && scrubbedNarrative?.threads[selectedThreadId]
      ? selectedThreadId
      : rows.find((r) => focusIds.has(r.thread.id))?.thread.id ??
        rows.find((r) => r.category !== 'resolved' && r.category !== 'abandoned')?.thread.id ??
        rows[0]?.thread.id ??
        null;

  const featuredThread = featuredId ? scrubbedNarrative?.threads[featuredId] : null;
  const featuredRow = rows.find((r) => r.thread.id === featuredId);
  const featuredTrajectory = useMemo(() => {
    if (!narrative || !featuredId) return [] as ThreadTrajectoryPoint[];
    return buildThreadTrajectory(narrative, featuredId, resolvedKeys.slice(0, currentIndex + 1));
  }, [narrative, featuredId, resolvedKeys, currentIndex]);

  // Category filter state — applied to the All Markets grid only.
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');
  const filterCounts: Record<CategoryFilter, number> = {
    all: rows.length,
    saturating: 0,
    contested: 0,
    volatile: 0,
    committed: 0,
    developing: 0,
    dormant: 0,
    resolved: 0,
    abandoned: 0,
  };
  for (const r of rows) filterCounts[r.category]++;

  const filteredRows = useMemo(() => {
    if (catFilter === 'all') return rows;
    return rows.filter((r) => r.category === catFilter);
  }, [rows, catFilter]);

  if (!narrative) {
    return (
      <div className="h-full w-full flex items-center justify-center text-[11px] text-text-dim">
        Select a narrative to view markets.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-[11px] text-text-dim">
        No markets open yet — threads appear once scenes begin producing evidence.
      </div>
    );
  }

  const selectThread = (id: string) => {
    setSelectedThreadId(id);
    dispatch({ type: 'SELECT_THREAD_LOG', threadId: id });
    dispatch({ type: 'SET_INSPECTOR', context: { type: 'thread', threadId: id } });
  };

  // Economic indicators derived from rows + snapshot.
  const liveRows = rows.filter(
    (r) => r.category !== 'resolved' && r.category !== 'abandoned',
  );
  const avgVolatility =
    liveRows.length > 0
      ? liveRows.reduce((s, r) => s + r.volatility, 0) / liveRows.length
      : 0;
  const saturationRate =
    liveRows.length > 0
      ? liveRows.filter((r) => r.category === 'saturating').length / liveRows.length
      : 0;
  const contestedRate =
    liveRows.length > 0
      ? liveRows.filter((r) => r.category === 'contested').length / liveRows.length
      : 0;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-5 flex flex-col gap-5">
        {/* Portfolio headline */}
        {snapshot && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <PortfolioHeadline snapshot={snapshot} focusCount={focusIds.size} focusK={6} />
            <span className="text-[10px] text-text-dim">
              Passive observer · scene{' '}
              {Math.max(1, sceneOrdinalAt(narrative, resolvedKeys, currentIndex))} of{' '}
              {countScenes(narrative, resolvedKeys)}
            </span>
          </div>
        )}

        {/* Featured market + in-view market list (right side) */}
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 items-stretch">
          {featuredThread && featuredRow ? (
            <FeaturedMarket
              thread={featuredThread}
              points={featuredTrajectory}
              category={featuredRow.category}
            />
          ) : (
            <div className="rounded-xl border border-white/8 p-6 text-[11px] text-text-dim">
              Select a market to feature.
            </div>
          )}
          <MarketListSidebar
            rows={rows}
            focusIds={focusIds}
            selectedId={featuredId}
            onSelect={selectThread}
          />
        </div>

        {/* Economic indicators — KPI tiles */}
        {snapshot && (
          <div className="flex flex-col gap-2">
            <h2 className="text-[11px] uppercase tracking-widest text-text-dim">
              Economic indicators
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              <KPITile
                label="Attention"
                value={snapshot.marketCap.toFixed(0)}
                sub="cumulative volume"
                hint="Total volume across open markets — the market cap of narrative attention."
              />
              <KPITile
                label="Uncertainty"
                value={`${Math.round(snapshot.averageEntropy * 100)}%`}
                sub="avg entropy"
                hint="Average normalized entropy across open markets. 100% = maximally contested."
              />
              <KPITile
                label="Volatility"
                value={`σ ${avgVolatility.toFixed(2)}`}
                sub={`${liveRows.length} live`}
                hint="EWMA of recent evidence magnitude, averaged across live markets."
              />
              <KPITile
                label="Saturation"
                value={`${Math.round(saturationRate * 100)}%`}
                sub={`${snapshot.nearClosedThreads} near-closed`}
                hint="Share of live markets within the near-closure band."
                accent={saturationRate > 0 ? THREAD_CATEGORY_HEX.saturating : undefined}
              />
              <KPITile
                label="Contested"
                value={`${Math.round(contestedRate * 100)}%`}
                sub="share of live"
                hint="Share of live markets in the contested (high-entropy) category."
                accent={contestedRate > 0 ? THREAD_CATEGORY_HEX.contested : undefined}
              />
              <KPITile
                label="Resolved"
                value={String(snapshot.closedThreads)}
                sub={
                  snapshot.averageResolutionQuality !== null
                    ? `avg ${Math.round(snapshot.averageResolutionQuality * 100)}%`
                    : 'none yet'
                }
                hint="Number of markets that have closed to a winning outcome."
                accent={
                  snapshot.closedThreads > 0 ? THREAD_CATEGORY_HEX.resolved : undefined
                }
              />
            </div>
          </div>
        )}

        {/* Probabilistic instruments */}
        {snapshot && rows.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-[11px] uppercase tracking-widest text-text-dim">
              Instruments
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CategoryBreakdown rows={rows} />
              <ResolutionQualityPanel snapshot={snapshot} />
              <EntropyHistogram rows={rows} />
              <VolatilityLeaders rows={rows} onSelect={selectThread} />
            </div>
          </div>
        )}

        {/* All markets — partitioned into Focus / Out of focus */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-semibold text-text-primary">All markets</h2>
            <span className="text-[10px] text-text-dim">
              {filteredRows.length} shown
            </span>
          </div>
          <CategoryFilterBar active={catFilter} onChange={setCatFilter} counts={filterCounts} />
          {(() => {
            const focusGrid = filteredRows.filter((r) => focusIds.has(r.thread.id));
            const otherGrid = filteredRows.filter((r) => !focusIds.has(r.thread.id));
            const section = (
              title: string,
              list: PortfolioRow[],
              accent?: string,
            ) => {
              if (list.length === 0) return null;
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-[11px] uppercase tracking-widest font-medium"
                      style={{ color: accent ?? 'var(--color-text-dim)' }}
                    >
                      {title}
                    </h3>
                    <span className="text-[10px] text-text-dim font-mono tabular-nums">
                      {list.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {list.map((row) => (
                      <MarketCard
                        key={row.thread.id}
                        row={row}
                        inFocus={focusIds.has(row.thread.id)}
                        onSelect={() => selectThread(row.thread.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            };
            return (
              <>
                {section('In focus', focusGrid, '#FBBF24')}
                {section('Out of focus', otherGrid)}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
