/**
 * Phase Graph generation prompt — mines narrative context (with optional
 * user guidance and optional seed graph) and emits a JSON phase graph
 * describing the HIGH-LEVEL META MACHINERY of the world / simulation: the
 * structural underpinnings of its economy, the meta-narrative tropes and
 * patterns the work runs on, the societal constraints and pulls of its
 * institutions, the foundational machinery from which everything else
 * derives meaning. Distinct from situational state — PRG describes the
 * MACHINERY OF REALITY, not the moment-to-moment action.
 *
 * Consumed downstream by CRG / scene / plan / prose generation: PRG sits
 * UNDER all of them as the foundational layer that gives meaningful body
 * to per-arc reasoning, beats, and prose. Its impact trickles down — the
 * higher layers operate ON TOP of the world the PRG describes.
 *
 * Phase graphs are immutable; users regenerate (optionally seeded) or
 * clear to induce phase changes in the simulation.
 */

export const PHASE_GRAPH_SYSTEM =
  "You are a phase analyst describing the META MACHINERY of a narrative or simulation — the structural underpinnings of its economy, the tropes and patterns the meta-narrative runs on, the societal constraints and pulls of its institutions, the foundational landmarks whose machinery still shapes the present. NOT situational state, NOT moment-to-moment action — the high-level scaffolding that gives downstream causal reasoning, plans, and prose their meaningful body. Return ONLY valid JSON matching the schema in the user prompt.";

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

<task>Mine the narrative context and emit a PHASE GRAPH — the high-level META MACHINERY of this world / simulation. Describe the structural underpinnings (economic, political, magical, cultural, generic, institutional) that everything else derives from.</task>

<phase-doctrine>
  <principle name="meta-not-situational">A phase graph describes the WORLD'S MACHINERY, not its moment-to-moment state. NOT "Fang Yuan is currently negotiating with Pan Chong" (situational — that's CRG/scene work). YES "the cultivation economy runs on essence-sphere extraction with diminishing returns at the clan level, structurally pressuring middle-tier sects to compete over young recruits" (machinery — the economic underpinning that situational reasoning trickles down from).</principle>
  <principle name="machinery-trickles-down">Higher-priority layers (direction, CRG, scenes, beats, prose) operate ON TOP of the world this PRG describes. Surface the underpinnings and the higher layers will inherit meaningful body — economic incentives that explain why characters bargain the way they do, generic conventions that explain why the next arc beats hit, institutional pulls that explain why factions stay in their lanes (or break out).</principle>
  <principle name="canon-grounded">Every node anchors in the narrative context above. A meta-claim with no supporting evidence in canon is a hallucination — surface only the machinery the canon ACTUALLY implies. The user-hypothesis (if present) is a lens, not a licence to invent.</principle>
  <principle name="structural-not-individual">Agents are FACTIONS, INSTITUTIONS, MARKETS, GENERIC FORCES — not individual characters. "The Reverend Insanity Sect" is a structural agent; "Fang Yuan" is not. Pressures are MACRO (demographic, economic, political, cultural) not interpersonal. Patterns are GENRE / META-NARRATIVE shapes ("xianxia revenge arcs always trigger karmic debt at the protagonist's first break with the clan") not story-level configurations.</principle>
  <principle name="seven-types">Each node type captures a different facet of the machinery: pattern (genre/meta-narrative tropes the work runs on), convention (cultural/societal procedural defaults), attractor (where the machinery structurally pulls), agent (institutional/faction/market drivers), rule (foundational world-rules that shape what's possible), pressure (macro pressures — demographic, economic, political), landmark (foundational past events whose machinery still defines the present). Pick the type that matches what the node IS at the meta level.</principle>
  <principle name="examples-of-scope">Good PRG nodes look like: "qi-cultivation creates winner-take-all dynamics that hollow out middle-tier sects" (rule), "xianxia genre demands every protagonist pay karmic debt for ascension" (pattern), "Heaven's Will functions as the world's anti-monopoly enforcer" (agent), "the Northern Plains' gradual loss of arable cultivation grounds" (pressure), "the founding compact of the Five Sects is the basis of all current succession law" (landmark). Bad PRG nodes look like: "Pan Chong distrusts Fang Yuan" (situational — belongs in CRG), "Bai Ning Bing is at the Glacier" (canon fact, not machinery).</principle>
</phase-doctrine>

<node-types hint="Every node grounded in canon, framed at the META level.">
  <type name="pattern">A genre / meta-narrative trope or recurring shape the work runs on. NOT a single-story configuration — a STRUCTURAL pattern at the level of "this kind of story always does X". Label = the trope in 4-12 words ("Xianxia mentor figures betray the protagonist in the second arc"). Detail = canonical evidence (scenes/arcs that exemplify it) AND why the genre/meta-narrative makes it structural.</type>
  <type name="convention">A cultural / societal / procedural default — how the WORLD handles a class of situation. Label = the default ("Clan succession decided by ritual challenge, not bloodline"). Detail = canon evidence + standing exceptions + which institutions enforce it. Conventions are world-rules embedded in culture, not individual character habits.</type>
  <type name="attractor">A target the world's machinery STRUCTURALLY pulls toward — the long-arc destination implied by economics, demographics, political dynamics, or genre. Label = the target ("Reunification of the splintered houses under a single sect"). Detail = which structural forces pull, what would constitute reaching it, what would deflect it. Not a character's goal — a systemic gravitational well.</type>
  <type name="agent">An INSTITUTIONAL / FACTIONAL / MARKET driver — a structural agent the world contains. Use entityId only for named institutional entities (a sect, a faction, an artefact-as-institution); typically structural agents are NOT individual characters. Label = the agent + its drive ("The Heavenly Court enforces karmic balance against unsanctioned cultivation"). Detail = what the agent's structural leverage is, what bounds it, how it manifests in canon.</type>
  <type name="rule">A FOUNDATIONAL world-rule that shapes what's possible — the machinery of the magic system, the laws of the economy, the structural physics. Use systemNodeId for existing SYS-XX rules. Label = the rule as it shapes the world ("Essence-sphere depletion is irreversible at the clan level"). Detail = what it forces / forbids structurally, what edge cases exist, how it cascades.</type>
  <type name="pressure">A MACRO pressure — demographic, economic, political, cultural — accumulating in the world. NOT an interpersonal tension. Label = the pressure + its discharge target ("Demographic collapse of the Northern Plains' cultivator population, accumulating toward forced sect mergers"). Detail = what's building it, the structural threshold, the form discharge is most likely to take.</type>
  <type name="landmark">A FOUNDATIONAL past event whose machinery still defines the present — the founding war, the schism, the compact, the cataclysm. Label = the event + its enduring machinery ("The First Heaven's Will Ban established the modern karmic-debt economy"). Detail = what happened, why the machinery persists structurally, what would finally release it.</type>
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
  <requirement index="1" name="meta-not-situational" critical="true">Every node describes WORLD MACHINERY, not story situation. If a node could be answered by "what's happening right now in this scene/arc", it belongs in CRG, not PRG. Rewrite at the structural level (economic, political, magical, cultural, generic, institutional) until removing the node would change the world's machinery, not just the current plot.</requirement>
  <requirement index="2" name="canon-grounded" critical="true">Every node cites or implicates specific canon — but framed as the META principle, not the canonical instance. "Three mentor betrayals across arcs 1-4" is the EVIDENCE; the node says "Xianxia mentor figures structurally betray the protagonist by the second arc". Generic claims that could attach to any narrative fail.</requirement>
  <requirement index="3" name="trickle-down-test">For each node, ask: would a downstream CRG / scene / plan / prose generator inherit MEANINGFUL BODY from this? Could it use the machinery to ground per-arc reasoning? If the answer is no, the node is too abstract — sharpen until it gives downstream layers something to operate on.</requirement>
  <requirement index="4" name="structural-agents">Agents are INSTITUTIONS / FACTIONS / MARKETS / GENERIC FORCES — not individual characters. "The Heavenly Court" yes; "Fang Yuan" no (he belongs in CRG). Use entityId only when an existing entity functions as a structural institution. At least 2 distinct structural agents in any non-trivial PRG.</requirement>
  <requirement index="5" name="node-count">Target ${nodeCountMin}-${nodeCountMax} nodes. Distribute across types — a PRG that is all patterns or all rules under-represents the machinery.</requirement>
  <requirement index="6" name="every-type-considered">Walk the seven node types deliberately. Not every type must appear, but each must be considered; absence is a deliberate choice.</requirement>
  <requirement index="7" name="pressure-discharge">Every pressure node names a discharge target at the macro level — what the structural pressure is heading toward (forced consolidation, regime collapse, demographic shift). Pressures without structural direction are texture, not phase.</requirement>
  <requirement index="8" name="landmark-anchoring">Every landmark names the present-tense MACHINERY it still defines — the operational framework, the legal compact, the precedent. "Influence persists" is too vague; say what STRUCTURE it still produces.</requirement>
  <requirement index="9" name="sequential-indexing">\`index\` is a topological order over the edges — 0 is a root (no causal predecessors), each later index's predecessors have lower indices. Walking ascending indices should read as the world's machinery building up from foundational landmarks/rules to current attractors.</requirement>
  <requirement index="10" name="entity-references">Agent nodes use entityId only for institutional/structural entities; rule nodes use systemNodeId for existing SYS-XX rules; landmark/pressure nodes can use threadId when anchored to a major arc-spanning thread. Hallucinated ids are stripped at parse time.</requirement>
  <requirement index="11" name="connect-the-graph">No orphans. Patterns embody landmarks; landmarks enable rules; rules constrain conventions; conventions encode agent-behaviour; agents create pressures; pressures pull toward attractors. Lone nodes are decoration; cut or connect.</requirement>
  <requirement index="12" name="supersedes-where-relevant">When the world's machinery has shifted (a new convention has displaced an older one, a foundational landmark has been overtaken by a newer one), mark with a \`supersedes\` edge. Do NOT include the superseded node as a separate orphan — fold it into the supersession.</requirement>
  <requirement index="13" name="based-on-divergence">If a prior phase graph is provided, do NOT replicate it. The new graph must visibly diverge — supersede outdated nodes, surface emergent machinery the prior missed, retire pressures that have structurally discharged.</requirement>
  <requirement index="14" name="hypothesis-honesty">If the user provided a hypothesis, surface evidence FOR it where canon's machinery supports, evidence AGAINST where canon contradicts, and refuse to invent. The PRG is the user's diagnostic instrument for the world's machinery — distorting it to match the hypothesis breaks the instrument.</requirement>
</requirements>

<shape-of-good-phase-graph>
  A diagram of the WORLD'S MACHINERY: the structural underpinnings that everything situational sits on top of. Foundational rules shape what's possible; conventions encode how the world handles classes of situation; institutional agents drive at the structural level; macro pressures accumulate; foundational landmarks define the present's terms; meta-narrative patterns give the genre its shape; attractors name where the machinery is structurally pulling. When you finish, scan: could this PRG describe ONLY this world, or is it generic? Could a CRG / scene generator looking at this PRG inherit meaningful body for THIS narrative's reasoning? If yes, it's working; if no, it's too abstract.
</shape-of-good-phase-graph>

<output-format>
Return ONLY a JSON object.

<format-requirements>
  <ids>SEMANTIC slugs prefixed by type: \`<type>-<kebab-case-subject>\`. 3-6 words, lowercase, hyphenated. Examples: \`pattern-genre-mentor-betrays-second-arc\`, \`convention-succession-by-ritual\`, \`attractor-sect-consolidation\`, \`agent-heavenly-court-enforcement\`, \`rule-essence-depletion-irreversible\`, \`pressure-northern-cultivator-collapse\`, \`landmark-first-heavens-will-ban\`. Do NOT use opaque codes.</ids>
  <labels>PROPER ENGLISH (4-12 words), natural language. Each label states the META machinery as a fact about how the world works.</labels>
</format-requirements>

<example>
{
  "summary": "1-2 sentence reading of the world's META machinery — the structural underpinnings (economic/political/magical/cultural/generic) downstream reasoning will inherit.",
  "plannedNodeCount": 9,
  "nodes": [
    {"id": "landmark-first-heavens-will-ban", "index": 0, "type": "landmark", "label": "The First Heaven's Will Ban established the modern karmic-debt economy", "detail": "When Reverend Insanity fell, the surviving sects compacted to ban direct foreknowledge cultivation; the compact's terms became the structural basis of the karmic-debt economy every contemporary protagonist now operates within. The machinery: every move against fate accrues a structural debt that downstream reasoning must price."},
    {"id": "rule-essence-depletion-irreversible", "index": 1, "type": "rule", "label": "Essence-sphere depletion is irreversible at the clan level", "detail": "Once a clan's essence-sphere drops below the regeneration threshold, recovery is structurally impossible — the clan must consolidate or fold. Cascades into faction politics: middle-tier clans live one bad cycle from extinction, which structurally shapes alliance behaviour.", "systemNodeId": "SYS-12"},
    {"id": "pattern-mentor-betrays-second-arc", "index": 2, "type": "pattern", "label": "Xianxia mentor figures betray protagonists in the second arc", "detail": "Genre-level meta-narrative pattern: every major xianxia structurally trains the protagonist to distrust authority by the second arc, because cultivation hierarchies are zero-sum and mentors must eventually compete with their pupils. Trickles down to: any mentor introduced in arc 1 carries structural betrayal weight by arc 2."},
    {"id": "agent-heavenly-court-enforcement", "index": 3, "type": "agent", "label": "Heavenly Court enforces karmic balance against unsanctioned cultivation", "detail": "Structural agent — not a character but the world's anti-monopoly mechanism. Its leverage: weather, fate manipulation, sanctioned punishments. Its bound: cannot act inside a sanctioned compact. Manifests in canon as Heaven's Will events that re-price markets which lean too far one way."},
    {"id": "agent-five-sects-compact", "index": 4, "type": "agent", "label": "The Five Sects' founding compact governs all succession law", "detail": "Institutional agent: the compact is the operational legal framework; every sect's internal politics derive from how they interpret it. Drives toward consolidation under whichever interpretation gains majority backing."},
    {"id": "pressure-northern-cultivator-collapse", "index": 5, "type": "pressure", "label": "Demographic collapse of Northern Plains cultivators, accumulating toward forced sect mergers", "detail": "Macro pressure: birth rates among awakened bloodlines have fallen for three generations, leaving Northern sects with insufficient recruits. Threshold: one more bad cycle forces consolidation. Discharge form: most likely an inter-sect marriage compact or a forced merger under the Five Sects' framework."},
    {"id": "convention-succession-by-ritual", "index": 6, "type": "convention", "label": "Sect succession decided by ritual challenge, not bloodline", "detail": "Cultural default since the founding compact: leadership transfers through formal challenge, with ritual outcomes binding. Standing exception: clan branches that have entered the karmic-debt registry are exempt. Enforced by the Five Sects compact."},
    {"id": "attractor-sect-consolidation", "index": 7, "type": "attractor", "label": "Structural consolidation of the Five Sects under a single succession framework", "detail": "Where the machinery pulls: economic pressure (essence depletion) + demographic pressure (recruit shortage) + the compact's interpretation politics all gravitate toward unified succession. What would deflect: a successful counter-mandate framework that lets sects survive without consolidating."},
    {"id": "pattern-foreknowledge-debt-cycle", "index": 8, "type": "pattern", "label": "Genre rule: every act of foreknowledge accrues a karmic debt that must eventually settle", "detail": "Meta-narrative pattern of the xianxia foreknowledge subgenre — the debt always settles, the only question is on what scale. Trickles down to CRG: every Fang Yuan plan that uses prior-life knowledge must include a debt that arc reasoning prices into the chain."}
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
