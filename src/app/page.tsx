'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CreationWizard } from '@/components/wizard/CreationWizard';
import type { NarrativeEntry } from '@/types/narrative';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SeriesCard({ entry }: { entry: NarrativeEntry }) {
  const router = useRouter();
  const { dispatch } = useStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div
      onClick={() => router.push(`/series/${entry.id}`)}
      className="bg-bg-panel rounded-xl p-5 border border-border hover:border-white/[0.16] cursor-pointer transition group relative"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: 'DELETE_NARRATIVE', id: entry.id });
        }}
        className="absolute top-3 right-3 text-text-dim hover:text-text-primary text-sm leading-none opacity-0 group-hover:opacity-100 transition"
      >
        &times;
      </button>

      <h3 className="text-sm font-semibold text-text-primary">{entry.title}</h3>
      <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{entry.description}</p>

      <div className="flex items-center gap-3 text-[10px] text-text-dim mt-3">
        <span>{entry.sceneCount} scenes</span>
        <span>{mounted ? timeAgo(entry.updatedAt) : ''}</span>
      </div>
    </div>
  );
}

const PLACEHOLDERS = [
  'A detective who can taste lies...',
  'Two rival space stations competing for first contact...',
  'A world where dreams are currency...',
  'An AI that writes obituaries for the living...',
  'The last library on a dying planet...',
];

function AnimatedPlaceholder() {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing');
  const charIndex = useRef(0);

  useEffect(() => {
    const text = PLACEHOLDERS[index];

    if (phase === 'typing') {
      if (charIndex.current <= text.length) {
        const timeout = setTimeout(() => {
          setDisplayed(text.slice(0, charIndex.current));
          charIndex.current++;
        }, 40);
        return () => clearTimeout(timeout);
      } else {
        setPhase('pause');
      }
    }

    if (phase === 'pause') {
      const timeout = setTimeout(() => setPhase('erasing'), 2000);
      return () => clearTimeout(timeout);
    }

    if (phase === 'erasing') {
      if (charIndex.current > 0) {
        const timeout = setTimeout(() => {
          charIndex.current--;
          setDisplayed(PLACEHOLDERS[index].slice(0, charIndex.current));
        }, 20);
        return () => clearTimeout(timeout);
      } else {
        setIndex((i) => (i + 1) % PLACEHOLDERS.length);
        setPhase('typing');
      }
    }
  }, [phase, displayed, index]);

  return (
    <span className="text-text-dim pointer-events-none select-none">
      {displayed}
      <span className="animate-pulse">|</span>
    </span>
  );
}

export default function HomePage() {
  const { state, dispatch } = useStore();
  const [prompt, setPrompt] = useState('');
  const [rolling, setRolling] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    dispatch({ type: 'OPEN_WIZARD', prefill: prompt.trim() });
    setPrompt('');
  };

  const handleRandomIdea = async () => {
    if (rolling) return;
    setRolling(true);
    try {
      const res = await fetch('/api/random-idea', { method: 'POST' });
      const data = await res.json();
      if (data.idea) {
        setPrompt(data.idea);
        inputRef.current?.focus();
      }
    } catch {
      // silently fail
    } finally {
      setRolling(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-bg-base flex flex-col">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-gradient-to-b from-white/[0.03] to-transparent blur-3xl" />
          <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-shape/[0.04] blur-3xl" />
          <div className="absolute top-[15%] right-[15%] w-[300px] h-[300px] rounded-full bg-flux/[0.03] blur-3xl" />
        </div>

        {/* Hero */}
        <div className="relative flex flex-col items-center pt-32 sm:pt-40 pb-16 px-4">
          <p className="text-[11px] uppercase tracking-[0.25em] text-text-dim mb-6 font-mono">
            Thread-first storytelling engine
          </p>

          <h1 className="text-4xl sm:text-6xl font-bold text-text-primary tracking-tight text-center leading-[1.1] max-w-2xl">
            Every great story starts with{' '}
            <span className="bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
              a single thread
            </span>
          </h1>

          <p className="text-base sm:text-lg text-text-secondary mt-5 max-w-lg text-center leading-relaxed">
            Build branching narratives with AI-generated arcs, force dynamics,
            and world expansion.
          </p>

          {/* Prompt input */}
          <div className="mt-10 w-full max-w-xl">
            <div className="relative group">
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-white/[0.08] via-white/[0.12] to-white/[0.08] opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-bg-panel rounded-2xl border border-border group-focus-within:border-transparent transition-colors">
                <div className="relative">
                  <textarea
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    rows={2}
                    className="w-full bg-transparent text-text-primary text-sm px-5 pt-4 pb-3 resize-none focus:outline-none placeholder:text-transparent"
                    placeholder="Describe your series idea..."
                  />
                  {!prompt && (
                    <div className="absolute top-4 left-5 text-sm">
                      <AnimatedPlaceholder />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRandomIdea}
                      disabled={rolling}
                      title="Generate a random idea"
                      className="text-text-dim hover:text-text-primary transition disabled:opacity-50 flex items-center gap-1 text-[11px]"
                    >
                      <span className={rolling ? 'animate-spin inline-block' : ''}>&#127922;</span>
                      <span className="font-mono">{rolling ? 'thinking...' : 'surprise me'}</span>
                    </button>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!prompt.trim()}
                    className="bg-white/10 hover:bg-white/16 disabled:opacity-30 disabled:hover:bg-white/10 text-text-primary text-xs font-semibold px-4 py-1.5 rounded-lg transition"
                  >
                    Create Series
                  </button>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-text-dim mt-3">
              or{' '}
              <button
                onClick={() => dispatch({ type: 'OPEN_WIZARD' })}
                className="text-text-secondary hover:text-text-primary underline underline-offset-2 transition"
              >
                use the full wizard
              </button>{' '}
              for more control
            </p>
          </div>
        </div>

        {/* Series grid */}
        {state.narratives.length > 0 && (
          <div className="relative flex-1 px-4 pb-16">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-mono">
                  Your Series
                </h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.narratives.map((entry) => (
                  <SeriesCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          </div>
        )}

        {state.narratives.length === 0 && (
          <div className="relative flex-1 flex flex-col items-center pt-4 pb-16">
            <div className="flex items-center gap-4 text-text-dim text-xs">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-pressure/50" />
                <span>Pressure</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-momentum/50" />
                <span>Momentum</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-flux/50" />
                <span>Flux</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-shape/50" />
                <span>Shape</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {state.wizardOpen && <CreationWizard />}
    </>
  );
}
