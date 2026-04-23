"use client";

import {
  classifyThreadKind,
  computeActiveArcs,
  getMarketBelief,
  getMarketMargin,
  getMarketProbs,
} from "@/lib/narrative-utils";
import {
  classifyThreadCategory,
  THREAD_CATEGORY_LABEL,
  THREAD_CATEGORY_TEXT,
  THREAD_CATEGORY_DESCRIPTION,
} from "@/lib/thread-category";
import { buildThreadTrajectory } from "@/lib/portfolio-analytics";
import { getThreadLogAtScene } from "@/lib/scene-filter";
import { useStore } from "@/lib/store";
import { useMemo, useState } from "react";
import { CollapsibleSection, Paginator, paginateRecent } from "./CollapsibleSection";

// Shared palette with MarketView — top outcome takes the brightest slot.
const OUTCOME_HEX = [
  "#38BDF8", // sky
  "#FBBF24", // amber
  "#2DD4BF", // teal
  "#A78BFA", // violet
  "#FB7185", // rose
  "#34D399", // emerald
];

type Props = {
  threadId: string;
};

const threadLogDotColors: Record<string, string> = {
  pulse: "bg-white/40",
  transition: "bg-fate",
  setup: "bg-amber-400",
  escalation: "bg-orange-400",
  payoff: "bg-emerald-400",
  twist: "bg-violet-400",
  callback: "bg-sky-400",
  resistance: "bg-red-500",
  stall: "bg-red-400/50",
};

export default function ThreadDetail({ threadId }: Props) {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;
  const [logPage, setLogPage] = useState(0);
  const [scenesPage, setScenesPage] = useState(0);

  const thread = narrative?.threads[threadId];

  // Market-derived category per thread.
  const currentCategory = useMemo(
    () => (thread ? classifyThreadCategory(thread) : 'dormant'),
    [thread],
  );

  // Progressive reveal: thread log nodes visible at current scene index
  const visibleLog = useMemo(() => {
    if (!narrative || !thread) return { nodes: [], edges: [] };
    return getThreadLogAtScene(
      thread.threadLog ?? { nodes: {}, edges: [] },
      threadId,
      narrative.scenes,
      state.resolvedEntryKeys,
      state.viewState.currentSceneIndex,
    );
  }, [
    narrative,
    thread,
    threadId,
    state.resolvedEntryKeys,
    state.viewState.currentSceneIndex,
  ]);

  // Probability trajectory replayed scene-by-scene up to the current index —
  // the "up to scene" history that powers the sparkline + current distribution.
  const trajectory = useMemo(() => {
    if (!narrative) return [];
    return buildThreadTrajectory(
      narrative,
      threadId,
      state.resolvedEntryKeys.slice(0, state.viewState.currentSceneIndex + 1),
    );
  }, [
    narrative,
    threadId,
    state.resolvedEntryKeys,
    state.viewState.currentSceneIndex,
  ]);

  if (!narrative || !thread) return null;

  // Resolve anchor names
  const anchors = (thread.participants ?? []).map((a) => ({
    ...a,
    name:
      a.type === "character"
        ? (narrative.characters[a.id]?.name ?? a.id)
        : (narrative.locations[a.id]?.name ?? a.id),
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Thread ID badge + description */}
      <div className="flex flex-col gap-1">
        <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-text-dim self-start">
          {thread.id}
        </span>
        <p className="text-sm text-text-primary">{thread.description}</p>
      </div>

      {/* Category + kind + bandwidth */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] uppercase tracking-widest ${THREAD_CATEGORY_TEXT[currentCategory]}`}
          title={THREAD_CATEGORY_DESCRIPTION[currentCategory]}
        >
          {THREAD_CATEGORY_LABEL[currentCategory]}
        </span>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-full ${
            classifyThreadKind(thread, narrative.scenes) === "storyline"
              ? "bg-blue-500/15 text-blue-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {classifyThreadKind(thread, narrative.scenes)}
        </span>
        <span className="text-[9px] text-text-dim font-mono ml-auto">
          {computeActiveArcs(threadId, narrative.scenes)}/
          {Object.keys(narrative.arcs).length || 1} arcs
        </span>
      </div>

      {/* Market — up-to-scene probability distribution + trajectory */}
      {(() => {
        const tailProbs =
          trajectory.length > 0
            ? trajectory[trajectory.length - 1].probs
            : getMarketProbs(thread);
        const belief = getMarketBelief(thread);
        const { margin } = getMarketMargin(thread);
        const ranked = thread.outcomes
          .map((outcome, idx) => ({
            outcome,
            idx,
            prob: tailProbs[idx] ?? 0,
          }))
          .sort((a, b) => b.prob - a.prob);
        const catColor = `var(--color-fate)`;
        const isClosed =
          thread.closedAt !== undefined && thread.closeOutcome !== undefined;
        return (
          <div className="flex flex-col gap-2.5 rounded-lg border border-white/5 bg-white/1.5 p-3">
            {/* Ranked outcomes with probability bars */}
            <ul className="flex flex-col gap-1.5">
              {ranked.map(({ outcome, idx, prob }) => {
                const color = OUTCOME_HEX[idx % OUTCOME_HEX.length];
                const isWinner = isClosed && thread.closeOutcome === idx;
                return (
                  <li key={`${outcome}-${idx}`} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-sm shrink-0"
                        style={{ background: color }}
                      />
                      <span
                        className={`text-xs truncate flex-1 ${isWinner ? "text-text-primary font-medium" : "text-text-secondary"}`}
                        title={outcome}
                      >
                        {outcome}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-text-primary">
                        {Math.round(prob * 100)}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${prob * 100}%`,
                          background: color,
                          opacity: ranked[0].idx === idx ? 1 : 0.55,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Market stats */}
            <div className="flex items-center gap-3 text-[10px] text-text-dim pt-1 border-t border-white/5">
              <span title="Cumulative narrative attention">
                vol{" "}
                <span className="font-mono tabular-nums text-text-secondary">
                  {(belief?.volume ?? 0).toFixed(1)}
                </span>
              </span>
              <span title="Log-odds margin between top two outcomes">
                Δ
                <span className="font-mono tabular-nums text-text-secondary">
                  {margin.toFixed(2)}
                </span>
              </span>
              <span title="EWMA of recent evidence magnitude">
                σ{" "}
                <span className="font-mono tabular-nums text-text-secondary">
                  {(belief?.volatility ?? 0).toFixed(2)}
                </span>
              </span>
              {trajectory.length > 0 && (
                <span className="ml-auto font-mono tabular-nums">
                  {trajectory.length} scn
                </span>
              )}
            </div>

            {/* Resolution footer */}
            {isClosed && (
              <div className="text-[10px] text-text-dim pt-1 border-t border-white/5">
                Closed at{" "}
                <span className="font-mono text-text-secondary">
                  {thread.closedAt}
                </span>{" "}
                → <span style={{ color: catColor }}>
                  {thread.outcomes[thread.closeOutcome ?? 0]}
                </span>
                {thread.resolutionQuality !== undefined && (
                  <>
                    {" · quality "}
                    <span className="font-mono tabular-nums text-text-secondary">
                      {Math.round(thread.resolutionQuality * 100)}%
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Thread Log — progressive-reveal paginated list */}
      {visibleLog.nodes.length > 0 &&
        (() => {
          const { pageItems, totalPages, safePage } = paginateRecent(
            visibleLog.nodes,
            logPage,
          );
          return (
            <CollapsibleSection
              title="Thread Log"
              count={visibleLog.nodes.length}
              defaultOpen
            >
              <ul className="flex flex-col gap-1">
                {pageItems.map((node, i) => (
                  <li
                    key={`${node.id}-${i}`}
                    className="flex items-start gap-2"
                  >
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${threadLogDotColors[node.type] ?? "bg-white/40"}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_INSPECTOR",
                          context: {
                            type: "threadLog",
                            threadId,
                            nodeId: node.id,
                          },
                        })
                      }
                      className="text-xs text-text-primary hover:text-white transition-colors text-left"
                    >
                      {node.content}
                    </button>
                  </li>
                ))}
              </ul>
              <Paginator
                page={safePage}
                totalPages={totalPages}
                onPage={setLogPage}
              />
            </CollapsibleSection>
          );
        })()}

      {/* Scenes — derived from scene.threadDeltas, up to current index */}
      {(() => {
        const sceneKeysUpToCurrent = state.resolvedEntryKeys.slice(
          0,
          state.viewState.currentSceneIndex + 1,
        );
        const sceneTouches = sceneKeysUpToCurrent
          .map((k) => narrative.scenes[k])
          .filter(
            (s) =>
              s && s.threadDeltas.some((tm) => tm.threadId === threadId),
          )
          .map((s) => ({
            sceneId: s.id,
            deltas: s.threadDeltas.filter(
              (tm) => tm.threadId === threadId,
            ),
          }));
        if (sceneTouches.length === 0) return null;
        const { pageItems, totalPages, safePage } = paginateRecent(
          sceneTouches,
          scenesPage,
        );
        return (
          <CollapsibleSection title="Scenes" count={sceneTouches.length}>
            <ul className="flex flex-col gap-1.5">
              {pageItems.map(({ sceneId, deltas }) => (
                <li key={sceneId} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_INSPECTOR",
                        context: { type: "scene", sceneId },
                      })
                    }
                    className="text-left font-mono text-[10px] text-text-dim transition-colors hover:text-text-secondary"
                  >
                    {sceneId}
                  </button>
                  {deltas.map((tm, tmIdx) => (
                    <span
                      key={`${tm.threadId}-${tmIdx}`}
                      className={`text-xs ${tm.logType === 'pulse' || tm.logType === 'stall' ? "text-text-dim" : "text-fate"}`}
                    >
                      [{tm.logType}] {(tm.updates ?? []).map((u) => `${u.outcome}${u.evidence >= 0 ? '+' : ''}${u.evidence}`).join(' ')}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <Paginator
              page={safePage}
              totalPages={totalPages}
              onPage={setScenesPage}
            />
          </CollapsibleSection>
        );
      })()}

      {/* Anchors */}
      <div className="flex flex-col gap-1">
        <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
          {anchors.length === 0 ? "General Thread" : "Anchors"}
        </h3>
        {anchors.map((a, i) => (
          <button
            key={`${a.id}-${i}`}
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_INSPECTOR",
                context:
                  a.type === "character"
                    ? { type: "character", characterId: a.id }
                    : { type: "location", locationId: a.id },
              })
            }
            className="text-left text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <span className="text-[10px] text-text-dim mr-1">{a.type}</span>
            {a.name}
          </button>
        ))}
      </div>

      {/* Connected Threads — bidirectional: what this thread converges with + what depends on it */}
      {(() => {
        const convergesWith = thread.dependents.filter(
          (id) => narrative.threads[id],
        );
        const dependedOnBy = Object.values(narrative.threads).filter(
          (t) => t.id !== threadId && t.dependents.includes(threadId),
        );
        if (convergesWith.length === 0 && dependedOnBy.length === 0)
          return null;
        return (
          <div className="flex flex-col gap-2">
            {convergesWith.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
                  Converges With
                </h3>
                <ul className="flex flex-col gap-1">
                  {convergesWith.map((depId) => (
                    <li key={depId}>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "SET_INSPECTOR",
                            context: { type: "thread", threadId: depId },
                          })
                        }
                        className="text-left text-xs text-text-secondary transition-colors hover:text-text-primary"
                      >
                        <span className="font-mono text-[10px] text-text-dim mr-1">
                          {depId}
                        </span>
                        {narrative.threads[depId]?.description}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dependedOnBy.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
                  Connected From
                </h3>
                <ul className="flex flex-col gap-1">
                  {dependedOnBy.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "SET_INSPECTOR",
                            context: { type: "thread", threadId: t.id },
                          })
                        }
                        className="text-left text-xs text-text-secondary transition-colors hover:text-text-primary"
                      >
                        <span className="font-mono text-[10px] text-text-dim mr-1">
                          {t.id}
                        </span>
                        {t.description}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
