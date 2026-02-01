'use client';

import { useMemo, useState } from 'react';
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

function ThreadItem({
  thread,
  statusLabel,
  dimmed,
  onClick,
}: {
  thread: Thread;
  statusLabel: string;
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded px-1.5 py-1 hover:bg-bg-elevated transition-colors flex flex-col gap-0.5${dimmed ? ' opacity-50' : ''}`}
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
        {statusLabel}
      </span>
    </button>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-1 py-1 hover:bg-bg-elevated rounded transition-colors"
      >
        <span className="text-[10px] text-text-dim transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        <span className="text-[10px] font-semibold text-text-dim uppercase tracking-widest">
          {title}
        </span>
        <span className="text-[10px] text-text-dim ml-auto tabular-nums">
          {count}
        </span>
      </button>
      {open && <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

export default function ThreadPortfolio() {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;

  const currentStatuses = useMemo(() => {
    if (!narrative) return {};
    return computeThreadStatuses(narrative, state.currentSceneIndex);
  }, [narrative, state.currentSceneIndex]);

  const { opened, unopened } = useMemo(() => {
    if (!narrative) return { opened: [] as (Thread & { currentStatus: ThreadStatus })[], unopened: [] as (Thread & { currentStatus: ThreadStatus })[] };

    const visibleKeys = new Set(state.resolvedSceneKeys.slice(0, state.currentSceneIndex + 1));
    const allThreads = Object.values(narrative.threads);

    // A thread is "opened" only when it has appeared in a scene (not just a world build commit)
    const sceneKeys = new Set(
      state.resolvedSceneKeys.slice(0, state.currentSceneIndex + 1).filter((k) => narrative.scenes[k])
    );
    const mutatedThreadIds = new Set(
      Array.from(sceneKeys).flatMap((k) => {
        const scene = narrative.scenes[k];
        return scene ? scene.threadMutations.map((tm) => tm.threadId) : [];
      })
    );

    const openedThreads = allThreads
      .filter((t) => visibleKeys.has(t.openedAt) && (narrative.scenes[t.openedAt] || mutatedThreadIds.has(t.id)))
      .map((t) => ({ ...t, currentStatus: (currentStatuses[t.id] ?? t.status) as ThreadStatus }));

    const unopenedThreads = allThreads
      .filter((t) => !visibleKeys.has(t.openedAt) || (!narrative.scenes[t.openedAt] && !mutatedThreadIds.has(t.id)))
      .map((t) => ({ ...t, currentStatus: t.status as ThreadStatus }));

    // Sort by status order
    const statusIdx = (s: string) => { const i = STATUS_ORDER.indexOf(s); return i < 0 ? STATUS_ORDER.length : i; };
    openedThreads.sort((a, b) => statusIdx(a.currentStatus) - statusIdx(b.currentStatus));
    unopenedThreads.sort((a, b) => statusIdx(a.currentStatus) - statusIdx(b.currentStatus));

    return { opened: openedThreads, unopened: unopenedThreads };
  }, [narrative, currentStatuses, state.resolvedSceneKeys, state.currentSceneIndex]);

  if (!narrative) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-text-dim text-center">
          Select a narrative to view threads
        </p>
      </div>
    );
  }

  if (opened.length === 0 && unopened.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-text-dim text-center">No threads yet</p>
      </div>
    );
  }

  const renderThreads = (threads: (Thread & { currentStatus: ThreadStatus })[], dimmed?: boolean) =>
    threads.map((thread) => (
      <ThreadItem
        key={thread.id}
        thread={thread}
        statusLabel={thread.currentStatus}
        dimmed={dimmed}
        onClick={() =>
          dispatch({
            type: 'SET_INSPECTOR',
            context: { type: 'thread', threadId: thread.id },
          })
        }
      />
    ));

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      {opened.length > 0 && (
        <CollapsibleSection title="Opened" count={opened.length} defaultOpen>
          {renderThreads(opened)}
        </CollapsibleSection>
      )}

      {unopened.length > 0 && (
        <CollapsibleSection title="Unopened" count={unopened.length} defaultOpen={false}>
          {renderThreads(unopened, true)}
        </CollapsibleSection>
      )}
    </div>
  );
}
