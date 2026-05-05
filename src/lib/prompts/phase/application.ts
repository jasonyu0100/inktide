/**
 * Phase Graph application prompts — string composition for injecting the
 * Phase Reasoning Graph (PRG) into downstream gen prompts.
 *
 * Three concerns live here:
 *
 *   1. <phase-graph> data block — the working model rendered as XML.
 *   2. <phase-graph-application> directive block — universal node-type
 *      semantics + rupture discipline + scope-specific usage.
 *   3. <priority> entry for <integration-hierarchy> — the consistent
 *      one-line PRG rank that each gen method's hierarchy uses.
 *
 * Centralising these here keeps the prompt language identical across the
 * pipeline so the LLM applies the PRG consistently no matter which gen
 * method is consuming it. Active-graph lookup lives in `@/lib/ai/phase-graph`;
 * this module is pure string composition.
 */

import type { PhaseGraph } from "@/types/narrative";
import { buildSequentialPath } from "@/lib/prompts/reasoning/sequential-path";

/**
 * Scope tag for phase-graph application — selects which scope-specific
 * directives ride alongside the phase-graph data, and which language the
 * <integration-hierarchy> entry uses. Mirrors the scoped
 * `forcePreferenceBlock` / `networkBiasBlock` pattern: the data is
 * universal, the directive is tailored to the consuming gen method.
 */
export type PhaseGraphScope =
  | "expand"           // world expansion (entities, system rules, threads)
  | "reasoning-arc"    // per-arc causal reasoning graph
  | "reasoning-plan"   // multi-arc coordination plan
  | "scene-structure"  // scene generation
  | "scene-plan"       // beat plan
  | "scene-prose";     // prose

// ── Data block ───────────────────────────────────────────────────────────────

/**
 * Render the active phase graph as a `<phase-graph>` XML data block. The
 * hint summarises what the PRG is — applies-everywhere framing. Scope-
 * specific guidance lives in the application block, not here.
 */
export function buildPhaseGraphDataBlock(graph: PhaseGraph): string {
  return `<phase-graph hint="HIGH-LEVEL META MACHINERY of this work — the structural underpinnings of its economy or material conditions, institutional and political dynamics, the rule-system or methodological framework it runs on, cultural conventions, structural agents, foundational landmarks, and structural patterns. NOT situational state (that's CRG/scene). Inherit the machinery; let it trickle down so your output carries meaningful weight.">
  <summary>${graph.summary}</summary>
  <sequential-path>
${buildSequentialPath({ nodes: graph.nodes, edges: graph.edges })}
  </sequential-path>
</phase-graph>`;
}

// ── Application directive ────────────────────────────────────────────────────

const PHASE_GRAPH_SEMANTICS_BLOCK = `  <semantics hint="Node types encode temporal stance — read them, don't flatten them. Each gen method's integration-hierarchy ranks WHERE the PRG sits among other inputs; this block defines WHAT each node type is asserting.">
    <type name="pattern">Recurring configuration · CURRENTLY-ACTIVE — should keep firing unless something supersedes it.</type>
    <type name="convention">Procedural default · CURRENTLY-FOLLOWED — assume it holds; deviations are notable events.</type>
    <type name="attractor">Future-pointing aim · the world is being PULLED toward this — fate threads should align with it.</type>
    <type name="agent">Active driver · CURRENTLY-DRIVING — when it appears, it carries a stance, not just a name.</type>
    <type name="rule">Foreground constraint · CURRENTLY-BINDING — every action must be consistent with it (or explicitly break it).</type>
    <type name="pressure">Accumulating tension · ACCUMULATING-TOWARD-DISCHARGE — should compound until it discharges.</type>
    <type name="landmark">Past-but-anchoring · PRIOR EVENT still shaping the present — gravity, not history trivia.</type>
  </semantics>
  <rupture hint="Higher-priority inputs (per the integration-hierarchy) can demand breaking a phase rule or retiring a pressure. Comply — but mark the rupture as deliberate so it doesn't read as drift.">
    <rule>CRG / scene level: mark broken phase rules as chaos nodes or system-delta supersedes; don't quietly contradict.</rule>
    <rule>Prose level: name the rule the action violates (in subtext or surface) so the rupture lands as event, not noise.</rule>
    <rule>World-expansion level: emit a system delta that explicitly supersedes the prior rule when adding machinery that contradicts it.</rule>
  </rupture>`;

/**
 * Render the universal `<phase-graph-application>` directive block. This is
 * what makes PRG application CONSISTENT across the pipeline: every gen
 * method that injects the data also injects this directive, so node-type
 * semantics and rupture discipline mean the same thing everywhere. The
 * scope-specific usage block adds layer-appropriate "how to apply" rules.
 */
export function buildPhaseGraphApplicationBlock(scope: PhaseGraphScope): string {
  return `<phase-graph-application scope="${scope}">
${PHASE_GRAPH_SEMANTICS_BLOCK}
${SCOPE_USAGE_BLOCK[scope]}
</phase-graph-application>`;
}

const SCOPE_USAGE_BLOCK: Record<PhaseGraphScope, string> = {
  expand: `  <usage hint="World expansion materialises new pieces inside the active machinery.">
    <rule>New characters / locations / artifacts inherit the active phase. They obey active rules, defer to active agents, and slot into active conventions — not generic register defaults.</rule>
    <rule>New threads operationalise an active attractor or pressure. A new thread that doesn't pull toward an attractor or compound a pressure should justify its existence in its description.</rule>
    <rule>New system nodes extend the phase rules and conventions consistently. Edges should connect to existing system ids that the phase graph references — wiring the expansion INTO the phase machinery, not floating beside it.</rule>
    <rule>If the directive demands a piece that contradicts an active phase rule, comply — but emit a system delta that explicitly supersedes the rule, so the contradiction is registered, not laundered.</rule>
  </usage>`,
  "reasoning-arc": `  <usage hint="Per-arc reasoning is causal logic running on top of the phase substrate.">
    <rule>Pressures appear as upstream causes (\`requires\` / \`enables\` edges into reasoning); attractors appear as downstream targets (\`resolves\` / \`develops\` edges from fate); agents drive across the spine; rules constrain.</rule>
    <rule>Landmarks are gravity wells — when an arc activates one, treat it as a foundational anchor the arc earns its weight from, not a callback.</rule>
    <rule>If the arc breaks a phase rule, mark the breaking node as chaos and surface what the rule was — silent rule-breaks read as inconsistency, named rule-breaks read as turning points.</rule>
  </usage>`,
  "reasoning-plan": `  <usage hint="The coordination plan distributes the phase machinery across arcs.">
    <rule>Spine anchors (peak / valley) should align with phase pressures discharging or attractors being approached — the plan's structural beats are where the substrate moves.</rule>
    <rule>Different arcs should activate different phase nodes. A plan whose every arc leans on the same agent / rule / pressure flattens the substrate; spread the load.</rule>
    <rule>If the plan retires a pressure or supersedes a rule, surface that as a structural commitment — name the node it discharges, not just the arc that does it.</rule>
  </usage>`,
  "scene-structure": `  <usage hint="Scenes are concrete enactments of the active phase machinery.">
    <rule>POV characters act under active rules, defer to (or break) active conventions, push against active pressures. Their choices should be legible AS responses to the substrate.</rule>
    <rule>Locations embody active conventions and landmark gravity. Setting choice should be a phase signal, not a generic backdrop.</rule>
    <rule>Scene events compound active pressures or honor active patterns. A scene that does neither should re-justify itself against the directive.</rule>
  </usage>`,
  "scene-plan": `  <usage hint="Beat plans select moments that activate the substrate.">
    <rule>Escalation beats compound active pressures. Turn / reveal beats fire when an attractor is approached or a landmark surfaces. Resolve beats discharge a pressure or commit to an attractor.</rule>
    <rule>The mechanism mix should match the phase. If conventions dominate the phase, dialogue and document beats carry weight; if rules dominate, action and narration; if pressures dominate, environment and thought.</rule>
    <rule>Don't name phase nodes verbatim in beat \`what\` fields — embody them. The beat scaffolds prose; the prose enacts the substrate.</rule>
  </usage>`,
  "scene-prose": `  <usage hint="Prose flavor is the substrate's surface texture.">
    <rule>Word choice and detail reflect the phase: economic vocabulary if economic systems dominate, institutional cadence if institutions are agents, geographic character if landscape carries pressure.</rule>
    <rule>Don't name the rules; embody them. A character bargaining under a phase rule should bargain in the rule's terms, not narrate the rule.</rule>
    <rule>Active conventions shape register and address — speech levels, terms of art, ritualised exchanges. A convention ignored in prose reads as an inconsistency, not a stylistic choice.</rule>
  </usage>`,
};

// ── Section composition ──────────────────────────────────────────────────────

/**
 * Compose data + application into the single string each gen method
 * injects under `<inputs>`. Pure composition — caller decides whether to
 * call this (when a graph is active) or omit the block entirely.
 */
export function buildPhaseGraphSection(graph: PhaseGraph, scope: PhaseGraphScope): string {
  return `${buildPhaseGraphDataBlock(graph)}\n${buildPhaseGraphApplicationBlock(scope)}`;
}

/**
 * Render a prior phase graph as a `<prior-phase-graph>` block for injection
 * into the PRG generation prompt as a seed. Used during regeneration when
 * the user wants the new graph to diverge from a previous one.
 */
export function buildPriorPhaseGraphSection(prior: PhaseGraph): string {
  return `<prior-phase-graph hint="The user is regenerating with this as the seed. The new graph must visibly diverge — supersede outdated nodes, surface emergent patterns the prior missed, retire pressures that have discharged. A new graph that maps onto this with cosmetic changes is a wasted regeneration.">
  <summary>${prior.summary}</summary>
  <sequential-path>
${buildSequentialPath({ nodes: prior.nodes, edges: prior.edges })}
  </sequential-path>
</prior-phase-graph>`;
}

// ── Integration-hierarchy entry ──────────────────────────────────────────────

/**
 * Render the consistent `<priority>` entry for the PRG inside a gen
 * method's `<integration-hierarchy>` block. The rank varies per gen method
 * (depends on how many priority categories that prompt has); the language
 * is scope-tailored so each layer's blurb matches the gen method's
 * concerns — but the SHAPE is identical, so consumers see uniform PRG
 * priority semantics across the pipeline.
 */
export function phaseGraphPriorityEntry(rank: number, scope: PhaseGraphScope): string {
  const { framing, guidance } = SCOPE_PRIORITY_BLURB[scope];
  return `<priority rank="${rank}">PHASE GRAPH (PRG) — ${framing} ${guidance}</priority>`;
}

const SCOPE_PRIORITY_BLURB: Record<PhaseGraphScope, { framing: string; guidance: string }> = {
  expand: {
    framing: "ambient working model.",
    guidance: "New entities, system rules, and threads inherit the active phase machinery; the directive overrides where they tension.",
  },
  "reasoning-arc": {
    framing: "ambient working model.",
    guidance: "Plan the chain so it stays coherent with this phase; the brief overrides where they conflict.",
  },
  "reasoning-plan": {
    framing: "ambient working model.",
    guidance: "Arc anchors and force composition stay coherent with this phase; explicit user direction wins where they tension.",
  },
  "scene-structure": {
    framing: "ambient working model.",
    guidance: "Scenes stay coherent with the phase (active patterns surface, current rules bind, accumulated pressures find expression) unless the brief explicitly overrides.",
  },
  "scene-plan": {
    framing: "ambient working model.",
    guidance: "When the scene has slack (multiple compulsory orderings serve, mechanisms admit choice), let the phase shape what the beats foreground (active patterns surface as bridge props, current rules constrain visibly, accumulated pressures find subtext).",
  },
  "scene-prose": {
    framing: "atmospheric layer.",
    guidance: "Surface the ambient model in subtext: rules visibly bind the action, accumulated pressures audibly weight choices, currently-active patterns appear as recognisable shapes. Don't narrate the PRG; let it colour what the prose foregrounds.",
  },
};
