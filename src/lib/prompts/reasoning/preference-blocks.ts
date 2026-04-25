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
  const scopeLower = scope === "plan" ? "plan" : "arc";

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
  <flavor>Adaptive, situational. Picks whatever the story earns, beat by beat.</flavor>
${model}
  <narrative-quality-first>
    <principle>No force bias. The only question: "what would make this ${scopeLower} best?" Pick the node mix the narrative serves.</principle>
    <toolbox hint="Full toolbox available.">
      <tool name="fate">A thread advancing; references threadId + target status.</tool>
      <tool name="character/location/artifact">An entity whose world graph grows; references entityId.</tool>
      <tool name="system">A rule; reuse existing SYS-XX where possible, or introduce a new rule connected to one.</tool>
      <tool name="chaos">Black-swan departure: spawns a new piece (creative) or flips a saturating market (reversal), or both. Use when the story earns an unpriced move, not to hit a ratio.</tool>
      <tool name="reasoning">Explicit logical step linking other nodes.</tool>
      <tool name="pattern/warning">Patterns to reinforce, anti-patterns to avoid.</tool>
    </toolbox>
    <good-mixture>All-one-type reads thin: all-fate lacks grounding, all-character lacks momentum, all-system lacks consequence, all-chaos lacks stakes. Forces should CAUSE each other — system rule ENABLES character choice that ADVANCES a fate thread.</good-mixture>
    <gate>Every node earns its place via an edge; composition reflects what the ${scopeLower} genuinely is.</gate>
  </narrative-quality-first>
</force-preference>`;
  }

  if (pref === "fate") {
    return `<force-preference name="fate-dominant" scope="${scopeLower}">
  <master>Fate, amplified. Expands the fate layer.</master>
  <flavor>Inevitability, momentum, gravitational pull. Beats feel like they had to happen.</flavor>
${model}
  <what-fate-dominance-means>
    <dominance>Fate dominates — clearly out-numbers every other force. Tighten the web of threads, concentrate momentum, let the current agenda carry the ${scopeLower}. If other counts approach fate's, the preference isn't honoured.</dominance>
    <directive>
      <rule>Every fate node references an existing threadId + targetStatus it advances toward. Read each thread's recent log entries.</rule>
      <rule>Favour threads at \`escalating\` or \`critical\` — strongest momentum to convert.</rule>
      <rule>Fate is creative. Destined arrivals, prophesied figures, hidden artefacts surfacing — fate spawns new entities that extend its agenda. The new piece arrives TO advance what's in motion; its existence rhymes with momentum already there.</rule>
      <rule>Peak/valley anchors are thread transitions: peak = critical→resolved on a load-bearing thread; valley = escalating pulse that refuses to break.</rule>
    </directive>
    <chaos-minority>Keep 1-2 chaos nodes stress-testing fate's agenda — puncture the smooth journey without redirecting it. Zero-chaos = programmatic.</chaos-minority>
    <support-forces>
      <force name="character">Thread-carriers serving fate — choices that move the thread.</force>
      <force name="system">Constraints that make the journey hard (and resolution meaningful).</force>
    </support-forces>
  </what-fate-dominance-means>
</force-preference>`;
  }
  if (pref === "world") {
    return `<force-preference name="world-dominant" scope="${scopeLower}">
  <master>World (character/location/artifact transformation). Expands the world layer.</master>
  <flavor>Intimate, transformative, grounded. People and places becoming something new.</flavor>
${model}
  <what-world-dominance-means>
    <dominance>World dominates — character/location/artifact nodes clearly out-number every other force. Inner change, shifting bonds, places accruing meaning, objects gaining history, new life taking root. Fate still operates underneath as OS.</dominance>
    <directive>
      <rule>Each world node either (a) references existing entityId, naming which world-graph nodes this beat extends or contradicts; or (b) INTRODUCES a new entity growing from what's there — child/apprentice of an existing character, newly-discovered chamber, forged artefact. New entities should rhyme with the existing world (drop-ins are chaos, not world).</rule>
      <rule>Favour entities with rich existing world graphs — more material to riff on. Thin-graph entity is best anchored when the beat is the one where its graph substantially grows.</rule>
      <rule>Relationship deltas, POV-character world deltas, location-tied transformations are the core currency.</rule>
    </directive>
    <chaos-touch>Entity arcs usually serve fate's agenda. SOME can be chaos-touched: growth against the grain, location with disruptive new meaning, artefact revealing an unsettling property. Contrast keeps the ${scopeLower} from reading programmatic.</chaos-touch>
    <support-forces>
      <force name="fate">Consequence of character change — thread moves BECAUSE someone changed.</force>
      <force name="system">Constraints that force the change.</force>
      <force name="chaos">Sparingly, when an outside event catalyses the shift.</force>
    </support-forces>
  </what-world-dominance-means>
</force-preference>`;
  }
  if (pref === "system") {
    return `<force-preference name="system-dominant" scope="${scopeLower}">
  <master>System (rules, principles, mechanics). Expands the system layer.</master>
  <flavor>Lawful, consequential, testing. The world's rules asserting themselves.</flavor>
${model}
  <what-system-dominance-means>
    <dominance>System dominates — clearly out-numbers every other force. Surface existing rules AND extend them with new principles, institutions, or domains that follow from what's established.</dominance>
    <directive>
      <rule>Each system node either (a) REUSES an existing SYS-XX and extends it with a new edge/implication; (b) introduces a new rule connected to at least one existing concept; or (c) INTRODUCES a new institution/faction/domain extending the rule-layer (legal structure, craft, governing body, named principle). Free-floating lore dumps disconnected from the existing graph are failure.</rule>
      <rule>Downstream nodes (fate/character/chaos/reasoning) DEPEND on system nodes — \`requires\`/\`enables\`/\`constrains\` edges point system → consequences. System node with no outgoing edge wasn't used.</rule>
      <rule>Read the existing cumulative system graph first; test, stress, or exploit established principles before adding new ones.</rule>
    </directive>
    <chaos-cracks>Rules primarily enable fate's agenda — but show rules creating cracks chaos slips through: loopholes, unintended consequences, limits cutting both ways. Rules-only-enable-one-side reads rigged.</chaos-cracks>
    <support-forces>
      <force name="character">System-testers — the cast discovering what rules mean.</force>
      <force name="fate">System-driven consequence — thread moves BECAUSE the rule said so.</force>
      <force name="chaos">System-driven consequence — event the rules permitted but didn't foresee.</force>
    </support-forces>
  </what-system-dominance-means>
</force-preference>`;
  }
  if (pref === "chaos") {
    return `<force-preference name="chaos-dominant" scope="${scopeLower}">
  <master>Chaos — black-swan reasoning leads. The ${scopeLower} is where the agenda meets what it didn't plan for: new pieces, or market leans nobody expected to flip.</master>
  <flavor>Disciplined red-team. Every beat either introduces a departure the current state wouldn't generate, or flips a saturating market via a twist-grade event. Output: a portfolio of unpriced moves, not generalised disruption.</flavor>
${model}
  <what-chaos-dominance-means>
    <registers hint="Two registers, typically mixed.">
      <register name="creative">Introduce pieces the current agenda didn't predict — new rival, faction nobody modelled, location's hidden property, disruptive artefact. The creation IS the unpriced move.</register>
      <register name="reversal">Flip saturating/committed markets via twist-grade events — trusted advisor revealed as assassin, hidden capability surfacing, "succeeds without cost" outcome collapsing into debt. No new entity needed; the reversal is the event.</register>
      <note>A single chaos node may do both — a new rival arriving IS the event that flips the threat thread.</note>
    </registers>
    <dominance>Chaos dominates — clearly out-numbers every other force.</dominance>
    <target-saturating-markets>Reversal has highest info-value where confidence is highest: flipping a p=0.90 leader re-prices far more than a 55/45 contested market. Scan for saturating threads (p ≥ 0.85), committed threads (p ≥ 0.65 low volatility), and "succeeds without cost / undetected / free" leaders — phantom-saturation candidates ripe for reversal.</target-saturating-markets>
    <legibility hint="Each chaos node must be legible.">
      <creative-mode>What is introduced that the prior state wouldn't generate; which market(s) the new piece perturbs.</creative-mode>
      <reversal-mode>Target market, current leader, event that flips it, lagging outcome the event re-prices toward.</reversal-mode>
      <gate>Absent a legible creative addition OR reversal thesis, the node is vapour.</gate>
    </legibility>
    <not-deus-ex-machina>Black swan ≠ deus ex machina. Chaos events are surprising TO THE MARKET but CONSISTENT WITH the world's rules and the story's buried setup. Troll in the dungeon = chaos (security has buried cracks). Dumbledore saving the day = deus ex machina (contradicts the thread's stakes).</not-deus-ex-machina>
    <chaos-as-cause>Chaos is the primary CAUSE here — sits upstream driving downstream adaptation. Chaos→chaos chaining is core (one black swan re-prices several markets in sequence).</chaos-as-cause>
    <fate-roles>
      <role name="downstream">Threads chaos is re-pricing or newly opening (subverted status, brand-new thread instantiated).</role>
      <role name="upstream-subversion">Agenda's overreach priming its own reversal (Harry's pride → confronts Quirrell alone → reveal flips "evades detection" market). Highly productive: fate authoring the chaos that re-prices it.</role>
    </fate-roles>
    <support-nodes>
      <node name="character">Used adversarially — "whose betrayal would flip the alliance market?"</node>
      <node name="system">Loopholes — rules whose edge cases make the creation or reversal mechanically legal.</node>
    </support-nodes>
    <dominance-check>Chaos majority; chaos upstream driving reasoning; each node names what it creates/flips/both; fate appears as downstream effects of chaos OR as upstream overreach that PROVOKED chaos — not as a beneficiary.</dominance-check>
    <behaviour>
${scope === "plan"
  ? `      <rule>Several chaos-dominant arcs across the plan (HP's troll/Norbert). Roughly 25-40% of arcs anchored on chaos.</rule>
      <rule>Seed 5-10 chaos nodes across the plan. Mix creative + reversal; only-creative or only-reversal reads thin.</rule>
      <rule>Chaos-dominant arcs leave the portfolio MORE uncertain after resolving: new threads open (creative), or saturating markets close decisively (payoff) or flip (twist). Neither-creates-nor-re-prices = decorative; cut.</rule>`
  : `      <rule>Build around 3-5 chaos nodes (vs default 1-2).</rule>
      <rule>The arc's peak/valley may itself be chaos-anchored — prime mover is a black-swan event or creation.</rule>
      <rule>Chaos nodes collectively add a new piece OR identify a saturating market ready for reversal — ideally both. The arc's job is the twist the market wouldn't have reached on its own.</rule>`}
    </behaviour>
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
