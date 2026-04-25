/**
 * Shared proposition-extraction rules.
 *
 * Used by scenes/plan.ts (forward: plan beats from deltas) and scenes/analyze.ts
 * (reverse: annotate written chunks with beats). Density bands, register rules,
 * type vocabulary, and canonical examples are identical across both uses and
 * live here as a single source of truth.
 */

export const PROMPT_PROPOSITIONS = `<propositions hint="KEY FACTS established by the beat. Every atomic claim = one proposition; do not summarise multiple claims into one.">

  <density-per-100-word-beat by="register">
    <band register="light-fiction" range="1-2" hint="Atmospheric, children's lit."/>
    <band register="standard-fiction" range="2-4" hint="Dialogue, action."/>
    <band register="dense-fiction" range="4-6" hint="World-building, cultivation, braided essay-fiction."/>
    <band register="lyric-fabulist-mythic" range="4-10" hint="Image, atmosphere, figurative claim IS world-claim here; do not strip as decoration."/>
    <band register="technical-academic" range="8-15" hint="Exhaustive but capped."/>
  </density-per-100-word-beat>

  <register-rules>
    <rule register="dramatic-realist" hint="Alice in Wonderland, Harry Potter, commercial/literary-realist.">Extract events, states, beliefs/goals, world rules. Skip pure textural description.</rule>
    <rule register="lyric-fabulist-magical-realist-mythic" hint="García Márquez, Can Xue, Borges, Morrison, Calvino, oral epic.">Image / atmosphere / figurative claims extract as propositions alongside the usual events/states/rules.</rule>
    <rule register="technical-academic">Capture EVERY formula, numerical value, definition, comparison, cited evidence, named entity/method, cause-effect, constraint, and claim about what something does or is. Cap at 15.</rule>
  </register-rules>

  <type-labels required="true">
    <set register="fiction-dramatic-realist">state, belief, relationship, event, rule, secret, motivation.</set>
    <set register="fiction-lyric-fabulist-mythic">image, atmosphere, figurative_rule, invocation, refrain (plus the dramatic-realist set).</set>
    <set register="non-fiction">claim, definition, formula, evidence, parameter, mechanism, comparison, method, constraint, example, citation, counterargument.</set>
  </type-labels>

  <examples>
    <example register="fiction-dramatic-realist">{"content": "Alice falls down a rabbit hole", "type": "event"}</example>
    <example register="fiction-dramatic-realist">{"content": "The White Rabbit wears a waistcoat", "type": "state"}</example>
    <example register="fiction-dramatic-realist">{"content": "The Cheshire Cat can disappear", "type": "rule"}</example>
    <example register="fiction-lyric-fabulist-mythic">{"content": "In Macondo, it rains yellow flowers when a patriarch dies", "type": "figurative_rule"}</example>
    <example register="fiction-lyric-fabulist-mythic">{"content": "The river at the village edge runs uphill on the night of the feast", "type": "image"}</example>
    <example register="fiction-lyric-fabulist-mythic">{"content": "The hero's name is called three times before the council answers", "type": "refrain"}</example>
    <example register="non-fiction">{"content": "F = Σ_t v_t · D_KL(p_t⁺ ‖ p_t⁻)", "type": "formula"}</example>
    <example register="non-fiction">{"content": "F represents Fate — attention-weighted Kullback–Leibler divergence from prior to posterior belief across every market the scene touched; one summation, no tuning constants", "type": "definition"}</example>
    <example register="non-fiction">{"content": "W = ΔN_c + √ΔE_c — entity transformation across characters, locations, artifacts", "type": "definition"}</example>
    <example register="non-fiction">{"content": "Published works score 85-95", "type": "evidence"}</example>
  </examples>

  <invalid>Craft goals, pacing instructions, meta-commentary.</invalid>
</propositions>`;
