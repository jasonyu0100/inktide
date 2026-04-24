/**
 * Reasoning-graph generators — the top-level entry points that produce:
 *
 *   - `generateReasoningGraph`        — per-arc causal graph (scene-level planning)
 *   - `generateExpansionReasoningGraph` — world-expansion graph (new entities/threads)
 *   - `generateCoordinationPlan`      — multi-arc plan with peaks/valleys/moments
 *
 * Supporting helpers (mode blocks, force-preference blocks, validation,
 * sequential-path rendering, shared types) live in `./reasoning-graph/*`
 * submodules. Public types and helpers are re-exported below so existing
 * import paths (`@/lib/ai/reasoning-graph`) keep working.
 */

import type {
  NarrativeState,
  WorldBuild,
  CoordinationPlan,
  CoordinationNode,
  CoordinationEdge,
  CoordinationNodeType,
  Arc,
  ReasoningGraphSnapshot,
} from "@/types/narrative";
import { REASONING_BUDGETS, resolveEntry } from "@/types/narrative";
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from "./api";
import { narrativeContext, getStateAtIndex } from "./context";
import { parseJson } from "./json";
import { buildCumulativeSystemGraph, getMarketProbs, isThreadAbandoned, isThreadClosed, resolveEntityName, scenesSinceTouched } from "@/lib/narrative-utils";
import { classifyThreadCategory, computeRecentLogitEnergy, THREAD_CATEGORY_GUIDANCE, formatThreadGuidance } from "@/lib/thread-category";
import { applyDerivedForceModes } from "@/lib/auto-engine";
import { logError } from "@/lib/system-logger";
import { aggregateNetworkGraph, summarizeNetworkState } from "@/lib/network-graph";
import type { CoordinationPlanContext } from "./scenes";

// ── Subsystem imports ───────────────────────────────────────────────────────

import type {
  ReasoningNode,
  ReasoningEdge,
  ReasoningEdgeType,
  ReasoningNodeType,
  ReasoningGraph,
  ReasoningMode,
  ArcReasoningOptions,
  ExpansionReasoningGraph,
  ReasoningNodeBase,
  ReasoningGraphBase,
} from "./reasoning-graph/types";
import {
  type ForcePreference,
  defaultReasoningBudget,
  reasoningScale,
  VALID_NODE_TYPES,
  VALID_EDGE_TYPES,
} from "./reasoning-graph/shared";
import { validateNodeReferences } from "./reasoning-graph/validate";
import {
  reasoningModeBlock,
  forcePreferenceBlock,
  networkBiasBlock,
  getPlanNodeGuidance,
  buildSequentialPath,
  extractPatternWarningDirectives,
} from "@/lib/prompts/reasoning";

// ── Public API re-exports ───────────────────────────────────────────────────
// Keep existing import paths (`@/lib/ai/reasoning-graph`) working after the
// split. Types and helpers live in submodules; this file is the entry point.

export type {
  ReasoningNode,
  ReasoningEdge,
  ReasoningEdgeType,
  ReasoningNodeType,
  ReasoningGraph,
  ReasoningMode,
  ArcReasoningOptions,
  ExpansionReasoningGraph,
  ReasoningNodeBase,
  ReasoningGraphBase,
  ForcePreference,
};
export { reasoningScale, buildSequentialPath, extractPatternWarningDirectives };

/**
 * Find the most recent arc that has a stored reasoning graph, walking
 * resolvedKeys backward from the current index. Returns null if no prior
 * arc has a graph (first arc being generated, or priors never persisted).
 *
 * Used to feed the prior graph into the next generation's prompt so the
 * LLM can see — and diverge from — the shape it just built, instead of
 * re-describing the same causal spine with cosmetic variation.
 */
function findLastArcGraph(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
): { arc: Arc; graph: ReasoningGraphSnapshot } | null {
  const keysUpToCurrent = resolvedKeys.slice(0, currentIndex + 1);
  const seen = new Set<string>();
  for (let i = keysUpToCurrent.length - 1; i >= 0; i--) {
    const entry = resolveEntry(narrative, keysUpToCurrent[i]);
    if (!entry || entry.kind === "world_build") continue;
    const arcId = entry.arcId;
    if (!arcId || seen.has(arcId)) continue;
    seen.add(arcId);
    const arc = narrative.arcs[arcId];
    if (arc?.reasoningGraph) return { arc, graph: arc.reasoningGraph };
  }
  return null;
}

/**
 * Render the active-thread pick-list with a per-thread INFLUENCE tag derived
 * from its market state. The reasoner is meant to treat threads as pressure
 * on the graph, not as mandatory anchors — a committed market pulls the
 * reasoning toward its leading outcome; a contested market leaves reasoning
 * genuinely open; a fading market invites deprecation. This is the same
 * prior-as-bias pattern `buildThreadHealthPrompt` surfaces to scene
 * generation, scaled to arc planning so both layers share one mental model.
 */
function renderActiveThreadsWithInfluence(
  narrative: NarrativeState,
  resolvedKeys?: string[],
  currentIndex?: number,
): string {
  return Object.values(narrative.threads)
    .filter((t) => !isThreadClosed(t) && !isThreadAbandoned(t))
    .map((t) => {
      const probs = getMarketProbs(t);
      const top = probs.indexOf(Math.max(...probs));
      const topProb = probs[top] ?? 0;
      const belief = t.beliefs?.narrator;
      const vol = belief?.volume ?? 0;
      const silent = resolvedKeys && currentIndex !== undefined
        ? scenesSinceTouched(t, resolvedKeys, currentIndex)
        : undefined;
      const category = classifyThreadCategory(t, silent !== undefined ? { scenesSinceTouch: silent } : undefined);
      const energy = computeRecentLogitEnergy(t);
      const signal = formatThreadGuidance(THREAD_CATEGORY_GUIDANCE[category], t.outcomes[top] ?? '?', topProb);
      return `- [${t.id}] "${t.description}" · ${signal} · vol=${vol.toFixed(1)} · energy=${energy.toFixed(2)}`;
    })
    .join("\n");
}

export async function generateReasoningGraph(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  sceneCount: number,
  direction: string,
  arcName: string,
  onReasoning?: (token: string) => void,
  /** When provided, the coordination plan context guides the reasoning graph generation */
  coordinationPlanContext?: CoordinationPlanContext,
  /** Arc-level options (chaos-driven, reasoning effort). */
  options?: ArcReasoningOptions,
): Promise<ReasoningGraph> {
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);

  // Network heat tiers — every entity / thread / system node carries a
  // {hot|warm|cold|fresh ×N} label so the reasoner can see the cumulative
  // activation pattern and lean into or away from it per the bias setting.
  // Scoped to the current point in the timeline (progressive aggregation).
  const network = aggregateNetworkGraph(narrative, resolvedKeys, currentIndex);
  // Get active threads — annotations live on the <thread> tags in
  // narrativeContext above; this section is just a quick pick-list.
  const activeThreads = renderActiveThreadsWithInfluence(narrative, resolvedKeys, currentIndex);

  // Get key characters
  const characters = Object.values(narrative.characters)
    .filter((c) => c.role === "anchor" || c.role === "recurring")
    .slice(0, 8)
    .map((c) => `- [${c.id}] ${c.name} (${c.role})`)
    .join("\n");

  // Get key locations
  const locations = Object.values(narrative.locations)
    .filter((l) => l.prominence === "domain" || l.prominence === "place")
    .slice(0, 6)
    .map((l) => `- [${l.id}] ${l.name}`)
    .join("\n");

  // Get artifacts
  const artifacts = Object.values(narrative.artifacts ?? {})
    .filter((a) => a.significance === "key" || a.significance === "notable")
    .slice(0, 4)
    .map((a) => `- [${a.id}] ${a.name}`)
    .join("\n");

  // Get system knowledge — IDs included so reasoning nodes can reference
  // them via `systemNodeId` (mirrors how characters/locations/artifacts
  // expose their IDs above).
  const systemKnowledge = Object.values(narrative.systemGraph?.nodes ?? {})
    .filter((n) =>
      ["principle", "system", "constraint", "tension"].includes(n.type),
    )
    .slice(0, 8)
    .map((n) => `- [${n.id}] ${n.concept} (${n.type})`)
    .join("\n");

  // Get story patterns and anti-patterns
  const patterns = narrative.patterns ?? [];
  const antiPatterns = narrative.antiPatterns ?? [];

  const patternsSection = patterns.length > 0
    ? `STORY PATTERNS (positive commandments to reinforce):\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const antiPatternsSection = antiPatterns.length > 0
    ? `ANTI-PATTERNS (pitfalls to avoid):\n${antiPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  // Prior reasoning graph — the last arc's graph, rendered for divergence
  // pressure. Without this, the LLM is asked to emit "warning" nodes that
  // detect graph-level repetition while being blind to the prior graphs
  // themselves — which is why successive arcs converge to the same causal
  // spine with cosmetic variation.
  const lastArcGraph = findLastArcGraph(narrative, resolvedKeys, currentIndex);
  const priorGraphSection = lastArcGraph
    ? `## PRIOR ARC GRAPH — DIVERGE FROM THIS

The reasoning graph built for the last arc is below. Graph-level repetition across arcs is the same failure as reasoning-pattern repetition within a single graph — the story thinks one thought over and over. Your graph's causal spine must NOT replicate the structure below.

Last arc: "${lastArcGraph.graph.arcName}"
Summary: ${lastArcGraph.graph.summary}

${buildSequentialPath({ nodes: lastArcGraph.graph.nodes, edges: lastArcGraph.graph.edges })}

Diverge concretely:
- Any fate commitments this arc lands must differ in KIND from the prior arc's, not just content. If the prior resolved via acquisition, yours closes via reversal, revelation, alliance, or subversion. A new content slot in the same commitment shape is re-description, not advancement.
- The reasoning chain must use different inference modes. If the prior leaned on constraint-propagation or sequential dependency, yours should introduce abduction, inversion, analogy, or a branching decision.
- Warning nodes (required per REQUIREMENTS below) must name specific shapes from the prior graph — cite node labels or indices above — so the repetition is made explicit and the new graph visibly routes around it.

If your reasoning chain and terminal map onto the spine above with only content swaps, you have re-described the prior arc rather than advanced the story.`
    : "";

  const prompt = `${ctx}

## ${summarizeNetworkState(network)}

## AVAILABLE ENTITIES (quick pick-list — full annotations live on the entity tags in the narrative context above)

ACTIVE THREADS (threads are QUESTIONS the story must answer):
${activeThreads || "None yet"}

KEY CHARACTERS:
${characters || "None yet"}

KEY LOCATIONS:
${locations || "None yet"}

KEY ARTIFACTS:
${artifacts || "None yet"}

SYSTEM KNOWLEDGE:
${systemKnowledge || "None yet"}

${patternsSection}

${antiPatternsSection}

## TASK

Build a REASONING GRAPH for "${arcName}" to guide ${sceneCount} scene(s).
${coordinationPlanContext ? `
═══════════════════════════════════════════════════════════════════════════════
COORDINATION PLAN — THIS IS YOUR PRIMARY BRIEF (Arc ${coordinationPlanContext.arcIndex}/${coordinationPlanContext.arcCount})
═══════════════════════════════════════════════════════════════════════════════

This arc is part of a multi-arc coordination plan derived from backward induction. The plan below defines the KEY PLOT POINTS and REASONING that this arc must execute. Your reasoning graph must serve as a bridge between the coordination plan and scene generation.

${coordinationPlanContext.forceMode ? `**Force Mode**: ${coordinationPlanContext.forceMode.toUpperCase()} — lean into this narrative force for this arc.\n` : ''}
**Plan Directive**:
${coordinationPlanContext.directive}

**Your job**: Build a reasoning graph that EXECUTES the coordination plan for this specific arc. The graph should:
1. Ground the plan's abstract plot points in SPECIFIC entities, locations, and mechanisms
2. Fill in the HOW — the plan says WHAT must happen, you determine the specific path
3. Maintain the plan's thread targets — if the plan says thread X should escalate, your graph must deliver that escalation
4. Respect the force mode — if world-dominant, lean into character development; if fate-dominant, lean into thread resolution
${direction.trim() ? `
**Additional Direction** (layer on top of the plan):
${direction}` : ''}
═══════════════════════════════════════════════════════════════════════════════
` : `Direction: ${direction}`}

FATE THREADS ARE INFLUENCE, NOT ANCHORS. The active-thread list above carries a signal per thread — LEANS / ACTIVE / CONTESTED / VOLATILE / FADING — derived from its current market state. Treat these like you treat characters, locations, and system rules: as the force field in which the reasoning happens. A LEANS thread exerts strong pull — the reasoning should bend toward its leading outcome unless you're staging a twist. A CONTESTED thread leaves genuine room; the reasoning is free to add uncertainty (ending the arc with the market MORE contested than it started is legitimate, sometimes necessary). A VOLATILE thread is where twists land well. A FADING thread is on its way out — don't force evidence on it unless you're deliberately resurrecting.

MARKETS SWING — PROBABILITY LEADERSHIP IS NOT DESTINY. A LEANS signal says "the current observer thinks outcome X is most likely given evidence so far" — it does NOT say "the arc must deliver X." System rules and world state are fully allowed to overturn a lean when the reasoning logically points elsewhere. If the arc's reasoning chain credibly forces a force-of-system event (a hidden rule surfaces, a constraint reveals the plan is impossible, an entity's true state undoes the assumption) or a force-of-world event (a character's change of allegiance, a rival's capability coming online, an alliance fracturing), the arc should deliver that event and the resulting thread moves can flip a p=0.75 leader to the lagging outcome. Stage these as twist nodes, not as resistance nibbling. A good arc sometimes earns its power precisely by showing the market was wrong — world and system are not just texture, they are forces that can logically overturn fate's pull.

Every node EARNS its existence by doing distinct work. A node whose subject (actor × action × target) matches another node is the same node with more edges, not a second node. Minor-variation repetition is a pulse on the existing step, not a new step.

Novelty is the story's forward motion. Resolved threads mostly stay resolved — don't keep re-opening a closed question. Prefer NEW chains of reasoning over extending existing ones into minor variation. Sameness is the enemy; variety is how the reader feels the story moving.

THE THREE FORCES AGGREGATE HERE. The reasoning graph is where fate, world, and system converge. Fate markets exert pressure (via the signals above); world entities bring agency (characters pursuing their own goals, locations enabling or constraining, artifacts shaping action); system rules impose constraints. Good reasoning arises from the interaction of all three, not from one dominating. A graph that only chases fate resolution is a plot outline; a graph that only develops world is a character sketch; a graph that only elaborates system is a rulebook. Aggregation is the craft.

Resolution is the reader's dopamine when it arrives, but resolution is a CONSEQUENCE of reasoning, not a prerequisite. Let fate commitments emerge from what the reasoning can credibly serve. If a LEANS thread has the volume + margin + scene count to close cleanly in this arc, the reasoning should land it. If it doesn't, don't force a closure — the market will carry the thread forward and next arc's reasoning will pick it up. Forcing closure the arc can't earn is worse than leaving the thread pulsing. This is the feedback loop: reasoning shapes scenes, scenes re-price the markets, the next arc's reasoning sees the new state. The system converges when the writing is honest about what each arc can deliver.

${priorGraphSection}
${forcePreferenceBlock("arc", options?.forcePreference)}
${reasoningModeBlock(options?.reasoningMode)}
${networkBiasBlock(options?.networkBias ?? narrative.storySettings?.defaultNetworkBias)}

## OUTPUT FORMAT

**CRITICAL FORMAT REQUIREMENTS**:
- **IDs**: Use SEMANTIC slugs that carry the node's subject, prefixed by type. Format: \`<type>-<kebab-case-subject>\`. Examples: \`fate-cicada-mitigated\`, \`reason-chaos-masks-anomaly\`, \`char-ruo-lan-persistence\`, \`sys-essence-cost\`, \`loc-whispering-gorge\`, \`art-cicada-drain\`, \`chaos-new-rival-arrives\`, \`pattern-two-threads-converge\`, \`warn-ruo-lan-repeats\`. Slug length: 3-6 words, lowercase, hyphenated. An edge \`{"from": "fate-cicada-mitigated", "to": "reason-chaos-masks-anomaly"}\` is self-describing; a reader of the graph and the model writing later edges can see what each node is without scrolling back. Do NOT use opaque short codes like F1, R2, PT1 — they force you to hold a mental table of what each code means.
- **Labels**: Must be PROPER ENGLISH descriptions (3-10 words). Describe what happens in natural language. NOT technical identifiers or codes.
  - GOOD: "Fang Yuan exploits his future knowledge", "Alliance fractures over betrayal"
  - BAD: "Thread escalation node", "R2_REQUIRES_C1", "fate pressure mechanism"

Return a JSON object.

TWO ORDERINGS — distinct concepts:

• \`order\` = thinking order. Auto-captured from the node's position in the JSON array — the Nth node you emit gets \`order: N\`. In backward modes (abduction / induction) the terminal is thought of first, so it lands at \`order: 0\` even though its \`index\` is the highest.

• \`index\` = presentation / causal order (topological). Roots (no causal predecessors) get low indices; the terminal gets the highest. Downstream consumers sort and step through by \`index\`.

In forward mode the two align. In backward mode they diverge — the example below is backward (abduction): terminal outcomes at \`order: 0-2\` (thought first) but \`index: 4-6\` (causal terminal). Fate nodes appear where the reasoning credibly lands them, not as mandatory opening anchors; this arc's fate signal said T-01 LEANS "sanctuary" at p=0.78, so the reasoning lands that commitment rather than fighting it.

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

## NODE TYPES

- **fate**: A thread that the reasoning graph actively couples to. Fate nodes are NOT mandatory anchors — they appear when the reasoning genuinely engages a thread (landing its outcome, pushing it toward a resolution, or seeding a new market). A fate node labelled around a closure indicates this arc's reasoning delivers that thread's payoff. A fate node mid-graph indicates the thread pulls on the causal chain here. A fate node on a newly-seeded thread marks a market the reasoning has opened. Use threadId. Label = what the thread does in this arc. Threads with a strong LEANS signal often earn a fate node landing their outcome; CONTESTED threads may earn a fate node that deliberately refuses to resolve; FADING threads usually earn no fate node at all.
- **character**: An active agent with their OWN goals — not just a reactive foil to the protagonist. Use entityId to reference actual character. Label = their position/goal. **Cast distribution matters**: a graph where every character node is the protagonist is a failure of agency. Include secondary characters as drivers — a rival plotting, an ally hedging, a mentor withholding — each with their own causal chain that interacts with the main arc rather than merely reacting to it. The arc's causal web should have at least 2–3 distinct characters acting as agents, not as scenery.
- **location**: A setting. Use entityId to reference actual location. Label = what it enables/constrains.
- **artifact**: An object. Use entityId to reference actual artifact. Label = its role in reasoning.
- **system**: A world rule/principle/constraint. Use systemNodeId to reference an existing SYS-XX node from AVAILABLE ENTITIES → System Knowledge. Label = the rule as it applies here. If you need to introduce a brand-new rule that doesn't exist yet, omit systemNodeId — but prefer reusing an existing rule when one fits.
- **reasoning**: A step in the causal chain — a distinct state-change. Every reasoning node earns its place by turning one thing into another: a demand into a plan, a plan into an action, an action into a consequence, a consequence into new pressure. Two reasoning nodes with the same subject (actor × action × target) are one node with more edges, not two. Minor restatement ("siphons again at another cache", "detects suspicion a fourth time") is a pulse on the existing step — escalate or merge, don't duplicate. Label = the inference (3-8 words).
- **pattern**: NOVEL-PATTERN GENERATOR. Proposes a story shape this narrative HAS NOT used before — a fresh configuration, rhythm, or relational geometry that is absent from prior arcs and scenes. Not generic creativity: a specific structural move the story hasn't made. Every pattern node answers "what has this story never done that it could do here?" Example labels: "First arc resolved through a non-POV character's choice", "Two anchors separated across the arc — no shared scenes", "Fate subverts by succeeding too completely". Scan prior arcs before proposing; do not repeat a shape already used.
- **warning**: PATTERN-REPETITION DETECTOR. Scans prior arcs and scenes and FLAGS shapes the reader has already seen — resolution rhythms, conflict geometries, character dynamics, arc cadences — that this arc is drifting toward repeating. Humans are powerful pattern recognisers: once a shape repeats (same resolution twice, same beat three times, same dominant force four arcs running) the reader notices and the move loses weight. The warning's job is to name the repetition explicitly so the graph can route around it. Example labels: "Third arc ending with external rescue — reader will feel the pattern", "A and B have now used the tension-then-reconciliation beat three times", "Fourth consecutive fate-dominant arc — rhythm is becoming monotone".
- **chaos**: OUTSIDE FORCE — operates outside the existing fabric of fate, world, and system. Chaos has two everyday modes: as a **deus-ex-machina**, it brings problems the cast couldn't anticipate or solutions the cast couldn't build (a troll bursts into the dungeon, a stranger arrives with a fragmentary map, a dormant artefact wakes); as a **creative engine**, it seeds entirely new fates — new threads that didn't exist, which later arcs develop and resolve. Chaos sits OUTSIDE fate, but shapes fate by creating fresh strands. A well-used chaos node earns its weight: it breaks a stalemate the existing forces couldn't, and it plants something the story can reuse. Use sparingly under freeform; use extensively under chaos-preference. Label = what arrives and its role. DO NOT set entityId or threadId — the entity/thread is spawned via world expansion.

## EDGE TYPES

- **enables**: A makes B possible (B could exist without A, but not here)
- **constrains**: A limits/blocks B
- **risks**: A creates danger for B
- **requires**: A depends on B (direction matters — A needs B, not B needs A; reversing this corrupts the graph silently)
- **causes**: A leads to B (B would not exist without A)
- **reveals**: A exposes information in B
- **develops**: A deepens B (use for character/thread arcs only, not generic logic steps)
- **resolves**: A concludes/answers B

## REQUIREMENTS

1. **Start where pressure is strongest**: in backward modes (abduction/induction), start from the arc's natural terminal — where fate LEANS strong, where world change needs to land, or where system revelation pays off — and reason backward to the entity facts that enable it. The terminal can be a fate node, a reasoning node, or a character-transformation node; whichever force the arc most honestly serves. Fate is one input to the graph, not the only input.
2. **Causal complexity**: The arc is a causal reasoning diagram — capture the REAL complexity of how it unfolds. Threads pull on multiple things, entities influence multiple moments, rules constrain several choices. When you add a node, show all the places it matters.
3. **Aggregate the three forces**: the graph's coherence comes from fate, world, and system interacting, not from one dominating. Fate markets set pressure (via the per-thread INFLUENCE signals); world entities bring agency; system rules impose constraints. Good reasoning is the product of their interaction. A graph that only pursues fate is a plot sketch; one that only develops world is a character study; one that only elaborates system is a rulebook. Let the three forces argue with each other in the causal chain.
4. **Unexpected directions**: reasoning doesn't always serve the market's expectation. A LEANS thread can be subverted if the scene count and evidence warrant a twist; a CONTESTED thread can be deliberately left more uncertain than it started. When reasoning genuinely diverges from the market's prior, the next scene's evidence will re-price accordingly — that is the feedback loop doing its job.
5. **Sequential indexing (topological)**: \`index\` is a causal topological order — 0 is the root (no predecessors), each later index's predecessors have lower indices, the terminal sits at the highest. Walking ascending indices should feel like one coherent sweep, not subgraph jumps. \`order\` is auto-captured from array position and may differ from \`index\` in backward modes — that's the point. Emit \`plannedNodeCount\` before the nodes array to commit to a count.
6. **Entity references**: character / location / artifact nodes MUST use entityId with an actual ID from AVAILABLE ENTITIES. Hallucinated IDs (e.g. C-99 when no such character exists) are stripped at parse time and the node loses its anchor.
7. **Thread references**: fate nodes MUST use threadId to reference which thread exerts the pull. The threadId must match an existing thread in AVAILABLE ENTITIES → Active Threads.
7a. **System references**: system nodes MUST use systemNodeId to reference an existing SYS-XX node from AVAILABLE ENTITIES → System Knowledge. The narrative lists each system node with its [SYS-XX] id alongside the concept text — copy the bracketed id verbatim. If no existing rule fits and you genuinely need a new one, you may omit systemNodeId; the system node then represents a fresh rule. Reuse beats invention.
8. **Single entity node per entity**: If the same character or system matters in multiple places, create ONE node with multiple edges — don't duplicate.
9. **Node count**: Target ${Math.round((8 + sceneCount * 4.5) * reasoningScale(options?.reasoningLevel))}-${Math.round((14 + sceneCount * 5.5) * reasoningScale(options?.reasoningLevel))} nodes across all types. The nudged bands leave room for secondary characters to get their own reasoning chains, not just appear as participants.
10. **Pattern nodes**: 1-2 nodes, each introducing a story shape the narrative has NOT used before. Scan prior arcs; name the new pattern; make sure the arc actually uses it.
11. **Warning nodes**: 1-2 nodes, each naming a specific repetition risk drawn from prior arcs/scenes — "we have ended the last two arcs this way", "this dynamic between A and B has already happened N times". Vague warnings are worthless; the warning must cite what is actually repeating.
12. **Chaos nodes (1-2 default, more under chaos preference)**: Inject at least one outside-force element — a new character arriving, a dormant artefact waking, a new fate appearing. Do NOT reference existing entityIds — chaos describes an entity that will be spawned. A chaos node signals the scene generator to invoke world expansion.
13. **Non-deterministic**: Each reasoning path should contain at least one SURPRISE — something that doesn't follow obviously from context
14. **Warning/pattern response (CRITICAL)**: warnings and patterns must structurally change the graph, not sit as ornaments. A warning's repetition-risk is routed around (chaos, subverted reasoning, different fate direction); a pattern's proposed shape appears in actual nodes. Wire warning/pattern nodes to the body via edges — orphaned ones are dead weight; cut or connect.
15. **Cast distribution (CRITICAL)**: character nodes reference ≥2 distinct entityIds (≥3 if the arc touches 3+ named characters). Every named character has at least one OUTGOING edge — characters acted upon without agency are absorbed into reasoning nodes, not rendered as scenery. Rivals/allies/mentors need independent goals visible in the causal chain.
16. **Thread closure is earned, not mandated**: a thread closes when the market says it can — strong LEANS signal, sufficient volume, scene count enough to land decisive evidence. Threads with those conditions SHOULD receive a fate node that lands the closure; the reasoning then works backward to supply it. Threads without those conditions stay open — forcing a closure the arc can't credibly deliver is worse than leaving the thread pulsing. The feedback loop runs both ways: reasoning may land a closure the prior didn't expect (twist), or deliberately refuse a closure the prior wanted (uncertainty maintained). Honesty about what each arc can earn is how the system converges over many arcs.
17. **Delivery when it lands, not mandated**: closures when they arrive are the reader's dopamine — the feeling of tension resolving. But a graph isn't failing if no thread closes this arc: some arcs are CONTESTED-heavy, re-pricing markets without landing any of them, and that's a legitimate shape (a mid-story crossroads, a pivot arc). Aim for closures where the market justifies them; don't invent them where the market doesn't.
18. **No subject or reasoning-pattern repetition**: two nodes with the same actor + action + target are one node with more edges — merge. Two reasoning nodes with the same SHAPE applied to different objects — "X exploits chaos to acquire Y" iterated for three different Y's, or "character leverages Z" repeated three times with different Zs — are one pattern rehearsed. Reasoning-pattern repetition reads as OCD: the graph thinks one thought over and over, not many different thoughts. Each reasoning node should bring a genuinely different mode of inference — deduction, abduction, analogy, inversion, constraint propagation. If you catch yourself rephrasing the same template, change shape or merge.
19. **Terminal commits to something**: the last-indexed node must advance the state — closing a thread, landing a character transformation, revealing a system truth, or hard-pivoting to the next arc. Never a resting state. Which of those it is depends on what the arc honestly served.
20. **Novelty over recycling**: resolved threads mostly stay resolved — recycling is the exception, not the default. Prefer new threads of fate and new chains of reasoning over extending what already exists. Variety is the story's forward motion; sameness is stall.

## SHAPE OF A GOOD ARC GRAPH

An arc reasoning graph is a causal diagram, not a chain of justifications. A good graph captures how the arc actually works: key characters connect to several reasoning nodes, rules constrain multiple choices, the arc's climax is the convergence of several setups rather than the end of a single line. When you finish, scan the graph — if it reads like a vertical list, the story's complexity is being under-represented.

The graph should reveal the strategic logic of the three forces interacting: how the current market priors bias the reasoning, how character agency and system constraints shape the path the reasoning takes, and what closures or new markets emerge from that interaction. Fate is one voice in the argument, not the conductor.

Return ONLY the JSON object.`;

  const reasoningBudget = defaultReasoningBudget(narrative);

  const raw = onReasoning
    ? await callGenerateStream(
        prompt,
        SYSTEM_PROMPT,
        () => {}, // No token streaming for main output
        undefined,
        "generateReasoningGraph",
        undefined,
        reasoningBudget,
        onReasoning,
      )
    : await callGenerate(
        prompt,
        SYSTEM_PROMPT,
        undefined,
        "generateReasoningGraph",
        undefined,
        reasoningBudget,
      );

  // Parse JSON response
  try {
    let jsonStr = raw.trim();
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const data = JSON.parse(jsonStr);

    // Validate and normalize
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Invalid graph structure: missing nodes");
    }
    if (!data.edges || !Array.isArray(data.edges)) {
      data.edges = [];
    }

    // Ensure all nodes have required fields and valid types. The JSON
    // array position (i) becomes order — the order the LLM
    // emitted/thought of each node, distinct from its presentation index.
    const rawNodes: ReasoningNode[] = data.nodes.map((n: Partial<ReasoningNode>, i: number) => ({
      id: typeof n.id === "string" ? n.id : `N${i}`,
      index: typeof n.index === "number" ? n.index : i,
      order: i,
      type: (typeof n.type === "string" && VALID_NODE_TYPES.has(n.type)) ? n.type as ReasoningNodeType : "reasoning",
      label: typeof n.label === "string" ? n.label.slice(0, 200) : "Unlabeled node",
      detail: typeof n.detail === "string" ? n.detail.slice(0, 500) : undefined,
      entityId: typeof n.entityId === "string" ? n.entityId : undefined,
      threadId: typeof n.threadId === "string" ? n.threadId : undefined,
      systemNodeId: typeof n.systemNodeId === "string" ? n.systemNodeId : undefined,
    }));
    const nodes: ReasoningNode[] = rawNodes.map((n) =>
      validateNodeReferences(n, narrative, { source: "plan-generation", arcName }),
    );

    // Ensure all edges have required fields, valid types, and reference existing nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: ReasoningEdge[] = data.edges
      .map((e: Partial<ReasoningEdge>, i: number) => ({
        id: typeof e.id === "string" ? e.id : `E${i}`,
        from: typeof e.from === "string" ? e.from : "",
        to: typeof e.to === "string" ? e.to : "",
        type: (typeof e.type === "string" && VALID_EDGE_TYPES.has(e.type)) ? e.type as ReasoningEdgeType : "causes",
        label: typeof e.label === "string" ? e.label.slice(0, 100) : undefined,
      }))
      .filter((e: ReasoningEdge) => e.from && e.to && nodeIds.has(e.from) && nodeIds.has(e.to));

    return {
      nodes,
      edges,
      arcName,
      sceneCount,
      summary: typeof data.summary === "string" ? data.summary : `Reasoning graph for ${arcName}`,
      plannedNodeCount: typeof data.plannedNodeCount === "number" ? data.plannedNodeCount : undefined,
    };
  } catch (err) {
    logError("Failed to parse reasoning graph", err, {
      source: "world-expansion",
      operation: "reasoning-graph-parse",
      details: { arcName, sceneCount },
    });
    // Return minimal fallback
    return {
      nodes: [
        {
          id: "R1",
          index: 0,
          order: 0,
          type: "reasoning",
          label: `${arcName} - graph generation failed`,
          detail: String(err),
        },
      ],
      edges: [],
      arcName,
      sceneCount,
      summary: "Failed to generate reasoning graph",
    };
  }
}
// ── Coordination Plan Generation ─────────────────────────────────────────────

/**
 * Valid coordination node types. Must include every `CoordinationNodeType`
 * member — sanitization silently retypes unknown types to "reasoning", so a
 * missing entry here "disguises" nodes of that type in rendered plans.
 */
export const VALID_COORDINATION_NODE_TYPES = new Set<CoordinationNodeType>([
  "fate",
  "character",
  "location",
  "artifact",
  "system",
  "reasoning",
  "pattern",
  "warning",
  "chaos",      // Outside-force agent — spawns new entities / new fates
  "peak",       // Structural peak — forces converge, thread culminates; arc anchors here
  "valley",     // Structural valley — turning point, tension seeded; can anchor arcs
  "moment",     // Key beat in the plan that isn't a peak or valley
]);

/** Thread target expressed as a market intent + optional outcome. */
export type ThreadTarget = {
  threadId: string;
  /** What the plan wants this thread's market to do. */
  marketIntent: "advance" | "escalate" | "close" | "twist" | "maintain" | "abandon";
  /** For advance/close/twist: which outcome label. */
  marketOutcome?: string;
  /** When in the plan this should happen */
  timing?: "early" | "mid" | "late" | "final";
};

/** Guidance for which threads should reach which states */
export type PlanGuidance = {
  /** Thread targets with status and timing */
  threadTargets?: ThreadTarget[];
  /** Arc target — exact number of arcs to plan */
  arcTarget?: number;
  /** Direction — coordinates end fate goals that should be achieved */
  direction?: string;
  /** Constraints — what must NOT happen, restrictions on the narrative */
  constraints?: string;
  /**
   * Which force category to bias the plan toward. Default "freeform"
   * (no bias — LLM picks composition). "chaos" elevates chaos from
   * sparing deus-ex-machina to a primary creative engine.
   */
  forcePreference?: ForcePreference;
  /**
   * Reasoning effort for this single generation. Overrides the narrative's
   * default storySettings.reasoningLevel when provided. "small" | "medium"
   * | "large" map to low / medium / high REASONING_BUDGETS.
   */
  reasoningLevel?: "small" | "medium" | "large";
  /**
   * How the reasoner thinks. Defaults to "abduction" — picks the best
   * hypothesis working backward from a committed outcome. Alternatives:
   * "divergent" (forward, expansive), "deduction" (premise → necessary
   * consequence), "induction" (observation → inferred principle). See
   * ReasoningMode for details.
   */
  reasoningMode?: ReasoningMode;
};

/**
 * Generate a coordination plan for multiple arcs using backward induction.
 * The plan uses terminal states (thread endings) as anchors and works backwards
 * to derive waypoints and arc requirements.
 */
export async function generateCoordinationPlan(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  guidance: PlanGuidance,
  onReasoning?: (token: string) => void,
): Promise<CoordinationPlan> {
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);

  // Get timeline-scoped state for accurate knowledge
  const timelineState = getStateAtIndex(narrative, resolvedKeys, currentIndex);

  // Analyze current thread states
  const threads = Object.values(narrative.threads);
  const threadSummary = threads
    .filter((t) => !isThreadClosed(t) && !isThreadAbandoned(t))
    .map((t) => {
      const participantNames = t.participants.map(p => {
        if (p.type === "character") return narrative.characters[p.id]?.name ?? p.id;
        if (p.type === "location") return narrative.locations[p.id]?.name ?? p.id;
        if (p.type === "artifact") return narrative.artifacts?.[p.id]?.name ?? p.id;
        return p.id;
      }).join(", ");
      // Include thread log momentum
      const logNodes = Object.values(t.threadLog?.nodes ?? {});
      const recentLog = logNodes.slice(-3).map(n => n.content).join(" → ");
      const momentum = recentLog ? ` | momentum: ${recentLog}` : "";
      const probs = getMarketProbs(t);
      const topIdx = probs.indexOf(Math.max(...probs));
      const marketSummary = `top=${t.outcomes[topIdx]} (${(probs[topIdx] ?? 0).toFixed(2)})`;
      return `- [${t.id}] "${t.description}" — ${marketSummary}, participants: ${participantNames}${momentum}`;
    })
    .join("\n");

  // Key characters with continuity knowledge
  const keyCharacters = Object.values(narrative.characters)
    .filter((c) => c.role === "anchor" || c.role === "recurring")
    .slice(0, 10);

  const characters = keyCharacters
    .map((c) => {
      // Get character's accumulated knowledge
      const knowledgeNodes = Object.values(c.world.nodes)
        .filter(kn => timelineState.liveNodeIds.has(kn.id))
        .slice(-5); // Last 5 knowledge items
      const knowledge = knowledgeNodes.map(kn => kn.content).join("; ");
      const knowledgeStr = knowledge ? `\n    Knowledge: ${knowledge}` : "";
      return `- [${c.id}] ${c.name} (${c.role})${knowledgeStr}`;
    })
    .join("\n");

  // Key locations with continuity
  const keyLocations = Object.values(narrative.locations)
    .filter((l) => l.prominence === "domain" || l.prominence === "place")
    .slice(0, 8);

  const locations = keyLocations
    .map((l) => {
      const knowledgeNodes = Object.values(l.world.nodes)
        .filter(kn => timelineState.liveNodeIds.has(kn.id))
        .slice(-3);
      const knowledge = knowledgeNodes.map(kn => kn.content).join("; ");
      const knowledgeStr = knowledge ? ` — ${knowledge}` : "";
      return `- [${l.id}] ${l.name}${knowledgeStr}`;
    })
    .join("\n");

  // Key relationships with valence
  const keyCharacterIds = new Set(keyCharacters.map(c => c.id));
  const relationships = timelineState.relationships
    .filter(r => keyCharacterIds.has(r.from) && keyCharacterIds.has(r.to))
    .slice(0, 15)
    .map(r => {
      const fromName = narrative.characters[r.from]?.name ?? r.from;
      const toName = narrative.characters[r.to]?.name ?? r.to;
      const valenceLabel = r.valence <= -0.5 ? "hostile"
        : r.valence <= -0.1 ? "tense"
        : r.valence >= 0.5 ? "allied"
        : r.valence >= 0.1 ? "friendly"
        : "neutral";
      return `- ${fromName} → ${toName}: ${r.type} (${valenceLabel})`;
    })
    .join("\n");

  // System knowledge graph — principles, systems, constraints, tensions
  const keysUpToCurrent = resolvedKeys.slice(0, currentIndex + 1);
  const systemGraph = buildCumulativeSystemGraph(
    narrative.scenes, keysUpToCurrent, keysUpToCurrent.length - 1, narrative.worldBuilds,
  );
  const systemNodes = Object.values(systemGraph.nodes);
  const principles = systemNodes.filter(n => n.type === "principle").slice(0, 5);
  const systems = systemNodes.filter(n => n.type === "system").slice(0, 5);
  const constraints = systemNodes.filter(n => n.type === "constraint").slice(0, 4);
  const tensions = systemNodes.filter(n => n.type === "tension").slice(0, 4);

  const systemKnowledgeLines: string[] = [];
  // IDs included so system nodes can anchor via `systemNodeId`.
  const formatSystemEntry = (n: { id: string; concept: string }) => `[${n.id}] ${n.concept}`;
  if (principles.length > 0) {
    systemKnowledgeLines.push(`  Principles: ${principles.map(formatSystemEntry).join("; ")}`);
  }
  if (systems.length > 0) {
    systemKnowledgeLines.push(`  Systems: ${systems.map(formatSystemEntry).join("; ")}`);
  }
  if (constraints.length > 0) {
    systemKnowledgeLines.push(`  Constraints: ${constraints.map(formatSystemEntry).join("; ")}`);
  }
  if (tensions.length > 0) {
    systemKnowledgeLines.push(`  Tensions: ${tensions.map(formatSystemEntry).join("; ")}`);
  }
  const systemKnowledge = systemKnowledgeLines.length > 0
    ? systemKnowledgeLines.join("\n")
    : "";

  // Key artifacts with capabilities
  const artifacts = Object.values(narrative.artifacts ?? {})
    .filter(a => a.significance === "key" || a.significance === "notable")
    .slice(0, 6)
    .map(a => {
      const owner = timelineState.artifactOwnership[a.id] ?? a.parentId;
      const ownerName = owner ? resolveEntityName(narrative, owner) : "world";
      const capabilityNodes = Object.values(a.world.nodes)
        .filter(kn => timelineState.liveNodeIds.has(kn.id))
        .slice(-3);
      const capabilities = capabilityNodes.map(kn => kn.content).join("; ");
      const capStr = capabilities ? ` — ${capabilities}` : "";
      return `- [${a.id}] ${a.name} (${a.significance}, held by ${ownerName})${capStr}`;
    })
    .join("\n");

  // Recent scene summaries (last 8 scenes for context)
  const recentScenes = keysUpToCurrent
    .slice(-8)
    .map(k => {
      const entry = resolveEntry(narrative, k);
      if (entry?.kind !== "scene") return null;
      const povName = narrative.characters[entry.povId]?.name ?? entry.povId;
      const locName = narrative.locations[entry.locationId]?.name ?? entry.locationId;
      return `- [${povName} @ ${locName}] ${entry.summary}`;
    })
    .filter(Boolean)
    .join("\n");

  // Build thread targets section with status and timing
  const threadTargetsSection = guidance.threadTargets?.length
    ? `THREAD TARGETS:\n${guidance.threadTargets.map(t => {
        const thread = narrative.threads[t.threadId];
        const desc = thread?.description ?? t.threadId;
        const timingLabel = t.timing === "early" ? " [early — arcs 1-2]"
          : t.timing === "mid" ? " [mid — middle arcs]"
          : t.timing === "late" ? " [late — near end]"
          : t.timing === "final" ? " [final arc]"
          : "";
        const intentLabel = t.marketIntent.toUpperCase() + (t.marketOutcome ? ` → ${t.marketOutcome}` : "");
        return `- [${t.threadId}] ${desc} → ${intentLabel}${timingLabel}`;
      }).join("\n")}`
    : "";

  // Arc target — exact number of arcs to plan (default 5)
  const arcTarget = guidance.arcTarget ?? 5;
  const activeThreadCount = threads.filter(t => !isThreadClosed(t) && !isThreadAbandoned(t)).length;
  const nodeGuidance = getPlanNodeGuidance(
    arcTarget,
    activeThreadCount,
    reasoningScale(guidance.reasoningLevel),
  );
  const userDirection = guidance.direction ? `\nDIRECTION (end fate goals to achieve):\n${guidance.direction}` : "";
  const userConstraints = guidance.constraints ? `\nCONSTRAINTS (what must NOT happen):\n${guidance.constraints}` : "";

  // Get patterns and anti-patterns
  const patterns = narrative.patterns ?? [];
  const antiPatterns = narrative.antiPatterns ?? [];

  const patternsSection = patterns.length > 0
    ? `STORY PATTERNS (positive commandments):\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const antiPatternsSection = antiPatterns.length > 0
    ? `ANTI-PATTERNS (pitfalls to avoid):\n${antiPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const prompt = `${ctx}

## NARRATIVE STATE

ACTIVE THREADS (compelling questions the story must answer):
${threadSummary || "No active threads"}

KEY CHARACTERS (with accumulated knowledge):
${characters || "None"}

KEY LOCATIONS:
${locations || "None"}

${relationships ? `KEY RELATIONSHIPS:\n${relationships}\n` : ""}
${systemKnowledge ? `SYSTEM KNOWLEDGE:\n${systemKnowledge}\n` : ""}
${artifacts ? `KEY ARTIFACTS:\n${artifacts}\n` : ""}
${recentScenes ? `RECENT STORY (what just happened):\n${recentScenes}\n` : ""}
${patternsSection}

${antiPatternsSection}

## PLAN REQUIREMENTS

${threadTargetsSection}
${userDirection}
${userConstraints}

ARC TARGET: ${arcTarget} arcs (plan exactly this many arcs)
${forcePreferenceBlock("plan", guidance.forcePreference)}
## TASK

Build a COORDINATION PLAN using BACKWARD INDUCTION, organised around the narrative's STRUCTURAL SPINE.

The spine is the sequence of **peaks** (where forces converge, threads culminate, the story commits) and **valleys** (turning points where tension is seeded and the arc pivots into the next movement). Peaks and valleys are complementary: peaks are where the story lands, valleys are where it launches. Both are load-bearing — a story of only peaks is exhausting; a story of only valleys is all setup and no payoff.

1. Identify the SPINE — one **peak** OR one **valley** per arc, whichever is the arc's structural anchor. That anchor carries arcIndex and sceneCount (3-12). Do NOT set forceMode — it is DERIVED from each arc's node composition after generation:
   - **fate-dominant** — fate nodes + thread-bearing spine nodes dominate (the arc is driven by internal thread pressure)
   - **world-dominant** — character/location/artifact nodes dominate (the arc is driven by existing entities)
   - **system-dominant** — system nodes dominate (the arc is driven by world rules or mechanics)
   - **chaos-dominant** — chaos nodes dominate (the arc is driven by outside forces — HP's troll arc, HP's Norbert arc)
   - **balanced** — no single category dominates
2. Add **moments** — any other beat worth calling out at plan level (thread escalations, setpieces, reveals) that isn't itself the arc's peak or valley.
3. Work BACKWARDS from end-state peaks to derive the valleys and moments needed to earn them.
4. Determine OPTIMAL ARC COUNT — may be fewer than budget if the spine is coherent sooner.
5. Assign every node to an ARC SLOT.
6. Seed **chaos** nodes where the plan genuinely needs new entities — a fresh character, location, artifact, or thread that doesn't yet exist. The scene generator will honour chaos nodes by invoking world expansion when their arc arrives.

The plan orchestrates multiple arcs WITHOUT micromanaging. Each arc gets its own reasoning graph later; this plan sets trajectory through the peak/valley rhythm.

**EFFICIENCY PRINCIPLE**: If the spine closes in fewer arcs than the budget, use fewer arcs. Don't pad to fill.

${reasoningModeBlock(guidance.reasoningMode)}

## ARC SIZING GUIDE

Each arc should be sized based on what its peak or valley anchor needs:

- **3-4 scenes (short)**: Valley-anchored pivots, quick transitions, aftermath beats
- **5-6 scenes (standard)**: Most arcs — a single peak or valley with supporting moments
- **7-9 scenes (extended)**: Major peaks where multiple threads converge, climactic sequences
- **10-12 scenes (epic)**: Act finales, massive setpieces, resolution of multiple threads

Consider:
- Peak-anchored arcs (convergence, resolution) typically need more scenes to earn the peak
- Valley-anchored arcs (pivot, seeding) tend to be shorter — they launch, they don't land
- World-dominant arcs tend to be shorter; fate-dominant arcs need enough scenes for proper payoff
- The total scene count across all arcs should feel appropriate for the story scope

## OUTPUT FORMAT

Return a JSON object with RICH, DIVERSE nodes. Example showing all node types working together:

**CRITICAL FORMAT REQUIREMENTS**:
- **IDs**: Use SEMANTIC slugs that carry the node's subject, prefixed by type. Format: \`<type>-<kebab-case-subject>\`. Examples: \`peak-empire-falls\`, \`valley-protagonist-loses-ally\`, \`moment-secret-revealed\`, \`reason-survival-demands-alliance\`, \`char-rival-governor\`, \`fate-dynastic-curse\`, \`loc-throne-hall\`, \`art-broken-crown\`, \`sys-imperial-succession\`, \`chaos-outsider-arrives\`, \`pattern-two-protagonists-converge\`, \`warn-third-resolution-by-force\`. Slug length: 3-6 words, lowercase, hyphenated. An edge \`{"from": "peak-empire-falls", "to": "fate-dynastic-curse"}\` is self-describing; the reader (and you, writing later edges) can see what each node is without scrolling back. Do NOT use opaque short codes like PK1, V1 — they force you to hold a mental table of what each code means.
- **Labels**: Must be PROPER ENGLISH descriptions (3-10 words). Describe what happens in natural language. NOT technical identifiers or codes.

{
  "summary": "1-2 sentence high-level plan summary grounded in specific world details",
  "arcCount": <number of arcs>,
  "plannedNodeCount": <-- commit first; locked once nodes begin. Sets the terminal's index (N-1) in backward modes.>,
  "nodes": [
    // ═══════════════════════════════════════════════════════════════
    // SPINE: peaks, valleys, and moments (one peak OR valley anchors each arc)
    // ═══════════════════════════════════════════════════════════════
    // PEAK that anchors an arc — carries arcIndex and sceneCount ONLY.
    // forceMode is DERIVED later from the arc's node mix. Don't set it.
    // The peak is the arc's structural commitment: forces converge, a thread culminates.
    {"id": "peak-glacier-confrontation", "index": 10, "type": "peak", "label": "The Glacier Confrontation", "detail": "WHY this arc needs N scenes — which forces converge and which thread culminates", "threadId": "thread-id", "targetStatus": "resolved", "arcIndex": 1, "sceneCount": 6, "arcSlot": 1},
    // VALLEY that anchors an arc — also carries arc metadata. A valley arc pivots rather than resolves: tension is seeded, a boundary is crossed.
    {"id": "valley-bai-enters-inheritance", "index": 20, "type": "valley", "label": "Bai Ning Bing enters the inheritance", "detail": "WHY this pivot is necessary before the next peak — what new tension is seeded", "threadId": "thread-id", "targetStatus": "escalating", "arcIndex": 2, "sceneCount": 4, "arcSlot": 2},
    // MOMENTS — plan-level beats that matter but aren't the arc's anchor.
    // Thread escalation moment (not the arc's peak/valley, but worth flagging):
    {"id": "moment-clan-betrayal-uncovered", "index": 1, "type": "moment", "label": "Fang Yuan uncovers the clan's betrayal", "detail": "WHY this intermediate beat matters for the next peak", "threadId": "thread-id", "targetStatus": "escalating", "arcSlot": 1},
    // Setpiece moment:
    {"id": "moment-tomb-first-glimpsed", "index": 2, "type": "moment", "label": "Gu master's tomb first glimpsed", "detail": "Plants information or raises stakes for a later peak", "arcSlot": 1},
    // CHAOS — outside-force injection (new character / location / artifact /
    // thread that didn't exist). Don't set entityId or threadId.
    {"id": "chaos-rival-scholar-arrives", "index": 17, "type": "chaos", "label": "A rival scholar arrives from a hidden order", "detail": "Spawned via world expansion — introduces a new character whose knowledge unblocks the Glacier approach", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // FATE NODES: thread pressure throughout the plan
    // ═══════════════════════════════════════════════════════════════
    {"id": "fate-survival-demands-action", "index": 2, "type": "fate", "label": "Survival thread demands immediate action", "detail": "How this thread's momentum shapes Arc 1 — reference thread log momentum", "threadId": "thread-id", "arcSlot": 1},

    // ═══════════════════════════════════════════════════════════════
    // CHARACTER NODES: WHO drives the plan (reference specific knowledge)
    // ═══════════════════════════════════════════════════════════════
    {"id": "char-fang-yuan-knows-gu", "index": 3, "type": "character", "label": "Fang Yuan knows the Gu's location", "detail": "Reference their accumulated knowledge from context — 'knows X, therefore can Y'", "entityId": "char-id", "arcSlot": 1},
    {"id": "char-bai-ambition-forces", "index": 4, "type": "character", "label": "Bai Ning Bing's ambition forces confrontation", "detail": "Their relationship with another character constrains options", "entityId": "char-id", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // LOCATION NODES: WHERE things must happen (reference continuity)
    // ═══════════════════════════════════════════════════════════════
    {"id": "loc-glacier-enables-secrecy", "index": 5, "type": "location", "label": "The Glacier's isolation enables secrecy", "detail": "Reference location's specific history or significance", "entityId": "loc-id", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // ARTIFACT NODES: items that shape outcomes (reference capabilities)
    // ═══════════════════════════════════════════════════════════════
    {"id": "art-cicada-time-manipulation", "index": 6, "type": "artifact", "label": "Spring Autumn Cicada enables time manipulation", "detail": "Reference specific capabilities from context", "entityId": "artifact-id", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM NODES: world rules that constrain (reference principles/systems/constraints)
    // ═══════════════════════════════════════════════════════════════
    {"id": "sys-gu-feeding-rules", "index": 7, "type": "system", "label": "Gu feeding rules require specific resources", "detail": "Reference specific principle/system/constraint from WORLD KNOWLEDGE", "systemNodeId": "actual-SYS-id-from-narrative", "arcSlot": 1},
    {"id": "sys-clan-hierarchy-blocks", "index": 8, "type": "system", "label": "Clan hierarchy prevents direct challenge", "detail": "Reference specific tension that can be exploited", "systemNodeId": "actual-SYS-id-from-narrative", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // REASONING NODES: causal chains (THE BACKBONE — use extensively)
    // ═══════════════════════════════════════════════════════════════
    {"id": "reason-resolution-needs-inheritance", "index": 9, "type": "reasoning", "label": "Resolution requires securing the inheritance first", "detail": "Backward induction step — reference specific system knowledge or relationships", "arcSlot": 2},
    {"id": "reason-inheritance-needs-knowledge", "index": 11, "type": "reasoning", "label": "Inheritance access requires Fang Yuan's knowledge", "detail": "Connect plot point to character agency", "arcSlot": 1},
    {"id": "reason-feeding-constrains-timing", "index": 12, "type": "reasoning", "label": "Gu feeding rules constrain the timing", "detail": "Connect character to system rule", "arcSlot": 1},
    {"id": "reason-glacier-enables-private", "index": 13, "type": "reasoning", "label": "Glacier setting enables private confrontation", "detail": "Connect constraint to location", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // PATTERN NODES: creative expansion (inject novelty and emergence)
    // ═══════════════════════════════════════════════════════════════
    {"id": "pattern-rivals-share-enemy", "index": 14, "type": "pattern", "label": "Two rivals discover shared enemy", "detail": "What EMERGENT property arises when these unrelated elements interact?"},
    {"id": "pattern-victory-hides-cost", "index": 15, "type": "pattern", "label": "Recent victory hides a hidden cost", "detail": "Second-order effect: what does X actually mean for Y that no one has realized?"},
    {"id": "pattern-rumored-ancient-tomb", "index": 16, "type": "pattern", "label": "Rumors of ancient Gu master's tomb", "detail": "What exists at the edge of the known world? New faction, location, or system implied but unexplored"},

    // ═══════════════════════════════════════════════════════════════
    // WARNING NODES: subvert predictability (challenge the obvious path)
    // ═══════════════════════════════════════════════════════════════
    {"id": "warn-convenient-alliance-needs-betrayal", "index": 17, "type": "warning", "label": "Alliance is too convenient—needs betrayal", "detail": "What's the LEAST obvious resolution that still feels inevitable? Subvert this."},
    {"id": "warn-protagonist-wins-too-easily", "index": 18, "type": "warning", "label": "Protagonist winning too easily", "detail": "What assumption should be challenged? What cost hasn't been paid?"}
  ],
  "edges": [
    // Dense connections showing causal flow through the spine
    {"id": "e1", "from": "peak-glacier-confrontation", "to": "reason-resolution-needs-inheritance", "type": "requires"},
    {"id": "e2", "from": "reason-resolution-needs-inheritance", "to": "valley-bai-enters-inheritance", "type": "requires"},
    {"id": "e3", "from": "valley-bai-enters-inheritance", "to": "moment-clan-betrayal-uncovered", "type": "develops"},
    {"id": "e4", "from": "moment-clan-betrayal-uncovered", "to": "reason-inheritance-needs-knowledge", "type": "requires"},
    {"id": "e5", "from": "reason-inheritance-needs-knowledge", "to": "char-fang-yuan-knows-gu", "type": "requires"},
    {"id": "e6", "from": "sys-gu-feeding-rules", "to": "reason-feeding-constrains-timing", "type": "constrains"},
    {"id": "e7", "from": "reason-feeding-constrains-timing", "to": "char-fang-yuan-knows-gu", "type": "constrains"},
    {"id": "e8", "from": "reason-glacier-enables-private", "to": "loc-glacier-enables-secrecy", "type": "enables"},
    {"id": "e9", "from": "fate-survival-demands-action", "to": "peak-glacier-confrontation", "type": "constrains"},
    {"id": "e10", "from": "art-cicada-time-manipulation", "to": "reason-glacier-enables-private", "type": "enables"},
    {"id": "e11", "from": "char-bai-ambition-forces", "to": "valley-bai-enters-inheritance", "type": "causes"},
    {"id": "e12", "from": "moment-tomb-first-glimpsed", "to": "peak-glacier-confrontation", "type": "develops"}
  ]
}

## NODE TYPES (all must be grounded in SPECIFIC context from above)

**FORMAT RULES (CRITICAL)**:
- **IDs**: Short alphanumeric codes only: PK1, V1, M1, R1, C1, F1, L1, AR1, S1, PT1, WN1, etc.
  - GOOD: "PK1", "V2", "M3", "R1", "C2", "PT1"
  - BAD: "PEAK_ARC2_T03", "THREAD_RESOLVE", "peak_resolution_1"
- **Labels**: Natural English phrases (3-10 words) describing WHAT happens.
  - GOOD: "Fang Yuan discovers the hidden tomb", "Alliance fractures over resource dispute"
  - BAD: "Peak node", "PK2_ESCALATE", "resolution mechanism"

**SPINE NODES** (structural skeleton — peaks, valleys, moments):
- **peak**: A scene where forces converge and a thread culminates — the story commits. Label: the concrete event (e.g., "The clan elder reveals the betrayal").
  - If this peak ANCHORS an arc: set arcIndex, sceneCount (3-12), and arcSlot = arcIndex. Detail: WHY N scenes and which forces converge.
  - May also carry threadId + targetStatus (resolved/subverted/critical) for the thread that culminates here.
- **valley**: A turning point where tension is seeded and the arc pivots — the story launches. Label: the pivot (e.g., "Bai Ning Bing crosses into the inheritance").
  - If this valley ANCHORS an arc: set arcIndex, sceneCount, and arcSlot. Detail: WHAT tension is seeded and WHICH boundary is crossed.
  - May carry threadId + targetStatus (typically escalating/active) for a thread the valley pivots.
- **moment**: A plan-level beat that isn't the arc's peak or valley but is worth flagging — thread escalation, setpiece, reveal, setup planted for a later payoff. Has arcSlot, may carry threadId + targetStatus. DOES NOT carry arcIndex or sceneCount.

**SPINE RULE (CRITICAL)**: Exactly ONE peak OR valley per arc carries the arc's arcIndex and sceneCount. Everything else worth mentioning at plan level is a moment. Do not mark two peaks for the same arc, and do not mark moments with arcIndex.

**FORCE MODE (DERIVED, NOT SET)**: Do NOT write forceMode in any node. It is computed from each arc's node mix:
- Fate + thread-bearing spine nodes dominant ⇒ **fate-dominant**
- Character + location + artifact dominant ⇒ **world-dominant**
- System dominant ⇒ **system-dominant**
- **Chaos dominant ⇒ chaos-dominant** — outside forces drive the arc
- No single category dominant ⇒ **balanced**

Shape an arc's force character through its node composition: a fate-dominant arc needs more fate nodes; a chaos-dominant arc (e.g., the troll-in-the-dungeon) needs a chaos node as its prime mover plus supporting reasoning about how the cast responds.

**FATE NODES** (thread pressure):
- **fate**: Thread pressure on specific arcs. Has threadId, arcSlot. Label: what the thread demands in plain English (e.g., "Survival thread demands sanctuary").

**ENTITY NODES** (grounding in specific system knowledge — USE ALL OF THESE):
- **character**: WHO drives this transition. MUST have entityId. Label: character + their key action/knowledge (e.g., "Fang Yuan exploits his memory of the future"). **Distribute agency across the cast** — a plan where only the protagonist appears as a character driver is under-representing the world. Secondary characters (rivals, allies, factions' leaders) should appear as agents with their own agendas across multiple arcs, not just as obstacles for the protagonist to overcome.
- **location**: WHERE things must happen. MUST have entityId. Label: location + what it enables (e.g., "The Glacier's isolation enables secret negotiation").
- **artifact**: WHAT item shapes outcomes. MUST have entityId. Label: artifact + its role (e.g., "Spring Autumn Cicada enables time reversal").
- **system**: HOW world rules constrain. Use systemNodeId to reference an existing SYS-XX node from SYSTEM KNOWLEDGE — copy the bracketed [SYS-XX] id verbatim. Omit systemNodeId only when introducing a brand-new rule. Label: the rule stated plainly (e.g., "Gu worms require regular feeding to survive").

**REASONING NODES** (causal chains — THE BACKBONE, use extensively):
- **reasoning**: Logical step in backward induction. Has arcSlot. Label: the inference in plain English (e.g., "Resolution requires controlling the inheritance first"). Detail: explain WHY this follows.

**CREATIVE AGENT NODES** (inject novelty and subvert expectations):
- **pattern**: NOVEL-PATTERN GENERATOR. Proposes a structural shape this plan has NOT used in prior arcs — a fresh arc cadence, a new relational geometry between threads, an unusual anchor type, a rhythm variation. Not generic creativity: a specific pattern the plan hasn't produced yet. Label: the new pattern (e.g., "First valley-anchored arc where the pivot comes from a peripheral character", "Two threads converge without either resolving — a shape no prior arc uses"). Before proposing, scan the plan's existing arcs for shapes already present, then propose something genuinely absent.
- **warning**: PATTERN-REPETITION DETECTOR. Flags where the plan is drifting toward shapes it has already used — three peak-anchored arcs in a row, two consecutive fate-dominant arcs, resolutions that follow the same rhythm. Humans detect structural repetition powerfully; once the plan's rhythm becomes predictable, each subsequent arc lands softer. Name the repetition concretely: "Arcs 2, 4, and 5 would all resolve via external force — reader will feel it", "Three valley-anchored arcs stacked — rhythm is flatlining".
- **chaos**: OUTSIDE FORCE — operates outside the existing fabric of fate, world, and system. Chaos has two faces: **deus-ex-machina** (brings an unexpected problem the cast must solve, or an unexpected solution the cast couldn't build — a troll crashes into the dungeon, a stranger arrives with the missing clue, a dormant artefact wakes), and **creative engine** (seeds new fate — opens threads that didn't exist, which later arcs develop and resolve). Balance is the key: a plan with a couple of chaos moments is alive; a plan without any is inert; a plan of nothing but chaos has no spine to hold onto. An arc can be CHAOS-ANCHORED when its core movement comes from outside the established world (HP's troll-in-the-dungeon and Norbert arcs are chaos-anchored; the welcoming feast is world-driven; the Quirrell climax is fate-driven). Label: what arrives and its role. DO NOT set entityId or threadId — the entity/thread is spawned via world expansion. Remember: chaos sits outside fate, but it SHAPES fate by creating new strands.

## EDGE TYPES

- **requires**: A depends on B (direction matters — A needs B, not B needs A; reversing this corrupts the graph silently)
- **enables**: A makes B possible (B could exist without A, but not here)
- **constrains**: A limits B
- **causes**: A leads to B (B would not exist without A)
- **develops**: A deepens B (use for character/thread arcs only, not generic logic steps)
- **resolves**: A concludes B

## REQUIREMENTS

1. **Backward induction**: Start from the final peak and work backwards — which valleys seed it, which moments carry it, which earlier peak made it possible.
2. **Arc count**: Plan exactly ${arcTarget} arcs
3. **Arc slots**: Every node (except pattern/warning) needs arcSlot (1-N) indicating when it's relevant
4. **CHRONOLOGICAL INDEXING**: Node indexes MUST be chronological by arc — Arc 1 nodes get indexes 0-N, Arc 2 nodes get N+1 to M, etc. Within each arc, order by causal flow.
5. **Progressive revelation**: Nodes with arcSlot > currentArc are hidden from arc generation
6. **One spine anchor per arc**: Exactly ${arcTarget} anchor nodes total. Each is a peak OR a valley (not both for the same arc) with arcIndex and sceneCount. Peak-anchor vs valley-anchor depends on whether the arc commits or pivots.
7. **Deliberate arc sizing**: Each anchor MUST have sceneCount (3-12) with reasoning in detail explaining WHY that length.
8. **Force rhythm via composition**: Shape each arc's force character through node mix — more fate nodes for a fate-dominant arc, more entities for a world-dominant arc, more system nodes for a system-dominant arc. Don't write forceMode; vary node composition.
9. **Peak/valley rhythm**: A plan of all peaks is exhausting; a plan of all valleys is all setup. Aim for alternation — roughly ~60/40 mix, with the final arc typically peak-anchored.
10. **Thread trajectories**: Each thread needs spine nodes (peaks for resolutions/culminations, valleys for pivots, moments for intermediate escalations) showing its progression.
11. **Chaos present**: Include chaos nodes where the plan benefits from something the existing world cannot produce — a fresh character arriving, a hidden location surfacing, a dormant artifact waking, a new thread emerging. Chaos nodes have arcSlot but NO entityId/threadId.
12. **Causal complexity**: story causation is a web — threads pull on many things, entities influence multiple lines, rules constrain several choices. Every node should connect to more than one point; a node touching the story only once is under-represented.
13. **Every entity, fully connected**: when a character, location, artifact, or system shapes the plan, show all the places it shapes — not just one role.
14. **Pacing balance**: mix arc sizes — not all arcs the same length.
15. **Grounded reasoning**: reference specific character knowledge, relationships, artifacts, or world rules in reasoning nodes.
16. **Character agency (CRITICAL)**: character nodes reference ≥3 distinct entityIds across the plan. At least one arc is driven by a non-protagonist (their character node has more outgoing edges than the protagonist's in that arc). Every named character has at least one OUTGOING edge — characters acted upon without agency are absorbed into reasoning, not rendered as scenery.
17. **System constraints**: include system nodes that show HOW world rules shape outcomes.
18. **Warning/pattern response (CRITICAL)**: warnings and patterns must structurally change the plan, not sit as ornaments. A warning's cross-arc repetition is broken by changing spine anchors, arc sizing, or composition; a pattern's proposed shape is adopted by at least one actual arc. Wire warning/pattern nodes to the arcs they're correcting via edges — orphaned ones are dead weight.
19. **Every thread lands**: each thread resolves in a specific arc, or is explicitly carried past the plan. Net open threads trend toward closure by the final arc, not backlog.
20. **No twin arcs**: each arc moves the story from a different state to a different state. Two arcs with the same subject are one arc — merge or cut.
21. **Terminal arc commits**: the final arc's anchor is a peak that closes threads, unless the summary explicitly declares the plan an opening movement.
22. **Novelty over recycling**: resolved threads mostly stay resolved — an arc that re-opens a closed question must earn it, not default to it. Prefer new threads of fate across the plan and new structural shapes across arcs. Sameness between arcs reads as drift.

## NODE COUNT TARGETS (MANDATORY MINIMUMS)

For this ${arcTarget}-arc plan with ${activeThreadCount} active threads, target **at least ${nodeGuidance.totalMin} nodes** across all types.

**Spine nodes** (peaks + valleys + moments):
- **Total spine nodes**: At least ${nodeGuidance.minSpineNodes} (one anchor per arc + thread progressions + supporting moments)
- **Arc anchors**: Exactly ${arcTarget} total — a mix of peaks and valleys, each with arcIndex and sceneCount
- **Moments**: Use freely — every thread needs 2-3 moment nodes showing its progression between peaks

**Reasoning backbone**:
- **Reasoning nodes**: At least ${nodeGuidance.minReasoningNodes}

**Entity grounding** (use all four types):
- **Character nodes**: At least ${nodeGuidance.minCharacterNodes}
- **Location nodes**: At least ${nodeGuidance.minLocationNodes}
- **Artifact nodes**: At least ${nodeGuidance.minArtifactNodes} (if artifacts exist in context)
- **System nodes**: At least ${nodeGuidance.minSystemNodes}

**Agent nodes**:
- **Pattern nodes**: At least ${nodeGuidance.minPatterns} — each introducing a structural shape absent from prior arcs in this plan
- **Warning nodes**: At least ${nodeGuidance.minWarnings} — each naming a specific repetition risk (e.g., "arcs X, Y, Z would share rhythm Q") so the plan actively routes around it
- **Chaos nodes**: At least ${nodeGuidance.minChaos} — outside-force injections spawning new entities or new fates (HP had troll, Norbert, mirror, Fluffy). DO NOT set entityId or threadId on chaos nodes.

## PER-ARC BALANCE (CRITICAL)

**Each arc must have meaningful reasoning.** Variation is natural, but avoid extreme disparities.

**Per-arc guidelines**:
- Early/mid arcs: 5-10 nodes each (setup, plot points, reasoning chains)
- Late arcs: 4-8 nodes each (convergence, escalation)
- Final arc: 3-6 nodes minimum (resolution plot points, final reasoning)

**Allowed variation**: Arc 1 having 8 nodes while Arc 3 has 6 is fine.
**Not allowed**: Arc 1 having 15 nodes while Arc 5 has 2 (extreme disparity).

**Bad (front-loaded)**:
- Arc 1: 15 nodes, Arc 2: 8 nodes, Arc 3: 4 nodes, Arc 4: 3 nodes, Arc 5: 2 nodes

**Good (balanced with natural variation)**:
- Arc 1: 8 nodes, Arc 2: 7 nodes, Arc 3: 6 nodes, Arc 4: 7 nodes, Arc 5: 5 nodes

## SHAPE OF A GOOD PLAN

A coordination plan is a **causal reasoning diagram**, not a proof outline. It represents how the story actually works: peaks don't just follow from one cause — they converge from several. Entities don't appear once — they matter in multiple places. Threads don't run straight — they pull on other threads and get pulled by systems and chaos.

A plan that looks like a vertical list of nodes each with a single cause and a single effect is failing to capture the story's complexity. A good plan has entities that are shared substrate across arcs, peaks that are the convergence of multiple setups, and threads that interact with rules, locations, and each other.

When you finish, scan the graph: do the key characters appear once and connect to several things? Does each peak feel like several pressures coming together? Or does every node live in isolation on a single line? If the latter, the plan is under-representing the story.

Return ONLY the JSON object.`;

  const reasoningBudget = defaultReasoningBudget(narrative);

  const raw = onReasoning
    ? await callGenerateStream(
        prompt,
        SYSTEM_PROMPT,
        () => {}, // No token streaming for main output
        undefined,
        "generateCoordinationPlan",
        undefined,
        reasoningBudget,
        onReasoning,
      )
    : await callGenerate(
        prompt,
        SYSTEM_PROMPT,
        undefined,
        "generateCoordinationPlan",
        undefined,
        reasoningBudget,
      );

  // Parse and validate (parseJson handles markdown fences)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = parseJson(raw, "generateCoordinationPlan") as any;

    const arcCount = typeof data.arcCount === "number" ? data.arcCount : arcTarget;

    // Validate and sanitize nodes. The JSON array position (original
    // emission order) becomes order — the order the reasoner
    // thought of each node. Captured BEFORE reindexing so the signature
    // of backward thinking modes survives the causal reindex below.
    const nodes: CoordinationNode[] = (data.nodes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((n: any, i: number) => ({ n, order: i }))
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ n }: { n: any }) =>
          typeof n.id === "string" &&
          typeof n.index === "number" &&
          typeof n.type === "string" &&
          typeof n.label === "string",
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(({ n, order }: { n: any; order: number }) => ({
        id: n.id,
        index: n.index, // Will be reindexed below
        order,
        type: VALID_COORDINATION_NODE_TYPES.has(n.type) ? n.type : "reasoning",
        label: typeof n.label === "string" ? n.label.slice(0, 100) : "",
        detail: typeof n.detail === "string" ? n.detail.slice(0, 300) : undefined,
        entityId: typeof n.entityId === "string" ? n.entityId : undefined,
        threadId: typeof n.threadId === "string" ? n.threadId : undefined,
        systemNodeId: typeof n.systemNodeId === "string" ? n.systemNodeId : undefined,
        marketIntent: typeof n.marketIntent === "string" ? n.marketIntent : undefined,
        marketOutcome: typeof n.marketOutcome === "string" ? n.marketOutcome : undefined,
        arcIndex: typeof n.arcIndex === "number" ? n.arcIndex : undefined,
        sceneCount: typeof n.sceneCount === "number" ? n.sceneCount : undefined,
        forceMode: typeof n.forceMode === "string" ? n.forceMode : undefined,
        arcSlot: typeof n.arcSlot === "number" ? n.arcSlot : undefined,
      }));

    // Reindex nodes chronologically by arcSlot
    // Arc 1 nodes get indexes 0, 1, 2..., Arc 2 continues from there, etc.
    // Global nodes (pattern/warning without arcSlot) go at the end
    const nodesWithArcSlot = nodes.filter(n => n.arcSlot !== undefined);
    const globalNodes = nodes.filter(n => n.arcSlot === undefined);

    // Sort by arcSlot first, then by original index within each arc
    nodesWithArcSlot.sort((a, b) => {
      if (a.arcSlot !== b.arcSlot) return (a.arcSlot ?? 0) - (b.arcSlot ?? 0);
      return a.index - b.index;
    });

    // Reassign indexes chronologically
    let newIndex = 0;
    for (const node of nodesWithArcSlot) {
      node.index = newIndex++;
    }
    for (const node of globalNodes) {
      node.index = newIndex++;
    }

    // Rebuild nodes array in new order (reindexed chronologically by arc)
    const reindexedNodes: CoordinationNode[] = [...nodesWithArcSlot, ...globalNodes];

    // Validate edges
    const nodeIds = new Set(reindexedNodes.map((n) => n.id));
    const edges: CoordinationEdge[] = (data.edges ?? [])
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) =>
          typeof e.id === "string" &&
          typeof e.from === "string" &&
          typeof e.to === "string" &&
          typeof e.type === "string" &&
          VALID_EDGE_TYPES.has(e.type),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        type: e.type as ReasoningEdgeType,
        label: typeof e.label === "string" ? e.label.slice(0, 100) : undefined,
      }))
      .filter((e: CoordinationEdge) => nodeIds.has(e.from) && nodeIds.has(e.to));

    // Build arc partitions — nodes grouped by arcSlot
    const arcPartitions: string[][] = [];
    for (let arc = 1; arc <= arcCount; arc++) {
      // Cumulative: all nodes with arcSlot <= arc
      const partition = reindexedNodes
        .filter((n) => n.arcSlot !== undefined && n.arcSlot <= arc)
        .map((n) => n.id);
      // Also include pattern/warning/chaos agent nodes without arcSlot
      // (creative agents can be global to the plan).
      const globalAgentNodes = reindexedNodes
        .filter(
          (n) =>
            n.arcSlot === undefined &&
            (n.type === "pattern" ||
              n.type === "warning" ||
              n.type === "chaos"),
        )
        .map((n) => n.id);
      arcPartitions.push([...new Set([...partition, ...globalAgentNodes])]);
    }

    const plan: CoordinationPlan = {
      id: `plan-${Date.now()}`,
      nodes: reindexedNodes,
      edges,
      arcCount,
      summary: typeof data.summary === "string" ? data.summary : "Coordination plan",
      arcPartitions,
      currentArc: 0,
      completedArcs: [],
      createdAt: Date.now(),
    };
    // Derive forceMode for each arc anchor from node composition. We don't
    // trust the LLM to label this correctly — it falls out of what was planned.
    return applyDerivedForceModes(plan);
  } catch (err) {
    logError("Failed to parse coordination plan", err, {
      source: "world-expansion",
      operation: "coordination-plan-parse",
    });
    // Return minimal fallback
    return {
      id: `plan-${Date.now()}`,
      nodes: [
        {
          id: "ERR",
          index: 0,
          type: "reasoning",
          label: "Plan generation failed",
          detail: String(err),
        },
      ],
      edges: [],
      arcCount: 1,
      summary: "Failed to generate coordination plan",
      arcPartitions: [["ERR"]],
      currentArc: 0,
      completedArcs: [],
      createdAt: Date.now(),
    };
  }
}

/**
 * Build a sequential path for a specific arc from the coordination plan.
 * Only includes nodes visible to that arc (arcSlot <= arcIndex).
 */
export function buildPlanPathForArc(plan: CoordinationPlan, arcIndex: number): string {
  const visibleNodeIds = new Set(plan.arcPartitions[arcIndex - 1] ?? []);
  const visibleNodes = plan.nodes.filter((n) => visibleNodeIds.has(n.id));
  const visibleEdges = plan.edges.filter(
    (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to),
  );

  // Use the same format as buildSequentialPath
  return buildSequentialPath({ nodes: visibleNodes, edges: visibleEdges });
}
