import type { NarrativeState, WorldBuild } from "@/types/narrative";
import { REASONING_BUDGETS, resolveEntry } from "@/types/narrative";
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from "./api";
import { narrativeContext } from "./context";

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

/** Minimal graph shape for building sequential paths — works with both ReasoningGraph and ExpansionReasoningGraph */
export type ReasoningGraphBase = {
  nodes: ReasoningNode[];
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
- **pattern**: COOPERATIVE AGENT — positive reinforcement. Encourage variety and fresh approaches. Label = the opportunity being embraced.
- **warning**: ADVERSARIAL AGENT — negative reinforcement. Prevent stagnation and repetition. Label = the risk being flagged.

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
9. **Pattern nodes**: 1-2 nodes encouraging variety and fresh directions
10. **Warning nodes**: Flag risks of staleness, repetition, or predictability

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
