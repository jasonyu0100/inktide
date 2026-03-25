'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { evaluateNarrativeState, checkEndConditions, pickArcLength, buildActionDirective } from '@/lib/auto-engine';
import { generateScenes } from '@/lib/ai';
import type { AutoRunLog } from '@/types/narrative';

export function useAutoPlay() {
  const { state, dispatch } = useStore();
  const cancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const runCycle = useCallback(async () => {
    const { activeNarrative, resolvedEntryKeys, currentSceneIndex, activeBranchId, autoConfig, autoRunState } = stateRef.current;
    if (!activeNarrative || !activeBranchId || !autoRunState) return;

    // Check end conditions
    const endMet = checkEndConditions(activeNarrative, resolvedEntryKeys, autoConfig, autoRunState.startingSceneCount, autoRunState.startingArcCount);
    if (endMet) {
      dispatch({
        type: 'LOG_AUTO_CYCLE',
        entry: {
          cycle: autoRunState.currentCycle + 1,
          timestamp: Date.now(),
          action: 'LHL',
          reason: `End condition met: ${endMet.type}`,
          scenesGenerated: 0,
          worldExpanded: false,
          endConditionMet: endMet,
        },
      });
      dispatch({ type: 'STOP_AUTO_RUN' });
      return;
    }

    // Evaluate and pick action
    const { weights, directiveCtx } = evaluateNarrativeState(
      activeNarrative,
      resolvedEntryKeys,
      currentSceneIndex,
      autoConfig,
      autoRunState.startingSceneCount,
      autoRunState.startingArcCount,
    );
    const chosen = weights[0];
    if (!chosen) {
      dispatch({ type: 'STOP_AUTO_RUN' });
      return;
    }

    const action = chosen.action;
    let scenesGenerated = 0;
    let worldExpanded = false;

    try {
      // Resolve world focus from story settings
      const worldFocusMode = activeNarrative.storySettings?.worldFocus ?? 'none';
      let worldBuildFocus = undefined;
      if (worldFocusMode === 'latest') {
        const lastWbKey = [...resolvedEntryKeys].reverse().find((k) => activeNarrative.worldBuilds[k]);
        if (lastWbKey) worldBuildFocus = activeNarrative.worldBuilds[lastWbKey];
      } else if (worldFocusMode === 'custom' && activeNarrative.storySettings?.worldFocusId) {
        worldBuildFocus = activeNarrative.worldBuilds[activeNarrative.storySettings.worldFocusId];
      }

      // Merge fresh story settings direction/constraints into auto config
      // (planning queue may have updated these mid-run)
      const freshConfig = { ...autoConfig };
      const freshDir = activeNarrative.storySettings?.storyDirection?.trim();
      const freshCon = activeNarrative.storySettings?.storyConstraints?.trim();
      if (freshDir) freshConfig.northStarPrompt = freshDir;
      if (freshCon) freshConfig.narrativeConstraints = freshCon;

      // Generate arc
      const directive = buildActionDirective(action, activeNarrative, freshConfig, directiveCtx);
      const sceneCount = pickArcLength(autoConfig, action);
      const { scenes, arc } = await generateScenes(
        activeNarrative,
        resolvedEntryKeys,
        currentSceneIndex,
        sceneCount,
        directive,
        { worldBuildFocus },
      );
      if (cancelledRef.current) return;

      dispatch({
        type: 'BULK_ADD_SCENES',
        scenes,
        arc,
        branchId: activeBranchId,
      });
      scenesGenerated = scenes.length;

    } catch (err) {
      // Log error but don't crash the loop
      console.error('[auto-play] cycle error:', err);
    }

    if (cancelledRef.current) return;

    // Log the cycle
    const logEntry: AutoRunLog = {
      cycle: autoRunState.currentCycle + 1,
      timestamp: Date.now(),
      action,
      reason: chosen.reason,
      scenesGenerated,
      worldExpanded,
      endConditionMet: null,
    };
    dispatch({ type: 'LOG_AUTO_CYCLE', entry: logEntry });
  }, [dispatch]);

  // The loop: run a cycle, then immediately continue
  const tick = useCallback(async () => {
    if (cancelledRef.current || !runningRef.current) return;

    await runCycle();

    if (cancelledRef.current || !runningRef.current) return;

    // Continue immediately — no pause between cycles
    timeoutRef.current = setTimeout(() => tick(), 100);
  }, [runCycle]);

  const start = useCallback(() => {
    cancelledRef.current = false;
    runningRef.current = true;
    dispatch({ type: 'START_AUTO_RUN' });
    // Kick off after a brief delay to let state settle
    timeoutRef.current = setTimeout(() => tick(), 500);
  }, [dispatch, tick]);

  const pause = useCallback(() => {
    runningRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    dispatch({ type: 'PAUSE_AUTO_RUN' });
  }, [dispatch]);

  const resume = useCallback(() => {
    cancelledRef.current = false;
    runningRef.current = true;
    dispatch({ type: 'RESUME_AUTO_RUN' });
    timeoutRef.current = setTimeout(() => tick(), 500);
  }, [dispatch, tick]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    runningRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    dispatch({ type: 'STOP_AUTO_RUN' });
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Stop if autoRunState goes away or is stopped externally
  useEffect(() => {
    if (!state.autoRunState?.isRunning && runningRef.current) {
      runningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [state.autoRunState?.isRunning]);

  return {
    start,
    pause,
    resume,
    stop,
    isRunning: state.autoRunState?.isRunning ?? false,
    isPaused: state.autoRunState?.isPaused ?? false,
    currentCycle: state.autoRunState?.currentCycle ?? 0,
    log: state.autoRunState?.log ?? [],
  };
}

