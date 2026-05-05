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
 * Each node carries two annotation dimensions:
 *
 *   1. tier     — heat snapshot       (hot / warm / cold / fresh)
 *   2. topology — position in the web (bridge / hub / leaf / isolated)
 *
 * Tier answers "how load-bearing is this node right now"; topology answers
 * "is it a cross-force connector, a within-cohort centre, a peripheral leaf,
 * or standing alone". Everything else the narrative already records directly
 * on the entity (threads carry market state, characters carry continuity,
 * scenes carry deltas) — duplicating it as network annotations was noise.
 */

import type { NarrativeState } from "@/types/narrative";

/** Window in graphs where freshly-introduced nodes get the "fresh" tier
 *  regardless of count. Set to 1 — only nodes first seen in the LATEST
 *  reasoning graph qualify as fresh. Wider windows preempt the hot/warm/cold
 *  tertile classifier in early game (3 graphs × FRESH_WINDOW=3 means every
 *  attributed node is fresh) — keeping it tight makes freshness a small,
 *  meaningful cohort. */
export const FRESH_WINDOW = 1;

/** Minimum attribution count required to be classified as "hot" — even when
 *  a node sits in the top tertile, it can't be hot until it's actually been
 *  referenced this many times. Prevents single-attribution nodes from
 *  reading as load-bearing in early game. */
const HOT_MIN_ATTRIBUTIONS = 2;

export type NetworkNodeKind =
  | "character"
  | "location"
  | "artifact"
  | "thread"
  | "system";

export type Force = "fate" | "world" | "system";

export type HeatTier = "hot" | "warm" | "cold" | "fresh";
export type Topology = "bridge" | "hub" | "leaf" | "isolated";

export type NetworkNode = {
  id: string;
  kind: NetworkNodeKind;
  label: string;
  /** Total attributions across all aggregated reasoning graphs. */
  attributions: number;
  /** Reasoning-graph index where this node first received an attribution.
   *  -1 if the node has never been referenced. */
  firstSeenIndex: number;
  /** Reasoning-graph index of the most recent attribution. -1 if never. */
  lastSeenIndex: number;
  /** Heat snapshot — relative to the rest of the network. */
  tier: HeatTier;
  /** Position in the network web. Bridges connect ≥2 distinct cohorts;
   *  hubs are well-connected within one cohort; leafs have a single edge;
   *  isolated have none. */
  topology: Topology;
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
  // In progressive mode we also collect the set of entity / system ids that
  // have actually been introduced by scenes or world builds at or before the
  // cutoff, so a later world expansion's nodes don't leak into earlier views.
  const useProgressive = resolvedKeys !== undefined && currentIndex !== undefined;
  let timelineOrderedItems: Array<{ kind: "arc"; id: string } | { kind: "world_build"; id: string }> = [];
  const introducedEntityIds = new Set<string>();
  const introducedSystemIds = new Set<string>();

  if (useProgressive) {
    const keysInRange = resolvedKeys!.slice(0, currentIndex! + 1);
    const seenArcs = new Set<string>();
    for (const key of keysInRange) {
      const scene = narrative.scenes[key];
      if (scene) {
        if (scene.arcId && !seenArcs.has(scene.arcId)) {
          seenArcs.add(scene.arcId);
          timelineOrderedItems.push({ kind: "arc", id: scene.arcId });
        }
        for (const c of scene.newCharacters ?? []) introducedEntityIds.add(c.id);
        for (const l of scene.newLocations ?? []) introducedEntityIds.add(l.id);
        for (const a of scene.newArtifacts ?? []) introducedEntityIds.add(a.id);
        for (const t of scene.newThreads ?? []) introducedEntityIds.add(t.id);
        for (const sn of scene.systemDeltas?.addedNodes ?? []) introducedSystemIds.add(sn.id);
        continue;
      }
      const wb = narrative.worldBuilds[key];
      if (wb) {
        timelineOrderedItems.push({ kind: "world_build", id: wb.id });
        for (const c of wb.expansionManifest.newCharacters) introducedEntityIds.add(c.id);
        for (const l of wb.expansionManifest.newLocations) introducedEntityIds.add(l.id);
        for (const a of wb.expansionManifest.newArtifacts ?? []) introducedEntityIds.add(a.id);
        for (const t of wb.expansionManifest.newThreads) introducedEntityIds.add(t.id);
        for (const sn of wb.expansionManifest.systemDeltas?.addedNodes ?? []) introducedSystemIds.add(sn.id);
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

  void attributionPerGraph; // per-graph history no longer consumed

  // Build the raw nodes — one per real entity/thread/system node, including
  // unreferenced ones (they appear cold/isolated). In progressive mode skip
  // anything not yet introduced by the cutoff so a later world build's
  // characters / threads / system nodes don't bleed back into earlier scenes.
  const includeEntity = (id: string) => !useProgressive || introducedEntityIds.has(id);
  const includeSystem = (id: string) => !useProgressive || introducedSystemIds.has(id);
  const rawNodes: NetworkNode[] = [];
  for (const c of Object.values(narrative.characters)) {
    if (!includeEntity(c.id)) continue;
    rawNodes.push(blankNode(c.id, "character", c.name, attributions, firstSeen, lastSeen));
  }
  for (const l of Object.values(narrative.locations)) {
    if (!includeEntity(l.id)) continue;
    rawNodes.push(blankNode(l.id, "location", l.name, attributions, firstSeen, lastSeen));
  }
  for (const a of Object.values(narrative.artifacts ?? {})) {
    if (!includeEntity(a.id)) continue;
    rawNodes.push(blankNode(a.id, "artifact", a.name, attributions, firstSeen, lastSeen));
  }
  for (const t of Object.values(narrative.threads)) {
    if (!includeEntity(t.id)) continue;
    rawNodes.push(blankNode(t.id, "thread", t.description, attributions, firstSeen, lastSeen));
  }
  for (const s of Object.values(narrative.systemGraph?.nodes ?? {})) {
    if (!includeSystem(s.id)) continue;
    rawNodes.push(blankNode(s.id, "system", s.concept, attributions, firstSeen, lastSeen));
  }

  // Tiers — comparative, computed first so topology sees them.
  let nodes = classifyTiers(rawNodes, graphCount);

  // Edges (filtered to known nodes) — needed for topology.
  const knownIds = new Set(nodes.map((n) => n.id));
  const edges: NetworkEdge[] = [];
  for (const [key, weight] of edgeWeights.entries()) {
    const [from, to] = key.split("|");
    if (knownIds.has(from) && knownIds.has(to)) {
      edges.push({ from, to, weight });
    }
  }

  // Topology — uses edges + neighbour kinds.
  const kindLookup = new Map(nodes.map((n) => [n.id, n.kind]));
  nodes = classifyTopology(nodes, edges, kindLookup);

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

/** Compute degree-based topology. Bridges connect ≥2 distinct force
 *  cohorts; hubs are well-connected within a single cohort; leafs have a
 *  single edge; isolated have none. */
export function classifyTopology(
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
      const forces = new Set<Force>();
      for (const nid of adj) {
        const k = kindLookup.get(nid);
        if (k) forces.add(forceOfKind(k));
      }
      topology = forces.size >= 2 ? "bridge" : "hub";
    }
    return { ...n, topology };
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
    const cold = cohort.filter((n) => n.tier === "cold").length;
    const fresh = cohort.filter((n) => n.tier === "fresh").length;

    let verdict = "balanced";
    if (cohort.length === 0) verdict = "empty";
    else if (cold / cohort.length > 0.6) verdict = "shallow (most untouched)";
    else if (hot / cohort.length > 0.6) verdict = "saturated";
    else if (fresh > 0) verdict = "expanding";

    return `- ${label} (${cohort.length}): ${hot} hot · ${warm} warm · ${fresh} fresh · ${cold} cold — ${verdict}.`;
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
  firstSeen: Map<string, number>,
  lastSeen: Map<string, number>,
): NetworkNode {
  return {
    id,
    kind,
    label,
    attributions: attributions.get(id) ?? 0,
    firstSeenIndex: firstSeen.get(id) ?? -1,
    lastSeenIndex: lastSeen.get(id) ?? -1,
    // Placeholders — classifiers fill these in.
    tier: "cold",
    topology: "isolated",
  };
}

/** Look up a node by id. Convenient for inline labelling in narrative context. */
export function buildTierLookup(network: NetworkGraph): Map<string, NetworkNode> {
  return new Map(network.nodes.map((n) => [n.id, n]));
}


/** Compact human-readable annotation for prompt context.
 *
 *  Examples:
 *    {hot ×14, bridge}
 *    {warm ×4, leaf}
 *    {cold ×0, isolated}
 *    {fresh ×1, hub}
 */
export function formatTierLabel(node: NetworkNode | undefined): string {
  if (!node) return "";
  return `{${node.tier} ×${node.attributions}, ${node.topology}}`;
}
