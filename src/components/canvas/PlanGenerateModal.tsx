'use client';

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '@/components/Modal';

export type PlanGenerateConfig = {
  guidance: string;
};

export function PlanGenerateModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (config: PlanGenerateConfig) => void;
}) {
  const [guidance, setGuidance] = useState('');

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>
        <h2 className="text-sm font-semibold text-text-primary">Generate Plan</h2>
      </ModalHeader>

      <ModalBody className="p-6">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-1">Direction</label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="How should this scene be structured..."
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
