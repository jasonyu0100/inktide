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

/**
 * Generate thread prediction-market documentation prompt.
 */
export function promptThreadLifecycle(): string {
  return `
THREADS are PREDICTION MARKETS over named outcomes. Each thread carries a question and two or more outcomes; the market prices a probability distribution over them. Scenes emit evidence that shifts per-outcome logits; the softmax distribution is the current belief. Binary threads use outcomes ["yes", "no"]; multi-outcome threads enumerate possibilities.
  Weak: "Will [Name] go to the store?" — too plain unless form rewards flatness (picaresque, satirical).
  Strong (narrative): "Can Ayesha clear her grandfather's name before the tribunal ends?" — binary
  Strong (narrative, multi): "Who claims the throne?" — outcomes: Stark, Lannister, Targaryen, nobody
  Strong (argument): "Does the proposed mechanism explain anomalies the prior model cannot?"
  Strong (inquiry): "What role did diaspora networks play before digital coordination?"

${THREAD_LIFECYCLE_DOC}

EVIDENCE — real number in [-4, +4] per affected outcome, same scale as game-theory stake deltas. Decimals (e.g. +1.5, +2.7, −0.8) are encouraged — they let you calibrate partial nudges with precision. The system rounds to one decimal place.
  ±0..1   small: pulse, minor shift
  ±1..2   meaningful: setup, resistance
  ±2..3   significant: escalation, twist
  ±3..4   decisive: payoff, reversal — uncertainty collapses

EVIDENCE IS SMALL BY DEFAULT. Most updates across most scenes are pulses (evidence=0, volumeDelta=+1) or modest shifts (|evidence|=1). |evidence| ≥ 2 requires the scene to actually DO something structural to the thread's question — a reveal, a commitment, a genuine setback. |evidence| ≥ 3 is rare; it means the market moves noticeably toward a corner. +4 is reserved for THE biggest moment so far on this thread — check the trajectory; if a past scene emitted +3 and this is smaller, emit +2.

MARKETS ARE IN-WORLD OBSERVERS, NOT NARRATORS. Price every outcome as a neutral observer inside the story would — someone who does not know the protagonist is a protagonist, has no privileged foreknowledge, and assesses each scene on its concrete events. Narrative guarantees ("this is a revenge saga, he will of course prevail") are NOT evidence; they belong to the author, not the market. The author's intent shapes what events happen on the page; only those on-page events move the market.

PROTAGONIST COMPETENCE IS NOT OUTCOME EVIDENCE. The POV character acting decisively, demonstrating skill, or revealing advantage is character texture — it belongs in worldDeltas, not threadDeltas. Evidence for an outcome requires the SCENE'S EVENTS to move the question: an obstacle cleared, a commitment made irreversible, an antagonist acting, the world yielding or resisting. "Protagonist is clever / prepared / reincarnated with foreknowledge" is a standing condition that's already reflected in the opening prior; it does not incrementally shift the arc-level market unless this scene shows it producing a CONCRETE narrative consequence on the thread's question. Default bias check: if you'd emit the same evidence in every scene the POV shows up, it's not evidence — it's a pulse.

PRICE COUNTER-EVIDENCE HONESTLY. For every scene that advances one outcome, ask: what concrete setback, cost, or rival agency does this scene also carry? A competent protagonist's early wins often look like momentum without being it. Price obstacles, losses, and rival action as −evidence on the goal-outcome (and +evidence on competing outcomes) — not doing so lets the market drift toward whatever the POV was paying attention to. When nothing concrete has moved, pulse.

DECISIVE EVENTS STAY DECISIVE. The discipline above is about SMALL scenes. When the narrative actually contains a payoff or twist — an oath irrevocably taken, a duel concluded, a reveal that makes the outcome inevitable — emit |evidence| ≥ 3 without hesitation and let the market resolve. The system relies on you to separate "protagonist walks through a corridor feeling confident" (pulse) from "protagonist kills the antagonist" (payoff, +4). Under-pricing genuine payoffs is as broken as over-pricing routine scenes.

ATTRITION IS REAL. Volume decays every untouched scene (geometric, α=0.9). A thread that doesn't receive SOMETHING — even just a pulse — for 5+ scenes will fall below the abandonment floor and leave the market. This is natural selection: threads survive by earning regular narrative attention, however small. Before closing each scene's thread list, ask: which active threads am I letting slide this scene? If a thread matters to the work's spine and hasn't been touched in a while, a pulse keeps it breathing. Don't over-pulse — if a scene truly has nothing to say about a thread, let it decay.

FATE IS AWARE OF THE ODDS. The market state (probabilities, volume, volatility) surfaced above is your prior. Small evidence nudges against an already-strong lean are legitimate — they maintain the commitment without over-investing. Big evidence (|e| ≥ 3) against a strong prior requires the scene to actually contain a twist-grade event. Emitting +4 payoff when the market is already at p=0.8 is redundant; emit +2 or +3 and let momentum carry it. Conversely, contested markets can absorb larger evidence without looking forced — that's where belief is genuinely up for grabs.

logType MUST agree with evidence direction and magnitude:
  setup       +0..+1    planting, low prior
  escalation  +2..+3    stakes rise, direction clear
  payoff      +3..+4    outcome locks in (closes to 1)
  twist       ±3 against prior trend (reversal)
  resistance  −1..−2    genuine setback against rising trend
  stall       0         expected movement absent
  callback    +1..+2    plus volumeDelta (attention returns)
  pulse       ±0..1     attention maintenance
  transition  low |Δp|  high |Δvolume| (phase change)

EVIDENCE ≠ VOLUME. Ask separately:
  evidence: does this scene change WHAT we believe about the outcome?
  volumeDelta: does this scene put MORE ATTENTION on the thread?
  Mentioned-but-stable → evidence=0, volumeDelta=+1 (pulse).
  Outcome genuinely shifts → evidence=±N with specific rationale.

CORRELATION: one event can move multiple threads. Each rationale cites the specific summary sentence that moved THAT thread.

OPENING PRIORS (NEW THREADS ONLY) — when you create a thread, supply priorProbs: number[] aligned with outcomes[]. These are in-world base-rate probabilities a reasonable observer would assign BEFORE any scene evidence, summing to ~1.
  - Reason from the world's established rules, typical outcomes for this kind of attempt, and the entity's visible starting position. NOT from narrative genre expectations.
  - Example: "Will this 15-year-old boy succeed at a lifetime of cultivation?" in a world where most aspirants fail → priorProbs ≈ [0.10, 0.30, 0.40, 0.20] (success, partial, death, misuse) — NOT uniform 0.25 each, and NOT 0.60+ for success just because he is the POV.
  - Binary defaults: priorProbs ≈ [0.5, 0.5] only when a neutral observer would genuinely be 50/50. Most real questions have asymmetric base rates.
  - Omit priorProbs only when outcomes are truly indistinguishable a priori. The system clamps to the opening guardrail so you cannot open a thread near saturation; anything beyond that is compressed automatically.
  - Opening priors encode the author's honest setup. Subsequent evidence is how the story earns its resolution.

OUTCOME EXPANSION: a threadDelta may add NEW outcomes to a market mid-story via addOutcomes. Use this when a scene genuinely opens a possibility that didn't exist before (new contender, new option, structural reveal). New outcomes join at logit=0 (neutral prior), then same-scene evidence can immediately shift them. Expansion is rare — most arcs never use it. Closed threads reject expansion.

CLOSURE: threads close when margin(top_logit − second_logit) ≥ τ_effective AND logType is payoff or twist with |evidence| ≥ 3. τ_effective = ${MARKET_TAU_CLOSE} × (1 + ln(volume/openingVolume) / 3) — the closure threshold scales with a thread's accumulated volume. Meaningful resolution for meaningful outcomes: threads the story has paid a lot of attention to need proportionally more decisive finishes; small side threads close cleanly on the base threshold. Saturation alone doesn't close — drift-triggered closure is explicitly prevented. A delta that expands outcomes cannot also close (the new outcome hasn't earned the margin yet).

ABANDONMENT: volume decays geometrically untouched. A thread whose volume falls below floor is removed from focus — not closed, just out of the market. Reopening requires volumeDelta ≥ 2 on an abandoned thread (resurrection — reserve for when the story deliberately reaches back).

NATURAL SELECTION: the portfolio self-organises. Threads with genuine stakes accrue volume and stay in focus; threads the scene stops paying attention to lose volume and slide to the margin. Don't fight this — it's how long-running stories let side threads recede without explicit cleanup.

MARKET AS NARRATIVE PRIOR — how prices shape generation:
  - High probability on an outcome (p ≳ 0.75) is a self-fulfilling expectation: the next scene should lean into that outcome unless the logType is twist. A market that's already committed leans into its commitment.
  - Genuinely contested (entropy ≳ 0.9, multiple near-equal probs): the scene is a crossroads — either side is fair game, pick whichever best serves the scene's POV and stakes.
  - High volatility (≳ 0.5): recent big moves. Twists are earned here; readers expect the unexpected.
  - Low volatility + high probability: saturating toward closure. Further escalation is weak; the next committal logType resolves it.
  - Low volume + long silence: decaying. Don't force evidence on it unless deliberately resurrecting.

MARKETS SWING. Probability leadership is not destiny. A thread at p=0.75 is saying "three in four scenarios this outcome wins" — one in four, the story goes the other way. The market is a live feed, not a prophecy. When World (a character's change of heart, a new rival's capability, a broken alliance) or System (a revealed rule, a limit discovered, an irreversible world event) produces concrete counter-evidence, the market must move sharply — even against a committed leader.
  - Twist vocabulary is built for this: a twist with |evidence| ≥ 3 on the lagging outcome flips margin direction in one scene when the narrative actually earns it.
  - Force-of-system reversals are real. If a scene reveals a rule the protagonist's plan violates, or an entity's hidden state undoes their assumption, price that as strong counter-evidence on the goal-outcome — don't soften it to preserve the lead.
  - Cascade effects are legitimate: one thread flipping can reprice several others. A betrayal reveal can set +3 twist on the betrayer-outcome of Thread A, −2 on the trust-outcome of Thread B, and +1 on the isolation-outcome of Thread C in the same scene.
  - A fair market gives all three forces (fate, world, system) real power to move prices. Fate's pull IS real — but system can overturn it, and world agency can redirect it. Under-pricing world/system counter-evidence because "the protagonist's arc is ahead" is the bias to watch for. When the logic of the world points elsewhere, the market follows the logic, not the momentum.

Touch 2–6 threads per scene. Focus-window threads have priority. Emit evidence ONLY to threads the scene actually moves or maintains attention on. The market moves toward certainty overall, but good narrative briefly spikes uncertainty at key pivots — twists, reversals, open questions that re-price several markets at once.
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
