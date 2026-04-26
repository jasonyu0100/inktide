/**
 * Phase Graph generator — mines narrative context (with optional user
 * guidance and optional seed graph) to produce a working model of reality.
 * Distinct from CRG (per-arc causal reasoning); the phase graph is a
 * descriptive snapshot of the system's current state and is consumed
 * downstream by CRG / scene / plan / prose generation.
 *
 * Phase graphs are immutable once stored. Regeneration produces a new graph
 * (optionally seeded by a prior one); the prior is preserved in storage as
 * long as it is current OR an arc references it (reference-counted GC in
 * `@/lib/phase-graph`).
 */

import type { NarrativeState, PhaseGraph, PhaseNodeSnapshot, PhaseEdgeSnapshot, PhaseNodeType } from "@/types/narrative";
import { REASONING_BUDGETS } from "@/types/narrative";
import { callGenerate, callGenerateStream } from "./api";
import { narrativeContext } from "./context";
import { parseJson } from "./json";
import { buildSequentialPath } from "./reasoning-graph";
import { logError } from "@/lib/system-logger";
import { PHASE_GRAPH_SYSTEM, buildPhaseGraphPrompt } from "@/lib/prompts/phase";
import { VALID_EDGE_TYPES } from "./reasoning-graph/shared";
import type { ReasoningEdgeType } from "./reasoning-graph/types";
import { getActivePhaseGraph } from "@/lib/phase-graph";

/**
 * Render the active phase graph as a `<phase-graph>` XML block for
 * injection into downstream prompts (CRG / scenes / plans / prose).
 * Returns "" when no phase graph is active — downstream callers can
 * concatenate the result unconditionally.
 *
 * The block carries the working model of reality the narrative is
 * currently operating under: patterns/conventions/attractors/agents/rules/
 * pressures/landmarks. Downstream generation should read this as the
 * descriptive state of the system, then plan plot accordingly.
 */
export function buildActivePhaseGraphSection(narrative: NarrativeState): string {
  const graph = getActivePhaseGraph(narrative);
  if (!graph) return "";
  return `<phase-graph hint="AMBIENT WORKING MODEL OF REALITY — patterns currently active, conventions currently followed, attractors the cast is aimed at, agents driving, rules binding, pressures accumulating, landmarks anchoring the past. Lower-priority than direction/brief/CRG (those are the user's explicit ask and the per-arc plan), but always relevant: the phase is the climate; what you write is the weather. Stay coherent with this phase unless a higher-priority input explicitly diverges.">
  <summary>${graph.summary}</summary>
  <sequential-path>
${buildSequentialPath({ nodes: graph.nodes, edges: graph.edges })}
  </sequential-path>
</phase-graph>`;
}

const VALID_PHASE_NODE_TYPES = new Set<PhaseNodeType>([
  "pattern",
  "convention",
  "attractor",
  "agent",
  "rule",
  "pressure",
  "landmark",
]);

export type GeneratePhaseGraphOptions = {
  /** Optional prior phase graph used as basis (regeneration with seed). */
  basedOn?: PhaseGraph;
  /** Optional user guidance / hypothesis. */
  guidance?: string;
  /** Reasoning effort. Defaults to the narrative's storySettings.reasoningLevel. */
  reasoningLevel?: "low" | "medium" | "high";
  /** Streamed reasoning callback (for thinking-animation UI). */
  onReasoning?: (token: string) => void;
};

/**
 * Generate a new phase graph from the narrative's current state. Returns a
 * PhaseGraph ready to be stored on NarrativeState (with `id` minted by the
 * caller's id-allocation policy and `createdAt` stamped at storage time).
 */
export async function generatePhaseGraph(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  options: GeneratePhaseGraphOptions = {},
): Promise<Omit<PhaseGraph, "id" | "createdAt">> {
  const { basedOn, guidance, reasoningLevel, onReasoning } = options;

  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);

  const basedOnSection = basedOn
    ? `<prior-phase-graph hint="The user is regenerating with this as the seed. The new graph must visibly diverge — supersede outdated nodes, surface emergent patterns the prior missed, retire pressures that have discharged. A new graph that maps onto this with cosmetic changes is a wasted regeneration.">
  <summary>${basedOn.summary}</summary>
  <sequential-path>
${buildSequentialPath({ nodes: basedOn.nodes, edges: basedOn.edges })}
  </sequential-path>
</prior-phase-graph>`
    : undefined;

  // Node-count target scales with narrative size. Phase graphs are denser
  // than per-arc reasoning graphs because they cover the whole system, but
  // bounded so the prompt doesn't explode for huge narratives.
  const sceneCount = Object.keys(narrative.scenes).length;
  const arcCount = Object.keys(narrative.arcs).length;
  const heft = Math.max(8, Math.min(arcCount * 2 + Math.floor(sceneCount / 8), 20));
  const nodeCountMin = heft;
  const nodeCountMax = heft + 6;

  const prompt = buildPhaseGraphPrompt({
    context: ctx,
    basedOnSection,
    guidance,
    nodeCountMin,
    nodeCountMax,
  });

  const reasoningBudget = REASONING_BUDGETS[reasoningLevel ?? narrative.storySettings?.reasoningLevel ?? "low"] || undefined;

  const raw = onReasoning
    ? await callGenerateStream(
        prompt,
        PHASE_GRAPH_SYSTEM,
        () => {},
        undefined,
        "generatePhaseGraph",
        undefined,
        reasoningBudget,
        onReasoning,
      )
    : await callGenerate(
        prompt,
        PHASE_GRAPH_SYSTEM,
        undefined,
        "generatePhaseGraph",
        undefined,
        reasoningBudget,
      );

  try {
    const data = parseJson(raw, "generatePhaseGraph") as {
      summary?: string;
      nodes?: Partial<PhaseNodeSnapshot>[];
      edges?: Partial<PhaseEdgeSnapshot>[];
    };

    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Invalid phase graph: missing nodes");
    }

    const rawNodes: PhaseNodeSnapshot[] = data.nodes.map((n, i) => ({
      id: typeof n.id === "string" ? n.id : `pn-${i}`,
      index: typeof n.index === "number" ? n.index : i,
      order: i,
      type: (typeof n.type === "string" && VALID_PHASE_NODE_TYPES.has(n.type as PhaseNodeType))
        ? (n.type as PhaseNodeType)
        : "pattern",
      label: typeof n.label === "string" ? n.label.slice(0, 200) : "Unlabeled phase node",
      detail: typeof n.detail === "string" ? n.detail.slice(0, 600) : undefined,
      entityId: typeof n.entityId === "string" ? n.entityId : undefined,
      threadId: typeof n.threadId === "string" ? n.threadId : undefined,
      systemNodeId: typeof n.systemNodeId === "string" ? n.systemNodeId : undefined,
    }));

    const nodes = rawNodes.map((n) => validatePhaseNodeReferences(n, narrative));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: PhaseEdgeSnapshot[] = (data.edges ?? [])
      .map((e, i) => ({
        id: typeof e.id === "string" ? e.id : `pe-${i}`,
        from: typeof e.from === "string" ? e.from : "",
        to: typeof e.to === "string" ? e.to : "",
        type: (typeof e.type === "string" && VALID_EDGE_TYPES.has(e.type))
          ? (e.type as ReasoningEdgeType)
          : "causes",
        label: typeof e.label === "string" ? e.label.slice(0, 100) : undefined,
      }))
      .filter((e) => e.from && e.to && nodeIds.has(e.from) && nodeIds.has(e.to));

    return {
      summary: typeof data.summary === "string" ? data.summary : "Phase graph",
      nodes,
      edges,
      basedOn: basedOn?.id,
      guidance,
    };
  } catch (err) {
    logError("Failed to parse phase graph", err, {
      source: "phase-graph",
      operation: "phase-graph-parse",
    });
    return {
      summary: "Failed to generate phase graph",
      nodes: [
        {
          id: "phase-error",
          index: 0,
          order: 0,
          type: "pattern",
          label: "Phase graph generation failed",
          detail: String(err),
        },
      ],
      edges: [],
      basedOn: basedOn?.id,
      guidance,
    };
  }
}

/**
 * Strip references to ids that don't exist in the narrative (hallucinated
 * entityId / threadId / systemNodeId). Same defensive pattern the CRG
 * validator uses — keeps the node but drops the bad anchor.
 */
function validatePhaseNodeReferences(node: PhaseNodeSnapshot, narrative: NarrativeState): PhaseNodeSnapshot {
  const next: PhaseNodeSnapshot = { ...node };
  if (next.entityId) {
    const exists =
      !!narrative.characters[next.entityId] ||
      !!narrative.locations[next.entityId] ||
      !!narrative.artifacts[next.entityId];
    if (!exists) next.entityId = undefined;
  }
  if (next.threadId && !narrative.threads[next.threadId]) {
    next.threadId = undefined;
  }
  if (next.systemNodeId && !narrative.systemGraph?.nodes[next.systemNodeId]) {
    next.systemNodeId = undefined;
  }
  return next;
}
