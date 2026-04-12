import type { NarrativeState, WorldBuild } from "@/types/narrative";
import { REASONING_BUDGETS, resolveEntry } from "@/types/narrative";
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from "./api";
import { narrativeContext } from "./context";

// Valid node and edge types for validation
const VALID_NODE_TYPES = new Set(["character", "location", "artifact", "system", "reasoning", "outcome", "pattern", "warning"]);
const VALID_EDGE_TYPES = new Set(["enables", "constrains", "risks", "requires", "causes", "reveals", "develops", "resolves"]);

// ── Node Types ───────────────────────────────────────────────────────────────

export type ReasoningNodeType =
  | "character"    // Active agent in the reasoning
  | "location"     // Setting that constrains/enables action
  | "artifact"     // Object with narrative significance
  | "system"       // World rule or principle
  | "reasoning"    // A step in the logical chain
  | "outcome"      // Thread effect / resolution
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

This graph captures the STRATEGIC LOGIC driving the arc. Each node is a piece of reasoning.
The graph should reveal WHY things happen, not just WHAT happens.

## OUTPUT FORMAT

Return a JSON object:

{
  "summary": "1-2 sentence high-level summary of the arc's reasoning",
  "nodes": [
    {
      "id": "C1",
      "index": 0,
      "type": "character",
      "label": "Character's current position",
      "detail": "Expanded context about their state/goals",
      "entityId": "actual-character-id-from-narrative"
    },
    {
      "id": "S1",
      "index": 1,
      "type": "system",
      "label": "World rule that constrains",
      "detail": "How this rule applies"
    },
    {
      "id": "R1",
      "index": 2,
      "type": "reasoning",
      "label": "Therefore X must Y",
      "detail": "The logical step"
    },
    {
      "id": "O1",
      "index": 3,
      "type": "outcome",
      "label": "Thread escalates",
      "detail": "Impact on narrative tension",
      "threadId": "thread-id"
    }
  ],
  "edges": [
    {"id": "e1", "from": "C1", "to": "R1", "type": "enables"},
    {"id": "e2", "from": "S1", "to": "R1", "type": "constrains"},
    {"id": "e3", "from": "R1", "to": "O1", "type": "causes"}
  ]
}

## NODE TYPES

- **character**: An active agent. Use entityId to reference actual character. Label = their position/goal.
- **location**: A setting. Use entityId to reference actual location. Label = what it enables/constrains.
- **artifact**: An object. Use entityId to reference actual artifact. Label = its role in reasoning.
- **system**: A world rule/principle/constraint. Label = the rule as it applies here.
- **reasoning**: A logical step. Label = the inference (3-8 words). These are the CORE of the graph.
- **outcome**: Effect on a thread (threads are QUESTIONS). Use threadId to reference thread. Label = how the question is advanced or answered.
- **pattern**: COOPERATIVE AGENT — positive reinforcement. Use to encourage variety and fresh approaches. Can reinforce listed patterns OR suggest new interesting directions the arc could explore. Label = the opportunity or pattern being embraced.
- **warning**: ADVERSARIAL AGENT — negative reinforcement. Use to prevent stagnation and repetition. Flag when the arc risks falling into anti-patterns OR when the story is becoming repetitive/predictable. Label = the risk or staleness being flagged.

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

1. **Sequential indexing**: Nodes are indexed 0, 1, 2... in a logical reading order
2. **Entity references**: character/location/artifact nodes MUST use entityId with actual IDs from the narrative
3. **Thread references**: outcome nodes SHOULD use threadId when affecting specific threads
4. **Dense connections**: Each reasoning node should connect to 2+ other nodes
5. **Multilayered**: Show how system constraints, character positions, and causal logic interweave
6. **Node count**: Target ${4 + sceneCount * 3}-${8 + sceneCount * 4} nodes (mix of all types). ${sceneCount <= 2 ? "Smaller arcs need focused, tight reasoning chains." : sceneCount <= 6 ? "Medium arcs need branching logic with multiple character threads." : "Larger arcs need comprehensive reasoning covering parallel storylines and complex causality."}
7. **Outcome clarity**: Make explicit how reasoning leads to thread effects
8. **Cooperative agent (pattern nodes)**: Include 1-2 **pattern** nodes to encourage variety and freshness. These can reinforce listed patterns OR suggest new interesting directions. The goal is positive reinforcement — pushing the story toward novel, engaging territory. Connect pattern nodes to reasoning nodes they inspire.
9. **Adversarial agent (warning nodes)**: Include **warning** nodes to prevent stagnation and repetition. Flag anti-patterns from the list AND flag when reasoning feels too similar to recent arcs, when the story risks predictability, or when character dynamics are becoming stale. Connect warning nodes with "risks" edges to constrain problematic reasoning.

The graph should be rich enough that reading through the nodes reveals the full strategic logic.

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

This graph captures the STRATEGIC LOGIC driving why and how the world should expand.
The graph should reveal:
1. GAPS in the current world that need filling
2. CONNECTIONS that new entities should establish
3. SYNERGIES between new and existing elements
4. RISKS to avoid (repetitive patterns, shallow additions)

## OUTPUT FORMAT

Return a JSON object:

{
  "summary": "1-2 sentence high-level summary of the expansion's reasoning",
  "nodes": [
    {
      "id": "G1",
      "index": 0,
      "type": "system",
      "label": "Gap or opportunity identified",
      "detail": "What's missing and why it matters"
    },
    {
      "id": "C1",
      "index": 1,
      "type": "character",
      "label": "New character fills gap",
      "detail": "How they connect to existing world",
      "entityId": "existing-character-id-to-connect-to"
    },
    {
      "id": "R1",
      "index": 2,
      "type": "reasoning",
      "label": "Therefore X should be added",
      "detail": "The logical step explaining the expansion decision"
    },
    {
      "id": "O1",
      "index": 3,
      "type": "outcome",
      "label": "Thread gains new dimension",
      "detail": "How expansion enriches narrative potential",
      "threadId": "thread-id"
    }
  ],
  "edges": [
    {"id": "e1", "from": "G1", "to": "R1", "type": "enables"},
    {"id": "e2", "from": "C1", "to": "R1", "type": "requires"},
    {"id": "e3", "from": "R1", "to": "O1", "type": "causes"}
  ]
}

## NODE TYPES FOR EXPANSION

- **character**: A new or existing character. Use entityId to reference existing character this connects to. Label = their role in expansion.
- **location**: A new or existing location. Use entityId to reference existing location this nests under or connects to. Label = what it enables.
- **artifact**: A new or existing artifact. Use entityId to reference existing artifacts. Label = its role in expansion.
- **system**: A world gap, rule, or opportunity. Label = the gap or new rule being established.
- **reasoning**: A logical step explaining WHY. Label = the inference (3-8 words). These are the CORE of the graph.
- **outcome**: Effect on threads or narrative potential. Use threadId to reference affected threads. Label = how potential is enriched.
- **pattern**: COOPERATIVE AGENT — positive reinforcement. What interesting directions does this expansion open up? What variety does it introduce? Label = the opportunity or freshness being embraced.
- **warning**: ADVERSARIAL AGENT — negative reinforcement. What staleness or repetition risks does this expansion need to avoid? What patterns would make the expansion feel generic? Label = the risk being flagged.

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

1. **Sequential indexing**: Nodes are indexed 0, 1, 2... in a logical reading order
2. **Entity references**: character/location/artifact nodes connecting to existing entities MUST use entityId
3. **Thread references**: outcome nodes SHOULD use threadId when affecting specific threads
4. **Dense connections**: Each reasoning node should connect to 2+ other nodes
5. **Gap-first reasoning**: Start with what's MISSING (gaps), then reason toward what should be ADDED
6. **Integration focus**: Every new entity node should show HOW it connects to existing world via edges
7. **Node count**: Target ${nodeCountTarget}
8. **Cooperative agent (pattern nodes)**: Include 1-2 **pattern** nodes highlighting opportunities for variety and fresh directions this expansion enables
9. **Adversarial agent (warning nodes)**: Include 1-2 **warning** nodes flagging risks of staleness, repetition, or shallow additions this expansion must avoid

The graph should be rich enough that reading through the nodes reveals the full strategic logic for the expansion.

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
