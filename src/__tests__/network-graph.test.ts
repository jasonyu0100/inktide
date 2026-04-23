import { describe, expect, test } from "vitest";
import {
  aggregateNetworkGraph,
  classifyTiers,
  classifyTopology,
  formatTierLabel,
  forceOfKind,
  summarizeNetworkState,
  type NetworkEdge,
  type NetworkNode,
  type NetworkNodeKind,
} from "@/lib/network-graph";
import type {
  Arc,
  Character,
  Location,
  NarrativeState,
  ReasoningGraphSnapshot,
  Thread,
  WorldBuild,
} from "@/types/narrative";

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeNarrative(overrides: Partial<NarrativeState> = {}): NarrativeState {
  return {
    title: "Test",
    worldSummary: "",
    characters: {},
    locations: {},
    artifacts: {},
    threads: {},
    arcs: {},
    scenes: {},
    worldBuilds: {},
    relationships: [],
    branches: {},
    structureEvaluations: [],
    proseEvaluations: [],
    planEvaluations: [],
    systemGraph: { nodes: {}, edges: [] },
    patterns: [],
    antiPatterns: [],
    ...overrides,
  } as NarrativeState;
}

function makeCharacter(id: string, name = id): Character {
  return {
    id,
    name,
    role: "anchor",
    threadIds: [],
    world: { nodes: {}, edges: [] },
  } as Character;
}

function makeLocation(id: string, name = id): Location {
  return {
    id,
    name,
    prominence: "place",
    parentId: null,
    threadIds: [],
    tiedCharacterIds: [],
    world: { nodes: {}, edges: [] },
  } as Location;
}

function makeThread(id: string, description = id): Thread {
  return {
    id,
    description,
    outcomes: ["yes", "no"],
    beliefs: { narrator: { logits: [0, 0], volume: 2, volatility: 0 } },
    participants: [],
    openedAt: "",
    dependents: [],
    threadLog: { nodes: {}, edges: [] },
  } as Thread;
}

function makeArc(id: string, sceneIds: string[] = [], reasoningGraph?: ReasoningGraphSnapshot): Arc {
  return {
    id,
    name: id,
    sceneIds,
    develops: [],
    locationIds: [],
    activeCharacterIds: [],
    initialCharacterLocations: {},
    reasoningGraph,
  } as Arc;
}

function makeWorldBuild(id: string, reasoningGraph?: ReasoningGraphSnapshot): WorldBuild {
  return {
    kind: "world_build",
    id,
    summary: "",
    expansionManifest: {
      newCharacters: [],
      newLocations: [],
      newArtifacts: [],
      newThreads: [],
    },
    reasoningGraph,
  } as WorldBuild;
}

function makeReasoningGraph(
  nodes: Array<{ id: string; type: string; entityId?: string; threadId?: string; systemNodeId?: string }>,
  edges: Array<{ id: string; from: string; to: string }> = [],
): ReasoningGraphSnapshot {
  return {
    arcName: "test",
    sceneCount: 1,
    summary: "",
    nodes: nodes.map((n, i) => ({
      id: n.id,
      index: i,
      label: n.id,
      type: n.type as ReasoningGraphSnapshot["nodes"][0]["type"],
      entityId: n.entityId,
      threadId: n.threadId,
      systemNodeId: n.systemNodeId,
    })),
    edges: edges.map((e) => ({ id: e.id, from: e.from, to: e.to, type: "causes" })),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("aggregateNetworkGraph", () => {
  test("includes every entity / thread / system node from the narrative — even unreferenced ones", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01"), "C-02": makeCharacter("C-02") },
      threads: { "T-01": makeThread("T-01") },
      systemGraph: {
        nodes: { "SYS-01": { id: "SYS-01", concept: "rule", type: "principle" } },
        edges: [],
      },
    });
    const network = aggregateNetworkGraph(narrative);
    const ids = network.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["C-01", "C-02", "SYS-01", "T-01"]);
    // None referenced — all cold with 0 attributions.
    for (const n of network.nodes) {
      expect(n.attributions).toBe(0);
      expect(n.tier).toBe("cold");
    }
  });

  test("counts attributions for character / location / artifact via entityId", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01") },
      arcs: {
        "A-01": makeArc("A-01", ["S-01"], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-01" },
          { id: "n2", type: "character", entityId: "C-01" },
        ])),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    const c01 = network.nodes.find((n) => n.id === "C-01")!;
    expect(c01.attributions).toBe(2);
  });

  test("counts attributions for fate via threadId", () => {
    const narrative = makeNarrative({
      threads: { "T-01": makeThread("T-01") },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph([
          { id: "n1", type: "fate", threadId: "T-01" },
        ])),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    const t01 = network.nodes.find((n) => n.id === "T-01")!;
    expect(t01.attributions).toBe(1);
  });

  test("counts attributions for system via systemNodeId", () => {
    const narrative = makeNarrative({
      systemGraph: {
        nodes: { "SYS-01": { id: "SYS-01", concept: "rule", type: "principle" } },
        edges: [],
      },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph([
          { id: "n1", type: "system", systemNodeId: "SYS-01" },
        ])),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    const sys = network.nodes.find((n) => n.id === "SYS-01")!;
    expect(sys.attributions).toBe(1);
  });

  test("skips chaos / pattern / warning / reasoning nodes (outside-force types)", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01") },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph([
          // entityId here would be hallucinated for these types — must NOT count
          { id: "n1", type: "chaos", entityId: "C-01" },
          { id: "n2", type: "pattern", entityId: "C-01" },
          { id: "n3", type: "warning", entityId: "C-01" },
          { id: "n4", type: "reasoning", entityId: "C-01" },
        ])),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    const c01 = network.nodes.find((n) => n.id === "C-01")!;
    expect(c01.attributions).toBe(0);
    expect(c01.tier).toBe("cold");
  });

  test("aggregates across multiple arcs and world builds", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01") },
      threads: { "T-01": makeThread("T-01") },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-01" },
        ])),
        "A-02": makeArc("A-02", [], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-01" },
          { id: "n2", type: "fate", threadId: "T-01" },
        ])),
      },
      worldBuilds: {
        "WB-01": makeWorldBuild("WB-01", makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-01" },
        ])),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    expect(network.graphCount).toBe(3);
    expect(network.nodes.find((n) => n.id === "C-01")!.attributions).toBe(3);
    expect(network.nodes.find((n) => n.id === "T-01")!.attributions).toBe(1);
  });

  test("builds undirected co-occurrence edges from explicit reasoning-graph edges", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01") },
      locations: { "L-01": makeLocation("L-01") },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph(
          [
            { id: "n1", type: "character", entityId: "C-01" },
            { id: "n2", type: "location", entityId: "L-01" },
          ],
          [{ id: "e1", from: "n1", to: "n2" }],
        )),
        "A-02": makeArc("A-02", [], makeReasoningGraph(
          [
            { id: "n1", type: "location", entityId: "L-01" },
            { id: "n2", type: "character", entityId: "C-01" },
          ],
          [{ id: "e1", from: "n1", to: "n2" }],
        )),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    expect(network.edges).toHaveLength(1);
    // The edge should aggregate both arcs (weight 2) since direction is collapsed.
    expect(network.edges[0].weight).toBe(2);
  });

  test("ignores edges that connect to skipped node types (chaos, reasoning, etc.)", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01") },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph(
          [
            { id: "n1", type: "character", entityId: "C-01" },
            { id: "n2", type: "reasoning" },
          ],
          [{ id: "e1", from: "n1", to: "n2" }],
        )),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    expect(network.edges).toHaveLength(0);
  });

  test("progressive aggregation respects the current-scene cutoff", () => {
    // A-01 has scene S-01 (index 0); A-02 has scene S-02 (index 1). Each
    // arc references a distinct character. With cutoff=0, only A-01's
    // attribution should appear.
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01"), "C-02": makeCharacter("C-02") },
      scenes: {
        "S-01": { kind: "scene", id: "S-01", arcId: "A-01" } as never,
        "S-02": { kind: "scene", id: "S-02", arcId: "A-02" } as never,
      },
      arcs: {
        "A-01": makeArc("A-01", ["S-01"], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-01" },
        ])),
        "A-02": makeArc("A-02", ["S-02"], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-02" },
        ])),
      },
    });
    const resolvedKeys = ["S-01", "S-02"];

    const upToFirst = aggregateNetworkGraph(narrative, resolvedKeys, 0);
    expect(upToFirst.graphCount).toBe(1);
    expect(upToFirst.nodes.find((n) => n.id === "C-01")!.attributions).toBe(1);
    expect(upToFirst.nodes.find((n) => n.id === "C-02")!.attributions).toBe(0);

    const upToSecond = aggregateNetworkGraph(narrative, resolvedKeys, 1);
    expect(upToSecond.graphCount).toBe(2);
    expect(upToSecond.nodes.find((n) => n.id === "C-02")!.attributions).toBe(1);
  });

  test("firstSeenIndex tracks the first reasoning graph that referenced a node", () => {
    const narrative = makeNarrative({
      characters: { "C-01": makeCharacter("C-01"), "C-02": makeCharacter("C-02") },
      arcs: {
        "A-01": makeArc("A-01", [], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-01" },
        ])),
        "A-02": makeArc("A-02", [], makeReasoningGraph([
          { id: "n1", type: "character", entityId: "C-02" },
        ])),
      },
    });
    const network = aggregateNetworkGraph(narrative);
    expect(network.nodes.find((n) => n.id === "C-01")!.firstSeenIndex).toBe(0);
    expect(network.nodes.find((n) => n.id === "C-02")!.firstSeenIndex).toBe(1);
  });
});

describe("classifyTiers", () => {
  function nodeWith(id: string, attributions: number, firstSeenIndex = -1): NetworkNode {
    return {
      id,
      kind: "character",
      label: id,
      attributions,
      firstSeenIndex,
      lastSeenIndex: -1,
      tier: "cold",
      topology: "isolated",
    };
  }

  test("zero-attribution nodes are cold", () => {
    const out = classifyTiers([nodeWith("a", 0), nodeWith("b", 5)], 1);
    expect(out.find((n) => n.id === "a")!.tier).toBe("cold");
  });

  test("only nodes first seen in the LATEST graph are fresh (FRESH_WINDOW=1)", () => {
    // 5 graphs total; freshThreshold = 5 - 1 = 4. Only firstSeenIndex >= 4 fresh.
    const out = classifyTiers(
      [nodeWith("a", 1, 4), nodeWith("b", 1, 3), nodeWith("c", 1, 0)],
      5,
    );
    expect(out.find((n) => n.id === "a")!.tier).toBe("fresh");
    expect(out.find((n) => n.id === "b")!.tier).not.toBe("fresh");
    expect(out.find((n) => n.id === "c")!.tier).not.toBe("fresh");
  });

  test("freshness disabled when totalGraphs <= 1 (no historic baseline)", () => {
    // 1 graph; without history there's nothing to be fresh against — let
    // tertile bucketing decide.
    const out = classifyTiers([nodeWith("a", 5, 0), nodeWith("b", 1, 0)], 1);
    expect(out.find((n) => n.id === "a")!.tier).not.toBe("fresh");
    expect(out.find((n) => n.id === "b")!.tier).not.toBe("fresh");
  });

  test("hot requires HOT_MIN_ATTRIBUTIONS even when in top tertile", () => {
    // Three nodes, all with attributions=1. Top tertile would normally be
    // hot but the minimum-2 floor keeps everything warm at most.
    const out = classifyTiers(
      [nodeWith("a", 1, 0), nodeWith("b", 1, 0), nodeWith("c", 1, 0)],
      10,
    );
    for (const n of out) expect(n.tier).not.toBe("hot");
  });

  test("buckets non-fresh attributed nodes into hot/warm/cold tertiles", () => {
    const out = classifyTiers(
      [
        nodeWith("a", 1, 0),
        nodeWith("b", 5, 0),
        nodeWith("c", 10, 0),
      ],
      10,
    );
    expect(out.find((n) => n.id === "c")!.tier).toBe("hot");
    expect(out.find((n) => n.id === "a")!.tier).toBe("cold");
  });

  test("regression: 3 graphs doesn't mark every attributed node fresh", () => {
    // The user-reported bug: with FRESH_WINDOW=3 and totalGraphs=3, the old
    // code marked everything fresh. New calibration: only graph-2 nodes
    // (latest) are fresh; older introductions get tertile classification.
    const out = classifyTiers(
      [
        nodeWith("a", 3, 0),
        nodeWith("b", 3, 1),
        nodeWith("c", 3, 2),
        nodeWith("d", 3, 0),
      ],
      3,
    );
    expect(out.find((n) => n.id === "c")!.tier).toBe("fresh");
    expect(out.find((n) => n.id === "a")!.tier).not.toBe("fresh");
    expect(out.find((n) => n.id === "b")!.tier).not.toBe("fresh");
  });

  test("empty input returns empty array", () => {
    expect(classifyTiers([], 0)).toEqual([]);
  });
});

describe("classifyTopology", () => {
  function makeNode(id: string, kind: NetworkNodeKind = "character"): NetworkNode {
    return {
      id, kind, label: id,
      attributions: 1,
      firstSeenIndex: 0, lastSeenIndex: 0,
      tier: "warm", topology: "isolated",
    };
  }

  function classify(nodes: NetworkNode[], edges: NetworkEdge[]): NetworkNode[] {
    const lookup = new Map(nodes.map((n) => [n.id, n.kind]));
    return classifyTopology(nodes, edges, lookup);
  }

  test("no edges → isolated", () => {
    const out = classify([makeNode("a")], []);
    expect(out[0].topology).toBe("isolated");
  });

  test("single edge → leaf", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const edges: NetworkEdge[] = [{ from: "a", to: "b", weight: 1 }];
    const out = classify(nodes, edges);
    expect(out.find((n) => n.id === "a")!.topology).toBe("leaf");
  });

  test("multiple edges all within one force cohort → hub", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges: NetworkEdge[] = [
      { from: "c", to: "a", weight: 1 },
      { from: "c", to: "b", weight: 1 },
    ];
    const out = classify(nodes, edges);
    expect(out.find((n) => n.id === "c")!.topology).toBe("hub");
  });

  test("edges spanning ≥2 force cohorts → bridge", () => {
    const nodes = [
      makeNode("c", "character"),
      makeNode("t", "thread"),
      makeNode("ch", "character"),
    ];
    const edges: NetworkEdge[] = [
      { from: "c", to: "t", weight: 1 },
      { from: "c", to: "ch", weight: 1 },
    ];
    const out = classify(nodes, edges);
    expect(out.find((n) => n.id === "c")!.topology).toBe("bridge");
  });
});

describe("forceOfKind", () => {
  test("threads → fate, system → system, c/l/a → world", () => {
    expect(forceOfKind("thread")).toBe("fate");
    expect(forceOfKind("system")).toBe("system");
    expect(forceOfKind("character")).toBe("world");
    expect(forceOfKind("location")).toBe("world");
    expect(forceOfKind("artifact")).toBe("world");
  });
});

describe("summarizeNetworkState", () => {
  test("empty network", () => {
    expect(summarizeNetworkState({ nodes: [], edges: [], graphCount: 0 })).toMatch(/empty/i);
  });

  test("nodes but no graphs reads as no-graphs state", () => {
    const nodes: NetworkNode[] = [{
      id: "C-01", kind: "character", label: "A",
      attributions: 0,
      firstSeenIndex: -1, lastSeenIndex: -1,
      tier: "cold", topology: "isolated",
    }];
    const out = summarizeNetworkState({ nodes, edges: [], graphCount: 0 });
    expect(out).toMatch(/no reasoning graphs/i);
  });

  test("includes per-cohort counts and topology line", () => {
    const node = (id: string, kind: NetworkNodeKind, tier: NetworkNode["tier"]): NetworkNode => ({
      id, kind, label: id,
      attributions: tier === "cold" ? 0 : 1,
      firstSeenIndex: 0, lastSeenIndex: 0,
      tier, topology: "isolated",
    });
    const nodes = [node("C-01", "character", "hot"), node("T-01", "thread", "warm"), node("SYS-01", "system", "cold")];
    const out = summarizeNetworkState({ nodes, edges: [], graphCount: 3 });
    expect(out).toContain("Fate");
    expect(out).toContain("World");
    expect(out).toContain("System");
    expect(out).toContain("Topology");
  });
});

describe("formatTierLabel", () => {
  function makeNode(overrides: Partial<NetworkNode>): NetworkNode {
    return {
      id: "a", kind: "character", label: "A",
      attributions: 0,
      firstSeenIndex: -1, lastSeenIndex: -1,
      tier: "cold", topology: "isolated",
      ...overrides,
    };
  }

  test("undefined node returns empty string", () => {
    expect(formatTierLabel(undefined)).toBe("");
  });

  test("never-referenced cold node renders tier + topology", () => {
    expect(formatTierLabel(makeNode({}))).toBe("{cold ×0, isolated}");
  });

  test("hot bridge attributed node", () => {
    const node = makeNode({ attributions: 5, tier: "hot", topology: "bridge" });
    expect(formatTierLabel(node)).toBe("{hot ×5, bridge}");
  });

  test("warm hub node", () => {
    const node = makeNode({ attributions: 4, tier: "warm", topology: "hub" });
    expect(formatTierLabel(node)).toBe("{warm ×4, hub}");
  });
});
