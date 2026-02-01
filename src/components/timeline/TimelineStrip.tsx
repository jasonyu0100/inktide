'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { Scene, Arc, ThreadMutation } from '@/types/narrative';

const NODE_RADIUS = 8;
const NODE_SPACING = 50;
const PADDING_LEFT = 32;
const PADDING_TOP = 28;
const DIAMOND_SIZE = 4;
const BAND_Y = 4;
const BAND_HEIGHT = 56;

function getDiamondColor(mutations: ThreadMutation[]): string | null {
  for (const m of mutations) {
    if (m.to === 'escalating' || m.to === 'threatened') return '#F59E0B';
  }
  for (const m of mutations) {
    if (m.to === 'done') return '#FFFFFF';
  }
  for (const m of mutations) {
    if (m.to === 'surfacing') return '#666666';
  }
  return null;
}

const ARC_TINTS = [
  'rgba(255,255,255,0.03)',
  'rgba(255,255,255,0.05)',
  'rgba(255,255,255,0.04)',
  'rgba(255,255,255,0.06)',
  'rgba(255,255,255,0.035)',
];

export default function TimelineStrip() {
  const { state, dispatch } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const narrative = state.activeNarrative;

  const sceneKeys = useMemo(
    () => (narrative ? Object.keys(narrative.scenes) : []),
    [narrative],
  );

  const scenes = useMemo(
    () => (narrative ? sceneKeys.map((k) => narrative.scenes[k]) : []),
    [narrative, sceneKeys],
  );

  // Group scenes by arc
  const arcBands = useMemo(() => {
    if (!narrative) return [];
    const bands: {
      arc: Arc;
      startIdx: number;
      endIdx: number;
      tintIdx: number;
    }[] = [];
    const arcList = Object.values(narrative.arcs);
    arcList.forEach((arc, ai) => {
      const indices = arc.sceneIds
        .map((sid) => sceneKeys.indexOf(sid))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      if (indices.length > 0) {
        bands.push({
          arc,
          startIdx: indices[0],
          endIdx: indices[indices.length - 1],
          tintIdx: ai % ARC_TINTS.length,
        });
      }
    });
    return bands;
  }, [narrative, sceneKeys]);

  const svgWidth = PADDING_LEFT + sceneKeys.length * NODE_SPACING + 24;

  const xOf = useCallback(
    (i: number) => PADDING_LEFT + i * NODE_SPACING,
    [],
  );

  // Auto-scroll selected node into view
  useEffect(() => {
    if (!scrollRef.current || sceneKeys.length === 0) return;
    const x = xOf(state.currentSceneIndex);
    const container = scrollRef.current;
    const left = x - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [state.currentSceneIndex, sceneKeys.length, xOf]);

  if (!narrative) {
    return (
      <div className="flex items-center justify-center h-[72px] bg-bg-panel border-t border-border">
        <span className="text-text-dim text-xs tracking-widest uppercase">
          No narrative loaded
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-[72px] bg-bg-panel border-t border-border overflow-x-auto overflow-y-hidden"
    >
      <svg
        width={svgWidth}
        height={72}
        className="block"
        style={{ minWidth: svgWidth }}
      >
        {/* Arc background bands */}
        {arcBands.map((band) => {
          const x1 = xOf(band.startIdx) - NODE_RADIUS - 8;
          const x2 = xOf(band.endIdx) + NODE_RADIUS + 8;
          return (
            <g key={band.arc.id}>
              <rect
                x={x1}
                y={BAND_Y}
                width={x2 - x1}
                height={BAND_HEIGHT}
                rx={4}
                fill={ARC_TINTS[band.tintIdx]}
              />
              <text
                x={x1 + 4}
                y={BAND_Y + 10}
                className="fill-text-dim"
                fontSize={9}
                textAnchor="start"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {band.arc.name}
              </text>
            </g>
          );
        })}

        {/* Connecting lines between scene nodes */}
        {scenes.map((_, i) => {
          if (i === 0) return null;
          return (
            <line
              key={`line-${i}`}
              x1={xOf(i - 1)}
              y1={PADDING_TOP + 8}
              x2={xOf(i)}
              y2={PADDING_TOP + 8}
              stroke="#333333"
              strokeWidth={1}
            />
          );
        })}

        {/* Scene nodes */}
        {scenes.map((scene, i) => {
          const x = xOf(i);
          const y = PADDING_TOP + 8;
          const isSelected = i === state.currentSceneIndex;
          const diamondColor = getDiamondColor(scene.threadMutations);

          return (
            <g
              key={scene.id}
              className="cursor-pointer"
              onClick={() => {
                dispatch({ type: 'SET_SCENE_INDEX', index: i });
                dispatch({
                  type: 'SET_INSPECTOR',
                  context: { type: 'scene', sceneId: scene.id },
                });
              }}
            >
              {/* Selected ring */}
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_RADIUS + 3}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              )}
              {/* Node circle */}
              <circle
                cx={x}
                cy={y}
                r={NODE_RADIUS}
                fill={isSelected ? '#E8E8E8' : '#444444'}
              />
              {/* Thread event diamond marker */}
              {diamondColor && (
                <rect
                  x={x - DIAMOND_SIZE / 2}
                  y={y + NODE_RADIUS + 8 - DIAMOND_SIZE / 2}
                  width={DIAMOND_SIZE}
                  height={DIAMOND_SIZE}
                  fill={diamondColor}
                  transform={`rotate(45, ${x}, ${y + NODE_RADIUS + 8})`}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
