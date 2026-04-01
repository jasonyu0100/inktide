'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { NarrativeState, Scene } from '@/types/narrative';
import { generateSceneProse, rewriteSceneProse } from '@/lib/ai';
import { useStore } from '@/lib/store';
import { sceneScale } from '@/lib/ai/context';

export function SceneProseView({
  narrative,
  scene,
  resolvedKeys,
}: {
  narrative: NarrativeState;
  scene: Scene;
  resolvedKeys: string[];
}) {
  const { dispatch } = useStore();

  type ProseState = { text: string; status: 'idle' | 'loading' | 'ready' | 'error'; error?: string };
  const [proseState, setProseState] = useState<ProseState>(() =>
    scene.prose ? { text: scene.prose, status: 'ready' } : { text: '', status: 'idle' }
  );
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when scene changes
  useEffect(() => {
    setProseState(scene.prose ? { text: scene.prose, status: 'ready' } : { text: '', status: 'idle' });
    setIsEditing(false);
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateProse = useCallback(async (guidance?: string) => {
    setProseState({ text: '', status: 'loading' });
    setIsEditing(false);
    try {
      const prose = await generateSceneProse(narrative, scene, resolvedKeys, (token) => {
        setProseState((prev) => ({ text: prev.text + token, status: 'loading' }));
      }, guidance);
      setProseState({ text: prose, status: 'ready' });
      dispatch({ type: 'UPDATE_SCENE', sceneId: scene.id, updates: { prose } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProseState((prev) => ({ ...prev, status: 'error', error: message }));
    }
  }, [narrative, scene, resolvedKeys, dispatch]);

  const rewriteProse = useCallback(async (guidance: string) => {
    const currentProse = proseState.status === 'ready' ? proseState.text : scene.prose;
    if (!currentProse) return;
    setProseState({ text: '', status: 'loading' });
    setIsEditing(false);
    try {
      const { prose } = await rewriteSceneProse(narrative, scene, resolvedKeys, currentProse, guidance, 0, 0, undefined, (token) => {
        setProseState((prev) => ({ text: prev.text + token, status: 'loading' }));
      });
      setProseState({ text: prose, status: 'ready' });
      dispatch({ type: 'UPDATE_SCENE', sceneId: scene.id, updates: { prose } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProseState({ text: currentProse, status: 'error', error: message });
    }
  }, [narrative, scene, resolvedKeys, proseState, dispatch]);

  const saveEdit = useCallback(() => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value;
    setProseState({ text, status: 'ready' });
    setIsEditing(false);
    dispatch({ type: 'UPDATE_SCENE', sceneId: scene.id, updates: { prose: text } });
  }, [scene.id, dispatch]);

  // Listen for palette events
  useEffect(() => {
    function onGenerate(e: Event) {
      const detail = (e as CustomEvent).detail;
      generateProse(detail?.guidance);
    }
    function onClear() {
      setProseState({ text: '', status: 'idle' });
      setIsEditing(false);
      dispatch({ type: 'UPDATE_SCENE', sceneId: scene.id, updates: { prose: undefined } });
    }
    function onEdit() {
      if (isEditing) {
        saveEdit();
      } else {
        setIsEditing(true);
        setTimeout(() => textareaRef.current?.focus(), 30);
      }
    }
    function onRewrite(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.guidance) rewriteProse(detail.guidance);
    }
    window.addEventListener('canvas:generate-prose', onGenerate);
    window.addEventListener('canvas:clear-prose', onClear);
    window.addEventListener('canvas:edit-prose', onEdit);
    window.addEventListener('canvas:rewrite-prose', onRewrite);
    return () => {
      window.removeEventListener('canvas:generate-prose', onGenerate);
      window.removeEventListener('canvas:clear-prose', onClear);
      window.removeEventListener('canvas:edit-prose', onEdit);
      window.removeEventListener('canvas:rewrite-prose', onRewrite);
    };
  }, [generateProse, rewriteProse, isEditing, saveEdit, scene.id, dispatch]);

  // Click outside textarea to save and close editor
  const editorWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isEditing) return;
    function handleClick(e: MouseEvent) {
      if (editorWrapRef.current && !editorWrapRef.current.contains(e.target as Node)) {
        saveEdit();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isEditing, saveEdit]);

  const { status, text, error } = proseState;
  const hasProse = status === 'ready' && !!text;
  const isLoading = status === 'loading';
  const hasError = status === 'error';

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="max-w-2xl mx-auto px-8 pt-6 pb-48">

        {/* Loading — streaming */}
        {isLoading && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="text-[10px] text-text-dim">
                {text ? 'Writing...' : `Generating prose... ~${sceneScale(scene).estWords.toLocaleString()} words`}
              </span>
            </div>
            {text && (
              <div className="prose-content">
                {text.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-[13px] text-text-secondary leading-[1.8] mb-5 first:first-letter:text-2xl first:first-letter:font-semibold first:first-letter:text-text-primary first:first-letter:mr-0.5">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {hasError && (
          <div className="py-12 text-center">
            <p className="text-[11px] text-red-400/80 mb-3">{error}</p>
            <button onClick={() => void generateProse()} className="text-[10px] px-4 py-1.5 rounded-full border border-white/10 text-text-dim hover:text-text-secondary transition">Retry</button>
          </div>
        )}

        {/* Prose display / editor */}
        {hasProse && !isLoading && (
          isEditing ? (
            <div ref={editorWrapRef}>
              <textarea ref={textareaRef} defaultValue={text}
                className="w-full min-h-[60vh] bg-transparent border border-white/8 rounded-lg p-4 text-[13px] text-text-secondary leading-[1.8] resize-y outline-none focus:border-white/15 transition-colors"
                style={{ scrollbarWidth: 'thin' }} />
              <div className="flex items-center gap-2 mt-3">
                <button onClick={saveEdit}
                  className="text-[10px] px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 transition">
                  Save
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="text-[10px] px-3 py-1.5 rounded bg-white/5 border border-white/8 text-text-dim hover:text-text-secondary transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose-content">
              {text.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-[13px] text-text-secondary leading-[1.8] mb-5 first:first-letter:text-2xl first:first-letter:font-semibold first:first-letter:text-text-primary first:first-letter:mr-0.5">
                  {paragraph}
                </p>
              ))}
            </div>
          )
        )}

        {/* Empty state */}
        {!hasProse && !isLoading && !hasError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            {scene.plan ? (
              <>
                <p className="text-[11px] text-text-dim">This scene hasn&apos;t been written yet.</p>
                <p className="text-[10px] text-text-dim/40">Use the palette below to generate prose.</p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-text-dim">Create a plan first, then generate prose.</p>
                <button onClick={() => dispatch({ type: 'SET_GRAPH_VIEW_MODE', mode: 'plan' })}
                  className="text-[10px] text-sky-400/80 hover:text-sky-400 transition">
                  Switch to Plan &rarr;
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
