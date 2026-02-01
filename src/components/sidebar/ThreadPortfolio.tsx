'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { computeThreadStatuses } from '@/lib/narrative-utils';
import type { Thread, ThreadStatus } from '@/types/narrative';

const STATUS_ORDER: ThreadStatus[] = [
  'escalating',
  'threatened',
  'surfacing',
  'dormant',
  'done',
  'subverted',
];

export default function ThreadPortfolio() {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;

  const currentStatuses = useMemo(() => {
    if (!narrative) return {};
    return computeThreadStatuses(narrative, state.currentSceneIndex);
  }, [narrative, state.currentSceneIndex]);

  const grouped = useMemo(() => {
    if (!narrative) return new Map<ThreadStatus, (Thread & { currentStatus: ThreadStatus })[]>();

    const threads = Object.values(narrative.threads).map((t) => ({
      ...t,
      currentStatus: currentStatuses[t.id] ?? t.status,
    }));
    const map = new Map<ThreadStatus, (Thread & { currentStatus: ThreadStatus })[]>();

    const knownStatuses = new Set<string>(STATUS_ORDER);

    for (const status of STATUS_ORDER) {
      const matching = threads.filter((t) => t.currentStatus === status);
      if (matching.length > 0) {
        map.set(status, matching);
      }
    }

    // Collect threads with statuses not in the predefined order
    const unknown = threads.filter((t) => !knownStatuses.has(t.currentStatus));
    if (unknown.length > 0) {
      const unknownGroups = new Map<ThreadStatus, (Thread & { currentStatus: ThreadStatus })[]>();
      for (const t of unknown) {
        const list = unknownGroups.get(t.currentStatus) ?? [];
        list.push(t);
        unknownGroups.set(t.currentStatus, list);
      }
      for (const [status, list] of unknownGroups) {
        map.set(status, list);
      }
    }

    return map;
  }, [narrative, currentStatuses]);

  if (!narrative) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-text-dim text-center">
          Select a narrative to view threads
        </p>
      </div>
    );
  }

  if (grouped.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-text-dim text-center">No threads yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      {Array.from(grouped.entries()).map(([status, threads]) => (
        <div key={status} className="mb-3">
          <h4 className="text-[10px] font-semibold text-text-dim uppercase tracking-widest px-1 mb-1">
            {status}
          </h4>
          <div className="flex flex-col gap-0.5">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() =>
                  dispatch({
                    type: 'SET_INSPECTOR',
                    context: { type: 'thread', threadId: thread.id },
                  })
                }
                className="text-left rounded px-1.5 py-1 hover:bg-bg-elevated transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] bg-white/[0.06] text-text-secondary px-1.5 py-0.5 rounded shrink-0">
                    {thread.id}
                  </span>
                  <span className="text-xs text-text-primary truncate">
                    {thread.description}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-text-secondary self-start">
                  {thread.currentStatus}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
