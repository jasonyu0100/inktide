/**
 * Continuity graph utilities — mutation application.
 *
 * Mirrors thread-log.ts: each continuityMutation represents one commit's
 * contribution (a world build or a scene) for a single entity. New nodes
 * chain sequentially in the order they appear via 'co_occurs' — no edges
 * are created across mutations and LLM-emitted addedEdges are ignored.
 * Node order alone defines the linkage.
 *
 * Type sanitization happens here at application time — invalid node types
 * fall back to 'trait'. This is the single chokepoint for continuity data.
 */

import type { Continuity, ContinuityMutation, ContinuityNodeType } from '@/types/narrative';
import { CONTINUITY_NODE_TYPES } from '@/types/narrative';

/** Empty continuity graph — the canonical "zero value" for entity initialization. */
export const EMPTY_CONTINUITY: Continuity = { nodes: {}, edges: [] };

/**
 * Validate and normalize a continuity node type.
 * Returns the type if valid, otherwise falls back to 'trait'.
 */
function sanitizeContinuityNodeType(type: string | undefined): ContinuityNodeType {
  if (type && CONTINUITY_NODE_TYPES.includes(type as ContinuityNodeType)) {
    return type as ContinuityNodeType;
  }
  return 'trait';
}

/**
 * Apply one additive continuity mutation, returning a new graph.
 * New nodes are added in order and chained sequentially via 'co_occurs'.
 * Invalid node types are sanitized to 'trait' at this chokepoint.
 */
export function applyContinuityMutation(graph: Continuity, mutation: ContinuityMutation): Continuity {
  const nodes = { ...(graph.nodes ?? {}) };
  const edges = [...(graph.edges ?? [])];

  const newNodeIds: string[] = [];
  for (const n of mutation.addedNodes ?? []) {
    if (!n.id || !n.content) continue;
    if (!nodes[n.id]) {
      nodes[n.id] = { id: n.id, type: sanitizeContinuityNodeType(n.type), content: n.content };
      newNodeIds.push(n.id);
    }
  }

  // Chain new nodes sequentially within this mutation — no cross-commit link.
  for (let i = 1; i < newNodeIds.length; i++) {
    edges.push({ from: newNodeIds[i - 1], to: newNodeIds[i], relation: 'co_occurs' });
  }

  return { nodes, edges };
}
