'use client';

import { useMemo } from 'react';
import type { NarrativeState, Scene } from '@/types/narrative';
import { resolveEntry } from '@/types/narrative';

// ── Colors ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  dormant:    '#475569',
  active:     '#38BDF8',
  escalating: '#FBBF24',
  critical:   '#F87171',
  resolved:   '#34D399',
  subverted:  '#C084FC',
  abandoned:  '#64748B',
};

// ── Types ───────────────────────────────────────────────────────────────────

type Transition = { sceneIdx: number; from: string; to: string };
type Segment = { start: number; end: number; status: string };

type ThreadRow = {
  threadId: string;
  description: string;
  endStatus: string;
  transitions: Transition[];
  pulseScenes: number[];
  segments: Segment[];
  firstScene: number;
  lastScene: number;
};

// ── Component ───────────────────────────────────────────────────────────────

export function ThreadLifecycleModal({
  narrative,
  resolvedKeys,
  onClose,
}: {
  narrative: NarrativeState;
  resolvedKeys: string[];
  onClose: () => void;
}) {
  const rows = useMemo(() => {
    const scenes: Scene[] = resolvedKeys
      .map((k) => resolveEntry(narrative, k))
      .filter((e): e is Scene => !!e && e.kind === 'scene');

    // Collect mutations per thread
    const threadMutations = new Map<string, { sceneIdx: number; from: string; to: string }[]>();

    for (let i = 0; i < scenes.length; i++) {
      for (const tm of scenes[i].threadMutations) {
        if (!threadMutations.has(tm.threadId)) {
          threadMutations.set(tm.threadId, []);
        }
        threadMutations.get(tm.threadId)!.push({ sceneIdx: i, from: tm.from.toLowerCase(), to: tm.to.toLowerCase() });
      }
    }

    const result: ThreadRow[] = [];

    for (const [threadId, mutations] of threadMutations) {
      if (mutations.length === 0) continue;
      const thread = narrative.threads[threadId];
      if (!thread) continue;

      const transitions: Transition[] = [];
      const pulseScenes: number[] = [];

      for (const m of mutations) {
        if (m.from === m.to) {
          pulseScenes.push(m.sceneIdx);
        } else {
          transitions.push({ sceneIdx: m.sceneIdx, from: m.from, to: m.to });
        }
      }

      // Build status timeline: start with the initial status (from the first mutation's "from")
      const initialStatus = mutations[0].from;
      const firstScene = mutations[0].sceneIdx;
      const lastScene = mutations[mutations.length - 1].sceneIdx;

      // Build statuses array including the initial state
      const statuses: { sceneIdx: number; status: string }[] = [{ sceneIdx: firstScene, status: initialStatus }];
      for (const m of mutations) {
        if (m.from !== m.to) {
          statuses.push({ sceneIdx: m.sceneIdx, status: m.to });
        }
      }

      // Build segments from status timeline
      const segments: Segment[] = [];
      let currentStatus = '';
      let segStart = 0;

      for (const s of statuses) {
        if (s.status !== currentStatus) {
          if (currentStatus) {
            segments.push({ start: segStart, end: s.sceneIdx - 1, status: currentStatus });
          }
          currentStatus = s.status;
          segStart = s.sceneIdx;
        }
      }
      if (currentStatus) {
        segments.push({ start: segStart, end: lastScene, status: currentStatus });
      }

      const endStatus = statuses[statuses.length - 1].status;

      result.push({
        threadId,
        description: thread.description,
        endStatus,
        transitions,
        pulseScenes,
        segments,
        firstScene,
        lastScene,
      });
    }

    return result.sort((a, b) => (b.transitions.length + b.pulseScenes.length) - (a.transitions.length + a.pulseScenes.length));
  }, [narrative, resolvedKeys]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-base border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/6">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Thread Lifecycle</h2>
            <p className="text-[11px] text-text-dim mt-0.5">
              {rows.length} threads — sorted by transition count
            </p>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary text-lg leading-none">×</button>
        </div>

        {/* Thread rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {rows.length === 0 ? (
            <p className="text-text-dim text-xs text-center py-8">No thread mutations found.</p>
          ) : (
            <div className="space-y-1">
              {rows.map(({ threadId, description, endStatus, transitions, pulseScenes, segments, firstScene, lastScene }) => {
                const range = Math.max(lastScene - firstScene, 1);
                const toPercent = (sceneIdx: number) => ((sceneIdx - firstScene) / range) * 100;

                return (
                  <div key={threadId} className="py-1.5">
                    {/* Row: description left, status right */}
                    <div className="flex items-baseline justify-between mb-1 gap-4">
                      <p className="text-[11px] text-text-secondary leading-snug flex-1 truncate" title={description}>
                        {description}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="text-[10px] font-mono capitalize font-semibold"
                          style={{ color: STATUS_COLORS[endStatus] ?? '#475569' }}
                        >
                          {endStatus}
                        </span>
                        <span className="text-[9px] text-text-dim font-mono">
                          ({transitions.length})
                        </span>
                        <span className="text-[9px] text-text-dim font-mono ml-1">
                          {firstScene + 1}–{lastScene + 1}
                        </span>
                      </div>
                    </div>

                    {/* Timeline bar */}
                    <div className="h-4 rounded-sm bg-white/3 relative overflow-hidden">
                      {/* Status segments */}
                      {segments.map((seg, i) => {
                        const left = toPercent(seg.start);
                        const width = toPercent(seg.end + 1) - left;
                        return (
                          <div
                            key={`seg-${i}`}
                            className="absolute top-0 h-full"
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(width, 0.4)}%`,
                              backgroundColor: STATUS_COLORS[seg.status] ?? '#475569',
                              opacity: 0.4,
                            }}
                            title={`${seg.status} (scenes ${seg.start + 1}–${seg.end + 1})`}
                          />
                        );
                      })}

                      {/* Pulse ticks */}
                      {pulseScenes.map((sceneIdx, i) => {
                        if (sceneIdx < firstScene || sceneIdx > lastScene) return null;
                        return (
                          <div
                            key={`pulse-${i}`}
                            className="absolute top-px pointer-events-none"
                            style={{
                              left: `${toPercent(sceneIdx)}%`,
                              width: '1px',
                              height: 'calc(100% - 2px)',
                              backgroundColor: '#fff',
                              opacity: 0.12,
                            }}
                          />
                        );
                      })}

                      {/* Transition markers */}
                      {transitions.map((t, i) => {
                        const leftPct = toPercent(t.sceneIdx);
                        const color = STATUS_COLORS[t.to] ?? '#FFF';
                        return (
                          <div
                            key={`trans-${i}`}
                            className="absolute pointer-events-none"
                            style={{
                              left: `${leftPct}%`,
                              top: 0,
                              width: '2px',
                              height: '100%',
                              backgroundColor: color,
                              opacity: 0.85,
                              transform: 'translateX(-1px)',
                            }}
                            title={`${t.from} → ${t.to} (scene ${t.sceneIdx + 1})`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 border-t border-white/6 flex-wrap">
          {Object.entries(STATUS_COLORS).filter(([s]) => s !== 'abandoned').map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-[10px] text-text-dim">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.45 }} />
              <span className="capitalize">{status}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] text-text-dim ml-1">
            <span className="w-0.5 h-3 bg-white/50 rounded" />
            Transition
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-text-dim">
            <span className="w-px h-3 bg-white/15" />
            Pulse
          </span>
        </div>
      </div>
    </div>
  );
}
