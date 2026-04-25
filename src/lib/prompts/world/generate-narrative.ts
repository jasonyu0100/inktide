/**
 * Whole-narrative generation — produces a complete world (characters,
 * locations, threads, artifacts, system rules, optional intro arc + scenes,
 * prose profile) from a title + premise. Two modes: full pilot (8-scene
 * intro arc) or worldOnly (entities + system, no scenes).
 */

export const GENERATE_NARRATIVE_SYSTEM =
  'You are a world-architect spinning a complete narrative seed from a title + premise. Build a tight, focused world with named entities (characters with secrets, locations with constraints, threads with named outcomes, system rules with mechanisms), all woven together. Pilot mode: also produce an 8-scene intro arc + prose profile. World-only mode: entities + system + prose profile, no scenes. Source names from the cultural palette implied by the premise — never default to Anglo/European. Initialize every entity with seed nodes; never emit blank world graphs. Return ONLY valid JSON matching the schema in the user prompt.';

export const DETECT_PATTERNS_SYSTEM =
  'You are a literary diagnostician. Read prose, structure, and content; identify the narrative\'s genre and subgenre; derive concrete pattern / anti-pattern commandments that encourage variety and prevent stagnation. Patterns are positive directives that unlock fresh storytelling within the genre; anti-patterns are negative directives that flag staleness. Return ONLY valid JSON matching the schema in the user prompt.';

import {
  PROMPT_POV,
  PROMPT_FORCE_STANDARDS,
  PROMPT_STRUCTURAL_RULES,
  PROMPT_DELTAS,
  PROMPT_WORLD,
  PROMPT_ARC_STATE_GUIDANCE,
  PROMPT_SUMMARY_REQUIREMENT,
} from '../index';

export type GenerateNarrativeArgs = {
  title: string;
  premise: string;
  /** When true: world entities only, no scenes/arcs. */
  worldOnly: boolean;
  forceReferenceMeansWorld: number;
  forceReferenceMeansSystem: number;
  worldTypicalBand: string;
  worldClimaxBand: string;
  systemTypicalBand: string;
  systemClimaxBand: string;
};

export function buildGenerateNarrativePrompt(args: GenerateNarrativeArgs): string {
  const {
    title,
    premise,
    worldOnly,
    forceReferenceMeansWorld,
    forceReferenceMeansSystem,
    worldTypicalBand,
    worldClimaxBand,
    systemTypicalBand,
    systemClimaxBand,
  } = args;

  return `<inputs>
  <task hint="${worldOnly ? 'World-only mode — output entities, no scenes or arcs.' : 'Full pilot mode — entities + 8-scene intro arc + prose profile.'}">${worldOnly
    ? 'Extract and build a complete narrative world from the following story plan. Do NOT generate scenes or arcs — output world entities only (characters, locations, threads, relationships, artifacts, rules, systems, prose profile).'
    : 'Create a complete narrative world.'}</task>
  <title>${title}</title>
  <${worldOnly ? 'story-plan' : 'premise'}>${premise}</${worldOnly ? 'story-plan' : 'premise'}>
</inputs>

<output-format>
Return JSON with this exact structure:
{
  "worldSummary": "2-3 sentence world description",
  "imageStyle": "A concise visual style directive for all generated images (e.g. 'watercolour style with soft lighting'). Should capture the tone, medium, palette, and aesthetic that best fits this world.",
  "characters": [
    {"id": "C-01", "name": "Full name matching the cultural palette of the world — rough, asymmetric, lived-in", "role": "anchor|recurring|transient", "threadIds": ["T-01"], "imagePrompt": "1-2 sentence LITERAL physical description — concrete traits (hair colour, build, clothing). No metaphors or figurative language; image generators interpret literally.", "world": {"nodes": [{"id": "K-01", "type": "trait|state|history|capability|belief|relation|secret|goal|weakness", "content": "15-25 words, PRESENT tense: a stable fact about this character — trait, belief, capability, state, secret, goal, or weakness"}]}}
  ],
  "locations": [
    {"id": "L-01", "name": "Location name from geography, founders, or corrupted older words — concrete and specific", "prominence": "domain|place|margin", "parentId": null, "threadIds": [], "imagePrompt": "1-2 sentence LITERAL visual description — concrete architecture, landscape, lighting. No metaphors or figurative language; image generators interpret literally.", "world": {"nodes": [{"id": "LK-01", "type": "trait|state|history|capability|belief|relation|secret|goal|weakness", "content": "15-25 words, PRESENT tense: a stable fact about this location — history, rules, dangers, atmosphere, or properties"}]}}
  ],
  "threads": [
    {"id": "T-01", "participants": [{"id": "C-01", "type": "character|location|artifact"}], "description": "Frame as a QUESTION: 'Will X succeed?' 'Can Y be trusted?' 'What is the truth behind Z?' — 15-30 words, specific", "outcomes": ["Named possibilities the market prices. Binary default: ['yes','no']. Multi-outcome when resolution is N-way. Must be distinct, mutually exclusive, 2–6 entries."], "openedAt": "S-001", "dependents": []}
  ],
  "relationshipDeltas": [
    {"from": "C-01", "to": "C-02", "type": "description", "valenceDelta": 0.5}
  ],
  "artifacts": [
    {"id": "A-01", "name": "Artifact name — concrete and specific to its function or origin", "significance": "key|notable|minor", "threadIds": [], "parentId": "character or location ID, or null for world-owned", "world": {"nodes": [{"id": "AK-01", "type": "trait|state|history|capability|belief|relation|secret|goal|weakness", "content": "15-25 words, PRESENT tense: what this artifact is, what it does, its history, powers, or limitations"}]}, "imagePrompt": "1-2 sentence LITERAL visual description — concrete physical details only, no metaphors or figurative language"}
  ],${worldOnly ? `
  "systemDeltas": {"addedNodes": [{"id": "SYS-01", "concept": "15-25 words, PRESENT tense: a general rule or structural fact about how the world works — no specific characters or events", "type": "principle|system|concept|tension|event|structure|environment|convention|constraint"}], "addedEdges": [{"from": "SYS-01", "to": "SYS-02", "relation": "enables|governs|opposes|extends|created_by|constrains|exist_within"}]},` : `
  "scenes": [
    {
      "id": "S-001",
      "arcId": "ARC-01",
      "locationId": "L-01",
      "povId": "C-01",
      "participantIds": ["C-01"],
      "summary": "REQUIRED — WRITE THIS FIRST. This is the spine of the scene; every delta below must trace back to something stated here. Rich prose sentences using character NAMES and location NAMES (never raw IDs). Include specifics: actions, consequences, dialogue snippets. Include any context that shapes how the scene is written (time span, technique, tone). No sentences ending in emotions or realizations.",
      "timeDelta": {"value": 1, "unit": "hour"},
      "artifactUsages": [{"artifactId": "A-XX", "characterId": "C-XX", "usage": "what the artifact did — how it delivered utility"}],
      "events": ["event_tag"],
      "threadDeltas": [{"threadId": "T-01", "logType": "pulse|transition|setup|escalation|payoff|twist|callback|resistance|stall", "updates": [{"outcome": "outcome name from thread.outcomes", "evidence": -4..+4 (decimals allowed, e.g. +1.5)}], "volumeDelta": 0..2, "addOutcomes": ["optional — new outcome names if this scene opens a possibility not previously in the market"], "rationale": "thread-specific prose sentence (10-20 words) — what the scene does to this thread in natural language. Do NOT quote outcome identifiers, mention evidence numbers, or reference logType."}],
      "worldDeltas": [{"entityId": "C-XX", "addedNodes": [{"id": "K-GEN-001", "content": "15-25 words, PRESENT tense: a stable fact about the entity — what they experienced, became, or now possess", "type": "trait|state|history|capability|belief|relation|secret|goal|weakness"}]}],
      "relationshipDeltas": [],
      "systemDeltas": {"addedNodes": [{"id": "SYS-GEN-001", "concept": "15-25 words, PRESENT tense: a general rule or structural fact about how the world works — no specific characters or events", "type": "principle|system|concept|tension|event|structure|environment|convention|constraint"}], "addedEdges": [{"from": "SYS-GEN-001", "to": "SYS-GEN-002", "relation": "enables|governs|opposes|extends|created_by|constrains|exist_within"}]}
    }
  ],
  "arcs": [
    {"id": "ARC-01", "name": "Arc name — a short thematic label for this story segment", "sceneIds": ["S-001"], "develops": ["T-01"], "locationIds": ["L-01"], "activeCharacterIds": ["C-01"], "initialCharacterLocations": {"C-01": "L-01"}, "directionVector": "Forward-looking intent — see ARC METADATA guidance below.", "worldState": "Backward-looking compact state snapshot as of END of arc — see ARC METADATA guidance below for domain-adaptive form."}
  ],`}
  "proseProfile": {
    "register": "the tonal register (conversational/literary/raw/clinical/sardonic/lyrical/mythic/journalistic or other)",
    "stance": "narrative stance (close_third/intimate_first_person/omniscient_ironic/detached_observer/unreliable_first or other)",
    "tense": "past or present",
    "sentenceRhythm": "terse/varied/flowing/staccato/periodic or other",
    "interiority": "surface/moderate/deep/embedded",
    "dialogueWeight": "sparse/moderate/heavy/almost_none",
    "devices": ["2-4 literary devices that suit this world's tone"],
    "rules": ["3-6 SPECIFIC prose rules as imperatives — these must be concrete enough to apply sentence-by-sentence. BAD: 'Write well'. GOOD: 'Show emotion through physical reaction, never name it' / 'No figurative language — just plain statements of fact' / 'Terse does not mean monotone — vary between clipped fragments and occasional longer compound sentences'"],
    "antiPatterns": ["3-5 SPECIFIC prose failures to avoid — concrete patterns that break this voice. BAD: 'Don't be boring'. GOOD: 'NEVER use \"This was a [Name]\" to introduce a mechanic — show what it does, not what it is called' / 'No strategic summaries in internal monologue (\"He calculated that...\") — show calculation through action' / 'Do not follow a system reveal with a sentence restating its significance' / 'Do not write narrator summaries of what the character already achieved on-page'"]
  },
  "planGuidance": "2-4 sentences of specific guidance for scene beat plans. What mechanisms should dominate? How should exposition be handled? What should plans avoid? EXAMPLE: 'Prioritise action and dialogue beats over narration. System mechanics revealed through usage, never expository narration beats. Internal monologue should be tactical and clipped. Plans should never include a beat whose purpose is to explain a concept that was already demonstrated in a prior beat.'",
  "patterns": ["3-5 positive thematic commandments derived from THIS story's GENRE. First identify the genre/subgenre (progression fantasy, space opera, cozy mystery, dark romance, LitRPG, etc), then extract patterns that make stories in this tradition succeed: genre-specific tropes to embrace (e.g. 'Power scaling follows satisfying tiers'), structural rhythms (e.g. 'Each arc ends with breakthrough and cost'), character dynamics typical of the genre (e.g. 'Rivals become reluctant allies'). EXAMPLES: 'Every cost paid must compound into later consequence', 'The underdog earns every advantage through sacrifice, never luck'"],
  "antiPatterns": ["3-5 negative story commandments — common pitfalls in THIS genre to avoid. Genre-specific tropes to subvert or skip (e.g. 'No harem dynamics'), common genre failures (e.g. 'No convenient power-ups without setup'), patterns that would break this work's tone. EXAMPLES: 'No deus ex machina rescues', 'Antagonists cannot be stupid just to let protagonists win', 'No info-dumps disguised as dialogue'"]
}
</output-format>

<rules name="pilot-episode" hint="Establish a tight, focused world. These are minimums; exceed when the premise warrants it.">
- establish a tight, focused world. These are minimums; exceed when the premise warrants it:
- AT LEAST 8 characters: 2+ anchors, 3+ recurring, 3+ transient
- AT LEAST 6 locations with parent/child hierarchy (at least 2 nesting levels)
- AT LEAST 4 threads — a DELIBERATE MIX of thread shapes (see THREAD SHAPES below). A healthy seed carries: 1+ discrete-resolution (a concrete question that will be decisively answered within a few arcs), 1+ slow-burn (stays uncertain for most of the work, resolves late and hard), 1+ constant-tension (a philosophical/character spine — "will they ever forgive themselves?", "can X achieve eternal life?" — pulses forever, may or may not close). Threads force entities into action. At least 2 must share participants so their markets correlate.
- AT LEAST 8 relationships (at least 1 hostile)
- AT LEAST 1 artifact when the premise involves tools or objects of power
- AT LEAST 12 system nodes with 8 edges — the systems, principles, tensions, and structures the world runs on. This is the foundational system graph every future scene draws from; a thin root means thin scenes forever. Each node MUST be 15-25 words describing a general rule or structural fact (how the world works). Include micro-rules (specific mechanics), mid-rules (institutional/economic), and macro-rules (cosmological/thematic). SHORT NAMES ARE FAILURES — "Aperture Grading" is wrong; "The sect grades disciples by aperture quality, with A-grade apertures receiving priority resource allocation and mentorship" is correct.${worldOnly ? '' : `
- AT LEAST 8 scenes in 1 arc, AVERAGING ~${forceReferenceMeansWorld} world nodes and ~${forceReferenceMeansSystem} system nodes per scene (these are the grading reference means). Some scenes quiet, some dense — but the MEAN across the arc must hit the reference or the whole pilot grades in the 60s. A typical scene touches 3-5 entities with ${worldTypicalBand} world nodes and reveals ${systemTypicalBand} system concepts; climactic scenes push to ${worldClimaxBand} world and ${systemClimaxBand} system.`}

SEEDING FATE — a great world is pregnant with story. Every entity you create should carry the seeds of future conflict:
- Threads are fate's mechanism — each thread is a COMPELLING question (stakes + uncertainty + investment) the story MUST eventually answer
- Characters carry secrets that WILL come out, goals that WILL collide, relationships that WILL be tested
- Locations hold histories that WILL matter, resources that WILL be contested, rules that WILL constrain
- Artifacts have costs that WILL be paid, powers that WILL corrupt, origins that WILL be revealed
- Systems create pressures that WILL force action — scarcity breeds conflict, power demands trade-offs
- The reader should sense from page one that SOMETHING LARGER IS COMING. Every detail is a fuse; you're laying the powder trail
- Plant surprises: at least 2 characters should have secrets even the reader doesn't know yet (these go in world nodes of type "secret")
- Create asymmetries: what Character A believes about Character B should differ from reality in ways that will explode later
- Build pressure: threads should share participants so collision is INEVITABLE, not coincidental

ENTITY DEFINITIONS:
- Characters are conscious beings with agency — people, named animals, sentient AI (AGI). Non-sentient AI systems are artifacts.
- Locations are spatial areas or regions — physical places you can be IN.
- Artifacts are anything that delivers utility — active tools, not passive concepts. Concepts belong in system knowledge.
- Threads are COMPELLING QUESTIONS that shape fate. A compelling question has stakes, uncertainty, and investment. Match the narrative's register. BAD: "Will X succeed?" GOOD (narrative): "Can Ayesha clear her grandfather's name before the tribunal ends?" GOOD (argument): "Does the proposed mechanism explain the anomalies the prior model cannot?" GOOD (inquiry): "What role did diaspora networks play in the movement before digital coordination?" Thread logs track incremental answers.

THREAD SHAPES — threads differ in how they live and die. A good seed mixes them:
  • DISCRETE-RESOLUTION — a concrete question with a clean answer. Resolves within 1-3 arcs when the evidence is in. Outcomes are usually binary or small-N ("What grade aperture does X have?" → {A, B, C, D}). The market goes from high uncertainty to collapse in a single decisive scene; once answered, it closes and stays closed. Seed 1-2 of these as early-arc hooks.
  • SLOW-BURN — stays genuinely uncertain across many arcs. The market oscillates and re-prices but doesn't close until structural conditions align late in the work ("Can the rebellion topple the regime?", "Does the theory survive the critical test case?"). Seed 1-2 of these as the story's middle spine. These require a healthy diet of small evidence updates scene-by-scene; starve them and they abandon.
  • CONSTANT-TENSION — a philosophical or character spine that pulses forever. It asks a question that shapes every decision ("Can Fang Yuan achieve eternal life?", "Will she ever forgive her mother?", "Is the universe cruel or indifferent?"). The market may never close within the work's scope; instead its probability drifts as events reshape the character's stance. These need recurring small pulses to stay alive (volume decay is lethal); treat them as the story's weather, not its plot. Seed 1-2.

Within the same story, these shapes should feel distinctly different to the reader. A discrete-resolution thread that pulses through 20 scenes without resolving has been mis-shaped. A constant-tension thread that closes cleanly in arc 3 has been mis-shaped. Name the shape when you seed — match the question to the lifetime you intend.

CHARACTER DEPTH BY ROLE — minimums; go deeper for complex characters. These initial world nodes become the first readings the grader sees, and anchor entities will be revisited for world deltas across every scene, so seed them richly. List each entity's nodes in the causal/temporal order they became true — adjacent nodes auto-chain into the entity's inner graph, no manual edges needed:
- Anchors: 6-8 world nodes each — defining trait, goal, belief, weakness, secret, capability, relation, history.
- Recurring: 3-4 world nodes each — role, relationship to an anchor, one hidden dimension, one capability or limitation.
- Transient: 1-2 world nodes each — their function and a distinguishing trait.

SEED DATA vs. BARE PREMISE:
The premise may include user-provided characters, locations, threads, rules, and systems. Handle both cases:
- IF seeded: Use the provided entities as anchors and starting points. Expand the world around them — add supporting cast, sub-locations, connecting threads. Honour the user's descriptions and relationships but deepen them with secrets, contradictions, and hidden connections. The user's input is the skeleton; you build the muscle and skin.
- IF bare premise (just a concept/genre/theme with no entities): Interpret the premise ambitiously. Extrapolate a full world with factions, geography, history, and power structures. A one-line prompt like "kung fu monks in space" should produce a world as rich and specific as one seeded with 20 entities. Do not produce a thin world just because the input was thin.

NAMING — CRITICAL:
The premise may contain placeholder or generic names (e.g. "The Reincarnator", "The Elder Council", "Shadow Realm"). Replace ALL placeholder names with original, specific names. Naming is the single biggest quality signal.

Name like a writer with cultural specificity, not a fantasy name generator:
- FIRST: detect the cultural origin implied by the premise. Never default to Anglo/Celtic/Greek. Palettes include (non-exhaustive):
    • East Asian — Han Chinese (classical / modern), Japanese (kun/on readings), Korean, Vietnamese, Mongolian
    • South Asian — Sanskrit, Tamil/Dravidian, Bengali, Punjabi, Sinhala, Pashto
    • Middle Eastern / West Asian — Arabic, Persian/Farsi, Turkish, Hebrew, Aramaic, Kurdish
    • African — Yoruba, Igbo, Akan, Amharic, Swahili, Zulu, Wolof, Hausa, Malagasy, Tamazight
    • Indigenous — Nahuatl, Quechua, Navajo, Cree, Māori, Hawaiian, Sami (use respectfully, avoid sacred/taboo names)
    • Slavic, Baltic, Nordic, Celtic, Greek, Latin — treat these as one palette among many, not the default
    • Latin American, Caribbean, Lusophone African, Filipino, Indonesian, Malay — use for regions inspired by colonial/post-colonial or maritime cultures
    • Diasporic & multicultural — names that mark hybridity (e.g. Chinese-Peruvian, Lebanese-Brazilian, British-Nigerian) where the premise calls for it
- Source names from real census records, historical obscurities, regional naming traditions, or deliberate etymological construction rooted in SPECIFIC cultures matching the world's origin. A world inspired by Song Dynasty China should have names sourced from Chinese historical records. A world inspired by Ottoman history from Turkish/Arabic/Persian roots. A West African-inspired world from Yoruba, Akan, or Wolof roots. A Sanskrit-inflected world from Vedic or Tamil sources.
- For multicultural worlds: each faction, region, or cultural group gets its own distinct naming palette reflecting its origin. Names should signal which part of the world a character comes from.
- Pick a consistent cultural palette for each faction or region and stay within it. Internal consistency is more important than variety.
- Prefer rough, blunt, asymmetric names where the source tradition allows it. Names with hard consonant clusters, unexpected syllable stress, tonal marks, or occupational origins feel lived-in. Smooth melodic names with open vowels feel generated — unless the palette is genuinely melodic (e.g. Hawaiian, Japanese), in which case lean into the tradition's own texture.
- Surnames from occupations, geography, patronymics/matronymics, or clan names — never compound noun+noun fantasy construction.
- Location names: derive from terrain, founders, or linguistic corruption of older words. They should sound like they've been mispronounced for centuries within their own language family.
- Thread/system names: concrete and specific. "The Tithe of Ash" not "The Power System". "The Lazar Compact" not "The Ancient Alliance". Match the cultural palette — a Mughal-inspired system might be "The Mansabdari Ledger", a West African one "The Ọba's Covenant".
- Test: if a name could appear in 10 different Anglo-fantasy novels interchangeably, it's too generic. If it could only belong to THIS world and this culture, it's right.
- Respect: when drawing from Indigenous or living religious traditions, avoid names with explicit sacred/taboo status. Use the tradition's everyday register, not its ceremonial one, unless the premise explicitly calls for the latter and handles it with weight.

LOCATION HIERARCHY & AGENCY:
- Build spatial nesting: Region → Settlement → District → Specific Place
- A city with 5 sub-locations feels more real than 5 unconnected cities
- Include contrasting environments: if the story starts safe, the world needs a dangerous frontier
- A location is BOTH a place AND its people. A delta village is its floodplain AND its fishers AND its song cycles. A city is infrastructure AND culture AND collective will. A kingdom is territory AND governance AND identity. A monastery is cells AND its order. A research institute is buildings AND its reviewers. Locations think, feel, and act through their inhabitants.
- Prominence: "domain" locations are centers of power with deep inner worlds, "place" locations are recurring settings, "margin" locations are transitional.
- Domain locations: 4-6 world nodes (history, traits, capabilities, weaknesses, goals, beliefs). They impose rules on characters and have collective agency — a kingdom demands fealty, a city mourns its dead, an organization pursues its agenda.
- Place locations: 2-3 world nodes (history, state, trait).
- Margin locations: 1 world node (trait or state).

RELATIONSHIPS:
- Connect anchors to MANY characters (6+ relationships per anchor)
- Asymmetric descriptions: "A admires B" while "B suspects A"
- At least 2 hidden relationships (known to reader, not to characters)

ARTIFACTS & TOOLS:
- Artifacts are things that by themselves can provide utility. They extend what's possible — a magical weapon changes how someone fights, AI technology changes the scale of thought, a cursed ring slowly consumes its bearer. Artifacts modify their wielder's capabilities and constrain their choices.
- Key artifact (1): a capability-altering entity. 5-7 world nodes (traits, capabilities, history, weaknesses, secrets, goals). Must connect to at least 2 threads. Its inner world should rival a recurring character's. Define HOW it changes what its wielder can do.
- Notable artifact (1): a tool that grants a specific capability. 3-4 world nodes (capability, history, relation, weakness). Owned by a character who uses it — the character's capabilities should reflect the tool.
- Minor artifact (1): a small object with narrative potential. 1-2 world nodes. Can be at a location.
- Artifacts must feel integral to the world. Key artifacts should have world edges (capability motivated_by history, weakness caused_by trait).

${worldOnly ? '' : `Every anchor must appear in at least 3 scenes. Use at least 6 different locations across the 8 scenes.

TIME DELTA — REQUIRED on every scene. Each scene is an instant in time; timeDelta captures the gap since the PRIOR scene as an estimate. Always commit to a best-guess; do not skip the field.
- value: integer ≥ 0. unit: one of minute | hour | day | week | month | year. Pick the unit that reads most naturally ("that evening" → 3 hours, "the next morning" → 1 day, "three years later" → 3 years).
- {value: 0, unit: "minute"} marks a concurrent / simultaneous scene (same moment, different POV or vantage) — also use this for the very first scene of the arc where there's no prior scene to measure against.
- This is an ESTIMATE — it's understood that you're reading prose cues, not consulting a calendar. Pick the most plausible value.
- This is a RELATIVE delta only; there is no absolute calendar anchor. Do not assume a start date.

${PROMPT_POV}
${PROMPT_FORCE_STANDARDS}
${PROMPT_STRUCTURAL_RULES}
${PROMPT_DELTAS}
${PROMPT_WORLD}
${PROMPT_ARC_STATE_GUIDANCE}
${PROMPT_SUMMARY_REQUIREMENT}`}
</rules>
`;
}
