'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { NarrativeState, Scene, PlanTournament, Beat } from '@/types/narrative';
import { BEAT_FN_LIST, BEAT_MECHANISM_LIST } from '@/types/narrative';
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

function BeatFunctionChart({ beats }: { beats: Beat[] }) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    BEAT_FN_LIST.forEach(fn => { counts[fn] = 0; });
    beats.forEach(b => { counts[b.fn] = (counts[b.fn] || 0) + 1; });
    const max = Math.max(...Object.values(counts), 1);
    return { counts, max };
  }, [beats]);

  return (
    <div className="space-y-1">
      {BEAT_FN_LIST.map(fn => {
        const count = distribution.counts[fn];
        const pct = (count / distribution.max) * 100;
        return (
          <div key={fn} className="flex items-center gap-2">
            <span className="text-[8px] text-text-dim w-16 uppercase tracking-wide">{fn}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[8px] text-text-dim/60 font-mono w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function MechanismChart({ beats }: { beats: Beat[] }) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    BEAT_MECHANISM_LIST.forEach(m => { counts[m] = 0; });
    beats.forEach(b => { counts[b.mechanism] = (counts[b.mechanism] || 0) + 1; });
    return counts;
  }, [beats]);

  const total = beats.length;

  return (
    <div className="space-y-1">
      {BEAT_MECHANISM_LIST.map(mech => {
        const count = distribution[mech];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={mech} className="flex items-center gap-2">
            <span className="text-[8px] text-text-dim w-20 capitalize">{mech}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-purple-400/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[8px] text-text-dim/60 font-mono w-8 text-right">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function scoreColorClass(v: number): string {
  if (v >= 0.9) return 'text-green-400 bg-green-500/10';
  if (v >= 0.8) return 'text-lime-400 bg-lime-500/10';
  if (v >= 0.7) return 'text-yellow-400 bg-yellow-500/10';
  if (v >= 0.6) return 'text-orange-400 bg-orange-500/10';
  return 'text-red-400 bg-red-500/10';
}

function scoreBarClass(v: number): string {
  if (v >= 0.9) return 'bg-green-400';
  if (v >= 0.8) return 'bg-lime-400';
  if (v >= 0.7) return 'text-yellow-400';
  if (v >= 0.6) return 'bg-orange-400';
  return 'bg-red-400';
}

export function PlanTournamentView({ narrative, scene, resolvedKeys, candidateCount, onClose, onSelectPlan }: Props) {
  const [tournament, setTournament] = useState<PlanTournament | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: candidateCount });
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
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
      // Auto-select top 3 for comparison
      const topThree = result.candidates.slice(0, Math.min(3, result.candidates.length));
      setSelectedCandidates(new Set(topThree.map(c => c.id)));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Tournament failed';
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCandidateSelection = (id: string) => {
    const newSet = new Set(selectedCandidates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      if (newSet.size >= 4) return; // Max 4 columns for comparison
      newSet.add(id);
    }
    setSelectedCandidates(newSet);
  };

  const selectedCandidateList = useMemo(() => {
    if (!tournament) return [];
    return tournament.candidates.filter(c => selectedCandidates.has(c.id));
  }, [tournament, selectedCandidates]);

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
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-3">
              {Array.from({ length: candidateCount }).map((_, i) => (
                <div key={i} className="border border-white/5 rounded-lg bg-white/2 p-4 animate-pulse">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-white/10 rounded" />
                      <div className="w-24 h-6 bg-white/10 rounded" />
                    </div>
                    <div className="flex-1" />
                    <div className="w-20 h-8 bg-white/10 rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-4 bg-white/10 rounded w-2/3" />
                    <div className="h-4 bg-white/10 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tournament && (
          <div className="h-full overflow-y-auto p-6">
            {selectedCandidateList.length < 2 ? (
              <div className="max-w-7xl mx-auto space-y-3">
                {tournament.candidates.map((candidate, index) => {
                  const isWinner = candidate.id === tournament.winner;
                  const isSelected = selectedCandidates.has(candidate.id);
                  const score = candidate.similarityScore;

                  return (
                    <div
                      key={candidate.id}
                      className={`border rounded-lg transition-all ${
                        isWinner
                          ? 'bg-blue-500/5 border-blue-500/30'
                          : isSelected
                            ? 'bg-white/4 border-white/20'
                            : 'bg-white/2 border-white/5 hover:border-white/10'
                      }`}
                    >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5"
                          />
                          {isWinner && (
                            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                          <div>
                            <div className="text-[10px] font-medium text-text-dim uppercase tracking-wide">
                              Candidate #{index + 1}
                            </div>
                            <div className={`text-lg font-bold font-mono tabular-nums ${scoreColorClass(score)}`}>
                              {(score * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        <div className="flex-1" />

                        <button
                          onClick={() => setCommittedCandidate(candidate.id)}
                          className={`px-3 py-1.5 border text-[10px] rounded font-medium transition-colors uppercase tracking-wider ${
                            committedCandidate === candidate.id
                              ? 'bg-blue-500/30 border-blue-400/60 text-blue-300'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                          }`}
                        >
                          {committedCandidate === candidate.id ? 'Selected' : 'Select'}
                        </button>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                          <div className="text-[9px] text-text-dim uppercase tracking-wider font-medium">Beat Functions</div>
                          <BeatFunctionChart beats={candidate.plan.beats} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-[9px] text-text-dim uppercase tracking-wider font-medium">Mechanisms</div>
                          <MechanismChart beats={candidate.plan.beats} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-[9px] text-text-dim uppercase tracking-wider font-medium">Beat Similarity</div>
                          <div className="space-y-1">
                            {candidate.beatScores.map(({ beatIndex, score: beatScore }) => (
                              <div key={beatIndex} className="flex items-center gap-2">
                                <span className="text-[8px] text-text-dim/40 font-mono w-6">#{beatIndex + 1}</span>
                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${scoreBarClass(beatScore)} rounded-full transition-all`}
                                    style={{ width: `${beatScore * 100}%` }}
                                  />
                                </div>
                                <span className="text-[8px] text-text-dim/60 font-mono w-8 text-right tabular-nums">
                                  {(beatScore * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Beats List */}
                      <div className="space-y-1">
                        {candidate.plan.beats.map((beat, beatIndex) => {
                          const beatScore = candidate.beatScores.find(s => s.beatIndex === beatIndex);
                          return (
                            <div
                              key={beatIndex}
                              className="flex items-start gap-2 text-[11px] leading-relaxed py-1"
                            >
                              <span className="text-text-dim/40 font-mono shrink-0 mt-0.5 text-[9px]">
                                {beatIndex + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-text-secondary">{beat.what}</span>
                                <span className="ml-2 text-text-dim/50 text-[9px]">
                                  {beat.fn}·{beat.mechanism}
                                </span>
                              </div>
                              {beatScore && (
                                <span className={`font-mono text-[9px] shrink-0 tabular-nums px-1.5 py-0.5 rounded ${scoreColorClass(beatScore.score)}`}>
                                  {(beatScore.score * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex gap-0">
              {selectedCandidateList.map((candidate) => {
                const isWinner = candidate.id === tournament.winner;
                const candidateIndex = tournament.candidates.findIndex(c => c.id === candidate.id);
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
                          Candidate #{candidateIndex + 1}
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
          )
          }
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
