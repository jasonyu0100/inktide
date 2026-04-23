/**
 * Outcome Coalescing Prompt
 *
 * Phase 3c — per-thread outcome canonicalisation. Parallel extraction across
 * scenes often produces outcomes like:
 *   ["succeeds", "succeeds in rewriting his future", "Fang Yuan successfully manipulates his past"]
 *   ["fails", "fails and repeats past mistakes", "repeats mistakes", "Fang Yuan is constrained by his past"]
 *
 * These are the SAME outcomes restated — they fragment the market. The
 * coalescing step asks the LLM to collapse each thread's outcome list to a
 * small, distinct set (typically 2–5), returning a canonical list plus a
 * merge map from every variant to its canonical form. Downstream the merge
 * map is applied to every threadDelta's updates[].outcome + addOutcomes so
 * all evidence stacks on the correct canonical label.
 */

export const COALESCE_OUTCOMES_SYSTEM = `You coalesce fragmented prediction-market outcomes. Each thread has accumulated multiple outcome labels extracted independently from different scenes. Collapse each thread's outcome list to a small, mutually-exclusive set (2-5 canonical labels), then map every variant to its canonical form. Preserve genuine distinctions; merge only when two labels are the same future restated. Return only valid JSON.`;

export function buildCoalesceOutcomesPrompt(
  threads: { description: string; outcomes: string[] }[],
): string {
  const threadBlock = threads
    .map((t, i) => `THREAD ${i + 1}: "${t.description}"
  outcomes: ${JSON.stringify(t.outcomes)}`)
    .join('\n\n');

  return `Each thread below is a prediction market with outcomes extracted independently from multiple scenes. The outcomes often fragment — the same outcome restated several ways, or sub-variants that should collapse to one canonical label. Coalesce each thread's outcome set.

${threadBlock}

═══ OUTPUT ═══

Return JSON:
{
  "threads": {
    "<exact thread description>": {
      "canonical": ["canonical outcome 1", "canonical outcome 2", ...],
      "merges": { "variant exactly as given": "canonical form it maps to", ... }
    },
    ...
  }
}

RULES:
1. "canonical" is the final, deduplicated set of 2-5 outcomes. Each canonical outcome is a SHORT, CONCRETE label (2-6 words) that names a distinct future. Avoid long prose sentences — "succeeds" beats "Fang Yuan successfully manipulates his past to rewrite his future".
2. "merges" maps EVERY input variant to a canonical form. Every input outcome must appear as a key. If a variant is already canonical, map it to itself.
3. Preserve distinct meanings. "succeeds at X" and "succeeds at Y" are different outcomes if X ≠ Y. "fails" and "partial success" are different. "Harry wins" and "Harry wins but loses Ginny" are different outcomes IF the distinction matters to the narrative; fold them if they don't.
4. Prefer 2-3 canonical outcomes for binary-shaped questions. Multi-outcome markets can carry 4-5 if the possibilities are genuinely distinct contenders.
5. DO NOT invent outcomes that weren't in the input. The canonical set must be a coalesced form of the given variants, not new possibilities.
6. KEEP outcome labels SHORT and FACTUAL. Bad: "Fang Yuan successfully manipulates his past to rewrite his future". Good: "succeeds". Bad: "achieves a different, unforeseen outcome". Good: "new path". Canonical labels are operational identifiers, not prose.
7. When two variants differ only in verbosity ("succeeds" vs "succeeds in rewriting his future"), pick the shorter as canonical and merge the longer into it.
8. When two variants describe the same outcome with different emphasis ("repeats mistakes" + "fails and repeats past mistakes" + "fails"), merge all into a single canonical ("fails" usually wins for brevity).
9. If an input outcome is truly distinct (e.g. "pyrrhic victory" vs "succeeds" — winning with significant cost), keep it separate.
10. Coalescing MUST NOT inflate the starting state. The canonical set is a projection of the existing outcome space, not a new market. When variants merge, downstream the evidence applied to each variant is combined using the STRONGEST single signal (max absolute magnitude) within any one scene — never summed — so overlapping ways of saying the same outcome don't compound into an inflated probability. Choose canonical labels that reflect this: fewer, cleaner labels so a single delta that mentioned two variants collapses to one signal at a sensible magnitude, not a stack.

═══ EXAMPLE ═══

Input:
THREAD 1: "Can Fang Yuan rewrite his future?"
  outcomes: ["succeeds", "succeeds in rewriting his future", "Fang Yuan successfully manipulates his past", "fails", "fails and repeats past mistakes", "repeats mistakes", "achieves a different, unforeseen outcome", "Fang Yuan finds a new path", "Fang Yuan is constrained by his past"]

Output:
{
  "threads": {
    "Can Fang Yuan rewrite his future?": {
      "canonical": ["succeeds", "fails", "new path"],
      "merges": {
        "succeeds": "succeeds",
        "succeeds in rewriting his future": "succeeds",
        "Fang Yuan successfully manipulates his past": "succeeds",
        "fails": "fails",
        "fails and repeats past mistakes": "fails",
        "repeats mistakes": "fails",
        "Fang Yuan is constrained by his past": "fails",
        "achieves a different, unforeseen outcome": "new path",
        "Fang Yuan finds a new path": "new path"
      }
    }
  }
}

Return ONLY the JSON object.`;
}
