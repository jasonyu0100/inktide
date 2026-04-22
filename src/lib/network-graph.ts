/**
 * Network graph — the cumulative activation pattern of all reasoning across
 * the narrative. Aggregates attributions from every reasoning graph (per-arc
 * and per-world-build) onto the real narrative entities/threads/system nodes.
 *
 * Network nodes: characters, locations, artifacts, threads, system nodes.
 * Network edges: explicit reasoning-graph edges that connect two typed
 *   reasoning nodes (chaos / pattern / warning / reasoning are skipped — they
 *   are outside forces that influence the network without being part of it;
 *   chaos's signature shows up indirectly via the entities it spawns).
 *
 * Each node carries four annotation dimensions so the LLM can reason about
 * the activation pattern intelligently rather than just "more vs less":
 *
 *   1. tier        — heat snapshot          (hot / warm / cold / fresh)
 *   2. trajectory  — direction of change    (rising / steady / cooling / dormant)
 *   3. topology    — position in the web    (bridge / hub / leaf / isolated)
 *   4. forceAnchor — which axis it serves   (fate / world / system / null)
 *
 * Why four dimensions: a node may be cold because it's never been used OR
 * because the story moved past it; a node may be hot because it's load-
 * bearing OR because it's been over-mentioned without depth; a node may be
 * a precious bridge between cohorts OR a peripheral leaf. The richer
 * vocabulary lets `inside / outside / neutral` thinking modes make smarter
 * choices — "inside" can prefer hot+rising bridges (compounding), "outside"
 * can prefer fresh OR cold-but-anchor nodes (planted but never followed up).
 */

import type { NarrativeState } from "@/types/narrative";

/** Window in graphs where freshly-introduced nodes get the "fresh" tier
 *  regardless of count. Set to 1 — only nodes first seen in the LATEST
 *  reasoning graph qualify as fresh. Wider windows preempt the hot/warm/cold
 *  tertile classifier in early game (3 graphs × FRESH_WINDOW=3 means every
 *  attributed node is fresh) — keeping it tight makes freshness a small,
 *  meaningful cohort. */
export const FRESH_WINDOW = 1;

/** Window in graphs used to decide trajectory — how many recent graphs to
 *  look at when comparing recent vs historic attribution rate. */
export const RECENT_WINDOW = 3;

/** Minimum attribution count required to be classified as "hot" — even when
 *  a node sits in the top tertile, it can't be hot until it's actually been
 *  referenced this many times. Prevents single-attribution nodes from
 *  reading as load-bearing in early game. */
const HOT_MIN_ATTRIBUTIONS = 2;

/** A node is force-anchored when ≥ this fraction of its neighbours sit on a
 *  single force axis (fate / world / system). Below the threshold it reads
 *  as balanced and forceAnchor stays null. */
const ANCHOR_FRACTION = 0.6;

export type NetworkNodeKind =
  | "character"
  | "location"
  | "artifact"
  | "thread"
  | "system";

export type Force = "fate" | "world" | "system";

export type HeatTier = "hot" | "warm" | "cold" | "fresh";
export type Trajectory = "rising" | "steady" | "cooling" | "dormant";
export type Topology = "bridge" | "hub" | "leaf" | "isolated";

export type NetworkNode = {
  id: string;
  kind: NetworkNodeKind;
  label: string;
  /** Total attributions across all aggregated reasoning graphs. */
  attributions: number;
  /** Attributions in the last RECENT_WINDOW graphs only. Drives trajectory. */
  recentAttributions: number;
  /** Reasoning-graph index where this node first received an attribution.
   *  -1 if the node has never been referenced. */
  firstSeenIndex: number;
  /** Reasoning-graph index of the most recent attribution. -1 if never. */
  lastSeenIndex: number;
  /** Heat snapshot — relative to the rest of the network. */
  tier: HeatTier;
  /** Direction of change — rising/steady/cooling/dormant. Derived from
   *  recentAttributions vs total + lastSeenIndex. */
  trajectory: Trajectory;
  /** Position in the network web. Bridges connect ≥2 distinct cohorts;
   *  hubs are well-connected within one cohort; leafs have a single edge;
   *  isolated have none. */
  topology: Topology;
  /** Which force axis dominates this node's neighbourhood, when one does
   *  (≥ ANCHOR_FRACTION of neighbours sit on the same axis). null when
   *  balanced. Use this to spot true cross-force agents vs single-axis
   *  specialists. */
  forceAnchor: Force | null;
};

export type NetworkEdge = {
  from: string;
  to: string;
  /** Number of times an explicit reasoning-graph edge connected these two
   *  typed nodes across the aggregated graphs. */
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
 * edges + annotations onto the real entities/threads/system nodes.
 *
 * When `resolvedKeys` + `currentIndex` are provided, aggregation is
 * PROGRESSIVE: only reasoning graphs attached to scenes / world builds at or
 * before `currentIndex` in the resolved timeline are visited. When omitted,
 * every reasoning graph in the narrative is visited.
 */
export function aggregateNetworkGraph(
  narrative: NarrativeState,
  resolvedKeys?: string[],
  currentIndex?: number,
): NetworkGraph {
  const attributions = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  const attributionPerGraph = new Map<string, number[]>(); // ref → array indexed by graph
  const edgeWeights = new Map<string, number>();

  let graphIndex = 0;
  let graphCount = 0;

  const visitGraph = (graph: { nodes: ReadonlyArray<{ type: string; entityId?: string; threadId?: string; systemNodeId?: string; id: string }>; edges: ReadonlyArray<{ from: string; to: string }> }) => {
    graphCount += 1;
    const nodeRef = new Map<string, string>();

    for (const node of graph.nodes) {
      const ref = refOf(node);
      if (!ref) continue;
      nodeRef.set(node.id, ref);
      attributions.set(ref, (attributions.get(ref) ?? 0) + 1);
      if (!firstSeen.has(ref)) firstSeen.set(ref, graphIndex);
      lastSeen.set(ref, graphIndex);
      let perGraph = attributionPerGraph.get(ref);
      if (!perGraph) {
        perGraph = [];
        attributionPerGraph.set(ref, perGraph);
      }
      perGraph[graphIndex] = (perGraph[graphIndex] ?? 0) + 1;
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
  let timelineOrderedItems: Array<{ kind: "arc"; id: string } | { kind: "world_build"; id: string }> = [];

  if (useProgressive) {
    const keysInRange = resolvedKeys!.slice(0, currentIndex! + 1);
    const seenArcs = new Set<string>();
    for (const key of keysInRange) {
      const scene = narrative.scenes[key];
      if (scene && scene.arcId && !seenArcs.has(scene.arcId)) {
        seenArcs.add(scene.arcId);
        timelineOrderedItems.push({ kind: "arc", id: scene.arcId });
        continue;
      }
      const wb = narrative.worldBuilds[key];
      if (wb) {
        timelineOrderedItems.push({ kind: "world_build", id: wb.id });
      }
    }
  } else {
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

  // Compute recent attribution counts (last RECENT_WINDOW graphs only).
  const recentAttributions = new Map<string, number>();
  const recentStart = Math.max(0, graphCount - RECENT_WINDOW);
  for (const [ref, perGraph] of attributionPerGraph.entries()) {
    let sum = 0;
    for (let i = recentStart; i < graphCount; i++) sum += perGraph[i] ?? 0;
    recentAttributions.set(ref, sum);
  }

  // Build the raw nodes — one per real entity/thread/system node, including
  // unreferenced ones (they appear cold/dormant/isolated).
  const rawNodes: NetworkNode[] = [];
  for (const c of Object.values(narrative.characters)) {
    rawNodes.push(blankNode(c.id, "character", c.name, attributions, recentAttributions, firstSeen, lastSeen));
  }
  for (const l of Object.values(narrative.locations)) {
    rawNodes.push(blankNode(l.id, "location", l.name, attributions, recentAttributions, firstSeen, lastSeen));
  }
  for (const a of Object.values(narrative.artifacts ?? {})) {
    rawNodes.push(blankNode(a.id, "artifact", a.name, attributions, recentAttributions, firstSeen, lastSeen));
  }
  for (const t of Object.values(narrative.threads)) {
    rawNodes.push(blankNode(t.id, "thread", t.description, attributions, recentAttributions, firstSeen, lastSeen));
  }
  for (const s of Object.values(narrative.systemGraph?.nodes ?? {})) {
    rawNodes.push(blankNode(s.id, "system", s.concept, attributions, recentAttributions, firstSeen, lastSeen));
  }

  // Tiers — comparative, computed first so trajectory/topology/anchor see them.
  let nodes = classifyTiers(rawNodes, graphCount);

  // Edges (filtered to known nodes) — needed for topology + force anchor.
  const knownIds = new Set(nodes.map((n) => n.id));
  const edges: NetworkEdge[] = [];
  for (const [key, weight] of edgeWeights.entries()) {
    const [from, to] = key.split("|");
    if (knownIds.has(from) && knownIds.has(to)) {
      edges.push({ from, to, weight });
    }
  }

  // Trajectory — uses graphCount + per-node history.
  nodes = classifyTrajectories(nodes, graphCount);

  // Topology + force anchor — uses edges + neighbour kinds.
  const kindLookup = new Map(nodes.map((n) => [n.id, n.kind]));
  nodes = classifyTopologyAndAnchor(nodes, edges, kindLookup);

  return { nodes, edges, graphCount };
}

// ── Classifiers ──────────────────────────────────────────────────────────────

/** Bucket nodes into hot / warm / cold / fresh. Tiers are comparative across
 *  the network so a low-attribution story still has a meaningful "hot"
 *  cohort, with two calibrations to handle early game:
 *
 *  1. Freshness only applies when totalGraphs > 1 — with no historic
 *     baseline, there's nothing to be "fresh" against; let the tertile
 *     classifier do its job on the first graph.
 *  2. Hot requires a minimum attribution count (HOT_MIN_ATTRIBUTIONS) on
 *     top of the tertile placement — a single attribution can't read as
 *     load-bearing just because the network is small.
 */
export function classifyTiers(nodes: NetworkNode[], totalGraphs: number): NetworkNode[] {
  if (nodes.length === 0) return nodes;
  const freshThreshold = totalGraphs - FRESH_WINDOW;
  const freshActive = totalGraphs > 1;
  const counts = nodes.map((n) => n.attributions).filter((c) => c > 0).sort((a, b) => a - b);
  const len = counts.length;
  const lowCut = len > 0 ? counts[Math.floor(len / 3)] : 0;
  const highCut = len > 0 ? counts[Math.floor((2 * len) / 3)] : 0;

  return nodes.map((n) => {
    if (freshActive && n.firstSeenIndex >= 0 && n.firstSeenIndex >= freshThreshold) {
      return { ...n, tier: "fresh" as HeatTier };
    }
    if (n.attributions <= 0) return { ...n, tier: "cold" as HeatTier };
    if (n.attributions >= highCut && n.attributions >= HOT_MIN_ATTRIBUTIONS) {
      return { ...n, tier: "hot" as HeatTier };
    }
    if (n.attributions >= lowCut) return { ...n, tier: "warm" as HeatTier };
    return { ...n, tier: "cold" as HeatTier };
  });
}

/** Classify trajectory by comparing recent rate to historic rate.
 *  Nodes with no attributions are dormant; nodes attributed historically but
 *  not recently are cooling; nodes whose recent rate exceeds 1.5× their
 *  historic average are rising; everything else is steady. */
export function classifyTrajectories(nodes: NetworkNode[], totalGraphs: number): NetworkNode[] {
  return nodes.map((n) => {
    let trajectory: Trajectory;
    if (n.attributions === 0) {
      trajectory = "dormant";
    } else if (n.recentAttributions === 0) {
      trajectory = "cooling";
    } else {
      const recentRate = n.recentAttributions / Math.max(RECENT_WINDOW, 1);
      const historicRate = n.attributions / Math.max(totalGraphs, 1);
      trajectory = recentRate > historicRate * 1.5 ? "rising" : "steady";
    }
    return { ...n, trajectory };
  });
}

/** Compute degree-based topology + force-axis anchor in one pass. */
export function classifyTopologyAndAnchor(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  kindLookup: Map<string, NetworkNodeKind>,
): NetworkNode[] {
  const neighbours = new Map<string, string[]>();
  for (const e of edges) {
    if (!neighbours.has(e.from)) neighbours.set(e.from, []);
    if (!neighbours.has(e.to)) neighbours.set(e.to, []);
    neighbours.get(e.from)!.push(e.to);
    neighbours.get(e.to)!.push(e.from);
  }

  return nodes.map((n) => {
    const adj = neighbours.get(n.id) ?? [];
    let topology: Topology;
    if (adj.length === 0) topology = "isolated";
    else if (adj.length === 1) topology = "leaf";
    else {
      // Bridge if neighbours span ≥2 distinct force axes; hub otherwise.
      const forces = new Set<Force>();
      for (const nid of adj) {
        const k = kindLookup.get(nid);
        if (k) forces.add(forceOfKind(k));
      }
      topology = forces.size >= 2 ? "bridge" : "hub";
    }

    // Force anchor — which axis dominates the neighbourhood.
    let forceAnchor: Force | null = null;
    if (adj.length > 0) {
      const tally: Record<Force, number> = { fate: 0, world: 0, system: 0 };
      for (const nid of adj) {
        const k = kindLookup.get(nid);
        if (k) tally[forceOfKind(k)] += 1;
      }
      const total = tally.fate + tally.world + tally.system;
      const dominant = (Object.entries(tally) as [Force, number][])
        .sort((a, b) => b[1] - a[1])[0];
      if (total > 0 && dominant[1] / total >= ANCHOR_FRACTION) {
        forceAnchor = dominant[0];
      }
    }

    return { ...n, topology, forceAnchor };
  });
}

// ── Cohort summary ───────────────────────────────────────────────────────────

/** Per-force breakdown rendered as a compact NETWORK STATE block for the
 *  reasoning prompt — gives the LLM a top-level read on which cohorts are
 *  saturated / shallow / expanding before it dives into per-node decisions. */
export function summarizeNetworkState(network: NetworkGraph): string {
  if (network.nodes.length === 0) {
    return "NETWORK STATE: empty.";
  }
  if (network.graphCount === 0) {
    return `NETWORK STATE: ${network.nodes.length} nodes total, no reasoning graphs yet (everything dormant).`;
  }

  const buckets: Record<Force, NetworkNode[]> = { fate: [], world: [], system: [] };
  for (const n of network.nodes) buckets[forceOfKind(n.kind)].push(n);

  const cohortLine = (force: Force, label: string): string => {
    const cohort = buckets[force];
    if (cohort.length === 0) return `- ${label}: none yet.`;
    const hot = cohort.filter((n) => n.tier === "hot").length;
    const warm = cohort.filter((n) => n.tier === "warm").length;
    const fresh = cohort.filter((n) => n.tier === "fresh").length;
    const dormant = cohort.filter((n) => n.trajectory === "dormant").length;
    const cooling = cohort.filter((n) => n.trajectory === "cooling").length;
    const rising = cohort.filter((n) => n.trajectory === "rising").length;

    // Verdict — saturated / shallow / expanding / balanced.
    let verdict = "balanced";
    if (cohort.length === 0) verdict = "empty";
    else if (dormant / cohort.length > 0.6) verdict = "shallow (most untouched)";
    else if (hot / cohort.length > 0.6) verdict = "saturated";
    else if (rising > 0 && fresh > 0) verdict = "expanding";
    else if (cooling > rising && cooling > 0) verdict = "cooling";

    return `- ${label} (${cohort.length}): ${hot} hot · ${warm} warm · ${fresh} fresh · ${cooling} cooling · ${dormant} dormant — ${verdict}.`;
  };

  const bridges = network.nodes.filter((n) => n.topology === "bridge").length;
  const hubs = network.nodes.filter((n) => n.topology === "hub").length;

  return [
    `NETWORK STATE — cumulative across ${network.graphCount} reasoning graph${network.graphCount === 1 ? "" : "s"}:`,
    cohortLine("fate", "Fate"),
    cohortLine("world", "World"),
    cohortLine("system", "System"),
    `- Topology: ${bridges} bridge${bridges === 1 ? "" : "s"} (cross-force connectors), ${hubs} hub${hubs === 1 ? "" : "s"} (within-cohort centres).`,
  ].join("\n");
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
      return null;
  }
}

/** Map a network-node kind to its narrative force axis. */
export function forceOfKind(kind: NetworkNodeKind): Force {
  if (kind === "thread") return "fate";
  if (kind === "system") return "system";
  return "world"; // character / location / artifact
}

function blankNode(
  id: string,
  kind: NetworkNodeKind,
  label: string,
  attributions: Map<string, number>,
  recentAttributions: Map<string, number>,
  firstSeen: Map<string, number>,
  lastSeen: Map<string, number>,
): NetworkNode {
  return {
    id,
    kind,
    label,
    attributions: attributions.get(id) ?? 0,
    recentAttributions: recentAttributions.get(id) ?? 0,
    firstSeenIndex: firstSeen.get(id) ?? -1,
    lastSeenIndex: lastSeen.get(id) ?? -1,
    // Placeholders — classifiers fill these in.
    tier: "cold",
    trajectory: "dormant",
    topology: "isolated",
    forceAnchor: null,
  };
}

/** Look up a node by id. Convenient for inline labelling in narrative context. */
export function buildTierLookup(network: NetworkGraph): Map<string, NetworkNode> {
  return new Map(network.nodes.map((n) => [n.id, n]));
}


/** Compact human-readable annotation for prompt context. Renders all four
 *  dimensions in a single brace expression — `{tier ×N, trajectory, topology,
 *  force-anchor}`. forceAnchor is omitted when null (balanced).
 *
 *  Examples:
 *    {hot ×14, rising, bridge, fate-anchor}
 *    {warm ×4, cooling, leaf}
 *    {cold ×0, dormant, isolated}
 *    {fresh ×1, rising, hub, world-anchor}
 */
export function formatTierLabel(node: NetworkNode | undefined): string {
  if (!node) return "";
  const parts: string[] = [`${node.tier} ×${node.attributions}`, node.trajectory, node.topology];
  if (node.forceAnchor) parts.push(`${node.forceAnchor}-anchor`);
  return `{${parts.join(", ")}}`;
}
