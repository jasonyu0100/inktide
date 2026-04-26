"use client";

/**
 * PhaseNodeDetail — inspector for a single Phase Reasoning Graph (PRG)
 * node. Mirrors ReasoningNodeDetail's shape but with phase-specific
 * semantics: each node type encodes a temporal stance (currently-active
 * pattern, currently-followed convention, future-pointing attractor,
 * currently-driving agent, currently-binding rule, accumulating-toward-
 * discharge pressure, past-but-anchoring landmark).
 */

import { useStore } from "@/lib/store";
import type { PhaseNodeSnapshot, PhaseEdgeSnapshot, PhaseNodeType } from "@/types/narrative";
import { PHASE_NODE_COLORS, REASONING_NODE_COLOR_UNKNOWN } from "@/lib/reasoning-node-colors";
import { useMemo } from "react";

type PhaseEdgeType = PhaseEdgeSnapshot["type"];

const NODE_COLORS: Record<PhaseNodeType, { fill: string; stroke: string; text: string }> = PHASE_NODE_COLORS;

const EDGE_COLORS: Record<PhaseEdgeType, string> = {
  enables: "#22c55e",
  constrains: "#ef4444",
  risks: "#f59e0b",
  requires: "#3b82f6",
  causes: "#64748b",
  reveals: "#a855f7",
  develops: "#06b6d4",
  resolves: "#10b981",
  supersedes: "#ec4899",
};

const TYPE_DESCRIPTIONS: Record<PhaseNodeType, { headline: string; stance: string }> = {
  pattern: {
    headline: "A recurring configuration the story keeps falling into",
    stance: "currently-active",
  },
  convention: {
    headline: "A procedural default — how the story behaves when the question lacks a sharper answer",
    stance: "currently-followed",
  },
  attractor: {
    headline: "A target the cast (or the system) is aimed at",
    stance: "future-pointing",
  },
  agent: {
    headline: "An entity with stance, actively driving the system in a direction",
    stance: "currently-driving",
  },
  rule: {
    headline: "A foreground constraint actively binding choice",
    stance: "currently-binding",
  },
  pressure: {
    headline: "Accumulated tension that has not yet discharged",
    stance: "accumulating-toward-discharge",
  },
  landmark: {
    headline: "A discharged past event whose influence still anchors the present",
    stance: "past-but-anchoring",
  },
};

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

type Props = {
  phaseGraphId: string;
  nodeId: string;
};

export default function PhaseNodeDetail({ phaseGraphId, nodeId }: Props) {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;

  const { node, graph, graphName, connectedEdges } = useMemo(() => {
    if (!narrative) return { node: null, graph: null, graphName: null, connectedEdges: [] };
    const graph = narrative.phaseGraphs?.[phaseGraphId];
    if (!graph) return { node: null, graph: null, graphName: null, connectedEdges: [] };
    const node = graph.nodes.find((n) => n.id === nodeId) ?? null;
    const connectedEdges = graph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
    return {
      node,
      graph,
      graphName: graph.name ?? graph.summary.slice(0, 60),
      connectedEdges,
    };
  }, [narrative, phaseGraphId, nodeId]);

  if (!node || !graph) {
    return <div className="text-text-dim text-sm">Phase node not found</div>;
  }

  const navigateToNode = (id: string) => {
    dispatch({
      type: "SET_INSPECTOR",
      context: { type: "phase", phaseGraphId, nodeId: id },
    });
  };

  const palette = NODE_COLORS[node.type] ?? REASONING_NODE_COLOR_UNKNOWN;
  const descriptor = TYPE_DESCRIPTIONS[node.type];
  const orderDiverges = typeof node.order === "number" && node.order !== node.index;

  // Anchor — entity / thread / system reference, when present
  const anchorBadge = (() => {
    if (node.entityId) {
      const e = narrative?.characters[node.entityId] ?? narrative?.locations[node.entityId] ?? narrative?.artifacts[node.entityId];
      if (e) return { kind: "entity", label: e.name };
    }
    if (node.threadId) {
      const t = narrative?.threads[node.threadId];
      if (t) return { kind: "thread", label: t.description };
    }
    if (node.systemNodeId) {
      const s = narrative?.systemGraph?.nodes[node.systemNodeId];
      if (s) return { kind: "system", label: s.concept };
    }
    return null;
  })();

  return (
    <div className="space-y-4 text-text-secondary">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider"
            style={{ backgroundColor: palette.fill, color: palette.text }}
          >
            {node.type}
          </span>
          <span className="text-[10px] text-text-dim font-mono">
            #{node.index}
            {orderDiverges && (
              <span className="ml-1 text-text-dim/60">
                · g{(node.order ?? 0) + 1}
                {ordinalSuffix((node.order ?? 0) + 1)}
              </span>
            )}
          </span>
        </div>
        <h2 className="text-[14px] font-medium text-text-primary leading-tight">{node.label}</h2>
        <p className="text-[10px] text-text-dim/80 mt-1">
          {descriptor.headline}
          <span className="ml-1.5 italic">· {descriptor.stance}</span>
        </p>
      </div>

      {/* Anchor */}
      {anchorBadge && (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-text-dim/60">Anchored in {anchorBadge.kind}</div>
          <div className="text-[12px] text-text-secondary">{anchorBadge.label}</div>
        </div>
      )}

      {/* Detail */}
      {node.detail && (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-text-dim/60">Detail</div>
          <p className="text-[12px] leading-relaxed text-text-secondary">{node.detail}</p>
        </div>
      )}

      {/* Connections */}
      {connectedEdges.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-text-dim/60">
            Connections ({connectedEdges.length})
          </div>
          <div className="space-y-1">
            {connectedEdges.map((e) => {
              const isOutgoing = e.from === nodeId;
              const otherId = isOutgoing ? e.to : e.from;
              const other = graph.nodes.find((n) => n.id === otherId);
              const color = EDGE_COLORS[e.type];
              return (
                <button
                  key={e.id}
                  onClick={() => navigateToNode(otherId)}
                  className="w-full flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-white/5 transition-colors"
                >
                  <span className="text-[9px] font-mono uppercase tracking-wider shrink-0" style={{ color }}>
                    {isOutgoing ? "→" : "←"} {e.type}
                  </span>
                  <span className="text-[11px] text-text-secondary truncate">
                    {other?.label ?? otherId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Source PRG */}
      <div className="pt-2 border-t border-white/5">
        <div className="text-[9px] uppercase tracking-wider text-text-dim/60 mb-1">Source PRG</div>
        <div className="text-[11px] text-text-dim">{graphName}</div>
      </div>
    </div>
  );
}
