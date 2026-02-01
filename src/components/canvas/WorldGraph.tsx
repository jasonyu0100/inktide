'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useStore } from '@/lib/store';
import type {
  Character,
  Location,
  RelationshipEdge,
  CharacterRole,
  Arc,
  Scene,
} from '@/types/narrative';

// ── Graph node / link types ─────────────────────────────────────────────────

type NodeKind = 'character' | 'location' | 'knowledge';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  label: string;
  /** Only for character nodes */
  role?: CharacterRole;
  /** Thread count badge */
  threadCount?: number;
  /** Only for knowledge nodes */
  knowledgeType?: string;
  /** Parent character id for knowledge nodes */
  parentCharacterId?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  linkKind: 'relationship' | 'spatial' | 'knowledge' | 'character-location';
  label?: string;
  valence?: number;
  knowledgeEdgeType?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLE_RADIUS: Record<CharacterRole, number> = {
  anchor: 22,
  recurring: 18,
  transient: 14,
};

const ROLE_FILL: Record<CharacterRole, string> = {
  anchor: '#E8E8E8',
  recurring: '#888888',
  transient: '#555555',
};

const LOCATION_SIZE = 24;
const LOCATION_RX = 6;
const LOCATION_FILL = '#333333';

const KNOWLEDGE_FILL: Record<string, string> = {
  knows: '#FFFFFF',
  believes: '#FFFFFF',
  secret: '#F59E0B',
  goal: '#3B82F6',
};

const KNOWLEDGE_OPACITY: Record<string, number> = {
  knows: 1,
  believes: 0.5,
  secret: 1,
  goal: 1,
};

const DEFAULT_KNOWLEDGE_FILL = '#FFFFFF';
const DEFAULT_KNOWLEDGE_OPACITY = 0.7;

// ── Helper: build graph data from narrative state ───────────────────────────

/** Compute current character positions by replaying arc initial + scene deltas up to sceneIndex */
function computeCharacterPositions(
  arc: Arc,
  scenes: Record<string, Scene>,
  currentSceneIndex: number,
): Record<string, string> {
  const positions = { ...arc.initialCharacterLocations };
  const arcScenes = arc.sceneIds.map((sid) => scenes[sid]).filter(Boolean);
  // Find the offset of this arc's first scene within the global scene order
  const allSceneKeys = Object.keys(scenes);
  const arcStartGlobal = allSceneKeys.indexOf(arc.sceneIds[0]);

  for (let i = 0; i < arcScenes.length; i++) {
    const globalIdx = arcStartGlobal + i;
    if (globalIdx > currentSceneIndex) break;
    const scene = arcScenes[i];
    if (scene.characterMovements) {
      for (const [charId, locId] of Object.entries(scene.characterMovements)) {
        positions[charId] = locId;
      }
    }
  }
  return positions;
}

function buildGraphData(
  characters: Record<string, Character>,
  locations: Record<string, Location>,
  relationships: RelationshipEdge[],
  selectedKnowledgeEntity: string | null,
  characterPositions: Record<string, string>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  // Character nodes
  for (const char of Object.values(characters)) {
    nodes.push({
      id: char.id,
      kind: 'character',
      label: char.name,
      role: char.role,
      threadCount: char.threadIds.length,
    });
  }

  // Location nodes
  for (const loc of Object.values(locations)) {
    nodes.push({
      id: loc.id,
      kind: 'location',
      label: loc.name,
      threadCount: loc.threadIds.length,
    });
  }

  // Relationship edges
  for (const rel of relationships) {
    links.push({
      id: `rel-${rel.from}-${rel.to}-${rel.type}`,
      source: rel.from,
      target: rel.to,
      linkKind: 'relationship',
      label: rel.type,
      valence: rel.valence,
    });
  }

  // Spatial edges (child -> parent location)
  for (const loc of Object.values(locations)) {
    if (loc.parentId && locations[loc.parentId]) {
      links.push({
        id: `spatial-${loc.id}-${loc.parentId}`,
        source: loc.id,
        target: loc.parentId,
        linkKind: 'spatial',
      });
    }
  }

  // Character → location position edges
  const locationIds = new Set(Object.keys(locations));
  for (const [charId, locId] of Object.entries(characterPositions)) {
    if (characters[charId] && locationIds.has(locId)) {
      links.push({
        id: `charloc-${charId}-${locId}`,
        source: charId,
        target: locId,
        linkKind: 'character-location',
      });
    }
  }

  // Knowledge subgraph for selected entity (character or location)
  if (selectedKnowledgeEntity) {
    const entity = characters[selectedKnowledgeEntity] ?? locations[selectedKnowledgeEntity];
    if (entity) {
      const kg = entity.knowledge;
      const eid = entity.id;

      for (const kn of kg.nodes) {
        nodes.push({
          id: `k-${eid}-${kn.id}`,
          kind: 'knowledge',
          label: kn.content,
          knowledgeType: kn.type,
          parentCharacterId: eid,
        });

        links.push({
          id: `klink-${eid}-${kn.id}`,
          source: eid,
          target: `k-${eid}-${kn.id}`,
          linkKind: 'knowledge',
        });
      }

      for (const ke of kg.edges) {
        links.push({
          id: `kedge-${eid}-${ke.from}-${ke.to}`,
          source: `k-${eid}-${ke.from}`,
          target: `k-${eid}-${ke.to}`,
          linkKind: 'knowledge',
          knowledgeEdgeType: ke.type,
        });
      }
    }
  }

  return { nodes, links };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WorldGraph() {
  const { state, dispatch } = useStore();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const handleCharacterClickRef = useRef<(id: string) => void>(() => {});
  const handleLocationClickRef = useRef<(id: string) => void>(() => {});

  const narrative = state.activeNarrative;
  const inspectorContext = state.inspectorContext;
  const selectedKnowledgeEntity = state.selectedKnowledgeEntity;

  // Derive active arc ID — this is what triggers a full re-render
  const activeArcId = useMemo(() => {
    if (!narrative) return null;
    const sceneKeys = Object.keys(narrative.scenes);
    const currentKey = sceneKeys[state.currentSceneIndex];
    if (!currentKey) return null;
    return Object.values(narrative.arcs).find((a) => a.sceneIds.includes(currentKey))?.id ?? null;
  }, [narrative, state.currentSceneIndex]);

  // Determine which node is selected for highlight
  const selectedNodeId = useMemo(() => {
    if (!inspectorContext) return null;
    switch (inspectorContext.type) {
      case 'character':
        return inspectorContext.characterId;
      case 'location':
        return inspectorContext.locationId;
      default:
        return null;
    }
  }, [inspectorContext]);

  const handleCharacterClick = useCallback(
    (characterId: string) => {
      dispatch({
        type: 'SELECT_KNOWLEDGE_ENTITY',
        entityId: selectedKnowledgeEntity === characterId ? null : characterId,
      });
      dispatch({
        type: 'SET_INSPECTOR',
        context: { type: 'character', characterId },
      });
    },
    [dispatch, selectedKnowledgeEntity],
  );
  handleCharacterClickRef.current = handleCharacterClick;

  const handleLocationClick = useCallback(
    (locationId: string) => {
      dispatch({
        type: 'SELECT_KNOWLEDGE_ENTITY',
        entityId: selectedKnowledgeEntity === locationId ? null : locationId,
      });
      dispatch({
        type: 'SET_INSPECTOR',
        context: { type: 'location', locationId },
      });
    },
    [dispatch, selectedKnowledgeEntity],
  );
  handleLocationClickRef.current = handleLocationClick;

  // ── Full rebuild: only on arc change or knowledge entity selection ────
  useEffect(() => {
    if (!svgRef.current || !narrative) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    // Clear previous
    svg.selectAll('*').remove();

    const activeArc = activeArcId
      ? narrative.arcs[activeArcId]
      : undefined;

    // Filter characters, locations, and relationships to the active arc
    let filteredCharacters: Record<string, Character>;
    let filteredLocations: Record<string, Location>;
    let filteredRelationships: RelationshipEdge[];

    if (activeArc) {
      const activeCharIds = new Set(activeArc.activeCharacterIds);
      const activeLocIds = new Set(activeArc.locationIds);

      filteredCharacters = Object.fromEntries(
        Object.entries(narrative.characters).filter(([id]) => activeCharIds.has(id)),
      );
      filteredLocations = Object.fromEntries(
        Object.entries(narrative.locations).filter(([id]) => activeLocIds.has(id)),
      );
      filteredRelationships = narrative.relationships.filter(
        (r) => activeCharIds.has(r.from) && activeCharIds.has(r.to),
      );
    } else {
      filteredCharacters = narrative.characters;
      filteredLocations = narrative.locations;
      filteredRelationships = narrative.relationships;
    }

    // Compute character positions from arc initial + scene deltas
    const characterPositions = activeArc
      ? computeCharacterPositions(activeArc, narrative.scenes, state.currentSceneIndex)
      : {};

    const { nodes, links } = buildGraphData(
      filteredCharacters,
      filteredLocations,
      filteredRelationships,
      selectedKnowledgeEntity,
      characterPositions,
    );

    // Store nodes ref for intra-arc updates
    nodesRef.current = nodes;

    // Validate links
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validLinks = links.filter((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return nodeIds.has(srcId) && nodeIds.has(tgtId);
    });

    // Root group for zoom/pan
    const g = svg.append('g');
    gRef.current = g;

    // Zoom behaviour
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Click on empty canvas → revert inspector to current scene
    svg.on('click', (event: MouseEvent) => {
      // Only fire when clicking the SVG background, not a node
      if (event.target === svgRef.current) {
        const sceneKeys = Object.keys(narrative.scenes);
        const currentKey = sceneKeys[state.currentSceneIndex];
        if (currentKey) {
          dispatch({ type: 'SET_INSPECTOR', context: { type: 'scene', sceneId: currentKey } });
          dispatch({ type: 'SELECT_KNOWLEDGE_ENTITY', entityId: null });
        }
      }
    });

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(validLinks)
          .id((d) => d.id)
          .distance(100),
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide<GraphNode>().radius((d) => {
          if (d.kind === 'character') return (ROLE_RADIUS[d.role ?? 'recurring'] ?? 18) + 20;
          if (d.kind === 'knowledge') return 28;
          return LOCATION_SIZE / 2 + 20;
        }),
      );

    simulationRef.current = simulation;

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSelection = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(validLinks)
      .join('line')
      .attr('class', 'graph-edge')
      .attr('stroke', (d) => {
        if (d.linkKind === 'relationship') {
          const v = d.valence ?? 0;
          return v >= 0 ? 'rgba(74, 222, 128, 0.85)' : 'rgba(248, 113, 113, 0.85)';
        }
        if (d.linkKind === 'character-location') return 'rgba(59, 130, 246, 0.8)';
        if (d.linkKind === 'knowledge') return 'rgba(255, 255, 255, 0.35)';
        return 'rgba(255, 255, 255, 0.25)';
      })
      .attr('stroke-opacity', (d) => {
        if (d.linkKind === 'relationship') return Math.max(0.4, Math.abs(d.valence ?? 0));
        if (d.linkKind === 'character-location') return 0.8;
        if (d.linkKind === 'spatial') return 0.6;
        return 0.5;
      })
      .attr('stroke-width', (d) => {
        if (d.linkKind === 'character-location') return 2;
        if (d.linkKind === 'relationship') return 1.5;
        if (d.linkKind === 'knowledge') return 1;
        if (d.linkKind === 'spatial') return 1;
        return 1.5;
      })
      .attr('stroke-dasharray', (d) => {
        if (d.linkKind === 'spatial') return '4 4';
        if (d.linkKind === 'character-location') return '2 3';
        return null;
      });

    // Relationship labels at midpoints
    const linkLabelSelection = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(validLinks.filter((l) => l.linkKind === 'relationship'))
      .join('text')
      .attr('class', 'graph-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '-4')
      .style('font-size', '9px')
      .style('fill', '#666666')
      .text((d) => d.label ?? '');

    // ── Node groups ───────────────────────────────────────────────────────
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', 'graph-node')
      .on('click', (_event, d) => {
        _event.stopPropagation();
        if (d.kind === 'character') handleCharacterClickRef.current(d.id);
        if (d.kind === 'location') handleLocationClickRef.current(d.id);
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Character circles
    nodeGroup
      .filter((d) => d.kind === 'character')
      .append('circle')
      .attr('r', (d) => ROLE_RADIUS[d.role ?? 'recurring'])
      .attr('fill', (d) => ROLE_FILL[d.role ?? 'recurring']);

    // Location rounded rects
    nodeGroup
      .filter((d) => d.kind === 'location')
      .append('rect')
      .attr('x', -LOCATION_SIZE / 2)
      .attr('y', -LOCATION_SIZE / 2)
      .attr('width', LOCATION_SIZE)
      .attr('height', LOCATION_SIZE)
      .attr('rx', LOCATION_RX)
      .attr('fill', LOCATION_FILL);

    // Knowledge nodes
    nodeGroup
      .filter((d) => d.kind === 'knowledge')
      .append('circle')
      .attr('r', 8)
      .attr('fill', (d) => KNOWLEDGE_FILL[d.knowledgeType ?? 'knows'] ?? DEFAULT_KNOWLEDGE_FILL)
      .attr('opacity', (d) => KNOWLEDGE_OPACITY[d.knowledgeType ?? 'knows'] ?? DEFAULT_KNOWLEDGE_OPACITY);

    // Thread count badges
    const badgeGroup = nodeGroup
      .filter((d) => (d.threadCount ?? 0) > 0)
      .append('g')
      .attr('class', 'thread-badge');

    badgeGroup
      .append('circle')
      .attr('r', 7)
      .attr('cy', (d) => {
        if (d.kind === 'character') return -(ROLE_RADIUS[d.role ?? 'recurring'] + 8);
        return -(LOCATION_SIZE / 2 + 8);
      })
      .attr('cx', 0)
      .attr('fill', '#3B82F6')
      .attr('stroke', '#111111')
      .attr('stroke-width', 1.5);

    badgeGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('cy', 0)
      .attr('y', (d) => {
        if (d.kind === 'character') return -(ROLE_RADIUS[d.role ?? 'recurring'] + 8);
        return -(LOCATION_SIZE / 2 + 8);
      })
      .style('font-size', '8px')
      .style('fill', '#FFFFFF')
      .style('pointer-events', 'none')
      .text((d) => d.threadCount ?? 0);

    // Character / location labels
    nodeGroup
      .filter((d) => d.kind !== 'knowledge')
      .append('text')
      .attr('class', 'graph-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => {
        if (d.kind === 'character') return ROLE_RADIUS[d.role ?? 'recurring'] + 14;
        return LOCATION_SIZE / 2 + 14;
      })
      .text((d) => d.label);

    // Knowledge node labels (tiny)
    nodeGroup
      .filter((d) => d.kind === 'knowledge')
      .append('text')
      .attr('class', 'graph-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 18)
      .style('font-size', '8px')
      .style('fill', '#666666')
      .text((d) => {
        const maxLen = 20;
        return d.label.length > maxLen ? d.label.slice(0, maxLen) + '...' : d.label;
      });

    // ── Tick ──────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d) => ((d.source as GraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as GraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as GraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as GraphNode).y ?? 0));

      linkLabelSelection
        .attr('x', (d) => {
          const sx = (d.source as GraphNode).x ?? 0;
          const tx = (d.target as GraphNode).x ?? 0;
          return (sx + tx) / 2;
        })
        .attr('y', (d) => {
          const sy = (d.source as GraphNode).y ?? 0;
          const ty = (d.target as GraphNode).y ?? 0;
          return (sy + ty) / 2;
        });

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
      gRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrative, activeArcId, selectedKnowledgeEntity]);

  // ── Lightweight: update selected node highlight ──
  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.select('g.nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .classed('node-selected', (d) => d.id === selectedNodeId);
  }, [selectedNodeId]);

  // ── Lightweight intra-arc update: character-location links on scene change ──
  useEffect(() => {
    const g = gRef.current;
    const simulation = simulationRef.current;
    if (!g || !simulation || !narrative || !activeArcId) return;

    const activeArc = narrative.arcs[activeArcId];
    if (!activeArc) return;

    const positions = computeCharacterPositions(activeArc, narrative.scenes, state.currentSceneIndex);
    const locationIds = new Set(Object.keys(narrative.locations));

    // Resolve new links against existing simulation nodes
    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));
    const resolvedNewLinks: GraphLink[] = [];
    for (const [charId, locId] of Object.entries(positions)) {
      const charNode = nodeMap.get(charId);
      const locNode = nodeMap.get(locId);
      if (charNode && locNode) {
        resolvedNewLinks.push({
          id: `charloc-${charId}-${locId}`,
          source: charNode,
          target: locNode,
          linkKind: 'character-location',
        });
      }
    }

    // Update character-location links in the DOM — bind resolved links so
    // source/target are actual node objects with live x/y coordinates
    const linksGroup = g.select<SVGGElement>('g.links');
    linksGroup.selectAll<SVGLineElement, GraphLink>('line')
      .filter((d) => d.linkKind === 'character-location')
      .remove();

    const newLinkEls = linksGroup
      .selectAll<SVGLineElement, GraphLink>('line.charloc')
      .data(resolvedNewLinks, (d) => d.id)
      .join('line')
      .attr('class', 'graph-edge charloc')
      .attr('stroke', 'rgba(59, 130, 246, 0.8)')
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '2 3');

    // Swap char-loc links in the simulation force
    const currentLinks = (simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>).links();
    const nonCharLocLinks = currentLinks.filter((l) => (l as GraphLink).linkKind !== 'character-location');
    const allLinks = [...nonCharLocLinks, ...resolvedNewLinks];

    (simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>)
      .links(allLinks);

    // Gentle reheat — no jarring re-layout
    simulation.alpha(0.1).restart();

    // Tick handler for new link elements
    simulation.on('tick.charloc', () => {
      newLinkEls
        .attr('x1', (d) => ((d.source as GraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as GraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as GraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as GraphNode).y ?? 0));
    });
  }, [narrative, activeArcId, state.currentSceneIndex]);

  // No active narrative placeholder
  if (!narrative) {
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        <span className="text-text-dim text-sm">
          Create a narrative to begin
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
