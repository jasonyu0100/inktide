/**
 * Auto-detect patterns and anti-patterns prompt — analyses a narrative's
 * prose, structure, and content to identify the genre/subgenre and derive
 * concrete commandments that encourage variety and prevent stagnation.
 */

export type DetectPatternsArgs = {
  narrativeContext: string;
  threadSummary: string;
  characterSummary: string;
  systemSummary: string;
  sceneSummaries: string;
  proseSamples: string;
  existingPatterns: string;
  existingAntiPatterns: string;
};

export function buildDetectPatternsPrompt(args: DetectPatternsArgs): string {
  const {
    narrativeContext,
    threadSummary,
    characterSummary,
    systemSummary,
    sceneSummaries,
    proseSamples,
    existingPatterns,
    existingAntiPatterns,
  } = args;

  return `<inputs>
  <narrative-context>
${narrativeContext}
  </narrative-context>
  <narrative-signals>
    <threads>${threadSummary || 'None yet'}</threads>
    <key-characters>${characterSummary || 'None yet'}</key-characters>
    <world-systems>${systemSummary || 'None yet'}</world-systems>
  </narrative-signals>
  <scene-structure>
${sceneSummaries || 'No scenes yet'}
  </scene-structure>
  <prose-samples>
${proseSamples || 'No prose available yet'}
  </prose-samples>
  <existing-patterns>${existingPatterns}</existing-patterns>
  <existing-anti-patterns>${existingAntiPatterns}</existing-anti-patterns>
</inputs>

<instructions>
  <purpose hint="Patterns serve TWO functions: COOPERATIVE (encourage variety, push toward fresh territory) and ADVERSARIAL (prevent stagnation, flag repetition).">
    Analyze this narrative's PROSE STYLE, STRUCTURE, and CONTENT to detect its GENRE and derive patterns/anti-patterns. The goal is a LIVING story that evolves — patterns encourage growth and surprise; anti-patterns prevent comfortable ruts.
  </purpose>

  <step name="detect-genre">Based on prose samples, world systems, and narrative structure, identify:
    <field>Primary genre — fantasy, sci-fi, thriller, romance, horror, mystery, literary, etc.</field>
    <field>Specific subgenre — progression fantasy, space opera, cozy mystery, dark romance, LitRPG, xianxia, cultivation, grimdark, etc.</field>
  </step>

  <step name="derive-patterns" count="5-7" hint="Positive commandments encouraging VARIETY and excellence.">
    <consider>What genre conventions unlock fresh storytelling opportunities?</consider>
    <consider>What structural patterns create satisfying variety across arcs?</consider>
    <consider>What character dynamics feel authentic AND allow for growth/change?</consider>
    <consider>What techniques keep the prose engaging without becoming formulaic?</consider>
    <consider>Include at least 1-2 patterns that specifically encourage novelty and surprise.</consider>
    <example>Each arc must introduce at least one element (character, location, system) that recontextualizes something established.</example>
    <example>Power dynamics must shift — no character should stay dominant for more than two arcs.</example>
    <example>Every major character must make a choice that surprises even themselves.</example>
  </step>

  <step name="derive-anti-patterns" count="5-7" hint="Negative commandments preventing STAGNATION.">
    <consider>What patterns would make the story feel repetitive or predictable?</consider>
    <consider>What genre tropes are overdone and signal lazy writing?</consider>
    <consider>What character dynamics become stale if repeated too often?</consider>
    <consider>What structural rhythms feel formulaic after a few arcs?</consider>
    <consider>Include at least 1-2 anti-patterns that specifically flag staleness and repetition.</consider>
    <example>NEVER repeat the same arc structure back-to-back (training → challenge → victory).</example>
    <example>No character should solve problems the same way twice in a row.</example>
    <example>Avoid recycling tension patterns — if betrayal drove the last arc, it cannot drive this one.</example>
  </step>

  <critical-output-rules>
    <rule>"detectedGenre" and "detectedSubgenre" MUST be populated as their own top-level fields.</rule>
    <rule>DO NOT prefix any pattern or anti-pattern with "Genre:" or "Subgenre:" — those belong only in the dedicated fields.</rule>
    <rule>Each pattern/anti-pattern must be a concrete commandment, not a genre label.</rule>
  </critical-output-rules>
</instructions>

<output-format>
Return JSON:
{
  "detectedGenre": "primary genre",
  "detectedSubgenre": "specific subgenre",
  "patterns": [
    "Pattern 1 — concrete, actionable, genre-specific",
    "Pattern 2",
    "..."
  ],
  "antiPatterns": [
    "Anti-pattern 1 — concrete, actionable, genre-specific",
    "Anti-pattern 2",
    "..."
  ]
}
</output-format>`;
}
