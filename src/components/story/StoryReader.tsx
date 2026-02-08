'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { NarrativeState, Scene } from '@/types/narrative';
import { resolveEntry, isScene } from '@/types/narrative';
import { generateSceneProse } from '@/lib/ai';
import { useStore } from '@/lib/store';

type ProseCache = Record<string, { text: string; status: 'loading' | 'ready' | 'error'; error?: string }>;

export function StoryReader({
  narrative,
  resolvedKeys,
  onClose,
}: {
  narrative: NarrativeState;
  resolvedKeys: string[];
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const scenes = resolvedKeys
    .map((k) => resolveEntry(narrative, k))
    .filter((e): e is Scene => !!e && isScene(e));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [proseCache, setProseCache] = useState<ProseCache>({});
  const contentRef = useRef<HTMLDivElement>(null);

  const scene = scenes[currentIndex];
  const arc = scene ? Object.values(narrative.arcs).find((a) => a.sceneIds.includes(scene.id)) : null;
  const location = scene ? narrative.locations[scene.locationId] : null;
  const pov = scene ? narrative.characters[scene.povId] : null;

  // Find the scene's position in resolvedKeys for context
  const sceneKeyIndex = scene ? resolvedKeys.indexOf(scene.id) : -1;

  const generateProse = useCallback(async (s: Scene, idx: number) => {
    setProseCache((prev) => ({ ...prev, [s.id]: { text: '', status: 'loading' } }));
    try {
      const prose = await generateSceneProse(narrative, s, idx, resolvedKeys);
      setProseCache((prev) => ({ ...prev, [s.id]: { text: prose, status: 'ready' } }));
      dispatch({ type: 'UPDATE_SCENE', sceneId: s.id, updates: { prose } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProseCache((prev) => ({ ...prev, [s.id]: { text: '', status: 'error', error: message } }));
    }
  }, [narrative, resolvedKeys, dispatch]);

  // Auto-generate prose when navigating to a scene that hasn't been generated
  useEffect(() => {
    if (!scene) return;
    // Use existing prose field if available
    if (scene.prose && !proseCache[scene.id]) {
      setProseCache((prev) => ({ ...prev, [scene.id]: { text: scene.prose!, status: 'ready' } }));
    }
  }, [scene, proseCache]);

  // Scroll to top when changing scenes
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(scenes.length - 1, i + 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scenes.length, onClose]);

  if (scenes.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-dim text-sm">No scenes yet.</p>
          <button onClick={onClose} className="mt-4 text-[11px] text-text-dim hover:text-text-primary transition">
            Close
          </button>
        </div>
      </div>
    );
  }

  const cached = scene ? proseCache[scene.id] : undefined;
  const hasProse = cached?.status === 'ready';
  const isLoading = cached?.status === 'loading';
  const hasError = cached?.status === 'error';

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-text-primary">{narrative.title}</h2>
          {arc && (
            <span className="text-[11px] text-text-dim">
              {arc.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-dim font-mono">
            {currentIndex + 1} / {scenes.length}
          </span>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-primary text-lg leading-none transition"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Scene list sidebar */}
        <div className="w-56 shrink-0 border-r border-white/5 overflow-y-auto py-2">
          {scenes.map((s, i) => {
            const sArc = Object.values(narrative.arcs).find((a) => a.sceneIds.includes(s.id));
            const hasContent = proseCache[s.id]?.status === 'ready' || !!s.prose;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-full text-left px-4 py-2.5 transition-colors ${
                  i === currentIndex
                    ? 'bg-white/8 text-text-primary'
                    : 'text-text-dim hover:bg-white/4 hover:text-text-secondary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-dim shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[11px] truncate">
                    {s.summary.slice(0, 60)}{s.summary.length > 60 ? '...' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-5">
                  {sArc && <span className="text-[9px] text-text-dim">{sArc.name}</span>}
                  {hasContent && (
                    <span className="text-[8px] text-emerald-400/60">●</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Reading pane */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10">
            {/* Scene header */}
            <div className="mb-8 border-b border-white/5 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-mono text-text-dim">Scene {currentIndex + 1}</span>
                {arc && (
                  <>
                    <span className="text-text-dim/30">&middot;</span>
                    <span className="text-[10px] text-text-dim uppercase tracking-wider">{arc.name}</span>
                  </>
                )}
              </div>
              <h3 className="text-base text-text-primary font-medium leading-relaxed mb-3">
                {scene.summary}
              </h3>
              <div className="flex items-center gap-4 text-[10px] text-text-dim">
                {location && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {location.name}
                  </span>
                )}
                {pov && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {pov.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {scene.participantIds.map((pid) => narrative.characters[pid]?.name ?? pid).join(', ')}
                </span>
              </div>
            </div>

            {/* Prose content */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                <p className="text-[11px] text-text-dim">Generating prose...</p>
              </div>
            )}

            {hasError && (
              <div className="py-12 text-center">
                <p className="text-[11px] text-red-400/80 mb-3">{cached?.error}</p>
                <button
                  onClick={() => generateProse(scene, sceneKeyIndex)}
                  className="text-[10px] px-4 py-1.5 rounded-full border border-white/10 text-text-dim hover:text-text-secondary transition"
                >
                  Retry
                </button>
              </div>
            )}

            {hasProse && (
              <div className="prose-content">
                {cached!.text.split('\n\n').map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-[13px] text-text-secondary leading-[1.8] mb-5 first:first-letter:text-2xl first:first-letter:font-semibold first:first-letter:text-text-primary first:first-letter:mr-0.5"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {!hasProse && !isLoading && !hasError && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-[11px] text-text-dim">This scene hasn&apos;t been written yet.</p>
                <button
                  onClick={() => generateProse(scene, sceneKeyIndex)}
                  className="text-[11px] px-5 py-2 rounded-full bg-white/8 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/12 transition"
                >
                  Generate Prose
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between shrink-0">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="text-[10px] px-3.5 py-1.5 rounded-full border border-white/8 text-text-dim hover:text-text-secondary hover:border-white/12 transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </button>
        <div className="text-[9px] text-text-dim/50">
          Arrow keys to navigate &middot; Esc to close
        </div>
        <button
          onClick={() => setCurrentIndex((i) => Math.min(scenes.length - 1, i + 1))}
          disabled={currentIndex === scenes.length - 1}
          className="text-[10px] px-3.5 py-1.5 rounded-full border border-white/8 text-text-dim hover:text-text-secondary hover:border-white/12 transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
        >
          Next
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
