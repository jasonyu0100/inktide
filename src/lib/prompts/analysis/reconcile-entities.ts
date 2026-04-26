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

  <principle>Entities are unique referents — a character, place, or object exists once in the story world. If two surface forms clearly denote the same referent, they MUST be merged. Prefer the fullest, most identifying canonical form.</principle>

  <merging-guidance category="characters">
    <do>
      <example tradition="Anglophone fiction">"Harry" / "Harry Potter" → "Harry Potter"</example>
      <example tradition="Anglophone, with title">"Professor McGonagall" / "Minerva McGonagall" / "McGonagall" → "Professor Minerva McGonagall"</example>
      <example tradition="Latin American fiction">"José Arcadio" / "the colonel" / "Colonel Aureliano Buendía" — merge when context makes the referent unambiguous; preserve the Buendía distinction across generations.</example>
      <example tradition="East Asian fiction">"宝玉" / "Jia Baoyu" / "Baoyu" → "Jia Baoyu"; be careful with romanisation variants (Pinyin vs Wade-Giles) that refer to the same name.</example>
      <example tradition="research paper">"Yann LeCun" / "LeCun" / "the author" → "Yann LeCun". For ET AL. citations be conservative: "Vaswani et al." usually denotes the group-authored work.</example>
      <example tradition="memoir / reportage">"my mother" / "Ama" / "Mrs. Okonkwo" → the fullest identifying form when context makes the referent clear.</example>
    </do>
    <canonical-choice>Pick the form that is most uniquely identifying. Full name &gt; title + last name &gt; first name or nickname alone. If a title is part of how the referent is known (Professor, Lord, Sensei, Imam, Doctor, Aunty), include it.</canonical-choice>
    <do-not-merge>
      <example>Different people sharing a surname or title: "Mr. Dursley" vs "Dudley Dursley"; "Professor Snape" vs "Professor McGonagall".</example>
      <example>Different authors cited in the same work: "Brown et al., 2020" vs "Silver et al., 2021".</example>
      <example>Transliteration variants that refer to distinct people: "Chen Wei" vs "Chen Wen".</example>
      <example>Generational namesakes: "Aureliano Buendía (the colonel)" vs "Aureliano Segundo".</example>
    </do-not-merge>
  </merging-guidance>

  <merging-guidance category="locations">
    <do>
      <example>"The Great Hall" / "Great Hall" / "Hogwarts Great Hall" → "Great Hall"</example>
      <example>"Macondo" / "the village of Macondo" → "Macondo"</example>
      <example>"the madrasa courtyard" / "the Qarawiyyin courtyard" when unambiguous.</example>
      <example tradition="research">"Google DeepMind London" / "DeepMind (London office)" → the fullest institutional form.</example>
      <example>Romanisation variants of the same place: "Beijing" / "Peking" → whichever the work uses canonically.</example>
    </do>
    <do-not-merge hint="Distinct places even if nested or adjacent.">
      <example>"The Great Hall" vs "The Entrance Hall"</example>
      <example>"Macondo" vs "Riohacha"</example>
      <example>"Stanford University" vs "Stanford Linear Accelerator Center"</example>
    </do-not-merge>
  </merging-guidance>

  <merging-guidance category="artifacts">
    <do>
      <example tradition="fiction">"the Elder Wand" / "Elder Wand" / "Dumbledore's wand" → "the Elder Wand"</example>
      <example tradition="fiction, translated work">"the Sorcerer's Stone" / "the Philosopher's Stone" — same object, different edition-title.</example>
      <example tradition="research">"the Adam optimiser" / "Adam (Kingma &amp; Ba, 2014)" → the fullest identifying form.</example>
      <example tradition="research">"Table 2" / "Table 2: ablation results" → the fullest labelled form.</example>
    </do>
    <do-not-merge hint="Different instances of the same type.">
      <example>"Harry's wand" vs "Voldemort's wand"</example>
      <example>Two different trained models with different checkpoints.</example>
      <example>Two figures with the same number in different papers.</example>
    </do-not-merge>
  </merging-guidance>

  <output-shape>
    <step>For each category, map every VARIANT ID to its CANONICAL ID (the fullest form in that merge group). Only include entries where variant ID ≠ canonical ID. Use the exact numeric IDs from the lists above — do not invent IDs.</step>
    <step>Empty object {} if no merges needed for a category.</step>
    <example hint="If CHARACTERS lists 1. 'Harry', 2. 'Harry Potter', 3. 'HP' and all three are the same referent, emit:">{"1": 2, "3": 2}</example>
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
