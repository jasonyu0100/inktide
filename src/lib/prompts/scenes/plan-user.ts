/**
 * User prompts for the scene-plan pipeline:
 * - `buildScenePlanUserPrompt` — primary plan generator. Compulsory
 *   propositions + grounding pool + narrative context → beat plan. Carries
 *   the full taxonomy, density bands, output schema, and mechanism guidance
 *   (the system prompt is just the architect role).
 * - `buildScenePlanEditUserPrompt` — repair pass. Edits an existing plan to
 *   address verdict-driven issues without rewriting working beats.
 * - `buildBeatAnalystUserPrompt` — reverse-engineering pass that annotates
 *   ~100-word prose chunks with beat fn/mechanism/propositions.
 */

import { BEAT_FN_LIST, BEAT_MECHANISM_LIST } from "@/types/narrative";
import { PROMPT_BEAT_TAXONOMY } from "../core/beat-taxonomy";
import { PROMPT_PROPOSITIONS } from "../core/propositions";
import { WORDS_PER_BEAT, BEATS_PER_SCENE, WORDS_PER_SCENE } from "@/lib/constants";

export function buildScenePlanUserPrompt(args: {
  /** Pre-built input blocks joined into the `<inputs>` body. */
  inputBlocks: string;
}): string {
  return `<inputs>
${args.inputBlocks}
</inputs>

<beat-sizing hint="Each beat is a ~${WORDS_PER_BEAT}-word chunk. Consistent rhythm: no bloated paragraphs, no thin lines.">
  <density>A beat carries 2-6 propositions in standard fiction, more in dense registers.</density>
  <coverage>Pack each beat with the most propositions it carries at ~${WORDS_PER_BEAT} words, then roll overflow into a new beat. Every compulsory proposition and every structural delta MUST land in at least one beat — beats are cheap, lost claims are not.</coverage>
  <rhythm>Consecutive beats should carry comparable proposition loads; redistribute when they don't.</rhythm>
  <reference-envelope hint="Outcome, not quota.">~${WORDS_PER_SCENE} words / ~${BEATS_PER_SCENE} beats for a standard scene; 4-6 for a breather, 14-18 for a richly-threaded scene. Count follows content at the ~${WORDS_PER_BEAT}-word constraint.</reference-envelope>
</beat-sizing>

<profile-conformance>The scene context includes a PROSE PROFILE with rules and anti-patterns. Propositions MUST conform to the profile's style — plain factual if figurative is forbidden, evocative if allowed.</profile-conformance>

<output-format>
Return ONLY valid JSON matching this schema:
{
  "beats": [
    {
      "fn": "${BEAT_FN_LIST.join("|")}",
      "mechanism": "${BEAT_MECHANISM_LIST.join("|")}",
      "what": "STRUCTURAL SUMMARY: what happens, not how it reads",
      "propositions": [
        {"content": "atomic claim", "type": "state|claim|definition|formula|evidence|rule|comparison|example"}
      ]
    }
  ],
  "propositions": [{"content": "atomic claim", "type": "state"}]
}
</output-format>

${PROMPT_BEAT_TAXONOMY}

${PROMPT_PROPOSITIONS}

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

  <rules>
    <rule name="opening">Open the scene in whatever way its form demands. Most scenes open with 1-3 breathe beats to ground the reader physically. Scenes explicitly structured as in-medias-res, epistolary/document-first, thesis-first (essay), dream-logic, direct-address, or refrain/invocation-opening may open with their structural device — the prose profile or form declaration decides.</rule>
    <rule name="prose-budget">Prose budget drives beat count. Each beat should carry weight: landing a proposition, delivering a delta, executing a shift. Beats that don't move the scene forward are padding — cut them and the prose budget with them.</rule>
    <rule name="delta-coverage">Every structural delta (thread, world, relationship, system knowledge) must map to at least one beat.</rule>
    <rule name="thread-triggers">Thread transitions need a concrete trigger in the 'what' field.</rule>
    <rule name="discovery-mechanism">Knowledge gains need a discovery mechanism (overheard, read, deduced, confessed, cited, witnessed).</rule>
    <rule name="relationship-shift">Relationship shifts need a catalytic moment.</rule>
    <rule name="specificity">Be specific: "She asks about the missing shipment; he deflects" not "A tense exchange."</rule>

    <rule name="structural-but-mechanism-aware" hint="'what' describes WHAT HAPPENS, not how it reads as prose — strip adjectives, adverbs, and literary embellishments. But 'what' must ALSO scaffold the beat's mechanism so the prose writer can deliver both the facts (propositions) AND the mechanism (rendering).">
      <per-mechanism>
        <mechanism name="dialogue">WHO speaks to WHOM, the SUBJECT, the TENSION or subtext.
          <example type="good">"Lin pushes Marcus on the timeline; Marcus deflects with small talk about the weather, sizing up Lin's resolve."</example>
          <example type="bad">"They discuss the plan."</example>
        </mechanism>
        <mechanism name="action">SPECIFIC physical events, actors, affected targets.
          <example type="good">"Hadley swings the bat at the lock while Tomas drags the body clear."</example>
          <example type="bad">"A fight breaks out."</example>
        </mechanism>
        <mechanism name="thought">The MENTAL OPERATION and its subject.
          <example type="good">"Sarah runs through the last three hires, hunting the pattern Daniels flagged."</example>
          <example type="bad">"She thinks about the past."</example>
        </mechanism>
        <mechanism name="environment">SENSORY / SPATIAL elements foregrounded.
          <example type="good">"The kitchen still ticks warm, back door hanging open to wet grass."</example>
          <example type="bad">"An atmospheric establishing shot."</example>
        </mechanism>
        <mechanism name="narration">The SYNTHETIC operation (time compression / signposting / commentary).
          <example type="good">"Three weeks of routines compressed into a paragraph."</example>
          <example type="bad">"Time passes."</example>
        </mechanism>
        <mechanism name="memory">The TRIGGER and what's RECALLED.
          <example type="good">"Tobacco smell triggers her grandmother teaching her to pick locks during curfew."</example>
          <example type="bad">"She remembers."</example>
        </mechanism>
        <mechanism name="document">The DOCUMENT TYPE and its CONTENT or substance.
          <example type="good">"A telegram from Müller: three lines confirming the meeting, warning her to come alone."</example>
          <example type="bad">"A letter arrives."</example>
        </mechanism>
        <mechanism name="comic">The COMIC DEVICE and its TARGET.
          <example type="good">"Ron's offended mutter lands as bathos against the tension."</example>
          <example type="bad">"Humor lands."</example>
        </mechanism>
      </per-mechanism>
      <discipline>Don't pre-write prose in 'what'; do give enough structure that quoted lines, specific physical moves, or named sensory details can be rendered without the prose writer inventing facts.</discipline>
    </rule>

    <rule name="fixed-beat-slots" hint="When provided in context, the sampler has pre-assigned each beat's fn and mechanism.">
      <directive>Copy them verbatim from the slot into the beat output, in order. Your authorship is limited to \`what\` and \`propositions\` per beat. The slots encode the story's voice; overriding them drifts the voice.</directive>
      <directive>If the content genuinely fits in fewer beats than slots, stop early and the trailing slots are discarded; if you need more beats, continue past the last slot and the sampler will extend server-side.</directive>
      <fallback when="no slots provided" hint="Sampling turned off.">
        Pick \`fn\` and \`mechanism\` using the beat taxonomy above; aim for at least 3 distinct mechanisms across a multi-beat scene; LEAN INTO DIALOGUE where the scene earns it — dialogue is the mechanism LLMs habitually under-weight, and live-written fiction reads flat when every beat is action or narration. Dialogue isn't the right choice for every beat, but if two beats could plausibly be either dialogue or action/narration, pick dialogue unless the scene's register explicitly argues otherwise (solitary POV, contemplative montage, analytical essay register).
      </fallback>
    </rule>

    <rule name="mechanism-rendering">The mechanism names the beat's DOMINANT register. The prose writer may use the register's full rendering vocabulary (free-indirect / reported / choral for dialogue; image / refrain / catalogue for comic). A dialogue beat must plan a SUBSTANTIVE exchange — multiple turns with subtext; a single tagged quote is not a dialogue beat. If a slot's mechanism feels off for the scene (e.g. dialogue in a solitary POV), render creatively within that mechanism (interior speech, muttered aside, conversation with an absent party) rather than substituting — the mix is the voice.</rule>
  </rules>
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

<vocabulary>
  <beat-functions>${beatFnList}</beat-functions>
  <mechanisms>${beatMechanismList}</mechanisms>
</vocabulary>

<rewrite-rules name="structure-preservation">
  <rule>KEEP the same number of beats unless feedback explicitly requests adding/removing beats.</rule>
  <rule>KEEP unchanged beats EXACTLY as they are (same fn, mechanism, what, propositions).</rule>
  <rule>ONLY MODIFY beats that the feedback specifically targets.</rule>
  <rule>Preserve the overall scene arc and flow.</rule>
</rewrite-rules>

<propositions hint="Atomic claims that capture what the reader learns. When you modify a beat's 'what' field, update its propositions to match.">
  <density>2-4 propositions per beat for standard fiction.</density>
  <types>state, belief, relationship, event, rule, secret, motivation, claim, discovery.</types>
  <extract>concrete events, physical states, character beliefs/goals/discoveries, world rules, relationship shifts.</extract>
  <skip>atmospheric texture, literary devices, how things are described.</skip>
</propositions>

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

<output-format>
Return ONLY valid JSON matching this schema:
{
  "beats": [
    {
      "index": 0,
      "fn": "${BEAT_FN_LIST.join("|")}",
      "mechanism": "${BEAT_MECHANISM_LIST.join("|")}",
      "what": "STRUCTURAL SUMMARY: what happens, not how it reads",
      "propositions": [
        {"content": "atomic claim", "type": "state|claim|definition|formula|evidence|rule|comparison|example"}
      ]
    }
  ]
}
</output-format>

${PROMPT_BEAT_TAXONOMY}

${PROMPT_PROPOSITIONS}

<instructions>
  <step name="annotate">Annotate each chunk with its beat function, mechanism, and propositions. One beat per chunk, in order.</step>
  <step name="density">Extract propositions per density guidelines — light fiction gets 1-2 props/beat, technical prose gets exhaustive extraction.</step>
  <rule name="structural-summaries-only" hint="The 'what' field describes WHAT HAPPENS, not how it reads. Strip adjectives, adverbs, and literary embellishments.">
    <example type="good">"Guard confronts him about the forged papers"</example>
    <example type="bad">"He muttered, 'The academy won't hold me long'"</example>
  </rule>
  <rule name="mechanism-choice">Mechanism choice must match how the prose was actually written (see beat taxonomy above for definitions + edge cases).</rule>
</instructions>

<constraints>
  <constraint>Return EXACTLY ${args.chunkCount} beats, indexed 0 through ${args.chunkCount - 1}. Do NOT merge, skip, or add chunks.</constraint>
  <constraint>Every beat needs fn, mechanism, and what.</constraint>
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
