/**
 * Phase 1 of scene-plan generation — extract the compulsory propositions
 * (the discrete, checkable claims a reader must come away believing) from a
 * scene's structural data. Scene-only context; no narrative history.
 */

/** High-level identity only. Coverage rules and output schema live in the
 *  user prompt. */
export const EXTRACT_PROPOSITIONS_SYSTEM =
  `You are a scene fact-extractor. Read a scene's structural data (summary, deltas, new entities, events) and return the COMPLETE set of compulsory propositions the scene must land. Each proposition is prose-ready natural language a reader can absorb directly — never identifier-echoes or template scaffolding. Follow the coverage rules and output schema supplied in the user prompt. Return ONLY the JSON requested.`;

export function buildExtractPropositionsUserPrompt(args: { sceneXml: string }): string {
  return `<inputs>
  <scene>
${args.sceneXml}
  </scene>
</inputs>

<definition name="compulsory-proposition">A fact the prose MUST establish for the scene to count as having happened. Not atmosphere. Not craft flourish. A discrete, checkable claim phrased as natural prose that a reader can absorb directly — the prose writer drops it into a beat without rephrasing.</definition>

<phrasing-discipline critical="true" hint="Each proposition is consumed downstream by the prose writer. If it reads like a database row, the prose layer has to translate it before use, which both costs work and risks the metadata leaking into the page.">
  <rule name="natural-language">Write as prose-ready statements about WHAT IS TRUE in the world. Past or present tense in the world's voice — not the engine's metadata.</rule>
  <rule name="no-identifier-echo">Never echo internal identifiers, snake_case event names, or system-node ids. Translate "gu_malfunction" / "adaptive_countermeasure" / "SYS-07" into the actual phenomenon ("the Heaven's Loom Gu fractures into static" / "Heaven's Will adapts to Fang Yuan's method" / "the rule of clan succession").</rule>
  <rule name="no-template-scaffolding">Do NOT write "An X event occurred" or "The thread 'Y' has shifted to 'Z', indicating W." Drop the framing entirely and state the in-world fact directly.</rule>
  <rule name="thread-shifts-as-events">For threadDeltas: do NOT quote the thread's question text or name its lifecycle status. Describe what actually happens in the scene that moves that thread (the discovery, the choice, the consequence). The thread's description is your anchor for what's at stake; the proposition states the in-world event.</rule>
  <rule name="events-as-prose">For events: the event string is a label, not the proposition. Render the underlying happening as a concrete prose statement.</rule>
  <rule name="no-system-jargon">Avoid framework terms ("state-change", "system-reveal", "thread-shift", "adaptive countermeasure", "karmic debt") unless the world itself uses them as in-character vocabulary.</rule>
  <rule name="single-claim">One proposition = one atomic fact. Don't bundle multiple claims behind "and" or commas-as-ands.</rule>
</phrasing-discipline>

<examples>
  <bad reason="identifier echo, template scaffolding">"A gu_malfunction occurred."</bad>
  <good>"The Heaven's Loom Gu's threads fracture into erratic static."</good>
  <bad reason="quoting thread question + lifecycle status">"The thread 'Will Fang Yuan succeed without detection?' has shifted to 'resistance', indicating he succeeds with minor cost."</bad>
  <good>"Fang Yuan's method succeeds, but at the price of a corrupted minor Gu."</good>
  <bad reason="system jargon, abstract">"Heaven's Loom Gu's core functionality is now directly targeted by Heaven's Will's adaptive countermeasures."</bad>
  <good>"Heaven's Will is now actively interfering with the Heaven's Loom Gu, distorting its readings."</good>
  <bad reason="bundled claims">"Heaven's Loom Gu was used by Fang Yuan for calibrated fate analysis, but experienced targeted interference and distortion."</bad>
  <good>["Fang Yuan calibrates the Heaven's Loom Gu to read fate strands.", "The Heaven's Loom Gu suffers targeted interference mid-reading."]</good>
</examples>

<thoroughness hint="Every structural element in the scene data maps to at least one proposition. A missed delta becomes a continuity hole.">
  <coverage>
    <source name="summary">Commitments the summary makes that aren't captured by deltas below.</source>
    <source name="threadDelta">The in-world event that moves this thread. Use the thread's description as the anchor for what's at stake; describe the moment that shifts it.</source>
    <source name="worldDelta">One proposition per addedNode, framed as a present-tense fact about the entity ("Fang Yuan now distrusts the Heavenly Court").</source>
    <source name="systemDelta.addedNodes">The world rule itself, stated as the world states it (not "rule X is added").</source>
    <source name="relationshipDeltas">The concrete shift ("Pan Chong now resents Fang Yuan").</source>
    <source name="ownershipDeltas">The transfer ("the heirloom passes to Fang Yuan").</source>
    <source name="tieDeltas">The tie established or severed, in plain language.</source>
    <source name="artifactUsages">What the artifact does in the scene, concretely.</source>
    <source name="characterMovements">The arrival/departure as in-world action.</source>
    <source name="events">The underlying happening — translate the event label into prose. If the label is opaque, infer from the surrounding deltas/summary what the label points at.</source>
    <source name="new-entities">That this entity now exists, plus one proposition per meaningful world-node they carry in (each as a fact about that entity).</source>
  </coverage>
</thoroughness>

<rules>
  <rule name="no-dedupe">Do NOT deduplicate across delta types — each delta is its own commitment even if surface wording overlaps. (But the SAME fact restated three times in different words across one source is a single proposition.)</rule>
  <rule name="no-texture">Do NOT include sensory texture, weather, or background atmosphere.</rule>
  <rule name="no-ordering">Do NOT impose ordering — group by source for clarity. Reordering is the planner's job.</rule>
  <rule name="completeness">Completeness matters more than minimalism.</rule>
</rules>

<instructions>
  <step name="walk">Walk through every block of the scene XML. No structural element uncovered.</step>
  <step name="extract">Emit one proposition per delta per the coverage rules. Group by source.</step>
  <step name="phrase">Re-read each proposition. If it contains an identifier, snake_case label, template phrase ("X occurred", "thread Y has shifted"), or quoted thread question — rewrite it as the in-world fact.</step>
</instructions>

<output-format>
Return ONLY JSON: { "propositions": [{"content": "single in-world fact in natural prose", "type": "free-label"}, ...] }
Type is a free label (event, state, rule, relation, secret, goal, transfer, tie, movement, emergence…).
</output-format>`;
}
