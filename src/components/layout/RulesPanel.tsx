'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

type Props = {
  onClose: () => void;
};

export default function RulesPanel({ onClose }: Props) {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;
  const [rules, setRules] = useState<string[]>(narrative?.rules ?? []);
  const [draft, setDraft] = useState('');

  function addRule() {
    const text = draft.trim();
    if (!text) return;
    setRules((prev) => [...prev, text]);
    setDraft('');
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    dispatch({ type: 'SET_RULES', rules });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl">
        <h2 className="text-sm font-semibold text-text-primary mb-1">World Rules</h2>
        <p className="text-[11px] text-text-dim mb-4">
          Commandments that every scene must obey. These are injected into all AI generation prompts.
        </p>

        {/* Rule list */}
        <div className="flex flex-col gap-1.5 mb-4 max-h-60 overflow-y-auto">
          {rules.length === 0 && (
            <p className="text-[11px] text-text-dim italic py-3 text-center">No rules yet</p>
          )}
          {rules.map((rule, i) => (
            <div key={i} className="flex items-start gap-2 group">
              <span className="text-[10px] font-mono text-text-dim mt-0.5 shrink-0 w-4 text-right">{i + 1}.</span>
              <p className="text-xs text-text-secondary leading-relaxed flex-1">{rule}</p>
              <button
                onClick={() => removeRule(i)}
                className="text-[10px] text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Add rule */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule(); } }}
            placeholder="Add a world rule..."
            className="flex-1 bg-white/5 border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-white/20 transition-colors"
          />
          <button
            onClick={addRule}
            disabled={!draft.trim()}
            className="text-[11px] px-3 py-2 rounded bg-white/5 border border-border text-text-secondary hover:text-text-primary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded text-text-dim hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-[11px] px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
