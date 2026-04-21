/**
 * Network graph — the cumulative activation pattern of all reasoning across
 * the narrative. Aggregates attributions from every reasoning graph (per-arc
 * and per-world-build) onto the real narrative entities/threads/system nodes.
 *
 * Network nodes: characters, locations, artifacts, threads, system nodes.
 * Network edges: typed-to-typed connections drawn explicitly inside any
 *   reasoning graph (chaos / pattern / warning / reasoning nodes are skipped
 *   — they're outside forces that influence the network without being part
 *   of it; chaos's signature shows up indirectly via the entities it spawns).
 * Heat tier: bucket per node based on attribution count + recency:
 *   - "fresh"  — introduced in the last FRESH_WINDOW arcs (regardless of count)
 *   - "hot"    — top tertile by attribution count
 *   - "warm"   — middle tertile
 *   - "cold"   — bottom tertile (or zero)
 *
 * The point of the network is twofold: (1) make the activation pattern
 * visible so the LLM can reason about it during generation, and (2) drive
 * the inside / outside / neutral thinking modes that bias which parts of
 * the network the next reasoning graph leans into.
 */

import type { NarrativeState } from "@/types/narrative";

/** Window in arcs (counted from the latest reasoning graph backward) where
 *  freshly-introduced nodes get the "fresh" tier regardless of count. Tuned
 *  so a node introduced 1-3 arcs ago still reads as new. */
export const FRESH_WINDOW = 3;

export type NetworkNodeKind =
  | "character"
  | "location"
  | "artifact"
  | "thread"
  | "system";

export type HeatTier = "hot" | "warm" | "cold" | "fresh";

export type NetworkNode = {
  id: string;
  kind: NetworkNodeKind;
  label: string;
  /** Number of reasoning-graph nodes (across the whole narrative) that
   *  reference this network node via threadId / entityId / systemNodeId. */
  attributions: number;
  /** Reasoning-graph generation index where this node first received an
   *  attribution. Used to detect freshness. -1 if the node has never been
   *  referenced. */
  firstSeenIndex: number;
  /** Heat tier — derived from `attributions` + `firstSeenIndex` relative to
   *  the rest of the network. Computed by `classifyTiers`. */
  tier: HeatTier;
};

export type NetworkEdge = {
  from: string;
  to: string;
  /** Co-occurrence weight — number of times an explicit reasoning-graph
   *  edge connected these two typed nodes. */
  weight: number;
};

export type NetworkGraph = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** Total number of reasoning graphs aggregated. */
  graphCount: number;
};

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Walk reasoning graphs in the narrative and accumulate attribution counts +
 * edges onto the real entities/threads/system nodes.
 *
 * When `resolvedKeys` + `currentIndex` are provided, aggregation is
 * PROGRESSIVE: only reasoning graphs attached to scenes / world builds at or
 * before `currentIndex` in the resolved timeline are visited. This makes the
 * network view show what the story HAS activated so far, not what it WILL
 * activate. When omitted, every reasoning graph in the narrative is visited.
 */
export function aggregateNetworkGraph(
  narrative: NarrativeState,
  resolvedKeys?: string[],
  currentIndex?: number,
): NetworkGraph {
  const attributions = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  const edgeWeights = new Map<string, number>(); // key = `${a}|${b}` (sorted)

  let graphIndex = 0;
  let graphCount = 0;

  const visitGraph = (graph: { nodes: ReadonlyArray<{ type: string; entityId?: string; threadId?: string; systemNodeId?: string; id: string }>; edges: ReadonlyArray<{ from: string; to: string }> }) => {
    graphCount += 1;
    // Map each reasoning-node id → its typed reference (so edges can resolve).
    const nodeRef = new Map<string, string>();

    for (const node of graph.nodes) {
      const ref = refOf(node);
      if (!ref) continue;
      nodeRef.set(node.id, ref);
      attributions.set(ref, (attributions.get(ref) ?? 0) + 1);
      if (!firstSeen.has(ref)) firstSeen.set(ref, graphIndex);
    }

    for (const edge of graph.edges) {
      const fromRef = nodeRef.get(edge.from);
      const toRef = nodeRef.get(edge.to);
      if (!fromRef || !toRef || fromRef === toRef) continue;
      const key = fromRef < toRef ? `${fromRef}|${toRef}` : `${toRef}|${fromRef}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }

    graphIndex += 1;
  };

  // Decide which arcs and world builds are in scope for the current cutoff.
  const useProgressive = resolvedKeys !== undefined && currentIndex !== undefined;
  const allowedArcIds = new Set<string>();
  const allowedWorldBuildIds = new Set<string>();
  let timelineOrderedItems: Array<{ kind: "arc"; id: string } | { kind: "world_build"; id: string }> = [];

  if (useProgressive) {
    const keysInRange = resolvedKeys!.slice(0, currentIndex! + 1);
    const seenArcs = new Set<string>();
    for (const key of keysInRange) {
      const scene = narrative.scenes[key];
      if (scene && scene.arcId && !seenArcs.has(scene.arcId)) {
        seenArcs.add(scene.arcId);
        allowedArcIds.add(scene.arcId);
        timelineOrderedItems.push({ kind: "arc", id: scene.arcId });
        continue;
      }
      const wb = narrative.worldBuilds[key];
      if (wb) {
        allowedWorldBuildIds.add(wb.id);
        timelineOrderedItems.push({ kind: "world_build", id: wb.id });
      }
    }
  } else {
    // No cutoff — include everything in narrative-creation order (arcs first,
    // then world builds; matches the prior behaviour).
    timelineOrderedItems = [
      ...Object.values(narrative.arcs).map((a) => ({ kind: "arc" as const, id: a.id })),
      ...Object.values(narrative.worldBuilds).map((w) => ({ kind: "world_build" as const, id: w.id })),
    ];
  }

  for (const item of timelineOrderedItems) {
    if (item.kind === "arc") {
      const arc = narrative.arcs[item.id];
      if (arc?.reasoningGraph) visitGraph(arc.reasoningGraph);
    } else {
      const wb = narrative.worldBuilds[item.id];
      if (wb?.reasoningGraph) visitGraph(wb.reasoningGraph);
    }
  }

  // Build the network nodes — one per real entity/thread/system node.
  const rawNodes: NetworkNode[] = [];

  for (const c of Object.values(narrative.characters)) {
    rawNodes.push(blankNode(c.id, "character", c.name, attributions, firstSeen));
  }
  for (const l of Object.values(narrative.locations)) {
    rawNodes.push(blankNode(l.id, "location", l.name, attributions, firstSeen));
  }
  for (const a of Object.values(narrative.artifacts ?? {})) {
    rawNodes.push(blankNode(a.id, "artifact", a.name, attributions, firstSeen));
  }
  for (const t of Object.values(narrative.threads)) {
    rawNodes.push(blankNode(t.id, "thread", t.description, attributions, firstSeen));
  }
  for (const s of Object.values(narrative.systemGraph?.nodes ?? {})) {
    rawNodes.push(blankNode(s.id, "system", s.concept, attributions, firstSeen));
  }

  const nodes = classifyTiers(rawNodes, graphIndex);
  const knownIds = new Set(nodes.map((n) => n.id));

  const edges: NetworkEdge[] = [];
  for (const [key, weight] of edgeWeights.entries()) {
    const [from, to] = key.split("|");
    if (knownIds.has(from) && knownIds.has(to)) {
      edges.push({ from, to, weight });
    }
  }

  return { nodes, edges, graphCount };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a reasoning node to its typed reference id. Returns null for
 *  chaos / pattern / warning / reasoning nodes (outside forces) and for
 *  typed nodes whose reference is missing. */
function refOf(node: { type: string; entityId?: string; threadId?: string; systemNodeId?: string }): string | null {
  switch (node.type) {
    case "character":
    case "location":
    case "artifact":
      return node.entityId ?? null;
    case "fate":
      return node.threadId ?? null;
    case "system":
      return node.systemNodeId ?? null;
    default:
      // chaos / pattern / warning / reasoning — outside the network.
      return null;
  }
}

function blankNode(
  id: string,
  kind: NetworkNodeKind,
  label: string,
  attributions: Map<string, number>,
  firstSeen: Map<string, number>,
): NetworkNode {
  return {
    id,
    kind,
    label,
    attributions: attributions.get(id) ?? 0,
    firstSeenIndex: firstSeen.get(id) ?? -1,
    // Placeholder — classifyTiers fills this in.
    tier: "cold",
  };
}

/**
 * Bucket nodes into hot / warm / cold / fresh. Tiers are computed across
 * the whole network so they're comparative rather than absolute — a story
 * with low overall attribution still has a meaningful "hot" cohort.
 */
export function classifyTiers(
  nodes: NetworkNode[],
  totalGraphs: number,
): NetworkNode[] {
  if (nodes.length === 0) return nodes;
  const freshThreshold = totalGraphs - FRESH_WINDOW;
  const counts = nodes
    .map((n) => n.attributions)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);

  // Tertile cutoffs. With no attributions, everything is cold.
  const len = counts.length;
  const lowCut = len > 0 ? counts[Math.floor(len / 3)] : 0;
  const highCut = len > 0 ? counts[Math.floor((2 * len) / 3)] : 0;

  return nodes.map((n) => {
    if (
      n.firstSeenIndex >= 0 &&
      n.firstSeenIndex >= freshThreshold &&
      totalGraphs > 0
    ) {
      return { ...n, tier: "fresh" as HeatTier };
    }
    if (n.attributions <= 0) return { ...n, tier: "cold" as HeatTier };
    if (n.attributions >= highCut) return { ...n, tier: "hot" as HeatTier };
    if (n.attributions >= lowCut) return { ...n, tier: "warm" as HeatTier };
    return { ...n, tier: "cold" as HeatTier };
  });
}

/**
 * Look up the heat tier for a single id without rebuilding the whole graph.
 * Convenient for inline labelling in narrative context.
 */
export function buildTierLookup(network: NetworkGraph): Map<string, NetworkNode> {
  return new Map(network.nodes.map((n) => [n.id, n]));
}

/** Compact human-readable label for heat tier — used in prompt context. */
export function formatTierLabel(node: NetworkNode | undefined): string {
  if (!node) return "";
  if (node.tier === "cold" && node.attributions === 0) {
    return `{cold ×0 — never referenced}`;
  }
  return `{${node.tier} ×${node.attributions}}`;
}
