/**
 * Shared proposition-extraction rules — XML block injected into user prompts
 * (scene plan generation, beat analysis). Density bands, register rules,
 * type vocabulary, and canonical examples are identical across both uses and
 * live here as a single source of truth.
 */

export const PROMPT_PROPOSITIONS = `<propositions hint="KEY FACTS established by the beat. Every atomic claim = one proposition; do not summarise multiple claims into one. The source's own register sets the density and the right type vocabulary — read it from the prose, don't pick from a menu.">
  <density-per-100-word-beat hint="Match the source's claim density. Sparse atmospheric prose carries 1-2; ordinary narrative or essayistic paragraphs carry 2-4; dense world-building or braided argument carries 4-6; image-saturated or figurative-rule prose carries 4-10 (figurative claims ARE claims here, not decoration); exhaustive technical or formula-bearing prose caps at 15.">
    1-15 propositions per 100 words, set by the source's actual claim density.
  </density-per-100-word-beat>

  <what-counts>
    Extract every atomic claim the prose establishes: events, states, beliefs, relationships, rules, formulas, definitions, evidence, mechanisms, constraints, comparisons, citations, counterarguments. Image, atmosphere, and figurative claims count when the prose treats them as load-bearing — strip them only if they're pure textural decoration. Skip craft goals, pacing instructions, and meta-commentary about the writing itself.
  </what-counts>

  <type-labels required="true" hint="Pick the type that names what the claim is doing in this prose. Use whichever subset the source's register actually surfaces — don't force categories the prose doesn't speak. In simulation register, propositions are often rule statements (the rule set), parameter values (initial conditions or current values), agent decisions (an agent's chosen action under its decision rule), or model outputs (a rule-driven outcome the work registers).">
    state, belief, relationship, event, rule, secret, motivation, image, atmosphere, figurative_rule, invocation, refrain, claim, definition, formula, evidence, parameter, mechanism, comparison, method, constraint, example, citation, counterargument.
  </type-labels>

  <examples hint="Concrete shape only — your own examples must come from the source. Spans fiction, non-fiction, and simulation.">
    <example>{"content": "Ayesha enters the tribunal antechamber alone", "type": "event"}</example>
    <example>{"content": "The envoy wears the black sash of the third house", "type": "state"}</example>
    <example>{"content": "The bound spirit can pass through stone but not through salt", "type": "rule"}</example>
    <example>{"content": "Cross-region travel above the dampening threshold doubles infection rate", "type": "mechanism"}</example>
    <example>{"content": "In Macondo, it rains yellow flowers when a patriarch dies", "type": "figurative_rule"}</example>
    <example>{"content": "The river at the village edge runs uphill on the night of the feast", "type": "image"}</example>
    <example>{"content": "The traveller's name is called three times before the council answers", "type": "refrain"}</example>
    <example>{"content": "F = Σ_t v_t · D_KL(p_t⁺ ‖ p_t⁻)", "type": "formula"}</example>
    <example>{"content": "F represents Fate — attention-weighted Kullback–Leibler divergence from prior to posterior belief across every market the scene touched; one summation, no tuning constants", "type": "definition"}</example>
    <example>{"content": "W = ΔN_c + √ΔE_c — entity transformation across characters, locations, artifacts", "type": "definition"}</example>
    <example>{"content": "Published works score 85-95", "type": "evidence"}</example>
    <example>{"content": "Reinforcement delay = 6 turns when a province falls below 20% supply", "type": "parameter"}</example>
    <example>{"content": "Red Team commits its reserve to the southern axis on turn 14", "type": "event"}</example>
    <example>{"content": "Modelled R0 falls below 1.0 by week 9 under the contact-tracing regime", "type": "evidence"}</example>
    <example>{"content": "Had the Mughal succession passed to Dara Shikoh, the Deccan campaigns would have been suspended within two seasons", "type": "counterargument"}</example>
  </examples>

  <invalid>Craft goals, pacing instructions, meta-commentary.</invalid>
</propositions>`;
