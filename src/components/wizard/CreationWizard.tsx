'use client';

import { useStore } from '@/lib/store';
import type { WizardStep } from '@/types/narrative';
import { PremiseStep } from './PremiseStep';
import { WorldGenStep } from './WorldGenStep';
import { ThreadSelectionStep } from './ThreadSelectionStep';
import { ConfirmStep } from './ConfirmStep';

const STEPS: WizardStep[] = ['premise', 'world-gen', 'thread-selection', 'confirm'];

function StepDots({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, i) => (
        <div
          key={step}
          className={`w-2 h-2 rounded-full ${
            i <= currentIndex ? 'bg-white' : 'bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

function StepContent({ step }: { step: WizardStep }) {
  switch (step) {
    case 'premise':
      return <PremiseStep />;
    case 'world-gen':
      return <WorldGenStep />;
    case 'thread-selection':
      return <ThreadSelectionStep />;
    case 'confirm':
      return <ConfirmStep />;
  }
}

export function CreationWizard() {
  const { state, dispatch } = useStore();

  if (!state.wizardOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="glass max-w-lg w-full rounded-2xl p-6 relative">
        <button
          onClick={() => dispatch({ type: 'CLOSE_WIZARD' })}
          className="absolute top-4 right-4 text-text-dim hover:text-text-primary text-lg leading-none"
        >
          &times;
        </button>
        <StepDots current={state.wizardStep} />
        <StepContent step={state.wizardStep} />
      </div>
    </div>
  );
}
