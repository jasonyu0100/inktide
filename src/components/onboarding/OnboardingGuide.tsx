'use client';

import { useState, useEffect, useCallback } from 'react';

const DISMISSED_KEY = 'narrative-engine:onboarding-dismissed';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Explore the World Graph',
    description:
      'Click characters and locations on the graph to inspect their details, relationships, and knowledge. Drag nodes to rearrange. Scroll to zoom.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
        <circle cx="18" cy="6" r="3" />
        <path d="M8.5 7.5L15.5 16.5" />
        <path d="M8.5 6L15.5 6" />
      </svg>
    ),
  },
  {
    title: 'Navigate Scenes',
    description:
      'Use the controls at the bottom to step through scenes. The timeline strip below shows the full arc structure — click any scene to jump to it.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    title: 'Read the Narrative',
    description:
      'The panel above the timeline displays the current scene\'s prose, participants, and thread mutations. Watch how forces shift as you advance.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    title: 'Generate New Scenes',
    description:
      'Click Generate in the bottom bar to have AI write the next scene, advancing threads and evolving character relationships.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    title: 'Track Threads & Forces',
    description:
      'The sidebar shows active narrative threads. The force charts track pressure, momentum, and flux — the invisible currents shaping the story.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

export function OnboardingGuide({ narrativeId }: { narrativeId: string }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = getDismissed();
    if (!dismissed.has(narrativeId)) {
      // Small delay so the UI renders first
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [narrativeId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    const dismissed = getDismissed();
    dismissed.add(narrativeId);
    setDismissed(dismissed);
  }, [narrativeId]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={dismiss}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card */}
      <div
        className="relative w-[400px] max-w-[90vw] rounded-2xl border border-white/10 overflow-hidden"
        style={{
          background: '#1a1a1a',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'fade-up 0.4s ease-out both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-white/40' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center text-text-secondary shrink-0">
              {current.icon}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-dim mb-0.5">
                Step {step + 1} of {STEPS.length}
              </p>
              <h3 className="text-[15px] font-medium text-text-primary leading-snug">
                {current.title}
              </h3>
            </div>
          </div>
          <p className="text-[13px] text-text-secondary leading-relaxed ml-12">
            {current.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 pb-5 pt-4">
          <button
            onClick={dismiss}
            className="text-[12px] text-text-dim hover:text-text-secondary transition-colors"
          >
            Skip intro
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-3 py-1.5 rounded-lg text-[12px] text-text-secondary hover:text-text-primary bg-white/5 hover:bg-white/8 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) {
                  dismiss();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-text-primary bg-white/12 hover:bg-white/18 transition-colors"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
