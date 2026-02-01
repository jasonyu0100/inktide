'use client';

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, ControlMode, InspectorContext, NarrativeState, NarrativeEntry, WizardStep } from '@/types/narrative';
import { seedNarrative } from '@/data/seed';

function narrativeToEntry(n: NarrativeState): NarrativeEntry {
  const threadValues = Object.values(n.threads);
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    sceneCount: Object.keys(n.scenes).length,
    coverThread: threadValues[0]?.description ?? '',
  };
}

const initialState: AppState = {
  narratives: [narrativeToEntry(seedNarrative)],
  activeNarrativeId: seedNarrative.id,
  activeNarrative: seedNarrative,
  controlMode: 'auto',
  isPlaying: false,
  currentSceneIndex: 0,
  inspectorContext: null,
  wizardOpen: false,
  wizardStep: 'premise',
  selectedKnowledgeEntity: null,
  autoTimer: 30,
};

// ── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_ACTIVE_NARRATIVE'; id: string }
  | { type: 'CLEAR_ACTIVE_NARRATIVE' }
  | { type: 'SET_CONTROL_MODE'; mode: ControlMode }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'STOP' }
  | { type: 'NEXT_SCENE' }
  | { type: 'PREV_SCENE' }
  | { type: 'SET_SCENE_INDEX'; index: number }
  | { type: 'SET_INSPECTOR'; context: InspectorContext | null }
  | { type: 'OPEN_WIZARD' }
  | { type: 'CLOSE_WIZARD' }
  | { type: 'SET_WIZARD_STEP'; step: WizardStep }
  | { type: 'ADD_NARRATIVE'; narrative: NarrativeState }
  | { type: 'DELETE_NARRATIVE'; id: string }
  | { type: 'SELECT_KNOWLEDGE_ENTITY'; entityId: string | null }
  | { type: 'SET_AUTO_TIMER'; seconds: number };

function getNarrative(id: string): NarrativeState | null {
  if (id === seedNarrative.id) return seedNarrative;
  return null;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_NARRATIVE': {
      const narrative = getNarrative(action.id);
      const sceneCount = narrative ? Object.keys(narrative.scenes).length : 0;
      return {
        ...state,
        activeNarrativeId: action.id,
        activeNarrative: narrative,
        currentSceneIndex: sceneCount - 1,
        inspectorContext: null,
        selectedKnowledgeEntity: null,
      };
    }
    case 'CLEAR_ACTIVE_NARRATIVE':
      return { ...state, activeNarrativeId: null, activeNarrative: null, inspectorContext: null, selectedKnowledgeEntity: null };
    case 'SET_CONTROL_MODE':
      return { ...state, controlMode: action.mode, isPlaying: false };
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };
    case 'STOP':
      return { ...state, isPlaying: false };
    case 'NEXT_SCENE': {
      const max = state.activeNarrative ? Object.keys(state.activeNarrative.scenes).length - 1 : 0;
      const nextIdx = Math.min(state.currentSceneIndex + 1, max);
      const nextSceneId = state.activeNarrative ? Object.keys(state.activeNarrative.scenes)[nextIdx] : null;
      return {
        ...state,
        currentSceneIndex: nextIdx,
        inspectorContext: nextSceneId ? { type: 'scene' as const, sceneId: nextSceneId } : state.inspectorContext,
      };
    }
    case 'PREV_SCENE': {
      const prevIdx = Math.max(state.currentSceneIndex - 1, 0);
      const prevSceneId = state.activeNarrative ? Object.keys(state.activeNarrative.scenes)[prevIdx] : null;
      return {
        ...state,
        currentSceneIndex: prevIdx,
        inspectorContext: prevSceneId ? { type: 'scene' as const, sceneId: prevSceneId } : state.inspectorContext,
      };
    }
    case 'SET_SCENE_INDEX':
      return { ...state, currentSceneIndex: action.index };
    case 'SET_INSPECTOR':
      return { ...state, inspectorContext: action.context };
    case 'OPEN_WIZARD':
      return { ...state, wizardOpen: true, wizardStep: 'premise' };
    case 'CLOSE_WIZARD':
      return { ...state, wizardOpen: false };
    case 'SET_WIZARD_STEP':
      return { ...state, wizardStep: action.step };
    case 'ADD_NARRATIVE': {
      const entry = narrativeToEntry(action.narrative);
      return {
        ...state,
        narratives: [...state.narratives, entry],
        activeNarrativeId: action.narrative.id,
        activeNarrative: action.narrative,
        currentSceneIndex: 0,
        wizardOpen: false,
      };
    }
    case 'DELETE_NARRATIVE':
      return {
        ...state,
        narratives: state.narratives.filter(n => n.id !== action.id),
        activeNarrativeId: state.activeNarrativeId === action.id ? null : state.activeNarrativeId,
        activeNarrative: state.activeNarrativeId === action.id ? null : state.activeNarrative,
      };
    case 'SELECT_KNOWLEDGE_ENTITY':
      return { ...state, selectedKnowledgeEntity: action.entityId };
    case 'SET_AUTO_TIMER':
      return { ...state, autoTimer: action.seconds };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
type StoreContextType = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
};

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          dispatch({ type: 'PREV_SCENE' });
          break;
        case 'ArrowRight':
          e.preventDefault();
          dispatch({ type: 'NEXT_SCENE' });
          break;
        case ' ':
          e.preventDefault();
          dispatch({ type: 'TOGGLE_PLAY' });
          break;
        case 'Escape':
          dispatch({ type: 'SET_INSPECTOR', context: null });
          dispatch({ type: 'SELECT_KNOWLEDGE_ENTITY', entityId: null });
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
