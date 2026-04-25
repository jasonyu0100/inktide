/**
 * Preference-driven prompt blocks: force preference, network bias, and the
 * coordination-plan node-count guidance. All emit prompt text based on
 * setting inputs; none do any LLM calls.
 */

import type { ForcePreference } from "@/lib/ai/reasoning-graph/shared";
import { PROMPT_PORTFOLIO_PRINCIPLES } from "../core/market-calibration";

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
  <model>
    <author-meta-reasoning>The graph is the AUTHOR's meta-reasoning about the work (writer/analyst/researcher thinking about what they're building — applies to fiction and non-fiction alike). Cause-and-effect structure: upstream causes, downstream effects. Direction is the primary semantic signal — opposite causal positions assert opposite claims.</author-meta-reasoning>

    <structural-forces hint="Three forces run through the work.">
      <force name="fate">Current momentum — what the threads demand. Default OS: what's in motion continues, what's promised pays off.</force>
      <force name="world">Character, location, artifact change. Entities deepen, bonds shift, things accrue history.</force>
      <force name="system">Rules and principles that constrain fate and world.</force>
    </structural-forces>

    <chaos-as-black-swan hint="Departure from what current state predicts. Two modes, either or both can drive a chaos node.">
      <mode name="creative">Spawns new pieces the existing state wouldn't have generated — unforeseen rival, faction nobody modelled, disruptive artefact, location's hidden property.</mode>
      <mode name="reversal">Flips a saturating/committed market via a twist-grade event (|e| ≥ 3 on the lagging outcome) — trusted advisor revealed as assassin, "succeeds without cost" outcome collapsing into debt-collected.</mode>
      <test>Could it have been in the rulebook before this moment? Yes → adversarial system node (loophole). No → chaos. A good chaos node often does both — the new piece IS the reversal event. Name what it creates OR flips concretely; "something surprising" without a target is vapour.</test>
      <ever-present>Required at minority level (1-2 nodes) in every mode, structural in chaos mode. Never zero — zero-chaos graphs are over-fitted to the current agenda and read as narratively dead.</ever-present>
    </chaos-as-black-swan>

    <fate-as-portfolio hint="The CRG is where market quality is decided — by the time scenes are written, the hand is already dealt.">
      <claim>Fate nodes ARE the arc's market portfolio. A defensive, all-distal, all-protagonist-centric, or cost-missing portfolio produces an inert arc no matter how well scenes execute.</claim>
      <directive>Audit the portfolio against the principles below. If it fails, the fix is new fate nodes (open markets, force opposition, retire zombies) — not better execution.</directive>
      ${PROMPT_PORTFOLIO_PRINCIPLES}
    </fate-as-portfolio>

    <causal-patterns hint="Cross-direction edges encode which pattern is being asserted.">
      <pattern name="default" shape="reason→fate">Deliberation advances the agenda.</pattern>
      <pattern name="chaos-as-cause" shape="chaos→reasoning">Disruption forces adaptation; downstream is the reaction.</pattern>
      <pattern name="chaos-chain" shape="chaos→chaos→chaos">One disruption spawns the next (troll arrives → cast scatters → Hermione alone).</pattern>
      <pattern name="subversion" shape="fate→chaos">The agenda inadvertently produces its own disruption (Harry's pride → confronts Quirrell alone → reveal). Highly productive.</pattern>
      <pattern name="adaptation" shape="chaos→reasoning/character→fate">Work absorbs a disruption into a new or subverted thread. Downstream fate is usually a subverted transition, not fate's intended resolution.</pattern>
      <note>Don't ban cross-direction edges — be deliberate.</note>
    </causal-patterns>

    <what-differs-by-mode hint="Every mode can create new entities; the flavor matches the master.">
      <flavor mode="fate">Creations extend the agenda (destined figures, prophesied artifacts, hidden threads surfacing).</flavor>
      <flavor mode="world">Creations grow from existing entities (offspring, apprentices, a newly-discovered chamber).</flavor>
      <flavor mode="system">Creations extend the rules (new principles consistent with established ones, institutions following the world's logic).</flavor>
      <flavor mode="chaos">Creative or reversal — see chaos-as-black-swan above.</flavor>
      <reality>Creations are real once the graph executes. Match the creation to the mode.</reality>
    </what-differs-by-mode>

    <bad-graph-signals>Failing graph: disconnected components (reasoning nodes not connecting to anchors); dominant force out-numbered by its complement; zero chaos anywhere; chaos with only incoming \`requires\` edges (serviced, not driving); a "subversion" whose upstream fate is contrived; cross-direction edges flowing one way in balanced mode; system nodes with no outgoing edges (lore dumps); new entities un-rooted in existing context (drop-ins).</bad-graph-signals>
  </model>`;

  // Freeform: narrative quality first. No force bias — the LLM picks
  // whatever node mix the story actually needs. This is the default.
  if (!pref || pref === "freeform") {
    return `<force-preference name="freeform" scope="${scopeLower}">
  <master>The narrative itself — quality of the ${scopeLower} is the only bias.</master>
  <flavor>Adaptive, situational, unopinionated. Picks whatever the story earns, beat by beat.</flavor>
${model}
  <narrative-quality-first>
    <principle>Freeform has no master beyond the story itself. There is no force bias here: not fate, not chaos, not any structural force. The only question is "what would make this ${scopeLower} best?" — and the answer comes from the prose, not from a preference. Pick the node mix that serves the narrative.</principle>
    <toolbox hint="Full toolbox available.">
      <tool name="fate">A thread advancing; references an existing threadId and its target status.</tool>
      <tool name="character/location/artifact">An existing entity whose world graph grows this ${scopeLower}; references an entityId.</tool>
      <tool name="system">A rule or principle; reuse existing SYS-XX ids where possible, or introduce a new rule that connects to one.</tool>
      <tool name="chaos">A black-swan departure from the current agenda: either spawns a new piece nobody modelled (creative) or flips a saturating/committed market against its lean (reversal). A single chaos node may do both — e.g. a new rival arriving IS the event that flips the threat market. Use when the story earns an unpriced move, not to hit a ratio.</tool>
      <tool name="reasoning">An explicit logical step linking other nodes.</tool>
      <tool name="pattern/warning">Positive patterns to reinforce, anti-patterns to avoid.</tool>
    </toolbox>
    <good-mixture>A graph that's all one type reads as thin: all-fate lacks grounding, all-character lacks momentum, all-system lacks consequence, all-chaos lacks stakes. Aim for a reasoning chain where forces CAUSE each other — a system rule ENABLES a character choice that ADVANCES a fate thread; a chaos event REVEALS a character's hidden side that RECASTS a thread. The mix isn't a quota; it's what makes the graph tell a story rather than list facts.</good-mixture>
    <gate>What matters: every node earns its place via an edge, and the composition reflects what the ${scopeLower} genuinely is — not what any preference says it should be.</gate>
  </narrative-quality-first>
</force-preference>`;
  }

  if (pref === "fate") {
    return `<force-preference name="fate-dominant" scope="${scopeLower}">
  <master>Fate, amplified. This mode expands the fate layer of the universe.</master>
  <flavor>Inevitability, momentum, gravitational pull. Beats feel like they had to happen. The reader senses the agenda closing in.</flavor>
${model}
  <what-fate-dominance-means>
    <claim>The ${scopeLower} is where fate's momentum is amplified — threads escalate, promises resolve, hidden pieces surface to be answered. Chaos is minimal; the agenda pushes through.</claim>
    <dominance>Fate should dominate — it makes up many of the nodes and clearly out-numbers every other force. If character, system, or chaos counts approach fate's, the preference isn't being honoured. This is the mode for expanding the fate layer of the universe — tightening the web of threads, concentrating momentum, letting the current agenda carry the ${scopeLower}.</dominance>
    <directive>
      <rule>Read the active thread list and each thread's recent log entries. Every fate node must reference an existing threadId and the exact targetStatus it advances toward.</rule>
      <rule>Favour threads already at \`escalating\` or \`critical\` — these have the strongest momentum to convert.</rule>
      <rule>Fate is creative. A destined arrival, a long-promised revelation, a prophesied figure, a hidden artefact surfacing — fate spawns new entities that extend its agenda. The new piece arrives TO advance what's already in motion; its existence rhymes with the momentum that was already there. Every fate-dominant ${scopeLower} should be willing to introduce new entities when the agenda calls for them.</rule>
      <rule>Peak and valley anchors should BE thread transitions: a peak is a critical→resolved moment on a load-bearing thread; a valley is an escalating pulse that refuses to break.</rule>
    </directive>
    <chaos-minority>Adversarial reasoning is minority, not absent — keep 1-2 chaos nodes that stress-test fate's agenda, puncturing the smooth journey without redirecting it. Fate dominance doesn't mean chaos vanishes; it means chaos is a quiet minority voice next to the lead. A fate-dominant graph with zero chaos reads as programmatic — the agenda executing itself without friction.</chaos-minority>
    <support-forces>
      <force name="character">Thread-carriers serving fate — the people whose choices move the thread.</force>
      <force name="system">The constraints that make the journey hard (and the resolution meaningful).</force>
      <force name="reasoning-pattern-warning">Connective tissue.</force>
    </support-forces>
    <vibe>The ${unit} should feel like inevitability unfolding — fate pushing its agenda through the ${scopeLower}.</vibe>
  </what-fate-dominance-means>
</force-preference>`;
  }
  if (pref === "world") {
    return `<force-preference name="world-dominant" scope="${scopeLower}">
  <master>World (character / location / artifact transformation). This mode expands the world layer of the universe.</master>
  <flavor>Intimate, transformative, grounded. Beats feel like people and places becoming something new — the reader grows closer to the cast.</flavor>
${model}
  <what-world-dominance-means>
    <claim>The ${scopeLower} is focused on the world layer: existing entities transforming AND new entities emerging organically from the existing cast/map. Inner change, shifting bonds, places accruing meaning, objects gaining history, new life taking root where the old has made room for it. Fate still operates underneath (it's the OS), but the ${scopeLower}'s spotlight is on the world layer.</claim>
    <dominance>World should dominate — character, location, and artifact nodes make up many of the nodes and clearly out-number every other force. If fate, system, or chaos counts approach world's, the preference isn't being honoured.</dominance>
    <directive>
      <rule>For each world node, either (a) reference an existing entityId and identify which of its existing world graph nodes this beat extends or contradicts, or (b) INTRODUCE a new entity that grows from what's there — a child or apprentice of an existing character, a newly-discovered chamber in a known stronghold, an artefact a character has forged, a location a journey has uncovered. New entities are welcome when the reasoning earns them; they should rhyme with the existing world rather than drop in from nowhere (that would be chaos).</rule>
      <rule>Favour entities with rich existing world graphs — more material to riff on for the deepening path. A thin-graph entity is best anchored when the beat is the one where its graph substantially grows.</rule>
      <rule>Relationship deltas, POV-character world deltas, and location-tied transformations are the core currency.</rule>
    </directive>
    <chaos-touch>Entity arcs usually serve fate's agenda (the character changes in a way that advances an existing thread) — this is the default because fate is the OS. But SOME entity arcs in this ${scopeLower} can be chaos-touched: a character's growth goes against the grain, a location takes on a disruptive new meaning, an artifact reveals an unsettling property. That contrast keeps the ${scopeLower} from reading as programmatic.</chaos-touch>
    <support-forces>
      <force name="fate">Consequence of character change — the thread moves BECAUSE someone changed.</force>
      <force name="system">The constraints that force the change.</force>
      <force name="chaos">Sparingly when an outside event is the catalyst for the entity's shift.</force>
      <force name="reasoning-pattern-warning">Connective tissue.</force>
    </support-forces>
    <vibe>The ${unit} should deepen what already exists AND grow new things organically from it — world is the layer being expanded.</vibe>
  </what-world-dominance-means>
</force-preference>`;
  }
  if (pref === "system") {
    return `<force-preference name="system-dominant" scope="${scopeLower}">
  <master>System (rules, principles, mechanics). This mode expands the system layer of the universe.</master>
  <flavor>Lawful, consequential, testing. Beats feel like the world's rules asserting themselves — the reader learns how reality works as the cast does.</flavor>
${model}
  <what-system-dominance-means>
    <claim>The ${scopeLower} is focused on rules, constraints, principles, mechanics — both surfacing existing rules AND extending them with new principles, institutions, or domains that follow from what's already established. Fate still operates underneath; system is the layer being expanded.</claim>
    <dominance>System should dominate — it makes up many of the nodes and clearly out-numbers every other force. If character, fate, or chaos counts approach system's, the preference isn't being honoured.</dominance>
    <directive>
      <rule>Each system node does one of: (a) REUSES an existing system concept id (cite it by SYS-XX) and extends it with a new edge or implication; (b) introduces a genuinely new rule that connects to at least one existing concept; or (c) INTRODUCES a new institution, faction, or domain that extends the world's rule-layer (a legal structure, a craft, a governing body, a named principle). New rules and institutions are welcome when the reasoning earns them — system mode grows the rules layer, not just surfaces it. Free-floating lore dumps disconnected from the existing graph are a failure mode.</rule>
      <rule>Downstream nodes (fate, character, chaos, reasoning) should DEPEND on system nodes — the \`requires\` / \`enables\` / \`constrains\` edges should point from system to consequences. If a system node has no outgoing edge, it wasn't used.</rule>
      <rule>Read the existing cumulative system graph first; the ${scopeLower} should test, stress, or exploit principles already established as a foundation for any new ones.</rule>
    </directive>
    <chaos-cracks>Rules primarily enable fate's agenda (the system makes the existing threads' progression possible) — but a good system-dominant ${scopeLower} also shows rules creating cracks chaos can slip through: a loophole, an unintended consequence, a limit that cuts both ways. When rules only enable one side, the system layer reads as rigged.</chaos-cracks>
    <support-forces>
      <force name="character">System-testers — the cast discovering what the rules mean.</force>
      <force name="fate">System-driven consequence — the thread moves BECAUSE the rule said so.</force>
      <force name="chaos">System-driven consequence — an event the rules permitted but didn't foresee.</force>
      <force name="reasoning-pattern-warning">Connective tissue.</force>
    </support-forces>
    <vibe>The ${unit} should surface, test, AND extend the mechanics — the reader learns the world's rules and watches new ones emerge as deductive growth.</vibe>
  </what-system-dominance-means>
</force-preference>`;
  }
  if (pref === "chaos") {
    return `<force-preference name="chaos-dominant" scope="${scopeLower}">
  <master>Chaos — black-swan reasoning takes the lead. This ${scopeLower} is where the agenda meets what it didn't plan for: new pieces nobody modelled, or market leans nobody expected to flip.</master>
  <flavor>Red-team / devil's-advocate, but disciplined — every beat either introduces a departure the current state wouldn't have generated, or flips a saturating market via a twist-grade event. The output is a portfolio of unpriced moves, not generalised disruption.</flavor>
${model}
  <what-chaos-dominance-means>
    <registers hint="Two registers, typically mixed.">
      <register name="creative-black-swans">Introduce pieces the current agenda didn't predict — a new rival, a faction nobody modelled, a location revealing properties no one had looked for, an artefact whose utility is disruption. The creation itself is the unpriced move.</register>
      <register name="reversal-black-swans">Flip saturating or committed markets via twist-grade events. A trusted advisor revealed as the assassin, a hidden capability surfacing on a known character, a phantom "succeeds without cost" outcome collapsing into debt-collected. No new entity required; the reversal is the event.</register>
      <note>A single chaos node may be both — a new rival arriving IS the event that flips the threat thread. Mix them as the narrative earns.</note>
    </registers>
    <dominance>Chaos should dominate — it makes up many of the nodes and clearly out-numbers every other force. If fate, character, or system counts approach chaos's, the preference isn't being honoured.</dominance>
    <target-saturating-markets>Reversal chaos has the most information-value where the market is confident: a flip on a p=0.90 leader re-prices far more than a flip on a contested 55/45 market. Scan the portfolio for: saturating threads (near-closed margin, p ≥ 0.85), committed threads (p ≥ 0.65 with low volatility), and any thread whose "succeeds without cost / undetected / free" outcome is leading — those are phantom-saturation candidates ripe for reversal.</target-saturating-markets>
    <legibility hint="Each chaos node must be legible.">
      <creative-mode>What is being introduced that the prior state wouldn't have generated, and which market(s) the new piece perturbs.</creative-mode>
      <reversal-mode>The target market, its current leader, the event that flips it, and the lagging outcome the event re-prices toward.</reversal-mode>
      <gate>Absent a legible creative addition OR a legible reversal thesis, the node is adversarial vapour.</gate>
    </legibility>
    <not-deus-ex-machina>Black swan ≠ deus ex machina. Chaos events are surprising TO THE MARKET but CONSISTENT WITH the world's rules and the story's buried setup. A troll in the dungeon is a chaos event (not in the rulebook, but the school's security has buried cracks); Dumbledore appearing to save the day is deus ex machina (contradicts the thread's stakes). Chaos subverts expectations; deus ex machina cheats them.</not-deus-ex-machina>
    <chaos-as-cause>Chaos is the primary CAUSE in this mode — most chaos nodes sit upstream, driving downstream adaptation. Chaos→chaos chaining is a core pattern (one black swan re-prices several markets in sequence; cascade strength should match the driving quality).</chaos-as-cause>
    <fate-roles>
      <role name="downstream">Threads chaos is actively re-pricing or newly opening (subverted status, or a brand-new thread the creative chaos instantiated).</role>
      <role name="upstream-subversion">The agenda's overreach priming its own reversal (Harry's pride → confronts Quirrell alone → the reveal that flips the "evades detection" market). Self-induced black swans are among the most productive patterns: fate authoring the chaos that re-prices it.</role>
    </fate-roles>
    <support-nodes>
      <node name="character">Used adversarially — "what hidden capability would re-price the rival thread?", "whose betrayal would flip the alliance market?"</node>
      <node name="system">Loopholes that enabled the black swan — rules whose edge cases make the creation or reversal mechanically legal.</node>
      <node name="reasoning-pattern-warning">Connective tissue linking the event to the markets it perturbs.</node>
    </support-nodes>
    <dominance-check>Chaos is the majority; chaos nodes sit upstream driving the reasoning; each chaos node names what it creates, what it flips, or both; fate nodes appear either as downstream effects of chaos (flipped leans, newly-opened threads) or as upstream overreach causes that PROVOKED chaos — not as the beneficiary of chaos's output.</dominance-check>
    <behaviour-in-this-${scopeLower}>
${scope === "plan"
  ? `      <rule>Expect several chaos-dominant arcs across the plan (HP's troll arc, HP's Norbert arc). Roughly 25-40% of arcs should be anchored on chaos.</rule>
      <rule>Seed 5-10 chaos nodes across the plan. Mix creative (new pieces) and reversal (flipped markets); a plan that only creates or only reverses is thin.</rule>
      <rule>Chaos-dominant arcs should leave the plan's portfolio MORE uncertain after they resolve: new threads open (creative), or saturating markets either close decisively (payoff) or flip (twist). A chaos arc that neither creates nor re-prices is decorative and should be cut.</rule>`
  : `      <rule>Build the arc around 3-5 chaos nodes rather than the default 1-2.</rule>
      <rule>The arc's peak or valley may itself be chaos-anchored (its prime mover is a black-swan event or creation outside the current agenda).</rule>
      <rule>The chaos nodes collectively should either add a new piece the cast must adapt to, or identify at least one saturating market ready for reversal — ideally both. The arc's job is the twist the market wouldn't have reached on its own.</rule>`}
    </behaviour-in-this-${scopeLower}>
  </what-chaos-dominance-means>
</force-preference>`;
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
    return `<network-bias name="inside-the-box" hint="Conventional — lean into the gravitational centres.">
  <claim>The {hot, rising, bridge} cohort is load-bearing — compound it. The {warm, hub} cohort is consistent material — deepen it.</claim>
  <directive>
    <rule>Anchor selections in nodes whose tier is hot or warm AND trajectory is rising or steady — these are what the story is currently building.</rule>
    <rule>Prefer bridges (cross-force connectors) over leaves; bridges already carry weight across cohorts and reusing them tightens the network.</rule>
    <rule>{cooling} nodes are candidates for revival when their force-anchor matches what this arc needs; {plateaued} nodes need a fresh angle to earn a return.</rule>
    <rule>Reach for {cold, dormant, isolated} only when the arc structurally requires them.</rule>
    <rule>Reusing what already matters is NOT laziness — it's how a story compounds. The cold cohort can wait.</rule>
  </directive>
</network-bias>`;
  }
  // outside
  return `<network-bias name="outside-the-box" hint="Unique with respect to current pattern — reactivate the neglected matter.">
  <cohorts hint="Two cohorts deserve attention here.">
    <cohort name="fresh-rising">Recently planted nodes that haven't compounded yet. Picking them up turns seeds into structure.</cohort>
    <cohort name="cold-dormant-with-anchor">Long-dormant nodes that already sit on a known force axis. They're easier to integrate than starting from nothing.</cohort>
  </cohorts>
  <directive>
    <rule>Prefer cold or fresh nodes for character / location / artifact / thread / system selections — the long-dormant cast, recently-spawned matter, and unused rules.</rule>
    <rule>{leaf} nodes are easy entry points; {isolated} nodes need a bridge built to them through this arc.</rule>
    <rule>{hot} entities are allowed when structurally unavoidable but should NOT be the anchor of the reasoning. If the arc can be told without them, prefer that path.</rule>
    <rule>The goal is not contrarianism — it's reactivating what the network has neglected so the story doesn't collapse into a monoculture of its most-used pieces.</rule>
  </directive>
</network-bias>`;
}
