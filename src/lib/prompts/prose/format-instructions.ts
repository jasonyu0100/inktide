/**
 * Prose Format Instructions
 *
 * Format-specific system roles and rules for prose vs screenplay vs overlay
 * formats. The `formatRules` strings are nested XML so the LLM parses
 * structure (categories, rules, enums) rather than skimming prose paragraphs.
 * The caller wraps them in `<format-rules>...</format-rules>`.
 *
 * Register vs format are INDEPENDENT axes. Register = source intent (fiction,
 * non-fiction, simulation — see CORE_LANGUAGE.md). Format = output rendering
 * (prose, screenplay, meta, simulation). Any register can be rendered in any
 * format: a fiction work can render in `simulation` HUD-overlay; a simulation
 * work can render in plain `prose` with the rule machinery worked through
 * dialogue, action, and narration. The rules below describe the OUTPUT shape;
 * source register is honoured separately via the prose profile and POV.
 */

import type { ProseFormat } from '@/types/narrative';

export type FormatInstructionSet = {
  systemRole: string;
  formatRules: string;
};

/** Plan-driven rendering rules — shared across all prose formats. */
const MECHANISM_DELIVERY = `<mechanism-delivery>
  Each beat's 'what' is mechanism-aware: dialogue beat names participants/subject/tension; action beat names physical events and actors; environment beat names sensory elements. Render IN the assigned mechanism — a dialogue beat must produce dialogue, not summary; an action beat must produce bodied action, not commentary. Don't invent facts the scaffold doesn't license; don't strip scaffolding the plan gave you.
</mechanism-delivery>`;

const DIALOGUE_RENDERING = `<dialogue-rendering>
  Default to QUOTED SPEECH with attribution and non-verbal business (e.g. \`"I'm not going," she said, not looking up.\`) — not paraphrase or reported speech. Each line is spoken by a named character from the beat's participants to a specific audience drawn from that list; characters react to each other's actual words, not abstractions. Read the beat's 'what' for SUBJECT and TENSION; let quoted lines expose them. Small talk is welcome — greetings, mundane observations, off-topic asides. Non-quoted rendering (free-indirect, reported, choral) is reserved for when the prose profile explicitly declares a non-quoted register (analytical, essayistic, oral-epic).
</dialogue-rendering>`;

/** Shared between meta + simulation overlay formats: both produce fluid prose
 *  interleaved with bracketed observations/logs. */
const OVERLAY_PROSE_RULES = `<prose-track>
  The prose portion is the non-overlay text. Write it as if there were no overlay; layer observations on top as a separate track. Honour the declared PROSE PROFILE in full — the overlay does not relax profile compliance. The prose does not narrate what observations say; observations do not rephrase the prose. Use straight quotes (" and '), never smart/curly.
  ${MECHANISM_DELIVERY}
  ${DIALOGUE_RENDERING}
</prose-track>`;

const OVERLAY_GRAMMAR = `<overlay-grammar hint="Strict bracketed entries the UI parses.">
  Pattern: \`[TYPE: primary-label — key: value — key: value]\`. Each entry on its own line. "[" and "]" literal. Exactly one ": " separates TYPE from the body. Body fields separated by " — " (space, em-dash U+2014, space) — never "--" or "-". First field = primary label (plain text, typically a short quoted description). Subsequent fields = "key: value" (lowercase keys) or freeform notes. State transitions use " → " (space, U+2192, space).
</overlay-grammar>`;

export const FORMAT_INSTRUCTIONS: Record<ProseFormat, FormatInstructionSet> = {
  prose: {
    systemRole: 'You are a prose writer crafting a single scene. Adapt to the source\'s register, voice, and POV — the scene is the unit of composition.',
    formatRules: `<intent>Plain prose output. Adapt to the source's POV and register; deliver on the plan's mechanism scaffold; render dialogue as quoted speech by default.</intent>

<output-rules>
  Output ONLY prose — no scene titles, part/chapter headers, separators (---), or meta-commentary. Use straight quotes (" and '), never smart/curly. Lock to the POV the source declares (close third, first-person, authorial third, omniscient — whichever the prose profile and source register call for) and to that POV's senses, reasoning, or evidentiary frame. Specific particulars carry every register — concrete sensory texture, named action, evidence, citation, image, lived detail. The source's voice decides which.
</output-rules>

${MECHANISM_DELIVERY}

${DIALOGUE_RENDERING}`,
  },
  screenplay: {
    systemRole: 'You are a professional screenwriter rendering a scene in industry-standard screenplay format for stage animation, live action, or animated adaptation. The beat plan is your substrate — the same plan that reads as prose must be RE-RENDERED here, not transliterated. Action lines describe only what the camera SEES and HEARS; interior state externalises through one of four conventions (V.O., soliloquy, pure performance, visualised aperture) — pick one for the scene and commit. Sparser propositions per minute than prose, dialogue-heavier — every line on the page must be camera-visible.',
    formatRules: `<intent>Industry-standard, externally observable. Action describes what the camera SEES and HEARS, never what a character KNOWS or FEELS.</intent>

<page-format>
  <rule id="slug-line">INT./EXT. LOCATION - TIME (DAY/NIGHT/CONTINUOUS/MOMENTS LATER) — ALL CAPS, on its own line.</rule>
  <rule id="action-line">Present tense, third person, externally observable. 3-4 lines maximum per paragraph; break to a new paragraph for any new beat.</rule>
  <rule id="character-cue">ALL CAPS on its own line above dialogue (\`SUBJECT-NAME\`). First appearance introduces the participant in caps in the action line: \`SUBJECT-NAME, briefly described, takes the framing action.\`</rule>
  <rule id="dialogue">Under the cue, normal case, no quotation marks.</rule>
  <rule id="parenthetical">Sparingly, lowercase in (parens), delivery cues only — never to substitute for action.</rule>
  <rule id="tags">\`(V.O.)\` voiceover; \`(O.S.)\` off-screen; \`(CONT'D)\` same character continues after action; \`(beat)\` held pause.</rule>
  <rule id="sound-cues">CAPS when dramatically important: A SHARP REPORT. The SCREECH of tires. The room's low HUM.</rule>
  <rule id="transitions">\`CUT TO:\` / \`SMASH CUT TO:\` / \`MATCH CUT TO:\` / \`FADE TO:\` — deliberate, not connective tissue.</rule>
  <rule id="interruptions">Trailing \`--\` for cut-off; \`...\` for trailing-off.</rule>
  <rule id="inserts">\`INSERT — THE LETTER\` followed by shot content. \`CLOSE ON\` / \`WIDE\` / \`POV\` only when the shot itself is the beat.</rule>
  <rule id="quotes">Straight quotes only.</rule>
  <prohibitions>No prose paragraphs. No "we see" / "we hear" — the camera does. No "she thinks" — externalise (see externalisation).</prohibitions>
</page-format>

<externalisation hint="Pick ONE convention per scene and commit. The dominant failure is mixing conventions — V.O. in one beat, pure-performance in the next, soliloquy in the third reads as three scripts pretending to be one.">
  <convention id="vo" default="true" usage="adaptations of internally-narrated source material; most common">Interior reasoning lifts off the page as voiceover lines tagged \`(V.O.)\`. The character on screen says nothing; the V.O. supplies the calculation, recognition, or recall.</convention>
  <convention id="soliloquy" usage="theatrical staging">The character turns to camera or to a frozen tableau and speaks the interior aloud. Diegetic, but stylised.</convention>
  <convention id="pure-performance" usage="restrained character drama. High difficulty, very high payoff. Demands strong action-line craft.">No words. Interior state externalises entirely through micro-expression, blocking, lighting changes, prop interaction, weather.</convention>
  <convention id="visualised-aperture" usage="sources with externalisable interior mechanics — memory, calculation, recall, inference">Cut into the body, the memory, the metaphor, the diagram. Animate the internal mechanism as its own miniature scene. \`INSERT — THE INTERIOR MECHANISM RENDERED AS IMAGE\` then \`BACK TO SCENE.\`</convention>
</externalisation>

<mechanism-translation hint="The plan tags beats with one of eight mechanisms. Each renders specifically in screenplay form.">
  <mechanism id="dialogue">Standard dialogue blocks. Substantive exchanges, multiple turns, distinct cadences. Subtext via pauses (\`(beat)\`) and parentheticals. Non-verbal business stays in action lines BETWEEN dialogue blocks.</mechanism>
  <mechanism id="action">Action lines. Specific physical events, named actors, concrete props. Present tense. 3-4 lines, then break.</mechanism>
  <mechanism id="environment">Action lines as establishment + sound cues. \`Low light. The surface RIPPLES.\` Render atmosphere as what is seen and heard, not narrated.</mechanism>
  <mechanism id="document">\`INSERT —\` shots. Text appears on screen, or a character reads it aloud. Name the document type, then its content.</mechanism>
  <mechanism id="thought">Routes through the chosen externalisation convention — V.O. line, soliloquy aside, pure-performance moment (held look, breath, hand stilling), or visualised aperture cut. Never \`subject thinks ___\` in an action line.</mechanism>
  <mechanism id="narration">V.O. for time compression / commentary, OR action transitions: \`SERIES OF SHOTS\` / \`MONTAGE\` / \`MOMENTS LATER\` / \`THREE WEEKS PASS.\`</mechanism>
  <mechanism id="memory">Flashback cut. \`FLASHBACK — INT. ROOM - NIGHT (FIVE HUNDRED YEARS EARLIER)\` ... \`END FLASHBACK.\` The trigger appears in the present-day action line just before the cut.</mechanism>
  <mechanism id="comic">Visual gag staged in action + dialogue. The comic device sits in WHAT IS SEEN AND HEARD — reaction shot, punchline cue, visual undercut.</mechanism>
</mechanism-translation>

<action-line-discipline>
  Externally observable only. \`The subject recognises this as a setback\` is prose, not screenplay — convert to a held look, a small exhale, a \`(V.O.)\` line, or an INSERT shot. Concrete nouns and active verbs; props named; blocking specific. \`The vessel ERUPTS — flame floods the room.\` not \`A magnificent display of energy occurs.\` Capitalise sound effects and first appearances. The audience reads the action; you don't read it for them.
</action-line-discipline>

<accent-profile>
  Screenplay covers fewer propositions per minute of stage time than prose covers per paragraph. A prose-style proposition cluster (4-6 in one paragraph) becomes 1-2 pages of screen time — spread compulsory propositions across the scene's beats. Dialogue carries more weight than in prose. V.O. lines are 2-3 sentences max; longer reads like exposition dumps. If a proposition has no externalisable rendering, drop it from this scene rather than smuggling prose-narration into action lines.
</accent-profile>

<blank-stage-test hint="Before writing, ask: if this beat is two characters sitting still in a room, what does the audience SEE and HEAR for ten minutes?">
  Cut inside (visualised aperture / flashback / INSERT) so the internal mechanism becomes external spectacle. Intercut physical signs (sweat, trembling, a clock's tick, footsteps in a corridor, light shifting at a window) so stillness has texture. Add a ticking element — something audibly counting down — so stillness compounds rather than diffuses. A scene that fails this test is prose with sluglines.
</blank-stage-test>`,
  },
  meta: {
    systemRole: 'You are a prose writer producing fluid prose interleaved with bracketed engine observations that expose INKTIDE\'S OWN META-SYSTEM qualitatively — the engine noticing moments of shift in its understanding of the work as it writes. Not counts, not force values, not numeric deltas: the QUALITATIVE events InkTide registers — thread committing, seed planting, payoff landing, entity deepening, pattern crystallising, arc pivoting, proposition anchoring, force shifting, continuity risking. The overlay reads like an editorial assistant whispering "something just happened here," not a debugger printing field values.',
    formatRules: `<intent>Fluid prose interleaved with bracketed engine observations naming QUALITATIVE shifts in InkTide's understanding. Phenomenological notes, not numeric telemetry.</intent>

${OVERLAY_PROSE_RULES}

<engine-observations>
  ${OVERLAY_GRAMMAR}

  <discipline>
    Name KINDS of moments, not numbers. If what you want to log is a number, don't log it. If unsure which type fits, prefer no log over a mis-categorised one.
    <example category="ok">
      <log>[Thread committed: "<description>" — the question can no longer be abandoned]</log>
      <log>[Seed planted: "<what the seed is>"]</log>
      <log>[Payoff landed: "<what paid off>" — seed: "<earlier seed this answers>"]</log>
      <log>[Entity deepened: "<name>" — aspect: trait]</log>
      <log>[Arc pivot: "<arc>" — opening to complication]</log>
      <log>[Pattern crystallised: "<what just became visible>"]</log>
      <log>[Force shift: world-dominant → fate-dominant]</log>
      <log>[Rhyme: this beat echoes an earlier scene]</log>
    </example>
    <example category="forbidden">
      <log>[F=1.8 W=12 S=3]</log>
      <log>[+2 nodes added]</log>
      <log>[activeArcs: 3/5]</log>
      <log>[valenceDelta: -0.3]</log>
    </example>
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

  <usage>Target 0-3 observations per paragraph, clustered on inflection points. Pure-prose stretches log nothing.</usage>
</engine-observations>`,
  },
  simulation: {
    systemRole: 'You are a prose writer producing fluid prose interleaved with bracketed in-world system logs — a HUD-overlay rendering. This format is the natural fit for the SIMULATION REGISTER (works that model real-life events from a stated rule set, asking "given these rules and these initial conditions, what happens?" — spanning historical counterfactual, economic and policy modelling, political wargame, pandemic and climate scenario, agent-based social-dynamics study, scientific-process / research-finding work, technological forecasting, and stylised rule-systems such as LitRPG / cultivation / xianxia where in-world mechanics drive events). It can ALSO be used to render any other register (fiction, non-fiction) when the source has surfaced rules, instrumentation, or telemetry the user wants visible — the format is the rendering, not the source intent. Across all uses the logs surface the WORLD\'S OWN diegetic state — gates opening, thresholds crossed, agents acting, modelled cascades, finding logs, anomaly reports, treaties holding or breaking, market-clearing prices. The logs belong to the world being written, not to the engine writing it: they are the readout the modelled system would emit if it had a HUD, dashboard, or status sheet, layered as a game-style overlay on top of natural prose.',
    formatRules: `<intent>Fluid prose interleaved with strict in-world system logs (HUD overlay) for the simulation register. The logs surface the world's diegetic state under its rule set — rule-driven transitions, modelled cascades, agent actions, threshold crossings, findings — not the engine's bookkeeping. Any simulation subgenre (counterfactual, policy model, wargame, scenario, agent-based study, research / finding work, LitRPG-cultivation) should feel native; the source's own diegetic vocabulary decides which log types fire.</intent>

${OVERLAY_PROSE_RULES}

<system-logs>
  ${OVERLAY_GRAMMAR}

  <conventions>
    State/enum values in SCREAMING_SNAKE_CASE (OPEN, SEVERED, MOBILISATION, BIMODAL). Names/descriptions/numbers stay in normal case. Durations/counts explicit with units: "21 days elapsed", "4 years open", "8 nations".
  </conventions>

  <referent>
    Logs report the WORLD's in-world telemetry under its stated rule set, not the engine's bookkeeping. A counterfactual logs a treaty holding or a succession breaking, not "thread N escalated". A policy model logs a tariff threshold crossed and the modelled trade-flow response, not "delta applied". A pandemic scenario logs basic-reproduction-number drift and a containment trigger firing, not "scene N generated". A magic-system world logs its own tier gate opening; a research work logs its own empirical anomaly. The referent is always inside the narrative's world, expressed in that world's own vocabulary.
  </referent>

  <type-enum closed="true" hint="Pick the types the world naturally reports on; do not force ones the register doesn't speak.">
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
    <category id="systems-and-rules" intent="the world's own diegetic rules">
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
    <category id="observation" intent="named diegetic patterns (common in self-help, essay, analytical registers)">
      <type pattern="[Pattern detected: <pattern> — trigger: <cause>]" />
      <type pattern="[Tension accumulation: <level> — resolution distance: <distance>]" />
    </category>
    <category id="inquiry-research" intent="for works whose substance is findings about a domain">
      <type pattern="[Finding: <measurement> — <key>: <value> — status: <state>]" />
      <type pattern="[Anomaly detected: <measurement> — expected: <e> — observed: <o>]" />
      <type pattern="[Claim: <claim> — <metadata>]" />
      <type pattern="[Measurement decision: <field> — operationalisation: <how>]" />
      <type pattern="[Known limitation: <statement>]" />
    </category>
  </type-enum>

  <type-selection hint="The source's own diegetic vocabulary chooses which types fire — adapt to what this work would naturally surface, not to a fixed register table.">
    Rule-dense scenarios (counterfactual, wargame, agent-based, LitRPG-cultivation) lean System Rule Active, System Rule Triggered, Thread Activated, Location Entered — the form rewards density. Policy / economic / pandemic / climate models lean Tension accumulation, Pattern detected, Entities affected, System Rule Triggered with cascade metadata. Empirical / research sources surface Finding, Anomaly detected, Measurement decision, Known limitation. Character-driven simulations lean spare on Relationship, World delta, Thread Closed (logs mark turning points only). Pattern detected and Tension accumulation suit any source whose diegesis explicitly names its own dynamics.
  </type-selection>

  <restraint>0-3 logs per paragraph typical; more at inflection points, none in quiet stretches. Annotating every sentence flattens the overlay.</restraint>
</system-logs>`,
  },
};
