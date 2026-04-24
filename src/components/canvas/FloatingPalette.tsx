"use client";

import {
  IconActivity,
  IconAutoLoop,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconEdit,
  IconFlask,
  IconList,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTrash,
} from "@/components/icons";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useStore } from "@/lib/store";
import { resolvePlanForBranch, resolveProseForBranch } from "@/lib/narrative-utils";
import {
  computeNarrativeHealth,
  renderHealthReportForPrompt,
  type HealthBand,
} from "@/lib/narrative-health";
import { HealthReportModal } from "@/components/health/HealthReportModal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Colour per health band — matches the existing palette (emerald for good,
// amber for watch, orange for needs maintenance, rose for critical).
const HEALTH_BAND_STYLE: Record<HealthBand, { text: string; bg: string; label: string }> = {
  healthy: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Healthy' },
  watch: { text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Watch' },
  needs_maintenance: { text: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Needs maintenance' },
  critical: { text: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Critical' },
};

type FloatingPaletteProps = {
  isBulkActive?: boolean;
  isBulkAudioActive?: boolean;
  isMctsActive?: boolean;
};

export default function FloatingPalette({
  isBulkActive = false,
  isBulkAudioActive = false,
  isMctsActive = false,
}: FloatingPaletteProps) {
  const { state, dispatch } = useStore();
  const access = useFeatureAccess();
  const narrative = state.activeNarrative;
  const isActive = narrative !== null;

  const totalScenes = state.resolvedEntryKeys.length;
  const isHead = state.viewState.currentSceneIndex === totalScenes - 1 && totalScenes > 0;
  const activeBranch =
    narrative && state.viewState.activeBranchId
      ? narrative.branches[state.viewState.activeBranchId]
      : null;
  const headSceneId = state.resolvedEntryKeys[state.viewState.currentSceneIndex];
  const headIsOwned = activeBranch
    ? activeBranch.entryIds.includes(headSceneId)
    : false;
  // Block deletion if this scene is used as a fork point by any other branch
  const headIsForkPoint = narrative
    ? Object.values(narrative.branches).some(
        (b) => b.id !== state.viewState.activeBranchId && b.forkEntryId === headSceneId,
      )
    : false;
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  // Report modal sits one step beyond the popover overview: user sees the
  // high-level diagnostic in the popover, requests a full report, reviews
  // it, then decides whether to trigger the health expansion.
  const [healthReportModalOpen, setHealthReportModalOpen] = useState(false);
  // Wrapper ref covers BOTH the trigger button and the popover — without this
  // the mousedown outside-click listener fires before the button's click,
  // closing the popover so the subsequent toggle-click reopens it instead of
  // closing it.
  const healthWrapperRef = useRef<HTMLDivElement | null>(null);

  // Lazy health evaluation — recomputed only while the popover OR the report
  // modal is open so we don't pay the cost on every render. Without the
  // modal branch, clicking "View health report" closes the popover, which
  // drops healthReport to null, which prevents the modal from ever mounting
  // (its render gate depends on a truthy healthReport).
  const healthReport = useMemo(() => {
    if ((!healthOpen && !healthReportModalOpen) || !narrative) return null;
    return computeNarrativeHealth(
      narrative,
      state.resolvedEntryKeys,
      state.viewState.currentSceneIndex,
      state.autoConfig,
    );
  }, [
    healthOpen,
    healthReportModalOpen,
    narrative,
    state.resolvedEntryKeys,
    state.viewState.currentSceneIndex,
    state.autoConfig,
  ]);

  // Scenes since the most recent world expansion — the primary reminder
  // signal for the Diagnose button. A world commit is encouraged every ~3
  // arcs or 12 scenes to keep the portfolio fresh; the button gradient
  // nudges the user when they're overdue. Shift points: 8 (aging), 12
  // (warning), 16 (critical). No expansion ever → counts every scene.
  const scenesSinceLastExpansion = useMemo(() => {
    if (!narrative) return 0;
    const keys = state.resolvedEntryKeys;
    let count = 0;
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      if (narrative.worldBuilds?.[key]) return count;
      if (narrative.scenes?.[key]) count++;
    }
    return count;
  }, [narrative, state.resolvedEntryKeys]);

  const freshnessClass = useMemo(() => {
    // Green (fresh) → orange (getting stale) → red (overdue). The button's
    // open state still gets a slightly brighter variant of the same band.
    const open = healthOpen;
    if (scenesSinceLastExpansion < 8) {
      return open
        ? 'text-emerald-300 bg-emerald-500/20'
        : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20';
    }
    if (scenesSinceLastExpansion < 12) {
      return open
        ? 'text-lime-300 bg-lime-500/20'
        : 'text-lime-400 bg-lime-500/10 hover:bg-lime-500/20';
    }
    if (scenesSinceLastExpansion < 16) {
      return open
        ? 'text-orange-300 bg-orange-500/20'
        : 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20';
    }
    return open
      ? 'text-red-300 bg-red-500/20'
      : 'text-red-400 bg-red-500/10 hover:bg-red-500/20';
  }, [healthOpen, scenesSinceLastExpansion]);

  // Dismiss the popover on outside click.
  useEffect(() => {
    if (!healthOpen) return;
    function onDown(e: MouseEvent) {
      if (!healthWrapperRef.current) return;
      if (!healthWrapperRef.current.contains(e.target as Node)) setHealthOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [healthOpen]);


  const runHealthExpansion = useCallback((briefOverride?: string) => {
    if (!healthReport) return;
    setHealthOpen(false);
    // Prefer the AI-generated brief (when the user launched from the report
    // modal) — it's richer and more context-aware than the deterministic
    // rule-based report. Fall back to the rule-based render otherwise.
    const directive = briefOverride?.trim().length
      ? briefOverride
      : renderHealthReportForPrompt(healthReport);
    window.dispatchEvent(
      new CustomEvent('open-generate-panel', {
        detail: {
          healthMode: true,
          healthReport: directive,
          // Quick-action mode: auto-kick the expansion reasoning graph on
          // open so the user sees streaming immediately without re-clicking.
          autoRun: true,
        },
      }),
    );
  }, [healthReport]);
  const isAutoActive = !!(
    state.viewState.autoRunState?.isRunning || state.viewState.autoRunState?.isPaused
  );
  const isAnyModeActive =
    isAutoActive || isBulkActive || isBulkAudioActive || isMctsActive;

  const handleDeleteHead = useCallback(() => {
    if (!narrative || !state.viewState.activeBranchId || !isHead) return;
    const headSceneId = state.resolvedEntryKeys[state.viewState.currentSceneIndex];
    if (!headSceneId) return;

    const branchesWithEntry = Object.values(narrative.branches).filter((b) =>
      b.entryIds.includes(headSceneId),
    );

    if (branchesWithEntry.length <= 1) {
      dispatch({
        type: "DELETE_SCENE",
        sceneId: headSceneId,
        branchId: state.viewState.activeBranchId,
      });
    } else {
      dispatch({
        type: "REMOVE_BRANCH_ENTRY",
        entryId: headSceneId,
        branchId: state.viewState.activeBranchId,
      });
    }
    setDeleteConfirm(false);
  }, [
    narrative,
    state.viewState.activeBranchId,
    state.resolvedEntryKeys,
    state.viewState.currentSceneIndex,
    isHead,
    dispatch,
  ]);

  const graphViewMode = state.graphViewMode;
  const isEditingMode =
    graphViewMode === "plan" ||
    graphViewMode === "prose" ||
    graphViewMode === "audio" ||
    graphViewMode === "game";

  // Branch context for version resolution
  const branchId = state.viewState.activeBranchId;
  const branches = useMemo(() => narrative?.branches ?? {}, [narrative?.branches]);

  // Current scene — for checking if rewrite is available
  const currentScene = useMemo(() => {
    if (!narrative) return null;
    const key = state.resolvedEntryKeys[state.viewState.currentSceneIndex];
    return key ? (narrative.scenes[key] ?? null) : null;
  }, [narrative, state.resolvedEntryKeys, state.viewState.currentSceneIndex]);

  const hasPlan = useMemo(() => {
    if (!currentScene || !branchId) return false;
    return !!resolvePlanForBranch(currentScene, branchId, branches);
  }, [currentScene, branchId, branches]);

  const hasProse = useMemo(() => {
    if (!currentScene || !branchId) return false;
    return !!resolveProseForBranch(currentScene, branchId, branches).prose;
  }, [currentScene, branchId, branches]);

  // Plan extraction source gates whether the Generate Plan button is available.
  // In 'prose' mode the plan is reverse-engineered from existing prose, so
  // prose must exist for the button to do anything meaningful — disable it
  // otherwise to make the requirement visible.
  const planSource = narrative?.storySettings?.planExtractionSource ?? 'structure';
  const canGeneratePlan = planSource === 'structure' || hasProse;
  const generatePlanDisabledReason = !canGeneratePlan
    ? 'Plan extraction is set to "prose". Generate prose first — the plan will be reverse-engineered from it.'
    : undefined;

  const hasAudio = !!currentScene?.audioUrl;
  const wrapperClasses = isActive ? "" : "opacity-30 pointer-events-none";
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateText, setGenerateText] = useState("");
  const generateInputRef = useRef<HTMLTextAreaElement>(null);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteText, setRewriteText] = useState("");
  const rewriteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (generateOpen) setTimeout(() => generateInputRef.current?.focus(), 50);
    else setGenerateText("");
  }, [generateOpen]);

  useEffect(() => {
    if (rewriteOpen) setTimeout(() => rewriteInputRef.current?.focus(), 50);
    else setRewriteText("");
  }, [rewriteOpen]);

  const submitGenerate = useCallback(() => {
    const event =
      graphViewMode === "plan"
        ? "canvas:generate-plan"
        : "canvas:generate-prose";
    window.dispatchEvent(
      new CustomEvent(event, { detail: { guidance: generateText.trim() } }),
    );
    setGenerateOpen(false);
    setGenerateText("");
  }, [generateText, graphViewMode]);

  const submitRewrite = useCallback(() => {
    if (!rewriteText.trim()) return;
    const event =
      graphViewMode === "plan" ? "canvas:rewrite-plan" : "canvas:rewrite-prose";
    window.dispatchEvent(
      new CustomEvent(event, { detail: { guidance: rewriteText.trim() } }),
    );
    setRewriteOpen(false);
    setRewriteText("");
  }, [rewriteText, graphViewMode]);

  // ── Editing mode palette (plan / prose) ───────────────────────────────
  if (isEditingMode) {
    return (
      <>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
          {/* Generate guidance overlay */}
          {generateOpen && (
            <div
              className="w-96 flex flex-col rounded-xl border border-white/10 overflow-hidden"
              style={{
                background: "#1a1a1a",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase tracking-wider text-emerald-400/70`}
                >
                  Generate {graphViewMode === "plan" ? "Plan" : "Prose"}
                </span>
                <button
                  onClick={() => setGenerateOpen(false)}
                  className="text-[10px] text-text-dim/40 hover:text-text-dim transition"
                >
                  &times;
                </button>
              </div>
              <div className="p-3">
                <textarea
                  ref={generateInputRef}
                  value={generateText}
                  onChange={(e) => setGenerateText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setGenerateOpen(false);
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                      submitGenerate();
                  }}
                  placeholder={
                    graphViewMode === "plan"
                      ? 'Optional direction... e.g. "focus on the power struggle" or "open with a quiet moment"'
                      : 'Optional direction... e.g. "write it sparse and clipped" or "lean into sensory detail"'
                  }
                  className="w-full h-20 bg-black/20 border border-white/5 rounded text-[11px] text-text-secondary p-2 resize-none outline-none focus:border-white/15 placeholder:text-text-dim/30"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] text-text-dim/30">
                    &#x2318;Enter to submit
                  </span>
                  <button
                    onClick={submitGenerate}
                    className={`text-[10px] px-3 py-1 rounded transition bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15`}
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rewrite guidance overlay */}
          {rewriteOpen && (
            <div
              className="w-96 flex flex-col rounded-xl border border-white/10 overflow-hidden"
              style={{
                background: "#1a1a1a",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    graphViewMode === "plan"
                      ? "text-sky-400"
                      : "text-emerald-400"
                  }`}
                >
                  Rewrite {graphViewMode === "plan" ? "Plan" : "Prose"}
                </span>
                <button
                  onClick={() => setRewriteOpen(false)}
                  className="text-[10px] text-text-dim/40 hover:text-text-dim transition"
                >
                  &times;
                </button>
              </div>
              <div className="p-3">
                <textarea
                  ref={rewriteInputRef}
                  value={rewriteText}
                  onChange={(e) => setRewriteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRewriteOpen(false);
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                      submitRewrite();
                  }}
                  placeholder={
                    graphViewMode === "plan"
                      ? 'Describe what to change... e.g. "add more tension before the reveal" or "swap the dialogue beat for inner monologue"'
                      : 'Describe what to change... e.g. "make the opening more visceral" or "tighten the pacing in the middle section"'
                  }
                  className="w-full h-20 bg-black/20 border border-white/5 rounded text-[11px] text-text-secondary p-2 resize-none outline-none focus:border-white/15 placeholder:text-text-dim/30"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] text-text-dim/30">
                    &#x2318;Enter to submit
                  </span>
                  <button
                    onClick={submitRewrite}
                    disabled={!rewriteText.trim()}
                    className={`text-[10px] px-3 py-1 rounded transition disabled:opacity-30 disabled:cursor-not-allowed ${
                      graphViewMode === "plan"
                        ? "bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/15"
                        : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15"
                    }`}
                  >
                    Rewrite
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            className={`glass-pill px-3 py-1.5 flex items-center gap-2 ${wrapperClasses}`}
          >
            {/* Scene nav */}
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
              onClick={() => dispatch({ type: "PREV_SCENE" })}
              aria-label="Previous scene"
            >
              <IconChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${state.graphViewMode === 'search' ? "text-text-primary bg-white/10" : "text-text-secondary hover:text-text-primary hover:bg-white/6"}`}
              onClick={() => dispatch({ type: 'SET_GRAPH_VIEW_MODE', mode: 'search' })}
              aria-label="Search narrative"
              title="Search narrative"
            >
              <IconSearch size={12} />
            </button>
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
              onClick={() => dispatch({ type: "NEXT_SCENE" })}
              aria-label="Next scene"
            >
              <IconChevronRight size={14} />
            </button>

            {/* Plan/Prose/Audio palette actions — hidden during auto/MCTS/bulk */}
            {!isAnyModeActive && (
              <>
                <div className="w-px h-4 bg-white/12 mx-1" />

                {/* Plan palette actions */}
                {graphViewMode === "plan" && (
                  <>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors uppercase tracking-wider ${!canGeneratePlan ? "text-text-dim/30 bg-white/3 cursor-not-allowed" : "text-world bg-world/10 hover:bg-world/20"}`}
                      onClick={() => {
                        if (canGeneratePlan) {
                          setGenerateOpen((v) => !v);
                          setRewriteOpen(false);
                        }
                      }}
                      title={canGeneratePlan ? undefined : generatePlanDisabledReason}
                    >
                      Generate
                    </button>
                    {hasPlan && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-sky-400 bg-sky-500/10 hover:bg-sky-500/20"
                        onClick={() => {
                          setRewriteOpen((v) => !v);
                          setGenerateOpen(false);
                        }}
                        title="Rewrite with guidance"
                      >
                        <IconRefresh size={14} />
                      </button>
                    )}
                    {hasPlan && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("canvas:clear-plan"),
                          )
                        }
                        title="Clear plan"
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                    <div className="w-px h-4 bg-white/12 mx-0.5" />
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("canvas:open-candidates"),
                        )
                      }
                      title="Generate multiple candidate plans and rank by semantic similarity"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("canvas:bulk-plan"),
                        )
                      }
                      title="Bulk generate all missing plans"
                    >
                      <IconAutoLoop size={14} />
                    </button>
                  </>
                )}

                {/* Prose palette actions */}
                {graphViewMode === "prose" && (
                  <>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors uppercase tracking-wider ${!hasPlan ? "text-text-dim/30 bg-white/3 cursor-not-allowed" : "text-world bg-world/10 hover:bg-world/20"}`}
                      onClick={() => {
                        if (hasPlan) {
                          setGenerateOpen((v) => !v);
                          setRewriteOpen(false);
                        }
                      }}
                      title={hasPlan ? undefined : "Generate a plan first"}
                    >
                      Generate
                    </button>
                    {hasProse && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
                        onClick={() => {
                          setRewriteOpen((v) => !v);
                          setGenerateOpen(false);
                        }}
                        title="Rewrite with guidance"
                      >
                        <IconRefresh size={14} />
                      </button>
                    )}
                    {hasProse && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("canvas:edit-prose"),
                          )
                        }
                        title="Edit prose"
                      >
                        <IconEdit size={14} />
                      </button>
                    )}
                    {hasProse && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("canvas:clear-prose"),
                          )
                        }
                        title="Clear prose"
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                    <div className="w-px h-4 bg-white/12 mx-0.5" />
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("canvas:bulk-prose"),
                        )
                      }
                      title="Bulk generate all missing prose (requires plans)"
                    >
                      <IconAutoLoop size={14} />
                    </button>
                  </>
                )}

                {/* Game palette actions — Generate / Clear / Auto */}
                {graphViewMode === "game" && (
                  <>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors uppercase tracking-wider ${hasPlan || hasProse ? "text-world bg-world/10 hover:bg-world/20" : "text-text-dim/30 bg-white/3 cursor-not-allowed"}`}
                      onClick={() =>
                        (hasPlan || hasProse) &&
                        window.dispatchEvent(
                          new CustomEvent("canvas:generate-game"),
                        )
                      }
                      title={hasPlan || hasProse ? undefined : "Generate a plan or prose first"}
                    >
                      Generate
                    </button>
                    {currentScene?.gameAnalysis && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("canvas:clear-game"),
                          )
                        }
                        title="Clear analysis"
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                    <div className="w-px h-4 bg-white/12 mx-0.5" />
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("canvas:bulk-game"),
                        )
                      }
                      title="Analyse all scenes with plans or prose (sliding-window parallel)"
                    >
                      <IconAutoLoop size={14} />
                    </button>
                  </>
                )}

                {/* Audio palette actions */}
                {graphViewMode === "audio" && (
                  <>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors uppercase tracking-wider ${hasProse ? "text-world bg-world/10 hover:bg-world/20" : "text-text-dim/30 bg-white/3 cursor-not-allowed"}`}
                      onClick={() =>
                        hasProse &&
                        window.dispatchEvent(
                          new CustomEvent("canvas:generate-audio"),
                        )
                      }
                      title={hasProse ? undefined : "Generate prose first"}
                    >
                      Generate
                    </button>
                    {hasAudio && (
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("canvas:clear-audio"),
                          )
                        }
                        title="Clear audio"
                      >
                        <IconClose size={14} />
                      </button>
                    )}
                    <div className="w-px h-4 bg-white/12 mx-0.5" />
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("canvas:bulk-audio"),
                        )
                      }
                      title="Bulk generate all missing audio (requires prose)"
                    >
                      <IconAutoLoop size={14} />
                    </button>
                  </>
                )}
              </>
            )}

            <div className="w-px h-4 bg-white/12 mx-1" />

            {/* Story Settings — always visible */}
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-story-settings"))
              }
              title="Story settings"
            >
              <IconSettings size={14} />
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
      {/* Palette row: bar + delete button side by side */}
      <div className="flex items-center gap-2">
        <div
          className={`glass-pill px-3 py-1.5 flex items-center gap-2 ${wrapperClasses}`}
        >
          {/* Scene navigation — always visible */}
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
            onClick={() => dispatch({ type: "PREV_SCENE" })}
            aria-label="Previous scene"
          >
            <IconChevronLeft size={14} />
          </button>

          {/* Search */}
          <button
            type="button"
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              state.graphViewMode === 'search'
                ? "text-text-primary bg-white/10"
                : "text-text-secondary hover:text-text-primary hover:bg-white/6"
            }`}
            onClick={() => dispatch({ type: 'SET_GRAPH_VIEW_MODE', mode: 'search' })}
            aria-label="Search narrative"
            title="Search narrative"
          >
            <IconSearch size={12} />
          </button>

          {/* Next */}
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/6 rounded-md transition-colors"
            onClick={() => dispatch({ type: "NEXT_SCENE" })}
            aria-label="Next scene"
          >
            <IconChevronRight size={14} />
          </button>

          {/* Action buttons — hidden during auto/MCTS/bulk */}
          {!isAnyModeActive && (
            <>
              {/* Divider */}
              <div className="w-px h-4 bg-white/12 mx-1" />

              {/* Generate */}
              <button
                type="button"
                className="text-xs font-semibold text-world bg-world/10 px-2 py-1 rounded-md hover:bg-world/20 transition-colors uppercase tracking-wider"
                onClick={() => {
                  if (access.userApiKeys && !access.hasOpenRouterKey) {
                    window.dispatchEvent(new Event("open-api-keys"));
                    return;
                  }
                  window.dispatchEvent(new CustomEvent("open-generate-panel"));
                }}
              >
                Generate
              </button>

              {/* MCTS Explorer */}
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                onClick={() => {
                  if (access.userApiKeys && !access.hasOpenRouterKey) {
                    window.dispatchEvent(new Event("open-api-keys"));
                    return;
                  }
                  window.dispatchEvent(new CustomEvent("open-mcts-panel"));
                }}
                title="MCTS Explorer"
              >
                <IconFlask size={14} />
              </button>

              {/* Auto */}
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                onClick={() => {
                  if (access.userApiKeys && !access.hasOpenRouterKey) {
                    window.dispatchEvent(new Event("open-api-keys"));
                    return;
                  }
                  window.dispatchEvent(new CustomEvent("open-auto-settings"));
                }}
                title="Auto mode"
              >
                <IconAutoLoop size={14} />
              </button>

              {/* Diagnose — narrative health check + maintenance top-up.
                  Colour grades green → orange → red as scenes since the
                  last world expansion cross 8 / 12 / 16. */}
              <div className="relative" ref={healthWrapperRef}>
                <button
                  type="button"
                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${freshnessClass}`}
                  onClick={() => setHealthOpen((v) => !v)}
                  title={`Diagnose narrative health — ${scenesSinceLastExpansion} scene${scenesSinceLastExpansion === 1 ? '' : 's'} since last world expansion (encouraged every ~12 scenes)`}
                >
                  <IconActivity size={14} />
                </button>
                {healthOpen && healthReport && (() => {
                  const t = healthReport.dimensions.threads;
                  const dangerCount = t.deficits.filter((d) => d.startsWith('DANGER')).length;
                  const warningCount = t.deficits.length - dangerCount;
                  return (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 rounded-xl border border-border bg-bg-elevated shadow-2xl overflow-hidden"
                      style={{ zIndex: 40 }}
                    >
                      <div className="p-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${HEALTH_BAND_STYLE[t.band].text} ${HEALTH_BAND_STYLE[t.band].bg}`}
                            >
                              {HEALTH_BAND_STYLE[t.band].label}
                            </span>
                            <span className="text-sm font-mono tabular-nums text-text-primary">
                              {Math.round(t.score * 100)}%
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHealthOpen(false)}
                            className="text-text-dim hover:text-text-secondary"
                            title="Close"
                          >
                            <IconClose size={12} />
                          </button>
                        </div>
                        <span className="text-[9px] uppercase tracking-widest text-text-dim">
                          Portfolio at a glance
                        </span>
                        <p className="text-[11px] text-text-secondary leading-snug font-mono">
                          {t.summary}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] pt-1 border-t border-white/5">
                          {dangerCount > 0 && (
                            <span className="text-red-400">
                              {dangerCount} danger{dangerCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {warningCount > 0 && (
                            <span className="text-amber-400">
                              {warningCount} warning{warningCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {dangerCount === 0 && warningCount === 0 && (
                            <span className="text-text-dim">No issues flagged</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setHealthOpen(false);
                            setHealthReportModalOpen(true);
                          }}
                          className="mt-1 text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors uppercase tracking-wider text-sky-300 bg-sky-500/15 hover:bg-sky-500/25"
                          title="Generate the full analyst report"
                        >
                          View health report
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Divider */}
              <div className="w-px h-4 bg-white/12 mx-1" />
            </>
          )}

          {/* Coordination Plan */}
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-coordination-plan"))
            }
            title="Coordination plan"
          >
            <IconList size={14} />
          </button>

          {/* Story Settings — always visible */}
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-dim bg-white/5 hover:bg-white/10 hover:text-text-secondary"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-story-settings"))
            }
            title="Story settings"
          >
            <IconSettings size={14} />
          </button>
        </div>

        {/* Delete head scene button */}
        {isActive &&
          isHead &&
          headIsOwned &&
          (headIsForkPoint ? (
            <button
              type="button"
              disabled
              title="Another branch forks from this scene — delete that branch first"
              className="w-8 h-8 flex items-center justify-center rounded-full glass-pill text-text-dim opacity-30 cursor-not-allowed"
            >
              <IconTrash size={14} />
            </button>
          ) : deleteConfirm ? (
            <div className="glass-pill px-2 py-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDeleteHead}
                className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-text-dim hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full glass-pill text-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete head scene"
            >
              <IconTrash size={14} />
            </button>
          ))}
      </div>
    </div>
    {healthReportModalOpen && healthReport && narrative && (
      <HealthReportModal
        report={healthReport}
        narrative={narrative}
        resolvedKeys={state.resolvedEntryKeys}
        currentIndex={state.viewState.currentSceneIndex}
        onClose={() => setHealthReportModalOpen(false)}
        onRunExpansion={(brief) => {
          setHealthReportModalOpen(false);
          runHealthExpansion(brief);
        }}
      />
    )}
    </>
  );
}
