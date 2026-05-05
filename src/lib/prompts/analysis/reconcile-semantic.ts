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

  <guiding-principle>DEFAULT IS TO KEEP SEPARATE. Threads and knowledge concepts are deliberately fine-grained. A typical narrative has dozens of distinct threads and system concepts — squashing them loses narrative texture. Only merge when you would be embarrassed to present both items in a final analysis because they say the exact same thing.</guiding-principle>

  <merge-test>If I resolved the canonical form, would every variant also be resolved as a natural consequence? If there's any distinguishing element (different participants, different stakes, different scope, different mechanism), the answer is NO — keep separate.</merge-test>

  <merging-guidance category="threads">
    <merge>
      <example>Two threads expressing the IDENTICAL question with different wording — same participants, scope, stakes.</example>
      <example>Two relational-tension threads naming the same dynamic between the same parties (e.g. "X's antagonism toward Y" + "X's hostility toward Y").</example>
      <example>An interrogative form and its noun-phrase form of the same question.</example>
    </merge>
    <keep-separate hint="Any of these distinctions is enough.">
      <example reason="different participants">A's conflict with B vs A's conflict with C — different counterparties.</example>
      <example reason="different scope">A single entity's stake on a question vs a collective's stake on the same question.</example>
      <example reason="different stakes">A discovery question vs an adjustment question on the same subject.</example>
      <example reason="different phases">A "discover X is hidden" thread vs a "reach X" thread on the same object.</example>
      <example reason="distinct unknowns">Two "who did Y?" inquiries that share a topic but ask about different agents or different events.</example>
      <example reason="distinct claims">Two questions about the same subject probing different predicates (e.g. "does X scale?" vs "does X generalise?").</example>
      <example reason="distinct directional arcs">"X's loyalty to Y" vs "Y's trust in X" — different perspective, different load-bearing question.</example>
    </keep-separate>
  </merging-guidance>

  <merging-guidance category="system-knowledge">
    <merge>
      <example>Two formulations of the same operational rule with different surface phrasing.</example>
      <example>Two descriptions of the same institutional / mechanical / mathematical procedure with no distinguishing predicate.</example>
    </merge>
    <keep-separate>
      <example reason="different mechanisms">A legal / normative rule on a topic vs a physical / mathematical principle on the same topic.</example>
      <example reason="related but distinct">A structural fact ("system has N components") vs a procedural rule operating within it.</example>
      <example reason="parent / child">A general rule vs a specific instance / consequence of it.</example>
      <example reason="different predicates">"X enables A" vs "X enables B" — same subject, materially different consequence claim.</example>
      <example reason="same topic, different claims">Two claims about the same system with different content.</example>
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
