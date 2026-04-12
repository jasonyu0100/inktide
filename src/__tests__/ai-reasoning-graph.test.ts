import { describe, it, expect } from 'vitest';
import { buildSequentialPath, type ReasoningGraph, type ExpansionReasoningGraph } from '@/lib/ai/reasoning-graph';
import type { ReasoningGraphSnapshot, WorldBuild, NarrativeState } from '@/types/narrative';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function createReasoningGraph(overrides: Partial<ReasoningGraph> = {}): ReasoningGraph {
  return {
    nodes: [
      { id: 'R1', index: 0, type: 'reasoning', label: 'Initial reasoning', detail: 'Sets up the logic' },
      { id: 'C1', index: 1, type: 'character', label: 'Character action', entityId: 'C-01' },
      { id: 'O1', index: 2, type: 'outcome', label: 'Thread advances', threadId: 'T-01' },
    ],
    edges: [
      { id: 'e1', from: 'R1', to: 'C1', type: 'enables' },
      { id: 'e2', from: 'C1', to: 'O1', type: 'causes' },
    ],
    arcName: 'Test Arc',
    sceneCount: 3,
    summary: 'A test reasoning graph',
    ...overrides,
  };
}

function createExpansionReasoningGraph(overrides: Partial<ExpansionReasoningGraph> = {}): ExpansionReasoningGraph {
  return {
    nodes: [
      { id: 'G1', index: 0, type: 'system', label: 'Gap identified', detail: 'Missing antagonist faction' },
      { id: 'C1', index: 1, type: 'character', label: 'New character fills gap', entityId: 'C-02' },
      { id: 'R1', index: 2, type: 'reasoning', label: 'Faction provides conflict', detail: 'Creates opposition' },
      { id: 'O1', index: 3, type: 'outcome', label: 'Thread gains dimension', threadId: 'T-01' },
      { id: 'P1', index: 4, type: 'pattern', label: 'Variety opportunity', detail: 'Fresh direction' },
      { id: 'W1', index: 5, type: 'warning', label: 'Avoid repetition', detail: 'Risk of staleness' },
    ],
    edges: [
      { id: 'e1', from: 'G1', to: 'R1', type: 'enables' },
      { id: 'e2', from: 'C1', to: 'R1', type: 'requires' },
      { id: 'e3', from: 'R1', to: 'O1', type: 'causes' },
      { id: 'e4', from: 'P1', to: 'R1', type: 'enables' },
      { id: 'e5', from: 'W1', to: 'R1', type: 'constrains' },
    ],
    expansionName: 'Test Expansion',
    summary: 'Expansion reasoning graph test',
    ...overrides,
  };
}

function createWorldBuildWithReasoning(): WorldBuild {
  const expansionGraph = createExpansionReasoningGraph();
  return {
    kind: 'world_build',
    id: 'WB-001',
    summary: 'Test world expansion',
    expansionManifest: {
      characters: [],
      locations: [],
      threads: [],
      artifacts: [],
      relationships: [],
      systemMutations: { addedNodes: [], addedEdges: [] },
    },
    reasoningGraph: {
      nodes: expansionGraph.nodes,
      edges: expansionGraph.edges,
      arcName: expansionGraph.expansionName,
      sceneCount: 0,
      summary: expansionGraph.summary,
    },
  };
}

// ── buildSequentialPath Tests ────────────────────────────────────────────────

describe('buildSequentialPath', () => {
  it('should format nodes in index order with connections', () => {
    const graph = createReasoningGraph();
    const path = buildSequentialPath(graph);

    // Should contain all nodes in order
    expect(path).toContain('[0] REASONING: Initial reasoning');
    expect(path).toContain('[1] CHARACTER: Character action');
    expect(path).toContain('[2] OUTCOME: Thread advances');

    // Should show outgoing edges
    expect(path).toContain('enables→C1');
    expect(path).toContain('causes→O1');
  });

  it('should include entity references', () => {
    const graph = createReasoningGraph();
    const path = buildSequentialPath(graph);

    expect(path).toContain('@C-01'); // entityId reference
    expect(path).toContain('#T-01'); // threadId reference
  });

  it('should include node details', () => {
    const graph = createReasoningGraph();
    const path = buildSequentialPath(graph);

    expect(path).toContain('→ Sets up the logic');
  });

  it('should handle empty graph', () => {
    const graph = createReasoningGraph({ nodes: [], edges: [] });
    const path = buildSequentialPath(graph);

    expect(path).toBe('');
  });

  it('should handle nodes without edges', () => {
    const graph = createReasoningGraph({
      nodes: [{ id: 'R1', index: 0, type: 'reasoning', label: 'Standalone' }],
      edges: [],
    });
    const path = buildSequentialPath(graph);

    expect(path).toContain('[0] REASONING: Standalone');
    expect(path).not.toContain('→');
  });

  it('should work with expansion reasoning graphs', () => {
    const graph = createExpansionReasoningGraph();
    const path = buildSequentialPath(graph);

    // Should include pattern and warning node types
    expect(path).toContain('PATTERN:');
    expect(path).toContain('WARNING:');
    expect(path).toContain('SYSTEM:');
  });
});

// ── Reasoning Graph Structure Tests ──────────────────────────────────────────

describe('ReasoningGraph structure', () => {
  it('should have required fields for arc reasoning', () => {
    const graph = createReasoningGraph();

    expect(graph.arcName).toBeDefined();
    expect(graph.sceneCount).toBeDefined();
    expect(graph.summary).toBeDefined();
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });

  it('should have valid node types', () => {
    const graph = createReasoningGraph();
    const validTypes = ['character', 'location', 'artifact', 'system', 'reasoning', 'outcome', 'pattern', 'warning'];

    for (const node of graph.nodes) {
      expect(validTypes).toContain(node.type);
    }
  });

  it('should have valid edge types', () => {
    const graph = createReasoningGraph();
    const validTypes = ['enables', 'constrains', 'risks', 'requires', 'causes', 'reveals', 'develops', 'resolves'];

    for (const edge of graph.edges) {
      expect(validTypes).toContain(edge.type);
    }
  });
});

describe('ExpansionReasoningGraph structure', () => {
  it('should have expansionName instead of arcName', () => {
    const graph = createExpansionReasoningGraph();

    expect(graph.expansionName).toBeDefined();
    expect((graph as unknown as ReasoningGraph).arcName).toBeUndefined();
  });

  it('should include cooperative agent (pattern) nodes', () => {
    const graph = createExpansionReasoningGraph();
    const patternNodes = graph.nodes.filter(n => n.type === 'pattern');

    expect(patternNodes.length).toBeGreaterThan(0);
  });

  it('should include adversarial agent (warning) nodes', () => {
    const graph = createExpansionReasoningGraph();
    const warningNodes = graph.nodes.filter(n => n.type === 'warning');

    expect(warningNodes.length).toBeGreaterThan(0);
  });
});

// ── WorldBuild Reasoning Graph Tests ─────────────────────────────────────────

describe('WorldBuild with reasoningGraph', () => {
  it('should store reasoning graph snapshot on world build', () => {
    const worldBuild = createWorldBuildWithReasoning();

    expect(worldBuild.reasoningGraph).toBeDefined();
    expect(worldBuild.reasoningGraph!.nodes.length).toBeGreaterThan(0);
    expect(worldBuild.reasoningGraph!.edges.length).toBeGreaterThan(0);
  });

  it('should convert ExpansionReasoningGraph to ReasoningGraphSnapshot format', () => {
    const worldBuild = createWorldBuildWithReasoning();
    const snapshot = worldBuild.reasoningGraph!;

    // Should have arcName (mapped from expansionName)
    expect(snapshot.arcName).toBe('Test Expansion');
    // Should have sceneCount = 0 for world builds
    expect(snapshot.sceneCount).toBe(0);
    expect(snapshot.summary).toBeDefined();
  });

  it('should be usable with buildSequentialPath', () => {
    const worldBuild = createWorldBuildWithReasoning();
    const path = buildSequentialPath(worldBuild.reasoningGraph!);

    expect(path).toContain('SYSTEM:');
    expect(path).toContain('CHARACTER:');
    expect(path).toContain('REASONING:');
  });
});
