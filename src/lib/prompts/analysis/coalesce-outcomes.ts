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
  const threadsXml = threads
    .map((t, i) => `    <thread index="${i + 1}" description="${t.description.replace(/"/g, '&quot;')}">
      <outcomes>${JSON.stringify(t.outcomes)}</outcomes>
    </thread>`)
    .join('\n');

  return `<inputs>
  <threads hint="Each thread is a prediction market with outcomes extracted independently from multiple scenes. The outcomes often fragment.">
${threadsXml}
  </threads>
</inputs>

<instructions>
  <task>Coalesce each thread's outcome set into a small, mutually-exclusive canonical set, then map every input variant to its canonical form.</task>

  <rules>
    <rule index="1">"canonical" is the final, deduplicated set of 2-5 outcomes. Each canonical outcome is a SHORT, CONCRETE label (2-6 words) that names a distinct future. Avoid long prose sentences — "succeeds" beats "Fang Yuan successfully manipulates his past to rewrite his future".</rule>
    <rule index="2">"merges" maps EVERY input variant to a canonical form. Every input outcome must appear as a key. If a variant is already canonical, map it to itself.</rule>
    <rule index="3">Preserve distinct meanings. "succeeds at X" and "succeeds at Y" are different outcomes if X ≠ Y. "fails" and "partial success" are different. "Harry wins" and "Harry wins but loses Ginny" are different outcomes IF the distinction matters to the narrative; fold them if they don't.</rule>
    <rule index="4">Prefer 2-3 canonical outcomes for binary-shaped questions. Multi-outcome markets can carry 4-5 if the possibilities are genuinely distinct contenders.</rule>
    <rule index="5">DO NOT invent outcomes that weren't in the input. The canonical set must be a coalesced form of the given variants, not new possibilities.</rule>
    <rule index="6">KEEP outcome labels SHORT and FACTUAL. Bad: "Fang Yuan successfully manipulates his past to rewrite his future". Good: "succeeds". Canonical labels are operational identifiers, not prose.</rule>
    <rule index="7">When two variants differ only in verbosity ("succeeds" vs "succeeds in rewriting his future"), pick the shorter as canonical and merge the longer into it.</rule>
    <rule index="8">When two variants describe the same outcome with different emphasis ("repeats mistakes" + "fails and repeats past mistakes" + "fails"), merge all into a single canonical ("fails" usually wins for brevity).</rule>
    <rule index="9">If an input outcome is truly distinct (e.g. "pyrrhic victory" vs "succeeds" — winning with significant cost), keep it separate.</rule>
    <rule index="10">Coalescing MUST NOT inflate the starting state. The canonical set is a projection of the existing outcome space, not a new market. When variants merge, downstream the evidence applied to each variant is combined using the STRONGEST single signal (max absolute magnitude) within any one scene — never summed — so overlapping ways of saying the same outcome don't compound into an inflated probability. Choose canonical labels that reflect this.</rule>
    <rule index="11" name="MECE">Canonical set must be (a) DISJOINT (no two can both be true; ✗ "instability persists" + "new major conflict" co-occur → re-partition to "no conflict / one / multiple") and (b) EXHAUSTIVE (covers every live future). You MAY re-partition the axis during coalescing and pick canonical labels that don't match any input literally — every input variant still maps to exactly one canonical via merges.</rule>
    <rule index="12" name="neutral-labels">Canonicals name observable future-states, not slogans. ✓ "US settles into multipolar order"; ✗ "US reasserts pre-eminence" when the source argued the unipolar moment is over. A variant whose name encodes a position the source rejected does NOT survive as a canonical — map it into the nearest neutral canonical.</rule>
    <rule index="13" name="reject-trivial">Labels containing "complex", "significant", "meaningful", "important", "notable", "has effect", "matters", "turns out to be important" without concrete referent content are trivially-true. Re-partition into concrete alternatives where the inputs allow; otherwise prefer a specific "other" residual over a meta-canonical.</rule>
  </rules>

  <example>
    <input>
THREAD 1: "Can Fang Yuan rewrite his future?"
  outcomes: ["succeeds", "succeeds in rewriting his future", "Fang Yuan successfully manipulates his past", "fails", "fails and repeats past mistakes", "repeats mistakes", "achieves a different, unforeseen outcome", "Fang Yuan finds a new path", "Fang Yuan is constrained by his past"]
    </input>
    <output>
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
    </output>
  </example>
</instructions>

<output-format>
Return ONLY the JSON object:
{
  "threads": {
    "<exact thread description>": {
      "canonical": ["canonical outcome 1", "canonical outcome 2", ...],
      "merges": { "variant exactly as given": "canonical form it maps to", ... }
    },
    ...
  }
}
</output-format>`;
}
