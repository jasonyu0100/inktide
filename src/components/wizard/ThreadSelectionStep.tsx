'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

type MockThread = {
  id: string;
  description: string;
  suggestedStatus: string;
};

const MOCK_THREADS: MockThread[] = [
  { id: 'mt-1', description: "Kael's hidden lineage threatens to upend the Citadel hierarchy", suggestedStatus: 'dormant' },
  { id: 'mt-2', description: "Iona discovers smuggled cargo at the Ashenmere Docks", suggestedStatus: 'surfacing' },
  { id: 'mt-3', description: "The Gilt Corridor's debts are being called in — and Dren is on the list", suggestedStatus: 'escalating' },
  { id: 'mt-4', description: "Petra's alliance with the outer merchants is fracturing", suggestedStatus: 'dormant' },
  { id: 'mt-5', description: "A forged letter implicates Kael in the assassination plot", suggestedStatus: 'threatened' },
];

export function ThreadSelectionStep() {
  const { dispatch } = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-text-primary">Select Threads</h2>

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
        {MOCK_THREADS.map((thread) => {
          const isSelected = selected.has(thread.id);
          return (
            <button
              key={thread.id}
              onClick={() => toggle(thread.id)}
              className={`bg-bg-elevated rounded-lg p-3 border cursor-pointer text-left transition ${
                isSelected ? 'border-white/20' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-text-primary">{thread.description}</p>
                  <p className="text-[10px] text-text-dim mt-1">{thread.suggestedStatus}</p>
                </div>
                {isSelected && (
                  <span className="text-text-primary text-xs shrink-0 mt-0.5">&#10003;</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={() => dispatch({ type: 'SET_WIZARD_STEP', step: 'world-gen' })}
          className="text-text-dim text-xs hover:text-text-secondary transition"
        >
          &larr; Back
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_WIZARD_STEP', step: 'confirm' })}
          className="bg-white/[0.08] hover:bg-white/[0.12] text-text-primary text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          Create Narrative &rarr;
        </button>
      </div>
    </div>
  );
}
