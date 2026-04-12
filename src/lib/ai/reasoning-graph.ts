import type { NarrativeState } from "@/types/narrative";
import { REASONING_BUDGETS } from "@/types/narrative";
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from "./api";
import { narrativeContext } from "./context";

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

/**
 * Build a sequential reasoning path from the graph for LLM consumption.
 * Nodes are ordered by index, with connection IDs inline.
 */
export function buildSequentialPath(graph: ReasoningGraph): string {
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

    // Ensure all nodes have required fields
    const nodes: ReasoningNode[] = data.nodes.map((n: Partial<ReasoningNode>, i: number) => ({
      id: n.id || `N${i}`,
      index: n.index ?? i,
      type: n.type || "reasoning",
      label: n.label || "Unlabeled node",
      detail: n.detail,
      entityId: n.entityId,
      threadId: n.threadId,
    }));

    // Ensure all edges have required fields
    const edges: ReasoningEdge[] = data.edges.map((e: Partial<ReasoningEdge>, i: number) => ({
      id: e.id || `E${i}`,
      from: e.from || "",
      to: e.to || "",
      type: e.type || "causes",
      label: e.label,
    })).filter((e: ReasoningEdge) => e.from && e.to);

    return {
      nodes,
      edges,
      arcName,
      sceneCount,
      summary: data.summary || `Reasoning graph for ${arcName}`,
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
