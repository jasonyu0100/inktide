/**
 * Semantic Reconciliation Prompt
 *
 * Phase 3b — nuanced merging of threads and system knowledge concepts.
 * Unlike named entities these are propositions; the default stance is to
 * preserve distinctions rather than collapse them.
 */

export const RECONCILE_SEMANTIC_SYSTEM = `You reconcile narrative threads and system knowledge concepts. These are propositions, not proper names — apparent duplicates frequently encode real nuance. Your default stance is to PRESERVE. Only merge two items when one is clearly a restatement of the other with the same participants, scope, stakes, and claim. When in doubt, keep separate. Return only valid JSON.`;

export function buildReconcileSemanticPrompt(
  allThreadDescs: Set<string>,
  allSysConcepts: Set<string>,
): string {
  return `<inputs>
  <threads count="${allThreadDescs.size}">
${[...allThreadDescs].map((d, i) => `    <item index="${i + 1}">${d.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</item>`).join('\n')}
  </threads>
  <system-knowledge count="${allSysConcepts.size}">
${[...allSysConcepts].map((c, i) => `    <item index="${i + 1}">${c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</item>`).join('\n')}
  </system-knowledge>
</inputs>

<instructions>
  <task>Reconcile threads and system knowledge concepts extracted independently from different scenes. These are propositions, not proper names — preserve distinct nuances. Only merge when two items are genuine restatements of the same proposition.</task>

  <guiding-principle>DEFAULT IS TO KEEP SEPARATE. Threads and knowledge concepts are deliberately fine-grained. A typical story has dozens of distinct threads and system concepts — squashing them loses narrative texture. Only merge when you would be embarrassed to present both items in a final analysis because they say the exact same thing.</guiding-principle>

  <merge-test>If I resolved the canonical form, would every variant also be resolved as a natural consequence? If there's any distinguishing element (different participants, different stakes, different scope, different mechanism), the answer is NO — keep separate.</merge-test>

  <merging-guidance category="threads">
    <merge>
      <example>"Who is trying to steal the Stone?" + "The mystery of who wants the Sorcerer's Stone" — identical question, different wording.</example>
      <example>"Snape's antagonism toward Harry" + "Snape's hostility toward Harry" — same relational tension.</example>
      <example>"Will Harry survive Voldemort?" + "Harry's survival against Voldemort" — same question.</example>
    </merge>
    <keep-separate hint="Any of these distinctions is enough.">
      <example reason="different participants">"Harry's conflict with Snape" vs "Harry's conflict with Malfoy"</example>
      <example reason="different scope">"Harry's fear of Voldemort" vs "The wizarding world's fear of Voldemort"</example>
      <example reason="different stakes">"Harry learns he is a wizard" vs "Harry adjusts to Hogwarts life"</example>
      <example reason="different antagonists">"Harry vs Voldemort" vs "Harry vs the Dursleys"</example>
      <example reason="different phases">"Discovering the Stone is hidden" vs "Reaching the Stone"</example>
      <example reason="distinct mysteries">"Who opened the Chamber?" vs "Who is the Heir of Slytherin?"</example>
      <example reason="distinct internal arcs">"Snape's loyalty to Dumbledore" vs "Dumbledore's trust in Snape"</example>
    </keep-separate>
  </merging-guidance>

  <merging-guidance category="system-knowledge">
    <merge>
      <example>"Magic requires a wand to channel" + "Wands are required to cast spells" — same rule.</example>
      <example>"The house point system rewards behavior" + "Houses earn and lose points based on student conduct" — same mechanism.</example>
    </merge>
    <keep-separate>
      <example reason="different mechanisms">"Unforgivable Curses are illegal" vs "Dark magic is dangerous" — one is a legal rule, the other a physical principle.</example>
      <example reason="related but distinct">"Hogwarts has four houses" vs "The Sorting Hat assigns students".</example>
      <example reason="parent / child">"Magic exists" vs "Spells require incantations".</example>
      <example reason="different predicates">"World models enable planning" vs "World models enable reasoning".</example>
      <example reason="same topic, different claims">"AI systems require large datasets" vs "AI systems are unreliable without supervision".</example>
    </keep-separate>
  </merging-guidance>

  <when-in-doubt>Losing a distinction is worse than keeping a duplicate. The downstream pipeline can work with slight redundancy but cannot recover lost nuance. If you are even slightly unsure, leave both items intact.</when-in-doubt>

  <output-shape>For each category, map every variant to its canonical form. Only include entries where variant ≠ canonical. Empty object {} if no merges needed.</output-shape>
</instructions>

<output-format>
Return JSON:
{
  "threadMerges": { "variant": "canonical" },
  "systemMerges": { "variant": "canonical" }
}
</output-format>`;
}
