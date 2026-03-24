'use client';

import { useState } from 'react';
import type { PlanningPhase, PlanningQueue } from '@/types/narrative';

type Props = {
  queue: PlanningQueue;
  completionReport: string;
  onExtend: () => void;
  onAdvance: (customWorldPrompt?: string) => void;
  onClose: () => void;
};

export function PhaseCompletionModal({ queue, completionReport, onExtend, onAdvance, onClose }: Props) {
  const [worldPrompt, setWorldPrompt] = useState('');
  const [useCustomWorldPrompt, setUseCustomWorldPrompt] = useState(false);

  const completedPhase = queue.phases[queue.activePhaseIndex];
  const nextPhase = queue.phases[queue.activePhaseIndex + 1];
  const isLastPhase = !nextPhase;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="glass max-w-lg w-full rounded-2xl p-6 relative max-h-[80vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-dim hover:text-text-primary text-lg leading-none"
        >
          &times;
        </button>

        <h2 className="text-sm font-semibold text-text-primary mb-1">Phase Complete</h2>
        <p className="text-[10px] text-text-dim uppercase tracking-wider mb-4">
          {completedPhase?.name ?? 'Unknown Phase'}
        </p>

        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
          {/* Completion report */}
          <div className="bg-bg-elevated rounded-lg p-3 border border-border">
            <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-1.5">
              Completion Report
            </label>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {completionReport || 'Generating report...'}
            </p>
          </div>

          {/* Next phase preview */}
          {nextPhase && (
            <div className="bg-bg-elevated rounded-lg p-3 border border-amber-500/20">
              <label className="text-[10px] uppercase tracking-widest text-amber-400/70 block mb-1.5">
                Next Phase
              </label>
              <div className="text-xs text-text-primary font-medium">{nextPhase.name}</div>
              <p className="text-[10px] text-text-dim mt-1 leading-relaxed">{nextPhase.objective}</p>
              <div className="text-[10px] text-text-dim mt-1.5">{nextPhase.sceneAllocation} scenes allocated</div>
            </div>
          )}

          {/* World expansion prompt option */}
          {nextPhase && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
                <input
                  type="checkbox"
                  checked={useCustomWorldPrompt}
                  onChange={(e) => setUseCustomWorldPrompt(e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-xs text-text-secondary">Custom world expansion prompt</span>
              </label>
              {useCustomWorldPrompt && (
                <textarea
                  value={worldPrompt}
                  onChange={(e) => setWorldPrompt(e.target.value)}
                  placeholder="Describe how the world should grow for the next phase..."
                  className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-full h-20 resize-none outline-none placeholder:text-text-dim"
                />
              )}
              {!useCustomWorldPrompt && nextPhase.worldExpansionHints && (
                <p className="text-[10px] text-text-dim">
                  Auto-expanding: {nextPhase.worldExpansionHints}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 mt-4 border-t border-border shrink-0">
          {!isLastPhase && (
            <button
              onClick={onExtend}
              className="px-4 text-xs font-medium py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/6 transition-colors"
            >
              Extend Current Phase
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => onAdvance(useCustomWorldPrompt ? worldPrompt : undefined)}
            className="px-6 text-xs font-semibold py-2 rounded-lg bg-white/12 text-text-primary hover:bg-white/16 transition-colors"
          >
            {isLastPhase ? 'Complete Queue' : 'Advance to Next Phase'}
          </button>
        </div>
      </div>
    </div>
  );
}
