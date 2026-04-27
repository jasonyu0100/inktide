/**
 * Per-arc reasoning graph prompt — builds the causal graph (8-20 typed nodes)
 * that scenes execute. Takes pre-built dynamic blocks (network state line,
 * pattern/anti-pattern sections, force-preference / reasoning-mode /
 * network-bias blocks, prior-graph divergence section, coordination plan
 * context) so the prompts module stays free of upstream dependencies.
 */

import { phaseGraphPriorityEntry } from "../phase/application";

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
  /** Pre-rendered <phase-graph> block (or "" when no phase graph is active). */
  phaseGraphSection: string;
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
    phaseGraphSection,
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

${patternsSection ? `  <patterns hint="Positive commandments to reinforce.">\n${patternsSection}\n  </patterns>` : ''}
${antiPatternsSection ? `  <anti-patterns hint="Pitfalls to avoid.">\n${antiPatternsSection}\n  </anti-patterns>` : ''}

  <arc-brief arc-name="${arcName}" scene-count="${sceneCount}">
${coordinationPlanContext ? `    <coordination-plan arc-index="${coordinationPlanContext.arcIndex}" arc-count="${coordinationPlanContext.arcCount}"${coordinationPlanContext.forceMode ? ` force-mode="${coordinationPlanContext.forceMode}"` : ''} hint="PRIMARY BRIEF — multi-arc plan derived from backward induction. The reasoning graph must execute the plan for this arc.">
      <directive>
${coordinationPlanContext.directive}
      </directive>
      <execution-rules>
        <rule>Plan says WHAT must happen; you determine HOW — ground abstract plot points in SPECIFIC entities, locations, and mechanisms.</rule>
        <rule>Maintain the plan's thread targets — if a thread should escalate, deliver it.</rule>
        <rule>Respect force mode — world-dominant: character development; fate-dominant: thread resolution.</rule>
      </execution-rules>${direction.trim() ? `
      <additional-direction hint="Layer on top of the plan.">${direction}</additional-direction>` : ''}
    </coordination-plan>` : `    <direction>${direction}</direction>`}
  </arc-brief>
${phaseGraphSection ? `\n  ${phaseGraphSection.replace(/\n/g, '\n  ')}\n` : ''}
${priorGraphSection ? `\n  ${priorGraphSection.replace(/\n/g, '\n  ')}\n` : ''}
${forcePreferenceBlockText ? `  ${forcePreferenceBlockText.replace(/\n/g, '\n  ')}\n` : ''}
${reasoningModeBlockText ? `  ${reasoningModeBlockText.replace(/\n/g, '\n  ')}\n` : ''}
${networkBiasBlockText ? `  ${networkBiasBlockText.replace(/\n/g, '\n  ')}\n` : ''}
</inputs>

<task>Build a REASONING GRAPH (CRG) for "${arcName}" to guide ${sceneCount} scene(s).</task>

<integration-hierarchy hint="When inputs conflict, this is the priority order. Higher-rank inputs override lower-rank ones; lower-rank inputs are still always relevant.">
  <priority rank="1">DIRECTION / ARC BRIEF — the user's explicit ask, or the coordination-plan directive when one exists. The graph delivers what the brief commits to.</priority>
  <priority rank="2">PRIOR ARC GRAPH — divergence pressure; the new graph must NOT replicate the prior spine.</priority>
  ${phaseGraphPriorityEntry(3, "reasoning-arc")}
  <priority rank="4">NARRATIVE CONTEXT — entities, threads, system rules; the substrate the chain stands on.</priority>
  <priority rank="5">FORCE PREFERENCE / REASONING MODE / NETWORK BIAS — engine tilt applied within the constraints above.</priority>
</integration-hierarchy>

<reasoning-doctrine hint="Foundational principles guiding how the graph is constructed.">
  <principle name="threads-are-influence">Fate threads are INFLUENCE, not anchors. The signal per thread (LEANS / ACTIVE / CONTESTED / VOLATILE / FADING) is the force field — like characters, locations, system rules. LEANS pulls toward the leading outcome unless you're staging a twist. CONTESTED leaves room; ending more contested than started is legitimate. VOLATILE = where twists land. FADING = don't force evidence unless deliberately resurrecting.</principle>
  <principle name="markets-swing">Probability leadership is not destiny. A LEANS signal says "currently most likely given evidence" — not "the arc must deliver X." When the reasoning credibly forces a system event (hidden rule surfaces, constraint blocks the plan) or world event (allegiance change, rival capability surfacing, alliance fractures), the arc delivers it — even flipping a p=0.75 leader. Stage as twist nodes, not resistance nibbling. World and system can overturn fate's pull.</principle>
  <principle name="nodes-earn-existence">Every node does distinct work. Same subject (actor × action × target) = one node with more edges, not two. Minor-variation repetition is a pulse on the existing step.</principle>
  <principle name="novelty-is-motion">Novelty is forward motion. Resolved threads mostly stay resolved. Prefer NEW chains of reasoning over extending existing ones into minor variation. Sameness is stall; variety is how the reader feels the story moving.</principle>
  <principle name="three-forces-aggregate">Fate, world, and system converge here. Fate markets exert pressure; world entities bring agency; system rules constrain. Coherence comes from interaction, not dominance. Fate-only = plot outline; world-only = character sketch; system-only = rulebook. Aggregation is the craft.</principle>
  <principle name="resolution-is-consequence">Resolution is the reader's dopamine, but it's a CONSEQUENCE of reasoning, not a prerequisite. Land a LEANS thread when volume + margin + scene count suffice; otherwise the market carries forward. Forcing closure the arc can't earn is worse than leaving the thread pulsing. The feedback loop converges when each arc is honest about what it can deliver.</principle>
</reasoning-doctrine>

<node-types hint="Every node grounded in SPECIFIC context from the inputs above.">
  <type name="fate">A thread the reasoning actively couples to — landing an outcome, pushing toward resolution, or seeding a new market. NOT mandatory; appears when reasoning genuinely engages a thread. Use threadId. Label = what the thread does in this arc. LEANS often earns a closure-landing fate; CONTESTED may earn a deliberately-refused-to-resolve fate; FADING usually earns no fate at all.</type>
  <type name="character">An active agent with their OWN goals — not a reactive foil. Use entityId. Label = position/goal. Cast distribution matters: an all-protagonist graph is failure of agency. Include 2–3 distinct characters as drivers (rival plotting, ally hedging, mentor withholding), each with their own causal chain.</type>
  <type name="location">A setting. Use entityId. Label = what it enables/constrains.</type>
  <type name="artifact">An object. Use entityId. Label = its role in reasoning.</type>
  <type name="system">A world rule/principle/constraint. Use systemNodeId for existing SYS-XX. Label = the rule as it applies here. New rules: omit systemNodeId — but reuse beats invention.</type>
  <type name="reasoning">A step in the causal chain — a distinct state-change (demand → plan, plan → action, action → consequence, consequence → new pressure). Same subject = one node with more edges. Minor restatements are pulses on the existing step — escalate or merge. Label = the inference (3-8 words). Detail = REQUIRED: the causal reasoning itself, 1-3 sentences. State the in-arc logic that connects this node's predecessors to its successors — given the prereqs (the entities, rules, prior reasoning), why does THIS inference follow, and what does it make possible next? Do NOT use the detail to attribute graph position ("backward from X's LEANS", "abductive step from terminal") — that's metadata, not reasoning. The chain is coherent when each node's detail reads as a real argumentative move that the next node visibly builds on.</type>
  <type name="pattern">NOVEL-PATTERN GENERATOR. Proposes a structural shape this narrative HAS NOT used before — fresh configuration, rhythm, or relational geometry. Specific, not generic. Examples: "First arc resolved through a non-POV character's choice", "Two anchors separated across the arc". Scan prior arcs first.</type>
  <type name="warning">PATTERN-REPETITION DETECTOR. Flags shapes the reader has already seen — resolution rhythms, conflict geometries, dynamics, cadences — that this arc is drifting toward. Examples: "Third arc ending with external rescue", "A and B have used tension-then-reconciliation three times", "Fourth consecutive fate-dominant arc". Name the repetition concretely.</type>
  <type name="chaos">OUTSIDE FORCE — operates outside fate/world/system. Two modes: deus-ex-machina (problems the cast couldn't anticipate, solutions they couldn't build — troll bursts in, stranger arrives, artefact wakes); creative engine (seeds new threads later arcs develop). Sparingly under freeform; extensively under chaos-preference. Label = what arrives and its role. DO NOT set entityId or threadId — spawned via world expansion.</type>
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
  <edge name="supersedes">A replaces/overrides B — the older claim, rule, plan, commitment, or state is no longer load-bearing; A is what the graph now operates on. Use when a new system rule overrides a prior one, when a fate commitment subverts an earlier expectation, when a character's revised model displaces their old model, or when a chaos event makes a prior reasoning step obsolete. Direction: A is the new/current, B is the old/displaced.</edge>
</edge-types>

<requirements>
  <requirement index="1" name="start-where-pressure-strongest">In backward modes (abduction/induction), start from the arc's natural terminal — where fate LEANS strong, world change needs to land, or system revelation pays off — and reason backward to the entity facts that enable it. Terminal can be fate, reasoning, or character-transformation node; whichever force the arc most honestly serves.</requirement>
  <requirement index="2" name="causal-complexity">The arc is a causal diagram — capture REAL complexity. Threads pull on multiple things, entities influence multiple moments, rules constrain several choices. When you add a node, show all the places it matters.</requirement>
  <requirement index="3" name="aggregate-three-forces">Coherence comes from fate, world, and system interacting, not one dominating. Fate-only = plot sketch; world-only = character study; system-only = rulebook. Let the three argue with each other.</requirement>
  <requirement index="4" name="unexpected-directions">Reasoning doesn't always serve the market's expectation. LEANS can be subverted if scene count and evidence warrant a twist; CONTESTED can be deliberately left more uncertain. The next scene's evidence re-prices accordingly.</requirement>
  <requirement index="5" name="sequential-indexing">\`index\` = causal topological order: 0 is root, predecessors have lower indices, terminal at highest. Walking ascending should feel coherent, not subgraph jumps. \`order\` (auto-captured from array position) may differ from \`index\` in backward modes. Emit \`plannedNodeCount\` before the nodes array.</requirement>
  <requirement index="6" name="id-references">Character/location/artifact nodes MUST use entityId from AVAILABLE ENTITIES. Fate nodes MUST use threadId from Active Threads. System nodes MUST use systemNodeId from System Knowledge (copy [SYS-XX] verbatim) — only omit when introducing a genuinely new rule. Hallucinated IDs are stripped at parse time. Reuse beats invention.</requirement>
  <requirement index="7" name="single-entity-node-per-entity">Same character/system mattering in multiple places = ONE node with multiple edges. Don't duplicate.</requirement>
  <requirement index="8" name="node-count">Target ${nodeCountMin}-${nodeCountMax} nodes across all types. Bands leave room for secondary characters' reasoning chains.</requirement>
  <requirement index="9" name="creative-agent-counts">1-2 pattern nodes (each introducing a shape the narrative has NOT used; scan prior arcs first). 1-2 warning nodes (each naming a specific repetition risk — "we have ended the last two arcs this way"; vague warnings are worthless). 1-2 chaos nodes default, more under chaos preference (outside-force; do NOT set entityId/threadId — spawned via world expansion).</requirement>
  <requirement index="10" name="non-deterministic">Each reasoning path contains at least one SURPRISE — something that doesn't follow obviously from context.</requirement>
  <requirement index="11" name="warning-pattern-response" critical="true">Warnings and patterns must structurally change the graph, not sit as ornaments. Wire them via edges — warnings routed around (chaos, subverted reasoning, different fate direction); patterns appearing in actual node shapes. Orphaned = dead weight; cut or connect.</requirement>
  <requirement index="12" name="cast-distribution" critical="true">Character nodes reference ≥2 distinct entityIds (≥3 if the arc touches 3+ named characters). Every named character has at least one OUTGOING edge — characters acted upon without agency get absorbed into reasoning nodes, not rendered as scenery. Rivals/allies/mentors need independent goals.</requirement>
  <requirement index="13" name="thread-closure-earned">A thread closes when the market warrants — strong LEANS, sufficient volume, scene count enough for decisive evidence. Those conditions = land it. Without them, leave it pulsing — forcing closure the arc can't earn is worse. Reasoning may land an unexpected closure (twist) or deliberately refuse one (uncertainty maintained). A graph that closes nothing this arc is legitimate (CONTESTED-heavy pivot arcs); don't invent closures the market doesn't justify.</requirement>
  <requirement index="14" name="no-subject-or-pattern-repetition">Same actor + action + target = one node with more edges. Same SHAPE applied to different objects ("X exploits chaos to acquire Y" iterated for three Y's) = one pattern rehearsed. Each reasoning node brings a different mode of inference — deduction, abduction, analogy, inversion, constraint propagation. Catch yourself rephrasing a template = change shape or merge.</requirement>
  <requirement index="15" name="reasoning-node-details" critical="true">Every reasoning node's \`detail\` carries its OWN causal logic — 1-3 sentences explaining WHY this inference follows given its predecessors and WHAT it makes possible for its successors. Read the chain by walking ascending \`index\`: each detail should pick up where the previous left off and hand off to the next. A graph whose reasoning details all read as graph-position attributions ("backward from the terminal", "step in the chain") is a graph that hasn't done the reasoning — it has only labelled the diagram.</requirement>
  <requirement index="16" name="terminal-commits">Last-indexed node advances state — closes a thread, lands a transformation, reveals a system truth, or hard-pivots to the next arc. Never a resting state.</requirement>
  <requirement index="17" name="novelty-over-recycling">Resolved threads mostly stay resolved — recycling is the exception. Prefer new threads of fate and new chains of reasoning over extending what already exists.</requirement>
</requirements>

<shape-of-good-arc-graph>
  Causal diagram, not a chain of justifications. Key characters connect to several reasoning nodes, rules constrain multiple choices, the climax is convergence of several setups — not the end of a single line. If the graph reads as a vertical list, complexity is under-represented. Fate is one voice in the argument, not the conductor.
</shape-of-good-arc-graph>

<output-format>
Return a JSON object.

<format-requirements>
  <ids>SEMANTIC slugs prefixed by type: \`<type>-<kebab-case-subject>\`. 3-6 words, lowercase, hyphenated. Examples: \`fate-cicada-mitigated\`, \`reason-chaos-masks-anomaly\`, \`char-ruo-lan-persistence\`, \`sys-essence-cost\`, \`chaos-new-rival-arrives\`. Edges become self-describing. Do NOT use opaque codes like F1, R2.</ids>
  <labels>PROPER ENGLISH (3-10 words), natural language. GOOD: "Fang Yuan exploits his future knowledge". BAD: "Thread escalation node", "R2_REQUIRES_C1".</labels>
</format-requirements>

<orderings hint="Two distinct concepts.">
  <ordering name="order">Thinking order — auto-captured from JSON array position. In backward modes the terminal is emitted first, so it lands at \`order: 0\`.</ordering>
  <ordering name="index">Presentation / causal topological order. Roots low, terminal highest. Downstream consumers walk by \`index\`.</ordering>
  <note>Forward modes align; backward modes diverge — the example below (abduction) has terminal at \`order: 0-2\` but \`index: 4-6\`.</note>
</orderings>

<example>
{
  "summary": "1-2 sentence summary of the arc's reasoning",
  "plannedNodeCount": 7,  // commit first; terminal's index = N-1
  "nodes": [
    // Backward mode: terminal first (order 0-2 at index 4-6).
    // order: 0 · index: 4 — fate node the reasoning LANDS (not mandated).
    {"id": "fate-sanctuary-secured", "index": 4, "type": "fate", "label": "Alliance secures sanctuary through shared cause", "detail": "T-01 leaned 'sanctuary' (p=0.78); reasoning delivers it. Closure plausible given volume and scene count.", "threadId": "T-01"},
    // order: 1 · index: 5 — cost that falls out of the path taken.
    {"id": "reason-witness-exposure", "index": 5, "type": "reasoning", "label": "Negotiation exposes the protagonist to a hostile witness", "detail": "Securing alliance terms requires the protagonist to demonstrate the faction's secret weakness in front of the rival's council. The act of demonstrating is the act of disclosing — there is no version of this negotiation where the witness doesn't see what the protagonist knows. Once seen, the knowledge can no longer be denied or pretended away in later scenes."},
    // order: 2 · index: 6 — new thread emerges from the cost.
    {"id": "fate-witness-leverage", "index": 6, "type": "fate", "label": "Witness now holds leverage over the protagonist", "detail": "Witness exposure seeds a new uncertainty: will the witness speak. New market opens at uniform prior; later arcs re-price.", "threadId": "T-NEW"},
    // order: 3 · index: 3 — the causal step.
    {"id": "reason-sanctuary-needs-alliance", "index": 3, "type": "reasoning", "label": "Sanctuary requires alliance with rival faction", "detail": "The protagonist's faction lacks the resources to hold sanctuary alone (per the rule constraining their position). The rival faction has those resources but won't share without a meaningful concession. The protagonist's hidden knowledge of their weakness is the only currency that satisfies both sides — making alliance through disclosure the necessary path. Hands off to: the negotiation that must happen, and the witness it inevitably exposes."},
    // Roots (thought of last in backward mode).
    // order: 4 · index: 0 — who.
    {"id": "char-fang-yuan-knows-weakness", "index": 0, "type": "character", "label": "Fang Yuan knows the faction's secret weakness", "entityId": "actual-character-id-from-narrative"},
    // order: 5 · index: 1 — rule.
    {"id": "sys-clan-hierarchy-forbids", "index": 1, "type": "system", "label": "Clan hierarchy forbids direct negotiation", "systemNodeId": "actual-SYS-id-from-narrative"},
    // order: 6 · index: 2 — outside force; spawned via world expansion (no entityId).
    {"id": "chaos-exile-seeks-asylum", "index": 2, "type": "chaos", "label": "An exile from a rival clan arrives seeking asylum"}
  ],
  "edges": [
    // \`requires\`: to-node has LOWER index (prerequisite). \`causes\`/\`enables\`/\`constrains\`: from-node has LOWER index.
    {"id": "e1", "from": "fate-sanctuary-secured", "to": "reason-sanctuary-needs-alliance", "type": "requires"},
    {"id": "e2", "from": "reason-sanctuary-needs-alliance", "to": "char-fang-yuan-knows-weakness", "type": "requires"},
    {"id": "e3", "from": "sys-clan-hierarchy-forbids", "to": "char-fang-yuan-knows-weakness", "type": "constrains"},
    {"id": "e4", "from": "chaos-exile-seeks-asylum", "to": "reason-sanctuary-needs-alliance", "type": "enables"},
    {"id": "e5", "from": "reason-sanctuary-needs-alliance", "to": "reason-witness-exposure", "type": "causes"},
    {"id": "e6", "from": "reason-witness-exposure", "to": "fate-witness-leverage", "type": "causes"}
  ]
}
</example>
</output-format>

<final-instruction>Return ONLY the JSON object.</final-instruction>`;
}
