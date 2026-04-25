/**
 * Shared proposition-extraction rules — text block (used in both system and
 * user prompt contexts; kept plain text so it works in either).
 *
 * Used by scenes/plan.ts (forward: plan beats from deltas) and scenes/analyze.ts
 * (reverse: annotate written chunks with beats). Density bands, register rules,
 * type vocabulary, and canonical examples are identical across both uses and
 * live here as a single source of truth.
 */

export const PROMPT_PROPOSITIONS = `PROPOSITIONS — KEY FACTS established by the beat. Every atomic claim = one proposition; do not summarise multiple claims into one.

DENSITY (per 100-word beat, by register):
- light fiction (atmospheric, children's lit) — 1-2
- standard fiction (dialogue, action) — 2-4
- dense fiction (world-building, cultivation, braided essay-fiction) — 4-6
- lyric / fabulist / mythic (image, atmosphere, figurative claim IS world-claim here; do not strip as decoration) — 4-10
- technical / academic (exhaustive but capped) — 8-15

REGISTER RULES:
- DRAMATIC-REALIST (Alice in Wonderland, Harry Potter, commercial/literary-realist): extract events, states, beliefs/goals, world rules. Skip pure textural description.
- LYRIC / FABULIST / MAGICAL-REALIST / MYTHIC (García Márquez, Can Xue, Borges, Morrison, Calvino, oral epic): image / atmosphere / figurative claims extract as propositions alongside the usual events/states/rules.
- TECHNICAL / ACADEMIC: capture EVERY formula, numerical value, definition, comparison, cited evidence, named entity/method, cause-effect, constraint, and claim about what something does or is. Cap at 15.

TYPE LABELS (required):
- fiction (dramatic-realist): state, belief, relationship, event, rule, secret, motivation.
- fiction (lyric / fabulist / mythic): image, atmosphere, figurative_rule, invocation, refrain (plus the dramatic-realist set).
- non-fiction: claim, definition, formula, evidence, parameter, mechanism, comparison, method, constraint, example, citation, counterargument.

EXAMPLES:
- {"content": "Alice falls down a rabbit hole", "type": "event"}
- {"content": "The White Rabbit wears a waistcoat", "type": "state"}
- {"content": "The Cheshire Cat can disappear", "type": "rule"}
- {"content": "In Macondo, it rains yellow flowers when a patriarch dies", "type": "figurative_rule"}
- {"content": "The river at the village edge runs uphill on the night of the feast", "type": "image"}
- {"content": "The hero's name is called three times before the council answers", "type": "refrain"}
- {"content": "F = Σ_t v_t · D_KL(p_t⁺ ‖ p_t⁻)", "type": "formula"}
- {"content": "F represents Fate — attention-weighted Kullback–Leibler divergence from prior to posterior belief across every market the scene touched; one summation, no tuning constants", "type": "definition"}
- {"content": "W = ΔN_c + √ΔE_c — entity transformation across characters, locations, artifacts", "type": "definition"}
- {"content": "Published works score 85-95", "type": "evidence"}

INVALID: craft goals, pacing instructions, meta-commentary.`;
