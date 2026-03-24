'use client';

import type { PlanningQueue } from '@/types/narrative';

type Props = {
  queue: PlanningQueue;
  onClick?: () => void;
};

export function PlanningIndicator({ queue, onClick }: Props) {
  const activePhase = queue.phases[queue.activePhaseIndex];
  if (!activePhase) return null;

  const completedCount = queue.phases.filter((p) => p.status === 'completed').length;
  const totalPhases = queue.phases.length;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[10px] text-text-dim hover:text-text-secondary transition-colors cursor-pointer opacity-70 hover:opacity-100"
      title="Planning layer active — click to edit queue"
    >
      <span className="text-amber-400/70">&#9679;</span>
      <span>{activePhase.name}</span>
      <span className="text-text-dim/50">{activePhase.scenesCompleted}/{activePhase.sceneAllocation}</span>
      <span className="text-text-dim/30">({completedCount + 1}/{totalPhases})</span>
    </button>
  );
}
