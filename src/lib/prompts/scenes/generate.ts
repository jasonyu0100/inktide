/**
 * Scene generation prompt — emits a JSON arc with N scenes (and their full
 * delta blocks) given the narrative context, brief, and pacing sequence.
 * Builder takes pre-built XML blocks for inputs / shared rules so the
 * prompts module stays free of upstream dependencies.
 */

import { phaseGraphPriorityEntry } from "../phase/application";

export const GENERATE_SCENES_SYSTEM =
  'You are a scene generator producing one arc of structurally rich scenes. Honour the brief (reasoning graph / coordination plan / direction), the pacing sequence, and the active threads. Every scene needs a delta-paired summary and rich threadDeltas (with rationale grounded in the scene), worldDeltas (15-25 word present-tense facts across 3+ entities), and ≥1 systemDelta. Match the world\'s naming style for any new entities. Return ONLY valid JSON matching the schema in the user prompt.';

export type GenerateScenesPromptArgs = {
  /** Pre-built `<inputs>...</inputs>` body (all input blocks joined). */
  inputBlocks: string;
  arcId: string;
  povRestrictedHint: string;
  /** Pre-built force-band line for "typical" scenes. */
  worldTypicalBand: string;
  worldClimaxBand: string;
  worldQuietBand: string;
  systemTypicalBand: string;
  systemClimaxBand: string;
  systemQuietBand: string;
  /** Pre-built modular prompt blocks shared across scene generation paths. */
  sharedRulesBlock: string;
};

export function buildGenerateScenesPrompt(args: GenerateScenesPromptArgs): string {
  const {
    inputBlocks,
    arcId,
    povRestrictedHint,
    worldTypicalBand,
    worldClimaxBand,
    worldQuietBand,
    systemTypicalBand,
    systemClimaxBand,
    systemQuietBand,
    sharedRulesBlock,
  } = args;

  return `<inputs>
${inputBlocks}
</inputs>

<integration-hierarchy hint="When inputs conflict, this is the priority order for scene structure.">
  <priority rank="1">BRIEF — the reasoning graph (CRG) / coordination-plan directive / direction. Scenes execute the brief; threads/entities/rules from the brief land here.</priority>
  <priority rank="2">ARC SETTINGS (when present) — force preference / reasoning mode / network bias the CRG was built under. Scenes inherit the same engine tilt so structure and execution stay aligned. Below the brief itself but above content inputs because settings shape how the brief gets rendered.</priority>
  <priority rank="3">WORLD-BUILD FOCUS (when present) — recently-introduced characters, locations, and latent threads that this arc must activate. Bring them on-screen, set scenes in their locations, seed their threads. Committed inventory the arc has to spend.</priority>
  <priority rank="4">PACING SEQUENCE — per-scene mode + force band targets; the rhythm budget the structure must hit.</priority>
  ${phaseGraphPriorityEntry(5, "scene-structure")}
  <priority rank="6">NARRATIVE CONTEXT — characters, threads, system knowledge, recent history; the substrate scenes draw from.</priority>
</integration-hierarchy>

<procedure name="per-scene" hint="The summary is your DELTA BUDGET — richer summary supports richer extraction. Under-tagging is the dominant failure.">
  <step index="1" name="draft">Draft the summary in rich prose using NAMES not IDs.</step>
  <step index="2" name="enumerate">Per sentence, list: which entity changed, which rule surfaced, which thread moved, which off-screen party would receive news. Usually multiple answers.</step>
  <step index="3" name="rewrite">Rewrite the summary so every intended delta has a source sentence. Summary and delta-set are paired.</step>
  <step index="4" name="emit">Emit the full delta block.</step>
</procedure>

<output-format>
Return JSON with this exact structure.

{
  "arcName": "2-4 words, evocative, UNIQUE. Bad: 'Continuation'. Good: 'Fractured Oaths'.",
  "directionVector": "Forward-looking intent for this arc.",
  "worldState": "Compact state snapshot at END of arc — the chess-board position.",
  "scenes": [
    {
      "id": "S-GEN-001",
      "arcId": "${arcId}",
      "locationId": "existing location ID",
      "povId": "character ID (must be a participant)${povRestrictedHint}",
      "participantIds": ["existing character IDs"],
      "summary": "3-6 sentences in prose using NAMES not IDs. Write what HAPPENED / was SAID / visibly CHANGED. Include concrete specifics (objects, dialogue, data). No generic summaries, no sentences that end in private emotions.",
      "timeDelta": {"value": 1, "unit": "minute|hour|day|week|month|year"},
      "artifactUsages": [{"artifactId": "A-XX", "characterId": "C-XX", "usage": "what the artifact did"}],
      "characterMovements": {"C-XX": {"locationId": "L-YY", "transition": "how they travelled"}},
      "events": ["event_tag_1", "event_tag_2"],
      "threadDeltas": [{"threadId": "T-XX", "logType": "pulse|transition|setup|escalation|payoff|twist|callback|resistance|stall", "updates": [{"outcome": "outcome name from thread.outcomes", "evidence": -4..+4 (decimals allowed, e.g. +1.5)}], "volumeDelta": 0..2, "addOutcomes": ["optional — new outcome names when this scene structurally opens a possibility not previously in the market"], "rationale": "the summary sentence that moved this thread's market in this scene"}],
      "worldDeltas": [{"entityId": "C-XX|L-XX|A-XX", "addedNodes": [{"id": "K-GEN-001", "content": "15-25 words, present tense", "type": "trait|state|history|capability|belief|relation|secret|goal|weakness"}]}],
      "relationshipDeltas": [{"from": "C-XX", "to": "C-YY", "type": "description", "valenceDelta": 0.1}],
      "systemDeltas": {"addedNodes": [{"id": "SYS-GEN-001", "concept": "15-25 words, general rule, no specific entities/events", "type": "principle|system|concept|tension|event|structure|environment|convention|constraint"}], "addedEdges": [{"from": "SYS-GEN-001", "to": "SYS-XX", "relation": "enables|governs|opposes|extends|created_by|constrains|exist_within"}]},
      "ownershipDeltas": [{"artifactId": "A-XX", "fromId": "C-XX|L-XX|null", "toId": "C-YY|L-YY|null"}],
      "tieDeltas": [{"locationId": "L-XX", "characterId": "C-XX", "action": "add|remove"}],
      "newCharacters": [{"id": "C-GEN-001", "name": "Full Name", "role": "anchor|recurring|transient", "threadIds": [], "imagePrompt": "literal physical description", "world": {"nodes": {"K-GEN-XXX": {"id": "K-GEN-XXX", "type": "trait|history|capability|secret|goal", "content": "key fact"}}, "edges": []}}],
      "newLocations": [{"id": "L-GEN-001", "name": "Name", "prominence": "domain|place|margin", "parentId": "L-XX|null", "tiedCharacterIds": [], "threadIds": [], "imagePrompt": "literal visual description", "world": {"nodes": {"K-GEN-XXX": {"id": "K-GEN-XXX", "type": "trait|history", "content": "key fact"}}, "edges": []}}],
      "newArtifacts": [{"id": "A-GEN-001", "name": "Name", "significance": "key|notable|minor", "parentId": "C-XX|L-XX|null", "threadIds": [], "imagePrompt": "literal visual description", "world": {"nodes": {"K-GEN-XXX": {"id": "K-GEN-XXX", "type": "trait|capability|history|state", "content": "one fact per node"}}, "edges": []}}],
      "newThreads": [{"id": "T-GEN-001", "description": "compelling question", "outcomes": ["yes", "no"], "participants": [{"id": "C-XX", "type": "character|location|artifact"}], "threadLog": {"nodes": {}, "edges": []}}]
    }
  ]
}
</output-format>

<instructions>
  <rule name="introduce-new-entities">Introduce new entities liberally on the fly when the scene needs them (a messenger, a tavern, a letter, a new rivalry). Each new character/location/artifact needs ≥1 world node at creation; each new thread needs ≥1 setup log entry.</rule>

  <rule name="naming-discipline" hint="New entities MUST use concrete, in-world proper names. The reasoning graph may seed roles or archetypes; scene generation COLLAPSES those into real names that fit the established culture and naming conventions of the existing cast.">
    <example type="bad" reason="placeholder / archetype / role-as-name">"Shadow Seeker", "The Stranger", "Mysterious Figure", "Old Man", "The Rival", "Dark Forest", "Mystery Letter".</example>
    <example type="good" world="Chinese xianxia">"Liang Wei", "Elder Hua Jin", "Black Pine Ridge", "Letter from Bao Cheng".</example>
    <example type="good" world="Tolkien-style">"Aerin son of Faldor", "Dunwood Vale".</example>
    <directive>Read the existing characters/locations/artifacts in context, match their naming style (length, language family, honorific conventions), and pick a name that could pass as one of theirs. Descriptive labels and titles belong in the world-node content, never in the \`name\` field.</directive>
  </rule>

  <rule name="collapse-on-reveal" critical="true" hint="When a scene REVEALS a load-bearing fact (a location, an identity, a capability, an intent, a relationship truth, an artefact's effect), the summary AND the worldDelta MUST name the specific fact. Future scenes will causally reason on whatever this scene commits to the canon — vague reveals create brittle canon. The summary is the delta budget; vagueness here cascades into vague worldDeltas, vague propositions, hedged prose.">
    <directive>Distinguish IN-CHARACTER UNCERTAINTY from CANONICAL FACT. A character can SUSPECT, INFER, or HYPOTHESISE without commitment ("Fang Yuan suspected Bai Ning Bing was sheltering in the Northern Plains"). But when a worldDelta says the fact is now known/established/confirmed, the canon must commit: name the place, name the person, name the capability, name the intent. The sentence that moves the worldDelta must contain the specific fact, not gesture at it.</directive>
    <ban>"probable location", "approximate position", "likely identity", "the location", "her whereabouts", "the answer", "the intelligence" — used as canonical commitments. These are placeholders that read as reveals while transmitting nothing.</ban>
    <example type="bad" reason="reveal that commits nothing to canon">"Fang Yuan correlated the records and pinpointed Bai Ning Bing's current probable location, fulfilling his goal of finding her within the six-month timeframe."</example>
    <example type="good" reason="reveal that commits a named fact future scenes can reason on">"Fang Yuan correlated the orphan-trade records against the Heaven's Will manifestations and traced Bai Ning Bing to the Wandering Sect's hidden refuge in the Northern Plains, confirmed by three independent intercepts dated within the past lunar cycle."</example>
    <test>If you can replace the named fact with "[REDACTED]" and the summary still reads as a reveal, you have written a placeholder. Rewrite until the canon carries the actual fact.</test>
  </rule>

  <rule name="ids">scene S-GEN-###, knowledge K-GEN-###, system SYS-GEN-### (reused SYS nodes keep original ID), character/location/artifact/thread GEN-### placeholders remapped to real IDs downstream.</rule>

  <rule name="time-delta" hint="Gap from prior scene as an estimate ({value: int≥0, unit}). Relative only — no absolute calendar.">
    <example>"that evening" → 3 hours.</example>
    <example>"next morning" → 1 day.</example>
    <example>"three years later" → 3 years.</example>
    <example>{value:0, unit:"minute"} = simultaneous/concurrent (use for first scene too).</example>
  </rule>

  <rule name="tag-richly-discipline" hint="Floors and emission rules consolidated. forces.ts has formulas; deltas.ts has shape.">
    <floor>≥6 world nodes across ≥3 entities, ≥1 system node per scene. Never emit \`systemDeltas: {}\`. One threadDelta per thread per scene; transitions move ONE step forward.</floor>
    <profile mode="typical">${worldTypicalBand} world, ${systemTypicalBand} system, 2-4 thread pulses (0-1 transitions).</profile>
    <profile mode="climax">${worldClimaxBand} world, ${systemClimaxBand} system, 1-2 transitions.</profile>
    <profile mode="quiet">${worldQuietBand} world, ${systemQuietBand} system, 0-1 pulses.</profile>
    <profile mode="reflective-pov" hint="Solo-POV scenes, mostly thinking/planning.">The POV is STILL the most-changed entity. Expect 4-6 nodes on the POV alone (belief/state/goal/capability/secret shifts), plus 2-3 on adjacent entities (location witnessed, artifact handled, off-screen party affected). A reflective scene with only one POV delta is broken.</profile>
    <directive>AGENCY over ORBIT, OFF-SCREEN deltas are valid (news/rumour/intelligence), REUSE existing node IDs — only NEW concepts count.</directive>
  </rule>

  <worked-example name="thin-vs-rich" hint="Same summary; the difference is extraction discipline.">
    <summary>Fang Yuan activated Heaven's Mandate Gu on a corpus combining the stone slab's hum with Elder Xuan's Tracking Gu signature. The reading revealed Heaven's Will was embedded within the refinement of specialized Gu — overturning his prior model and demanding a new counter-strategy.</summary>
    <thin reason="What to AVOID">1 worldDelta on Fang Yuan, \`systemDeltas: {}\`.</thin>
    <rich target="8 world across 5 entities + 2 system">
worldDeltas: [
  {entityId: C-THE-01, nodes: [belief "Heaven's Will embeds inside specialized Gu mechanisms", state "prior external-force model is overturned", goal "shift to proactive counter-mandate engineering", capability "can compose multi-source anomaly corpora"]},
  {entityId: A-THE-04, nodes: [capability "Heaven's Mandate Gu resolves composite corpora into multi-layered revelations"]},
  {entityId: A-18, nodes: [trait "Tracking Gu carries Heaven's Will signature embedded at refinement"]},
  {entityId: A-THE-17, nodes: [trait "stone slab hum carries cosmic-disruption data readable by Mandate Gu"]},
  {entityId: L-THE-03, nodes: [history "Gray Wolf Ranges stronghold served as the analysis site"]}
]
systemDeltas: { addedNodes: [principle "Heaven's Will operates by embedding influence within specialized Gu refinement", concept "Heaven's Mandate Gu resolves anomaly corpora into patterned revelations"], addedEdges: [governs(principle, concept)] }
threadDeltas: [one transition + optional pulse on the Heaven's Will inquiry thread]
    </rich>
    <takeaway>Apply the rich pattern to every scene.</takeaway>
  </worked-example>

  <reference name="shared-rules" hint="Modular prompt blocks shared across scene generation paths.">
${sharedRulesBlock}
  </reference>
</instructions>`;
}
