/**
 * Thread Prediction-Market Prompts and Helper Functions
 *
 * CONCEPTUAL MODEL: Threads are PREDICTION MARKETS over named outcomes.
 * Each scene's events emit evidence that shifts per-outcome logits; the
 * softmax distribution represents the narrator's current belief. Fate
 * falls out of information gain across the scene trajectory.
 *
 * The LLM never emits probabilities directly — it emits integer evidence
 * in [-4, +4] (same grammar as game-theory stake deltas) plus a log-type
 * from the 9 primitives. The math handles log-odds conversion, saturation,
 * closure, and abandonment.
 */

import type { NarrativeState, Thread } from '@/types/narrative';
import { NARRATOR_AGENT_ID } from '@/types/narrative';
import { THREAD_LIFECYCLE_DOC } from '@/lib/ai/context';
import {
  ENTITY_LOG_CONTEXT_LIMIT,
  MARKET_NEAR_CLOSED_MIN,
  MARKET_TAU_CLOSE,
} from '@/lib/constants';
import {
  getMarketBelief,
  getMarketMargin,
  getMarketProbs,
  isNearClosed,
  isThreadAbandoned,
  isThreadClosed,
  normalizedEntropy,
  scenesSinceTouched,
} from '@/lib/narrative-utils';
import {
  classifyThreadCategory,
  computeRecentLogitEnergy,
  THREAD_CATEGORY_GUIDANCE,
  formatThreadGuidance,
} from '@/lib/thread-category';
import {
  PROMPT_MARKET_PRINCIPLES,
  PROMPT_PORTFOLIO_PRINCIPLES,
  PROMPT_MARKET_EVIDENCE_SCALE,
  PROMPT_MARKET_LOGTYPE_TABLE,
} from '../core/market-calibration';

/**
 * Generate thread prediction-market documentation prompt.
 */
export function promptThreadLifecycle(): string {
  return `
THREADS are PREDICTION MARKETS over named outcomes. Each thread is a question + 2+ outcomes; the market prices a distribution. Binary: ["yes", "no"]; multi-outcome enumerates possibilities.
  Weak: "Will [Name] go to the store?" (picaresque/satirical forms excepted).
  Strong (narrative): "Can Ayesha clear her grandfather's name before the tribunal ends?" — binary.
  Strong (multi): "Who claims the throne?" — Stark / Lannister / Targaryen / nobody.

${THREAD_LIFECYCLE_DOC}

${PROMPT_MARKET_PRINCIPLES}

${PROMPT_PORTFOLIO_PRINCIPLES}

${PROMPT_MARKET_EVIDENCE_SCALE}

${PROMPT_MARKET_LOGTYPE_TABLE}

EVIDENCE ≠ VOLUME. Evidence changes WHAT we believe; volumeDelta changes ATTENTION. Mentioned-but-stable → evidence=0, volumeDelta=+1. One event can move multiple threads; each rationale cites its driving sentence.

ATTRITION. Volume decays geometrically (α=0.9) on untouched scenes; 5+ scenes of silence drops a thread below the abandonment floor. Pulse the spine threads to keep them breathing; let trivial threads decay.

OPENING PRIORS (new threads only) — priorProbs: number[] aligned with outcomes[], summing to ~1, reasoned in-world NOT from genre expectations.
  - "Will this 15-year-old succeed at a lifetime of cultivation?" in a world where most fail → [0.10, 0.30, 0.40, 0.20] (success, partial, death, misuse) — NOT uniform, NOT POV-inflated.
  - Binary defaults [0.5, 0.5] only when genuinely symmetric. Omit when indistinguishable; the system clamps to the opening guardrail.

OUTCOME EXPANSION (rare) — addOutcomes when a scene genuinely opens a new possibility (new contender, structural reveal). Joins at logit=0; same-scene evidence can shift it. Closed threads reject expansion.

CLOSURE: margin(top − second) ≥ τ_effective AND logType payoff|twist AND |e| ≥ 3. τ_effective = ${MARKET_TAU_CLOSE} × (1 + ln(volume/opening)/3) — high-volume threads need proportionally more decisive finishes. Saturation alone doesn't close. A delta that expands outcomes cannot also close.

ABANDONMENT: volume below floor → out of market (not closed). Reopening requires volumeDelta ≥ 2 (resurrection).

MARKET AS NARRATIVE PRIOR — how current prices shape the next scene:
  - High p (≳ 0.75): lean into the leader unless logType is twist.
  - Contested (entropy ≳ 0.9): crossroads — either side fair game.
  - High volatility (≳ 0.5): twists are earned, readers expect them.
  - Low volatility + high p: saturating; next committal logType closes.
  - Low volume + long silence: decaying; don't force evidence unless resurrecting.

Touch 2–6 threads per scene; focus-window threads first. Emit evidence ONLY where the scene actually moves or maintains attention.
`;
}

/**
 * Build a prediction-market portfolio report for the LLM.
 * Surfaces current logits, probability distribution, volume, volatility, and
 * recency for each thread so generation sees where belief is contested and
 * where it's saturating.
 */
export function buildThreadHealthPrompt(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
): string {
  const allThreads = Object.values(narrative.threads);
  const closed = allThreads.filter(isThreadClosed);
  const abandoned = allThreads.filter(isThreadAbandoned);
  const active = allThreads.filter((t) => !isThreadClosed(t) && !isThreadAbandoned(t));

  if (allThreads.length === 0) return '';

  const totalArcs = Object.keys(narrative.arcs).length || 1;

  const lines: string[] = [
    `THREAD MARKETS — ${active.length} active, ${closed.length} closed, ${abandoned.length} abandoned, ${totalArcs} arcs elapsed`,
    '',
  ];

  // Sort active threads by volume descending — high-attention threads first.
  const sorted = active
    .map((t) => ({
      t,
      belief: getMarketBelief(t),
      probs: getMarketProbs(t),
      nearClosed: isNearClosed(t),
      silent: scenesSinceTouched(t, resolvedKeys, currentIndex),
    }))
    .sort((a, b) => (b.belief?.volume ?? 0) - (a.belief?.volume ?? 0));

  for (const { t, belief, probs, silent } of sorted) {
    const vol = belief?.volume ?? 0;
    const volatility = belief?.volatility ?? 0;
    const uncertainty = normalizedEntropy(probs);
    const { topIdx } = getMarketMargin(t);
    const topProb = probs[topIdx] ?? 0;
    const topOutcome = t.outcomes[topIdx] ?? '?';

    // Canonical category — same vocabulary the UI and narrativeContext use.
    // Drives self-fulfilling prophecy behaviour in aggregate while leaving
    // room for deliberate uncertainty spikes.
    const category = classifyThreadCategory(t, { scenesSinceTouch: silent });
    const energy = computeRecentLogitEnergy(t);
    const signal = formatThreadGuidance(THREAD_CATEGORY_GUIDANCE[category], topOutcome, topProb);

    lines.push(`"${t.description}" [${t.id}] — ${signal}`);
    const outcomeLines = t.outcomes.map((o, i) => {
      const p = probs[i] ?? 0;
      return `  • ${o}: ${(p * 100).toFixed(0)}%`;
    });
    lines.push(...outcomeLines);
    lines.push(`  vol=${vol.toFixed(1)}, volatility=${volatility.toFixed(2)}, energy=${energy.toFixed(2)}, uncertainty=${uncertainty.toFixed(2)}, silent=${silent === Infinity ? '∞' : silent}`);

    // Recent log nodes.
    const logNodes = Object.values(t.threadLog?.nodes ?? {});
    const recentNodes = logNodes.slice(-ENTITY_LOG_CONTEXT_LIMIT);
    if (recentNodes.length > 0) {
      lines.push(`  log: ${recentNodes.map((n) => `[${n.type}] ${n.content.slice(0, 60)}`).join(' | ')}`);
    }

    if (t.dependents.length > 0) {
      const depDescs = t.dependents.map((depId) => narrative.threads[depId]).filter(Boolean).map((dep) => `[${dep.id}]`);
      if (depDescs.length > 0) lines.push(`  ↔ Converges: ${depDescs.join(', ')}`);
    }
    lines.push('');
  }

  if (closed.length > 0) {
    lines.push(`Closed (${closed.length}): ${closed.map((t) => `[${t.id}] "${t.description.slice(0, 40)}" → ${t.outcomes[t.closeOutcome ?? 0] ?? '?'}`).join(' | ')}`);
    lines.push('');
  }
  if (abandoned.length > 0) {
    lines.push(`Abandoned (${abandoned.length}): ${abandoned.map((t) => `[${t.id}]`).join(' ')} — available for reopening via volumeDelta ≥ 2`);
  }

  return lines.join('\n');
}

/**
 * Extract irreversible closure events from scene history and format them as a
 * "SPENT" prompt section. Closed threads must not be restaged; saturating
 * threads are flagged so the LLM knows they're ready to close (and must not
 * be kept open via weak escalations).
 */
export function buildCompletedBeatsPrompt(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
): string {
  const allThreads = Object.values(narrative.threads);
  const closed = allThreads.filter(isThreadClosed);
  const saturating = allThreads.filter((t) => !isThreadClosed(t) && isNearClosed(t));

  if (closed.length === 0 && saturating.length === 0) return '';

  const lines: string[] = [
    'CLOSED + SATURATING MARKETS — these commitments are CASHED IN or READY TO CASH IN.',
    'Closed threads do NOT reopen via weak evidence. Saturating threads need payoff/twist, not another escalation.',
    '',
  ];

  for (const t of closed) {
    const winner = t.outcomes[t.closeOutcome ?? 0] ?? '(unknown)';
    lines.push(`[CLOSED: ${winner}] "${t.description.slice(0, 80)}" [${t.id}]`);
  }

  for (const t of saturating) {
    const { topIdx, margin } = getMarketMargin(t);
    const winner = t.outcomes[topIdx] ?? '?';
    const silent = scenesSinceTouched(t, resolvedKeys, currentIndex);
    const marginNote = margin >= MARKET_NEAR_CLOSED_MIN ? ` (margin=${margin.toFixed(2)} logit-units)` : '';
    lines.push(`[SATURATING → ${winner}] "${t.description.slice(0, 80)}" [${t.id}]${marginNote} silent=${silent === Infinity ? '∞' : silent}`);
  }

  return lines.join('\n');
}

/** Short-form market state rendering for a single thread — used in focus
 *  window blocks where we want a compact per-thread readout. */
export function renderThreadMarketLine(t: Thread): string {
  const belief = t.beliefs[NARRATOR_AGENT_ID];
  const probs = getMarketProbs(t);
  const vol = belief?.volume ?? 0;
  const top = probs.indexOf(Math.max(...probs));
  if (t.outcomes.length === 2 && t.outcomes[0] === 'yes' && t.outcomes[1] === 'no') {
    const p = probs[0] ?? 0;
    return `[${t.id}] "${t.description}" p(yes)=${p.toFixed(2)} vol=${vol.toFixed(1)}`;
  }
  const outList = t.outcomes.map((o, i) => `${o}=${(probs[i] ?? 0).toFixed(2)}`).join(' · ');
  return `[${t.id}] "${t.description}" { ${outList} } top=${t.outcomes[top]} vol=${vol.toFixed(1)}`;
}
