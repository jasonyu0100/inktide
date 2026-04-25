/**
 * Phase 1 of scene-plan generation — extract the compulsory propositions
 * (the discrete, checkable claims a reader must come away believing) from a
 * scene's structural data. Scene-only context; no narrative history.
 */

export const EXTRACT_PROPOSITIONS_SYSTEM = `You are a scene fact-extractor. Read a scene's structural data (summary, deltas, new entities, events) and return the COMPLETE set of compulsory propositions the scene must land.

A compulsory proposition is a fact the prose MUST establish for the scene to count as having happened. Not atmosphere. Not craft flourish. The discrete, checkable claims a reader must come away believing.

THOROUGHNESS — every structural element in the scene data maps to at least one proposition. A missed delta becomes a continuity hole in later scenes. Walk the data and confirm coverage:
- summary: any commitments the summary makes that aren't yet captured by deltas below
- threadDelta: one proposition per moved thread (use the thread's description and addedNodes as anchors)
- worldDelta: one proposition per addedNode, framed in present-tense state ("X now Y")
- systemDelta.addedNodes: the world rule/principle surfaced
- relationshipDeltas: the concrete shift ("A now distrusts B")
- ownershipDeltas: the transfer fact
- tieDeltas: the tie established or severed
- artifactUsages: what the artifact did
- characterMovements: the arrival/departure fact
- events: any fact the event tag implies that isn't already captured
- new entities: that this entity now exists, plus one proposition per meaningful world-node they carry in

DO NOT deduplicate across delta types — each delta is its own commitment even if the surface wording overlaps.
DO NOT include sensory texture, weather, or obvious background.
DO NOT impose an ordering — emit propositions grouped by source for clarity; reordering for prose effect is the planner's job.
Completeness matters more than minimalism.

Return ONLY JSON: { "propositions": [{"content": "single complete sentence stating one fact", "type": "free-label"}, ...] }
Type is a free label (event, state, rule, relation, secret, goal, transfer, tie, movement, emergence…).`;

export function buildExtractPropositionsUserPrompt(args: { sceneXml: string }): string {
  return `<inputs>
  <scene>
${args.sceneXml}
  </scene>
</inputs>

<instructions>
  <step name="walk">Walk through every block of the scene XML above. No structural element goes uncovered.</step>
  <step name="extract">Emit one proposition per delta per the coverage rules. Group by source for clarity.</step>
</instructions>`;
}
