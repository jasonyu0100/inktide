/**
 * Continuity graph utilities — mutation application.
 *
 * Parallels the WorldKnowledgeGraph architecture: typed nodes in a Record,
 * typed edges between them. Mutations are additive (no removal) — changes
 * to an entity's inner world are permanent, mirroring WorldKnowledgeMutation.
 */

import type { Continuity, ContinuityMutation } from '@/types/narrative';

/** Empty continuity graph — the canonical "zero value" for entity initialization. */
export const EMPTY_CONTINUITY: Continuity = { nodes: {}, edges: [] };

/**
 * Apply a single additive continuity mutation to a graph, returning a new graph.
 * Mirrors how WorldKnowledgeMutation is applied — nodes and edges are only added.
 */
export function applyContinuityMutation(graph: Continuity, mutation: ContinuityMutation): Continuity {
  const nodes = { ...graph.nodes };
  const edges = [...graph.edges];

  for (const n of mutation.addedNodes ?? []) {
    if (!n.id || !n.content) continue;
    if (!nodes[n.id]) nodes[n.id] = { id: n.id, type: n.type || 'trait', content: n.content };
  }

  for (const e of mutation.addedEdges ?? []) {
    if (!e.from || !e.to || !e.relation) continue;
    if (!edges.some(x => x.from === e.from && x.to === e.to && x.relation === e.relation)) {
      edges.push({ from: e.from, to: e.to, relation: e.relation });
    }
  }

  return { nodes, edges };
}
