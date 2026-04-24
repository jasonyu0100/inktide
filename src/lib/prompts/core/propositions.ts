/**
 * Shared proposition-extraction rules.
 *
 * Used by scenes/plan.ts (forward: plan beats from deltas) and scenes/analyze.ts
 * (reverse: annotate written chunks with beats). Density bands, register rules,
 * type vocabulary, and canonical examples are identical across both uses and
 * live here as a single source of truth.
 */

export const PROMPT_PROPOSITIONS = `PROPOSITIONS are KEY FACTS established by the beat. Every atomic claim = one proposition; do not summarise multiple claims into one.

DENSITY per ~100-word beat, by register:
- Light fiction (atmospheric, children's lit): 1-2
- Standard fiction (dialogue, action): 2-4
- Dense fiction (world-building, cultivation, braided essay-fiction): 4-6
- Lyric / fabulist / magical-realist / mythic / oral-epic: 4-10 — image, atmosphere, figurative claim IS world-claim here; do not strip as decoration
- Technical / academic / scholarly: 8-15 MAX (exhaustive but capped)

REGISTER RULES:
- Dramatic-realist fiction (Alice in Wonderland, Harry Potter, commercial/literary-realist): extract events, states, beliefs/goals, world rules. Skip pure textural description.
- Lyric / fabulist / magical-realist / mythic (García Márquez, Can Xue, Borges, Morrison, Calvino, oral epic): image / atmosphere / figurative claims extract as propositions alongside the usual events/states/rules.
- Technical / academic: capture EVERY formula, numerical value, definition, comparison, cited evidence, named entity/method, cause-effect, constraint, and claim about what something does or is. Cap at 15.

TYPE labels (required on every proposition):
- Fiction (dramatic-realist): state, belief, relationship, event, rule, secret, motivation
- Fiction (lyric/fabulist/mythic): image, atmosphere, figurative_rule, invocation, refrain (plus the dramatic-realist set)
- Non-fiction: claim, definition, formula, evidence, parameter, mechanism, comparison, method, constraint, example, citation, counterargument

EXAMPLES

Fiction (dramatic-realist):
• {"content": "Alice falls down a rabbit hole", "type": "event"}
• {"content": "The White Rabbit wears a waistcoat", "type": "state"}
• {"content": "The Cheshire Cat can disappear", "type": "rule"}

Fiction (lyric / fabulist / mythic):
• {"content": "In Macondo, it rains yellow flowers when a patriarch dies", "type": "figurative_rule"}
• {"content": "The river at the village edge runs uphill on the night of the feast", "type": "image"}
• {"content": "The hero's name is called three times before the council answers", "type": "refrain"}

Non-fiction (exhaustive):
• {"content": "F = Σ_t v_t · D_KL(p_t⁺ ‖ p_t⁻)", "type": "formula"}
• {"content": "F represents Fate — attention-weighted Kullback–Leibler divergence from prior to posterior belief across every market the scene touched; one summation, no tuning constants", "type": "definition"}
• {"content": "W = ΔN_c + √ΔE_c — entity transformation across characters, locations, artifacts", "type": "definition"}
• {"content": "Published works score 85-95", "type": "evidence"}

INVALID: craft goals, pacing instructions, meta-commentary.`;
