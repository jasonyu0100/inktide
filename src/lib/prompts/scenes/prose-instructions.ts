/**
 * Prose-generation instructions block — appended to the user prompt for
 * `generateSceneProse`. Two variants depending on whether the scene has an
 * active beat plan: the planned variant carries beat-boundary markers and
 * full mechanism reference; the freeform variant carries the same craft
 * doctrine without the beat machinery.
 */

/** Final assembly: inputs + instructions, the user-prompt skeleton consumed
 *  by `generateSceneProse`. */
export function buildSceneProseUserPrompt(args: {
  inputBlocks: string;
  instruction: string;
}): string {
  return `<inputs>
${args.inputBlocks}
</inputs>

${args.instruction}`;
}

export function buildProseInstructionsWithPlan(args: { wordsPerBeat: number }): string {
  const { wordsPerBeat } = args;
  return `<instructions>
  <step name="follow-plan">Follow the beat plan sequence — each beat maps to a passage of prose. The mechanism defines the delivery MODE (dialogue, thought, action, etc). The propositions define STORY WORLD FACTS TO TRANSMIT. Weave both into compelling, voiced prose.</step>

  <step name="beat-boundary-markers" hint="After completing the prose for each beat, insert a marker line on its own. These markers track which prose came from which beat and will be stripped from the final output. Place markers BETWEEN beats, not within paragraphs. Do NOT include a marker after the final beat.">
    <marker-format>[BEAT_END:N] — N is the 0-indexed beat number.</marker-format>
    <example structure="3-beat scene">
[Prose for beat 0...]

[BEAT_END:0]

[Prose for beat 1...]

[BEAT_END:1]

[Prose for beat 2...]
    </example>
  </step>

  <reference name="mechanisms" hint="Delivery modes — what each beat's mechanism field tells the writer to do.">

MECHANISMS define delivery mode:
- dialogue → a substantive EXCHANGE of quoted speech between characters. A dialogue beat is NOT a single line with a tag. Unfold it: at least 3–5 turns, distinct voices, subtext (what is NOT said), interruptions or silences that carry weight, non-verbal business (glances, gestures, pauses) interleaved between lines. Dialogue carries the bulk of the beat's word budget. A "dialogue" beat that resolves in one or two quoted sentences has failed the mechanism — either expand it into a real conversation or switch the mechanism. In dramatic registers, dialogue is where character and conflict live; treat it accordingly.

  WORKED EXAMPLE — beat: "Shen Lin confronts Meng Song about the missing ledger"

  FAILURE (one-line exchange, mechanism collapsed):
    Shen Lin demanded to know where the ledger was. "Don't play dumb," he said. Meng Song shrugged. "I have no idea what you're talking about."

  SUCCESS (multi-turn exchange, subtext, non-verbal business, distinct voices):
    "The ledger." Shen Lin didn't sit. He set his palms flat on the table, as though the wood might lie if he didn't hold it down. "The one from the eastern storehouse."
    Meng Song looked up from his tea. "You'll have to be more specific. I've signed off on four ledgers this week."
    "You know which one."
    "I know which one you've been losing sleep over." Meng Song tilted the cup, watched a leaf fold in on itself. "That's a different question."
    Silence. Outside, a guard's footfall receded down the corridor, then returned, paused, moved on.
    "If the inspector finds discrepancies —"
    "He won't." Meng Song set the cup down. His fingers were steady. "Because the ledger he sees will be the correct one." A small, almost fond smile. "I thought you trusted me, Shen Lin."
    Shen Lin's palms left marks on the wood. He didn't answer. He didn't need to.

  Notice the elements: each character has a distinct cadence (Shen Lin clipped, Meng Song elliptical); the subtext (accusation, evasion, power inversion) is carried by what is implied rather than stated; the non-verbal business (palms on table, the tea leaf, the footsteps outside, the withheld answer) does as much work as the quoted lines; the silence at the midpoint is a turn. THIS is a dialogue beat. Aim for this level of density and texture whenever dialogue is the declared mechanism — adapted, of course, to the prose profile's register and voice.
- thought → internal monologue, POV character's private reasoning
- action → physical movement, gesture, interaction with objects
- environment → setting, weather, sensory details of the space
- narration → authorial voice, rhetoric, time compression
- memory → flashback triggered by association
- document → embedded text (letter, sign, excerpt) shown literally
- comic → humor, irony, absurdity, undercut expectations

PROPOSITIONS are facts the scene must establish. The mode of transmission is dictated by the declared register:
- In dramatic-realist registers, prefer demonstration over verbatim assertion. Proposition: "Mist covers the village" → transmit via sensory detail (dampness on skin, visibility reduced), action (houses emerge from whiteness), or environment description — not as a flat declaration.
- In lyric, mythic, fabulist, aphoristic, omniscient, or essayistic registers, direct statement is legitimate and sometimes primary. "Mist covered the village, and the village stopped speaking of its dead." is a valid transmission in those registers.
- In declarative / expository registers (essay, research, memoir at distance), propositions can be stated, attributed, and grounded — "The research shows X" is the point, not a failure.
- The reader comes to hold the fact as true. How that holding is earned is register-dependent.

RHYTHM & VOICE — the prose profile is law; the defaults below apply only when the profile is silent:
- Where the profile specifies a rhythm (terse, flowing, periodic, cumulative, incantatory, monotonic-by-design, fragmented, staccato), obey the profile. Hemingway and Saramago have opposite rhythms and both are correct.
- Default (profile silent): vary sentence length — short for impact, long for flow, fragments for urgency; avoid inertial subject-verb-object patterns; front-load clauses, use appositives, embed dependent clauses.
- Match the register declared in the prose profile. In dramatic registers, avoid writing like technical documentation. In essayistic, scholarly, or reportorial registers, exposition IS the register — it is a failure only when it displaces a declared dramatic register.

SHOW, DON'T TELL — default for dramatic registers, adjustable by profile:
- In dramatic registers: prefer demonstration over explanation. Show fear through trembling hands, not "He felt fear". Demonstrate themes through events rather than declaring them. Reveal system knowledge through demonstration, dialogue discovery, or consequence rather than narrator exposition.
- In essayistic, mythic, oracular, auto-theoretical, omniscient, memoiristic, or oral-epic registers: narrator commentary, named emotion, direct thematic statement, and expository paragraphs are legitimate primary tools. Borges tells. Tolstoy's essay-chapters tell. Sebald tells. Rushdie's openings address the reader. When the profile declares such a register, "showing" is still earned through particulars (specific image, specific claim, specific citation), but the prohibition against direct statement is lifted.
- Universal across registers: vagueness is the real failure. "She felt something shift" is weak in every register; "She named the thing that shifted" is strong in reflective registers; "Her hands would not stop" is strong in dramatic registers. The test is specificity, not the verb.

THREE CONTINUITY CONSTRAINTS — the prose honours all three. The *mode* of honouring them is dictated by the declared register, not by a single craft doctrine:
1. WORLD: the POV perceives only what its senses and existing knowledge allow. New world deltas arrive through specific moments in the scene; they are not referenced before they have been established. (In dramatic registers this is "discovery through action"; in essayistic or omniscient registers it is "the narrator introduces it here for the first time, with evidence".)
2. THREADS: each thread shift lands at a specific moment in the scene. In dramatic registers that moment is usually dramatised through action; in reflective, essayistic, or lyric registers it may be named, stated, or imaged — whatever the profile calls for.
3. SYSTEM: new system concepts arrive with grounding — a demonstration, a citation, a consequence, a worked example, or a framing that earns them. What counts as "earning" is register-dependent.

BEAT SIZING — EACH BEAT IS A ~${wordsPerBeat}-WORD CHUNK OF PROSE. The plan was built on this convention: every beat is allocated roughly ${wordsPerBeat} words so beat weight stays consistent across the work.
- Write each beat at approximately ${wordsPerBeat} words of prose. A light beat may land at ~${Math.round(wordsPerBeat * 0.7)}; a dense dialogue or action beat with many propositions may stretch to ~${Math.round(wordsPerBeat * 1.3)}. Treat this as the rhythm budget, not a hard cap.
- The plan has already balanced proposition load across beats assuming this size. If a beat carries 4 propositions, it needs ~${wordsPerBeat} words to land all four with texture; compressing into 40 words will drop or flatten them. Expanding into 200 words will bloat the rhythm and push the scene long.
- Consistency matters. A ~${Math.round(wordsPerBeat * 0.5)}-word beat followed by a ~${wordsPerBeat * 2}-word beat reads as broken rhythm. Keep consecutive beats comparable in length unless the plan's mechanism/function explicitly calls for contrast.
- Brevity is still a virtue — do not pad to hit the target. If a beat can honestly deliver its propositions in fewer words, write fewer words. Just do not cut propositions to fit.

Satisfy every logical requirement and achieve every proposition in whatever mode the profile declares.

PROSE PROFILE COMPLIANCE: every sentence conforms to the voice, register, devices, and rules declared above. If the profile forbids figurative language, use zero figures of speech. If it requires specific devices, use them. The profile is the authorial voice — match it.
  </reference>
</instructions>`;
}

export function buildProseInstructionsFreeform(args: { wordsPerBeat: number }): string {
  const { wordsPerBeat } = args;
  return `<instructions>
  <reference name="craft-doctrine" hint="The craft rules. The prose profile is always law; rules below apply only when the profile is silent.">

RHYTHM & VOICE — the prose profile is law; the defaults below apply only when the profile is silent:
- Where the profile specifies a rhythm, obey the profile. Register and stance from PROSE PROFILE above take precedence over the defaults here.
- Default (profile silent): vary sentence length, front-load clauses, use appositives, vary structure.
- Match the register declared in the prose profile. In dramatic registers, avoid documentation-tone. In essayistic or scholarly registers, exposition IS the register.

SHOW, DON'T TELL — default for dramatic registers, adjustable by profile:
- In dramatic registers: prefer demonstration over explanation — show through body language, action, dialogue subtext; demonstrate themes through events.
- In essayistic, mythic, oracular, omniscient, memoiristic, auto-theoretical, or oral-epic registers: narrator commentary, named emotion, direct thematic statement, and expository paragraphs are legitimate primary tools when the profile declares such a register.
- Universal across registers: vagueness is the real failure. Specificity — a named image, a named claim, a named source — is strong in every register.

THREE CONTINUITY CONSTRAINTS — the prose honours all three. The mode of honouring them is dictated by the declared register:
1. WORLD: the POV perceives only what its senses and existing knowledge allow. New world deltas arrive through specific moments in the scene; they are not referenced before they have been established.
2. THREADS: each thread shift lands at a specific moment in the scene. In dramatic registers the shift is usually dramatised; in reflective, essayistic, or lyric registers it may be named, stated, or imaged.
3. SYSTEM: new system concepts arrive with grounding appropriate to the register — demonstration, citation, consequence, worked example, or named framing.

Render every thread shift, world change, relationship delta, and system reveal in the mode the profile declares. Foreshadow through imagery, subtext, or explicit framing as the profile prefers.

BEAT SIZING — EVEN WITHOUT A PLAN, THINK IN ~${wordsPerBeat}-WORD BEATS. The scene should read as a sequence of beats of roughly consistent weight — one beat ≈ one paragraph or tight scene moment, ≈${wordsPerBeat} words. This keeps rhythm even and propositions evenly distributed. No fixed floor, no padding — but if you find a single beat running past ~${wordsPerBeat * 2} words, it is probably two beats.

OPENING TRANSITION — read the <time-gap> on the scene. Good storytelling weaves the passage of time into narrative texture so the reader always feels it without ever reading it as a timestamp or log entry. The gap size shifts how visible the weaving is, not whether it happens. MINOR jumps (concurrent, hours, same-day, multi-day): texture only — a candle now lit, light fallen low, a chair pushed back, a character visibly tired. NEVER write "X hours later" or "the next morning,". NOTABLE jumps (multi-week): weave a clearer signal through weather, a finished task, a small status change. Still texture, not statement. MAJOR jumps (multi-month): weight the opening with a re-anchor — status update, changed season, healed wound, matured plan; naming the elapsed time directly is permitted here when it carries narrative force. GENERATIONAL jumps (year+): must be marked with weight — montage, aged-up description, environmental change. Underplaying a generational jump reads as continuity error.

PROSE PROFILE COMPLIANCE: every sentence conforms to the declared voice, register, devices, and rules. If the profile forbids figures of speech, use zero. If it requires specific devices, use them.
  </reference>
</instructions>`;
}
