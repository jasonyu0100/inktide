/**
 * Prose-generation instructions block — appended to the user prompt for
 * `generateSceneProse`. Two variants depending on whether the scene has an
 * active beat plan: the planned variant carries beat-boundary markers and
 * full mechanism reference; the freeform variant carries the same craft
 * doctrine without the beat machinery.
 *
 * All instruction content is XML-structured so the LLM parses categories
 * and rules rather than skimming prose paragraphs.
 */

import { phaseGraphPriorityEntry } from "../phase/application";

/** Final assembly: inputs + format rules + instructions, the user-prompt
 *  skeleton consumed by `generateSceneProse`. The system prompt stays
 *  high-level (role only); craft detail lives here. */
export function buildSceneProseUserPrompt(args: {
  inputBlocks: string;
  instruction: string;
  /** Pre-built format rules from the prose-format set (`<format-rules>`). */
  formatRules?: string;
  /** First ~200 chars of worldSummary, used as a tone cue. */
  toneCue?: string;
  /** Optional author-voice override that supersedes craft defaults. */
  proseVoiceOverride?: string;
  /** Per-call scene direction (guidance string). */
  direction?: string;
}): string {
  const toneBlock = args.toneCue?.trim()
    ? `\n<tone hint="Match the genre and register of the world.">${args.toneCue.trim()}</tone>`
    : '';
  const voiceBlock = args.proseVoiceOverride?.trim()
    ? `\n<author-voice hint="PRIMARY creative direction — all craft defaults below are subordinate to this voice.">\n${args.proseVoiceOverride.trim()}\n</author-voice>`
    : '';
  const directionBlock = args.direction?.trim()
    ? `\n<scene-direction>\n${args.direction.trim()}\n</scene-direction>`
    : '';
  const formatRulesBlock = args.formatRules?.trim()
    ? `\n<format-rules>\n${args.formatRules.trim()}\n</format-rules>`
    : '';

  return `<inputs>
${args.inputBlocks}
</inputs>${toneBlock}${voiceBlock}${formatRulesBlock}${directionBlock}

${args.instruction}`;
}

/** Shared craft doctrine — dialogue agency, continuity, rhythm — used in
 *  both the planned and freeform variants. Pure XML so categories nest
 *  cleanly under the parent <reference>. */
const CRAFT_DOCTRINE_PLANNED = `
    <rhythm-and-voice>
      <law>The prose profile is law; defaults below apply only when the profile is silent.</law>
      <rule>Where the profile specifies a rhythm (terse, flowing, periodic, cumulative, incantatory, monotonic-by-design, fragmented, staccato), obey the profile. Hemingway and Saramago have opposite rhythms and both are correct.</rule>
      <default>Vary sentence length — short for impact, long for flow, fragments for urgency. Avoid inertial subject-verb-object patterns. Front-load clauses, use appositives, embed dependent clauses.</default>
      <rule>Match the register declared in the prose profile. In dramatic registers, avoid writing like technical documentation. In essayistic, scholarly, or reportorial registers, exposition IS the register — it is a failure only when it displaces a declared dramatic register.</rule>
    </rhythm-and-voice>

    <show-dont-tell>
      <default-for>dramatic registers; adjustable by profile.</default-for>
      <rule register="dramatic">Prefer demonstration over explanation. Show fear through trembling hands, not "He felt fear". Demonstrate themes through events rather than declaring them. Reveal system knowledge through demonstration, dialogue discovery, or consequence rather than narrator exposition.</rule>
      <rule register="essayistic | mythic | oracular | auto-theoretical | omniscient | memoiristic | oral-epic">Narrator commentary, named emotion, direct thematic statement, and expository paragraphs are legitimate primary tools. Borges tells. Tolstoy's essay-chapters tell. Sebald tells. Rushdie's openings address the reader. When the profile declares such a register, "showing" is still earned through particulars (specific image, specific claim, specific citation), but the prohibition against direct statement is lifted.</rule>
      <invariant>Vagueness is the real failure across all registers. "She felt something shift" is weak in every register; "She named the thing that shifted" is strong in reflective registers; "Her hands would not stop" is strong in dramatic registers. The test is specificity, not the verb.</invariant>
    </show-dont-tell>

    <dialogue-agency>
      <intent>Characters with agency SPEAK. The single most common prose failure in this engine is treating multi-character interactions as mute encounters resolved through gesture, narrated intent, or interior thought.</intent>
      <trigger>Any beat where two or more characters share the moment and engage in ANY substantive exchange — negotiation, confrontation, interview, instruction, alliance, persuasion, accusation, request, refusal, reconciliation — must render as actual exchanged words.</trigger>
      <rule name="dominant-not-exclusive">The beat's mechanism is the DOMINANT register, not a mute on the others. A beat slotted as \`action\` in a multi-character moment can carry one to three lines of dialogue inside the action. A beat slotted as \`thought\` during a conversation can foreground the POV's reasoning while the spoken back-and-forth continues underneath. A beat slotted as \`narration\` summarising an exchange should still embed a representative line or two from the actual conversation. Mechanism guides what dominates; it does not silence the room.</rule>
      <bad-pattern>
        <description>Narration AT characters — summaries of what was said.</description>
        <example>Fang Yuan explained the energy signatures to Bai Ning Bing.</example>
        <example>Pan Chong's pleasantries dissolved under Fang Yuan's questions.</example>
        <example>Fang Yuan offered a tactical alliance; Bai Ning Bing nodded sharply.</example>
        <failure>These tell the reader an exchange happened without letting the reader hear it.</failure>
      </bad-pattern>
      <good-pattern>
        <description>Characters audible — render the actual lines, with cadence, subtext, interruption, withheld answers.</description>
        <example>"I trust you," Pan Chong said too fast. — "Then tell me where Lin Xue will be next Tuesday."</example>
        <claim>Even one or two lines of real dialogue in a multi-character beat changes the beat from narrated-about to lived-through. A two-line exchange can land what a paragraph of narration cannot.</claim>
      </good-pattern>
      <rule name="never-narrate-substance">If the plan says "X explains Y to Z", the prose contains X's actual explanation in their voice — and Z's responses, questions, pushback. If the plan says "X interviews Y", the prose contains the actual questions and answers. If the plan says "X and Y form an alliance", the prose contains the words that form the alliance, even if those words are sparse and oblique.</rule>
      <carve-out name="solitary-pov">Scenes with a single character physically present have no dialogue obligation; render via thought / action / environment / memory / document as the plan and profile direct. Recalled / overheard / read speech still counts as dialogue when relevant.</carve-out>
      <carve-out name="register-adjustment">In essayistic, omniscient, or distant-narrator registers, dialogue may be reported (free-indirect, summary with one resonant quote) rather than dramatised — but the words still surface. "She refused, in three sentences he would remember for years; the second was the worst." carries the dialogue's weight without staging it. In dramatic registers, stage it.</carve-out>
    </dialogue-agency>

    <three-continuity-constraints>
      <intent>The prose honours all three. The MODE of honouring them is dictated by the declared register, not by a single craft doctrine.</intent>
      <constraint id="world">The POV perceives only what its senses and existing knowledge allow. New world deltas arrive through specific moments in the scene; they are not referenced before they have been established. (In dramatic registers this is "discovery through action"; in essayistic or omniscient registers it is "the narrator introduces it here for the first time, with evidence".)</constraint>
      <constraint id="threads">Each thread shift lands at a specific moment in the scene. In dramatic registers that moment is usually dramatised through action; in reflective, essayistic, or lyric registers it may be named, stated, or imaged — whatever the profile calls for.</constraint>
      <constraint id="system">New system concepts arrive with grounding — a demonstration, a citation, a consequence, a worked example, or a framing that earns them. What counts as "earning" is register-dependent.</constraint>
    </three-continuity-constraints>`;

const CRAFT_DOCTRINE_FREEFORM = `
    <rhythm-and-voice>
      <law>The prose profile is law; defaults below apply only when the profile is silent.</law>
      <rule>Where the profile specifies a rhythm, obey the profile. Register and stance from PROSE PROFILE above take precedence over the defaults here.</rule>
      <default>Vary sentence length, front-load clauses, use appositives, vary structure.</default>
      <rule>Match the register declared in the prose profile. In dramatic registers, avoid documentation-tone. In essayistic or scholarly registers, exposition IS the register.</rule>
    </rhythm-and-voice>

    <show-dont-tell>
      <default-for>dramatic registers; adjustable by profile.</default-for>
      <rule register="dramatic">Prefer demonstration over explanation — show through body language, action, dialogue subtext; demonstrate themes through events.</rule>
      <rule register="essayistic | mythic | oracular | omniscient | memoiristic | auto-theoretical | oral-epic">Narrator commentary, named emotion, direct thematic statement, and expository paragraphs are legitimate primary tools when the profile declares such a register.</rule>
      <invariant>Vagueness is the real failure across all registers. Specificity — a named image, a named claim, a named source — is strong in every register.</invariant>
    </show-dont-tell>

    <dialogue-agency>
      <intent>Characters with agency SPEAK. The dominant prose failure in this engine is treating multi-character interactions as mute encounters resolved through narration ("X explained Y to Z", "the negotiation collapsed into agreement", "Z nodded").</intent>
      <trigger>When two or more characters share a moment and engage in any substantive exchange (negotiation, confrontation, interview, instruction, alliance, persuasion, request, refusal, reconciliation), render the actual words.</trigger>
      <rule>Even one or two real lines per beat changes the texture from narrated-about to lived-through.</rule>
      <carve-out name="solitary-pov">Solitary POV scenes have no dialogue obligation.</carve-out>
      <carve-out name="distant-register">Distant / essayistic registers may report rather than dramatise — but the words still surface, even if reported. In dramatic registers, stage them.</carve-out>
    </dialogue-agency>

    <three-continuity-constraints>
      <intent>The prose honours all three. The mode of honouring them is dictated by the declared register.</intent>
      <constraint id="world">The POV perceives only what its senses and existing knowledge allow. New world deltas arrive through specific moments in the scene; they are not referenced before they have been established.</constraint>
      <constraint id="threads">Each thread shift lands at a specific moment in the scene. In dramatic registers the shift is usually dramatised; in reflective, essayistic, or lyric registers it may be named, stated, or imaged.</constraint>
      <constraint id="system">New system concepts arrive with grounding appropriate to the register — demonstration, citation, consequence, worked example, or named framing.</constraint>
    </three-continuity-constraints>`;

export function buildProseInstructionsWithPlan(args: { wordsPerBeat: number }): string {
  const { wordsPerBeat } = args;
  return `<instructions>
  <integration-hierarchy hint="When inputs tension, this is the priority order for prose decisions.">
    <priority rank="1">BEAT PLAN — structural backbone; render every beat's propositions in the assigned mechanism, in the assigned order.</priority>
    <priority rank="2">PROSE PROFILE — authorial voice; rules below apply only when the profile is silent on a given dimension.</priority>
    <priority rank="3">SCENE CONTEXT — POV, setting, participants, deltas to land; the substrate the beats render.</priority>
    ${phaseGraphPriorityEntry(4, "scene-prose")}
  </integration-hierarchy>

  <step name="follow-plan">Follow the beat plan sequence — each beat maps to a passage of prose. The mechanism defines the delivery MODE (dialogue, thought, action, etc). The propositions define STORY WORLD FACTS TO TRANSMIT. Weave both into compelling, voiced prose.</step>

  <step name="beat-boundary-markers" hint="After completing the prose for each beat, insert a marker line on its own. These markers track which prose came from which beat and will be stripped from the final output. Place markers BETWEEN beats, not within paragraphs. Do NOT include a marker after the final beat.">
    <marker-format>[BEAT_END:N] — N is the 0-indexed beat number.</marker-format>
    <example structure="3-beat scene">[Prose for beat 0...] / [BEAT_END:0] / [Prose for beat 1...] / [BEAT_END:1] / [Prose for beat 2...]</example>
  </step>

  <reference name="mechanisms" hint="Delivery modes — what each beat's mechanism field tells the writer to do.">
    <format-aware-override>
      <rule>The descriptions below are the PROSE default. Non-prose formats (screenplay, meta-overlay, simulation-overlay) re-render these mechanisms differently; the format-rules block above carries the format-specific translations and OVERRIDES this reference.</rule>
      <rule format="screenplay">Interior mechanisms (\`thought\` / \`narration\` / \`memory\` / \`comic\`) externalise via V.O., flashback cuts, INSERT shots, or pure performance — never as direct internal monologue or authorial commentary on the page.</rule>
    </format-aware-override>

    <mechanism-catalog default-format="prose">
      <mechanism id="dialogue">
        <definition>A substantive EXCHANGE of quoted speech between characters.</definition>
        <rule>Not a single line with a tag. Unfold it: at least 3–5 turns, distinct voices, subtext (what is NOT said), interruptions or silences that carry weight, non-verbal business (glances, gestures, pauses) interleaved between lines.</rule>
        <rule>Dialogue carries the bulk of the beat's word budget.</rule>
        <failure>A "dialogue" beat that resolves in one or two quoted sentences has failed the mechanism — either expand it into a real conversation or switch the mechanism.</failure>
        <claim>In dramatic registers, dialogue is where character and conflict live; treat it accordingly.</claim>
        <worked-example beat="Shen Lin confronts Meng Song about the missing ledger">
          <failure-render>
            Shen Lin demanded to know where the ledger was. "Don't play dumb," he said. Meng Song shrugged. "I have no idea what you're talking about."
          </failure-render>
          <success-render>
            "The ledger." Shen Lin didn't sit. He set his palms flat on the table, as though the wood might lie if he didn't hold it down. "The one from the eastern storehouse."
            Meng Song looked up from his tea. "You'll have to be more specific. I've signed off on four ledgers this week."
            "You know which one."
            "I know which one you've been losing sleep over." Meng Song tilted the cup, watched a leaf fold in on itself. "That's a different question."
            Silence. Outside, a guard's footfall receded down the corridor, then returned, paused, moved on.
            "If the inspector finds discrepancies —"
            "He won't." Meng Song set the cup down. His fingers were steady. "Because the ledger he sees will be the correct one." A small, almost fond smile. "I thought you trusted me, Shen Lin."
            Shen Lin's palms left marks on the wood. He didn't answer. He didn't need to.
          </success-render>
          <annotation>Each character has a distinct cadence (Shen Lin clipped, Meng Song elliptical); the subtext (accusation, evasion, power inversion) is carried by what is implied rather than stated; the non-verbal business (palms on table, the tea leaf, the footsteps outside, the withheld answer) does as much work as the quoted lines; the silence at the midpoint is a turn. Aim for this density and texture whenever dialogue is the declared mechanism — adapted to the prose profile's register and voice.</annotation>
        </worked-example>
      </mechanism>
      <mechanism id="thought">Internal monologue, POV character's private reasoning.</mechanism>
      <mechanism id="action">Physical movement, gesture, interaction with objects.</mechanism>
      <mechanism id="environment">Setting, weather, sensory details of the space.</mechanism>
      <mechanism id="narration">Authorial voice, rhetoric, time compression.</mechanism>
      <mechanism id="memory">Flashback triggered by association.</mechanism>
      <mechanism id="document">Embedded text (letter, sign, excerpt) shown literally.</mechanism>
      <mechanism id="comic">Humor, irony, absurdity, undercut expectations.</mechanism>
    </mechanism-catalog>

    <propositions>
      <intent>Propositions are facts the scene must establish. The mode of transmission is dictated by the declared register.</intent>
      <rule register="dramatic-realist">Prefer demonstration over verbatim assertion. "Mist covers the village" → transmit via sensory detail (dampness on skin, visibility reduced), action (houses emerge from whiteness), or environment description — not as a flat declaration.</rule>
      <rule register="lyric | mythic | fabulist | aphoristic | omniscient | essayistic">Direct statement is legitimate and sometimes primary. "Mist covered the village, and the village stopped speaking of its dead." is a valid transmission.</rule>
      <rule register="declarative | expository | essay | research | distant-memoir">Propositions can be stated, attributed, and grounded. "The research shows X" is the point, not a failure.</rule>
      <invariant>The reader comes to hold the fact as true. How that holding is earned is register-dependent.</invariant>
    </propositions>
${CRAFT_DOCTRINE_PLANNED}

    <beat-sizing target="${wordsPerBeat}">
      <intent>Each beat is a ~${wordsPerBeat}-word chunk of prose. The plan was built on this convention so beat weight stays consistent across the work.</intent>
      <rule>Write each beat at approximately ${wordsPerBeat} words of prose. A light beat may land at ~${Math.round(wordsPerBeat * 0.7)}; a dense dialogue or action beat with many propositions may stretch to ~${Math.round(wordsPerBeat * 1.3)}. Treat this as the rhythm budget, not a hard cap.</rule>
      <rule>The plan has already balanced proposition load across beats assuming this size. If a beat carries 4 propositions, it needs ~${wordsPerBeat} words to land all four with texture; compressing into 40 words will drop or flatten them. Expanding into 200 words will bloat the rhythm and push the scene long.</rule>
      <rule>Consistency matters. A ~${Math.round(wordsPerBeat * 0.5)}-word beat followed by a ~${wordsPerBeat * 2}-word beat reads as broken rhythm. Keep consecutive beats comparable in length unless the plan's mechanism/function explicitly calls for contrast.</rule>
      <rule>Brevity is still a virtue — do not pad to hit the target. If a beat can honestly deliver its propositions in fewer words, write fewer words. Just do not cut propositions to fit.</rule>
    </beat-sizing>

    <closing-rules>
      <rule>Satisfy every logical requirement and achieve every proposition in whatever mode the profile declares.</rule>
      <rule name="prose-profile-compliance">Every sentence conforms to the voice, register, devices, and rules declared in the profile. If the profile forbids figurative language, use zero figures of speech. If it requires specific devices, use them. The profile is the authorial voice — match it.</rule>
    </closing-rules>
  </reference>
</instructions>`;
}

export function buildProseInstructionsFreeform(args: { wordsPerBeat: number }): string {
  const { wordsPerBeat } = args;
  return `<instructions>
  <integration-hierarchy hint="No beat plan in this mode — priority order for prose decisions:">
    <priority rank="1">PROSE PROFILE — authorial voice; rules below apply only when the profile is silent on a given dimension.</priority>
    <priority rank="2">SCENE CONTEXT — POV, setting, participants, deltas; the substrate to render.</priority>
    ${phaseGraphPriorityEntry(3, "scene-prose")}
  </integration-hierarchy>

  <reference name="craft-doctrine" hint="The craft rules. The prose profile is always law; rules below apply only when the profile is silent.">
${CRAFT_DOCTRINE_FREEFORM}

    <delivery-mandate>
      <rule>Render every thread shift, world change, relationship delta, and system reveal in the mode the profile declares.</rule>
      <rule>Foreshadow through imagery, subtext, or explicit framing as the profile prefers.</rule>
    </delivery-mandate>

    <beat-sizing target="${wordsPerBeat}">
      <intent>Even without a plan, think in ~${wordsPerBeat}-word beats.</intent>
      <rule>The scene reads as a sequence of beats of roughly consistent weight — one beat ≈ one paragraph or tight scene moment, ≈${wordsPerBeat} words. This keeps rhythm even and propositions evenly distributed.</rule>
      <rule>No fixed floor, no padding — but if a single beat runs past ~${wordsPerBeat * 2} words, it is probably two beats.</rule>
    </beat-sizing>

    <opening-transition hint="Read the <time-gap> on the scene.">
      <intent>Good storytelling weaves the passage of time into narrative texture so the reader always feels it without ever reading it as a timestamp or log entry. The gap size shifts how visible the weaving is, not whether it happens.</intent>
      <gap level="minor" magnitude="concurrent | hours | same-day | multi-day">Texture only — a candle now lit, light fallen low, a chair pushed back, a character visibly tired. NEVER write "X hours later" or "the next morning,".</gap>
      <gap level="notable" magnitude="multi-week">Weave a clearer signal through weather, a finished task, a small status change. Still texture, not statement.</gap>
      <gap level="major" magnitude="multi-month">Weight the opening with a re-anchor — status update, changed season, healed wound, matured plan. Naming the elapsed time directly is permitted here when it carries narrative force.</gap>
      <gap level="generational" magnitude="year+">Must be marked with weight — montage, aged-up description, environmental change. Underplaying a generational jump reads as continuity error.</gap>
    </opening-transition>

    <closing-rules>
      <rule name="prose-profile-compliance">Every sentence conforms to the declared voice, register, devices, and rules. If the profile forbids figures of speech, use zero. If it requires specific devices, use them.</rule>
    </closing-rules>
  </reference>
</instructions>`;
}
