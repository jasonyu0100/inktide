'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { ReasoningMode, ForcePreference } from '@/lib/ai';
import { REASONING_NODE_COLORS } from '@/lib/reasoning-node-colors';
import type { ReasoningSize, NetworkBias } from './ForcePreferencePicker';

/**
 * ThinkingAnimation — three-phase visual story of how the InkTide engine
 * thinks. Each phase has a CLEAN stage — the previous phase fully clears
 * before the next begins.
 *
 *   PHASE 1 — COLLECTION   The NETWORK is on stage. Bias-weighted anchors
 *                          pulse into focus one at a time. Unselected
 *                          nodes dim, then the whole network fades out.
 *
 *   PHASE 2 — OBJECTIVE    Clean stage. The root node of the reasoning
 *                          graph appears at the TOP with a halo pulse.
 *                          Role depends on mode (seed / premise / fate
 *                          terminal / principle). Each mode gets a unique
 *                          objective cue:
 *                            divergent → solid rect, single halo
 *                            deduction → solid rect + persistent outer
 *                                        ring (validated-premise signal
 *                                        — premise passed 4 axes)
 *                            abduction → solid rect, single halo (fate
 *                                        terminal, committed)
 *                            induction → dashed rect that fills in at
 *                                        the end of phase 3 (the
 *                                        inferred principle committing).
 *
 *   PHASE 3 — BUILDING     Vertical layered reasoning graph:
 *                            divergent → seed → branches → leaves (3 layers,
 *                                        arrows DOWN, tree). One pair of
 *                                        leaves from adjacent branches is
 *                                        connected by a dashed red line
 *                                        with a midpoint marker — the
 *                                        pairwise-compatibility cue
 *                                        (mutually-exclusive futures).
 *                            deduction → premise → r₁ → r₂ → … → conclusion
 *                                        (deep vertical chain, straight —
 *                                        necessary derivation is rigid).
 *                            abduction → fate terminal at top; COMPETING
 *                                        HYPOTHESIS CHAINS (each 2–3 nodes
 *                                        deep) converge from below. Lane
 *                                        count scales: small=2, medium/
 *                                        large=3. ONE lane bright
 *                                        (selected); others dim
 *                                        (rejected). Arrows UP.
 *                            induction → principle at top; MANY observations
 *                                        spread wide across 1–2 rows. All
 *                                        point UP to principle. Width >>
 *                                        depth — generalisation signal.
 *
 * The force preference stratifies the node-kind palette deterministically
 * so each setting has a visibly distinct colour signature (100% fate =
 * nearly all red; world = greens; system = indigos; chaos = magentas).
 */

type Props = {
  mode: ReasoningMode;
  force: ForcePreference;
  size: ReasoningSize;
  networkBias: NetworkBias;
  width?: number;
  height?: number;
};

type NodeKind = 'fate' | 'character' | 'location' | 'artifact' | 'system' | 'reasoning' | 'chaos';
type Tier = 'hot' | 'warm' | 'cold' | 'fresh';

// ── Bias / tier palette ──────────────────────────────────────────────────────

const BIAS_TIER_WEIGHTS: Record<NetworkBias, Record<Tier, number>> = {
  inside:  { hot: 0.62, warm: 0.28, cold: 0.04, fresh: 0.06 },
  neutral: { hot: 0.35, warm: 0.35, cold: 0.22, fresh: 0.08 },
  outside: { hot: 0.10, warm: 0.14, cold: 0.46, fresh: 0.30 },
};

const TIER_FILL: Record<Tier, string> = {
  hot: '#EF4444',
  warm: '#F59E0B',
  cold: '#52525B',
  fresh: '#22D3EE',
};

const SIZE_ANCHOR_COUNT: Record<ReasoningSize, number> = {
  small: 3,
  medium: 4,
  large: 5,
};

// ── Timing ───────────────────────────────────────────────────────────────────
const COLLECT_START = 200;
const COLLECT_STEP = 200;
const PULSE_DURATION = 400;
const NETWORK_FADE = 400;
const PHASE_GAP = 250;
const OBJECTIVE_DURATION = 450;
const BUILD_STEP = 160;
const HOLD_DURATION = 700;
const FADE_DURATION = 500;
const CYCLE_GAP = 300;

// Rectangle dims
const RECT_W_OBJECTIVE = 64;
const RECT_H_OBJECTIVE = 18;
const RECT_W_NODE = 50;
const RECT_H_NODE = 14;
const RECT_W_SMALL = 36;
const RECT_H_SMALL = 12;

type NetworkNodeEntry = { x: number; y: number; r: number; tier: Tier };
type NetworkEdgeEntry = { from: NetworkNodeEntry; to: NetworkNodeEntry; weight: number };
type NetworkGraph = { nodes: NetworkNodeEntry[]; edges: NetworkEdgeEntry[] };
type PlannedNode = {
  x: number; y: number;
  w: number; h: number;
  kind: NodeKind;
  dim?: boolean;
};

type BuildStep =
  | { type: 'node'; node: PlannedNode }
  | { type: 'link'; from: { x: number; y: number }; to: { x: number; y: number }; color: string; dim?: boolean; subtle?: boolean; curve?: number }
  | { type: 'exclusion'; from: { x: number; y: number }; to: { x: number; y: number } };

// ── Force-stratified kind palette ────────────────────────────────────────────
// Each force preference maps to a deterministic ordered LIST of kinds — the
// planner takes slots from the list in order. Visually, each setting has a
// clearly distinguishable colour signature.

function kindPaletteForForce(force: ForcePreference): NodeKind[] {
  switch (force) {
    case 'fate':
      // All red — fate dominates. One reasoning connective.
      return ['fate', 'fate', 'fate', 'fate', 'fate', 'fate', 'reasoning', 'fate'];
    case 'world':
      // Greens. Cycle through character/location/artifact.
      return ['character', 'location', 'artifact', 'character', 'location', 'artifact', 'reasoning', 'character'];
    case 'system':
      // Indigos.
      return ['system', 'system', 'system', 'system', 'system', 'system', 'reasoning', 'system'];
    case 'chaos':
      // Magentas with occasional reasoning/fate to anchor.
      return ['chaos', 'chaos', 'chaos', 'reasoning', 'chaos', 'chaos', 'fate', 'chaos'];
    case 'freeform':
    default:
      // Mixed with reasoning as connective.
      return ['reasoning', 'fate', 'reasoning', 'character', 'system', 'reasoning', 'location', 'fate'];
  }
}

/** Objective kind respects both mode semantics AND force preference when
 *  the mode allows flexibility. */
function objectiveKindFor(mode: ReasoningMode, force: ForcePreference): NodeKind {
  // Semantic locks — these modes have a fixed objective kind.
  if (mode === 'abduction') return 'fate';
  if (mode === 'induction') return 'system';
  // Divergent / deduction — flex by force preference.
  switch (force) {
    case 'fate': return 'fate';
    case 'world': return 'character';
    case 'system': return 'system';
    case 'chaos': return 'chaos';
    case 'freeform':
    default: return mode === 'divergent' ? 'fate' : 'system';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ThinkingAnimation({
  mode,
  force,
  size,
  networkBias,
  width = 300,
  height = 210,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graph = useMemo(() => buildNetwork(width, height), [width, height]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // ── Defs ───────────────────────────────────────────────────────────
    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'tk-glow')
      .attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%');
    glow.append('feGaussianBlur').attr('stdDeviation', '2.4').attr('result', 'blur');
    const gm = glow.append('feMerge');
    gm.append('feMergeNode').attr('in', 'blur');
    gm.append('feMergeNode').attr('in', 'SourceGraphic');

    const softGlow = defs.append('filter').attr('id', 'tk-softglow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    softGlow.append('feGaussianBlur').attr('stdDeviation', '1.4').attr('result', 'blur');
    const sgm = softGlow.append('feMerge');
    sgm.append('feMergeNode').attr('in', 'blur');
    sgm.append('feMergeNode').attr('in', 'SourceGraphic');

    const marker = defs.append('marker')
      .attr('id', 'tk-arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 6).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .attr('markerUnits', 'strokeWidth');
    marker.append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'currentColor').attr('opacity', 0.75);

    const g = svg.append('g');
    const bgLayer = g.append('g').attr('class', 'tk-bg');
    const anchorLayer = g.append('g').attr('class', 'tk-anchors');
    const fgLayer = g.append('g').attr('class', 'tk-fg');

    let cycle = 0;
    const timeoutIds: number[] = [];
    let rafId: number | null = null;

    const runCycle = () => {
      cycle += 1;
      bgLayer.selectAll('*').remove();
      anchorLayer.selectAll('*').remove();
      fgLayer.selectAll('*').remove();

      const { nodes: network, edges: latentEdges } = graph;
      const plan = planCycle({ mode, force, size, networkBias, width, height, cycle, network });
      const selectedSet = new Set(plan.anchors);

      // ── PHASE 1 — COLLECTION ─────────────────────────────────────────
      // Latent edges render first, beneath the node dots, giving the
      // dormant network visible structure (the "sea" has currents).
      bgLayer.selectAll<SVGLineElement, NetworkEdgeEntry>('line.tk-latent')
        .data(latentEdges)
        .join('line')
        .attr('class', 'tk-latent')
        .attr('x1', (d) => d.from.x)
        .attr('y1', (d) => d.from.y)
        .attr('x2', (d) => d.to.x)
        .attr('y2', (d) => d.to.y)
        .attr('stroke', '#64748B')
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', (d) => d.weight);

      bgLayer.selectAll<SVGCircleElement, NetworkNodeEntry>('circle')
        .data(network)
        .join('circle')
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', (d) => d.r)
        .attr('fill', (d) => TIER_FILL[d.tier])
        .attr('fill-opacity', (d) => baselineOpacity(d.tier))
        .attr('stroke', (d) => TIER_FILL[d.tier])
        .attr('stroke-opacity', (d) => d.tier === 'cold' ? 0.1 : 0.25)
        .attr('filter', (d) => d.tier === 'cold' ? null : 'url(#tk-softglow)');

      // Scanning sweep — a brief radial wash that communicates "the
      // system is reading the sea" before anchors start pulsing.
      const sweep = bgLayer.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', '#94A3B8')
        .attr('stroke-width', 1.2)
        .attr('stroke-opacity', 0.32);
      sweep.transition().duration(520).ease(d3.easeQuadOut)
        .attr('r', Math.hypot(width, height) * 0.55)
        .attr('stroke-opacity', 0)
        .remove();

      plan.anchors.forEach((anchor, i) => {
        const delay = COLLECT_START + i * COLLECT_STEP;
        const id = window.setTimeout(() => {
          drawAnchorHighlight(anchorLayer, anchor);
          // Brighten 2 nearest dormant neighbours briefly — the
          // "checking relevance" cue (analysis, not just selection).
          const neighbours = network
            .filter((n) => n !== anchor && n.tier !== 'hot')
            .map((n) => ({ n, d: Math.hypot(n.x - anchor.x, n.y - anchor.y) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 2);
          for (const { n } of neighbours) {
            bgLayer.selectAll<SVGCircleElement, NetworkNodeEntry>('circle')
              .filter((d) => d === n)
              .transition().duration(180)
              .attr('fill-opacity', Math.min(0.95, baselineOpacity(n.tier) * 1.8))
              .transition().duration(240)
              .attr('fill-opacity', baselineOpacity(n.tier));
          }
        }, delay);
        timeoutIds.push(id);
      });

      const lastAnchorAt = COLLECT_START + (plan.anchors.length - 1) * COLLECT_STEP;
      const phase1End = lastAnchorAt + PULSE_DURATION;

      const dimId = window.setTimeout(() => {
        bgLayer.selectAll<SVGCircleElement, NetworkNodeEntry>('circle')
          .filter((d) => !selectedSet.has(d))
          .transition().duration(250)
          .attr('fill-opacity', (d) => baselineOpacity(d.tier) * 0.3)
          .attr('stroke-opacity', 0.05);
      }, phase1End - 200);
      timeoutIds.push(dimId);

      const fadeNetworkId = window.setTimeout(() => {
        bgLayer.selectAll<SVGGraphicsElement, unknown>('*')
          .transition().duration(NETWORK_FADE).style('opacity', 0);
        anchorLayer.selectAll<SVGGraphicsElement, unknown>('*')
          .transition().duration(NETWORK_FADE).style('opacity', 0);
      }, phase1End);
      timeoutIds.push(fadeNetworkId);

      // ── PHASE 2 — OBJECTIVE ──────────────────────────────────────────
      const phase2Start = phase1End + NETWORK_FADE + PHASE_GAP;
      const objId = window.setTimeout(
        () => drawObjective(fgLayer, plan.objective, mode),
        phase2Start,
      );
      timeoutIds.push(objId);

      // ── PHASE 3 — BUILDING ───────────────────────────────────────────
      const phase3Start = phase2Start + OBJECTIVE_DURATION + PHASE_GAP;
      plan.buildSteps.forEach((step, i) => {
        const delay = phase3Start + i * BUILD_STEP;
        const id = window.setTimeout(() => drawBuildStep(fgLayer, step), delay);
        timeoutIds.push(id);
      });

      const phase3End = phase3Start + plan.buildSteps.length * BUILD_STEP;

      if (mode === 'induction') {
        const fillInId = window.setTimeout(
          () => fillInObjective(fgLayer, plan.objective),
          phase3End,
        );
        timeoutIds.push(fillInId);
      }

      const fadeStart = phase3End + HOLD_DURATION;
      const fadeId = window.setTimeout(() => {
        fgLayer.selectAll<SVGGraphicsElement, unknown>('*')
          .transition().duration(FADE_DURATION).style('opacity', 0);
      }, fadeStart);
      timeoutIds.push(fadeId);

      const nextId = window.setTimeout(runCycle, fadeStart + FADE_DURATION + CYCLE_GAP);
      timeoutIds.push(nextId);
    };

    rafId = requestAnimationFrame(runCycle);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      timeoutIds.forEach((i) => clearTimeout(i));
    };
  }, [mode, force, size, networkBias, width, height, graph]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block rounded-md bg-bg-base/40 border border-white/6"
      aria-hidden
    />
  );
}

// ── Renderers ────────────────────────────────────────────────────────────────

function drawAnchorHighlight(
  layer: d3.Selection<SVGGElement, unknown, null, undefined>,
  anchor: NetworkNodeEntry,
) {
  const color = TIER_FILL[anchor.tier];
  layer.append('circle')
    .attr('cx', anchor.x).attr('cy', anchor.y)
    .attr('r', anchor.r)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1.8)
    .attr('stroke-opacity', 0.9)
    .transition().duration(PULSE_DURATION).ease(d3.easeQuadOut)
    .attr('r', anchor.r + 8)
    .attr('stroke-opacity', 0)
    .remove();

  layer.append('circle')
    .attr('cx', anchor.x).attr('cy', anchor.y)
    .attr('r', anchor.r + 2.5)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1.2)
    .attr('stroke-opacity', 0)
    .transition().delay(150).duration(180)
    .attr('stroke-opacity', 0.75);
}

function drawObjective(
  fg: d3.Selection<SVGGElement, unknown, null, undefined>,
  node: PlannedNode,
  mode: ReasoningMode,
) {
  const palette = REASONING_NODE_COLORS[node.kind];
  const x = node.x - node.w / 2;
  const y = node.y - node.h / 2;

  // Halo
  fg.append('rect')
    .attr('x', x - 3).attr('y', y - 3)
    .attr('width', node.w + 6).attr('height', node.h + 6)
    .attr('rx', 5)
    .attr('fill', 'none')
    .attr('stroke', palette.stroke)
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.85)
    .transition().duration(OBJECTIVE_DURATION - 50).ease(d3.easeQuadOut)
    .attr('x', x - 10).attr('y', y - 10)
    .attr('width', node.w + 20).attr('height', node.h + 20)
    .attr('stroke-opacity', 0)
    .remove();

  const isInduction = mode === 'induction';
  const isDeduction = mode === 'deduction';

  fg.append('rect')
    .attr('class', 'objective')
    .attr('x', x).attr('y', y)
    .attr('width', node.w).attr('height', node.h)
    .attr('rx', 3)
    .attr('fill', isInduction ? 'transparent' : palette.fill)
    .attr('fill-opacity', 0)
    .attr('stroke', palette.stroke)
    .attr('stroke-width', isInduction ? 1 : 1.4)
    .attr('stroke-opacity', 0)
    .attr('stroke-dasharray', isInduction ? '3,2' : 'none')
    .attr('filter', isInduction ? null : 'url(#tk-glow)')
    .transition().duration(300).ease(d3.easeCubicOut)
    .attr('fill-opacity', isInduction ? 0 : 0.95)
    .attr('stroke-opacity', isInduction ? 0.8 : 0.9);

  // Deduction: validated-premise ring — a persistent outer ring that signals
  // the premise has passed the 4 validation axes. Parallels induction's
  // dashed→filled inversion (induction: principle inferred; deduction:
  // premise committed).
  if (isDeduction) {
    fg.append('rect')
      .attr('class', 'objective-ring')
      .attr('x', x - 4).attr('y', y - 4)
      .attr('width', node.w + 8).attr('height', node.h + 8)
      .attr('rx', 5)
      .attr('fill', 'none')
      .attr('stroke', palette.stroke)
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0)
      .transition().delay(180).duration(280).ease(d3.easeCubicOut)
      .attr('stroke-opacity', 0.45);
  }

}

function fillInObjective(
  fg: d3.Selection<SVGGElement, unknown, null, undefined>,
  node: PlannedNode,
) {
  const palette = REASONING_NODE_COLORS[node.kind];
  fg.selectAll<SVGRectElement, unknown>('rect.objective')
    .transition().duration(500).ease(d3.easeCubicOut)
    .attr('fill', palette.fill)
    .attr('fill-opacity', 0.95)
    .attr('stroke-dasharray', 'none')
    .attr('stroke-width', 1.4)
    .attr('filter', 'url(#tk-glow)');
}

function drawBuildStep(
  fg: d3.Selection<SVGGElement, unknown, null, undefined>,
  step: BuildStep,
) {
  if (step.type === 'node') {
    const n = step.node;
    const palette = REASONING_NODE_COLORS[n.kind];
    const baseOpacity = n.dim ? 0.28 : 0.92;
    const x = n.x - n.w / 2;
    const y = n.y - n.h / 2;

    fg.append('rect')
      .attr('class', 'tk-node')
      .attr('x', n.x).attr('y', n.y)
      .attr('width', 0).attr('height', 0)
      .attr('rx', 2)
      .attr('fill', palette.fill)
      .attr('fill-opacity', 0)
      .attr('stroke', palette.stroke)
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', n.dim ? 0.3 : 0.9)
      .attr('filter', n.dim ? null : 'url(#tk-softglow)')
      .transition().duration(240).ease(d3.easeCubicOut)
      .attr('x', x).attr('y', y)
      .attr('width', n.w).attr('height', n.h)
      .attr('fill-opacity', baseOpacity);
  } else if (step.type === 'link') {
    const finalOpacity = step.dim ? 0.18 : step.subtle ? 0.32 : 0.55;
    const strokeWidth = step.dim ? 0.6 : step.subtle ? 0.7 : 1.2;
    const dashArray = step.subtle ? '2.5,2' : null;
    if (step.curve && step.curve !== 0) {
      // Curved secondary link — a subtle arc showing non-primary causal
      // structure (shortcuts, lateral influence, cross-lane links).
      const dx = step.to.x - step.from.x;
      const dy = step.to.y - step.from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const mx = (step.from.x + step.to.x) / 2 + nx * step.curve;
      const my = (step.from.y + step.to.y) / 2 + ny * step.curve;
      const path = `M ${step.from.x} ${step.from.y} Q ${mx} ${my} ${step.to.x} ${step.to.y}`;
      const el = fg.append('path')
        .attr('class', 'tk-link')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', step.color)
        .attr('stroke-opacity', 0)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', dashArray)
        .attr('marker-end', 'url(#tk-arrow)')
        .style('color', step.color);
      const total = el.node()?.getTotalLength?.() ?? len;
      el.attr('stroke-dasharray', dashArray ?? `${total} ${total}`)
        .attr('stroke-dashoffset', dashArray ? 0 : total)
        .transition().duration(360).ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .attr('stroke-opacity', finalOpacity);
    } else {
      fg.append('line')
        .attr('class', 'tk-link')
        .attr('x1', step.from.x).attr('y1', step.from.y)
        .attr('x2', step.from.x).attr('y2', step.from.y)
        .attr('stroke', step.color)
        .attr('stroke-opacity', 0)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', dashArray)
        .attr('marker-end', 'url(#tk-arrow)')
        .style('color', step.color)
        .transition().duration(320).ease(d3.easeCubicOut)
        .attr('x2', step.to.x).attr('y2', step.to.y)
        .attr('stroke-opacity', finalOpacity);
    }
  } else {
    // Exclusion marker — a dashed connector between two divergent leaves
    // signalling a mutually-exclusive pair (pairwise-compatibility axis of
    // the branch-set quality check).
    const midX = (step.from.x + step.to.x) / 2;
    const midY = (step.from.y + step.to.y) / 2;
    fg.append('line')
      .attr('class', 'tk-exclusion')
      .attr('x1', step.from.x).attr('y1', step.from.y)
      .attr('x2', step.from.x).attr('y2', step.from.y)
      .attr('stroke', '#F87171')
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3,2')
      .attr('stroke-opacity', 0)
      .transition().duration(360).ease(d3.easeCubicOut)
      .attr('x2', step.to.x).attr('y2', step.to.y)
      .attr('stroke-opacity', 0.45);
    // Tiny ⊥ glyph at midpoint — visual anchor for the exclusion
    fg.append('circle')
      .attr('cx', midX).attr('cy', midY)
      .attr('r', 0)
      .attr('fill', '#F87171')
      .attr('fill-opacity', 0)
      .transition().delay(220).duration(220).ease(d3.easeCubicOut)
      .attr('r', 1.8)
      .attr('fill-opacity', 0.8);
  }
}

// ── Planner ──────────────────────────────────────────────────────────────────

type Plan = {
  anchors: NetworkNodeEntry[];
  objective: PlannedNode;
  buildSteps: BuildStep[];
};

function planCycle(params: {
  mode: ReasoningMode;
  force: ForcePreference;
  size: ReasoningSize;
  networkBias: NetworkBias;
  width: number;
  height: number;
  cycle: number;
  network: NetworkNodeEntry[];
}): Plan {
  const { mode, force, size, networkBias, width, height, cycle, network } = params;
  const rng = mulberry32(0xa1b2c3 + cycle * 17);
  const tierWeights = BIAS_TIER_WEIGHTS[networkBias];
  const anchorCount = SIZE_ANCHOR_COUNT[size];

  const anchors = pickAnchors(network, tierWeights, anchorCount, rng);
  const palette = kindPaletteForForce(force);
  let paletteIdx = 0;
  const nextKind = (): NodeKind => palette[paletteIdx++ % palette.length];

  const objective: PlannedNode = {
    x: width / 2,
    y: 22,
    w: RECT_W_OBJECTIVE, h: RECT_H_OBJECTIVE,
    kind: objectiveKindFor(mode, force),
  };

  const cx = width / 2;
  const buildSteps: BuildStep[] = [];

  if (mode === 'divergent') {
    // THREE-LAYER TREE: seed → branches → leaves
    const layer1Y = 78;
    const layer2Y = height - 22;
    const l1Count = Math.min(4, Math.max(2, anchorCount));
    const xStart = 28, xEnd = width - 28;
    const spacing = l1Count > 1 ? (xEnd - xStart) / (l1Count - 1) : 0;

    // Layer 1 branches
    const l1: PlannedNode[] = [];
    for (let i = 0; i < l1Count; i++) {
      l1.push({
        x: l1Count === 1 ? cx : xStart + i * spacing,
        y: layer1Y,
        w: RECT_W_NODE, h: RECT_H_NODE,
        kind: nextKind(),
      });
    }
    for (const b of l1) {
      buildSteps.push({ type: 'node', node: b });
      buildSteps.push({
        type: 'link',
        from: { x: objective.x, y: objective.y + RECT_H_OBJECTIVE / 2 },
        to: { x: b.x, y: b.y - RECT_H_NODE / 2 },
        color: REASONING_NODE_COLORS[b.kind].stroke,
      });
    }

    // Layer 2 leaves (medium+ density)
    if (size !== 'small') {
      const leavesPerBranch = size === 'large' ? 2 : 1;
      const allLeaves: PlannedNode[] = [];
      for (const parent of l1) {
        for (let j = 0; j < leavesPerBranch; j++) {
          const xOff = leavesPerBranch === 1 ? 0 : (j === 0 ? -14 : 14);
          const leaf: PlannedNode = {
            x: parent.x + xOff,
            y: layer2Y,
            w: RECT_W_SMALL, h: RECT_H_SMALL,
            kind: nextKind(),
          };
          allLeaves.push(leaf);
          buildSteps.push({ type: 'node', node: leaf });
          buildSteps.push({
            type: 'link',
            from: { x: parent.x, y: parent.y + RECT_H_NODE / 2 },
            to: { x: leaf.x, y: leaf.y - RECT_H_SMALL / 2 },
            color: REASONING_NODE_COLORS[leaf.kind].stroke,
          });
        }
      }
      // Pairwise-compatibility cue — mark one pair of leaves from adjacent
      // parent branches as mutually exclusive. Emits after all leaves land.
      if (allLeaves.length >= 2) {
        const a = allLeaves[0];
        const b = allLeaves[leavesPerBranch]; // first leaf of second parent
        if (b) {
          buildSteps.push({
            type: 'exclusion',
            from: { x: a.x + RECT_W_SMALL / 2, y: a.y },
            to: { x: b.x - RECT_W_SMALL / 2, y: b.y },
          });
        }
      }

      // Secondary causal edges — cross-branch lateral influence. Real
      // divergent reasoning isn't pure tree: sibling possibilities often
      // have causal links to consequences under OTHER branches.
      if (allLeaves.length >= 3 && l1.length >= 2) {
        // Edge: branch[2] -> allLeaves[0] (branch 2 influences leaf of branch 1)
        const srcBranch = l1[Math.min(2, l1.length - 1)];
        const dstLeaf = allLeaves[0];
        buildSteps.push({
          type: 'link',
          from: { x: srcBranch.x - RECT_W_NODE / 2, y: srcBranch.y + RECT_H_NODE / 2 },
          to: { x: dstLeaf.x + RECT_W_SMALL / 2, y: dstLeaf.y - RECT_H_SMALL / 4 },
          color: REASONING_NODE_COLORS[dstLeaf.kind].stroke,
          subtle: true,
          curve: 14,
        });
      }
    }
  } else if (mode === 'deduction') {
    // DEEP VERTICAL CHAIN — 4–6 nodes stacked
    const chainLen = Math.max(4, anchorCount + 1);
    const rowTop = objective.y + RECT_H_OBJECTIVE / 2 + 26;
    const rowBottom = height - 22;
    const spacing = chainLen > 1 ? (rowBottom - rowTop) / (chainLen - 1) : 0;
    let prevX = objective.x, prevY = objective.y + RECT_H_OBJECTIVE / 2;
    const chainNodes: PlannedNode[] = [];
    for (let i = 0; i < chainLen; i++) {
      const y = rowTop + i * spacing;
      // Straight chain — necessary derivation reads as rigid, not meandering.
      const x = cx;
      const node: PlannedNode = {
        x, y,
        w: RECT_W_NODE, h: RECT_H_NODE,
        kind: i === chainLen - 1 ? 'fate' : nextKind(),
      };
      chainNodes.push(node);
      buildSteps.push({ type: 'node', node });
      buildSteps.push({
        type: 'link',
        from: { x: prevX, y: prevY },
        to: { x: node.x, y: node.y - RECT_H_NODE / 2 },
        color: REASONING_NODE_COLORS[node.kind].stroke,
      });
      prevX = node.x; prevY = node.y + RECT_H_NODE / 2;
    }
    // Secondary causal edge — premise → mid-chain shortcut. Real
    // deductive chains aren't pure linear: the premise often directly
    // entails an intermediate without going through every step.
    if (chainNodes.length >= 3) {
      const midIdx = Math.floor(chainNodes.length / 2);
      const mid = chainNodes[midIdx];
      buildSteps.push({
        type: 'link',
        from: { x: objective.x + RECT_W_OBJECTIVE / 2 - 6, y: objective.y + RECT_H_OBJECTIVE / 2 },
        to: { x: mid.x + RECT_W_NODE / 2, y: mid.y },
        color: REASONING_NODE_COLORS[mid.kind].stroke,
        subtle: true,
        curve: 24,
      });
    }
  } else if (mode === 'abduction') {
    // COMPETING HYPOTHESIS CHAINS converging on the fate terminal. Each
    // lane has 2–3 nodes. One lane is SELECTED (bright), others REJECTED
    // (dim). Arrows all point UP. Lane count scales with size so the
    // parametric feel parallels induction's scaling observation count.
    const laneCount = size === 'small' ? 2 : 3;
    const selectedIdx = cycle % laneCount;
    const laneXs = laneCount === 2
      ? [width * 0.3, width * 0.7]
      : [width * 0.18, width * 0.5, width * 0.82];
    // Chain depth — small=2, medium=2, large=3
    const depth = size === 'large' ? 3 : 2;
    const topY = 60;
    const bottomY = height - 22;
    const yStep = depth > 1 ? (bottomY - topY) / (depth - 1) : 0;

    const laneBases: PlannedNode[] = [];
    for (let lane = 0; lane < laneCount; lane++) {
      const isSelected = lane === selectedIdx;
      const x = laneXs[lane];
      // Build chain BOTTOM-to-TOP (evidence → hypothesis → conclusion)
      const laneNodes: PlannedNode[] = [];
      for (let d = depth - 1; d >= 0; d--) {
        const y = topY + d * yStep;
        const node: PlannedNode = {
          x, y,
          w: RECT_W_NODE, h: RECT_H_NODE,
          kind: isSelected ? (d === depth - 1 ? nextKind() : 'reasoning') : 'reasoning',
          dim: !isSelected,
        };
        laneNodes.push(node);
      }
      laneBases.push(laneNodes[0]);
      // Emit in bottom-up order (matches backward-thinking feel for abduction)
      for (let i = 0; i < laneNodes.length; i++) {
        const node = laneNodes[i];
        buildSteps.push({ type: 'node', node });
        const isTop = i === laneNodes.length - 1;
        const from = { x: node.x, y: node.y - RECT_H_NODE / 2 };
        const to = isTop
          ? { x: objective.x + (lane - 1) * 12, y: objective.y + RECT_H_OBJECTIVE / 2 }
          : { x: laneNodes[i + 1].x, y: laneNodes[i + 1].y + RECT_H_NODE / 2 };
        buildSteps.push({
          type: 'link',
          from, to,
          color: REASONING_NODE_COLORS[node.kind].stroke,
          dim: !isSelected,
        });
      }
    }
    // Secondary causal edge — shared prior between two lanes. Competing
    // hypotheses often depend on the same underlying fact; the selected
    // lane and one rejected lane share evidence at their base.
    if (laneBases.length >= 2) {
      const a = laneBases[selectedIdx];
      const bIdx = (selectedIdx + 1) % laneBases.length;
      const b = laneBases[bIdx];
      buildSteps.push({
        type: 'link',
        from: { x: a.x + (a.x < b.x ? RECT_W_NODE / 2 : -RECT_W_NODE / 2), y: a.y },
        to: { x: b.x + (a.x < b.x ? -RECT_W_NODE / 2 : RECT_W_NODE / 2), y: b.y },
        color: REASONING_NODE_COLORS[a.kind].stroke,
        subtle: true,
        curve: 10,
      });
    }
  } else {
    // INDUCTION — WIDE observation spread across 1–2 rows, all pointing UP.
    const obsCount = size === 'small' ? 4 : size === 'medium' ? 6 : 8;
    // Arrange in rows: more rows for higher counts keep each node large enough.
    const rows = obsCount <= 5 ? 1 : 2;
    const perRow = Math.ceil(obsCount / rows);
    const rowYStart = rows === 1 ? height - 30 : height - 58;
    const rowYStep = 32;
    const xStart = 20, xEnd = width - 20;

    const obsNodes: PlannedNode[] = [];
    for (let i = 0; i < obsCount; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const colsThisRow = row === rows - 1 ? (obsCount - row * perRow) : perRow;
      const rowSpacingActual = colsThisRow > 1 ? (xEnd - xStart) / (colsThisRow - 1) : 0;
      const node: PlannedNode = {
        x: colsThisRow === 1 ? cx : xStart + col * rowSpacingActual,
        y: rowYStart + row * rowYStep,
        w: RECT_W_SMALL, h: RECT_H_SMALL,
        kind: nextKind(),
      };
      obsNodes.push(node);
      buildSteps.push({ type: 'node', node });
      buildSteps.push({
        type: 'link',
        from: { x: node.x, y: node.y - RECT_H_SMALL / 2 },
        to: { x: objective.x, y: objective.y + RECT_H_OBJECTIVE / 2 },
        color: REASONING_NODE_COLORS[node.kind].stroke,
      });
    }
    // Secondary causal edges — causal links between observations. Real
    // cases aren't independent: earlier observations often cause or
    // constrain later ones. Adds 1–2 lateral edges between adjacent
    // observations to show the evidence has its own internal structure.
    if (obsNodes.length >= 3) {
      const pairs: Array<[PlannedNode, PlannedNode]> = [
        [obsNodes[0], obsNodes[1]],
      ];
      if (obsNodes.length >= 5) pairs.push([obsNodes[2], obsNodes[3]]);
      for (const [a, b] of pairs) {
        if (Math.abs(a.y - b.y) > 1) continue; // only same-row pairs
        buildSteps.push({
          type: 'link',
          from: { x: a.x + RECT_W_SMALL / 2, y: a.y },
          to: { x: b.x - RECT_W_SMALL / 2, y: b.y },
          color: REASONING_NODE_COLORS[a.kind].stroke,
          subtle: true,
        });
      }
    }
  }

  return { anchors, objective, buildSteps };
}

// ── Network + anchor selection ───────────────────────────────────────────────

function buildNetwork(width: number, height: number): NetworkGraph {
  const rng = mulberry32(0xa71c2e);
  const nodes: NetworkNodeEntry[] = [];

  // HOT — two distinct focal clusters. Multiple centres read as "this
  // system has several active regions", not one monolithic blob. Each
  // cluster gets a HUB (first node, slightly larger) that all other
  // cluster members connect to, producing a radial structure.
  const hotCenters = [
    { x: width * 0.42, y: height * 0.52, count: 4 },
    { x: width * 0.76, y: height * 0.36, count: 3 },
  ];
  const hotClusters: NetworkNodeEntry[][] = [];
  const hotNodes: NetworkNodeEntry[] = [];
  const hubs: NetworkNodeEntry[] = [];
  hotCenters.forEach((center) => {
    const cluster: NetworkNodeEntry[] = [];
    // Hub — positioned AT the centre, slightly larger.
    const hub: NetworkNodeEntry = {
      x: center.x, y: center.y,
      r: 3.4 + rng() * 0.5,
      tier: 'hot',
    };
    nodes.push(hub); hotNodes.push(hub); hubs.push(hub); cluster.push(hub);
    // Remaining members — orbital positions around the hub.
    for (let i = 1; i < center.count; i++) {
      const a = ((i - 1) / (center.count - 1)) * Math.PI * 2 + rng() * 0.4;
      const rOrbit = 12 + rng() * 6;
      const n: NetworkNodeEntry = {
        x: center.x + Math.cos(a) * rOrbit,
        y: center.y + Math.sin(a) * rOrbit * 0.85,
        r: 2.6 + rng() * 0.6,
        tier: 'hot',
      };
      nodes.push(n); hotNodes.push(n); cluster.push(n);
    }
    hotClusters.push(cluster);
  });

  // WARM — satellites positioned around each hot cluster, acting as
  // bridges between hot and the dormant periphery.
  const warmNodes: NetworkNodeEntry[] = [];
  hotCenters.forEach((center) => {
    const satCount = 4;
    for (let i = 0; i < satCount; i++) {
      const a = (i / satCount) * Math.PI * 2 + rng() * 0.4;
      const rOrbit = 28 + rng() * 10;
      const n: NetworkNodeEntry = {
        x: clamp(center.x + Math.cos(a) * rOrbit, 8, width - 8),
        y: clamp(center.y + Math.sin(a) * rOrbit * 0.8, 8, height - 8),
        r: 2.2 + rng() * 0.5,
        tier: 'warm',
      };
      nodes.push(n); warmNodes.push(n);
    }
  });

  // COLD / DORMANT — jittered grid over the whole canvas. These form
  // the dormant backdrop and are mostly ISOLATED from the active
  // subgraph — they're the sea that hasn't been activated.
  const coldNodes: NetworkNodeEntry[] = [];
  const cols = 9, rows = 5;
  const cellW = width / cols, cellH = height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() > 0.78) continue;
      const x = (c + 0.15 + rng() * 0.7) * cellW;
      const y = (r + 0.15 + rng() * 0.7) * cellH;
      const n: NetworkNodeEntry = {
        x, y,
        r: 1.2 + rng() * 0.7,
        tier: 'cold',
      };
      nodes.push(n); coldNodes.push(n);
    }
  }

  // FRESH — isolated at canvas edges, representing new information
  // arriving from outside the currently-modelled region. No edges.
  for (let i = 0; i < 5; i++) {
    const edge = i % 4;
    const alongT = rng();
    let x = 0, y = 0;
    if (edge === 0) { x = 12 + rng() * 24; y = 14 + alongT * (height - 28); }
    else if (edge === 1) { x = width - 12 - rng() * 24; y = 14 + alongT * (height - 28); }
    else if (edge === 2) { x = 14 + alongT * (width - 28); y = 12 + rng() * 24; }
    else { x = 14 + alongT * (width - 28); y = height - 12 - rng() * 24; }
    nodes.push({ x, y, r: 1.9 + rng() * 0.5, tier: 'fresh' });
  }

  // STRUCTURAL EDGES — mirror the real network-graph layout:
  //   1. Each hot cluster is a HUB-AND-SPOKE: hub connects to every
  //      other hot in its cluster.
  //   2. A bridge edge between the two hubs (inter-cluster spine).
  //   3. Each warm SATELLITE connects to the nearest hot node (its
  //      anchor into the active subgraph).
  //   4. A handful of cold nodes immediately adjacent to a warm node
  //      get a single edge to that warm — "dormant at the boundary
  //      of the active region". Most cold nodes remain unconnected
  //      backdrop.
  const edges: NetworkEdgeEntry[] = [];

  // 1. Hub-and-spoke within each hot cluster.
  for (const cluster of hotClusters) {
    const [hub, ...spokes] = cluster;
    for (const spoke of spokes) {
      edges.push({ from: hub, to: spoke, weight: 0.42 });
    }
  }

  // 2. Inter-hub spine — one edge connecting the two cluster hubs so
  //    the active subgraph reads as a single connected structure.
  if (hubs.length >= 2) {
    edges.push({ from: hubs[0], to: hubs[1], weight: 0.26 });
  }

  // 3. Each warm satellite — one edge to its nearest hot.
  for (const warm of warmNodes) {
    let best: NetworkNodeEntry | null = null;
    let bestD = Infinity;
    for (const hot of hotNodes) {
      const d = Math.hypot(warm.x - hot.x, warm.y - hot.y);
      if (d < bestD) { bestD = d; best = hot; }
    }
    if (best && bestD < 60) {
      edges.push({ from: best, to: warm, weight: 0.32 });
    }
  }

  // 4. A small number of cold nodes on the edge of the active region —
  //    at most 4 cold-to-warm links total. Favour the single closest
  //    cold per warm, skipping warms whose closest cold is too far.
  const coldWarmCandidates: Array<{ cold: NetworkNodeEntry; warm: NetworkNodeEntry; d: number }> = [];
  for (const warm of warmNodes) {
    let best: NetworkNodeEntry | null = null;
    let bestD = Infinity;
    for (const cold of coldNodes) {
      const d = Math.hypot(warm.x - cold.x, warm.y - cold.y);
      if (d < bestD) { bestD = d; best = cold; }
    }
    if (best && bestD < 26) {
      coldWarmCandidates.push({ cold: best, warm, d: bestD });
    }
  }
  coldWarmCandidates.sort((a, b) => a.d - b.d);
  const usedColds = new Set<NetworkNodeEntry>();
  for (const c of coldWarmCandidates.slice(0, 4)) {
    if (usedColds.has(c.cold)) continue;
    usedColds.add(c.cold);
    edges.push({ from: c.warm, to: c.cold, weight: 0.2 });
  }

  return { nodes, edges };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function pickAnchors(
  network: NetworkNodeEntry[],
  tierWeights: Record<Tier, number>,
  count: number,
  rng: () => number,
): NetworkNodeEntry[] {
  const pool = [...network];
  const selected: NetworkNodeEntry[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const tier = weightedPickTier(tierWeights, rng);
    const candidates = pool.filter((n) => n.tier === tier);
    const pickFrom = candidates.length > 0 ? candidates : pool;
    const picked = pickFrom[Math.floor(rng() * pickFrom.length)];
    selected.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }
  return selected;
}

function baselineOpacity(tier: Tier): number {
  return tier === 'cold' ? 0.3 : 0.55;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPickTier(weights: Record<Tier, number>, rng: () => number): Tier {
  const tiers: Tier[] = ['hot', 'warm', 'cold', 'fresh'];
  let total = 0;
  for (const t of tiers) total += weights[t];
  const r = rng() * total;
  let acc = 0;
  for (const t of tiers) {
    acc += weights[t];
    if (acc > r) return t;
  }
  return 'warm';
}
