/**
 * Phase 1 of scene-plan generation — extract the compulsory propositions
 * (the discrete, checkable claims a reader must come away believing) from a
 * scene's structural data. Scene-only context; no narrative history.
 */

/** High-level identity only. Coverage rules and output schema live in the
 *  user prompt. */
export const EXTRACT_PROPOSITIONS_SYSTEM =
  `You are a scene fact-extractor. Read a scene's structural data (summary, deltas, new entities, events) and return the COMPLETE set of compulsory propositions the scene must land. Follow the coverage rules and output schema supplied in the user prompt. Return ONLY the JSON requested.`;

export function buildExtractPropositionsUserPrompt(args: { sceneXml: string }): string {
  return `<inputs>
  <scene>
${args.sceneXml}
  </scene>
</inputs>

<definition name="compulsory-proposition">A fact the prose MUST establish for the scene to count as having happened. Not atmosphere. Not craft flourish. The discrete, checkable claims a reader must come away believing.</definition>

<thoroughness hint="Every structural element in the scene data maps to at least one proposition. A missed delta becomes a continuity hole in later scenes.">
  <coverage>
    <source name="summary">Any commitments the summary makes that aren't yet captured by deltas below.</source>
    <source name="threadDelta">One proposition per moved thread (use the thread's description and addedNodes as anchors).</source>
    <source name="worldDelta">One proposition per addedNode, framed in present-tense state ("X now Y").</source>
    <source name="systemDelta.addedNodes">The world rule/principle surfaced.</source>
    <source name="relationshipDeltas">The concrete shift ("A now distrusts B").</source>
    <source name="ownershipDeltas">The transfer fact.</source>
    <source name="tieDeltas">The tie established or severed.</source>
    <source name="artifactUsages">What the artifact did.</source>
    <source name="characterMovements">The arrival/departure fact.</source>
    <source name="events">Any fact the event tag implies that isn't already captured.</source>
    <source name="new-entities">That this entity now exists, plus one proposition per meaningful world-node they carry in.</source>
  </coverage>
</thoroughness>

<rules>
  <rule name="no-dedupe">Do NOT deduplicate across delta types — each delta is its own commitment even if the surface wording overlaps.</rule>
  <rule name="no-texture">Do NOT include sensory texture, weather, or obvious background.</rule>
  <rule name="no-ordering">Do NOT impose an ordering — emit propositions grouped by source for clarity. Reordering for prose effect is the planner's job.</rule>
  <rule name="completeness">Completeness matters more than minimalism.</rule>
</rules>

<instructions>
  <step name="walk">Walk through every block of the scene XML above. No structural element goes uncovered.</step>
  <step name="extract">Emit one proposition per delta per the coverage rules. Group by source for clarity.</step>
</instructions>

<output-format>
Return ONLY JSON: { "propositions": [{"content": "single complete sentence stating one fact", "type": "free-label"}, ...] }
Type is a free label (event, state, rule, relation, secret, goal, transfer, tie, movement, emergence…).
</output-format>`;
}
