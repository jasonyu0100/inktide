/**
 * Sequential-path helpers — convert a reasoning graph (or any graph that
 * matches `ReasoningGraphBase`) into the LLM-friendly text representation
 * used in downstream prompts, and extract pattern/warning directives for
 * course-correction guidance.
 */

import type { ReasoningGraphBase, ReasoningEdge } from "./types";

/**
 * Extract pattern + warning directives from a reasoning graph as
 * actionable guidance for downstream consumers (arc-scene generation,
 * plan-to-arc propagation). Patterns become novel-shape instructions;
 * warnings become repetition-avoidance instructions. Returns empty
 * string when no pattern/warning nodes exist.
 */
export function extractPatternWarningDirectives(
  graph: ReasoningGraphBase,
): string {
  const patterns = graph.nodes.filter((n) => n.type === "pattern");
  const warnings = graph.nodes.filter((n) => n.type === "warning");
  if (patterns.length === 0 && warnings.length === 0) return "";

  const sections: string[] = [];

  if (warnings.length > 0) {
    const warningLines = warnings
      .map((w) => {
        const detail = w.detail ? ` — ${w.detail}` : "";
        return `- ${w.label}${detail}`;
      })
      .join("\n");
    sections.push(
      `REPETITION WARNINGS — the reasoning graph flagged these shapes as already-seen patterns. Do NOT drift toward them in your output. Route around each explicitly:\n${warningLines}`,
    );
  }

  if (patterns.length > 0) {
    const patternLines = patterns
      .map((p) => {
        const detail = p.detail ? ` — ${p.detail}` : "";
        return `- ${p.label}${detail}`;
      })
      .join("\n");
    sections.push(
      `NOVEL PATTERNS — the reasoning graph proposes these shapes as fresh to this narrative. Your output MUST actively introduce them (not merely mention them):\n${patternLines}`,
    );
  }

  sections.push(
    `These are course-corrections, not suggestions. If your output recreates a warned pattern or fails to introduce a proposed pattern, the reasoning graph has been ignored.`,
  );

  return sections.join("\n\n");
}

/**
 * Build a sequential reasoning path from the graph for LLM consumption.
 * Nodes are ordered by index, with connection IDs inline.
 */
export function buildSequentialPath(graph: ReasoningGraphBase): string {
  const sortedNodes = [...graph.nodes].sort((a, b) => a.index - b.index);
  const outMap = new Map<string, ReasoningEdge[]>();
  const inMap = new Map<string, ReasoningEdge[]>();

  // Build BOTH outgoing and incoming edge maps so each node's entry can
  // render its full bidirectional context. A downstream LLM reading
  // sequentially can see what a node leads to AND what depends on it
  // without having to scan the whole list — convergence points and hubs
  // become visible at a glance.
  for (const edge of graph.edges) {
    if (!outMap.has(edge.from)) outMap.set(edge.from, []);
    outMap.get(edge.from)!.push(edge);
    if (!inMap.has(edge.to)) inMap.set(edge.to, []);
    inMap.get(edge.to)!.push(edge);
  }

  const lines: string[] = [];

  for (const node of sortedNodes) {
    const outgoing = outMap.get(node.id) ?? [];
    const incoming = inMap.get(node.id) ?? [];

    const entityRef = node.entityId ? ` @${node.entityId}` : "";
    const threadRef = node.threadId ? ` #${node.threadId}` : "";
    const systemRef = node.systemNodeId ? ` %${node.systemNodeId}` : "";

    // Header — identity line.
    lines.push(
      `[${node.index}] ${node.type.toUpperCase()}: ${node.label}${entityRef}${threadRef}${systemRef}`
    );

    // Outgoing: what this node LEADS TO. Empty on leaves.
    if (outgoing.length > 0) {
      const outStr = outgoing.map((e) => `${e.type}→${e.to}`).join(", ");
      lines.push(`    out: ${outStr}`);
    }

    // Incoming: what LEADS TO this node. Empty on roots.
    if (incoming.length > 0) {
      const inStr = incoming.map((e) => `${e.from}←${e.type}`).join(", ");
      lines.push(`    in:  ${inStr}`);
    }

    if (node.detail) {
      lines.push(`    · ${node.detail}`);
    }
  }

  return lines.join("\n");
}
