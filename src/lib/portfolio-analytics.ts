/**
 * Thread-portfolio analytics.
 *
 * Derives aggregate market-state statistics from a narrative's threads:
 *   - Market capitalisation (summed volume — narrative attention mass)
 *   - Focus-window selection & coverage
 *   - Resolution-quality distribution
 *   - Average entropy / uncertainty (how contested the portfolio is)
 *   - Trajectory point per resolved scene (entropy-over-time)
 *
 * These powersur the sidebar portfolio view and the thread dashboard modal.
 * Pure derivation — no IO, no rendering.
 */

import type { NarrativeState, Thread, Scene } from '@/types/narrative';
import { NARRATOR_AGENT_ID } from '@/types/narrative';
import { MARKET_OPENING_VOLUME } from '@/lib/constants';
import { MARKET_FOCUS_K } from '@/lib/constants';
import {
  isThreadClosed,
  isThreadAbandoned,
  isNearClosed,
  getMarketBelief,
  getMarketProbs,
  getMarketMargin,
  normalizedEntropy,
  focusScore,
  selectFocusWindow,
} from '@/lib/narrative-utils';
import {
  classifyThreadCategory,
  type ThreadCategory,
} from '@/lib/thread-category';
import { applyThreadDelta, decayUntouchedBeliefsForScene } from '@/lib/thread-log';

// ── Snapshot-level aggregates ──────────────────────────────────────────────

export type PortfolioSnapshot = {
  /** Total threads in the narrative, regardless of state. */
  totalThreads: number;
  /** Open + not abandoned. */
  activeThreads: number;
  /** Closed (resolved to an outcome). */
  closedThreads: number;
  /** Open but near the closure threshold — saturating markets. */
  nearClosedThreads: number;
  /** Open but volume below abandonment floor. */
  abandonedThreads: number;
  /** Summed volume across all open threads — the "market cap". */
  marketCap: number;
  /** Average normalized entropy across open threads. 0 = all decided, 1 = uniform. */
  averageEntropy: number;
  /** Average resolutionQuality across closed threads; null if none closed yet. */
  averageResolutionQuality: number | null;
  /** Count of each resolutionQuality band (earned / adequate / thin). */
  resolutionQualityBands: { earned: number; adequate: number; thin: number };
};

export function computePortfolioSnapshot(narrative: NarrativeState): PortfolioSnapshot {
  const threads = Object.values(narrative.threads);
  let active = 0;
  let closed = 0;
  let near = 0;
  let abandoned = 0;
  let marketCap = 0;
  let entropySum = 0;
  let entropyCount = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  const bands = { earned: 0, adequate: 0, thin: 0 };
  for (const t of threads) {
    if (isThreadClosed(t)) {
      closed++;
      if (typeof t.resolutionQuality === 'number') {
        qualitySum += t.resolutionQuality;
        qualityCount++;
        if (t.resolutionQuality >= 0.7) bands.earned++;
        else if (t.resolutionQuality >= 0.4) bands.adequate++;
        else bands.thin++;
      }
      continue;
    }
    if (isThreadAbandoned(t)) {
      abandoned++;
      continue;
    }
    active++;
    if (isNearClosed(t)) near++;
    const belief = getMarketBelief(t);
    if (belief) marketCap += belief.volume;
    entropySum += normalizedEntropy(getMarketProbs(t));
    entropyCount++;
  }
  return {
    totalThreads: threads.length,
    activeThreads: active,
    closedThreads: closed,
    nearClosedThreads: near,
    abandonedThreads: abandoned,
    marketCap,
    averageEntropy: entropyCount > 0 ? entropySum / entropyCount : 0,
    averageResolutionQuality: qualityCount > 0 ? qualitySum / qualityCount : null,
    resolutionQualityBands: bands,
  };
}

// ── Per-thread ranked rows ─────────────────────────────────────────────────

export type PortfolioRow = {
  thread: Thread;
  /** Narrator's current probability distribution. */
  probs: number[];
  /** Index of the currently-leading outcome. */
  topIdx: number;
  /** Log-odds margin between top and runner-up. */
  margin: number;
  /** Normalized entropy [0, 1] — 0 = decided, 1 = maximal uncertainty. */
  entropy: number;
  /** Market volume — accumulated narrative attention. */
  volume: number;
  /** EWMA volatility — how much belief moved recently. */
  volatility: number;
  /** Scenes since last touched (Infinity if never). */
  gap: number;
  /** Focus score — used to rank the portfolio. */
  focus: number;
  /** Market-state category (saturating / contested / volatile / committed /
   *  dormant / abandoned / resolved). Single source of truth for colouring. */
  category: ThreadCategory;
};

/** Rank weight for sorting rows. Lower = higher priority in the list.
 *  Ordering: actively moving (saturating/volatile) → decided shape (contested/
 *  committed) → evolving without shape (developing) → quiet / terminal. */
const CATEGORY_RANK: Record<ThreadCategory, number> = {
  saturating: 0,
  volatile: 1,
  contested: 2,
  committed: 3,
  developing: 4,
  dormant: 5,
  abandoned: 6,
  resolved: 7,
};

export function buildPortfolioRows(
  narrative: NarrativeState,
  resolvedEntryKeys: string[],
  currentSceneIndex: number,
): PortfolioRow[] {
  const rows: PortfolioRow[] = [];
  for (const t of Object.values(narrative.threads)) {
    const belief = getMarketBelief(t);
    const probs = getMarketProbs(t);
    const { topIdx, margin } = getMarketMargin(t);
    const entropy = normalizedEntropy(probs);
    const volume = belief?.volume ?? 0;
    const volatility = belief?.volatility ?? 0;
    const f = focusScore(t, resolvedEntryKeys, currentSceneIndex);
    // Gap derivation copies narrative-utils/scenesSinceTouched's shape to avoid
    // round-tripping through exports — kept inline for performance in lists.
    const lastTouched = belief?.lastTouchedScene;
    const idx = lastTouched ? resolvedEntryKeys.indexOf(lastTouched) : -1;
    const gap = idx < 0 ? Infinity : currentSceneIndex - idx;
    const category = classifyThreadCategory(t, { scenesSinceTouch: gap });
    rows.push({ thread: t, probs, topIdx, margin, entropy, volume, volatility, gap, focus: f, category });
  }
  rows.sort((a, b) => {
    if (CATEGORY_RANK[a.category] !== CATEGORY_RANK[b.category]) {
      return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    }
    return b.focus - a.focus;
  });
  return rows;
}

/** Replay every thread's narrator belief up through `targetIndex`, returning
 *  a fresh threads map with evolved state. Drives the sidebar scrubber so
 *  probabilities / volume / volatility visibly change as the user iterates
 *  through scenes. Threads with openedAt later than the target are included
 *  in their initial uniform-prior state.
 *
 *  Not for generation paths — those read live state. Use this for timeline
 *  visualisations and portfolio scrubbing only. */
export function replayThreadsAtIndex(
  narrative: NarrativeState,
  resolvedKeys: string[],
  targetIndex: number,
): Record<string, Thread> {
  const threads: Record<string, Thread> = {};
  for (const [id, t] of Object.entries(narrative.threads)) {
    threads[id] = {
      ...t,
      beliefs: {
        [NARRATOR_AGENT_ID]: {
          logits: new Array(t.outcomes.length).fill(0),
          volume: MARKET_OPENING_VOLUME,
          volatility: 0,
        },
      },
      threadLog: { nodes: {}, edges: [] },
      closedAt: undefined,
      closeOutcome: undefined,
      resolutionQuality: undefined,
    };
  }

  const limit = Math.min(targetIndex, resolvedKeys.length - 1);
  for (let i = 0; i <= limit; i++) {
    const key = resolvedKeys[i];
    const scene = narrative.scenes[key] as Scene | undefined;
    if (!scene || scene.kind !== 'scene') continue;
    const touched = new Set<string>();
    for (const tm of scene.threadDeltas ?? []) {
      if (!threads[tm.threadId]) continue;
      touched.add(tm.threadId);
      threads[tm.threadId] = applyThreadDelta(threads[tm.threadId], tm, scene.id);
    }
    const decayed = decayUntouchedBeliefsForScene(threads, touched);
    for (const [id, t] of Object.entries(decayed)) {
      threads[id] = t;
    }
  }

  return threads;
}

/** Per-thread recent-movement signal. Compares the top-outcome probability
 *  at `targetIndex` against the top-outcome probability `lookback` scenes
 *  earlier. Positive magnitude = market moved; sign indicates direction.
 *  Used by the Market dashboard to surface "breaking news" rows. */
export type ThreadMovement = {
  threadId: string;
  topIdx: number;
  topOutcome: string;
  nowProb: number;
  priorProb: number;
  deltaProb: number;
};

export function computeRecentMovements(
  narrative: NarrativeState,
  resolvedEntryKeys: string[],
  targetIndex: number,
  lookback: number = 5,
): ThreadMovement[] {
  const now = replayThreadsAtIndex(narrative, resolvedEntryKeys, targetIndex);
  const prior = replayThreadsAtIndex(
    narrative,
    resolvedEntryKeys,
    Math.max(0, targetIndex - lookback),
  );
  const introduced = introducedThreadIdsAtIndex(narrative, resolvedEntryKeys, targetIndex);
  const movements: ThreadMovement[] = [];
  for (const id of introduced) {
    const nowThread = now[id];
    const priorThread = prior[id];
    if (!nowThread || !priorThread) continue;
    if (isThreadAbandoned(nowThread)) continue;
    const nowProbs = getMarketProbs(nowThread);
    const priorProbs = getMarketProbs(priorThread);
    // Compare on the currently-leading outcome — the "headline" of the market.
    let topIdx = 0;
    for (let i = 1; i < nowProbs.length; i++) {
      if ((nowProbs[i] ?? 0) > (nowProbs[topIdx] ?? 0)) topIdx = i;
    }
    const nowProb = nowProbs[topIdx] ?? 0;
    const priorProb = priorProbs[topIdx] ?? 0;
    movements.push({
      threadId: id,
      topIdx,
      topOutcome: nowThread.outcomes[topIdx] ?? '?',
      nowProb,
      priorProb,
      deltaProb: nowProb - priorProb,
    });
  }
  // Rank by absolute movement magnitude.
  movements.sort((a, b) => Math.abs(b.deltaProb) - Math.abs(a.deltaProb));
  return movements;
}

/** Set of thread ids that have actually been introduced by `targetIndex` —
 *  openedAt resolves to a scene or world-build at-or-before the cutoff. */
export function introducedThreadIdsAtIndex(
  narrative: NarrativeState,
  resolvedKeys: string[],
  targetIndex: number,
): Set<string> {
  const visible = new Set<string>();
  const limit = Math.min(targetIndex, resolvedKeys.length - 1);
  const visibleKeys = new Set(resolvedKeys.slice(0, limit + 1));
  for (const [id, t] of Object.entries(narrative.threads)) {
    if (!t.openedAt || visibleKeys.has(t.openedAt)) {
      visible.add(id);
    }
  }
  return visible;
}

/** Ids of threads currently in the focus window (priority for generation). */
export function currentFocusIds(
  narrative: NarrativeState,
  resolvedEntryKeys: string[],
  currentSceneIndex: number,
  k: number = MARKET_FOCUS_K,
): Set<string> {
  return new Set(selectFocusWindow(narrative, resolvedEntryKeys, currentSceneIndex, k).map((t) => t.id));
}

// ── Per-thread time series ─────────────────────────────────────────────────

export type ThreadTrajectoryPoint = {
  /** Resolved-scene index where the point is anchored. */
  sceneIndex: number;
  /** Scene id (for hover / click-through). */
  sceneId: string;
  /** Probability distribution at this scene. */
  probs: number[];
  /** Normalized entropy at this scene. */
  entropy: number;
  /** Volume at this scene. */
  volume: number;
  /** Log-odds margin at this scene. */
  margin: number;
};

/** Replay a single thread's trajectory across the resolved timeline.
 *
 *  Rebuilds the narrator belief scene-by-scene so callers can render the
 *  probability stack / entropy curve without having stored per-scene beliefs.
 *  O(scenes × outcomes) — cheap for portfolio analytics, not intended for hot
 *  generation paths. */
export function buildThreadTrajectory(
  narrative: NarrativeState,
  threadId: string,
  resolvedEntryKeys: string[],
): ThreadTrajectoryPoint[] {
  const thread0 = narrative.threads[threadId];
  if (!thread0) return [];
  // Seed from the thread's declared initial outcomes; narrator belief at uniform.
  let cursor: Thread = {
    ...thread0,
    beliefs: { [NARRATOR_AGENT_ID]: { logits: new Array(thread0.outcomes.length).fill(0), volume: 2, volatility: 0 } },
    threadLog: { nodes: {}, edges: [] },
    closedAt: undefined,
    closeOutcome: undefined,
    resolutionQuality: undefined,
  };
  // A thread that opens mid-story has no market state to plot before openedAt.
  // Plotting a flat line from scene 0 to the opening scene misrepresents the
  // market as priced-before-it-existed. Skip iterations before openedAt when
  // the thread carries a resolvable opening key; threads without a known
  // openedAt (or whose openedAt predates the resolved timeline) start at 0.
  const openedIdx = thread0.openedAt
    ? resolvedEntryKeys.indexOf(thread0.openedAt)
    : -1;
  const startIdx = openedIdx >= 0 ? openedIdx : 0;
  const points: ThreadTrajectoryPoint[] = [];
  for (let i = startIdx; i < resolvedEntryKeys.length; i++) {
    const sceneId = resolvedEntryKeys[i];
    const scene = narrative.scenes[sceneId] as Scene | undefined;
    if (!scene || scene.kind !== 'scene') continue;
    const touched = new Set<string>();
    const threadsMap: Record<string, Thread> = { [threadId]: cursor };
    for (const tm of scene.threadDeltas ?? []) {
      if (tm.threadId === threadId) {
        touched.add(threadId);
        threadsMap[threadId] = applyThreadDelta(threadsMap[threadId], tm, sceneId);
      }
    }
    if (!touched.has(threadId)) {
      // Decay volume for scenes that skipped the thread — mirrors store replay.
      const decayed = decayUntouchedBeliefsForScene(threadsMap, touched);
      cursor = decayed[threadId];
    } else {
      cursor = threadsMap[threadId];
    }
    const probs = getMarketProbs(cursor);
    const { margin } = getMarketMargin(cursor);
    const belief = getMarketBelief(cursor);
    points.push({
      sceneIndex: i,
      sceneId,
      probs,
      entropy: normalizedEntropy(probs),
      volume: belief?.volume ?? 0,
      margin,
    });
    if (cursor.closedAt) break;
  }
  return points;
}
