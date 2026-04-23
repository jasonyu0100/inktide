/**
 * Fate Re-Extraction Prompt
 *
 * Phase 5 (finalization) — second-pass, summary-based re-scoring of prediction-
 * market evidence. The first pass (Phase 1 Structure) extracts threadDeltas
 * from each scene IN PARALLEL, so each chunk sees only its local prose and has
 * no knowledge of which outcome actually wins the market across the full story.
 *
 * Symptom: once the market diverges late-arc, probabilities never reverse —
 * the monotonic local accumulation has no way of knowing a twist or payoff is
 * about to land. Scenes that seeded the eventual winner were priced as pulses
 * because, locally, nothing appeared decisive.
 *
 * Fix: after reconciliation (canonical threads + coalesced outcomes), re-run
 * per-scene extraction using scene SUMMARIES (fast, cheap) together with the
 * full canonical market and its observed resolutions. The LLM re-emits this
 * scene's threadDeltas with lifecycle awareness — honest seeds for the
 * winning outcome, deflated misdirection, decisive evidence at resolution.
 */

import {
  PROMPT_MARKET_PRINCIPLES,
  PROMPT_MARKET_EVIDENCE_SCALE,
  PROMPT_MARKET_LOGTYPE_TABLE,
} from '../core/market-calibration';

export const FATE_REEXTRACT_SYSTEM = `You re-score prediction-market evidence for ONE scene with full knowledge of the story's actual arc — including which outcome each thread ultimately resolves to. The first pass scored each scene locally (blind to endings); your job is to refresh that scene's threadDeltas so the overall trajectory reflects the story's true shape. Return only valid JSON.`;

export type FateReextractThread = {
  description: string;
  outcomes: string[];
  /** Outcome with the largest net summed evidence across the full corpus.
   *  Treat as the observed winner — the resolution the story lands on. */
  observedWinner: string;
  /** Approximate scene index where the winning outcome's largest committal
   *  evidence fired (a payoff or twist). Useful for detecting whether the
   *  current scene is the resolution itself, pre-resolution, or aftermath. */
  resolutionSceneIndex?: number;
  /** Total volume the thread accumulated across the corpus — surfaces how
   *  much attention the story paid to it. High-volume threads deserve
   *  proportionally more decisive resolution evidence. */
  totalVolume?: number;
};

export type FateReextractPriorDelta = {
  threadDescription: string;
  logType: string;
  updates: { outcome: string; evidence: number }[];
  volumeDelta?: number;
  addOutcomes?: string[];
  rationale: string;
};

export function buildFateReextractPrompt(opts: {
  sceneIndex: number;
  totalScenes: number;
  sceneSummary: string;
  povName?: string;
  locationName?: string;
  canonicalThreads: FateReextractThread[];
  priorDeltas: FateReextractPriorDelta[];
}): string {
  const {
    sceneIndex,
    totalScenes,
    sceneSummary,
    povName,
    locationName,
    canonicalThreads,
    priorDeltas,
  } = opts;

  const position = (() => {
    const frac = totalScenes > 0 ? sceneIndex / Math.max(1, totalScenes - 1) : 0;
    if (frac <= 0.15) return 'opening';
    if (frac <= 0.40) return 'rising';
    if (frac <= 0.60) return 'midpoint';
    if (frac <= 0.85) return 'escalation';
    return 'resolution';
  })();

  const marketBlock = canonicalThreads.length === 0
    ? '(no canonical threads)'
    : canonicalThreads.map((t, i) => {
        const outcomesFmt = t.outcomes.map((o) => o === t.observedWinner ? `${o} [WINNER]` : o).join(', ');
        const resolveAt = typeof t.resolutionSceneIndex === 'number'
          ? ` — resolution fires around scene ${t.resolutionSceneIndex + 1}`
          : '';
        const volNote = typeof t.totalVolume === 'number' ? ` (total vol=${t.totalVolume.toFixed(1)})` : '';
        return `THREAD ${i + 1}: "${t.description}"
  outcomes: [${outcomesFmt}]${volNote}${resolveAt}`;
      }).join('\n\n');

  const priorBlock = priorDeltas.length === 0
    ? '(first pass emitted no threadDeltas for this scene)'
    : priorDeltas.map((d) => {
        const updFmt = (d.updates ?? []).map((u) => `${u.outcome}:${u.evidence >= 0 ? '+' : ''}${u.evidence}`).join(', ');
        return `- "${d.threadDescription}" [${d.logType}] { ${updFmt} } vol=${d.volumeDelta ?? 0}
    rationale: ${d.rationale}`;
      }).join('\n');

  return `═══ SCENE CONTEXT ═══
Position: ${position} (scene ${sceneIndex + 1} of ${totalScenes})
${povName ? `POV: ${povName}\n` : ''}${locationName ? `Location: ${locationName}\n` : ''}
SUMMARY:
${sceneSummary}

═══ CANONICAL MARKETS (full-story view) ═══
${marketBlock}

═══ FIRST-PASS EVIDENCE (local-only, may be mispriced) ═══
${priorBlock}

═══ TASK ═══

Re-emit threadDeltas for THIS SCENE using lifecycle awareness. The first pass didn't know which outcome would win each thread; you do. The market principles below are the universal discipline; the hindsight-specific rules after them apply this pass's extra context.

${PROMPT_MARKET_PRINCIPLES}

${PROMPT_MARKET_EVIDENCE_SCALE}

${PROMPT_MARKET_LOGTYPE_TABLE}

HINDSIGHT-SPECIFIC RULES (this pass, not the first):

1. SEEDS TOWARD THE WINNER. Scenes that set up, enable, or plant the eventual winning outcome deserve honest positive evidence — not pulses because "nothing decisive happened locally." A quiet setup scene that genuinely leans toward the winner should emit setup (+1) or small escalation (+1..+2), not evidence=0. Under-priced seeds are the main reason the first pass never reverses late.

2. MISDIRECTION DEFLATION. Scenes that locally LOOKED like they advanced a non-winning outcome should be priced conservatively in hindsight. Pulse or very small evidence; do NOT reward POV momentum that the arc contradicts.

3. RESOLUTION SCENES. If THIS scene is at or near the thread's resolution index, the resolving events deserve decisive evidence (|e| ≥ 3, logType payoff or twist). The first pass often under-prices these because the resolving event is structurally small but narratively huge.

4. TWISTS AGAINST LEADERS. If the scene reverses what earlier evidence suggested, score it as a twist (|e| ≥ 3 on the newly-favoured outcome). Don't soften to preserve the local lead.

5. PRESERVE VALID PRIOR DELTAS. If the first-pass delta was already lifecycle-consistent, keep it. Only rewrite where hindsight changes the read.

6. OUTCOMES MUST BE CANONICAL. Every update.outcome must match an entry from CANONICAL MARKETS verbatim.

7. THREADS NOT MOVED. If a scene doesn't meaningfully touch a thread, OMIT it — don't pad pulses.

═══ OUTPUT ═══

Return JSON with this exact shape:
{
  "threadDeltas": [
    {
      "threadDescription": "exact canonical description from CANONICAL MARKETS",
      "logType": "pulse|setup|escalation|payoff|twist|resistance|stall|callback|transition",
      "updates": [{"outcome": "exact canonical outcome", "evidence": -4..+4}],
      "volumeDelta": 0..3,
      "addOutcomes": ["optional — new outcome names if the scene structurally opens a possibility that's not in the market"],
      "rationale": "15-25 words grounded in the scene summary — the specific event that moved this thread"
    }
  ]
}

Return ONLY the JSON object. Do not touch worldDeltas, systemDeltas, entities, relationships, movements, or any other field — only threadDeltas are re-extracted here.`;
}
