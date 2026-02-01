'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

export function PremiseStep() {
  const { dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-text-primary">
        Create a New Narrative
      </h2>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Narrative title..."
        className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-full outline-none placeholder:text-text-dim"
      />

      <textarea
        value={premise}
        onChange={(e) => setPremise(e.target.value)}
        placeholder="Describe your world in a few sentences..."
        className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-full h-32 resize-none outline-none placeholder:text-text-dim"
      />

      <button
        onClick={() => dispatch({ type: 'SET_WIZARD_STEP', step: 'world-gen' })}
        className="mt-4 self-start bg-white/[0.08] hover:bg-white/[0.12] text-text-primary text-xs font-semibold px-4 py-2 rounded-lg transition"
      >
        Generate World &rarr;
      </button>
    </div>
  );
}
