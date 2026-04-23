/**
 * Thread prediction-market application.
 *
 * `applyThreadDelta` takes a ThreadDelta (evidence + logType + volumeDelta +
 * rationale) and produces:
 *   1. An updated Belief for the narrator — new logits via log-odds update,
 *      decayed + incremented volume, EWMA-updated volatility.
 *   2. A new ThreadLog node appended (the prose-grade event record).
 *   3. Optional closure side-effect if the updated market satisfies both the
 *      margin condition and a committal logType.
 *
 * `decayUntouchedBeliefs` applies per-scene volume decay to threads the
 * current scene did NOT touch — runs before delta application so "touched
 * this scene" means "survived this scene's decay pass with a delta."
 */

import type { Belief, Thread, ThreadDelta, ThreadLog, ThreadLogNode } from '@/types/narrative';
import { NARRATOR_AGENT_ID } from '@/types/narrative';
import {
  MARKET_EVIDENCE_SENSITIVITY,
  MARKET_OPENING_MAX_LOGIT,
  MARKET_OPENING_MIN_LOGIT,
  MARKET_VOLATILITY_BETA,
  MARKET_VOLUME_DECAY,
  MARKET_TAU_CLOSE,
  MARKET_OPENING_VOLUME,
} from '@/lib/constants';
import {
  clampEvidence,
  getMarketMargin,
  normalizedEntropy,
  softmax,
} from '@/lib/narrative-utils';

/** Empty thread log — the canonical zero value for thread initialization. */
export const EMPTY_THREAD_LOG: ThreadLog = { nodes: {}, edges: [] };

/** Translate an in-world prior distribution into opening logits.
 *
 *  Input: `priorProbs` is a probability-like vector over outcomes — the LLM's
 *  best estimate of base rates before any story evidence, from the perspective
 *  of a neutral in-world observer. Output: centered log-odds clamped to the
 *  `MARKET_OPENING_MIN_LOGIT..MAX_LOGIT` guardrail so no outcome opens near
 *  saturation.
 *
 *  Falls back to uniform (zeros) whenever priors are absent, the wrong length,
 *  or degenerate (non-finite, non-positive). The clamp is asymmetric-safe — we
 *  re-center after clamping so the vector still means "relative prior" rather
 *  than "absolute log-odds." */
export function deriveInitialLogits(
  numOutcomes: number,
  priorProbs?: readonly number[] | null,
): number[] {
  if (!priorProbs || priorProbs.length !== numOutcomes) {
    return new Array(numOutcomes).fill(0);
  }
  // Small floor to avoid log(0); anything lower than 1% is rounded up.
  const EPS = 0.01;
  const clean = priorProbs.map((p) =>
    Number.isFinite(p) && p > 0 ? Math.max(p, EPS) : EPS,
  );
  // Renormalize in case the LLM didn't sum to 1.
  const sum = clean.reduce((s, p) => s + p, 0);
  const norm = clean.map((p) => p / sum);
  // Log-transform, center, then clamp to opening guardrails.
  const raw = norm.map((p) => Math.log(p));
  const mean = raw.reduce((s, v) => s + v, 0) / raw.length;
  const centered = raw.map((v) => v - mean);
  return centered.map((v) =>
    Math.max(MARKET_OPENING_MIN_LOGIT, Math.min(MARKET_OPENING_MAX_LOGIT, v)),
  );
}

/** Create a fresh narrator belief. Defaults to uniform logits (max entropy)
 *  when no priors supplied — pass `priorProbs` for in-world base-rate seeding. */
export function newNarratorBelief(
  numOutcomes: number,
  initialVolume = 2,
  priorProbs?: readonly number[] | null,
): Belief {
  return {
    logits: deriveInitialLogits(numOutcomes, priorProbs),
    volume: initialVolume,
    volatility: 0,
  };
}

/** Apply one scene's evidence to a thread, returning a new Thread object.
 *
 *  - Clamps each evidence to the allowed range
 *  - Updates narrator logits via log-odds arithmetic
 *  - Refreshes volume (existing + volumeDelta, floor at 0)
 *  - EWMA-updates volatility from the max single-outcome shift
 *  - Appends a ThreadLog node carrying the prose rationale + updates snapshot
 *  - Sets closedAt/closeOutcome if (margin ≥ τ) AND logType is committal
 *  - Idempotent on node id collisions (re-applying the same delta is a no-op)
 */
export function applyThreadDelta(
  thread: Thread,
  delta: ThreadDelta,
  sceneId: string,
  opts?: { logNodeId?: string },
): Thread {
  // ── Outcome expansion — append any new outcomes to the thread's market.
  // Closed threads reject expansion (the market is settled). Duplicates and
  // empties are filtered. New outcomes join at logit=0, which is "equal to
  // the current strongest outcome" under softmax — a neutral prior the
  // same-scene evidence updates can then shift.
  const expandedOutcomes: string[] = thread.outcomes.slice();
  const addedOutcomes: string[] = [];
  if (!thread.closedAt && Array.isArray(delta.addOutcomes)) {
    const seen = new Set(thread.outcomes.map((o) => o.toLowerCase()));
    for (const raw of delta.addOutcomes) {
      const name = typeof raw === 'string' ? raw.trim() : '';
      if (!name) continue;
      if (seen.has(name.toLowerCase())) continue;
      expandedOutcomes.push(name);
      addedOutcomes.push(name);
      seen.add(name.toLowerCase());
    }
  }

  // Narrator belief — extend logits to match the (possibly-expanded) outcomes.
  const existingBelief: Belief = thread.beliefs[NARRATOR_AGENT_ID]
    ?? newNarratorBelief(expandedOutcomes.length);
  const belief: Belief = existingBelief.logits.length < expandedOutcomes.length
    ? {
        ...existingBelief,
        logits: [
          ...existingBelief.logits,
          ...new Array(expandedOutcomes.length - existingBelief.logits.length).fill(0),
        ],
      }
    : existingBelief;
  const prevLogits = belief.logits.slice();

  // Clamp + apply evidence to logits (against the expanded outcome list).
  const outcomeIndex = new Map<string, number>();
  expandedOutcomes.forEach((o, i) => outcomeIndex.set(o, i));
  const newLogits = prevLogits.slice();
  let maxAbsShift = 0;
  for (const u of delta.updates ?? []) {
    const idx = outcomeIndex.get(u.outcome);
    if (idx === undefined) continue;
    const e = clampEvidence(u.evidence);
    const shift = e / MARKET_EVIDENCE_SENSITIVITY;
    newLogits[idx] += shift;
    if (Math.abs(shift) > maxAbsShift) maxAbsShift = Math.abs(shift);
  }

  // Volume — incoming delta adds, floor at 0.
  const volumeDelta = typeof delta.volumeDelta === 'number' ? delta.volumeDelta : 0;
  const newVolume = Math.max(0, belief.volume + volumeDelta);

  // Volatility — EWMA on max-logit-shift this scene.
  const newVolatility = MARKET_VOLATILITY_BETA * belief.volatility
    + (1 - MARKET_VOLATILITY_BETA) * maxAbsShift;

  const updatedBelief: Belief = {
    logits: newLogits,
    volume: newVolume,
    volatility: newVolatility,
    lastTouchedScene: sceneId,
  };

  // ThreadLog node — prose-grade event record with update snapshot.
  const nodeId = opts?.logNodeId ?? `${thread.id}:${sceneId}`;
  const logNode: ThreadLogNode = {
    id: nodeId,
    type: delta.logType ?? 'pulse',
    content: delta.rationale ?? '',
    sceneId,
    updates: (delta.updates ?? []).map((u) => ({
      outcome: u.outcome,
      evidence: clampEvidence(u.evidence),
    })),
    volumeDelta,
    ...(addedOutcomes.length > 0 ? { addedOutcomes } : {}),
  };

  const nextLog: ThreadLog = {
    nodes: { ...thread.threadLog.nodes, [nodeId]: logNode },
    edges: thread.threadLog.edges.slice(),
  };

  // Chain this node to the previous log entry if one exists — preserves the
  // "co-occurs" linkage used by the thread-graph renderer.
  const priorIds = Object.keys(thread.threadLog.nodes);
  if (priorIds.length > 0 && !thread.threadLog.nodes[nodeId]) {
    const prevId = priorIds[priorIds.length - 1];
    nextLog.edges.push({ from: prevId, to: nodeId, relation: 'co_occurs' });
  }

  // If outcomes expanded, also extend any *other* agents' beliefs so all
  // belief vectors keep matching the canonical outcome list length. Phase 1
  // only has narrator; Phase 5 per-character beliefs will already fit here.
  const nextBeliefs: Thread['beliefs'] = { ...thread.beliefs, [NARRATOR_AGENT_ID]: updatedBelief };
  if (addedOutcomes.length > 0) {
    for (const [agentId, agentBelief] of Object.entries(nextBeliefs)) {
      if (agentId === NARRATOR_AGENT_ID) continue;
      if (agentBelief.logits.length < expandedOutcomes.length) {
        nextBeliefs[agentId] = {
          ...agentBelief,
          logits: [
            ...agentBelief.logits,
            ...new Array(expandedOutcomes.length - agentBelief.logits.length).fill(0),
          ],
        };
      }
    }
  }

  const next: Thread = {
    ...thread,
    outcomes: expandedOutcomes,
    beliefs: nextBeliefs,
    threadLog: nextLog,
  };

  // Closure — margin condition AND committal logType (payoff or twist with
  // strong evidence). Keeps drift-based pseudoclose from firing. An
  // outcome-expansion event on the same delta cannot close the thread; the
  // added outcome starts at logit=0 and hasn't earned the margin yet.
  //
  // Meaningful-resolution rule: τ_close scales with the thread's accumulated
  // volume. Threads that the story has paid a lot of attention to need a
  // proportionally more decisive finish — otherwise a high-volume "will the
  // kingdom fall?" thread could collapse on the same evidence as a one-scene
  // side question. Scaling is sublinear (log) so small threads close easily
  // and giant threads require genuine weight.
  const committal = delta.logType === 'payoff' || delta.logType === 'twist';
  const peakEvidence = Math.max(0, ...(delta.updates ?? []).map((u) => Math.abs(clampEvidence(u.evidence))));
  if (!thread.closedAt && committal && peakEvidence >= 3 && addedOutcomes.length === 0) {
    const { topIdx, margin } = getMarketMargin(next);
    // Volume ratio relative to opening volume. At opening, ratio=1, no
    // boost — threads close at τ_base. As attention accumulates, log of the
    // ratio adds a sublinear premium so big threads need proportionally more.
    const volumeRatio = Math.max(1, updatedBelief.volume / MARKET_OPENING_VOLUME);
    const tauEffective = MARKET_TAU_CLOSE * (1 + Math.log(volumeRatio) / 3);
    if (margin >= tauEffective) {
      next.closedAt = sceneId;
      next.closeOutcome = topIdx;
      next.resolutionQuality = computeResolutionQuality({
        peakEvidence,
        margin,
        tauEffective,
        volume: updatedBelief.volume,
        logits: updatedBelief.logits,
      });
    }
  }

  return next;
}

/** Resolution quality ∈ [0, 1] — how earned the closure feels.
 *
 *  Four factors, each in [0, 1], combined as a geometric mean so a weak
 *  showing on any axis drags the whole score down:
 *
 *    - evidenceScore: peak |evidence| at close / max evidence (4)
 *    - marginScore: how far past the scaled τ the margin sits
 *    - volumeScore: how much attention the thread earned (saturates ~5×opening)
 *    - concentrationScore: 1 - normalized entropy (how decisively one outcome
 *                          dominates at close)
 */
function computeResolutionQuality(args: {
  peakEvidence: number;
  margin: number;
  tauEffective: number;
  volume: number;
  logits: number[];
}): number {
  const evidenceScore = Math.min(1, args.peakEvidence / 4);
  const marginExcess = Math.max(0, args.margin - args.tauEffective);
  const marginScore = Math.min(1, marginExcess / args.tauEffective + 0.5); // 0.5 at exact threshold, 1.0 at 1.5× threshold
  const volumeScore = Math.min(1, args.volume / (MARKET_OPENING_VOLUME * 5));
  const probs = softmax(args.logits);
  const concentrationScore = 1 - normalizedEntropy(probs);
  const product = evidenceScore * marginScore * volumeScore * concentrationScore;
  const quality = Math.pow(Math.max(1e-6, product), 0.25); // geometric mean
  return Math.round(quality * 100) / 100;
}

/** Apply volume decay to a belief for a scene it did NOT receive evidence in.
 *  Volatility also decays toward 0 naturally via the EWMA (incoming shift=0). */
export function decayUntouchedBelief(belief: Belief): Belief {
  return {
    ...belief,
    volume: belief.volume * MARKET_VOLUME_DECAY,
    volatility: MARKET_VOLATILITY_BETA * belief.volatility,
  };
}

/** Decay every narrator belief for a thread the scene didn't touch. Returns a
 *  modified threads map. Threads touched this scene are passed through
 *  unchanged — applyThreadDelta handles their bookkeeping. */
export function decayUntouchedBeliefsForScene(
  threads: Record<string, Thread>,
  touchedThreadIds: Set<string>,
): Record<string, Thread> {
  const out: Record<string, Thread> = {};
  for (const [id, t] of Object.entries(threads)) {
    if (touchedThreadIds.has(id)) {
      out[id] = t;
      continue;
    }
    const belief = t.beliefs[NARRATOR_AGENT_ID];
    if (!belief) {
      out[id] = t;
      continue;
    }
    out[id] = {
      ...t,
      beliefs: { ...t.beliefs, [NARRATOR_AGENT_ID]: decayUntouchedBelief(belief) },
    };
  }
  return out;
}
