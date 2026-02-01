'use client';

import { useStore } from '@/lib/store';

export function ConfirmStep() {
  const { dispatch } = useStore();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-text-primary">
        Your narrative is ready
      </h2>

      <p className="text-sm text-text-secondary">
        6 characters, 4 locations, 5 threads initialized
      </p>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => dispatch({ type: 'SET_WIZARD_STEP', step: 'thread-selection' })}
          className="text-text-dim text-xs hover:text-text-secondary transition"
        >
          &larr; Back
        </button>
        <button
          onClick={() => dispatch({ type: 'CLOSE_WIZARD' })}
          className="bg-white/[0.10] hover:bg-white/[0.16] text-text-primary font-semibold px-6 py-2.5 rounded-lg transition"
        >
          Enter Narrative
        </button>
      </div>
    </div>
  );
}
