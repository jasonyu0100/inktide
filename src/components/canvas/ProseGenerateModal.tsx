'use client';

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';

export type ProseGenerateConfig = {
  guidance: string;
};

export function ProseGenerateModal({
  onClose,
  onGenerate,
  hasPlan,
}: {
  onClose: () => void;
  onGenerate: (config: ProseGenerateConfig) => void;
  hasPlan: boolean;
}) {
  const [guidance, setGuidance] = useState('');

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>
        <h2 className="text-sm font-semibold text-text-primary">Generate Prose</h2>
      </ModalHeader>

      <ModalBody className="p-6">
        <div className="flex flex-col gap-4">
          {!hasPlan && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <p className="text-[11px] text-amber-400/80">No beat plan for this scene. Prose will be generated from summary and mutations. For best results, generate a plan first.</p>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-1">Direction</label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="How should this scene read..."
              className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-full outline-none placeholder:text-text-dim resize-none h-24"
              autoFocus
            />
          </div>

          <button
            onClick={() => { onGenerate({ guidance: guidance.trim() }); onClose(); }}
            className="h-9 rounded-lg bg-white/10 hover:bg-white/16 text-text-primary font-semibold transition text-[12px] mt-2">
            Generate
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
