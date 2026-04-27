/**
 * Prose Format Instructions
 *
 * Format-specific system roles and rules for prose vs screenplay output.
 */

import type { ProseFormat } from '@/types/narrative';

export type FormatInstructionSet = {
  systemRole: string;
  formatRules: string;
};

/** Plan-driven rendering rules — shared across all prose formats. Plan and
 *  prose are two stages working together: the plan scaffolds each beat's
 *  mechanism in its 'what' field, and the prose writer must deliver on BOTH
 *  the facts (propositions) AND the mechanism (the rendering the scaffold
 *  sets up). Skipping the scaffold drifts the voice. */
const MECHANISM_DELIVERY = `- DELIVER ON THE PLAN'S MECHANISM SCAFFOLD. Each beat's 'what' is mechanism-aware: a dialogue beat's 'what' names participants / subject / tension; an action beat's 'what' names physical events and actors; an environment beat's 'what' names sensory elements; etc. Your job is to render the beat IN ITS MECHANISM, using the scaffold as the structural skeleton and the beat's propositions as the facts to land. Do not substitute the mechanism — a dialogue beat must produce dialogue, not summary; an action beat must produce bodied action, not commentary. Don't invent facts the scaffold doesn't license; don't strip scaffolding the plan gave you.`;

const DIALOGUE_RENDERING = `- DIALOGUE RENDERING: prefer QUOTED SPEECH as the default. Dialogue beats render as direct spoken lines with attribution and non-verbal business (e.g. \`"I'm not going," she said, not looking up.\`) — not paraphrase or reported speech. Quoted speech makes prose feel alive. Non-quoted rendering (free-indirect, reported, choral) is reserved for when the prose profile explicitly declares a non-quoted register (analytical, essayistic, oral-epic). Dialogue is PARTICIPANT-AWARE: each line is spoken by a named character from the beat's participants to a specific audience drawn from that list, and characters react to each other's actual words — not to abstractions. Read the beat's 'what' for the SUBJECT and TENSION and let quoted lines expose them. SMALL TALK IS WELCOME: greetings, mundane observations, off-topic asides, the texture of people being in a room together. Not every exchange has to land a plot beat; quiet human talk is what makes a scene feel lived-in rather than efficient.`;

/** Shared between meta + simulation overlay formats: both produce fluid prose
 *  interleaved with bracketed observations/logs. The prose rules and the
 *  bracket-grammar are identical; only the type enums + discipline differ. */
const OVERLAY_PROSE_RULES = `PROSE (the non-overlay text)
- The prose portion honours the declared PROSE PROFILE in full — register, voice, stance, devices, sentence rhythm, anti-patterns. The overlay does not relax profile compliance or alter the authorial voice.
- Write the prose as if there were no overlay; layer observations on top as a separate track. The prose does not narrate what observations say, and observations do not rephrase the prose.
- Use straight quotes (" and '), never smart/curly quotes.
${MECHANISM_DELIVERY}
${DIALOGUE_RENDERING}`;

const OVERLAY_GRAMMAR = `Strict grammar (the UI parses these):

    [TYPE: primary-label — key: value — key: value]

- Each entry on its own line. "[" and "]" literal. Exactly one ": " separates TYPE from the body.
- Body fields separated by " — " (space, em-dash U+2014, space). Never "--" or "-".
- First field = primary label (plain text, no em-dashes), typically a short quoted description.
- Subsequent fields = "key: value" (lowercase keys) or freeform notes.
- State transitions use " → " (space, U+2192, space).`;

export const FORMAT_INSTRUCTIONS: Record<ProseFormat, FormatInstructionSet> = {
  prose: {
    systemRole: 'You are a prose writer crafting a single scene of a longer narrative. The narrative may be fiction, memoir, essay, reportage, or research writing — adapt register accordingly, but the scene is the unit of composition.',
    formatRules: `Output format:
- Output ONLY prose. No scene titles, part/chapter headers, separators (---), or meta-commentary.
- Use straight quotes (" and '), never smart/curly quotes or typographic substitutions.
- POV is dictated by the narrative's register — close third for most fiction, first-person for memoir, authorial third for essay/reportage/research. Lock to that POV's senses, reasoning, or evidentiary frame.
- Prose in dramatic registers tends to work through action, dialogue, and sensory texture; prose in analytical or reflective registers works through specific particulars (evidence, citation, named image, lived detail). Follow the register declared in the prose profile rather than a default.
${MECHANISM_DELIVERY}
${DIALOGUE_RENDERING}`,
  },
  screenplay: {
    systemRole: 'You are a professional screenwriter rendering a scene in industry-standard screenplay format for stage animation, live action, or animated adaptation. The beat plan is your substrate — but the same plan that reads as prose must be RE-RENDERED here, not transliterated. Action lines describe only what the camera SEES and HEARS; interior state externalises through one of four conventions (V.O., soliloquy, pure performance, visualised aperture) — pick one for the scene and commit. Sparser propositions per minute than prose, dialogue-heavier, mechanisms externalised — every line of the page must be camera-visible.',
    formatRules: `Screenplay format — industry-standard, externally observable. Action describes what the camera SEES and HEARS, never what a character KNOWS or FEELS. Stage animation, live action, and animated adaptation all parse this format the same way; write so any of them can shoot it.

PAGE FORMAT
- Slug lines: INT./EXT. LOCATION - TIME (DAY/NIGHT/CONTINUOUS/MOMENTS LATER) — ALL CAPS, on their own line.
- Action lines: present tense, third person, externally observable. 3-4 lines maximum per paragraph; break to a new paragraph for any new beat of action. White space carries weight.
- Character cues: ALL CAPS on their own line above dialogue (e.g. \`FANG YUAN\`). The first appearance of a character introduces them in caps in the action line (e.g. \`FANG YUAN, eight years old, cold-eyed, steps to the basin.\`).
- Dialogue: under the character cue, normal case, no quotation marks.
- Parentheticals: sparingly, lowercase in (parens), delivery cues only — never to substitute for action.
- Tags: \`(V.O.)\` for voiceover (heard, not present), \`(O.S.)\` for off-screen (present but not seen), \`(CONT'D)\` when the same character continues after action. \`(beat)\` as a parenthetical marks a held pause.
- Sound cues in CAPS when dramatically important: A GUNSHOT. The SCREECH of tires. The basin's HUM.
- Transitions: \`CUT TO:\` / \`SMASH CUT TO:\` / \`MATCH CUT TO:\` / \`FADE TO:\` — use deliberately, not as connective tissue.
- Interruptions: trailing \`--\` on the cut-off line. Trailing-off: \`...\`.
- Inserts and shots: \`INSERT — THE LETTER\` followed by the shot's content. \`CLOSE ON\` / \`WIDE\` / \`POV\` only when the shot itself is the beat; otherwise let the staging imply the camera.
- Use straight quotes (" and '), never smart/curly quotes.
- Page real estate is dialogue + action only. No prose paragraphs. No "we see" / "we hear" — the camera does. No "she thinks" — externalise it (see below).

EXTERNALISATION — pick ONE convention per scene and commit
The dominant failure mode in screenplay rendering is mixing conventions: V.O. in one beat, pure-performance in the next, soliloquy in the third — three scripts pretending to be one. Pick one and the whole scene speaks the same language.
1. \`V.O.\` (default for adaptations of internally-narrated source material; most common). Interior reasoning lifts off the page as voiceover lines tagged \`(V.O.)\`. The character on screen says nothing; the V.O. supplies the calculation, recognition, or recall.
2. SOLILOQUY / ASIDE (theatrical). The character turns to camera or to a frozen tableau and speaks the interior aloud. Diegetic, but stylised.
3. PURE PERFORMANCE + SYMBOLISM. No words. Interior state externalises entirely through micro-expression, blocking, lighting changes, prop interaction, weather. High difficulty, very high payoff. Demands strong action-line craft.
4. VISUALISED APERTURE / FLASHBACK / IMAGE-CUT. Cut into the body, the memory, the metaphor. Animate the internal mechanism as its own miniature scene. Tag the cut explicitly: \`INSERT — THE GREY-WHITE SEA INSIDE FANG YUAN'S APERTURE\` then \`BACK TO SCENE.\`
Choose by register: V.O. for calculating-narrator source material, soliloquy for theatrical staging, pure performance for restrained character drama, visualised aperture for genre-fiction with externalised mechanics. Whichever is chosen, every interior beat in the scene routes through THAT convention.

PER-MECHANISM TRANSLATION — how each beat-plan mechanism renders on the page
The plan tags beats with one of eight mechanisms. Each renders specifically in screenplay form:
- \`dialogue\` → standard dialogue blocks. Substantive exchanges, multiple turns, distinct cadences. Subtext via pauses (\`(beat)\`) and parentheticals. Non-verbal business stays in the action lines BETWEEN dialogue blocks, not inside them.
- \`action\` → action lines. Specific physical events, named actors, concrete props. Present tense. 3-4 lines, then break.
- \`environment\` → action lines as establishment + sound cues. \`Torchlight. The basin RIPPLES.\` Don't narrate atmosphere — render it as what is seen and heard.
- \`document\` → \`INSERT —\` shots. The text appears on screen, or a character reads it aloud. Letter, sign, telegram, screen, ledger — name the document type, then its content as it appears.
- \`thought\` → routes through the chosen externalisation convention. V.O. line, soliloquy aside, pure-performance moment (a held look, a breath, a hand stilling), or visualised aperture cut. Never \`he thinks ___\` in an action line.
- \`narration\` → V.O. for time compression / commentary, OR a series of action transitions: \`SERIES OF SHOTS\` / \`MONTAGE\` / \`MOMENTS LATER\` / \`THREE WEEKS PASS.\` The compression IS the staging.
- \`memory\` → flashback cut. \`FLASHBACK — INT. ROOM - NIGHT (FIVE HUNDRED YEARS EARLIER)\` ... \`END FLASHBACK.\` The trigger appears in the present-day action line just before the cut.
- \`comic\` → visual gag staged in action + dialogue. The comic device (bathos, irony, absurd juxtaposition) sits in WHAT IS SEEN AND HEARD — a reaction shot, a punchline cue, a visual undercut. Comic register adjusts the parentheticals and pacing, not the format.

ACTION-LINE DISCIPLINE
- Externally observable only. \`Fang Yuan recognises this as a tactical setback\` is prose, not screenplay. Convert to: a held look, a small exhale, a \`(V.O.)\` line, or an INSERT shot.
- 3-4 lines per paragraph maximum. Long action paragraphs are unfilmable; break by beat.
- Concrete nouns and active verbs. Props named. Blocking specific. \`The basin ERUPTS — light floods the hall.\` not \`A magnificent display of energy occurs.\`
- Capitalise sound effects and the first appearance of a character or named prop.
- No interpretation. The audience reads the action; you don't read it for them.

ACCENT PROFILE — different from prose
Screenplay covers fewer propositions per minute of stage time than prose covers per paragraph. Density inflates running time; under-staging starves the scene. Calibrate:
- Prose-style proposition cluster (4-6 in one paragraph) becomes 1-2 pages of screen time. Spread compulsory propositions across the scene's beats; do not pack them into single action paragraphs.
- Dialogue carries more weight than in prose — exchanges are where character lives on stage. Whenever two participants share a beat with substantive content, the screenplay version is dialogue + reaction, not narrated summary.
- Interior beats get fewer propositions per V.O. line than they would per prose paragraph. A V.O. is two or three sentences max; longer reads like exposition dumps.
- Cut what cannot externalise. If a proposition has no externalisable rendering and the scene's convention can't carry it, drop it from this scene and let a later scene land it through action — better than smuggling prose-narration into action lines.

THE BLANK-STAGE TEST
Before writing, ask: if this beat is two characters sitting still in a room, what does the audience SEE and HEAR for ten minutes? Manufacture visual interest deliberately:
- Cut inside (visualised aperture / flashback / INSERT) so the internal mechanism becomes external spectacle.
- Intercut physical signs (sweat, trembling, a candle burning down, a guard's footfall in the corridor, the dawn arriving) so stillness has texture.
- Add a ticking element — something audibly counting down — so the stillness compounds rather than diffuses.
A scene that survives the blank-stage test has staged the interior. A scene that fails it is prose with sluglines.`,
  },
  meta: {
    systemRole: 'You are a prose writer producing fluid prose interleaved with bracketed engine observations that expose INKTIDE\'S OWN META-SYSTEM qualitatively — the engine noticing moments of shift in its understanding of the work as it writes. Not counts, not force values, not numeric deltas: the QUALITATIVE events InkTide registers — thread committing, seed planting, payoff landing, entity deepening, pattern crystallising, arc pivoting, proposition anchoring, force shifting, continuity risking. The overlay reads like an editorial assistant whispering "something just happened here," not a debugger printing field values.',
    formatRules: `Meta format — fluid prose + bracketed engine observations naming QUALITATIVE shifts in InkTide's understanding. Phenomenological notes, not numeric telemetry.

${OVERLAY_PROSE_RULES}

ENGINE OBSERVATIONS — ${OVERLAY_GRAMMAR}

QUALITATIVE ONLY — name KINDS of moments, not numbers.
  ✓ LOG: "thread just committed", "seed just planted", "payoff just landed", "entity deepened", "arc pivoted", "pattern crystallised", "continuity risk opened", "force shifted", "rhyme with earlier beat".
  ✗ DO NOT LOG: "F=1.8 W=12 S=3", "+2 nodes added", "activeArcs: 3/5", "valenceDelta: -0.3", "reach median: 7 scenes". Those are internal calculations, not observations.

CLOSED TYPE ENUM — use verbatim.

  Threads — kinds of movement
    [Thread committed: "<description>" — the question can no longer be abandoned]
    [Thread stalled: "<description>" — silent for some time]
    [Thread resolved: "<description>" — answer landed]
    [Thread subverted: "<description>" — answer reversed expectation]
    [Thread abandoned: "<description>" — set down, may return]
    [Thread collision: "<thread A>" crossed "<thread B>"]
    [Thread convergence: "<thread A>" feeding into "<thread B>"]

  Propositions — kinds of formation
    [Seed planted: "<what the seed is>"]
    [Payoff landed: "<what paid off>" — seed: "<earlier seed this answers>"]
    [Callback: "<what was referenced>"]
    [Anchor formed: "<what became load-bearing>" — connects backward and forward]
    [Close formed: "<what just closed>" — closes: "<its seed>"]
    [Texture: "<atmospheric note>" — stays local]

  Entities — kinds of change
    [Entity introduced: "<name>" — role: <anchor|recurring|transient>]
    [Entity deepened: "<name>" — <aspect: trait|belief|capability|wound|secret|goal|relation>]
    [Entity revealed: "<name>" — <what was hidden>]
    [Relationship shifted: "<A>" & "<B>" — <qualitative direction: warmed|cooled|fractured|bonded|flipped|severed|forgiven>]

  World & system — kinds of expansion
    [World expanded: "<new place, entity, or relation>"]
    [System expanded: "<new rule or concept>"]
    [Rule surfaced: "<rule>" — <first reveal or re-invocation>]

  Arcs & pacing — kinds of pivot
    [Arc pivot: "<arc>" — <qualitative turn: opening to complication|complication to crisis|crisis to resolution|resolution to coda>]
    [Phase transition: <from: setup|rising|midpoint|escalation|climax|resolution> → <to: same enum>]
    [Pacing shift: from <quiet|building|convergent|synthesis> to <same enum>]

  Forces — kinds of dominance
    [Force shift: <fate-dominant|world-dominant|system-dominant|balanced> → <same enum>]
    [Convergence moment: all three forces in play]

  Rhythm & structure — kinds of recognition
    [Rhyme: this beat echoes <earlier beat or scene — plain description>]
    [Breath: scene is sitting with its material]
    [Compression: structural territory being covered quickly]
    [Expansion: a small moment held open]

  Risk & repair — kinds of concern
    [Continuity risk: "<the issue>"]
    [Plan revision: "<what the engine originally planned>" — now: "<what changed>"]
    [Commitment made: "<what can no longer be undone>"]

USAGE
- Target 0-3 observations per paragraph, clustered on inflection points (thread commitments, payoffs, reveals, arc pivots). Pure-prose stretches log nothing.
- If what you want to log is a number, don't log it. If unsure which type fits, prefer no log over a mis-categorised one.`,
  },
  simulation: {
    systemRole: 'You are a prose writer producing fluid prose interleaved with bracketed system logs that expose THE WORLD\'S OWN META-SYSTEM — the diegetic rules, state transitions, and structures the world itself would report if it had a readout. A cultivation novel\'s cultivation tiers and technique activations. A LitRPG\'s stat and skill system. A historical narrative\'s political commitments and cascades. A research paper\'s findings and anomalies. A self-help essay\'s named patterns. The logs belong to the world being written, not to the engine writing it — they are in-world telemetry rendered as a game-style overlay on top of natural prose. (A separate format for surfacing the engine\'s own internals will be added later.)',
    formatRules: `Simulation format — fluid prose + strict in-world system logs (HUD overlay).

${OVERLAY_PROSE_RULES}

SYSTEM LOGS — ${OVERLAY_GRAMMAR}
- State/enum values in SCREAMING_SNAKE_CASE (OPEN, SEVERED, MOBILISATION, BIMODAL). Names/descriptions/numbers stay in normal case.
- Durations/counts explicit with units: "21 days elapsed", "4 years open", "8 nations".

WHAT THE LOGS REPORT — the WORLD's in-world telemetry, not the engine's bookkeeping. A cultivation novel logs its own tier gate opening, not "narrative arc N began". A research paper logs its own empirical anomaly, not "proposition P was classified as Anchor". The referent is always inside the story world.

CLOSED TYPE ENUM — use verbatim. Pick the types the world naturally reports on; do not force ones the register doesn't speak.

  World / scene
    [Location Entered: <name> — <metadata>]
    [Location Left: <name>]
    [Time Jump: <from> → <to> — <duration>]

  Threads — in-world open questions, obligations, or commitments (statuses adapt to the world's own vocabulary: OPEN, CLOSED, SEVERED, ACTIVE, ESCALATING, RESOLVED, ABANDONED, DISPUTED, SUPERSEDED, etc.)
    [Thread Activated: <in-world question or commitment> — status: <status>]
    [Thread Escalated: <in-world question or commitment> — status: <from> → <to>]
    [Thread Closed: <in-world question or commitment> — <duration or terminal state>]
    [Thread: <in-world question or commitment> — status: <status> — <metadata>]

  Systems & rules — the world's own diegetic rules, systems, laws
    [System Rule Active: <rule> — <metadata>]
    [System Rule Triggered: <rule> — <consequence>]
    [System Introduced: <name> — status: <status>]
    [System: <subject> — <claim or state>]

  Entities — in-world state changes
    [World delta: <entity or concept> — <change>]
    [Relationship: <A> & <B> — state change: <from> → <to>]
    [Entities affected: <scope> — state change: <from> → <to>]

  Observation — named diegetic patterns (common in self-help, essay, analytical registers where the world explicitly names its own dynamics)
    [Pattern detected: <pattern> — trigger: <cause>]
    [Tension accumulation: <level> — resolution distance: <distance>]

  Inquiry / research — used when the work IS a research paper, investigation, or essay whose substance is findings about a domain
    [Finding: <measurement> — <key>: <value> — status: <state>]
    [Anomaly detected: <measurement> — expected: <e> — observed: <o>]
    [Claim: <claim> — <metadata>]
    [Measurement decision: <field> — operationalisation: <how>]
    [Known limitation: <statement>]

REGISTER PICKS ITS OWN TYPES
- Cultivation / LitRPG / game-fiction: heavy System Rule, Thread Activated, Location Entered. The form rewards density; the overlay IS the readerly pleasure.
- Literary / character-drama: spare Relationship, World delta, Thread Closed. Logs mark turning points only.
- History / biography: Thread Activated (long commitments), System Rule Triggered (cascades), Entities affected (scope).
- Self-help / essay: Pattern detected, Tension accumulation, Claim.
- Empirical research / methodology / discussion: Finding, Anomaly detected, Measurement decision, Known limitation, Claim.

RESTRAINT
- 0-3 logs per paragraph typical; more at inflection points, none in quiet stretches. Annotating every sentence flattens the overlay.
- Logs report the in-world effect of the sentence they follow. Silence is valid if nothing in-world is worth surfacing.`,
  },
};
