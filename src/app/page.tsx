'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, PLAYGROUND_NARRATIVE_IDS, ANALYSIS_NARRATIVE_IDS } from '@/lib/store';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { CreationWizard } from '@/components/wizard/CreationWizard';
import ApiKeyModal from '@/components/layout/ApiKeyModal';
import type { NarrativeEntry } from '@/types/narrative';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

/* ── Morph text — letters shift through similar glyphs ────────────────────── */
const MORPH_GLYPHS: Record<string, string[]> = {
  e: ['ë', 'ē', 'ę', 'ė', 'ě', 'è', 'é'],
  v: ['ν', 'ʋ', 'ᵥ', 'ṽ'],
  o: ['ö', 'ø', 'ō', 'ő', 'ȯ', 'ò', 'ó'],
  l: ['ł', 'ĺ', 'ḷ', 'ℓ', 'ḻ'],
};

function MorphText({ text }: { text: string }) {
  const [chars, setChars] = useState(() => text.split(''));

  useEffect(() => {
    const original = text.split('');
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Each morphable letter runs its own independent loop
    original.forEach((ch, i) => {
      const glyphs = MORPH_GLYPHS[ch.toLowerCase()];
      if (!glyphs) return;

      function loop() {
        // Rapid burst: cycle through 2-4 glyphs before settling
        const burstLen = 2 + Math.floor(Math.random() * 3);
        let step = 0;

        function tick() {
          if (step < burstLen) {
            const g = glyphs[Math.floor(Math.random() * glyphs.length)];
            setChars((prev) => { const next = [...prev]; next[i] = g; return next; });
            step++;
            timeouts.push(setTimeout(tick, 60 + Math.random() * 40));
          } else {
            // Settle back to original
            setChars((prev) => { const next = [...prev]; next[i] = original[i]; return next; });
            // Wait before next burst — staggered per letter
            timeouts.push(setTimeout(loop, 1200 + Math.random() * 3000));
          }
        }

        // Staggered start per letter
        timeouts.push(setTimeout(tick, 1500 + i * 400 + Math.random() * 1000));
      }

      loop();
    });

    return () => timeouts.forEach(clearTimeout);
  }, [text]);

  return (
    <span className="relative inline-block">
      {/* Invisible original text holds the width */}
      <span className="invisible">{text}</span>
      {/* Morphing overlay */}
      <span className="absolute inset-0">
        {chars.map((ch, i) => {
          const isOriginal = ch === text[i];
          return (
            <span
              key={i}
              style={{
                transition: 'opacity 80ms, filter 80ms',
                opacity: isOriginal ? 1 : 0.6,
                filter: isOriginal ? 'none' : 'blur(0.6px)',
              }}
            >
              {ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/* ── Animated thread SVG that draws on mount ─────────────────────────────── */
function ThreadLine() {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      path.style.transition = 'stroke-dashoffset 2s ease-out';
      path.style.strokeDashoffset = '0';
    });
  }, []);

  return (
    <svg
      className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-[2px] pointer-events-none"
      viewBox="0 0 2 600"
      preserveAspectRatio="none"
    >
      <path
        ref={pathRef}
        d="M1 0 L1 600"
        stroke="url(#thread-grad)"
        strokeWidth="1"
        fill="none"
      />
      <defs>
        <linearGradient id="thread-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="70%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Card color helpers ─────────────────────────────────────────────────── */
function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#facc15';
  if (score >= 40) return '#fb923c';
  return '#f87171';
}

const ARCHETYPE_COLORS: Record<string, string> = {
  masterwork: '#f59e0b', epic: '#ef4444', chronicle: '#3b82f6',
  saga: '#8b5cf6', classic: '#10b981', anthology: '#ec4899',
  atlas: '#06b6d4', emerging: '#6b7280',
};

/* ── Seed vertical cards ─────────────────────────────────────────────────── */

function SeedCard({ entry, index, openSlides }: { entry: NarrativeEntry; index: number; openSlides?: boolean }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/series/${entry.id}${openSlides ? '?slides=1' : ''}`)}
      className="group relative shrink-0 w-52 cursor-pointer animate-fade-up"
      style={{ animationDelay: `${0.5 + index * 0.1}s` }}
    >
      <div className="relative h-80 rounded-lg overflow-hidden border border-white/6 bg-transparent transition-all duration-300 group-hover:border-white/15 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_-10px_rgba(80,200,160,0.15)]">
        {/* Cover image background */}
        {entry.coverImageUrl && (
          <div className="absolute inset-0">
            <img src={entry.coverImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
          </div>
        )}
        {/* Content */}
        <div className="relative h-full flex flex-col p-4 pt-5">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-white/30">
            {entry.sceneCount} scenes
          </p>

          <div className="mt-auto">
            <h3 className="text-[15px] font-semibold leading-snug mb-2 text-white/90 group-hover:text-white transition-colors">
              {entry.title}
            </h3>
            <p className="text-[11px] text-white/40 leading-relaxed line-clamp-4">
              {entry.coverThread || entry.description}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {entry.shapeCurve && (
                <div className="flex items-center gap-1" title={entry.shapeName ?? 'Shape'}>
                  <svg width="20" height="10" viewBox="0 0 20 10" className="opacity-70">
                    <polyline
                      points={entry.shapeCurve.map(([x, y]) => `${x * 20},${10 - y * 10}`).join(' ')}
                      fill="none" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              {entry.archetypeKey && (
                <ArchetypeIcon archetypeKey={entry.archetypeKey} size={11} color={ARCHETYPE_COLORS[entry.archetypeKey] ?? '#6b7280'} />
              )}
              {entry.overallScore !== undefined && (
                <span className="text-[10px] font-mono font-semibold" style={{ color: scoreColor(entry.overallScore) }}>{entry.overallScore}</span>
              )}
            </div>
            <span className="flex items-center gap-1 text-[10px] text-white/30 group-hover:text-white/70 transition-colors font-medium">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Play
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeedCarousel({ seeds, openSlides }: { seeds: NarrativeEntry[]; openSlides?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  return (
    <div className="relative group/carousel">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full border border-white/10 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/20 transition opacity-0 group-hover/carousel:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full border border-white/10 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/20 transition opacity-0 group-hover/carousel:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {seeds.map((entry, i) => (
          <SeedCard key={entry.id} entry={entry} index={i} openSlides={openSlides} />
        ))}
      </div>
    </div>
  );
}

/* ── Home page ───────────────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const access = useFeatureAccess();
  const { userApiKeys, hasOpenRouterKey } = access;
  const isMobile = useIsMobile();
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleOpenApiKeys = () => setApiKeysOpen(true);
    window.addEventListener('open-api-keys', handleOpenApiKeys);
    return () => window.removeEventListener('open-api-keys', handleOpenApiKeys);
  }, []);

  const needsKeys = userApiKeys && !hasOpenRouterKey;

  const openCreate = (prefill?: string) => {
    if (needsKeys) { setApiKeysOpen(true); return; }
    if (isMobile) return;
    dispatch({ type: 'OPEN_WIZARD', prefill });
  };

  const playgrounds = state.narratives.filter((e) => PLAYGROUND_NARRATIVE_IDS.has(e.id));
  const analysisSeeds = state.narratives.filter((e) => ANALYSIS_NARRATIVE_IDS.has(e.id));

  return (
    <>
      <div className="min-h-screen bg-bg-base flex flex-col">
        {/* Cinematic background — aurora effect */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="aurora-container absolute bottom-0 left-0 right-0 h-[75%]">
            <div className="aurora-curtain aurora-curtain-1" />
            <div className="aurora-curtain aurora-curtain-2" />
            <div className="aurora-curtain aurora-curtain-3" />
            <div className="aurora-curtain aurora-curtain-4" />
            <div className="aurora-curtain aurora-curtain-5" />
            <div className="aurora-wisp aurora-wisp-1" />
            <div className="aurora-wisp aurora-wisp-2" />
            <div className="aurora-wisp aurora-wisp-3" />
            <div className="aurora-wisp aurora-wisp-4" />
            <div className="aurora-glow" />
          </div>
        </div>

        {/* Thread line */}
        <ThreadLine />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative flex flex-col items-center pt-24 sm:pt-32 pb-10 px-4">
          <p className="animate-fade-up text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono mb-8">
            Narrative Engine
          </p>

          <h1 className="animate-fade-up-delay-1 text-5xl sm:text-7xl font-bold tracking-[-0.03em] text-center leading-[1.05] max-w-160">
            <span className="text-white">Stories that </span>
            <span className="glitch-wrapper text-white italic whitespace-nowrap" data-text="evolve."><MorphText text="evolve" />.</span>
          </h1>

          <p className="animate-fade-up-delay-2 text-[15px] text-white/40 mt-6 max-w-md text-center leading-relaxed">
            Drop in a premise. Watch characters collide, alliances shift, and worlds
            reshape themselves — one scene at a time.
          </p>

          <div className="animate-fade-up-delay-3 flex items-center gap-2 mt-5">
            {['Branching plots', 'Living characters', 'Knowledge graphs'].map((label) => (
              <span
                key={label}
                className="text-[10px] font-mono text-white/30 border border-white/8 rounded-full px-2.5 py-1 tracking-wide"
              >
                {label}
              </span>
            ))}
          </div>

          {/* ── Analyze Corpus ─────────────────────────────────────────── */}
          <div className="animate-fade-up-delay-3 mt-10 w-full max-w-xl">
            {isMobile ? (
              <div className="text-center py-8 border border-dashed border-white/8 rounded-xl">
                <p className="text-white/30 text-sm">Series creation is available on desktop</p>
              </div>
            ) : (
              <>
                <div className="prompt-glow relative rounded-xl border border-white/8 focus-within:border-white/15 transition-colors duration-200">
                  <textarea
                    ref={inputRef}
                    value={analysisText}
                    onChange={(e) => setAnalysisText(e.target.value)}
                    rows={5}
                    className="w-full bg-transparent text-white text-sm px-4 pt-4 pb-2 resize-none focus:outline-none placeholder:text-white/25"
                    placeholder="Paste a book, screenplay, or any long-form text to analyze into a narrative..."
                  />
                  <div className="flex items-center justify-between px-3 pb-3">
                    <span className="text-[10px] text-white/20 font-mono">
                      {analysisText.trim() ? `${analysisText.trim().split(/\s+/).length.toLocaleString()} words` : 'text analysis'}
                    </span>
                    <button
                      onClick={() => {
                        if (!analysisText.trim()) return;
                        if (needsKeys) { setApiKeysOpen(true); return; }
                        import('@/lib/analysis-transfer').then(({ setAnalysisSource }) =>
                          setAnalysisSource(analysisText).then(() => router.push('/analysis?new=1'))
                        );
                      }}
                      disabled={!analysisText.trim()}
                      className="text-white/70 hover:text-white border border-white/10 hover:border-white/20 disabled:opacity-20 text-xs font-medium px-4 py-1.5 rounded-md transition"
                    >
                      Analyze
                    </button>
                  </div>
                </div>

                <p className="text-center text-[11px] text-white/25 mt-3">
                  or{' '}
                  <button
                    onClick={() => openCreate()}
                    className="text-white/40 hover:text-white/70 underline underline-offset-2 transition"
                  >
                    create a new world
                  </button>
                  {' '}from a premise
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Open source book analysis ─────────────────────────────── */}
        {analysisSeeds.length > 0 && (
          <div className="relative px-4 sm:px-8 pb-10 mt-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-mono whitespace-nowrap">
                  Analyzed Works
                </h2>
                <div className="flex-1 h-px bg-white/6" />
              </div>
              <p className="text-[11px] text-white/25 leading-relaxed mb-4 max-w-lg">
                Published works analyzed with our formulas. Do the force peaks match the moments you remember? This is how we verify the system captures what readers actually feel.
              </p>
              <SeedCarousel seeds={analysisSeeds} openSlides />
            </div>
          </div>
        )}

        {/* ── Playground seeds ────────────────────────────────────────── */}
        {playgrounds.length > 0 && (
          <div className="relative px-4 sm:px-8 pb-14">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-mono whitespace-nowrap">
                  AI Playgrounds
                </h2>
                <div className="flex-1 h-px bg-white/6" />
              </div>
              <p className="text-[11px] text-white/25 leading-relaxed mb-4 max-w-lg">
                AI-generated alternate realities of real series&mdash;not the original texts. Experiment with generation, branching, and force analysis.
              </p>
              <SeedCarousel seeds={playgrounds} />
            </div>
          </div>
        )}

        {/* ── Q&A ───────────────────────────────────────────────────── */}
        <div className="relative px-4 sm:px-8 pb-20 mt-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-mono whitespace-nowrap">
                Questions
              </h2>
              <div className="flex-1 h-px bg-white/6" />
            </div>
            <div className="space-y-6">
              {[
                {
                  q: 'What is the Knowledge Graph?',
                  a: 'Every narrative is a knowledge graph that mutates scene by scene. Characters have continuity nodes (what they know, believe, possess). Locations have lore. Threads track plot lines with lifecycle statuses. Relationships carry typed valence between characters. World knowledge captures laws, systems, and tensions. Each scene records structural mutations — who learned what, which threads shifted, how relationships changed — and the engine computes narrative forces from those deltas.',
                },
                {
                  q: 'How do the formulas work?',
                  a: 'Three force dimensions are derived from knowledge graph mutations, all z-score normalised. Payoff measures thread phase transitions weighted by jump magnitude plus relationship valence deltas. Change measures mutation reach per character with logarithmic scaling. Knowledge measures world knowledge graph complexity delta per scene. From these: Tension = C + K - P (buildup without release), Delivery = 0.5P + 0.25C + 0.25K + contrast bonus (payoff-weighted with tension-release reward), and Swing = Euclidean distance between consecutive force snapshots.',
                },
                {
                  q: 'What is the commit tree?',
                  a: 'Narratives use a git-like branching model. Each branch is a sequence of scene commits and world-build commits. You can fork at any scene to explore alternative story paths — different character decisions, different thread resolutions, different world directions. Branches share history up to the fork point, then diverge. This lets you compare parallel narrative trajectories, backtrack from dead ends, and maintain multiple versions of the same story without losing work.',
                },
                {
                  q: 'How does MCTS search work?',
                  a: 'Monte Carlo Tree Search explores the narrative state space to find optimal story paths. Each node in the tree is a possible scene. The engine generates multiple candidate scenes at each step, evaluates them using the force formulas (payoff, change, knowledge, delivery), and expands the most promising branches. Over many iterations, MCTS converges on story trajectories that maximise narrative force — scenes that pay off threads, transform characters, and deepen the world in concert.',
                },
                {
                  q: 'How does prose generation work?',
                  a: 'Three-phase pipeline: structure, then plan, then prose. First, the engine generates scene structures — participants, location, thread mutations, knowledge changes, relationship shifts. Second, a delivery-by-delivery staging plan blueprints HOW each mutation unfolds through concrete mechanisms. Third, prose is written from the plan with full branch context (up to 50 prior scenes), recent prose lookback for continuity, and voice/style settings. The alignment system then audits consecutive chapters in sliding windows to fix continuity gaps from parallel generation.',
                },
                {
                  q: 'How does AI-generated text compare to human writing?',
                  a: 'There is a measurable quality gap. Human-written works from published literature consistently score 90+ on the grading curve — dense thread lifecycles, earned payoffs, and layered world-building compound over hundreds of pages. AI-generated texts typically land in the 70–80 range. The mutations are structurally valid but thinner: threads resolve too neatly, character change lacks accumulation, and knowledge graphs expand without the connective depth that human authors build instinctively. The AI playgrounds on this site are alternate realities of real series — useful for experimenting with the engine, but not representative of the source material\'s quality.',
                },
                {
                  q: 'What does it cost?',
                  a: 'Narrative Engine is free and open source. You bring your own API key (OpenRouter) which gives you access to any LLM — Gemini, GPT, Claude, Llama, and others. You pay only for the tokens you use at the model provider\'s rates. There is no subscription, no platform fee, and no usage limits beyond what your API key supports.',
                },
              ].map(({ q, a }, i) => (
                <details key={i} className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                    <span className="text-[13px] text-white/70 group-hover:text-white/90 transition font-medium">{q}</span>
                    <svg className="w-3.5 h-3.5 text-white/20 group-open:rotate-90 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </summary>
                  <p className="text-[12px] text-white/35 leading-relaxed pb-2 pl-0">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      {state.wizardOpen && <CreationWizard />}
      {apiKeysOpen && <ApiKeyModal access={access} onClose={() => setApiKeysOpen(false)} />}
    </>
  );
}
