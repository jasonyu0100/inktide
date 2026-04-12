'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/Modal';

type Props = {
  onClose: () => void;
};

function CommandmentList({
  title,
  description,
  items,
  onAdd,
  onRemove,
  placeholder,
  accentColor,
}: {
  title: string;
  description: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  accentColor: 'emerald' | 'red';
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setNewItem('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const borderColor = accentColor === 'emerald' ? 'border-emerald-500/20' : 'border-red-500/20';
  const bgColor = accentColor === 'emerald' ? 'bg-emerald-500/5' : 'bg-red-500/5';
  const textColor = accentColor === 'emerald' ? 'text-emerald-400' : 'text-red-400';
  const hoverBg = accentColor === 'emerald' ? 'hover:bg-emerald-500/10' : 'hover:bg-red-500/10';

  return (
    <div className="space-y-3">
      <div>
        <h3 className={`text-[12px] font-medium ${textColor}`}>{title}</h3>
        <p className="text-[10px] text-text-dim mt-0.5">{description}</p>
      </div>

      {/* Existing items */}
      <div className={`border ${borderColor} rounded-lg ${bgColor} overflow-hidden`}>
        {items.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-text-dim/50">
            No commandments yet
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2 px-3 py-2 group">
                <span className="text-[11px] text-text-secondary leading-relaxed flex-1">{item}</span>
                <button
                  onClick={() => onRemove(index)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 text-text-dim hover:text-red-400 hover:bg-white/5 transition-all shrink-0"
                  title="Remove"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-[11px] text-text-primary placeholder:text-text-dim/40 outline-none focus:border-white/20 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className={`px-3 py-2 rounded-lg border ${borderColor} ${bgColor} ${textColor} ${hoverBg} text-[11px] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function PatternsModal({ onClose }: Props) {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;

  const [patterns, setPatterns] = useState<string[]>(narrative?.patterns ?? []);
  const [antiPatterns, setAntiPatterns] = useState<string[]>(narrative?.antiPatterns ?? []);

  const handleSave = () => {
    dispatch({ type: 'SET_PATTERNS', patterns });
    dispatch({ type: 'SET_ANTI_PATTERNS', antiPatterns });
    onClose();
  };

  const hasChanges =
    JSON.stringify(patterns) !== JSON.stringify(narrative?.patterns ?? []) ||
    JSON.stringify(antiPatterns) !== JSON.stringify(narrative?.antiPatterns ?? []);

  if (!narrative) return null;

  return (
    <Modal onClose={onClose} size="lg" maxHeight="85vh">
      <ModalHeader onClose={onClose}>
        <h2 className="text-[13px] font-semibold text-text-primary">Patterns & Anti-Patterns</h2>
        <span className="text-[10px] text-text-dim">Global commandments that guide story development</span>
      </ModalHeader>
      <ModalBody className="p-5 space-y-6">
        <CommandmentList
          title="Patterns"
          description="Positive commandments — what makes this series good. Used by the Orchestrator agent to guide decisions."
          items={patterns}
          onAdd={(item) => setPatterns([...patterns, item])}
          onRemove={(index) => setPatterns(patterns.filter((_, i) => i !== index))}
          placeholder="e.g., Every scene must advance at least one thread"
          accentColor="emerald"
        />

        <div className="border-t border-white/5" />

        <CommandmentList
          title="Anti-Patterns"
          description="Negative commandments — what to avoid. Used by the Adversarial agent to detect problems."
          items={antiPatterns}
          onAdd={(item) => setAntiPatterns([...antiPatterns, item])}
          onRemove={(index) => setAntiPatterns(antiPatterns.filter((_, i) => i !== index))}
          placeholder="e.g., Characters should not know information they haven't learned"
          accentColor="red"
        />
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="text-[11px] px-3 py-1.5 rounded-md bg-white/5 text-text-dim hover:text-text-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="text-[11px] px-3 py-1.5 rounded-md bg-white/10 text-text-primary hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Save
        </button>
      </ModalFooter>
    </Modal>
  );
}
