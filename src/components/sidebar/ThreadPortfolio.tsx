'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { computeThreadStatuses, computeActiveArcs } from '@/lib/narrative-utils';
import type { Thread, ThreadStatus, NarrativeState } from '@/types/narrative';
const STATUS_COLORS: Record<string, string> = {
  latent: 'bg-white/10 text-white/40',
  seeded: 'bg-amber-500/15 text-amber-400',
  active: 'bg-blue-500/15 text-blue-400',
  escalating: 'bg-orange-500/15 text-orange-400',  // point of no return
  critical: 'bg-red-500/15 text-red-400',
  resolved: 'bg-emerald-500/15 text-emerald-400',
  subverted: 'bg-violet-500/15 text-violet-400',
  abandoned: 'bg-white/5 text-white/30',
};

// Stale thread threshold — threads below escalating with no transition for this many scenes are stale
const STALE_THRESHOLD_SCENES = 5;

// ── Thread metrics computation ──────────────────────────────────────────────

type ThreadMetrics = {
  age: number;
  transitions: number;
  pulses: number;
  totalMutations: number;
  scenesSinceLastTransition: number;
  pulseRatio: number;
  velocity: number; // transitions per 10 scenes
};

function computeThreadMetrics(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
): Record<string, ThreadMetrics> {
  const metrics: Record<string, { transitions: number; pulses: number; total: number; sinceLast: number; firstSeen: number }> = {};
  let sceneCount = 0;

  for (let i = 0; i <= currentIndex && i < resolvedKeys.length; i++) {
    const scene = narrative.scenes[resolvedKeys[i]];
    if (!scene) continue;
    sceneCount++;

    for (const tm of scene.threadMutations) {
      if (!metrics[tm.threadId]) {
        metrics[tm.threadId] = { transitions: 0, pulses: 0, total: 0, sinceLast: 0, firstSeen: sceneCount };
      }
      const m = metrics[tm.threadId];
      m.total++;
      if (tm.from === tm.to) {
        m.pulses++;
      } else {
        m.transitions++;
        m.sinceLast = 0;
      }
    }

    for (const m of Object.values(metrics)) {
      m.sinceLast++;
    }
  }

  const result: Record<string, ThreadMetrics> = {};
  for (const [id, m] of Object.entries(metrics)) {
    const age = sceneCount - m.firstSeen + 1;
    result[id] = {
      age,
      transitions: m.transitions,
      pulses: m.pulses,
      totalMutations: m.total,
      scenesSinceLastTransition: m.sinceLast,
      pulseRatio: m.total > 0 ? m.pulses / m.total : 0,
      velocity: age > 0 ? (m.transitions / age) * 10 : 0,
    };
  }
  return result;
}

// ── Thread item ─────────────────────────────────────────────────────────────

const LIFECYCLE_INDEX: Record<string, number> = { latent: 0, seeded: 1, active: 2, escalating: 3, critical: 4, resolved: 5 };

function ThreadItem({
  thread,
  statusLabel,
  metrics,
  totalArcs,
  activeArcs,
  convergenceCount,
  dimmed,
  isStale,
  onClick,
}: {
  thread: Thread;
  statusLabel: string;
  metrics?: ThreadMetrics;
  totalArcs: number;
  activeArcs: number;
  convergenceCount: number;
  dimmed?: boolean;
  isStale?: boolean;
  onClick: () => void;
}) {
  const phase = LIFECYCLE_INDEX[statusLabel] ?? 0;
  const bandwidthRatio = totalArcs > 0 ? activeArcs / totalArcs : 0;
  const isStarved = bandwidthRatio < 0.3 && (statusLabel === 'active' || statusLabel === 'critical');
  const isHighPulse = metrics && metrics.pulseRatio > 0.8 && metrics.totalMutations > 2;

  return (
    <button
      onClick={onClick}
      className={`text-left rounded px-1.5 py-1.5 hover:bg-bg-elevated transition-colors flex flex-col gap-1${dimmed ? ' opacity-50' : ''}${isStale ? ' border-l-2 border-amber-400/50' : ''}`}
    >
      {/* Top row: ID + description + stale indicator */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] bg-white/6 text-text-secondary px-1.5 py-0.5 rounded shrink-0">
          {thread.id}
        </span>
        <span className="text-xs text-text-primary truncate">
          {thread.description}
        </span>
        {isStale && (
          <span className="text-[9px] text-amber-400 shrink-0" title="Stale — no transition in 5+ scenes">
            stale
          </span>
        )}
      </div>

      {/* Status + phase bar + convergence */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[statusLabel] ?? 'bg-white/6 text-text-secondary'}`}>
          {statusLabel}
        </span>
        {/* Phase progress dots (5 phases: latent, seeded, active, escalating, critical) */}
        <div className="flex items-center gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < phase ? 'bg-white/40' : i === phase ? 'bg-white/70' : 'bg-white/10'
              }${i >= 3 ? ' ring-1 ring-orange-400/30' : ''}`}
              title={i >= 3 ? 'Fate committed' : undefined}
            />
          ))}
        </div>
        {convergenceCount > 0 && (
          <span className="text-[9px] text-cyan-400/70 font-mono ml-auto" title={`Converges with ${convergenceCount} thread${convergenceCount > 1 ? 's' : ''}`}>
            &#x21C4;{convergenceCount}
          </span>
        )}
      </div>

      {/* Metrics row */}
      {metrics && metrics.age > 0 && (
        <div className="flex items-center gap-2 text-[9px] text-text-dim font-mono">
          <span>{metrics.age}s</span>
          <span className="text-white/10">|</span>
          <span>{metrics.transitions}&#x2191; {metrics.pulses}~</span>
          <span className="text-white/10">|</span>
          <span className={isStarved ? 'text-amber-400' : ''}>
            {activeArcs}/{totalArcs} arcs
          </span>
          {isHighPulse && (
            <>
              <span className="text-white/10">|</span>
              <span className="text-amber-400/70">high pulse</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

// ── Collapsible section ─────────────────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────────────────────

export default function ThreadPortfolio() {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;

  const currentStatuses = useMemo(() => {
    if (!narrative) return {};
    return computeThreadStatuses(narrative, state.viewState.currentSceneIndex);
  }, [narrative, state.viewState.currentSceneIndex]);

  const threadMetrics = useMemo(() => {
    if (!narrative) return {};
    return computeThreadMetrics(narrative, state.resolvedEntryKeys, state.viewState.currentSceneIndex);
  }, [narrative, state.resolvedEntryKeys, state.viewState.currentSceneIndex]);


  // Compute bidirectional convergence counts per thread
  const convergenceCounts = useMemo(() => {
    if (!narrative) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    const allThreads = Object.values(narrative.threads);
    for (const t of allThreads) {
      // Direct: threads this one converges with
      const directCount = t.dependents.filter((id) => narrative.threads[id]).length;
      // Reverse: threads that converge with this one
      const reverseCount = allThreads.filter((other) => other.id !== t.id && other.dependents.includes(t.id)).length;
      counts[t.id] = directCount + reverseCount;
    }
    return counts;
  }, [narrative]);

  type ThreadWithStatus = Thread & { currentStatus: ThreadStatus };
  const emptyList: ThreadWithStatus[] = [];

  // Categorize threads by fate commitment level
  const { committed, potential, latent, abandoned, complete, unopened } = useMemo(() => {
    const empty = { committed: emptyList, potential: emptyList, latent: emptyList, abandoned: emptyList, complete: emptyList, unopened: emptyList };
    if (!narrative) return empty;

    const visibleKeys = new Set(state.resolvedEntryKeys.slice(0, state.viewState.currentSceneIndex + 1));
    const allThreads = Object.values(narrative.threads);

    const mutatedThreadIds = new Set(
      Array.from(visibleKeys).flatMap((k) => {
        const scene = narrative.scenes[k];
        if (scene) return scene.threadMutations.map((tm) => tm.threadId);
        const wb = narrative.worldBuilds[k];
        if (wb) return wb.expansionManifest.threads.map((t) => t.id);
        return [];
      })
    );

    const committedThreads: ThreadWithStatus[] = [];   // escalating + critical — fate committed
    const potentialThreads: ThreadWithStatus[] = [];   // active + seeded — can be abandoned
    const latentThreads: ThreadWithStatus[] = [];      // latent — not yet developed
    const abandonedThreads: ThreadWithStatus[] = [];   // abandoned — cleaned up
    const completeThreads: ThreadWithStatus[] = [];    // resolved + subverted — fate delivered
    const unopenedThreads: ThreadWithStatus[] = [];

    for (const t of allThreads) {
      const isVisible = mutatedThreadIds.has(t.id) || (visibleKeys.has(t.openedAt) && !!(narrative.scenes[t.openedAt] || narrative.worldBuilds[t.openedAt]));
      const status = (isVisible ? (currentStatuses[t.id] ?? t.status) : t.status) as ThreadStatus;
      const entry = { ...t, currentStatus: status };

      if (!isVisible) {
        unopenedThreads.push(entry);
      } else if (status === 'escalating' || status === 'critical') {
        committedThreads.push(entry);
      } else if (status === 'active' || status === 'seeded') {
        potentialThreads.push(entry);
      } else if (status === 'latent') {
        latentThreads.push(entry);
      } else if (status === 'abandoned') {
        abandonedThreads.push(entry);
      } else {
        // resolved, subverted
        completeThreads.push(entry);
      }
    }

    // Sort committed by urgency (critical first)
    committedThreads.sort((a, b) => (a.currentStatus === 'critical' ? -1 : 1) - (b.currentStatus === 'critical' ? -1 : 1));
    // Sort potential by staleness (most stale first to encourage cleanup)
    potentialThreads.sort((a, b) => {
      const mA = threadMetrics[a.id];
      const mB = threadMetrics[b.id];
      const staleA = mA?.scenesSinceLastTransition ?? 0;
      const staleB = mB?.scenesSinceLastTransition ?? 0;
      return staleB - staleA;
    });

    return { committed: committedThreads, potential: potentialThreads, latent: latentThreads, abandoned: abandonedThreads, complete: completeThreads, unopened: unopenedThreads };
  }, [narrative, currentStatuses, threadMetrics, state.resolvedEntryKeys, state.viewState.currentSceneIndex]);

  if (!narrative) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-text-dim text-center">
          Select a narrative to view threads
        </p>
      </div>
    );
  }

  const totalVisible = committed.length + potential.length + latent.length + abandoned.length + complete.length;

  if (totalVisible === 0 && unopened.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-3">
        <p className="text-xs text-text-dim text-center">No threads yet</p>
      </div>
    );
  }

  // Check for stale threads that should be abandoned
  const staleThreads = potential.filter((t) => {
    const m = threadMetrics[t.id];
    return m && m.scenesSinceLastTransition >= STALE_THRESHOLD_SCENES;
  });

  const renderThreads = (threads: (Thread & { currentStatus: ThreadStatus })[], dimmed?: boolean, showStaleWarning?: boolean) =>
    threads.map((thread) => {
      const isStale = showStaleWarning && staleThreads.some((st) => st.id === thread.id);
      return (
        <ThreadItem
          key={thread.id}
          thread={thread}
          statusLabel={thread.currentStatus}
          metrics={threadMetrics[thread.id]}
          totalArcs={Object.keys(narrative?.arcs ?? {}).length || 1}
          activeArcs={computeActiveArcs(thread.id, narrative?.scenes ?? {})}
          convergenceCount={convergenceCounts[thread.id] ?? 0}
          dimmed={dimmed}
          isStale={isStale}
          onClick={() => {
            dispatch({ type: 'SET_GRAPH_VIEW_MODE', mode: 'threads' });
            dispatch({ type: 'SELECT_THREAD_LOG', threadId: thread.id });
            dispatch({
              type: 'SET_INSPECTOR',
              context: { type: 'thread', threadId: thread.id },
            });
          }}
        />
      );
    });

  const completeCount = complete.length + abandoned.length;

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      {/* Fate summary bar */}
      <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden flex">
          {committed.length > 0 && (
            <div
              className="h-full bg-orange-400/60"
              style={{ width: `${(committed.length / totalVisible) * 100}%` }}
              title="Committed fate"
            />
          )}
          {potential.length > 0 && (
            <div
              className="h-full bg-blue-400/40"
              style={{ width: `${(potential.length / totalVisible) * 100}%` }}
              title="Potential"
            />
          )}
          {latent.length > 0 && (
            <div
              className="h-full bg-white/10"
              style={{ width: `${(latent.length / totalVisible) * 100}%` }}
              title="Latent"
            />
          )}
          {completeCount > 0 && (
            <div
              className="h-full bg-emerald-400/50"
              style={{ width: `${(completeCount / totalVisible) * 100}%` }}
              title="Resolved"
            />
          )}
        </div>
        <span className="text-[9px] text-text-dim font-mono shrink-0">
          {completeCount}/{totalVisible}
        </span>
      </div>

      {/* Stale thread warning */}
      {staleThreads.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 rounded bg-amber-500/10 border border-amber-500/20">
          <span className="text-amber-400 text-[10px]">⚠</span>
          <span className="text-[10px] text-amber-300">
            {staleThreads.length} stale thread{staleThreads.length > 1 ? 's' : ''} — consider abandoning
          </span>
        </div>
      )}

      {committed.length > 0 && (
        <CollapsibleSection title="Committed" count={committed.length} defaultOpen>
          {renderThreads(committed)}
        </CollapsibleSection>
      )}

      {potential.length > 0 && (
        <CollapsibleSection title="Potential" count={potential.length} defaultOpen>
          {renderThreads(potential, false, true)}
        </CollapsibleSection>
      )}

      {latent.length > 0 && (
        <CollapsibleSection title="Latent" count={latent.length} defaultOpen={false}>
          {renderThreads(latent, true)}
        </CollapsibleSection>
      )}

      {complete.length > 0 && (
        <CollapsibleSection title="Complete" count={complete.length} defaultOpen={false}>
          {renderThreads(complete, true)}
        </CollapsibleSection>
      )}

      {abandoned.length > 0 && (
        <CollapsibleSection title="Abandoned" count={abandoned.length} defaultOpen={false}>
          {renderThreads(abandoned, true)}
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
