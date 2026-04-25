/**
 * User prompts for the scene-plan pipeline:
 * - `buildScenePlanUserPrompt` — primary plan generator. Compulsory
 *   propositions + grounding pool + narrative context → beat plan.
 * - `buildScenePlanEditUserPrompt` — repair pass. Edits an existing plan to
 *   address verdict-driven issues without rewriting working beats.
 * - `buildBeatAnalystUserPrompt` — reverse-engineering pass that annotates
 *   ~100-word prose chunks with beat fn/mechanism/propositions.
 */

export function buildScenePlanUserPrompt(args: {
  /** Pre-built input blocks joined into the `<inputs>` body. */
  inputBlocks: string;
}): string {
  return `<inputs>
${args.inputBlocks}
</inputs>

<instructions>
  <step name="generate">Generate a beat plan that GLUES the compulsory propositions into the narrative flow: reordered for effect, grouped into beats, paced with varied mechanisms, and enriched with a tight selection of bridge propositions drawn from the grounding pool (visual identity, accumulated continuity) and the wider narrative context. Coverage of the compulsory list is non-negotiable; ORDERING, GROUPING, and which grounding facts to surface are your craft decisions. Prose delivery will follow the prose profile — your job is the skeleton, not the voice.</step>

  <step name="grounding-selection">When picking which grounding facts become bridge propositions:
    <rule>Match the mechanism — visual ↔ environment/action/first-presence; beliefs/secrets/goals ↔ thought/dialogue; history/relation ↔ memory/callback; capability/weakness ↔ action under pressure.</rule>
    <rule>Match the moment — only surface a continuity fact if THIS beat would naturally call it up. A character's old grudge belongs in the beat where they meet that person, not three beats earlier.</rule>
    <rule>One or two glue facts per beat is plenty. Six grounding facts crammed into one beat is a checklist, not prose.</rule>
    <rule>Visual identity must appear at least once per scene per visible participant. Once is grounding, twice is repetition.</rule>
    <rule>Bridge propositions are CLEARLY callbacks (the prose recognises them as already-known), distinct from compulsory propositions which are FRESH commitments.</rule>
  </step>

  <step name="opening-shape">Check the time-gap on the scene. Good storytelling weaves the passage of time into narrative texture so the reader always feels it without ever reading it as a timestamp. The gap size shifts how visible the weaving is, not whether it happens.
    <gap size="minor" range="concurrent · hours · same-day · multi-day">Texture only — light, mood, weather, wear, what's changed. NEVER a "X days later" beat.</gap>
    <gap size="notable" range="multi-week">Weave a clearer signal — a season turning, a project moved on, a wound healing. Still texture, not statement.</gap>
    <gap size="major" range="multi-month">Weight it with a re-anchor beat (status update, changed season, plan bearing fruit). Naming the elapsed time directly is permitted when it carries force.</gap>
    <gap size="generational" range="year+">Must be acknowledged with weight — a montage beat, an aged-up reveal, an environmental change. Underplaying reads as continuity error.</gap>
  </step>
</instructions>`;
}

export function buildScenePlanEditUserPrompt(args: {
  fullContext: string;
  sceneSummary: string;
  currentPlanJson: string;
  issueXml: string;
  beatFnList: string;
  beatMechanismList: string;
}): string {
  const { fullContext, sceneSummary, currentPlanJson, issueXml, beatFnList, beatMechanismList } = args;

  return `<inputs>
  <narrative-context hint="Branch-scoped continuity backdrop.">
${fullContext}
  </narrative-context>
  <scene-summary>${sceneSummary}</scene-summary>
  <current-plan hint="The plan you are editing. JSON form for direct comparison with the output schema.">
${currentPlanJson}
  </current-plan>
  <issues hint="Every issue below must be addressed in the returned plan.">
${issueXml}
  </issues>
</inputs>

<instructions>
  <step name="edit">Edit the beat plan to address every issue. You may modify a beat's fn / mechanism / what / propositions, add new beats (to fill gaps or add missing setups), remove beats (redundant or contradictory), or reorder beats (sequencing is wrong).</step>
  <step name="preserve">Keep beats that have NO issues exactly as they are — do not rewrite beats that are working.</step>
  <step name="what-discipline" hint="The 'what' field is a STRUCTURAL SUMMARY of what happens, NOT pre-written prose.">
    <example type="good">Guard confronts him about the forged papers — structural event.</example>
    <example type="bad">He muttered, 'The academy won't hold me long' — pre-written prose with quotes.</example>
    <example type="good">Mist covers the village — simple fact.</example>
    <example type="bad">Mist clung, blurring the distinction... — literary prose.</example>
    <rule>Strip adjectives, adverbs, literary embellishments. State the event, not its texture.</rule>
  </step>
</instructions>

<output-format>
Return the COMPLETE plan (all beats, not just changed ones) as JSON:
{
  "beats": [
    { "fn": "${beatFnList}", "mechanism": "${beatMechanismList}", "what": "...", "propositions": [{"content": "..."}] }
  ],
  "propositions": [{"content": "..."}]
}
</output-format>`;
}

export function buildBeatAnalystUserPrompt(args: {
  summary: string;
  chunkCount: number;
  chunksJson: string;
}): string {
  return `<inputs>
  <scene-summary>${args.summary}</scene-summary>
  <chunks count="${args.chunkCount}" hint="~100 words each. Annotate each chunk with its beat function, mechanism, and propositions. One beat per chunk, in order.">
${args.chunksJson}
  </chunks>
</inputs>

<instructions>
  <step name="annotate">Annotate each chunk with its beat function, mechanism, and propositions. One beat per chunk, in order.</step>
  <step name="density">Extract propositions per density guidelines — light fiction gets 1-2 props/beat, technical prose gets exhaustive extraction.</step>
</instructions>

<constraints>
  <constraint>Return exactly ${args.chunkCount} beats — one per chunk.</constraint>
  <constraint>Use ONLY these 10 beat functions: breathe, inform, advance, bond, turn, reveal, shift, expand, foreshadow, resolve.</constraint>
</constraints>`;
}

/** XML fragment for the compulsory-propositions block — its own rules sub-block
 *  + the proposition list. Inserted into the scene-plan user-prompt inputs. */
export function buildCompulsoryPropositionsBlock(args: {
  propositions: { content: string; type?: string }[];
}): string {
  if (args.propositions.length === 0) return '';
  const propsXml = args.propositions
    .map(
      (p, i) =>
        `    <proposition index="${i + 1}"${p.type ? ` type="${p.type}"` : ''}>${p.content}</proposition>`,
    )
    .join('\n');
  return `<compulsory-propositions hint="The prose MUST transmit every one of these facts — they are the scene's commitments. List is in EXTRACTION ORDER (grouped by structural source); extraction order is NOT delivery order.">
  <rules>
    <rule name="coverage">Every proposition lands in some beat. None dropped.</rule>
    <rule name="reorder">Sequence them for maximum narrative effect — late reveals, early hooks, payoff after setup, interleaved lines of action. Page order is a craft decision; extraction order is just a checklist.</rule>
    <rule name="glue">Where the narrative context shows a gap (a relationship not seen recently, a rule about to be invoked, a memory that frames a moment), add a small number of glue propositions from grounding/narrative-context to bridge. Glue enriches; it does not replace.</rule>
    <rule name="group">Multiple propositions can share a beat when they deliver together (a single dialogue exchange can carry three thread moves). Don't force 1:1.</rule>
    <rule name="delivery">Prose style follows the prose-profile, not a rigid order. The profile decides whether propositions are demonstrated, stated, or imaged; the plan only says WHERE each lands and WHICH mechanism carries it.</rule>
  </rules>
  <propositions>
${propsXml}
  </propositions>
</compulsory-propositions>`;
}
