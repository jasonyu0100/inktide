import type { NarrativeState, WorldBuild } from "@/types/narrative";
import { REASONING_BUDGETS, resolveEntry } from "@/types/narrative";
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from "./api";
import { narrativeContext, getStateAtIndex } from "./context";
import { parseJson } from "./json";
import { buildCumulativeSystemGraph } from "@/lib/narrative-utils";

// ── Plan Node Scaling ─────────────────────────────────────────────────────────
// Coordination plans scale node counts based on arc budget to ensure proper
// reasoning depth. More arcs = more waypoints, terminals, and reasoning nodes.

/**
 * Calculate expected node counts for a coordination plan based on arc budget.
 * Returns guidance for minimum nodes per category.
 * Emphasizes DEPTH (chains of reasoning) not just BREADTH (many disconnected nodes).
 */
function getPlanNodeGuidance(arcTarget: number, threadCount: number): {
  minWaypoints: number;
  minTerminals: number;
  minReasoningNodes: number;
  minPatterns: number;
  minWarnings: number;
  minCharacterNodes: number;
  minSystemNodes: number;
  minChainDepth: number;
} {
  // Each active thread needs at least 1 terminal + waypoints proportional to arcs
  const waypointsPerThread = Math.max(2, Math.floor(arcTarget / 3));
  const minWaypoints = Math.min(threadCount * waypointsPerThread, arcTarget * 2);

  // Terminals scale with thread count (resolved/subverted/unanswered endpoints)
  const minTerminals = Math.max(threadCount, Math.ceil(arcTarget / 2));

  // Reasoning nodes scale with plan complexity — emphasis on DEEP chains
  // Formula: base + (arcs * threads factor) — want substantial reasoning
  const minReasoningNodes = Math.max(5, Math.floor(arcTarget * 1.5) + Math.floor(threadCount * 0.5));

  // Patterns and warnings scale moderately
  const minPatterns = Math.max(2, Math.floor(arcTarget / 4));
  const minWarnings = Math.max(2, Math.floor(arcTarget / 4));

  // Character and system nodes ground reasoning in the world
  const minCharacterNodes = Math.max(2, Math.floor(threadCount * 0.5));
  const minSystemNodes = Math.max(2, Math.floor(arcTarget / 4));

  // Chain depth — minimum reasoning steps from terminal to earliest waypoint
  const minChainDepth = Math.max(3, Math.floor(arcTarget / 2));

  return {
    minWaypoints,
    minTerminals,
    minReasoningNodes,
    minPatterns,
    minWarnings,
    minCharacterNodes,
    minSystemNodes,
    minChainDepth,
  };
}

// Valid node and edge types for validation
// Threads as fate: can influence events anywhere in the reasoning chain
const VALID_NODE_TYPES = new Set([
  "fate",        // Thread's gravitational pull — influences events toward resolution or unexpected turns
  "character",   // Active agent that fulfills requirements
  "location",    // Setting that enables/constrains action
  "artifact",    // Object with narrative significance
  "system",      // World rule or principle
  "reasoning",   // A step in the logical chain
  "pattern",     // Positive pattern to reinforce (cooperative)
  "warning",     // Anti-pattern risk to avoid (adversarial)
]);
const VALID_EDGE_TYPES = new Set(["enables", "constrains", "risks", "requires", "causes", "reveals", "develops", "resolves"]);

// ── Node Types ───────────────────────────────────────────────────────────────

export type ReasoningNodeType =
  | "fate"         // Thread's gravitational pull — influences events toward resolution or unexpected turns
  | "character"    // Active agent that fulfills requirements
  | "location"     // Setting that enables/constrains action
  | "artifact"     // Object with narrative significance
  | "system"       // World rule or principle
  | "reasoning"    // A step in the logical chain
  | "pattern"      // Positive pattern to reinforce (cooperative)
  | "warning";     // Anti-pattern risk to avoid (adversarial)

export type ReasoningEdgeType =
  | "enables"      // A enables B
  | "constrains"   // A limits/blocks B
  | "risks"        // A creates risk for B
  | "requires"     // A needs B
  | "causes"       // A leads to B
  | "reveals"      // A exposes B
  | "develops"     // A deepens B (thread/character)
  | "resolves";    // A concludes B

export interface ReasoningNode {
  id: string;
  index: number;           // Sequential index for stepping through
  type: ReasoningNodeType;
  label: string;           // Short label (3-8 words)
  detail?: string;         // Expanded explanation
  entityId?: string;       // Reference to actual entity (character/location/artifact ID)
  threadId?: string;       // For outcome nodes - which thread is affected
}

export interface ReasoningEdge {
  id: string;
  from: string;            // Node ID
  to: string;              // Node ID
  type: ReasoningEdgeType;
  label?: string;          // Optional edge label
}

export interface ReasoningGraph {
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  arcName: string;
  sceneCount: number;
  summary: string;         // High-level summary of the reasoning
}

// ── Sequential Path Builder ──────────────────────────────────────────────────

/** Minimal node shape for building sequential paths */
export type ReasoningNodeBase = {
  id: string;
  index: number;
  type: string;
  label: string;
  detail?: string;
  entityId?: string;
  threadId?: string;
};

/** Minimal graph shape for building sequential paths — works with ReasoningGraph, ExpansionReasoningGraph, and CoordinationPlan */
export type ReasoningGraphBase = {
  nodes: ReasoningNodeBase[];
  edges: ReasoningEdge[];
};

/**
 * Build a sequential reasoning path from the graph for LLM consumption.
 * Nodes are ordered by index, with connection IDs inline.
 */
export function buildSequentialPath(graph: ReasoningGraphBase): string {
  const sortedNodes = [...graph.nodes].sort((a, b) => a.index - b.index);
  const edgeMap = new Map<string, ReasoningEdge[]>();

  // Build outgoing edge map
  for (const edge of graph.edges) {
    if (!edgeMap.has(edge.from)) edgeMap.set(edge.from, []);
    edgeMap.get(edge.from)!.push(edge);
  }

  const lines: string[] = [];

  for (const node of sortedNodes) {
    const outgoing = edgeMap.get(node.id) ?? [];
    const connections = outgoing
      .map(e => `${e.type}→${e.to}`)
      .join(", ");

    const connectStr = connections ? ` [${connections}]` : "";
    const entityRef = node.entityId ? ` @${node.entityId}` : "";
    const threadRef = node.threadId ? ` #${node.threadId}` : "";

    lines.push(
      `[${node.index}] ${node.type.toUpperCase()}: ${node.label}${entityRef}${threadRef}${connectStr}`
    );

    if (node.detail) {
      lines.push(`    → ${node.detail}`);
    }
  }

  return lines.join("\n");
}

// ── Generation ───────────────────────────────────────────────────────────────

export async function generateReasoningGraph(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  sceneCount: number,
  direction: string,
  arcName: string,
  onReasoning?: (token: string) => void,
): Promise<ReasoningGraph> {
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);

  // Get active threads
  const activeThreads = Object.values(narrative.threads)
    .filter((t) =>
      ["seeded", "active", "escalating", "critical"].includes(t.status),
    )
    .map((t) => `- [${t.id}] ${t.description} (${t.status})`)
    .join("\n");

  // Get key characters
  const characters = Object.values(narrative.characters)
    .filter((c) => c.role === "anchor" || c.role === "recurring")
    .slice(0, 8)
    .map((c) => `- [${c.id}] ${c.name} (${c.role})`)
    .join("\n");

  // Get key locations
  const locations = Object.values(narrative.locations)
    .filter((l) => l.prominence === "domain" || l.prominence === "place")
    .slice(0, 6)
    .map((l) => `- [${l.id}] ${l.name}`)
    .join("\n");

  // Get artifacts
  const artifacts = Object.values(narrative.artifacts ?? {})
    .filter((a) => a.significance === "key" || a.significance === "notable")
    .slice(0, 4)
    .map((a) => `- [${a.id}] ${a.name}`)
    .join("\n");

  // Get system knowledge
  const systemKnowledge = Object.values(narrative.systemGraph?.nodes ?? {})
    .filter((n) =>
      ["principle", "system", "constraint", "tension"].includes(n.type),
    )
    .slice(0, 8)
    .map((n) => `- ${n.concept} (${n.type})`)
    .join("\n");

  // Get story patterns and anti-patterns
  const patterns = narrative.patterns ?? [];
  const antiPatterns = narrative.antiPatterns ?? [];

  const patternsSection = patterns.length > 0
    ? `STORY PATTERNS (positive commandments to reinforce):\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const antiPatternsSection = antiPatterns.length > 0
    ? `ANTI-PATTERNS (pitfalls to avoid):\n${antiPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const prompt = `${ctx}

## AVAILABLE ENTITIES

ACTIVE THREADS (threads are QUESTIONS the story must answer):
${activeThreads || "None yet"}

KEY CHARACTERS:
${characters || "None yet"}

KEY LOCATIONS:
${locations || "None yet"}

KEY ARTIFACTS:
${artifacts || "None yet"}

SYSTEM KNOWLEDGE:
${systemKnowledge || "None yet"}

${patternsSection}

${antiPatternsSection}

## TASK

Build a REASONING GRAPH for "${arcName}" to guide ${sceneCount} scene(s).
Direction: ${direction}

Use BACKWARD REASONING: Start from what threads NEED, then derive what must happen.
Threads are FATE — they exert gravitational pull on events, but fate doesn't always go the expected direction. Threads can advance through twists, resistance, or subversion.

## CREATIVE MANDATE

**The context above is INSPIRATION, not a script.** Do NOT continue trajectories predictably.

**REQUIRED CREATIVE ELEMENTS** (include at least 2 in your reasoning):
1. **UNEXPECTED COLLISION**: Combine elements that have never interacted — what emerges?
2. **SUBVERT THE OBVIOUS**: What's the least expected path that still serves fate?
3. **HIDDEN COST**: What must be sacrificed or lost to achieve progress?
4. **EMERGENT PROPERTY**: When X meets Y, what new capability or dynamic appears?
5. **SECOND-ORDER EFFECT**: What does a recent event ACTUALLY mean that no one has realized?

**AVOID**: Continuing threads on obvious trajectories, using expected combinations, progress without setbacks.

## OUTPUT FORMAT

Return a JSON object:

{
  "summary": "1-2 sentence high-level summary of the arc's reasoning",
  "nodes": [
    {
      "id": "F1",
      "index": 0,
      "type": "fate",
      "label": "Thread needs escalation",
      "detail": "What this thread requires to progress — the gravitational pull",
      "threadId": "thread-id"
    },
    {
      "id": "R1",
      "index": 1,
      "type": "reasoning",
      "label": "For thread to escalate, X must happen",
      "detail": "Backward reasoning from thread requirement"
    },
    {
      "id": "C1",
      "index": 2,
      "type": "character",
      "label": "Character positioned to act",
      "detail": "Who can fulfill this requirement",
      "entityId": "actual-character-id-from-narrative"
    },
    {
      "id": "S1",
      "index": 3,
      "type": "system",
      "label": "World rule constrains how",
      "detail": "What system/rule shapes the action"
    }
  ],
  "edges": [
    {"id": "e1", "from": "F1", "to": "R1", "type": "requires"},
    {"id": "e2", "from": "R1", "to": "C1", "type": "requires"},
    {"id": "e3", "from": "S1", "to": "C1", "type": "constrains"}
  ]
}

## NODE TYPES

- **fate**: Thread's gravitational pull on events. Use threadId to reference the thread. Fate can appear ANYWHERE in the reasoning chain — it influences characters, locations, systems, and other reasoning. Fate doesn't always pull in expected directions: it can demand twists, resistance, or subversion. Label = what the thread needs or how it exerts pressure.
- **character**: An active agent. Use entityId to reference actual character. Label = their position/goal.
- **location**: A setting. Use entityId to reference actual location. Label = what it enables/constrains.
- **artifact**: An object. Use entityId to reference actual artifact. Label = its role in reasoning.
- **system**: A world rule/principle/constraint. Label = the rule as it applies here.
- **reasoning**: A logical step deriving what must happen. Label = the inference (3-8 words).
- **pattern**: EXPANSION AGENT — inject novelty. Unexpected collisions, emergent properties, hidden implications, world expansion beyond current sandbox. Label = the creative opportunity.
- **warning**: SUBVERSION AGENT — challenge predictability. Predictable trajectories, missing costs, assumptions to challenge. Label = what must be disrupted.

## EDGE TYPES

- **enables**: A makes B possible
- **constrains**: A limits/blocks B
- **risks**: A creates danger for B
- **requires**: A depends on B
- **causes**: A leads to B
- **reveals**: A exposes information in B
- **develops**: A deepens B (character arc or theme)
- **resolves**: A concludes/answers B

## REQUIREMENTS

1. **Backward reasoning**: Start from FATE (what threads need) and derive what must happen. The graph flows from thread requirements → reasoning → entities that fulfill them.
2. **Fate throughout**: Fate nodes can appear ANYWHERE — they influence events at any point. A fate node can connect to characters, locations, reasoning, even other fate nodes. Fate is the gravitational force pulling the narrative.
3. **Unexpected directions**: Fate doesn't always pull toward obvious resolution. Include fate nodes that demand twists, resistance, or subversion. A thread at "escalating" might need a setback before payoff.
4. **Sequential indexing**: Nodes are indexed 0, 1, 2... in logical reading order
5. **Entity references**: character/location/artifact nodes MUST use entityId with actual IDs
6. **Thread references**: fate nodes MUST use threadId to reference which thread exerts the pull
7. **Dense connections**: Each reasoning node should connect to 2+ other nodes
8. **Node count**: Target ${4 + sceneCount * 3}-${8 + sceneCount * 4} nodes. ${sceneCount <= 2 ? "Focused reasoning chains." : sceneCount <= 6 ? "Branching logic with multiple thread pressures." : "Complex causality with parallel fate lines."}
9. **Pattern nodes**: 1-2 nodes with GENUINE creativity — unexpected collisions, emergent properties, world expansion
10. **Warning nodes**: Flag predictable trajectories and missing costs — what assumption needs challenging?
11. **Non-deterministic**: Each reasoning path should contain at least one SURPRISE — something that doesn't follow obviously from context

The graph should reveal the strategic logic: what threads demand, and how events must unfold to serve fate.

Return ONLY the JSON object.`;

  const reasoningBudget =
    REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? "low"] ||
    undefined;

  const raw = onReasoning
    ? await callGenerateStream(
        prompt,
        SYSTEM_PROMPT,
        () => {}, // No token streaming for main output
        undefined,
        "generateReasoningGraph",
        undefined,
        reasoningBudget,
        onReasoning,
      )
    : await callGenerate(
        prompt,
        SYSTEM_PROMPT,
        undefined,
        "generateReasoningGraph",
        undefined,
        reasoningBudget,
      );

  // Parse JSON response
  try {
    let jsonStr = raw.trim();
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const data = JSON.parse(jsonStr);

    // Validate and normalize
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Invalid graph structure: missing nodes");
    }
    if (!data.edges || !Array.isArray(data.edges)) {
      data.edges = [];
    }

    // Ensure all nodes have required fields and valid types
    const nodes: ReasoningNode[] = data.nodes.map((n: Partial<ReasoningNode>, i: number) => ({
      id: typeof n.id === "string" ? n.id : `N${i}`,
      index: typeof n.index === "number" ? n.index : i,
      type: (typeof n.type === "string" && VALID_NODE_TYPES.has(n.type)) ? n.type as ReasoningNodeType : "reasoning",
      label: typeof n.label === "string" ? n.label.slice(0, 200) : "Unlabeled node",
      detail: typeof n.detail === "string" ? n.detail.slice(0, 500) : undefined,
      entityId: typeof n.entityId === "string" ? n.entityId : undefined,
      threadId: typeof n.threadId === "string" ? n.threadId : undefined,
    }));

    // Ensure all edges have required fields, valid types, and reference existing nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: ReasoningEdge[] = data.edges
      .map((e: Partial<ReasoningEdge>, i: number) => ({
        id: typeof e.id === "string" ? e.id : `E${i}`,
        from: typeof e.from === "string" ? e.from : "",
        to: typeof e.to === "string" ? e.to : "",
        type: (typeof e.type === "string" && VALID_EDGE_TYPES.has(e.type)) ? e.type as ReasoningEdgeType : "causes",
        label: typeof e.label === "string" ? e.label.slice(0, 100) : undefined,
      }))
      .filter((e: ReasoningEdge) => e.from && e.to && nodeIds.has(e.from) && nodeIds.has(e.to));

    return {
      nodes,
      edges,
      arcName,
      sceneCount,
      summary: typeof data.summary === "string" ? data.summary.slice(0, 500) : `Reasoning graph for ${arcName}`,
    };
  } catch (err) {
    console.error("Failed to parse reasoning graph:", err);
    // Return minimal fallback
    return {
      nodes: [
        {
          id: "R1",
          index: 0,
          type: "reasoning",
          label: `${arcName} - graph generation failed`,
          detail: String(err),
        },
      ],
      edges: [],
      arcName,
      sceneCount,
      summary: "Failed to generate reasoning graph",
    };
  }
}

// ── Expansion Reasoning Graph ─────────────────────────────────────────────────

export type ExpansionReasoningGraph = {
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  expansionName: string;
  summary: string;
};

/**
 * Generate a reasoning graph for world expansion.
 * This captures the strategic logic driving WHY new entities should be added
 * and HOW they connect to the existing world.
 */
export async function generateExpansionReasoningGraph(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  directive: string,
  size: "small" | "medium" | "large" | "exact",
  strategy: "depth" | "breadth" | "dynamic",
  onReasoning?: (token: string) => void,
): Promise<ExpansionReasoningGraph> {
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);

  // Get active threads
  const activeThreads = Object.values(narrative.threads)
    .filter((t) =>
      ["seeded", "active", "escalating", "critical"].includes(t.status),
    )
    .map((t) => `- [${t.id}] ${t.description} (${t.status})`)
    .join("\n");

  // Get all characters with continuity depth
  const characters = Object.values(narrative.characters)
    .map((c) => {
      const depth = Object.keys(c.continuity?.nodes ?? {}).length;
      return `- [${c.id}] ${c.name} (${c.role}, ${depth} knowledge nodes)`;
    })
    .join("\n");

  // Get all locations with hierarchy
  const locations = Object.values(narrative.locations)
    .map((l) => {
      const parent = l.parentId ? narrative.locations[l.parentId]?.name : null;
      return `- [${l.id}] ${l.name}${parent ? ` (inside ${parent})` : ""} [${l.prominence}]`;
    })
    .join("\n");

  // Get artifacts
  const artifacts = Object.values(narrative.artifacts ?? {})
    .map((a) => `- [${a.id}] ${a.name} (${a.significance})`)
    .join("\n");

  // Get system knowledge
  const systemKnowledge = Object.values(narrative.systemGraph?.nodes ?? {})
    .slice(0, 12)
    .map((n) => `- ${n.concept} (${n.type})`)
    .join("\n");

  // Get relationships
  const relationships = narrative.relationships
    .slice(0, 15)
    .map((r) => {
      const fromName = narrative.characters[r.from]?.name ?? r.from;
      const toName = narrative.characters[r.to]?.name ?? r.to;
      return `- ${fromName} → ${toName}: ${r.type}`;
    })
    .join("\n");

  // Find gaps and opportunities
  const orphanedChars = Object.values(narrative.characters)
    .filter((c) => !narrative.relationships.some((r) => r.from === c.id || r.to === c.id))
    .map((c) => c.name);

  const shallowChars = Object.values(narrative.characters)
    .filter((c) => Object.keys(c.continuity?.nodes ?? {}).length < 3)
    .map((c) => c.name);

  const leafLocations = Object.values(narrative.locations)
    .filter((l) => !Object.values(narrative.locations).some((other) => other.parentId === l.id))
    .map((l) => l.name);

  // Get recent world expansions (last 3 world commits) to avoid duplication
  const recentWorldBuilds: WorldBuild[] = resolvedKeys
    .slice(-20) // Look at recent entries
    .map((k) => resolveEntry(narrative, k))
    .filter((e): e is WorldBuild => e?.kind === "world_build")
    .slice(-3); // Last 3 world commits

  const recentExpansionSection = recentWorldBuilds.length > 0
    ? `RECENT WORLD EXPANSIONS (DO NOT duplicate — build upon these instead):
${recentWorldBuilds.map((wb: WorldBuild) => {
  const chars = wb.expansionManifest.characters.map((c: { name: string }) => c.name).join(", ");
  const locs = wb.expansionManifest.locations.map((l: { name: string }) => l.name).join(", ");
  const threads = wb.expansionManifest.threads.map((t: { description: string }) => t.description).slice(0, 3).join("; ");
  return `- ${wb.summary}${chars ? `\n  Characters added: ${chars}` : ""}${locs ? `\n  Locations added: ${locs}` : ""}${threads ? `\n  Threads seeded: ${threads}` : ""}`;
}).join("\n")}`
    : "";

  // Get story patterns and anti-patterns
  const patterns = narrative.patterns ?? [];
  const antiPatterns = narrative.antiPatterns ?? [];

  const patternsSection = patterns.length > 0
    ? `STORY PATTERNS (positive commandments):\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const antiPatternsSection = antiPatterns.length > 0
    ? `ANTI-PATTERNS (pitfalls to avoid):\n${antiPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const sizeLabel = {
    small: "3-6 entities",
    medium: "10-15 entities",
    large: "20-35 entities",
    exact: "as specified in directive",
  }[size];

  // Scale node count based on expansion size
  const nodeCountTarget = {
    small: "5-8 nodes for focused reasoning",
    medium: "8-15 nodes for comprehensive reasoning",
    large: "15-25 nodes for complex multi-faceted reasoning",
    exact: "6-12 nodes scaled to directive scope",
  }[size];

  const prompt = `${ctx}

## CURRENT WORLD STATE

ACTIVE THREADS (threads are QUESTIONS the story must answer):
${activeThreads || "None yet"}

CHARACTERS:
${characters || "None yet"}

LOCATIONS:
${locations || "None yet"}

ARTIFACTS:
${artifacts || "None yet"}

SYSTEM KNOWLEDGE:
${systemKnowledge || "None yet"}

RELATIONSHIPS:
${relationships || "None yet"}

## WORLD GAPS & OPPORTUNITIES

Orphaned characters (no relationships): ${orphanedChars.length > 0 ? orphanedChars.join(", ") : "None"}
Shallow characters (<3 knowledge nodes): ${shallowChars.length > 0 ? shallowChars.join(", ") : "None"}
Leaf locations (no sub-locations): ${leafLocations.length > 0 ? leafLocations.join(", ") : "None"}

${recentExpansionSection}

${patternsSection}

${antiPatternsSection}

## TASK

Build a REASONING GRAPH for world expansion.
Directive: ${directive || "Natural expansion based on current world state"}
Size: ${sizeLabel}
Strategy: ${strategy.toUpperCase()}

Use BACKWARD REASONING: Start from what threads NEED (fate), then derive what entities must exist.
Threads are FATE — they exert gravitational pull on world-building. New entities should serve thread requirements.

## OUTPUT FORMAT

Return a JSON object:

{
  "summary": "1-2 sentence high-level summary of the expansion's reasoning",
  "nodes": [
    {
      "id": "F1",
      "index": 0,
      "type": "fate",
      "label": "Thread needs antagonist faction",
      "detail": "What this thread requires to progress",
      "threadId": "thread-id"
    },
    {
      "id": "R1",
      "index": 1,
      "type": "reasoning",
      "label": "For thread to escalate, opposition needed",
      "detail": "Backward reasoning from thread requirement"
    },
    {
      "id": "C1",
      "index": 2,
      "type": "character",
      "label": "New character fills opposition role",
      "detail": "How they serve the thread's needs",
      "entityId": "existing-character-id-to-connect-to"
    },
    {
      "id": "S1",
      "index": 3,
      "type": "system",
      "label": "Gap in world structure",
      "detail": "What's missing that enables new entity"
    }
  ],
  "edges": [
    {"id": "e1", "from": "F1", "to": "R1", "type": "requires"},
    {"id": "e2", "from": "R1", "to": "C1", "type": "requires"},
    {"id": "e3", "from": "S1", "to": "C1", "type": "enables"}
  ]
}

## NODE TYPES FOR EXPANSION

- **fate**: Thread's gravitational pull demanding world expansion. Use threadId. Fate can appear ANYWHERE — it influences what entities get added and why. Label = what the thread needs from the world.
- **character**: A new or existing character. Use entityId to reference existing character this connects to. Label = their role serving fate.
- **location**: A new or existing location. Use entityId. Label = what it enables for threads.
- **artifact**: A new or existing artifact. Use entityId. Label = its role serving fate.
- **system**: A world gap, rule, or opportunity. Label = the gap or rule being established.
- **reasoning**: A logical step explaining WHY this entity serves fate. Label = the inference (3-8 words).
- **pattern**: COOPERATIVE AGENT — positive reinforcement. What variety does this expansion introduce? Label = the opportunity.
- **warning**: ADVERSARIAL AGENT — negative reinforcement. What staleness risks must be avoided? Label = the risk.

## EDGE TYPES

- **enables**: A makes B possible
- **constrains**: A limits/blocks B
- **risks**: A creates danger for B
- **requires**: A depends on B
- **causes**: A leads to B
- **reveals**: A exposes information in B
- **develops**: A deepens B (character arc or theme)
- **resolves**: A concludes/answers B

## REQUIREMENTS

1. **Backward reasoning from fate**: Start from FATE (what threads need) and derive what entities must exist
2. **Fate throughout**: Fate nodes can appear anywhere — they justify WHY entities are added
3. **Entity references**: character/location/artifact nodes connecting to existing entities MUST use entityId
4. **Thread references**: fate nodes MUST use threadId to reference which thread exerts the pull
5. **Dense connections**: Each reasoning node should connect to 2+ other nodes
6. **Integration focus**: Every new entity should show HOW it serves existing threads via edges
7. **Node count**: Target ${nodeCountTarget}
8. **Pattern nodes**: 1-2 nodes highlighting fresh directions
9. **Warning nodes**: 1-2 nodes flagging staleness risks

The graph should reveal: what threads demand from the world, and what entities must exist to serve fate.

Return ONLY the JSON object.`;

  const reasoningBudget =
    REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? "low"] ||
    undefined;

  const raw = onReasoning
    ? await callGenerateStream(
        prompt,
        SYSTEM_PROMPT,
        () => {}, // No token streaming for main output
        undefined,
        "generateExpansionReasoningGraph",
        undefined,
        reasoningBudget,
        onReasoning,
      )
    : await callGenerate(
        prompt,
        SYSTEM_PROMPT,
        undefined,
        "generateExpansionReasoningGraph",
        undefined,
        reasoningBudget,
      );

  // Parse JSON response
  try {
    let jsonStr = raw.trim();
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const data = JSON.parse(jsonStr);

    // Validate and normalize
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Invalid graph structure: missing nodes");
    }
    if (!data.edges || !Array.isArray(data.edges)) {
      data.edges = [];
    }

    // Ensure all nodes have required fields and valid types
    const nodes: ReasoningNode[] = data.nodes.map((n: Partial<ReasoningNode>, i: number) => ({
      id: typeof n.id === "string" ? n.id : `N${i}`,
      index: typeof n.index === "number" ? n.index : i,
      type: (typeof n.type === "string" && VALID_NODE_TYPES.has(n.type)) ? n.type as ReasoningNodeType : "reasoning",
      label: typeof n.label === "string" ? n.label.slice(0, 200) : "Unlabeled node",
      detail: typeof n.detail === "string" ? n.detail.slice(0, 500) : undefined,
      entityId: typeof n.entityId === "string" ? n.entityId : undefined,
      threadId: typeof n.threadId === "string" ? n.threadId : undefined,
    }));

    // Ensure all edges have required fields, valid types, and reference existing nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: ReasoningEdge[] = data.edges
      .map((e: Partial<ReasoningEdge>, i: number) => ({
        id: typeof e.id === "string" ? e.id : `E${i}`,
        from: typeof e.from === "string" ? e.from : "",
        to: typeof e.to === "string" ? e.to : "",
        type: (typeof e.type === "string" && VALID_EDGE_TYPES.has(e.type)) ? e.type as ReasoningEdgeType : "causes",
        label: typeof e.label === "string" ? e.label.slice(0, 100) : undefined,
      }))
      .filter((e: ReasoningEdge) => e.from && e.to && nodeIds.has(e.from) && nodeIds.has(e.to));

    return {
      nodes,
      edges,
      expansionName: directive ? directive.slice(0, 50) : "World Expansion",
      summary: typeof data.summary === "string" ? data.summary.slice(0, 500) : "Reasoning graph for world expansion",
    };
  } catch (err) {
    console.error("Failed to parse expansion reasoning graph:", err);
    // Return minimal fallback
    return {
      nodes: [
        {
          id: "R1",
          index: 0,
          type: "reasoning",
          label: "Expansion reasoning failed",
          detail: String(err),
        },
      ],
      edges: [],
      expansionName: directive ? directive.slice(0, 50) : "World Expansion",
      summary: "Failed to generate expansion reasoning graph",
    };
  }
}

// ── Coordination Plan Generation ─────────────────────────────────────────────

import type {
  CoordinationPlan,
  CoordinationNode,
  CoordinationEdge,
  CoordinationNodeType,
  ThreadStatusTarget,
  ArcForceMode,
} from "@/types/narrative";

/** Valid coordination node types */
const VALID_COORDINATION_NODE_TYPES = new Set<CoordinationNodeType>([
  "fate",
  "character",
  "location",
  "artifact",
  "system",
  "reasoning",
  "pattern",
  "warning",
  "terminal",
  "waypoint",
  "arc",
  "unanswered",
]);

/** Thread target with status and optional timing */
export type ThreadTarget = {
  threadId: string;
  /** Target status the thread should reach */
  targetStatus: "resolved" | "subverted" | "critical" | "escalating" | "active" | "unanswered";
  /** When in the plan this should happen */
  timing?: "early" | "mid" | "late" | "final";
};

/** Guidance for which threads should reach which states */
export type PlanGuidance = {
  /** Thread targets with status and timing */
  threadTargets?: ThreadTarget[];
  /** Arc target — exact number of arcs to plan */
  arcTarget?: number;
  /** Direction — coordinates end fate goals that should be achieved */
  direction?: string;
  /** Constraints — what must NOT happen, restrictions on the narrative */
  constraints?: string;
};

/**
 * Generate a coordination plan for multiple arcs using backward induction.
 * The plan uses terminal states (thread endings) as anchors and works backwards
 * to derive waypoints and arc requirements.
 */
export async function generateCoordinationPlan(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  guidance: PlanGuidance,
  onReasoning?: (token: string) => void,
): Promise<CoordinationPlan> {
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);

  // Get timeline-scoped state for accurate knowledge
  const timelineState = getStateAtIndex(narrative, resolvedKeys, currentIndex);

  // Analyze current thread states
  const threads = Object.values(narrative.threads);
  const threadSummary = threads
    .filter((t) => !["resolved", "subverted", "abandoned"].includes(t.status))
    .map((t) => {
      const participantNames = t.participants.map(p => {
        if (p.type === "character") return narrative.characters[p.id]?.name ?? p.id;
        if (p.type === "location") return narrative.locations[p.id]?.name ?? p.id;
        if (p.type === "artifact") return narrative.artifacts?.[p.id]?.name ?? p.id;
        return p.id;
      }).join(", ");
      // Include thread log momentum
      const logNodes = Object.values(t.threadLog?.nodes ?? {});
      const recentLog = logNodes.slice(-3).map(n => n.content).join(" → ");
      const momentum = recentLog ? ` | momentum: ${recentLog}` : "";
      return `- [${t.id}] "${t.description}" — status: ${t.status}, participants: ${participantNames}${momentum}`;
    })
    .join("\n");

  // Key characters with continuity knowledge
  const keyCharacters = Object.values(narrative.characters)
    .filter((c) => c.role === "anchor" || c.role === "recurring")
    .slice(0, 10);

  const characters = keyCharacters
    .map((c) => {
      // Get character's accumulated knowledge
      const knowledgeNodes = Object.values(c.continuity.nodes)
        .filter(kn => timelineState.liveNodeIds.has(kn.id))
        .slice(-5); // Last 5 knowledge items
      const knowledge = knowledgeNodes.map(kn => kn.content).join("; ");
      const knowledgeStr = knowledge ? `\n    Knowledge: ${knowledge}` : "";
      return `- [${c.id}] ${c.name} (${c.role})${knowledgeStr}`;
    })
    .join("\n");

  // Key locations with continuity
  const keyLocations = Object.values(narrative.locations)
    .filter((l) => l.prominence === "domain" || l.prominence === "place")
    .slice(0, 8);

  const locations = keyLocations
    .map((l) => {
      const knowledgeNodes = Object.values(l.continuity.nodes)
        .filter(kn => timelineState.liveNodeIds.has(kn.id))
        .slice(-3);
      const knowledge = knowledgeNodes.map(kn => kn.content).join("; ");
      const knowledgeStr = knowledge ? ` — ${knowledge}` : "";
      return `- [${l.id}] ${l.name}${knowledgeStr}`;
    })
    .join("\n");

  // Key relationships with valence
  const keyCharacterIds = new Set(keyCharacters.map(c => c.id));
  const relationships = timelineState.relationships
    .filter(r => keyCharacterIds.has(r.from) && keyCharacterIds.has(r.to))
    .slice(0, 15)
    .map(r => {
      const fromName = narrative.characters[r.from]?.name ?? r.from;
      const toName = narrative.characters[r.to]?.name ?? r.to;
      const valenceLabel = r.valence <= -0.5 ? "hostile"
        : r.valence <= -0.1 ? "tense"
        : r.valence >= 0.5 ? "allied"
        : r.valence >= 0.1 ? "friendly"
        : "neutral";
      return `- ${fromName} → ${toName}: ${r.type} (${valenceLabel})`;
    })
    .join("\n");

  // World knowledge graph — principles, systems, constraints, tensions
  const keysUpToCurrent = resolvedKeys.slice(0, currentIndex + 1);
  const systemGraph = buildCumulativeSystemGraph(
    narrative.scenes, keysUpToCurrent, keysUpToCurrent.length - 1, narrative.worldBuilds,
  );
  const systemNodes = Object.values(systemGraph.nodes);
  const principles = systemNodes.filter(n => n.type === "principle").slice(0, 5);
  const systems = systemNodes.filter(n => n.type === "system").slice(0, 5);
  const constraints = systemNodes.filter(n => n.type === "constraint").slice(0, 4);
  const tensions = systemNodes.filter(n => n.type === "tension").slice(0, 4);

  const worldKnowledgeLines: string[] = [];
  if (principles.length > 0) {
    worldKnowledgeLines.push(`  Principles: ${principles.map(n => n.concept).join("; ")}`);
  }
  if (systems.length > 0) {
    worldKnowledgeLines.push(`  Systems: ${systems.map(n => n.concept).join("; ")}`);
  }
  if (constraints.length > 0) {
    worldKnowledgeLines.push(`  Constraints: ${constraints.map(n => n.concept).join("; ")}`);
  }
  if (tensions.length > 0) {
    worldKnowledgeLines.push(`  Tensions: ${tensions.map(n => n.concept).join("; ")}`);
  }
  const worldKnowledge = worldKnowledgeLines.length > 0
    ? worldKnowledgeLines.join("\n")
    : "";

  // Key artifacts with capabilities
  const artifacts = Object.values(narrative.artifacts ?? {})
    .filter(a => a.significance === "key" || a.significance === "notable")
    .slice(0, 6)
    .map(a => {
      const owner = timelineState.artifactOwnership[a.id] ?? a.parentId;
      const ownerName = owner
        ? (narrative.characters[owner]?.name ?? narrative.locations[owner]?.name ?? owner)
        : "world";
      const capabilityNodes = Object.values(a.continuity.nodes)
        .filter(kn => timelineState.liveNodeIds.has(kn.id))
        .slice(-3);
      const capabilities = capabilityNodes.map(kn => kn.content).join("; ");
      const capStr = capabilities ? ` — ${capabilities}` : "";
      return `- [${a.id}] ${a.name} (${a.significance}, held by ${ownerName})${capStr}`;
    })
    .join("\n");

  // Recent scene summaries (last 8 scenes for context)
  const recentScenes = keysUpToCurrent
    .slice(-8)
    .map(k => {
      const entry = resolveEntry(narrative, k);
      if (entry?.kind !== "scene") return null;
      const povName = narrative.characters[entry.povId]?.name ?? entry.povId;
      const locName = narrative.locations[entry.locationId]?.name ?? entry.locationId;
      return `- [${povName} @ ${locName}] ${entry.summary}`;
    })
    .filter(Boolean)
    .join("\n");

  // Build thread targets section with status and timing
  const threadTargetsSection = guidance.threadTargets?.length
    ? `THREAD TARGETS:\n${guidance.threadTargets.map(t => {
        const thread = narrative.threads[t.threadId];
        const desc = thread?.description ?? t.threadId;
        const timingLabel = t.timing === "early" ? " [early — arcs 1-2]"
          : t.timing === "mid" ? " [mid — middle arcs]"
          : t.timing === "late" ? " [late — near end]"
          : t.timing === "final" ? " [final arc]"
          : "";
        return `- [${t.threadId}] ${desc} → ${t.targetStatus.toUpperCase()}${timingLabel}`;
      }).join("\n")}`
    : "";

  // Arc target — exact number of arcs to plan (default 5)
  const arcTarget = guidance.arcTarget ?? 5;
  const activeThreadCount = threads.filter(t => !["resolved", "subverted", "abandoned"].includes(t.status)).length;
  const nodeGuidance = getPlanNodeGuidance(arcTarget, activeThreadCount);
  const userDirection = guidance.direction ? `\nDIRECTION (end fate goals to achieve):\n${guidance.direction}` : "";
  const userConstraints = guidance.constraints ? `\nCONSTRAINTS (what must NOT happen):\n${guidance.constraints}` : "";

  // Get patterns and anti-patterns
  const patterns = narrative.patterns ?? [];
  const antiPatterns = narrative.antiPatterns ?? [];

  const patternsSection = patterns.length > 0
    ? `STORY PATTERNS (positive commandments):\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const antiPatternsSection = antiPatterns.length > 0
    ? `ANTI-PATTERNS (pitfalls to avoid):\n${antiPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const prompt = `${ctx}

## NARRATIVE STATE

ACTIVE THREADS (compelling questions the story must answer):
${threadSummary || "No active threads"}

KEY CHARACTERS (with accumulated knowledge):
${characters || "None"}

KEY LOCATIONS:
${locations || "None"}

${relationships ? `KEY RELATIONSHIPS:\n${relationships}\n` : ""}
${worldKnowledge ? `WORLD KNOWLEDGE:\n${worldKnowledge}\n` : ""}
${artifacts ? `KEY ARTIFACTS:\n${artifacts}\n` : ""}
${recentScenes ? `RECENT STORY (what just happened):\n${recentScenes}\n` : ""}
${patternsSection}

${antiPatternsSection}

## PLAN REQUIREMENTS

${threadTargetsSection}
${userDirection}
${userConstraints}

ARC TARGET: ${arcTarget} arcs (plan exactly this many arcs)

## TASK

Build a COORDINATION PLAN using BACKWARD INDUCTION.

1. Start from TERMINAL states — which threads must reach which endpoints
2. Work BACKWARDS to derive WAYPOINTS — intermediate states threads must pass through
3. Determine OPTIMAL ARC COUNT — how many arcs needed to achieve goals (may be fewer than budget)
4. Assign nodes to ARC SLOTS — which reasoning is relevant to which arc
5. Create ARC nodes with DELIBERATE SIZING — determine how many scenes each arc needs (3-12 scenes)
6. Set FORCE MODE for each arc to vary pacing

The plan orchestrates multiple arcs WITHOUT micromanaging. Each arc will get its own reasoning graph; this plan just sets trajectory.

**EFFICIENCY PRINCIPLE**: If the end goals can be achieved coherently in fewer arcs than the budget, use fewer arcs. The backward induction must be coherent — don't pad with unnecessary arcs just to fill the budget.

## CREATIVE MANDATE

**Real stories evolve non-deterministically.** Do NOT simply continue existing trajectories. The context above is INSPIRATION, not a script to follow.

**REQUIREMENTS FOR CREATIVITY**:
1. **UNEXPECTED COMBINATIONS**: What happens when two unrelated elements collide? Combine characters, locations, or systems that have never interacted.
2. **EMERGENT PROPERTIES**: When X meets Y, what NEW capability or dynamic emerges that neither had alone?
3. **SUBVERT EXPECTATIONS**: For each thread, consider: what's the LEAST obvious path to resolution? The most surprising twist that still feels inevitable in hindsight?
4. **HIDDEN CONNECTIONS**: What relationships or dependencies exist that haven't been made explicit? What's the second-order effect of recent events?
5. **WORLD EXPANSION**: What aspects of the world are implied but unexplored? What's beyond the current sandbox?
6. **COST AND SACRIFICE**: What must be LOST to achieve each goal? Every gain should have a price that creates new tensions.

**ANTI-PATTERNS TO AVOID**:
- Continuing threads on their "obvious" trajectory
- Resolving tensions through expected mechanisms
- Using the same character combinations repeatedly
- Keeping the world static while only threads change
- Making progress without setbacks or costs

## ARC SIZING GUIDE

Each arc should be sized based on what it needs to accomplish:

- **3-4 scenes (short)**: Quick transitions, single-thread focus, aftermath/fallout, setup beats
- **5-6 scenes (standard)**: Most arcs — one thread escalation with secondary development
- **7-9 scenes (extended)**: Major confrontations, multiple thread convergence, climactic sequences
- **10-12 scenes (epic)**: Act finales, massive setpieces, resolution of multiple threads

Consider:
- Arcs with more waypoints/terminals to hit need more scenes
- World-dominant arcs (breathing room) tend to be shorter
- Fate-dominant arcs (thread resolution) need enough scenes for proper payoff
- System-dominant arcs (worldbuilding) vary based on complexity to establish
- The total scene count across all arcs should feel appropriate for the story scope

## OUTPUT FORMAT

Return a JSON object with RICH, DIVERSE nodes. Example showing all node types working together:

{
  "summary": "1-2 sentence high-level plan summary grounded in specific world details",
  "arcCount": <number of arcs>,
  "nodes": [
    // ═══════════════════════════════════════════════════════════════
    // STRUCTURAL NODES: terminals, waypoints, arcs, unanswered
    // ═══════════════════════════════════════════════════════════════
    {"id": "T1", "index": 0, "type": "terminal", "label": "Thread reaches resolution through specific mechanism", "detail": "What must be true at plan end — reference specific knowledge or relationship", "threadId": "thread-id", "targetStatus": "resolved", "arcSlot": 4},
    {"id": "W1", "index": 1, "type": "waypoint", "label": "Thread must escalate via specific event", "detail": "WHY this intermediate state is necessary for the terminal", "threadId": "thread-id", "targetStatus": "escalating", "arcSlot": 2},
    {"id": "A1", "index": 10, "type": "arc", "label": "Arc name reflecting content", "detail": "WHY this arc needs N scenes — what must happen", "arcIndex": 1, "sceneCount": 5, "forceMode": "world-dominant", "arcSlot": 1},
    {"id": "U1", "index": 20, "type": "unanswered", "label": "Specific tension left open", "detail": "Sequel hook — WHY this should remain open", "threadId": "thread-id", "arcSlot": 4},

    // ═══════════════════════════════════════════════════════════════
    // FATE NODES: thread pressure throughout the plan
    // ═══════════════════════════════════════════════════════════════
    {"id": "F1", "index": 2, "type": "fate", "label": "Thread creates urgency through specific stakes", "detail": "How this thread's momentum shapes Arc 1 — reference thread log momentum", "threadId": "thread-id", "arcSlot": 1},

    // ═══════════════════════════════════════════════════════════════
    // CHARACTER NODES: WHO drives the plan (reference specific knowledge)
    // ═══════════════════════════════════════════════════════════════
    {"id": "C1", "index": 3, "type": "character", "label": "Character's specific knowledge enables transition", "detail": "Reference their accumulated knowledge from context — 'knows X, therefore can Y'", "entityId": "char-id", "arcSlot": 1},
    {"id": "C2", "index": 4, "type": "character", "label": "Character's choice drives escalation", "detail": "Their relationship with another character constrains options", "entityId": "char-id", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // LOCATION NODES: WHERE things must happen (reference continuity)
    // ═══════════════════════════════════════════════════════════════
    {"id": "L1", "index": 5, "type": "location", "label": "Location's properties enable confrontation", "detail": "Reference location's specific history or significance", "entityId": "loc-id", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // ARTIFACT NODES: items that shape outcomes (reference capabilities)
    // ═══════════════════════════════════════════════════════════════
    {"id": "AR1", "index": 6, "type": "artifact", "label": "Artifact's capability creates possibility", "detail": "Reference specific capabilities from context", "entityId": "artifact-id", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM NODES: world rules that constrain (reference principles/systems/constraints)
    // ═══════════════════════════════════════════════════════════════
    {"id": "S1", "index": 7, "type": "system", "label": "World rule constrains approach", "detail": "Reference specific principle/system/constraint from WORLD KNOWLEDGE", "arcSlot": 1},
    {"id": "S2", "index": 8, "type": "system", "label": "Tension creates opportunity", "detail": "Reference specific tension that can be exploited", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // REASONING NODES: causal chains (THE BACKBONE — use extensively)
    // ═══════════════════════════════════════════════════════════════
    {"id": "R1", "index": 9, "type": "reasoning", "label": "For terminal T1, waypoint W1 is necessary because...", "detail": "Backward induction step — reference specific world knowledge or relationships", "arcSlot": 2},
    {"id": "R2", "index": 11, "type": "reasoning", "label": "W1 requires C1's action because...", "detail": "Connect waypoint to character agency", "arcSlot": 1},
    {"id": "R3", "index": 12, "type": "reasoning", "label": "C1's action is constrained by S1...", "detail": "Connect character to system rule", "arcSlot": 1},
    {"id": "R4", "index": 13, "type": "reasoning", "label": "Therefore L1 is the necessary venue...", "detail": "Connect constraint to location", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // PATTERN NODES: creative expansion (inject novelty and emergence)
    // ═══════════════════════════════════════════════════════════════
    {"id": "P1", "index": 14, "type": "pattern", "label": "Unexpected collision: X meets Y for first time", "detail": "What EMERGENT property arises when these unrelated elements interact?"},
    {"id": "P2", "index": 15, "type": "pattern", "label": "Hidden implication of recent events", "detail": "Second-order effect: what does X actually mean for Y that no one has realized?"},
    {"id": "P3", "index": 16, "type": "pattern", "label": "Expand world beyond current sandbox", "detail": "What exists at the edge of the known world? New faction, location, or system implied but unexplored"},

    // ═══════════════════════════════════════════════════════════════
    // WARNING NODES: subvert predictability (challenge the obvious path)
    // ═══════════════════════════════════════════════════════════════
    {"id": "WN1", "index": 17, "type": "warning", "label": "Thread X is on predictable trajectory", "detail": "What's the LEAST obvious resolution that still feels inevitable? Subvert this."},
    {"id": "WN2", "index": 18, "type": "warning", "label": "World is too stable — needs disruption", "detail": "What assumption should be challenged? What cost hasn't been paid?"}
  ],
  "edges": [
    // Dense connections showing causal flow
    {"id": "e1", "from": "T1", "to": "R1", "type": "requires"},
    {"id": "e2", "from": "R1", "to": "W1", "type": "requires"},
    {"id": "e3", "from": "W1", "to": "R2", "type": "requires"},
    {"id": "e4", "from": "R2", "to": "C1", "type": "requires"},
    {"id": "e5", "from": "S1", "to": "R3", "type": "constrains"},
    {"id": "e6", "from": "R3", "to": "C1", "type": "constrains"},
    {"id": "e7", "from": "R4", "to": "L1", "type": "enables"},
    {"id": "e8", "from": "F1", "to": "A1", "type": "constrains"},
    {"id": "e9", "from": "AR1", "to": "R4", "type": "enables"},
    {"id": "e10", "from": "C2", "to": "W1", "type": "causes"}
  ]
}

## NODE TYPES (all must be grounded in SPECIFIC context from above)

**STRUCTURAL NODES** (plan skeleton):
- **terminal**: Thread's required end state. MUST have threadId and targetStatus. arcSlot = final arc. Detail: HOW it resolves.
- **waypoint**: Intermediate thread state. Has threadId, targetStatus, arcSlot. Detail: WHY this progression is necessary.
- **arc**: Arc placeholder. MUST have arcIndex, sceneCount (3-12), forceMode. arcSlot = arcIndex. Detail: WHY N scenes.
- **unanswered**: Thread deliberately left open. Has threadId. arcSlot = final arc. Detail: WHY this should remain open.

**FATE NODES** (thread pressure):
- **fate**: Thread pressure on specific arcs. Has threadId, arcSlot. Label: reference thread's MOMENTUM from context.

**ENTITY NODES** (grounding in specific world knowledge — USE ALL OF THESE):
- **character**: WHO drives this transition. MUST have entityId. Label: reference their SPECIFIC KNOWLEDGE from context. Detail: "knows X, therefore can Y" or "relationship with Z constrains options".
- **location**: WHERE things must happen. MUST have entityId. Label: reference location's SPECIFIC PROPERTIES from context. Detail: why this venue is necessary.
- **artifact**: WHAT item shapes outcomes. MUST have entityId. Label: reference SPECIFIC CAPABILITIES from context. Detail: how it enables/constrains.
- **system**: HOW world rules constrain. Label: reference SPECIFIC principle/system/constraint/tension from WORLD KNOWLEDGE. Detail: why this rule matters here.

**REASONING NODES** (causal chains — THE BACKBONE, use extensively):
- **reasoning**: Logical step in backward induction. Has arcSlot. Label: causal inference (3-10 words). Detail: explain WHY this follows, referencing specific knowledge.

**CREATIVE AGENT NODES** (inject novelty and subvert expectations):
- **pattern**: EXPANSION AGENT — inject novelty. Label: unexpected collision, emergent property, hidden implication, or world expansion. Detail: what NEW dynamic or capability emerges? What's beyond the current sandbox?
- **warning**: SUBVERSION AGENT — challenge predictability. Label: predictable trajectory that needs disruption, cost that hasn't been paid, assumption that should be challenged. Detail: what's the LEAST obvious path that still feels inevitable?

## EDGE TYPES

- **requires**: A depends on B
- **enables**: A makes B possible
- **constrains**: A limits B
- **causes**: A leads to B
- **develops**: A deepens B
- **resolves**: A concludes B

## REQUIREMENTS

1. **Backward induction**: Start from terminals, work backwards to derive what must happen
2. **Arc count**: Plan exactly ${arcTarget} arcs
3. **Arc slots**: Every node (except pattern/warning) needs arcSlot (1-N) indicating when it's relevant
4. **CHRONOLOGICAL INDEXING**: Node indexes MUST be chronological by arc — Arc 1 nodes get indexes 0-N, Arc 2 nodes get N+1 to M, etc. Within each arc, order by causal flow.
5. **Progressive revelation**: Nodes with arcSlot > currentArc are hidden from arc generation
6. **One arc node per arc**: Exactly N arc nodes with arcIndex 1 through N
7. **Deliberate arc sizing**: Each arc node MUST have sceneCount (3-12) with reasoning in detail
8. **Force rhythm**: Vary forceMode — don't make all arcs fate-dominant
9. **Thread trajectories**: Each non-unanswered thread needs waypoints showing progression
10. **Dense connections**: Terminals connect to waypoints, waypoints to reasoning, reasoning to more reasoning
11. **Pacing balance**: Mix arc sizes — not all arcs should be the same length
12. **DEEP CHAINS**: Between each terminal and its earliest waypoint, there must be ${nodeGuidance.minChainDepth}+ reasoning nodes
13. **GROUNDED REASONING**: Reference specific character knowledge, relationships, artifacts, or world rules in reasoning nodes
14. **CHARACTER AGENCY**: Include character nodes that show WHO drives each major transition
15. **SYSTEM CONSTRAINTS**: Include system nodes that show HOW world rules shape outcomes

## NODE COUNT TARGETS (MANDATORY MINIMUMS)

For this ${arcTarget}-arc plan with ${activeThreadCount} active threads:

**Structural nodes**:
- **Terminals**: At least ${nodeGuidance.minTerminals}
- **Waypoints**: At least ${nodeGuidance.minWaypoints}
- **Arc nodes**: Exactly ${arcTarget} (one per arc)

**Reasoning backbone** (THE MOST IMPORTANT):
- **Reasoning nodes**: At least ${nodeGuidance.minReasoningNodes} — DEEP causal chains, not shallow links

**Entity grounding** (USE ALL FOUR TYPES):
- **Character nodes**: At least ${nodeGuidance.minCharacterNodes} — reference SPECIFIC knowledge from context
- **Location nodes**: At least 1 — reference SPECIFIC location properties
- **Artifact nodes**: At least 1 (if artifacts exist in context)
- **System nodes**: At least ${nodeGuidance.minSystemNodes} — reference SPECIFIC principles/systems/constraints

**Agent nodes**:
- **Pattern nodes**: At least ${nodeGuidance.minPatterns} — COOPERATIVE agent encouraging variety
- **Warning nodes**: At least ${nodeGuidance.minWarnings} — ADVERSARIAL agent preventing staleness

## PER-ARC BALANCE (CRITICAL)

**Each arc must have meaningful reasoning.** Variation is natural, but avoid extreme disparities.

**Per-arc guidelines**:
- Early/mid arcs: 5-10 nodes each (setup, waypoints, reasoning chains)
- Late arcs: 4-8 nodes each (convergence, escalation)
- Final arc: 3-6 nodes minimum (terminals, resolution reasoning)

**Allowed variation**: Arc 1 having 8 nodes while Arc 3 has 6 is fine.
**Not allowed**: Arc 1 having 15 nodes while Arc 5 has 2 (extreme disparity).

**Bad (front-loaded)**:
- Arc 1: 15 nodes, Arc 2: 8 nodes, Arc 3: 4 nodes, Arc 4: 3 nodes, Arc 5: 2 nodes

**Good (balanced with natural variation)**:
- Arc 1: 8 nodes, Arc 2: 7 nodes, Arc 3: 6 nodes, Arc 4: 7 nodes, Arc 5: 5 nodes

## DEPTH + BREADTH REQUIREMENTS (CRITICAL)

**Chain depth**: Terminal → ${nodeGuidance.minChainDepth}+ reasoning/entity nodes → earliest waypoint

**Balanced breadth**: Use ALL entity node types (character, location, artifact, system) — not just reasoning.

**Rich reasoning means**:
1. **Multi-step chains**: Terminal → Reasoning → Character → Reasoning → System → Reasoning → Waypoint
2. **Entity nodes throughout**: Character/location/artifact/system nodes appear IN the chains, not as isolated leaves
3. **Specific references**: Every entity node references SPECIFIC knowledge from the context above
4. **Causal clarity**: Each step explains WHY, not just WHAT

**BAD (shallow breadth-only)**:
\`\`\`
T1 → W1
T2 → W2  (parallel disconnected threads, no reasoning)
\`\`\`

**BAD (depth without grounding)**:
\`\`\`
T1 → R1 → R2 → R3 → W1  (reasoning chain but no character/location/system nodes)
\`\`\`

**GOOD (deep + grounded + diverse)**:
\`\`\`
T1 ("Rock Aperture Gu feeding resolved")
  → R1 ("For resolution, Fang Yuan must secure resource X")
  → C1 ("Fang Yuan knows Bai Ning Bing has Y" — entityId: char-fy)
  → R2 ("This knowledge enables negotiation")
  → L1 ("Glacier's isolation constrains timing" — entityId: loc-glacier)
  → S1 ("Gu feeding rules require Z" — reference: Gu feeding system)
  → W1 ("Thread escalates through confrontation")
\`\`\`

Return ONLY the JSON object.`;

  const reasoningBudget =
    REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? "low"] ||
    undefined;

  const raw = onReasoning
    ? await callGenerateStream(
        prompt,
        SYSTEM_PROMPT,
        () => {}, // No token streaming for main output
        undefined,
        "generateCoordinationPlan",
        undefined,
        reasoningBudget,
        onReasoning,
      )
    : await callGenerate(
        prompt,
        SYSTEM_PROMPT,
        undefined,
        "generateCoordinationPlan",
        undefined,
        reasoningBudget,
      );

  // Parse and validate (parseJson handles markdown fences)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = parseJson(raw, "generateCoordinationPlan") as any;

    const arcCount = typeof data.arcCount === "number" ? data.arcCount : arcTarget;

    // Validate and sanitize nodes
    const nodes: CoordinationNode[] = (data.nodes ?? [])
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (n: any) =>
          typeof n.id === "string" &&
          typeof n.index === "number" &&
          typeof n.type === "string" &&
          typeof n.label === "string",
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((n: any) => ({
        id: n.id.slice(0, 20),
        index: n.index, // Will be reindexed below
        type: VALID_COORDINATION_NODE_TYPES.has(n.type) ? n.type : "reasoning",
        label: typeof n.label === "string" ? n.label.slice(0, 100) : "",
        detail: typeof n.detail === "string" ? n.detail.slice(0, 300) : undefined,
        entityId: typeof n.entityId === "string" ? n.entityId : undefined,
        threadId: typeof n.threadId === "string" ? n.threadId : undefined,
        targetStatus: typeof n.targetStatus === "string" ? n.targetStatus : undefined,
        arcIndex: typeof n.arcIndex === "number" ? n.arcIndex : undefined,
        sceneCount: typeof n.sceneCount === "number" ? n.sceneCount : undefined,
        forceMode: typeof n.forceMode === "string" ? n.forceMode : undefined,
        arcSlot: typeof n.arcSlot === "number" ? n.arcSlot : undefined,
      }));

    // Reindex nodes chronologically by arcSlot
    // Arc 1 nodes get indexes 0, 1, 2..., Arc 2 continues from there, etc.
    // Global nodes (pattern/warning without arcSlot) go at the end
    const nodesWithArcSlot = nodes.filter(n => n.arcSlot !== undefined);
    const globalNodes = nodes.filter(n => n.arcSlot === undefined);

    // Sort by arcSlot first, then by original index within each arc
    nodesWithArcSlot.sort((a, b) => {
      if (a.arcSlot !== b.arcSlot) return (a.arcSlot ?? 0) - (b.arcSlot ?? 0);
      return a.index - b.index;
    });

    // Reassign indexes chronologically
    let newIndex = 0;
    for (const node of nodesWithArcSlot) {
      node.index = newIndex++;
    }
    for (const node of globalNodes) {
      node.index = newIndex++;
    }

    // Rebuild nodes array in new order (reindexed chronologically by arc)
    const reindexedNodes: CoordinationNode[] = [...nodesWithArcSlot, ...globalNodes];

    // Validate edges
    const nodeIds = new Set(reindexedNodes.map((n) => n.id));
    const edges: CoordinationEdge[] = (data.edges ?? [])
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) =>
          typeof e.id === "string" &&
          typeof e.from === "string" &&
          typeof e.to === "string" &&
          typeof e.type === "string" &&
          VALID_EDGE_TYPES.has(e.type),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ({
        id: e.id.slice(0, 20),
        from: e.from,
        to: e.to,
        type: e.type as ReasoningEdgeType,
        label: typeof e.label === "string" ? e.label.slice(0, 100) : undefined,
      }))
      .filter((e: CoordinationEdge) => nodeIds.has(e.from) && nodeIds.has(e.to));

    // Build arc partitions — nodes grouped by arcSlot
    const arcPartitions: string[][] = [];
    for (let arc = 1; arc <= arcCount; arc++) {
      // Cumulative: all nodes with arcSlot <= arc
      const partition = reindexedNodes
        .filter((n) => n.arcSlot !== undefined && n.arcSlot <= arc)
        .map((n) => n.id);
      // Also include pattern/warning nodes (no arcSlot)
      const globalAgentNodes = reindexedNodes
        .filter((n) => n.arcSlot === undefined && (n.type === "pattern" || n.type === "warning"))
        .map((n) => n.id);
      arcPartitions.push([...new Set([...partition, ...globalAgentNodes])]);
    }

    return {
      id: `plan-${Date.now()}`,
      nodes: reindexedNodes,
      edges,
      arcCount,
      summary: typeof data.summary === "string" ? data.summary.slice(0, 500) : "Coordination plan",
      arcPartitions,
      currentArc: 0,
      completedArcs: [],
      createdAt: Date.now(),
    };
  } catch (err) {
    console.error("Failed to parse coordination plan:", err);
    // Return minimal fallback
    return {
      id: `plan-${Date.now()}`,
      nodes: [
        {
          id: "ERR",
          index: 0,
          type: "reasoning",
          label: "Plan generation failed",
          detail: String(err),
        },
      ],
      edges: [],
      arcCount: 1,
      summary: "Failed to generate coordination plan",
      arcPartitions: [["ERR"]],
      currentArc: 0,
      completedArcs: [],
      createdAt: Date.now(),
    };
  }
}

/**
 * Build a sequential path for a specific arc from the coordination plan.
 * Only includes nodes visible to that arc (arcSlot <= arcIndex).
 */
export function buildPlanPathForArc(plan: CoordinationPlan, arcIndex: number): string {
  const visibleNodeIds = new Set(plan.arcPartitions[arcIndex - 1] ?? []);
  const visibleNodes = plan.nodes.filter((n) => visibleNodeIds.has(n.id));
  const visibleEdges = plan.edges.filter(
    (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to),
  );

  // Use the same format as buildSequentialPath
  return buildSequentialPath({ nodes: visibleNodes, edges: visibleEdges });
}
