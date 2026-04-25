/**
 * Per-arc reasoning graph prompt — builds the causal graph (8-20 typed nodes)
 * that scenes execute. Takes pre-built dynamic blocks (network state line,
 * pattern/anti-pattern sections, force-preference / reasoning-mode /
 * network-bias blocks, prior-graph divergence section, coordination plan
 * context) so the prompts module stays free of upstream dependencies.
 */

export const ARC_REASONING_GRAPH_SYSTEM =
  'You are a story strategist building the causal reasoning graph for one arc. Choose nodes (fate, reasoning, character, location, artifact, system, pattern, warning, chaos) and typed edges (requires, enables, constrains, causes, reveals, develops, resolves) that capture how the arc actually works — fate, world, and system interacting, not one dominating. Honour the thinking mode (abduction/divergent/deduction/induction) and the divergence pressure from any prior graph. Cast must show agency across multiple characters, not just the protagonist. Return ONLY valid JSON matching the schema in the user prompt.';

export const COORDINATION_PLAN_SYSTEM =
  'You are a multi-arc planner using backward induction. Build a coordination plan organised around peaks (where forces converge, threads culminate) and valleys (where the arc pivots) — one anchor per arc. Use chronological indexing, distribute character agency, mix arc sizes and force compositions, route around any patterns/warnings. Return ONLY valid JSON matching the schema in the user prompt.';

export type CoordinationPlanContextForPrompt = {
  arcIndex: number;
  arcCount: number;
  forceMode?: string | null;
  directive: string;
};

export type ArcReasoningGraphArgs = {
  context: string;
  networkStateLine: string;
  activeThreads: string;
  characters: string;
  locations: string;
  artifacts: string;
  systemKnowledge: string;
  patternsSection: string;
  antiPatternsSection: string;
  arcName: string;
  sceneCount: number;
  coordinationPlanContext: CoordinationPlanContextForPrompt | undefined;
  direction: string;
  priorGraphSection: string;
  forcePreferenceBlockText: string;
  reasoningModeBlockText: string;
  networkBiasBlockText: string;
  /** Min node-count target (computed from sceneCount × reasoning scale). */
  nodeCountMin: number;
  /** Max node-count target. */
  nodeCountMax: number;
};

export function buildArcReasoningGraphPrompt(args: ArcReasoningGraphArgs): string {
  const {
    context,
    networkStateLine,
    activeThreads,
    characters,
    locations,
    artifacts,
    systemKnowledge,
    patternsSection,
    antiPatternsSection,
    arcName,
    sceneCount,
    coordinationPlanContext,
    direction,
    priorGraphSection,
    forcePreferenceBlockText,
    reasoningModeBlockText,
    networkBiasBlockText,
    nodeCountMin,
    nodeCountMax,
  } = args;

  return `<inputs>
  <narrative-context>
${context}
  </narrative-context>

  <network-state>${networkStateLine}</network-state>

  <available-entities hint="Quick pick-list — full annotations live on the entity tags in the narrative context above.">
    <active-threads hint="Threads are QUESTIONS the story must answer.">
${activeThreads || "None yet"}
    </active-threads>
    <key-characters>
${characters || "None yet"}
    </key-characters>
    <key-locations>
${locations || "None yet"}
    </key-locations>
    <key-artifacts>
${artifacts || "None yet"}
    </key-artifacts>
    <system-knowledge>
${systemKnowledge || "None yet"}
    </system-knowledge>
  </available-entities>

${patternsSection ? `  <patterns>\n${patternsSection}\n  </patterns>` : ''}
${antiPatternsSection ? `  <anti-patterns>\n${antiPatternsSection}\n  </anti-patterns>` : ''}

  <arc-brief arc-name="${arcName}" scene-count="${sceneCount}">
${coordinationPlanContext ? `    <coordination-plan arc-index="${coordinationPlanContext.arcIndex}" arc-count="${coordinationPlanContext.arcCount}"${coordinationPlanContext.forceMode ? ` force-mode="${coordinationPlanContext.forceMode}"` : ''} hint="PRIMARY BRIEF — multi-arc plan derived from backward induction. The reasoning graph must execute the plan for this arc.">
      <directive>
${coordinationPlanContext.directive}
      </directive>
      <execution-rules>
        <rule>Ground the plan's abstract plot points in SPECIFIC entities, locations, and mechanisms.</rule>
        <rule>Fill in the HOW — the plan says WHAT must happen; you determine the specific path.</rule>
        <rule>Maintain the plan's thread targets — if the plan says thread X should escalate, your graph must deliver that escalation.</rule>
        <rule>Respect the force mode — if world-dominant, lean into character development; if fate-dominant, lean into thread resolution.</rule>
      </execution-rules>${direction.trim() ? `
      <additional-direction hint="Layer on top of the plan.">${direction}</additional-direction>` : ''}
    </coordination-plan>` : `    <direction>${direction}</direction>`}
  </arc-brief>
${priorGraphSection ? `\n  ${priorGraphSection.replace(/\n/g, '\n  ')}\n` : ''}
${forcePreferenceBlockText ? `  ${forcePreferenceBlockText.replace(/\n/g, '\n  ')}\n` : ''}
${reasoningModeBlockText ? `  ${reasoningModeBlockText.replace(/\n/g, '\n  ')}\n` : ''}
${networkBiasBlockText ? `  ${networkBiasBlockText.replace(/\n/g, '\n  ')}\n` : ''}
</inputs>

<task>Build a REASONING GRAPH for "${arcName}" to guide ${sceneCount} scene(s).</task>

<reasoning-doctrine hint="Foundational principles guiding how the graph is constructed.">
  <principle name="threads-are-influence">FATE THREADS ARE INFLUENCE, NOT ANCHORS. The active-thread list above carries a signal per thread — LEANS / ACTIVE / CONTESTED / VOLATILE / FADING — derived from its current market state. Treat these like you treat characters, locations, and system rules: as the force field in which the reasoning happens. A LEANS thread exerts strong pull — the reasoning should bend toward its leading outcome unless you're staging a twist. A CONTESTED thread leaves genuine room; the reasoning is free to add uncertainty (ending the arc with the market MORE contested than it started is legitimate, sometimes necessary). A VOLATILE thread is where twists land well. A FADING thread is on its way out — don't force evidence on it unless you're deliberately resurrecting.</principle>
  <principle name="markets-swing">MARKETS SWING — PROBABILITY LEADERSHIP IS NOT DESTINY. A LEANS signal says "the current observer thinks outcome X is most likely given evidence so far" — it does NOT say "the arc must deliver X." System rules and world state are fully allowed to overturn a lean when the reasoning logically points elsewhere. If the arc's reasoning chain credibly forces a force-of-system event (a hidden rule surfaces, a constraint reveals the plan is impossible, an entity's true state undoes the assumption) or a force-of-world event (a character's change of allegiance, a rival's capability coming online, an alliance fracturing), the arc should deliver that event and the resulting thread moves can flip a p=0.75 leader to the lagging outcome. Stage these as twist nodes, not as resistance nibbling. A good arc sometimes earns its power precisely by showing the market was wrong — world and system are not just texture, they are forces that can logically overturn fate's pull.</principle>
  <principle name="nodes-earn-existence">Every node EARNS its existence by doing distinct work. A node whose subject (actor × action × target) matches another node is the same node with more edges, not a second node. Minor-variation repetition is a pulse on the existing step, not a new step.</principle>
  <principle name="novelty-is-motion">Novelty is the story's forward motion. Resolved threads mostly stay resolved — don't keep re-opening a closed question. Prefer NEW chains of reasoning over extending existing ones into minor variation. Sameness is the enemy; variety is how the reader feels the story moving.</principle>
  <principle name="three-forces-aggregate">THE THREE FORCES AGGREGATE HERE. The reasoning graph is where fate, world, and system converge. Fate markets exert pressure (via the signals above); world entities bring agency (characters pursuing their own goals, locations enabling or constraining, artifacts shaping action); system rules impose constraints. Good reasoning arises from the interaction of all three, not from one dominating. A graph that only chases fate resolution is a plot outline; a graph that only develops world is a character sketch; a graph that only elaborates system is a rulebook. Aggregation is the craft.</principle>
  <principle name="resolution-is-consequence">Resolution is the reader's dopamine when it arrives, but resolution is a CONSEQUENCE of reasoning, not a prerequisite. Let fate commitments emerge from what the reasoning can credibly serve. If a LEANS thread has the volume + margin + scene count to close cleanly in this arc, the reasoning should land it. If it doesn't, don't force a closure — the market will carry the thread forward and next arc's reasoning will pick it up. Forcing closure the arc can't earn is worse than leaving the thread pulsing. This is the feedback loop: reasoning shapes scenes, scenes re-price the markets, the next arc's reasoning sees the new state. The system converges when the writing is honest about what each arc can deliver.</principle>
</reasoning-doctrine>

<node-types hint="Every node grounded in SPECIFIC context from the inputs above.">
  <type name="fate">A thread that the reasoning graph actively couples to. Fate nodes are NOT mandatory anchors — they appear when the reasoning genuinely engages a thread (landing its outcome, pushing it toward a resolution, or seeding a new market). A fate node labelled around a closure indicates this arc's reasoning delivers that thread's payoff. A fate node mid-graph indicates the thread pulls on the causal chain here. A fate node on a newly-seeded thread marks a market the reasoning has opened. Use threadId. Label = what the thread does in this arc. Threads with a strong LEANS signal often earn a fate node landing their outcome; CONTESTED threads may earn a fate node that deliberately refuses to resolve; FADING threads usually earn no fate node at all.</type>
  <type name="character">An active agent with their OWN goals — not just a reactive foil to the protagonist. Use entityId to reference actual character. Label = their position/goal. Cast distribution matters: a graph where every character node is the protagonist is a failure of agency. Include secondary characters as drivers — a rival plotting, an ally hedging, a mentor withholding — each with their own causal chain that interacts with the main arc rather than merely reacting to it. The arc's causal web should have at least 2–3 distinct characters acting as agents, not as scenery.</type>
  <type name="location">A setting. Use entityId to reference actual location. Label = what it enables/constrains.</type>
  <type name="artifact">An object. Use entityId to reference actual artifact. Label = its role in reasoning.</type>
  <type name="system">A world rule/principle/constraint. Use systemNodeId to reference an existing SYS-XX node from AVAILABLE ENTITIES → System Knowledge. Label = the rule as it applies here. If you need to introduce a brand-new rule that doesn't exist yet, omit systemNodeId — but prefer reusing an existing rule when one fits.</type>
  <type name="reasoning">A step in the causal chain — a distinct state-change. Every reasoning node earns its place by turning one thing into another: a demand into a plan, a plan into an action, an action into a consequence, a consequence into new pressure. Two reasoning nodes with the same subject (actor × action × target) are one node with more edges, not two. Minor restatement ("siphons again at another cache", "detects suspicion a fourth time") is a pulse on the existing step — escalate or merge, don't duplicate. Label = the inference (3-8 words).</type>
  <type name="pattern">NOVEL-PATTERN GENERATOR. Proposes a story shape this narrative HAS NOT used before — a fresh configuration, rhythm, or relational geometry that is absent from prior arcs and scenes. Not generic creativity: a specific structural move the story hasn't made. Every pattern node answers "what has this story never done that it could do here?" Example labels: "First arc resolved through a non-POV character's choice", "Two anchors separated across the arc — no shared scenes", "Fate subverts by succeeding too completely". Scan prior arcs before proposing; do not repeat a shape already used.</type>
  <type name="warning">PATTERN-REPETITION DETECTOR. Scans prior arcs and scenes and FLAGS shapes the reader has already seen — resolution rhythms, conflict geometries, character dynamics, arc cadences — that this arc is drifting toward repeating. Humans are powerful pattern recognisers: once a shape repeats (same resolution twice, same beat three times, same dominant force four arcs running) the reader notices and the move loses weight. The warning's job is to name the repetition explicitly so the graph can route around it. Example labels: "Third arc ending with external rescue — reader will feel the pattern", "A and B have now used the tension-then-reconciliation beat three times", "Fourth consecutive fate-dominant arc — rhythm is becoming monotone".</type>
  <type name="chaos">OUTSIDE FORCE — operates outside the existing fabric of fate, world, and system. Two everyday modes: as a deus-ex-machina, brings problems the cast couldn't anticipate or solutions the cast couldn't build (a troll bursts into the dungeon, a stranger arrives with a fragmentary map, a dormant artefact wakes); as a creative engine, seeds entirely new fates — new threads that didn't exist, which later arcs develop and resolve. Chaos sits OUTSIDE fate, but shapes fate by creating fresh strands. A well-used chaos node earns its weight: it breaks a stalemate the existing forces couldn't, and it plants something the story can reuse. Use sparingly under freeform; use extensively under chaos-preference. Label = what arrives and its role. DO NOT set entityId or threadId — the entity/thread is spawned via world expansion.</type>
</node-types>

<edge-types>
  <edge name="enables">A makes B possible (B could exist without A, but not here).</edge>
  <edge name="constrains">A limits/blocks B.</edge>
  <edge name="risks">A creates danger for B.</edge>
  <edge name="requires">A depends on B (direction matters — A needs B, not B needs A; reversing this corrupts the graph silently).</edge>
  <edge name="causes">A leads to B (B would not exist without A).</edge>
  <edge name="reveals">A exposes information in B.</edge>
  <edge name="develops">A deepens B (use for character/thread arcs only, not generic logic steps).</edge>
  <edge name="resolves">A concludes/answers B.</edge>
</edge-types>

<requirements>
  <requirement index="1" name="start-where-pressure-strongest">In backward modes (abduction/induction), start from the arc's natural terminal — where fate LEANS strong, where world change needs to land, or where system revelation pays off — and reason backward to the entity facts that enable it. The terminal can be a fate node, a reasoning node, or a character-transformation node; whichever force the arc most honestly serves. Fate is one input to the graph, not the only input.</requirement>
  <requirement index="2" name="causal-complexity">The arc is a causal reasoning diagram — capture the REAL complexity of how it unfolds. Threads pull on multiple things, entities influence multiple moments, rules constrain several choices. When you add a node, show all the places it matters.</requirement>
  <requirement index="3" name="aggregate-three-forces">The graph's coherence comes from fate, world, and system interacting, not from one dominating. Fate markets set pressure (via the per-thread INFLUENCE signals); world entities bring agency; system rules impose constraints. Good reasoning is the product of their interaction. A graph that only pursues fate is a plot sketch; one that only develops world is a character study; one that only elaborates system is a rulebook. Let the three forces argue with each other in the causal chain.</requirement>
  <requirement index="4" name="unexpected-directions">Reasoning doesn't always serve the market's expectation. A LEANS thread can be subverted if the scene count and evidence warrant a twist; a CONTESTED thread can be deliberately left more uncertain than it started. When reasoning genuinely diverges from the market's prior, the next scene's evidence will re-price accordingly — that is the feedback loop doing its job.</requirement>
  <requirement index="5" name="sequential-indexing">\`index\` is a causal topological order — 0 is the root (no predecessors), each later index's predecessors have lower indices, the terminal sits at the highest. Walking ascending indices should feel like one coherent sweep, not subgraph jumps. \`order\` is auto-captured from array position and may differ from \`index\` in backward modes — that's the point. Emit \`plannedNodeCount\` before the nodes array to commit to a count.</requirement>
  <requirement index="6" name="entity-references">Character / location / artifact nodes MUST use entityId with an actual ID from AVAILABLE ENTITIES. Hallucinated IDs (e.g. C-99 when no such character exists) are stripped at parse time and the node loses its anchor.</requirement>
  <requirement index="7" name="thread-references">Fate nodes MUST use threadId to reference which thread exerts the pull. The threadId must match an existing thread in AVAILABLE ENTITIES → Active Threads.</requirement>
  <requirement index="8" name="system-references">System nodes MUST use systemNodeId to reference an existing SYS-XX node from AVAILABLE ENTITIES → System Knowledge. The narrative lists each system node with its [SYS-XX] id alongside the concept text — copy the bracketed id verbatim. If no existing rule fits and you genuinely need a new one, you may omit systemNodeId; the system node then represents a fresh rule. Reuse beats invention.</requirement>
  <requirement index="9" name="single-entity-node-per-entity">If the same character or system matters in multiple places, create ONE node with multiple edges — don't duplicate.</requirement>
  <requirement index="10" name="node-count">Target ${nodeCountMin}-${nodeCountMax} nodes across all types. The nudged bands leave room for secondary characters to get their own reasoning chains, not just appear as participants.</requirement>
  <requirement index="11" name="pattern-nodes">1-2 nodes, each introducing a story shape the narrative has NOT used before. Scan prior arcs; name the new pattern; make sure the arc actually uses it.</requirement>
  <requirement index="12" name="warning-nodes">1-2 nodes, each naming a specific repetition risk drawn from prior arcs/scenes — "we have ended the last two arcs this way", "this dynamic between A and B has already happened N times". Vague warnings are worthless; the warning must cite what is actually repeating.</requirement>
  <requirement index="13" name="chaos-nodes">1-2 default, more under chaos preference. Inject at least one outside-force element — a new character arriving, a dormant artefact waking, a new fate appearing. Do NOT reference existing entityIds — chaos describes an entity that will be spawned. A chaos node signals the scene generator to invoke world expansion.</requirement>
  <requirement index="14" name="non-deterministic">Each reasoning path should contain at least one SURPRISE — something that doesn't follow obviously from context.</requirement>
  <requirement index="15" name="warning-pattern-response" critical="true">Warnings and patterns must structurally change the graph, not sit as ornaments. A warning's repetition-risk is routed around (chaos, subverted reasoning, different fate direction); a pattern's proposed shape appears in actual nodes. Wire warning/pattern nodes to the body via edges — orphaned ones are dead weight; cut or connect.</requirement>
  <requirement index="16" name="cast-distribution" critical="true">Character nodes reference ≥2 distinct entityIds (≥3 if the arc touches 3+ named characters). Every named character has at least one OUTGOING edge — characters acted upon without agency are absorbed into reasoning nodes, not rendered as scenery. Rivals/allies/mentors need independent goals visible in the causal chain.</requirement>
  <requirement index="17" name="thread-closure-earned">A thread closes when the market says it can — strong LEANS signal, sufficient volume, scene count enough to land decisive evidence. Threads with those conditions SHOULD receive a fate node that lands the closure; the reasoning then works backward to supply it. Threads without those conditions stay open — forcing a closure the arc can't credibly deliver is worse than leaving the thread pulsing. The feedback loop runs both ways: reasoning may land a closure the prior didn't expect (twist), or deliberately refuse a closure the prior wanted (uncertainty maintained). Honesty about what each arc can earn is how the system converges over many arcs.</requirement>
  <requirement index="18" name="delivery-when-it-lands">Closures when they arrive are the reader's dopamine — the feeling of tension resolving. But a graph isn't failing if no thread closes this arc: some arcs are CONTESTED-heavy, re-pricing markets without landing any of them, and that's a legitimate shape (a mid-story crossroads, a pivot arc). Aim for closures where the market justifies them; don't invent them where the market doesn't.</requirement>
  <requirement index="19" name="no-subject-or-pattern-repetition">Two nodes with the same actor + action + target are one node with more edges — merge. Two reasoning nodes with the same SHAPE applied to different objects — "X exploits chaos to acquire Y" iterated for three different Y's, or "character leverages Z" repeated three times with different Zs — are one pattern rehearsed. Reasoning-pattern repetition reads as OCD: the graph thinks one thought over and over, not many different thoughts. Each reasoning node should bring a genuinely different mode of inference — deduction, abduction, analogy, inversion, constraint propagation. If you catch yourself rephrasing the same template, change shape or merge.</requirement>
  <requirement index="20" name="terminal-commits">The last-indexed node must advance the state — closing a thread, landing a character transformation, revealing a system truth, or hard-pivoting to the next arc. Never a resting state. Which of those it is depends on what the arc honestly served.</requirement>
  <requirement index="21" name="novelty-over-recycling">Resolved threads mostly stay resolved — recycling is the exception, not the default. Prefer new threads of fate and new chains of reasoning over extending what already exists. Variety is the story's forward motion; sameness is stall.</requirement>
</requirements>

<shape-of-good-arc-graph>
  An arc reasoning graph is a causal diagram, not a chain of justifications. A good graph captures how the arc actually works: key characters connect to several reasoning nodes, rules constrain multiple choices, the arc's climax is the convergence of several setups rather than the end of a single line. When you finish, scan the graph — if it reads like a vertical list, the story's complexity is being under-represented.

  The graph should reveal the strategic logic of the three forces interacting: how the current market priors bias the reasoning, how character agency and system constraints shape the path the reasoning takes, and what closures or new markets emerge from that interaction. Fate is one voice in the argument, not the conductor.
</shape-of-good-arc-graph>

<output-format>
Return a JSON object.

<format-requirements>
  <ids>Use SEMANTIC slugs that carry the node's subject, prefixed by type. Format: \`<type>-<kebab-case-subject>\`. Examples: \`fate-cicada-mitigated\`, \`reason-chaos-masks-anomaly\`, \`char-ruo-lan-persistence\`, \`sys-essence-cost\`, \`loc-whispering-gorge\`, \`art-cicada-drain\`, \`chaos-new-rival-arrives\`, \`pattern-two-threads-converge\`, \`warn-ruo-lan-repeats\`. Slug length: 3-6 words, lowercase, hyphenated. An edge \`{"from": "fate-cicada-mitigated", "to": "reason-chaos-masks-anomaly"}\` is self-describing; a reader of the graph and the model writing later edges can see what each node is without scrolling back. Do NOT use opaque short codes like F1, R2, PT1 — they force you to hold a mental table of what each code means.</ids>
  <labels>PROPER ENGLISH descriptions (3-10 words). Describe what happens in natural language. NOT technical identifiers or codes. GOOD: "Fang Yuan exploits his future knowledge", "Alliance fractures over betrayal". BAD: "Thread escalation node", "R2_REQUIRES_C1", "fate pressure mechanism".</labels>
</format-requirements>

<orderings hint="Two distinct concepts.">
  <ordering name="order">Thinking order. Auto-captured from the node's position in the JSON array — the Nth node you emit gets \`order: N\`. In backward modes (abduction / induction) the terminal is thought of first, so it lands at \`order: 0\` even though its \`index\` is the highest.</ordering>
  <ordering name="index">Presentation / causal order (topological). Roots (no causal predecessors) get low indices; the terminal gets the highest. Downstream consumers sort and step through by \`index\`.</ordering>
  <note>In forward mode the two align. In backward mode they diverge — the example below is backward (abduction): terminal outcomes at \`order: 0-2\` (thought first) but \`index: 4-6\` (causal terminal). Fate nodes appear where the reasoning credibly lands them, not as mandatory opening anchors; this arc's fate signal said T-01 LEANS "sanctuary" at p=0.78, so the reasoning lands that commitment rather than fighting it.</note>
</orderings>

<example>
{
  "summary": "1-2 sentence high-level summary of the arc's reasoning",
  "plannedNodeCount": 7,  // <-- commit first; sets terminal's max index to N-1 (6). Locked once nodes begin.
  "nodes": [
    // ── Backward mode: terminal first (order 0-2, index 4-6 at the terminal). ──
    // Fate nodes here are what the reasoning CONCLUDES, not what it was forced to serve.

    // order: 0 · index: 4 — fate node: what the reasoning lands. The LEANS signal
    // on T-01 made sanctuary the plausible resolution; the reasoning arrived here.
    {
      "id": "fate-sanctuary-secured",
      "index": 4,
      "type": "fate",
      "label": "Alliance secures sanctuary through shared cause",
      "detail": "Thread T-01's market leaned 'sanctuary' (p=0.78); the reasoning delivers it here. Closure plausible given accumulated volume and this arc's scene count.",
      "threadId": "T-01"
    },
    // order: 1 · index: 5 — reasoning: the cost that falls out of the path taken.
    // Emerges from how the resolution was earned; not a mandated resistance node.
    {
      "id": "reason-witness-exposure",
      "index": 5,
      "type": "reasoning",
      "label": "Negotiation exposes the protagonist to a hostile witness",
      "detail": "The path to sanctuary required revealing knowledge; the witness sees it. A genuine setback that the reasoning generated, not a slot it filled."
    },
    // order: 2 · index: 6 — fate node: a new thread emerges from the cost.
    {
      "id": "fate-witness-leverage",
      "index": 6,
      "type": "fate",
      "label": "Witness now holds leverage over the protagonist",
      "detail": "A new market opens: will the witness speak? Seeded at uniform prior; later arcs re-price it.",
      "threadId": "T-NEW"
    },
    // ── Derive backward: what reasoning achieves the resolution? ──

    // order: 3 · index: 3 — the causal step.
    {
      "id": "reason-sanctuary-needs-alliance",
      "index": 3,
      "type": "reasoning",
      "label": "Sanctuary requires alliance with rival faction",
      "detail": "Backward reasoning from the LEANS signal on T-01"
    },
    // ── Ground in entity facts (roots; thought of last in backward mode). ──

    // order: 4 · index: 0 — root: who.
    {
      "id": "char-fang-yuan-knows-weakness",
      "index": 0,
      "type": "character",
      "label": "Fang Yuan knows the faction's secret weakness",
      "detail": "Who can fulfill this requirement",
      "entityId": "actual-character-id-from-narrative"
    },
    // order: 5 · index: 1 — root: rule.
    {
      "id": "sys-clan-hierarchy-forbids",
      "index": 1,
      "type": "system",
      "label": "Clan hierarchy forbids direct negotiation",
      "detail": "What system/rule shapes the action",
      "systemNodeId": "actual-SYS-id-from-narrative"
    },
    // order: 6 · index: 2 — root: outside force.
    {
      "id": "chaos-exile-seeks-asylum",
      "index": 2,
      "type": "chaos",
      "label": "An exile from a rival clan arrives seeking asylum",
      "detail": "OUTSIDE FORCE — a NEW character spawned via world expansion. No entityId."
    }
  ],
  "edges": [
    // Topological flow: roots (low index) → reasoning → commitments (high index).
    // For \`requires\`: from-node depends on to-node; to-node has LOWER index (prerequisite).
    // For \`causes\` / \`enables\` / \`constrains\`: from-node precedes to-node; from-node has LOWER index.

    // Fate node depends on the reasoning that arrives at it.
    {"id": "e1", "from": "fate-sanctuary-secured", "to": "reason-sanctuary-needs-alliance", "type": "requires"},
    // Reasoning depends on the character fact.
    {"id": "e2", "from": "reason-sanctuary-needs-alliance", "to": "char-fang-yuan-knows-weakness", "type": "requires"},
    // Rule shapes the character's action.
    {"id": "e3", "from": "sys-clan-hierarchy-forbids", "to": "char-fang-yuan-knows-weakness", "type": "constrains"},
    // Outside force enables the reasoning.
    {"id": "e4", "from": "chaos-exile-seeks-asylum", "to": "reason-sanctuary-needs-alliance", "type": "enables"},
    // The reasoning CAUSES the setback — the cost falls out of the path taken.
    {"id": "e5", "from": "reason-sanctuary-needs-alliance", "to": "reason-witness-exposure", "type": "causes"},
    // The setback SEEDS a new market. Fate node emerges from reasoning, not mandated.
    {"id": "e6", "from": "reason-witness-exposure", "to": "fate-witness-leverage", "type": "causes"}
  ]
}
</example>
</output-format>

<final-instruction>Return ONLY the JSON object.</final-instruction>`;
}
