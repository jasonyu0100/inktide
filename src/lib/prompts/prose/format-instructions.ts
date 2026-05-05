/**
 * Prose Format Instructions
 *
 * Format-specific system roles and rules for prose vs screenplay output.
 * The `formatRules` strings are written as nested XML so the LLM parses
 * structure (categories, rules, enums) rather than skimming prose
 * paragraphs. The caller wraps them in `<format-rules>...</format-rules>`.
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
const MECHANISM_DELIVERY = `<mechanism-delivery>
  <intent>Deliver on the plan's mechanism scaffold. Each beat's 'what' is mechanism-aware.</intent>
  <rule>A dialogue beat's 'what' names participants / subject / tension; an action beat's 'what' names physical events and actors; an environment beat's 'what' names sensory elements; etc.</rule>
  <rule>Render the beat IN ITS MECHANISM. Use the scaffold as the structural skeleton and the beat's propositions as the facts to land.</rule>
  <prohibition>Do not substitute the mechanism — a dialogue beat must produce dialogue, not summary; an action beat must produce bodied action, not commentary.</prohibition>
  <prohibition>Do not invent facts the scaffold doesn't license; do not strip scaffolding the plan gave you.</prohibition>
</mechanism-delivery>`;

const DIALOGUE_RENDERING = `<dialogue-rendering>
  <default>Prefer QUOTED SPEECH. Dialogue beats render as direct spoken lines with attribution and non-verbal business (e.g. \`"I'm not going," she said, not looking up.\`) — not paraphrase or reported speech.</default>
  <rationale>Quoted speech makes prose feel alive.</rationale>
  <exception>Non-quoted rendering (free-indirect, reported, choral) is reserved for when the prose profile explicitly declares a non-quoted register (analytical, essayistic, oral-epic).</exception>
  <rule type="participant-aware">Each line is spoken by a named character from the beat's participants to a specific audience drawn from that list. Characters react to each other's actual words — not to abstractions.</rule>
  <rule type="subject-and-tension">Read the beat's 'what' for the SUBJECT and TENSION; let quoted lines expose them.</rule>
  <permission>Small talk is welcome — greetings, mundane observations, off-topic asides, the texture of people being in a room together. Not every exchange has to land a plot beat; quiet human talk is what makes a scene feel lived-in rather than efficient.</permission>
</dialogue-rendering>`;

/** Shared between meta + simulation overlay formats: both produce fluid prose
 *  interleaved with bracketed observations/logs. The prose rules and the
 *  bracket-grammar are identical; only the type enums + discipline differ. */
const OVERLAY_PROSE_RULES = `<prose-track>
  <intent>The prose portion is the non-overlay text. Write it as if there were no overlay; layer observations on top as a separate track.</intent>
  <rule>Honour the declared PROSE PROFILE in full — register, voice, stance, devices, sentence rhythm, anti-patterns. The overlay does not relax profile compliance or alter the authorial voice.</rule>
  <rule>The prose does not narrate what observations say, and observations do not rephrase the prose.</rule>
  <rule>Use straight quotes (" and '), never smart/curly quotes.</rule>
  ${MECHANISM_DELIVERY}
  ${DIALOGUE_RENDERING}
</prose-track>`;

const OVERLAY_GRAMMAR = `<overlay-grammar>
  <intent>Strict bracketed entries the UI parses.</intent>
  <pattern>[TYPE: primary-label — key: value — key: value]</pattern>
  <rule>Each entry on its own line. "[" and "]" literal. Exactly one ": " separates TYPE from the body.</rule>
  <rule>Body fields separated by " — " (space, em-dash U+2014, space). Never "--" or "-".</rule>
  <rule>First field = primary label (plain text, no em-dashes), typically a short quoted description.</rule>
  <rule>Subsequent fields = "key: value" (lowercase keys) or freeform notes.</rule>
  <rule>State transitions use " → " (space, U+2192, space).</rule>
</overlay-grammar>`;

export const FORMAT_INSTRUCTIONS: Record<ProseFormat, FormatInstructionSet> = {
  prose: {
    systemRole: 'You are a prose writer crafting a single scene of a longer narrative. The narrative may be fiction, memoir, essay, reportage, or research writing — adapt register accordingly, but the scene is the unit of composition.',
    formatRules: `<intent>Plain prose output. Adapt register to the narrative's POV; deliver on the plan's mechanism scaffold; render dialogue as quoted speech by default.</intent>

<output-rules>
  <rule>Output ONLY prose. No scene titles, part/chapter headers, separators (---), or meta-commentary.</rule>
  <rule>Use straight quotes (" and '), never smart/curly quotes or typographic substitutions.</rule>
  <rule type="pov">POV is dictated by the narrative's register — close third for most fiction, first-person for memoir, authorial third for essay/reportage/research. Lock to that POV's senses, reasoning, or evidentiary frame.</rule>
  <rule type="register">Prose in dramatic registers tends to work through action, dialogue, and sensory texture; prose in analytical or reflective registers works through specific particulars (evidence, citation, named image, lived detail). Follow the register declared in the prose profile rather than a default.</rule>
</output-rules>

${MECHANISM_DELIVERY}

${DIALOGUE_RENDERING}`,
  },
  screenplay: {
    systemRole: 'You are a professional screenwriter rendering a scene in industry-standard screenplay format for stage animation, live action, or animated adaptation. The beat plan is your substrate — but the same plan that reads as prose must be RE-RENDERED here, not transliterated. Action lines describe only what the camera SEES and HEARS; interior state externalises through one of four conventions (V.O., soliloquy, pure performance, visualised aperture) — pick one for the scene and commit. Sparser propositions per minute than prose, dialogue-heavier, mechanisms externalised — every line of the page must be camera-visible.',
    formatRules: `<intent>Industry-standard, externally observable. Action describes what the camera SEES and HEARS, never what a character KNOWS or FEELS. Stage animation, live action, and animated adaptation all parse this format the same way; write so any of them can shoot it.</intent>

<page-format>
  <rule id="slug-line">INT./EXT. LOCATION - TIME (DAY/NIGHT/CONTINUOUS/MOMENTS LATER) — ALL CAPS, on their own line.</rule>
  <rule id="action-line">Present tense, third person, externally observable. 3-4 lines maximum per paragraph; break to a new paragraph for any new beat of action. White space carries weight.</rule>
  <rule id="character-cue">ALL CAPS on their own line above dialogue (e.g. \`FANG YUAN\`). The first appearance of a character introduces them in caps in the action line (e.g. \`FANG YUAN, eight years old, cold-eyed, steps to the basin.\`).</rule>
  <rule id="dialogue">Under the character cue, normal case, no quotation marks.</rule>
  <rule id="parenthetical">Sparingly, lowercase in (parens), delivery cues only — never to substitute for action.</rule>
  <rule id="tags">\`(V.O.)\` for voiceover (heard, not present), \`(O.S.)\` for off-screen (present but not seen), \`(CONT'D)\` when the same character continues after action. \`(beat)\` as a parenthetical marks a held pause.</rule>
  <rule id="sound-cues">CAPS when dramatically important: A GUNSHOT. The SCREECH of tires. The basin's HUM.</rule>
  <rule id="transitions">\`CUT TO:\` / \`SMASH CUT TO:\` / \`MATCH CUT TO:\` / \`FADE TO:\` — use deliberately, not as connective tissue.</rule>
  <rule id="interruptions">Trailing \`--\` on the cut-off line. Trailing-off: \`...\`.</rule>
  <rule id="inserts">\`INSERT — THE LETTER\` followed by the shot's content. \`CLOSE ON\` / \`WIDE\` / \`POV\` only when the shot itself is the beat; otherwise let the staging imply the camera.</rule>
  <rule id="quotes">Use straight quotes (" and '), never smart/curly quotes.</rule>
  <prohibitions>
    <rule>Page real estate is dialogue + action only. No prose paragraphs.</rule>
    <rule>No "we see" / "we hear" — the camera does.</rule>
    <rule>No "she thinks" — externalise it (see externalisation).</rule>
  </prohibitions>
</page-format>

<externalisation>
  <directive>Pick ONE convention per scene and commit.</directive>
  <failure-mode>The dominant failure is mixing conventions: V.O. in one beat, pure-performance in the next, soliloquy in the third — three scripts pretending to be one. Pick one and the whole scene speaks the same language.</failure-mode>
  <conventions>
    <convention id="vo" default="true">
      <name>V.O. (voiceover)</name>
      <usage>Adaptations of internally-narrated source material; most common.</usage>
      <render>Interior reasoning lifts off the page as voiceover lines tagged \`(V.O.)\`. The character on screen says nothing; the V.O. supplies the calculation, recognition, or recall.</render>
    </convention>
    <convention id="soliloquy">
      <name>Soliloquy / aside</name>
      <usage>Theatrical staging.</usage>
      <render>The character turns to camera or to a frozen tableau and speaks the interior aloud. Diegetic, but stylised.</render>
    </convention>
    <convention id="pure-performance">
      <name>Pure performance + symbolism</name>
      <usage>Restrained character drama. High difficulty, very high payoff. Demands strong action-line craft.</usage>
      <render>No words. Interior state externalises entirely through micro-expression, blocking, lighting changes, prop interaction, weather.</render>
    </convention>
    <convention id="visualised-aperture">
      <name>Visualised aperture / flashback / image-cut</name>
      <usage>Genre-fiction with externalised mechanics.</usage>
      <render>Cut into the body, the memory, the metaphor. Animate the internal mechanism as its own miniature scene. Tag the cut explicitly: \`INSERT — THE GREY-WHITE SEA INSIDE FANG YUAN'S APERTURE\` then \`BACK TO SCENE.\`</render>
    </convention>
  </conventions>
  <selection-guidance>V.O. for calculating-narrator source material; soliloquy for theatrical staging; pure performance for restrained character drama; visualised aperture for genre-fiction with externalised mechanics. Whichever is chosen, every interior beat in the scene routes through THAT convention.</selection-guidance>
</externalisation>

<mechanism-translation>
  <intent>The plan tags beats with one of eight mechanisms. Each renders specifically in screenplay form.</intent>
  <mechanism id="dialogue">Standard dialogue blocks. Substantive exchanges, multiple turns, distinct cadences. Subtext via pauses (\`(beat)\`) and parentheticals. Non-verbal business stays in the action lines BETWEEN dialogue blocks, not inside them.</mechanism>
  <mechanism id="action">Action lines. Specific physical events, named actors, concrete props. Present tense. 3-4 lines, then break.</mechanism>
  <mechanism id="environment">Action lines as establishment + sound cues. \`Torchlight. The basin RIPPLES.\` Don't narrate atmosphere — render it as what is seen and heard.</mechanism>
  <mechanism id="document">\`INSERT —\` shots. The text appears on screen, or a character reads it aloud. Letter, sign, telegram, screen, ledger — name the document type, then its content as it appears.</mechanism>
  <mechanism id="thought">Routes through the chosen externalisation convention. V.O. line, soliloquy aside, pure-performance moment (a held look, a breath, a hand stilling), or visualised aperture cut. Never \`he thinks ___\` in an action line.</mechanism>
  <mechanism id="narration">V.O. for time compression / commentary, OR a series of action transitions: \`SERIES OF SHOTS\` / \`MONTAGE\` / \`MOMENTS LATER\` / \`THREE WEEKS PASS.\` The compression IS the staging.</mechanism>
  <mechanism id="memory">Flashback cut. \`FLASHBACK — INT. ROOM - NIGHT (FIVE HUNDRED YEARS EARLIER)\` ... \`END FLASHBACK.\` The trigger appears in the present-day action line just before the cut.</mechanism>
  <mechanism id="comic">Visual gag staged in action + dialogue. The comic device (bathos, irony, absurd juxtaposition) sits in WHAT IS SEEN AND HEARD — a reaction shot, a punchline cue, a visual undercut. Comic register adjusts the parentheticals and pacing, not the format.</mechanism>
</mechanism-translation>

<action-line-discipline>
  <rule>Externally observable only. \`Fang Yuan recognises this as a tactical setback\` is prose, not screenplay. Convert to: a held look, a small exhale, a \`(V.O.)\` line, or an INSERT shot.</rule>
  <rule>3-4 lines per paragraph maximum. Long action paragraphs are unfilmable; break by beat.</rule>
  <rule>Concrete nouns and active verbs. Props named. Blocking specific. \`The basin ERUPTS — light floods the hall.\` not \`A magnificent display of energy occurs.\`</rule>
  <rule>Capitalise sound effects and the first appearance of a character or named prop.</rule>
  <rule>No interpretation. The audience reads the action; you don't read it for them.</rule>
</action-line-discipline>

<accent-profile>
  <intent>Different from prose. Screenplay covers fewer propositions per minute of stage time than prose covers per paragraph. Density inflates running time; under-staging starves the scene.</intent>
  <calibration>A prose-style proposition cluster (4-6 in one paragraph) becomes 1-2 pages of screen time. Spread compulsory propositions across the scene's beats; do not pack them into single action paragraphs.</calibration>
  <calibration>Dialogue carries more weight than in prose — exchanges are where character lives on stage. Whenever two participants share a beat with substantive content, the screenplay version is dialogue + reaction, not narrated summary.</calibration>
  <calibration>Interior beats get fewer propositions per V.O. line than they would per prose paragraph. A V.O. is two or three sentences max; longer reads like exposition dumps.</calibration>
  <calibration>Cut what cannot externalise. If a proposition has no externalisable rendering and the scene's convention can't carry it, drop it from this scene and let a later scene land it through action — better than smuggling prose-narration into action lines.</calibration>
</accent-profile>

<blank-stage-test>
  <intent>Before writing, ask: if this beat is two characters sitting still in a room, what does the audience SEE and HEAR for ten minutes? Manufacture visual interest deliberately.</intent>
  <technique>Cut inside (visualised aperture / flashback / INSERT) so the internal mechanism becomes external spectacle.</technique>
  <technique>Intercut physical signs (sweat, trembling, a candle burning down, a guard's footfall in the corridor, the dawn arriving) so stillness has texture.</technique>
  <technique>Add a ticking element — something audibly counting down — so the stillness compounds rather than diffuses.</technique>
  <verdict>A scene that survives the blank-stage test has staged the interior. A scene that fails it is prose with sluglines.</verdict>
</blank-stage-test>`,
  },
  meta: {
    systemRole: 'You are a prose writer producing fluid prose interleaved with bracketed engine observations that expose INKTIDE\'S OWN META-SYSTEM qualitatively — the engine noticing moments of shift in its understanding of the work as it writes. Not counts, not force values, not numeric deltas: the QUALITATIVE events InkTide registers — thread committing, seed planting, payoff landing, entity deepening, pattern crystallising, arc pivoting, proposition anchoring, force shifting, continuity risking. The overlay reads like an editorial assistant whispering "something just happened here," not a debugger printing field values.',
    formatRules: `<intent>Fluid prose interleaved with bracketed engine observations naming QUALITATIVE shifts in InkTide's understanding. Phenomenological notes, not numeric telemetry.</intent>

${OVERLAY_PROSE_RULES}

<engine-observations>
  ${OVERLAY_GRAMMAR}

  <discipline>
    <rule type="qualitative-only">Name KINDS of moments, not numbers.</rule>
    <example category="ok">
      <log>[Thread committed: "<description>" — the question can no longer be abandoned]</log>
      <log>[Seed planted: "<what the seed is>"]</log>
      <log>[Payoff landed: "<what paid off>" — seed: "<earlier seed this answers>"]</log>
      <log>[Entity deepened: "<name>" — aspect: trait]</log>
      <log>[Arc pivot: "<arc>" — opening to complication]</log>
      <log>[Pattern crystallised: "<what just became visible>"]</log>
      <log>[Continuity risk: "<the issue>"]</log>
      <log>[Force shift: world-dominant → fate-dominant]</log>
      <log>[Rhyme: this beat echoes the basin scene]</log>
    </example>
    <example category="forbidden">
      <log>[F=1.8 W=12 S=3]</log>
      <log>[+2 nodes added]</log>
      <log>[activeArcs: 3/5]</log>
      <log>[valenceDelta: -0.3]</log>
      <log>[reach median: 7 scenes]</log>
    </example>
    <rationale>Numbers are internal calculations, not observations.</rationale>
  </discipline>

  <type-enum closed="true">
    <category id="threads" intent="kinds of movement">
      <type pattern='[Thread committed: "<description>" — the question can no longer be abandoned]' />
      <type pattern='[Thread stalled: "<description>" — silent for some time]' />
      <type pattern='[Thread resolved: "<description>" — answer landed]' />
      <type pattern='[Thread subverted: "<description>" — answer reversed expectation]' />
      <type pattern='[Thread abandoned: "<description>" — set down, may return]' />
      <type pattern='[Thread collision: "<thread A>" crossed "<thread B>"]' />
      <type pattern='[Thread convergence: "<thread A>" feeding into "<thread B>"]' />
    </category>
    <category id="propositions" intent="kinds of formation">
      <type pattern='[Seed planted: "<what the seed is>"]' />
      <type pattern='[Payoff landed: "<what paid off>" — seed: "<earlier seed this answers>"]' />
      <type pattern='[Callback: "<what was referenced>"]' />
      <type pattern='[Anchor formed: "<what became load-bearing>" — connects backward and forward]' />
      <type pattern='[Close formed: "<what just closed>" — closes: "<its seed>"]' />
      <type pattern='[Texture: "<atmospheric note>" — stays local]' />
    </category>
    <category id="entities" intent="kinds of change">
      <type pattern='[Entity introduced: "<name>" — role: <anchor|recurring|transient>]' />
      <type pattern='[Entity deepened: "<name>" — <aspect: trait|belief|capability|wound|secret|goal|relation>]' />
      <type pattern='[Entity revealed: "<name>" — <what was hidden>]' />
      <type pattern='[Relationship shifted: "<A>" & "<B>" — <qualitative direction: warmed|cooled|fractured|bonded|flipped|severed|forgiven>]' />
    </category>
    <category id="world-and-system" intent="kinds of expansion">
      <type pattern='[World expanded: "<new place, entity, or relation>"]' />
      <type pattern='[System expanded: "<new rule or concept>"]' />
      <type pattern='[Rule surfaced: "<rule>" — <first reveal or re-invocation>]' />
    </category>
    <category id="arcs-and-pacing" intent="kinds of pivot">
      <type pattern='[Arc pivot: "<arc>" — <qualitative turn: opening to complication|complication to crisis|crisis to resolution|resolution to coda>]' />
      <type pattern='[Phase transition: <from: setup|rising|midpoint|escalation|climax|resolution> → <to: same enum>]' />
      <type pattern='[Pacing shift: from <quiet|building|convergent|synthesis> to <same enum>]' />
    </category>
    <category id="forces" intent="kinds of dominance">
      <type pattern='[Force shift: <fate-dominant|world-dominant|system-dominant|balanced> → <same enum>]' />
      <type pattern='[Convergence moment: all three forces in play]' />
    </category>
    <category id="rhythm-and-structure" intent="kinds of recognition">
      <type pattern='[Rhyme: this beat echoes <earlier beat or scene — plain description>]' />
      <type pattern='[Breath: scene is sitting with its material]' />
      <type pattern='[Compression: structural territory being covered quickly]' />
      <type pattern='[Expansion: a small moment held open]' />
    </category>
    <category id="risk-and-repair" intent="kinds of concern">
      <type pattern='[Continuity risk: "<the issue>"]' />
      <type pattern='[Plan revision: "<what the engine originally planned>" — now: "<what changed>"]' />
      <type pattern='[Commitment made: "<what can no longer be undone>"]' />
    </category>
  </type-enum>

  <usage>
    <rule>Target 0-3 observations per paragraph, clustered on inflection points (thread commitments, payoffs, reveals, arc pivots). Pure-prose stretches log nothing.</rule>
    <rule>If what you want to log is a number, don't log it.</rule>
    <rule>If unsure which type fits, prefer no log over a mis-categorised one.</rule>
  </usage>
</engine-observations>`,
  },
  simulation: {
    systemRole: 'You are a prose writer producing fluid prose interleaved with bracketed system logs that expose THE WORLD\'S OWN META-SYSTEM — the diegetic rules, state transitions, and structures the world itself would report if it had a readout. A cultivation novel\'s cultivation tiers and technique activations. A LitRPG\'s stat and skill system. A historical narrative\'s political commitments and cascades. A research paper\'s findings and anomalies. A self-help essay\'s named patterns. The logs belong to the world being written, not to the engine writing it — they are in-world telemetry rendered as a game-style overlay on top of natural prose. (A separate format for surfacing the engine\'s own internals will be added later.)',
    formatRules: `<intent>Fluid prose interleaved with strict in-world system logs (HUD overlay). Logs report the world's own diegetic state, not the engine's bookkeeping.</intent>

${OVERLAY_PROSE_RULES}

<system-logs>
  ${OVERLAY_GRAMMAR}

  <conventions>
    <rule>State/enum values in SCREAMING_SNAKE_CASE (OPEN, SEVERED, MOBILISATION, BIMODAL). Names/descriptions/numbers stay in normal case.</rule>
    <rule>Durations/counts explicit with units: "21 days elapsed", "4 years open", "8 nations".</rule>
  </conventions>

  <referent>
    <directive>Logs report the WORLD's in-world telemetry, not the engine's bookkeeping.</directive>
    <example>A cultivation novel logs its own tier gate opening, not "narrative arc N began".</example>
    <example>A research paper logs its own empirical anomaly, not "proposition P was classified as Anchor".</example>
    <invariant>The referent is always inside the story world.</invariant>
  </referent>

  <type-enum closed="true">
    <directive>Pick the types the world naturally reports on; do not force ones the register doesn't speak.</directive>
    <category id="world-scene">
      <type pattern="[Location Entered: <name> — <metadata>]" />
      <type pattern="[Location Left: <name>]" />
      <type pattern="[Time Jump: <from> → <to> — <duration>]" />
    </category>
    <category id="threads" intent="in-world open questions, obligations, or commitments">
      <status-vocabulary>OPEN, CLOSED, SEVERED, ACTIVE, ESCALATING, RESOLVED, ABANDONED, DISPUTED, SUPERSEDED — adapt to the world's own vocabulary.</status-vocabulary>
      <type pattern="[Thread Activated: <in-world question or commitment> — status: <status>]" />
      <type pattern="[Thread Escalated: <in-world question or commitment> — status: <from> → <to>]" />
      <type pattern="[Thread Closed: <in-world question or commitment> — <duration or terminal state>]" />
      <type pattern="[Thread: <in-world question or commitment> — status: <status> — <metadata>]" />
    </category>
    <category id="systems-and-rules" intent="the world's own diegetic rules, systems, laws">
      <type pattern="[System Rule Active: <rule> — <metadata>]" />
      <type pattern="[System Rule Triggered: <rule> — <consequence>]" />
      <type pattern="[System Introduced: <name> — status: <status>]" />
      <type pattern="[System: <subject> — <claim or state>]" />
    </category>
    <category id="entities" intent="in-world state changes">
      <type pattern="[World delta: <entity or concept> — <change>]" />
      <type pattern="[Relationship: <A> & <B> — state change: <from> → <to>]" />
      <type pattern="[Entities affected: <scope> — state change: <from> → <to>]" />
    </category>
    <category id="observation" intent="named diegetic patterns (common in self-help, essay, analytical registers where the world explicitly names its own dynamics)">
      <type pattern="[Pattern detected: <pattern> — trigger: <cause>]" />
      <type pattern="[Tension accumulation: <level> — resolution distance: <distance>]" />
    </category>
    <category id="inquiry-research" intent="for works that ARE a research paper, investigation, or essay whose substance is findings about a domain">
      <type pattern="[Finding: <measurement> — <key>: <value> — status: <state>]" />
      <type pattern="[Anomaly detected: <measurement> — expected: <e> — observed: <o>]" />
      <type pattern="[Claim: <claim> — <metadata>]" />
      <type pattern="[Measurement decision: <field> — operationalisation: <how>]" />
      <type pattern="[Known limitation: <statement>]" />
    </category>
  </type-enum>

  <register-picks>
    <directive>Register picks its own types.</directive>
    <pick register="cultivation / litrpg / game-fiction">Heavy System Rule, Thread Activated, Location Entered. The form rewards density; the overlay IS the readerly pleasure.</pick>
    <pick register="literary / character-drama">Spare Relationship, World delta, Thread Closed. Logs mark turning points only.</pick>
    <pick register="history / biography">Thread Activated (long commitments), System Rule Triggered (cascades), Entities affected (scope).</pick>
    <pick register="self-help / essay">Pattern detected, Tension accumulation, Claim.</pick>
    <pick register="empirical research / methodology / discussion">Finding, Anomaly detected, Measurement decision, Known limitation, Claim.</pick>
  </register-picks>

  <restraint>
    <rule>0-3 logs per paragraph typical; more at inflection points, none in quiet stretches.</rule>
    <rule>Annotating every sentence flattens the overlay.</rule>
    <rule>Logs report the in-world effect of the sentence they follow. Silence is valid if nothing in-world is worth surfacing.</rule>
  </restraint>
</system-logs>`,
  },
};
