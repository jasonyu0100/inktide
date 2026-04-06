'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { NarrativeState, Scene, PlanTournament } from '@/types/narrative';
import { runPlanTournament } from '@/lib/ai/tournament';
import { assetManager } from '@/lib/asset-manager';

type Props = {
  narrative: NarrativeState;
  scene: Scene;
  resolvedKeys: string[];
  candidateCount: number;
  onClose: () => void;
  onSelectPlan: (tournament: PlanTournament, candidateId: string) => void;
};

function scoreColorClass(v: number): string {
  if (v >= 0.9) return 'text-green-400 bg-green-500/10';
  if (v >= 0.8) return 'text-lime-400 bg-lime-500/10';
  if (v >= 0.7) return 'text-yellow-400 bg-yellow-500/10';
  if (v >= 0.6) return 'text-orange-400 bg-orange-500/10';
  return 'text-red-400 bg-red-500/10';
}

export function PlanTournamentView({ narrative, scene, resolvedKeys, candidateCount, onClose, onSelectPlan }: Props) {
  const [tournament, setTournament] = useState<PlanTournament | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: candidateCount });
  const [error, setError] = useState<string | null>(null);
  const [committedCandidate, setCommittedCandidate] = useState<string | null>(null);

  const handleRunTournament = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress({ completed: 0, total: candidateCount });

    try {
      // Ensure AssetManager is initialized for embedding resolution
      await assetManager.init();

      const result = await runPlanTournament(
        narrative,
        scene,
        resolvedKeys,
        candidateCount,
        (completed, total) => {
          setProgress({ completed, total });
        }
      );
      setTournament(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Tournament failed';
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };


  // Auto-start tournament when component mounts (like MCTS does)
  useEffect(() => {
    handleRunTournament();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommit = () => {
    if (!tournament || !committedCandidate) return;
    onSelectPlan(tournament, committedCandidate);
    onClose();
  };

  const content = (
    <div className="fixed inset-0 bg-black/95 z-999 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-dim hover:text-text-primary text-lg leading-none z-10">&times;</button>

        {/* Header */}
        <h2 className="text-sm font-semibold text-text-primary mb-1">Plan Tournament</h2>
        <p className="text-[10px] text-text-dim uppercase tracking-wider mb-3">
          {isGenerating
            ? `Generating candidates… ${progress.completed} / ${progress.total}`
            : tournament
              ? `${tournament.candidates.length} candidates generated`
              : `${candidateCount} candidates`}
        </p>

        {/* Progress bar */}
        {isGenerating && (
          <div className="mb-4">
            <div className="h-2 bg-white/6 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500/60 rounded-full transition-all duration-300"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-text-dim font-mono">
                {progress.completed} / {progress.total} candidates
              </span>
              <span className="text-[10px] text-text-dim font-mono">
                {((progress.completed / progress.total) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-auto">
        {error && (
          <div className="h-full flex items-center justify-center">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 max-w-md">
              {error}
            </div>
          </div>
        )}

        {/* Skeleton Loading */}
        {isGenerating && !tournament && !error && (
          <div className="h-full flex gap-0 p-6">
            {Array.from({ length: candidateCount }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-white/5 last:border-r-0 min-w-0 px-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-8 bg-white/10 rounded w-2/3" />
                  <div className="space-y-2">
                    <div className="h-4 bg-white/10 rounded" />
                    <div className="h-4 bg-white/10 rounded" />
                    <div className="h-4 bg-white/10 rounded w-5/6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tournament && (
          <div className="h-full flex gap-0">
            {tournament.candidates.map((candidate, index) => {
              const isWinner = candidate.id === tournament.winner;
              const score = candidate.similarityScore;

              return (
                <div key={candidate.id} className="flex-1 flex flex-col border-r border-white/10 last:border-r-0 overflow-y-auto min-w-0">
                  {/* Column Header */}
                  <div className={`sticky top-0 z-10 p-4 border-b border-white/10 ${isWinner ? 'bg-blue-500/10' : 'bg-black/60'} backdrop-blur-sm`}>
                    <div className="flex items-center gap-2 mb-2">
                      {isWinner && (
                        <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                      <div className="text-[10px] font-medium text-text-dim uppercase tracking-wide">
                        Candidate #{index + 1}
                      </div>
                    </div>
                    <div className={`text-xl font-bold font-mono tabular-nums ${scoreColorClass(score)} mb-3`}>
                      {(score * 100).toFixed(1)}%
                    </div>
                    <button
                      onClick={() => setCommittedCandidate(candidate.id)}
                      className={`w-full px-3 py-1.5 border text-[10px] rounded font-medium transition-colors uppercase tracking-wider ${
                        committedCandidate === candidate.id
                          ? 'bg-blue-500/30 border-blue-400/60 text-blue-300'
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                      }`}
                    >
                      {committedCandidate === candidate.id ? 'Selected' : 'Select'}
                    </button>
                  </div>

                  {/* Beats List */}
                  <div className="p-3 space-y-2">
                    {candidate.plan.beats.map((beat, beatIndex) => {
                      const beatScore = candidate.beatScores.find(s => s.beatIndex === beatIndex);
                      return (
                        <div key={beatIndex} className="pb-2 border-b border-white/5 last:border-b-0">
                          <div className="flex items-start gap-2 mb-1">
                            <span className="text-text-dim/40 font-mono shrink-0 text-[9px] mt-0.5">
                              {beatIndex + 1}
                            </span>
                            <div className="flex-1 min-w-0 text-[11px] leading-relaxed text-text-secondary">
                              {beat.what}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-5">
                            <span className="text-[8px] text-text-dim/40 uppercase">{beat.fn}</span>
                            <span className="text-[8px] text-text-dim/30">·</span>
                            <span className="text-[8px] text-text-dim/40 capitalize">{beat.mechanism}</span>
                            {beatScore && (
                              <>
                                <div className="flex-1" />
                                <span className={`font-mono text-[8px] tabular-nums px-1 py-0.5 rounded ${scoreColorClass(beatScore.score)}`}>
                                  {(beatScore.score * 100).toFixed(0)}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Commit Button - bottom right, similar to MCTS */}
        {!isGenerating && tournament && committedCandidate && (
          <div className="absolute bottom-6 right-6 z-20">
            <button
              onClick={handleCommit}
              className="px-6 py-2.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg text-sm font-semibold transition-colors shadow-lg border border-blue-500/30"
            >
              Commit Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(content, document.body) : null;
}
