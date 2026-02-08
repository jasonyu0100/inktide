'use client';

import { useState } from 'react';
import type { FeatureAccess } from '@/hooks/useFeatureAccess';

type Props = {
  access: FeatureAccess;
  onClose: () => void;
};

export default function ApiKeyModal({ access, onClose }: Props) {
  const [orKey, setOrKey] = useState(access.openRouterKey);
  const [repKey, setRepKey] = useState(access.replicateKey);

  function handleSave() {
    access.setOpenRouterKey(orKey.trim());
    access.setReplicateKey(repKey.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel border border-border rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-sm font-semibold text-text-primary mb-1">API Keys</h2>
        <p className="text-[11px] text-text-dim mb-4">
          Enter your API keys to enable features. OpenRouter is required for generation and chat. Replicate is optional and enables image generation in Drive.
        </p>

        <div className="space-y-3">
          {/* OpenRouter key */}
          <div>
            <label className="block text-[10px] font-medium text-text-secondary mb-1">
              OpenRouter API Key <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={orKey}
              onChange={(e) => setOrKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full bg-white/5 border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-white/20 transition-colors"
            />
            <p className="text-[9px] text-text-dim mt-0.5">Required for Generate, Auto mode, and Chat.</p>
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-accent bg-accent/10 hover:bg-accent/20 px-2 py-1 rounded transition-colors">
              Get an OpenRouter key &rarr;
            </a>
          </div>

          {/* Replicate key */}
          <div>
            <label className="block text-[10px] font-medium text-text-secondary mb-1">
              Replicate API Token <span className="text-text-dim">(optional)</span>
            </label>
            <input
              type="password"
              value={repKey}
              onChange={(e) => setRepKey(e.target.value)}
              placeholder="r8_..."
              className="w-full bg-white/5 border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-white/20 transition-colors"
            />
            <p className="text-[9px] text-text-dim mt-0.5">Required for Drive image generation and cover art.</p>
            <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-accent bg-accent/10 hover:bg-accent/20 px-2 py-1 rounded transition-colors">
              Get a Replicate token &rarr;
            </a>
          </div>
        </div>

        <p className="text-[9px] text-text-dim mt-3">Keys are stored locally in your browser and never sent to our servers.</p>

        <div className="flex items-center justify-between mt-3">
          {(access.hasOpenRouterKey || access.hasReplicateKey) && (
            <button
              onClick={() => {
                access.clearKeys();
                setOrKey('');
                setRepKey('');
              }}
              className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
            >
              Clear all keys
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="text-[11px] px-3 py-1.5 rounded text-text-dim hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!orKey.trim()}
              className="text-[11px] px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
