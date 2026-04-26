/**
 * Phase Graph generation prompt — mines narrative context (with optional
 * user guidance and optional seed graph) and emits a JSON phase graph
 * describing the current working model of reality. The temporal stance of
 * each node is implicit in its type (pattern = currently-active, landmark =
 * past-but-anchoring, etc.).
 *
 * The phase graph is consumed downstream by CRG / scene / plan / prose
 * generation as a working-state input — its job is to describe REALITY AS
 * IT NOW STANDS, not to plan what happens next. Phase graphs are also the
 * unit users edit (regenerate or clear) to induce phase changes in the
 * narrative simulation.
 */

export const PHASE_GRAPH_SYSTEM =
  "You are a phase analyst. Read a narrative's state and emit a graph describing the working model of reality the story currently operates under: which patterns are active, which conventions are followed, which attractors the cast aims at, which agents are driving, which rules bind, which pressures are accumulating, which landmarks anchor the past. The graph is descriptive (state of the system), not prescriptive (plot). Return ONLY valid JSON matching the schema in the user prompt.";

export type PhaseGraphPromptArgs = {
  /** Pre-built `<narrative-context>` body. */
  context: string;
  /** Optional seed-graph block — XML-rendered prior phase graph the user is regenerating from. */
  basedOnSection?: string;
  /** Optional user guidance / hypothesis (free text). */
  guidance?: string;
  /** Min/max target node counts. */
  nodeCountMin: number;
  nodeCountMax: number;
};

export function buildPhaseGraphPrompt(args: PhaseGraphPromptArgs): string {
  const { context, basedOnSection, guidance, nodeCountMin, nodeCountMax } = args;

  return `<inputs>
  <narrative-context>
${context}
  </narrative-context>
${basedOnSection ? `\n  ${basedOnSection.replace(/\n/g, '\n  ')}\n` : ''}
${guidance?.trim() ? `  <user-hypothesis hint="The user proposes a particular reading of the working model. Surface a phase graph that embodies or tests this hypothesis where the canon supports it; do not invent canon to fit it.">${guidance.trim()}</user-hypothesis>\n` : ''}
</inputs>

<task>Mine the narrative context and emit a PHASE GRAPH — the working model of reality the story currently operates under.</task>

<phase-doctrine>
  <principle name="state-not-plot">A phase graph describes WHAT IS, not WHAT HAPPENS NEXT. CRG and scene generation handle plot. Your job is the snapshot of reality the story currently inhabits — the configuration the next arc will operate within.</principle>
  <principle name="canon-grounded">Every node anchors in the narrative context above. A phase claim with no supporting evidence in canon is a hallucination, not a phase node. The user-hypothesis (if present) is a lens, not a license to invent — surface what the canon ACTUALLY supports, even if it differs from the hypothesis.</principle>
  <principle name="seven-stances">Each node type encodes a temporal stance: pattern (currently-active), convention (currently-followed), attractor (future-pointing), agent (currently-driving), rule (currently-binding), pressure (accumulating-toward-discharge), landmark (past-but-anchoring). Pick the type that matches what the node actually IS in the system, not the type that sounds nicest.</principle>
  <principle name="emergent-over-listed">A pattern is not a single thread or rule restated as a node — it's a CONFIGURATION the story has fallen into (e.g., "every authority figure proves untrustworthy", "outsider intervention precedes every breakthrough"). Conventions are HOW the story behaves by default (e.g., "negotiations resolve through ritual, not bargaining"). Surface the configurations and conventions, not the components.</principle>
  <principle name="pressures-have-direction">A pressure node names what is accumulating AND toward what discharge. "Resentment between A and B" is incomplete; "Resentment between A and B accumulating toward an open break" is a pressure. The discharge target gives later arcs a direction to point.</principle>
  <principle name="landmarks-still-anchor">A landmark is a past event that still constrains the present — its influence has not faded. Wars that ended but whose terms still bind, betrayals whose distrust still shapes alliances, deaths whose absences still warp choice. If the past event no longer shapes anything, it is history, not a landmark.</principle>
</phase-doctrine>

<node-types hint="Every node grounded in the narrative context.">
  <type name="pattern">A recurring configuration the story keeps falling into. CURRENTLY-ACTIVE. Label = the configuration in 4-10 words ("Authority figures prove untrustworthy on contact"). Detail = WHERE it has manifested in canon (cite scenes, threads, or arcs) and WHY it keeps recurring.</type>
  <type name="convention">A procedural default — how the story behaves when the question doesn't have a sharper answer. CURRENTLY-FOLLOWED. Label = the default ("Disputes resolve through ritual challenge, not negotiation"). Detail = the canon evidence and the standing exception (if any).</type>
  <type name="attractor">A target the cast (or the system) is aimed at. FUTURE-POINTING. Label = the target ("Reunification of the splintered houses"). Detail = whose pull, what's drawing toward it, what would constitute reaching it.</type>
  <type name="agent">An entity with stance — character, faction, institution — actively driving the system in a direction. CURRENTLY-DRIVING. Use entityId for character/location/artifact agents. Label = entity + their drive ("Pan Chong drives toward exposing the inheritance fraud"). Detail = their leverage, their constraint, their visible move set.</type>
  <type name="rule">A foreground constraint — a system rule that is actively binding choice in the current phase. Use systemNodeId for existing SYS-XX rules. CURRENTLY-BINDING. Label = the rule as it bites here ("Gu feeding cycle constrains all timing"). Detail = what it forces / forbids and what would relax it.</type>
  <type name="pressure">Accumulated tension that has not yet discharged. ACCUMULATING-TOWARD-DISCHARGE. Label = source + target ("Faction friction between A and B accumulating toward open break"). Detail = the events that built it, the threshold that would tip it, the form discharge is most likely to take.</type>
  <type name="landmark">A discharged past event whose influence still anchors the present. PAST-BUT-ANCHORING. Label = the event + its anchor ("Reverend Insanity's prior fall still shapes clan succession"). Detail = what happened, why its influence persists, what would finally release it (if anything).</type>
</node-types>

<edge-types hint="Reuse the CRG ontology. Direction matters.">
  <edge name="enables">A makes B possible (B could exist without A, but not in this phase).</edge>
  <edge name="constrains">A limits/blocks B.</edge>
  <edge name="risks">A creates danger for B.</edge>
  <edge name="requires">A depends on B (A needs B; reversing corrupts the graph silently).</edge>
  <edge name="causes">A leads to B (B would not exist without A).</edge>
  <edge name="reveals">A exposes information in B.</edge>
  <edge name="develops">A deepens B (use for agents/attractors that mature, not generic logic).</edge>
  <edge name="resolves">A concludes/answers B.</edge>
  <edge name="supersedes">A replaces/overrides B — the older claim, rule, pattern, or convention is no longer load-bearing; A is what the phase now operates on. Use when a new convention has displaced an older one, when a landmark's influence has been overtaken, when a fresh pattern is succeeding a faded one.</edge>
</edge-types>

<requirements>
  <requirement index="1" name="canon-anchored" critical="true">Every node cites or implicates specific canon — characters, threads, system rules, scenes. A node detail that could attach to any narrative is too generic; rewrite until it could only attach to THIS one.</requirement>
  <requirement index="2" name="node-count">Target ${nodeCountMin}-${nodeCountMax} nodes. Distribute across types — a phase graph that is all patterns or all pressures is partial.</requirement>
  <requirement index="3" name="every-type-considered">Walk the seven node types deliberately. Not every type must appear, but each must be considered; absence is a deliberate choice.</requirement>
  <requirement index="4" name="agent-distribution">Agent nodes reference at least 2 distinct entityIds across the graph. A phase graph driven entirely by the protagonist's agency under-represents the system.</requirement>
  <requirement index="5" name="pressure-discharge">Every pressure node names a discharge target — the form/place tension is heading toward. Pressures without direction are texture, not phase.</requirement>
  <requirement index="6" name="landmark-anchoring">Every landmark node names the present-tense influence it still exerts. Past events whose influence has faded are not landmarks; cut them.</requirement>
  <requirement index="7" name="sequential-indexing">\`index\` is a topological order over the edges — 0 is a root (no causal predecessors), each later index's predecessors have lower indices. Walking ascending indices should read as a coherent sweep through the phase. \`order\` (auto-captured from JSON array position) may differ in backward emissions.</requirement>
  <requirement index="8" name="entity-references">Agent nodes use entityId; rule nodes use systemNodeId for existing SYS-XX rules; landmark/pressure nodes anchored to a thread use threadId. Hallucinated ids are stripped at parse time.</requirement>
  <requirement index="9" name="connect-the-graph">No orphans. Every node carries at least one edge — patterns supersede or are reinforced by landmarks, agents are constrained by rules, pressures discharge into attractors, etc. Lone nodes are decoration; cut or connect.</requirement>
  <requirement index="10" name="supersedes-where-relevant">When the narrative has visibly outgrown a prior pattern / convention / rule, mark it with a \`supersedes\` edge from the new node to the old. Do NOT include the superseded one as a separate orphan node — only include it inside the supersession arrow.</requirement>
  <requirement index="11" name="based-on-divergence">If a prior phase graph is provided, do NOT replicate it. The new graph must visibly differ — supersede outdated nodes, surface emergent patterns the prior missed, retire pressures that have discharged. A regenerated phase graph that maps onto its predecessor with cosmetic changes is a wasted regeneration.</requirement>
  <requirement index="12" name="hypothesis-honesty">If the user provided a hypothesis, surface evidence FOR it where canon supports, evidence AGAINST it where canon contradicts, and refuse to invent. The phase graph is the user's diagnostic instrument — distorting reality to match their hypothesis breaks the instrument.</requirement>
</requirements>

<shape-of-good-phase-graph>
  A causal diagram of the system's current state, not a list of facts. Pressures have direction; landmarks anchor; patterns and conventions interlock; agents move within rules and toward attractors. When you finish, scan the graph: do the seven types appear in coherent relation, or is each isolated? A phase graph reads well when it captures WHAT IT IS LIKE TO LIVE INSIDE THIS STORY RIGHT NOW — the climate, not the weather.
</shape-of-good-phase-graph>

<output-format>
Return ONLY a JSON object.

<format-requirements>
  <ids>SEMANTIC slugs prefixed by type: \`<type>-<kebab-case-subject>\`. 3-6 words, lowercase, hyphenated. Examples: \`pattern-authority-betrays-on-contact\`, \`convention-rituals-resolve-disputes\`, \`attractor-reunified-houses\`, \`agent-pan-chong-fraud-exposure\`, \`rule-gu-feeding-binds-timing\`, \`pressure-clan-friction-toward-open-break\`, \`landmark-reverend-insanity-fall\`. Do NOT use opaque codes.</ids>
  <labels>PROPER ENGLISH (4-12 words), natural language. Each label states the node as a fact about the world.</labels>
</format-requirements>

<example>
{
  "summary": "1-2 sentence high-level reading of the working model — what climate this story currently lives in.",
  "plannedNodeCount": 9,
  "nodes": [
    {"id": "landmark-reverend-insanity-fall", "index": 0, "type": "landmark", "label": "Reverend Insanity's prior fall still shapes clan succession", "detail": "His death created the inheritance fraud the current cast contests. The fraud's terms remain the operational legal framework for clan succession; every challenger must work within or break those terms."},
    {"id": "rule-gu-feeding-binds-timing", "index": 1, "type": "rule", "label": "Gu feeding cycle binds all timing", "detail": "The forty-day feeding window forces every action against the inheritance to land before cycle end; missing it costs Fang Yuan's primary Gu and his leverage with it.", "systemNodeId": "SYS-12"},
    {"id": "pattern-authority-betrays-on-contact", "index": 2, "type": "pattern", "label": "Authority figures betray protagonists on contact", "detail": "Three arcs running: clan elder, sect master, neutral arbiter — each breaks faith with Fang Yuan within their first scene. The pattern has become predictive; the cast no longer treats authority as honourable."},
    {"id": "agent-pan-chong-fraud-exposure", "index": 3, "type": "agent", "label": "Pan Chong drives toward exposing the inheritance fraud", "detail": "His leverage is the orphan-trade ledger; his constraint is clan hierarchy that forbids him from naming the fraud directly. His visible move set: indirect intelligence, third-party allegations, prepared exits.", "entityId": "C-PAN-CHONG"},
    {"id": "agent-fang-yuan-counter-mandate", "index": 4, "type": "agent", "label": "Fang Yuan drives toward a proactive counter-mandate framework", "detail": "His leverage is foreknowledge from the prior life; his constraint is the feeding window and the rule that explicit foreknowledge can't be cited. His visible move set: composite-corpus analysis, allied recruitment, deferred direct confrontation.", "entityId": "C-FANG-YUAN"},
    {"id": "pressure-clan-friction-toward-open-break", "index": 5, "type": "pressure", "label": "Clan friction with rival faction accumulating toward open break", "detail": "Built from three discrete provocations across arcs 4-7. Threshold: one more direct insult or a clan-level theft would tip it. Discharge form: most likely a Glacier-style confrontation; less likely a sanctioned duel."},
    {"id": "convention-disputes-resolve-by-ritual", "index": 6, "type": "convention", "label": "Disputes resolve through ritual challenge, not negotiation", "detail": "Standing default since arc 2; the one negotiation attempt collapsed when the rival invoked challenge mid-talk. Convention currently followed by both factions and most clan elders."},
    {"id": "attractor-counter-mandate-framework", "index": 7, "type": "attractor", "label": "Counter-mandate framework that survives Heaven's Will adaptation", "detail": "What Fang Yuan and his allies are aimed at: a method that retains analytical power across multiple Heaven's Will counter-strikes. Reaching it would discharge the inheritance pressure and supersede the trial-and-error pattern.", "threadId": "T-COUNTER-MANDATE"},
    {"id": "pattern-outsider-intervention-precedes-breakthroughs", "index": 8, "type": "pattern", "label": "Outsider intervention precedes every analytical breakthrough", "detail": "Pan Chong's intelligence (arc 5), the rival scholar's text (arc 7), the exile's testimony (arc 8) — each major Fang Yuan move was unblocked by an outsider. The pattern is succeeding the older self-sufficient pattern."}
  ],
  "edges": [
    {"id": "e1", "from": "landmark-reverend-insanity-fall", "to": "rule-gu-feeding-binds-timing", "type": "enables"},
    {"id": "e2", "from": "rule-gu-feeding-binds-timing", "to": "agent-fang-yuan-counter-mandate", "type": "constrains"},
    {"id": "e3", "from": "convention-disputes-resolve-by-ritual", "to": "pressure-clan-friction-toward-open-break", "type": "causes"},
    {"id": "e4", "from": "pattern-authority-betrays-on-contact", "to": "agent-fang-yuan-counter-mandate", "type": "constrains"},
    {"id": "e5", "from": "agent-pan-chong-fraud-exposure", "to": "agent-fang-yuan-counter-mandate", "type": "enables"},
    {"id": "e6", "from": "pressure-clan-friction-toward-open-break", "to": "attractor-counter-mandate-framework", "type": "risks"},
    {"id": "e7", "from": "agent-fang-yuan-counter-mandate", "to": "attractor-counter-mandate-framework", "type": "develops"},
    {"id": "e8", "from": "pattern-outsider-intervention-precedes-breakthroughs", "to": "pattern-authority-betrays-on-contact", "type": "supersedes"}
  ]
}
</example>
</output-format>

<final-instruction>Return ONLY the JSON object.</final-instruction>`;
}
