/**
 * Entity Reconciliation Prompt
 *
 * Phase 3a — aggressive merging of name-variant entities (characters, locations,
 * artifacts) onto their fullest canonical form.
 */

export const RECONCILE_ENTITIES_SYSTEM = `You resolve surface-form variants of named entities (characters, locations, artifacts) to their canonical full forms. Entities are unique referents: when two variants clearly denote the same person/place/object, you MUST merge them. Prefer the fullest identifying name. Return only valid JSON using the numeric IDs provided.`;

export function buildReconcileEntitiesPrompt(
  allCharNames: Set<string>,
  allLocNames: Set<string>,
  allArtifactNames: Set<string>,
): string {
  return `<inputs>
  <characters count="${allCharNames.size}">
${[...allCharNames].map((n, i) => `    <entity id="${i + 1}" name="${n.replace(/"/g, '&quot;')}" />`).join('\n')}
  </characters>
  <locations count="${allLocNames.size}">
${[...allLocNames].map((n, i) => `    <entity id="${i + 1}" name="${n.replace(/"/g, '&quot;')}" />`).join('\n')}
  </locations>
  <artifacts count="${allArtifactNames.size}">
${[...allArtifactNames].map((n, i) => `    <entity id="${i + 1}" name="${n.replace(/"/g, '&quot;')}" />`).join('\n')}
  </artifacts>
</inputs>

<instructions>
  <task>Reconcile named entities extracted independently from different scenes. The same person, place, or object often appears under different surface forms (title, first name, nickname, full name). Collapse every variant onto its fullest canonical form.</task>

  <principle>Entities are unique referents — a character, place, or object exists once in the narrative's world (fictional, autobiographical, argumentative, empirical, or modelled / simulated under a stated rule set). If two surface forms clearly denote the same referent, they MUST be merged. Prefer the fullest, most identifying canonical form.</principle>

  <merging-guidance category="characters">
    <do>
      <example>First-name / full-name / nickname variants of the same person → fullest form.</example>
      <example>Title + last-name + full-name variants — include the title in the canonical when it's how the referent is known (Professor, Doctor, Sensei, Imam, Aunty, Colonel, etc.).</example>
      <example>Variants like role-by-relation ("the colonel", "my mother", "the author") + a name variant → fullest identifying form when context disambiguates.</example>
      <example>Transliteration / romanisation variants of the same name (Pinyin vs Wade-Giles, edition titles) → the form the work uses canonically.</example>
      <example>For research / reportage: author surname / full name → fullest identifying form. Be conservative with "et al." citations — they denote the group-authored work, not a single author.</example>
    </do>
    <canonical-choice>Pick the form that is most uniquely identifying. Full name &gt; title + last name &gt; first name or nickname alone. If a title is part of how the referent is known, include it.</canonical-choice>
    <do-not-merge>
      <example>Different people sharing a surname or title.</example>
      <example>Different authors cited in the same work (e.g. "Brown et al., 2020" vs "Silver et al., 2021").</example>
      <example>Transliteration variants that refer to distinct people (e.g. "Chen Wei" vs "Chen Wen").</example>
      <example>Generational namesakes — preserve the distinction the source maintains.</example>
    </do-not-merge>
  </merging-guidance>

  <merging-guidance category="locations">
    <do>
      <example>Article / qualifier variants of the same place ("The Great Hall" / "Great Hall" / "the village of X") → fullest unambiguous form.</example>
      <example>Sub-naming variants when context disambiguates ("the courtyard" / "the named courtyard").</example>
      <example>Institutional naming variants ("Org London" / "Org (London office)") → fullest institutional form.</example>
      <example>Romanisation variants of the same place ("Beijing" / "Peking") → whichever the work uses canonically.</example>
    </do>
    <do-not-merge hint="Distinct places even if nested or adjacent.">
      <example>Adjacent or nested rooms / halls in the same building.</example>
      <example>Distinct settlements in the same region.</example>
      <example>A parent institution vs a distinct sub-facility.</example>
    </do-not-merge>
  </merging-guidance>

  <merging-guidance category="artifacts">
    <do>
      <example>Article / possessor variants of the same object ("the X" / "X" / "[owner]'s X") → fullest known form.</example>
      <example>Edition-title variants of the same object (translated / re-titled across editions) → unify under one canonical.</example>
      <example>Citation variants of a method, instrument, or labelled exhibit ("X" / "X (Author, year)" / "Table N" / "Table N: caption") → fullest labelled form.</example>
    </do>
    <do-not-merge hint="Different instances of the same type.">
      <example>Two distinct possessions of the same kind (different wielders, different checkpoints, different figures with the same number in different works).</example>
    </do-not-merge>
  </merging-guidance>

  <output-shape>
    <step>For each category, map every VARIANT ID to its CANONICAL ID (the fullest form in that merge group). Only include entries where variant ID ≠ canonical ID. Use the exact numeric IDs from the lists above — do not invent IDs.</step>
    <step>Empty object {} if no merges needed for a category.</step>
    <example hint="If CHARACTERS lists three IDs (1, 2, 3) for variants of the same referent and 2 is the canonical, emit:">{"1": 2, "3": 2}</example>
  </output-shape>
</instructions>

<output-format>
Return JSON:
{
  "characterMerges": { "<variantId>": <canonicalId> },
  "locationMerges":  { "<variantId>": <canonicalId> },
  "artifactMerges":  { "<variantId>": <canonicalId> }
}
</output-format>`;
}
