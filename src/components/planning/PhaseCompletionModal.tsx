'use client';

import { useState } from 'react';
import type { PlanningQueue } from '@/types/narrative';
import { PlanningLoadingModal } from './PlanningLoadingModal';

type Props = {
  queue: PlanningQueue;
  completionReport: string;
  transitioning?: boolean;
  transitionStep?: string | null;
  onExtend: () => void;
  onAdvance: (customWorldPrompt?: string) => void;
  onClose: () => void;
};

export function PhaseCompletionModal({ queue, completionReport, transitioning, transitionStep, onExtend, onAdvance, onClose }: Props) {
  const [worldPrompt, setWorldPrompt] = useState('');

  const completedPhase = queue.phases[queue.activePhaseIndex];
  const nextPhase = queue.phases[queue.activePhaseIndex + 1];
  const isLastPhase = !nextPhase;

  if (transitioning) {
    return <PlanningLoadingModal step={transitionStep ?? 'Advancing...'} subtitle="Preparing the next phase" />;
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="glass max-w-md w-full rounded-2xl p-5 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-text-dim hover:text-text-primary text-lg leading-none">&times;</button>

        {/* Header */}
        <p className="text-[10px] text-text-dim uppercase tracking-wider">{completedPhase?.name ?? 'Phase'} complete</p>

        {/* Report */}
        <p className="text-xs text-text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
          {completionReport || 'Generating report...'}
        </p>

        {/* Next phase */}
        {nextPhase && (
          <div className="mt-4 pt-3 border-t border-white/6">
            <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Next: {nextPhase.name}</p>
            <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">{nextPhase.objective}</p>

            {/* Optional world expansion override */}
            {nextPhase.worldExpansionHints && (
              <textarea
                value={worldPrompt}
                onChange={(e) => setWorldPrompt(e.target.value)}
                placeholder={nextPhase.worldExpansionHints}
                className="mt-2 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[11px] text-text-primary w-full h-12 resize-none outline-none placeholder:text-text-dim/40"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          {!isLastPhase && (
            <button onClick={onExtend}
              className="text-[11px] text-text-dim hover:text-text-secondary transition mr-auto">
              + Extend phase
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => onAdvance(worldPrompt.trim() || undefined)}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/16 text-text-primary transition"
          >
            {isLastPhase ? 'Complete' : 'Next Phase'}
          </button>
        </div>
      </div>
    </div>
  );
}
