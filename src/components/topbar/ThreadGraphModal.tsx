'use client';

import { useMemo, useState } from 'react';
import type { NarrativeState, Scene } from '@/types/narrative';
import { THREAD_TERMINAL_STATUSES, resolveEntry } from '@/types/narrative';
import { computeThreadStatuses } from '@/lib/narrative-utils';
import { Modal, ModalHeader } from '@/components/Modal';

// ── Colors ──────────────────────────────────────────────────────────────────

const STATUS_FILLS: Record<string, string> = {
  latent:     '#475569',
  seeded:     '#FBBF24',
  active:     '#38BDF8',
  escalating: '#FB923C',  // point of no return — fate committed
  critical:   '#F87171',
  resolved:   '#34D399',
  subverted:  '#C084FC',
  abandoned:  '#444444',
};

const CATEGORY_COLORS: Record<string, string> = {
  committed: '#F87171',   // red — fate committed, must resolve
  potential: '#38BDF8',   // blue — active but can still abandon
  latent:    '#475569',   // gray — detected but not yet seeded
  complete:  '#34D399',   // green — resolved or subverted
  abandoned: '#64748B',   // dim gray — abandoned threads
};

const TERMINAL = new Set<string>(THREAD_TERMINAL_STATUSES);

// ── Category classification ─────────────────────────────────────────────────

type FateCategory = 'committed' | 'potential' | 'latent' | 'complete' | 'abandoned';

function categorizeThread(status: string): FateCategory {
  if (status === 'escalating' || status === 'critical') return 'committed';
  if (status === 'active' || status === 'seeded') return 'potential';
  if (status === 'latent') return 'latent';
  if (status === 'resolved' || status === 'subverted') return 'complete';
  if (status === 'abandoned') return 'abandoned';
  return 'latent';
}

const CATEGORY_ORDER: FateCategory[] = ['committed', 'potential', 'latent', 'complete', 'abandoned'];

const CATEGORY_LABELS: Record<FateCategory, { title: string; description: string }> = {
  committed: { title: 'Committed', description: 'Point of no return — must resolve' },
  potential: { title: 'Potential', description: 'Active threads that can still be abandoned' },
  latent: { title: 'Latent', description: 'Detected but not yet seeded' },
  complete: { title: 'Complete', description: 'Resolved or subverted threads' },
  abandoned: { title: 'Abandoned', description: 'Dropped threads — excluded from LLM context' },
};

// ── Timeline data ───────────────────────────────────────────────────────────

type ThreadRow = {
  threadId: string;
  description: string;
  category: FateCategory;
  firstScene: number;
  lastScene: number;
  endStatus: string;
  segments: { start: number; end: number; status: string }[];
  transitions: { sceneIdx: number; from: string; to: string }[];
  pulseScenes: number[];
};

function buildTimelineData(
  narrative: NarrativeState,
  resolvedKeys: string[],
  statuses: Record<string, string>,
): { rows: ThreadRow[]; categorizedRows: Record<FateCategory, ThreadRow[]>; totalScenes: number } {
  const scenes: Scene[] = resolvedKeys
    .map((k) => resolveEntry(narrative, k))
    .filter((e): e is Scene => !!e && e.kind === 'scene');

  const totalScenes = scenes.length;

  // Collect mutations per thread
  const threadMuts = new Map<string, { sceneIdx: number; from: string; to: string }[]>();
  for (let i = 0; i < scenes.length; i++) {
    for (const tm of scenes[i].threadMutations) {
      if (!threadMuts.has(tm.threadId)) threadMuts.set(tm.threadId, []);
      threadMuts.get(tm.threadId)!.push({ sceneIdx: i, from: tm.from.toLowerCase(), to: tm.to.toLowerCase() });
    }
  }

  // Build scene key to index map for looking up openedAt
  const sceneKeyToIdx = new Map<string, number>();
  for (let i = 0; i < resolvedKeys.length; i++) {
    sceneKeyToIdx.set(resolvedKeys[i], i);
  }

  // Build rows
  const rows: ThreadRow[] = [];
  for (const thread of Object.values(narrative.threads)) {
    const muts = threadMuts.get(thread.id) ?? [];
    const firstMutationIdx = muts.length > 0 ? muts[0].sceneIdx : 0;
    const lastScene = muts.length > 0 ? muts[muts.length - 1].sceneIdx : totalScenes - 1;
    const status = statuses[thread.id] ?? thread.status;
    const category = categorizeThread(status);

    // Find where fate was first detected (openedAt) — shows latent period
    const openedAtIdx = sceneKeyToIdx.get(thread.openedAt) ?? firstMutationIdx;
    const firstScene = Math.min(openedAtIdx, firstMutationIdx);

    const transitions: ThreadRow['transitions'] = [];
    const pulseScenes: number[] = [];
    for (const m of muts) {
      if (m.from === m.to) pulseScenes.push(m.sceneIdx);
      else transitions.push(m);
    }

    // Build status segments — include latent period from openedAt
    const segments: ThreadRow['segments'] = [];
    if (muts.length > 0) {
      const initialStatus = firstScene < firstMutationIdx ? thread.status : muts[0].from;
      let curStatus = initialStatus;
      let segStart = firstScene;

      // Add latent segment if openedAt is before first mutation
      if (firstScene < firstMutationIdx) {
        segments.push({ start: firstScene, end: firstMutationIdx, status: curStatus });
        curStatus = muts[0].from;
        segStart = firstMutationIdx;
      }

      for (const m of muts) {
        if (m.from !== m.to) {
          segments.push({ start: segStart, end: m.sceneIdx, status: curStatus });
          curStatus = m.to;
          segStart = m.sceneIdx;
        }
      }
      segments.push({ start: segStart, end: lastScene, status: curStatus });
    } else {
      segments.push({ start: firstScene, end: totalScenes - 1, status });
    }

    rows.push({
      threadId: thread.id,
      description: thread.description,
      category,
      firstScene,
      lastScene,
      endStatus: status,
      segments,
      transitions,
      pulseScenes,
    });
  }

  // Sort within categories by first scene
  rows.sort((a, b) => a.firstScene - b.firstScene);

  // Group by category
  const categorizedRows: Record<FateCategory, ThreadRow[]> = {
    committed: [],
    potential: [],
    latent: [],
    complete: [],
    abandoned: [],
  };
  for (const row of rows) {
    categorizedRows[row.category].push(row);
  }

  return { rows, categorizedRows, totalScenes };
}

// ── Component ───────────────────────────────────────────────────────────────

const ROW_H = 28;
const LABEL_W = 220;
const CATEGORY_HEADER_H = 32;
const CATEGORY_GAP = 16;

export function ThreadGraphModal({
  narrative,
  resolvedKeys,
  currentSceneIndex,
  onClose,
  onSelectThread,
}: {
  narrative: NarrativeState;
  resolvedKeys: string[];
  currentSceneIndex: number;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
}) {
  const statuses = useMemo(
    () => computeThreadStatuses(narrative, currentSceneIndex),
    [narrative, currentSceneIndex],
  );

  const { categorizedRows, totalScenes } = useMemo(
    () => buildTimelineData(narrative, resolvedKeys, statuses),
    [narrative, resolvedKeys, statuses],
  );

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<FateCategory>>(new Set());

  const toggleCategory = (cat: FateCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Compute total counts
  const totalThreads = Object.values(categorizedRows).flat().length;

  const TIMELINE_W = 700;
  const SVG_W = LABEL_W + TIMELINE_W + 20;

  const sceneToX = (sceneIdx: number) => LABEL_W + (sceneIdx / Math.max(totalScenes - 1, 1)) * TIMELINE_W;

  // Calculate total height based on visible categories
  const visibleCategories = CATEGORY_ORDER.filter((cat) => categorizedRows[cat].length > 0);
  let totalH = 0;
  for (const cat of visibleCategories) {
    totalH += CATEGORY_HEADER_H;
    if (!collapsedCategories.has(cat)) {
      totalH += categorizedRows[cat].length * ROW_H;
    }
    totalH += CATEGORY_GAP;
  }
  const SVG_H = Math.max(totalH, 100);

  // Build y positions for each row
  const rowYPositions = useMemo(() => {
    const positions = new Map<string, number>();
    let y = 0;
    for (const cat of visibleCategories) {
      y += CATEGORY_HEADER_H;
      if (!collapsedCategories.has(cat)) {
        for (const row of categorizedRows[cat]) {
          positions.set(row.threadId, y);
          y += ROW_H;
        }
      }
      y += CATEGORY_GAP;
    }
    return positions;
  }, [categorizedRows, collapsedCategories, visibleCategories]);

  return (
    <Modal onClose={onClose} size="6xl" maxHeight="90vh">
      <ModalHeader onClose={onClose}>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Thread Lifecycles</h2>
          <p className="text-[11px] text-text-dim mt-0.5">
            {totalThreads} threads · {totalScenes} scenes
          </p>
        </div>
      </ModalHeader>

      {/* Timeline */}
      <div className="flex-1 overflow-auto px-4 py-3 min-h-0">
        <svg width={SVG_W} height={SVG_H} className="select-none">
          {/* Scene axis ticks */}
          {Array.from({ length: Math.min(totalScenes, 20) }, (_, i) => {
            const sceneIdx = Math.round((i / Math.min(totalScenes - 1, 19)) * (totalScenes - 1));
            const x = sceneToX(sceneIdx);
            return (
              <g key={`tick-${i}`}>
                <line x1={x} y1={0} x2={x} y2={SVG_H} stroke="#fff" strokeWidth={0.5} opacity={0.04} />
                <text x={x} y={SVG_H - 2} textAnchor="middle" className="text-[8px]" fill="#555">{sceneIdx + 1}</text>
              </g>
            );
          })}

          {/* Categories and rows */}
          {(() => {
            let y = 0;
            return visibleCategories.map((cat) => {
              const catY = y;
              const rows = categorizedRows[cat];
              const isCollapsed = collapsedCategories.has(cat);
              const catInfo = CATEGORY_LABELS[cat];
              const catColor = CATEGORY_COLORS[cat];

              const categoryContent = (
                <g key={cat}>
                  {/* Category header */}
                  <g
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    <rect
                      x={0}
                      y={catY}
                      width={SVG_W}
                      height={CATEGORY_HEADER_H}
                      fill={catColor}
                      opacity={0.08}
                      rx={4}
                    />
                    <text
                      x={12}
                      y={catY + CATEGORY_HEADER_H / 2 + 1}
                      dominantBaseline="middle"
                      className="text-[11px] font-semibold"
                      fill={catColor}
                    >
                      {isCollapsed ? '▸' : '▾'} {catInfo.title}
                      <tspan className="font-normal text-[10px]" fill="#666"> ({rows.length})</tspan>
                    </text>
                    <text
                      x={SVG_W - 12}
                      y={catY + CATEGORY_HEADER_H / 2 + 1}
                      dominantBaseline="middle"
                      textAnchor="end"
                      className="text-[9px]"
                      fill="#555"
                    >
                      {catInfo.description}
                    </text>
                  </g>

                  {/* Thread rows */}
                  {!isCollapsed && rows.map((row) => {
                    const rowY = rowYPositions.get(row.threadId) ?? 0;
                    const isHovered = hoveredRow === row.threadId;
                    const isTerminal = TERMINAL.has(row.endStatus);
                    const isAbandoned = cat === 'abandoned';
                    const barH = 10;
                    const barY = rowY + (ROW_H - barH) / 2;

                    return (
                      <g
                        key={row.threadId}
                        className="cursor-pointer"
                        onClick={() => { onSelectThread(row.threadId); onClose(); }}
                        onMouseEnter={() => setHoveredRow(row.threadId)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        {/* Hover background */}
                        {isHovered && (
                          <rect x={0} y={rowY} width={SVG_W} height={ROW_H} fill="#fff" opacity={0.03} rx={3} />
                        )}

                        {/* Thread label */}
                        <text
                          x={12}
                          y={rowY + ROW_H / 2 + 1}
                          dominantBaseline="middle"
                          className="text-[10px] select-none"
                          fill={isHovered ? '#ddd' : '#888'}
                          opacity={isAbandoned ? 0.5 : (isTerminal && !isHovered ? 0.6 : 1)}
                        >
                          <tspan className="font-mono" fill="#666">{row.threadId} </tspan>
                          {row.description.length > 28 ? row.description.slice(0, 26) + '…' : row.description}
                        </text>

                        {/* Status bar background */}
                        <rect
                          x={sceneToX(row.firstScene)}
                          y={barY}
                          width={Math.max(sceneToX(row.lastScene) - sceneToX(row.firstScene), 2)}
                          height={barH}
                          rx={2}
                          fill="#fff"
                          opacity={0.03}
                        />

                        {/* Status segments */}
                        {row.segments.map((seg, i) => {
                          const x1 = sceneToX(seg.start);
                          const x2 = sceneToX(Math.min(seg.end + 1, totalScenes - 1));
                          return (
                            <rect
                              key={`seg-${i}`}
                              x={x1}
                              y={barY}
                              width={Math.max(x2 - x1, 2)}
                              height={barH}
                              rx={2}
                              fill={STATUS_FILLS[seg.status] ?? '#475569'}
                              opacity={isAbandoned ? 0.2 : (isTerminal ? 0.3 : 0.5)}
                            />
                          );
                        })}

                        {/* Transition markers */}
                        {row.transitions.map((t, i) => (
                          <rect
                            key={`tr-${i}`}
                            x={sceneToX(t.sceneIdx) - 1}
                            y={barY - 1}
                            width={2}
                            height={barH + 2}
                            rx={1}
                            fill={STATUS_FILLS[t.to] ?? '#fff'}
                            opacity={isAbandoned ? 0.4 : 0.9}
                          />
                        ))}

                        {/* Pulse ticks */}
                        {row.pulseScenes.map((s, i) => (
                          <line
                            key={`p-${i}`}
                            x1={sceneToX(s)} y1={barY + 2}
                            x2={sceneToX(s)} y2={barY + barH - 2}
                            stroke="#fff" strokeWidth={0.5} opacity={isAbandoned ? 0.08 : 0.15}
                          />
                        ))}

                        {/* End status dot */}
                        <circle
                          cx={sceneToX(row.lastScene) + 8}
                          cy={rowY + ROW_H / 2}
                          r={3}
                          fill={STATUS_FILLS[row.endStatus] ?? '#475569'}
                          opacity={isAbandoned ? 0.3 : (isTerminal ? 0.4 : 0.8)}
                        />
                      </g>
                    );
                  })}
                </g>
              );

              // Update y for next category
              y += CATEGORY_HEADER_H;
              if (!isCollapsed) {
                y += rows.length * ROW_H;
              }
              y += CATEGORY_GAP;

              return categoryContent;
            });
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-3 border-t border-white/6 flex-wrap shrink-0">
        {Object.entries(STATUS_FILLS).filter(([s]) => s !== 'abandoned').map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-[10px] text-text-dim">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{status}</span>
          </span>
        ))}
      </div>
    </Modal>
  );
}
