/**
 * Preference-driven prompt blocks: force preference, network bias, and the
 * coordination-plan node-count guidance. All emit prompt text based on
 * setting inputs; none do any LLM calls.
 */

import type { ForcePreference } from "@/lib/ai/reasoning-graph/shared";

// ── Plan Node Scaling ─────────────────────────────────────────────────────────
// Coordination plans scale node counts based on arc budget to ensure proper
// reasoning depth. The structural spine is peaks + valleys + moments; every
// arc has exactly one peak OR one valley as its anchor (carrying arcIndex,
// sceneCount, forceMode), and moments are supporting beats.

/**
 * Calculate expected node counts for a coordination plan based on arc budget.
 * Returns guidance for minimum nodes per category.
 * Emphasizes DEPTH (chains of reasoning) not just BREADTH (many disconnected nodes).
 */
export function getPlanNodeGuidance(
  arcTarget: number,
  threadCount: number,
  scale: number = 1,
): {
  minSpineNodes: number;
  minReasoningNodes: number;
  minPatterns: number;
  minWarnings: number;
  minChaos: number;
  minCharacterNodes: number;
  minLocationNodes: number;
  minArtifactNodes: number;
  minSystemNodes: number;
  minChainDepth: number;
  minEdges: number;
  totalMin: number;
} {
  const s = (n: number) => Math.max(1, Math.round(n * scale));

  // A coordination plan orchestrates the whole story — it needs wide AND
  // deep reasoning. Per-arc plans can be tighter; plans cannot.

  // Spine nodes (peaks + valleys + moments). Every arc contributes one
  // anchor (peak or valley) PLUS supporting moments. Threads each need
  // multiple spine nodes to show progression (seeded → escalating → peak).
  // 2.5 × arcTarget + threadCount dominates the simpler 2 × arcTarget
  // at every arc count; keep only the winner.
  const minSpineNodes = s(Math.floor(arcTarget * 2.5) + threadCount);

  // Reasoning backbone — branched, not chained. Each arc needs 3 reasoning
  // nodes, plus 2 per thread for causal cross-arc chains. Floor of 10 so
  // tiny plans still carry a real reasoning backbone.
  const minReasoningNodes = s(
    Math.max(10, arcTarget * 3 + Math.floor(threadCount * 2)),
  );

  // Patterns and warnings — creative agents
  const minPatterns = s(Math.max(2, Math.floor(arcTarget / 2)));
  const minWarnings = s(Math.max(2, Math.floor(arcTarget / 2)));

  // Chaos — baseline 1-2 per plan even when balanced; more under chaos preference
  // (the preference block bumps this further in the prompt itself).
  const minChaos = s(Math.max(1, Math.floor(arcTarget / 4)));

  // Entity grounding — MUST appear (plans without entities are abstract).
  // Character count leans generous so secondary characters get their own
  // causal reasoning, not just protagonist-adjacent appearances.
  const minCharacterNodes = s(Math.max(4, threadCount));
  // Locations scale with arc count — an 8-arc plan with 2 locations is a
  // claustrophobic world. ceil(arcTarget/2) gives 3 for small plans and
  // scales cleanly upward.
  const minLocationNodes = s(Math.max(3, Math.ceil(arcTarget / 2)));
  const minArtifactNodes = s(Math.max(1, Math.floor(arcTarget / 3)));
  // Systems anchor the world's rules. Minimum of 3 so even short plans
  // surface core mechanics; scales with arc count for longer stories.
  const minSystemNodes = s(Math.max(3, Math.floor(arcTarget / 2)));

  // Chain depth — minimum reasoning steps between spine nodes (through
  // converging reasoning, not a single chain)
  const minChainDepth = s(Math.max(3, Math.floor(arcTarget / 2)));

  const totalMin =
    minSpineNodes +
    minReasoningNodes +
    minPatterns +
    minWarnings +
    minChaos +
    minCharacterNodes +
    minLocationNodes +
    minArtifactNodes +
    minSystemNodes;

  // Enforce edge density — a branched graph has ~1.6× more edges than nodes
  const minEdges = Math.round(totalMin * 1.6);

  return {
    minSpineNodes,
    minReasoningNodes,
    minPatterns,
    minWarnings,
    minChaos,
    minCharacterNodes,
    minLocationNodes,
    minArtifactNodes,
    minSystemNodes,
    minChainDepth,
    minEdges,
    totalMin,
  };
}

/**
 * Build a force-preference guidance block for the prompt. Freeform (or
 * undefined) yields the narrative-quality-first block with no force bias.
 *
 * The block is written from the perspective of either a per-arc reasoning
 * graph ("arc") or the multi-arc coordination plan ("plan"), since the
 * same preferences mean slightly different things at each level.
 */
export function forcePreferenceBlock(
  scope: "arc" | "plan",
  pref: ForcePreference | undefined,
): string {
  const scopeNoun = scope === "plan" ? "PLAN" : "ARC";
  const scopeLower = scopeNoun.toLowerCase();
  const unit = scope === "plan" ? "plan's arcs" : "arc's scenes";

  const model = `
### MODEL

The reasoning graph is the AUTHOR's meta-reasoning about the work — the writer, analyst, or researcher thinking about what they're building. (This is why the framework works in fiction and non-fiction alike: in both, the reasoner is outside the system they're constructing.) The graph is a **cause-and-effect structure**: upstream nodes cause, downstream nodes are effect. Direction is the primary semantic signal — the same two nodes in opposite causal positions assert opposite claims.

Three structural forces run through the work:

- **FATE** — the work's current momentum, pushing its existing agenda toward what the threads demand. The default operating system: what's in motion continues, what's promised gets paid off.
- **WORLD** — character, location, artifact change. Entities deepen, bonds shift, things accrue history.
- **SYSTEM** — the rules and principles constraining fate and world.

**CHAOS is the BLACK-SWAN force** — the departure from what the current agenda and market state predict. It has two legitimate modes, either or both of which can drive a chaos node:

- **Creative chaos** spawns new pieces on the board the existing state wouldn't have generated — an unforeseen rival arrives, a faction nobody modelled declares itself, an artefact surfaces whose utility is disruption, a location reveals a property no one had looked for. These are creations that didn't exist in the prior.
- **Reversal chaos** flips a saturating or committed market against its current lean — a twist-grade event (|e| ≥ 3 on the lagging outcome) that re-prices what looked settled. A trusted advisor revealed as the assassin; a failing rebellion turning on a single defection; a phantom "succeeds without cost" outcome collapsing into debt-collected.

Either mode satisfies the test: **could it have been in the rulebook before this moment?** If yes, it's an adversarial *system* node (a loophole always in the mechanics). If no, it's chaos. A good chaos node often does both — the new piece IS the reversal event. Name what it creates OR what it flips (ideally both) concretely; "something surprising happens" without a target is adversarial vapour, not chaos. Chaos is where the current market state gets unsettled, because a 95/5 distribution is only useful if the reasoner has flagged what the 5% looks like — and the 5% may be a new agent nobody priced, an existing agent's hidden capability, or the bill coming due.

**CHAOS IS AN EVER-PRESENT FORCE, not a mode-exclusive one.** It is the fundamental opposition to fate's probabilities — the pressure that asks "what if this doesn't play out the way the threads predict?" Every reasoning graph, in every mode, should carry SOME degree of chaos. The intensity varies: a quiet minority voice in fate/world/system modes (1-2 chaos nodes that create friction against the smooth trajectory); a structural force in chaos mode (where black-swan creation and market reversal become the organising principle). But never zero. A graph with no chaos is a graph over-fitted to the current agenda — narratively dead, because a fully-predictable story is not a good story. Life is unpredictable; the reader knows it; the graph must carry at least the texture of that unpredictability. Chaos is what makes the journey worth reading — without it, every thread resolves the way its logit leans and the market is a formality.

### FIVE CAUSAL PATTERNS

Different patterns mean different things. Read the direction, then read what it's saying.

- **Default — reason→fate**: \`reasoning/system/character\` causes \`fate\`. Deliberation advances the agenda.
- **Chaos as cause**: \`chaos\` causes \`reasoning/character/system\`. A disruption forces adaptation; downstream is the reaction.
- **Chaos chain**: \`chaos → chaos → chaos\`. One disruption spawns the next (troll arrives → cast scatters → Hermione alone). Chaos develops its own internal causality.
- **Subversion — fate→chaos**: the agenda inadvertently produces its own disruption. Harry's pride drives him to confront Quirrell alone → the overreach creates the worst-case reveal. Fate authored the chaos it now has to face. This is one of the most productive patterns in research-type reasoning.
- **Adaptation — chaos→(reasoning/character)→fate**: the work absorbs a disruption into a new or subverted thread. Note the intermediate step: chaos doesn't directly service an existing thread; the adaptation does, and the downstream fate node usually reflects a subverted transition rather than the resolution fate had been pushing for.

Cross-direction edges are how subversions and adaptations work. Don't ban them; be deliberate — every cross-direction edge asserts one of these patterns.

### WHAT DIFFERS BY MODE

A fate-dominant graph leans into the agenda; a chaos-dominant graph leans into adversarial reasoning; a world- or system-dominant graph leans into expanding those layers. **Every mode can create** — new characters, locations, artifacts, threads — but the flavor of creation serves the mode's master:

- **Fate** creates things that extend the agenda (destined figures, prophesied artifacts, hidden threads surfacing).
- **World** creates things that grow from existing entities (offspring, apprentices, a newly-discovered chamber, an artefact forged by a character).
- **System** creates things that extend the rules (new principles following from established ones, new institutions consistent with the world's logic).
- **Chaos** creates pieces that the current agenda wouldn't have generated AND/OR events that flip a market's lean — intruders nobody modelled, adversaries whose arrival inverts an alliance thread, disruptive artefacts that break a saturating "succeeds" outcome, hidden capabilities surfacing on known characters.

Creations are real — they become part of the work once the graph is executed. When the logic wants a new piece on the board, add it; match the creation to the mode.

### BAD GRAPH SIGNALS

A graph is failing when: reasoning nodes don't connect to anchors (disconnected components); the dominant force has fewer nodes than its complement combined; **zero chaos nodes anywhere** (the graph is over-fitted to the current agenda — every mode should carry at least minority-level chaos); chaos nodes only have incoming \`requires\` edges (chaos being serviced, not driving); a "subversion" claims fate→chaos but the upstream fate is contrived rather than the real agenda; cross-direction edges only flow one way in balanced mode (no real tension); system nodes have no outgoing edges (lore dumps); new entities lack an edge rooting them into existing context (drop-ins). Bad graphs aren't less detailed — they're structurally misrepresenting what the reasoning is claiming.
`;

  // Freeform: narrative quality first. No force bias — the LLM picks
  // whatever node mix the story actually needs. This is the default.
  if (!pref || pref === "freeform") {
    return `
## FORCE PREFERENCE: FREEFORM ${scopeNoun}

**Master:** the narrative itself — quality of the ${scopeLower} is the only bias.
**Flavor of reasoning:** adaptive, situational, unopinionated. Picks whatever the story earns, beat by beat.
${model}
### NARRATIVE-QUALITY-FIRST

**Freeform has no master beyond the story itself.** There is no force bias here: not fate, not chaos, not any structural force. The only question is "what would make this ${scopeLower} best?" — and the answer comes from the prose, not from a preference. Pick the node mix that serves the narrative.

Full toolbox:

- **fate** — a thread advancing; references an existing threadId and its target status.
- **character / location / artifact** — an existing entity whose world graph grows this ${scopeLower}; references an entityId.
- **system** — a rule or principle; reuse existing SYS-XX ids where possible, or introduce a new rule that connects to one.
- **chaos** — a black-swan departure from the current agenda: either spawns a new piece nobody modelled (creative) or flips a saturating/committed market against its lean (reversal). A single chaos node may do both — e.g. a new rival arriving IS the event that flips the threat market. Use when the story earns an unpriced move, not to hit a ratio.
- **reasoning** — an explicit logical step linking other nodes.
- **pattern / warning** — positive patterns to reinforce, anti-patterns to avoid.

**A good mixture matters for coherent reasoning.** A graph that's all one type reads as thin: all-fate lacks grounding, all-character lacks momentum, all-system lacks consequence, all-chaos lacks stakes. Aim for a reasoning chain where forces CAUSE each other — a system rule ENABLES a character choice that ADVANCES a fate thread; a chaos event REVEALS a character's hidden side that RECASTS a thread. The mix isn't a quota; it's what makes the graph tell a story rather than list facts.

What matters: every node earns its place via an edge, and the composition reflects what the ${scopeLower} genuinely is — not what any preference says it should be.
`;
  }

  if (pref === "fate") {
    return `
## FORCE PREFERENCE: FATE-DOMINANT ${scopeNoun}

**Master:** fate, amplified. This mode **expands the fate layer** of the universe.
**Flavor of reasoning:** inevitability, momentum, gravitational pull. Beats feel like they had to happen. The reader senses the agenda closing in.
${model}
### WHAT FATE DOMINANCE MEANS HERE

The ${scopeLower} is where fate's momentum is amplified — threads escalate, promises resolve, hidden pieces surface to be answered. Chaos is minimal; the agenda pushes through.

**Fate should dominate — it makes up many of the nodes and clearly out-numbers every other force.** If character, system, or chaos counts approach fate's, the preference isn't being honoured. This is the mode for **expanding the fate layer of the universe** — tightening the web of threads, concentrating momentum, letting the current agenda carry the ${scopeLower}.

- Read the active thread list and each thread's recent log entries. Every fate node must reference an existing threadId and the exact targetStatus it advances toward.
- Favour threads already at \`escalating\` or \`critical\` — these have the strongest momentum to convert.
- **Fate is creative.** A destined arrival, a long-promised revelation, a prophesied figure, a hidden artefact surfacing — fate spawns new entities that extend its agenda. The new piece arrives TO advance what's already in motion; its existence rhymes with the momentum that was already there. Every fate-dominant ${scopeLower} should be willing to introduce new entities when the agenda calls for them.
- Peak and valley anchors should BE thread transitions: a peak is a critical→resolved moment on a load-bearing thread; a valley is an escalating pulse that refuses to break.

**Adversarial reasoning is minority, not absent** — keep 1-2 chaos nodes that stress-test fate's agenda, puncturing the smooth journey without redirecting it. Fate dominance doesn't mean chaos vanishes; it means chaos is a quiet minority voice next to the lead. A fate-dominant graph with zero chaos reads as programmatic — the agenda executing itself without friction.

**Other structural forces in support**:
- character as thread-carriers serving fate — the people whose choices move the thread.
- system for the constraints that make the journey hard (and the resolution meaningful).
- reasoning/pattern/warning as the connective tissue.

The ${unit} should feel like inevitability unfolding — fate pushing its agenda through the ${scopeLower}.
`;
  }
  if (pref === "world") {
    return `
## FORCE PREFERENCE: WORLD-DOMINANT ${scopeNoun}

**Master:** world (character / location / artifact transformation). This mode **expands the world layer** of the universe.
**Flavor of reasoning:** intimate, transformative, grounded. Beats feel like people and places becoming something new — the reader grows closer to the cast.
${model}
### WHAT WORLD DOMINANCE MEANS HERE

The ${scopeLower} is focused on the world layer: existing entities transforming AND new entities emerging organically from the existing cast/map. Inner change, shifting bonds, places accruing meaning, objects gaining history, new life taking root where the old has made room for it. Fate still operates underneath (it's the OS), but the ${scopeLower}'s spotlight is on the world layer.

**World should dominate — character, location, and artifact nodes make up many of the nodes and clearly out-number every other force.** If fate, system, or chaos counts approach world's, the preference isn't being honoured.

- For each world node, either (a) reference an existing entityId and identify which of its existing world graph nodes this beat extends or contradicts, or (b) INTRODUCE a new entity that grows from what's there — a child or apprentice of an existing character, a newly-discovered chamber in a known stronghold, an artefact a character has forged, a location a journey has uncovered. New entities are welcome when the reasoning earns them; they should rhyme with the existing world rather than drop in from nowhere (that would be chaos).
- Favour entities with rich existing world graphs — more material to riff on for the deepening path. A thin-graph entity is best anchored when the beat is the one where its graph substantially grows.
- Relationship deltas, POV-character world deltas, and location-tied transformations are the core currency.

**Entity arcs usually serve fate's agenda** (the character changes in a way that advances an existing thread) — this is the default because fate is the OS. But SOME entity arcs in this ${scopeLower} can be chaos-touched: a character's growth goes against the grain, a location takes on a disruptive new meaning, an artifact reveals an unsettling property. That contrast keeps the ${scopeLower} from reading as programmatic.

**Other forces in support**:
- fate as consequence of character change — the thread moves BECAUSE someone changed.
- system for the constraints that force the change.
- chaos sparingly when an outside event is the catalyst for the entity's shift.
- reasoning/pattern/warning as the connective tissue.

The ${unit} should deepen what already exists AND grow new things organically from it — world is the layer being expanded.
`;
  }
  if (pref === "system") {
    return `
## FORCE PREFERENCE: SYSTEM-DOMINANT ${scopeNoun}

**Master:** system (rules, principles, mechanics). This mode **expands the system layer** of the universe.
**Flavor of reasoning:** lawful, consequential, testing. Beats feel like the world's rules asserting themselves — the reader learns how reality works as the cast does.
${model}
### WHAT SYSTEM DOMINANCE MEANS HERE

The ${scopeLower} is focused on rules, constraints, principles, mechanics — both surfacing existing rules AND extending them with new principles, institutions, or domains that follow from what's already established. Fate still operates underneath; system is the layer being expanded.

**System should dominate — it makes up many of the nodes and clearly out-numbers every other force.** If character, fate, or chaos counts approach system's, the preference isn't being honoured.

- Each system node does one of: (a) REUSES an existing system concept id (cite it by SYS-XX) and extends it with a new edge or implication; (b) introduces a genuinely new rule that connects to at least one existing concept; or (c) INTRODUCES a new institution, faction, or domain that extends the world's rule-layer (a legal structure, a craft, a governing body, a named principle). New rules and institutions are welcome when the reasoning earns them — system mode grows the rules layer, not just surfaces it. Free-floating lore dumps disconnected from the existing graph are a failure mode.
- Downstream nodes (fate, character, chaos, reasoning) should DEPEND on system nodes — the \`requires\` / \`enables\` / \`constrains\` edges should point from system to consequences. If a system node has no outgoing edge, it wasn't used.
- Read the existing cumulative system graph first; the ${scopeLower} should test, stress, or exploit principles already established as a foundation for any new ones.

**Rules primarily enable fate's agenda** (the system makes the existing threads' progression possible) — but a good system-dominant ${scopeLower} also shows **rules creating cracks chaos can slip through**: a loophole, an unintended consequence, a limit that cuts both ways. When rules only enable one side, the system layer reads as rigged.

**Other forces in support**:
- character as system-testers — the cast discovering what the rules mean.
- fate as system-driven consequence — the thread moves BECAUSE the rule said so.
- chaos as system-driven consequence — an event the rules permitted but didn't foresee.
- reasoning/pattern/warning as the connective tissue.

The ${unit} should surface, test, AND extend the mechanics — the reader learns the world's rules and watches new ones emerge as deductive growth.
`;
  }
  if (pref === "chaos") {
    return `
## FORCE PREFERENCE: CHAOS-DOMINANT ${scopeNoun}

**Master:** chaos — black-swan reasoning takes the lead. This ${scopeLower} is where the agenda meets what it didn't plan for: new pieces nobody modelled, or market leans nobody expected to flip.
**Flavor of reasoning:** red-team / devil's-advocate, but disciplined — every beat either introduces a departure the current state wouldn't have generated, or flips a saturating market via a twist-grade event. The output is a portfolio of unpriced moves, not generalised disruption.
${model}
### WHAT CHAOS DOMINANCE MEANS HERE

Chaos-dominant reasoning runs in two registers, typically mixed:

- **Creative black swans** introduce pieces the current agenda didn't predict — a new rival, a faction nobody modelled, a location revealing properties no one had looked for, an artefact whose utility is disruption. The creation itself is the unpriced move.
- **Reversal black swans** flip saturating or committed markets via twist-grade events. A trusted advisor revealed as the assassin, a hidden capability surfacing on a known character, a phantom "succeeds without cost" outcome collapsing into debt-collected. No new entity required; the reversal is the event.

A single chaos node may be both — a new rival arriving IS the event that flips the threat thread. Mix them as the narrative earns.

**Chaos should dominate — it makes up many of the nodes and clearly out-numbers every other force.** If fate, character, or system counts approach chaos's, the preference isn't being honoured.

**Target saturating markets when you're flipping.** Reversal chaos has the most information-value where the market is confident: a flip on a p=0.90 leader re-prices far more than a flip on a contested 55/45 market. Scan the portfolio for: saturating threads (near-closed margin, p ≥ 0.85), committed threads (p ≥ 0.65 with low volatility), and any thread whose "succeeds without cost / undetected / free" outcome is leading — those are phantom-saturation candidates ripe for reversal.

**Each chaos node must be legible.** Its label and detail should make clear at least one of:
  - CREATIVE mode: what is being introduced that the prior state wouldn't have generated, and which market(s) the new piece perturbs.
  - REVERSAL mode: the target market, its current leader, the event that flips it, and the lagging outcome the event re-prices toward.
Absent a legible creative addition OR a legible reversal thesis, the node is adversarial vapour.

**Black swan ≠ deus ex machina.** Chaos events are surprising TO THE MARKET but CONSISTENT WITH the world's rules and the story's buried setup. A troll in the dungeon is a chaos event (not in the rulebook, but the school's security has buried cracks); Dumbledore appearing to save the day is deus ex machina (contradicts the thread's stakes). Chaos subverts expectations; deus ex machina cheats them.

**Chaos is the primary CAUSE in this mode** — most chaos nodes sit upstream, driving downstream adaptation. Chaos→chaos chaining is a core pattern (one black swan re-prices several markets in sequence; cascade strength should match the driving quality).

**Fate appears in two ways**: (a) downstream as threads chaos is actively re-pricing or newly opening (subverted status, or a brand-new thread the creative chaos instantiated); (b) **upstream as the subversion pattern** — the agenda's overreach priming its own reversal (Harry's pride → confronts Quirrell alone → the reveal that flips the "evades detection" market). Self-induced black swans are among the most productive patterns: fate authoring the chaos that re-prices it.

**Other nodes in support**:
- character nodes used adversarially — "what hidden capability would re-price the rival thread?", "whose betrayal would flip the alliance market?"
- system nodes as loopholes that enabled the black swan — rules whose edge cases make the creation or reversal mechanically legal.
- reasoning / pattern / warning as connective tissue linking the event to the markets it perturbs.

**Dominance check**: chaos is the majority; chaos nodes sit upstream driving the reasoning; each chaos node names what it creates, what it flips, or both; fate nodes appear either as downstream effects of chaos (flipped leans, newly-opened threads) or as upstream overreach causes that PROVOKED chaos — not as the beneficiary of chaos's output.

**Behaviour in this ${scopeLower}**:
${scope === "plan"
  ? "- Expect several chaos-dominant arcs across the plan (HP's troll arc, HP's Norbert arc). Roughly 25-40% of arcs should be anchored on chaos.\n- Seed 5-10 chaos nodes across the plan. Mix creative (new pieces) and reversal (flipped markets); a plan that only creates or only reverses is thin.\n- Chaos-dominant arcs should leave the plan's portfolio MORE uncertain after they resolve: new threads open (creative), or saturating markets either close decisively (payoff) or flip (twist). A chaos arc that neither creates nor re-prices is decorative and should be cut."
  : "- Build the arc around 3-5 chaos nodes rather than the default 1-2.\n- The arc's peak or valley may itself be chaos-anchored (its prime mover is a black-swan event or creation outside the current agenda).\n- The chaos nodes collectively should either add a new piece the cast must adapt to, or identify at least one saturating market ready for reversal — ideally both. The arc's job is the twist the market wouldn't have reached on its own."}
`;
  }
  return "";
}

/**
 * Build a network-bias guidance block. The annotation legend and NETWORK
 * STATE summary are already rendered above AVAILABLE ENTITIES, so this
 * block only adds the per-mode preference — no need to restate what the
 * tags mean. Returns "" for neutral so the default behaviour costs no
 * tokens.
 */
export function networkBiasBlock(bias: "inside" | "outside" | "neutral" | undefined): string {
  if (!bias || bias === "neutral") return "";
  if (bias === "inside") {
    return `
### NETWORK BIAS — INSIDE THE BOX (conventional)

Lean into the gravitational centres. The {hot, rising, bridge} cohort is load-bearing — compound it. The {warm, hub} cohort is consistent material — deepen it.

- Anchor selections in nodes whose tier is hot or warm AND trajectory is rising or steady — these are what the story is currently building.
- Prefer bridges (cross-force connectors) over leaves; bridges already carry weight across cohorts and reusing them tightens the network.
- {cooling} nodes are candidates for revival when their force-anchor matches what this arc needs; {plateaued} nodes need a fresh angle to earn a return.
- Reach for {cold, dormant, isolated} only when the arc structurally requires them.
- Reusing what already matters is NOT laziness — it's how a story compounds. The cold cohort can wait.
`;
  }
  // outside
  return `
### NETWORK BIAS — OUTSIDE THE BOX (unique with respect to current pattern)

Reactivate the neglected matter. Two cohorts deserve attention here:

1. **{fresh, rising}** — recently planted nodes that haven't compounded yet. Picking them up turns seeds into structure.
2. **{cold, dormant}** with a force-anchor — long-dormant nodes that already sit on a known force axis. They're easier to integrate than starting from nothing.

- Prefer cold or fresh nodes for character / location / artifact / thread / system selections — the long-dormant cast, recently-spawned matter, and unused rules.
- {leaf} nodes are easy entry points; {isolated} nodes need a bridge built to them through this arc.
- {hot} entities are allowed when structurally unavoidable but should NOT be the anchor of the reasoning. If the arc can be told without them, prefer that path.
- The goal is not contrarianism — it's reactivating what the network has neglected so the story doesn't collapse into a monoculture of its most-used pieces.
`;
}
