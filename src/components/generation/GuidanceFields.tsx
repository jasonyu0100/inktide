'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { suggestAutoDirection } from '@/lib/ai';

type Props = {
  direction: string;
  constraints: string;
  onDirectionChange: (value: string) => void;
  onConstraintsChange: (value: string) => void;
  /** Hide suggest buttons */
  hideSuggest?: boolean;
};

/**
 * Reusable direction + constraints fields with story-settings sync.
 *
 * - Checkbox checked → shows story settings read-only
 * - Unchecking → clears to editable textarea
 * - Suggest → generates AI suggestion, unchecks, populates
 * - Manual edit → unchecks automatically
 * - Re-checking → restores story settings
 */
export function GuidanceFields({
  direction, constraints, onDirectionChange, onConstraintsChange, hideSuggest,
}: Props) {
  const { state } = useStore();
  const narrative = state.activeNarrative;

  const storyDir = narrative?.storySettings?.storyDirection?.trim() ?? '';
  const storyCon = narrative?.storySettings?.storyConstraints?.trim() ?? '';

  const [useStoryDir, setUseStoryDir] = useState(!!storyDir && (!direction || direction === storyDir));
  const [useStoryCon, setUseStoryCon] = useState(!!storyCon && (!constraints || constraints === storyCon));
  const [suggestingDir, setSuggestingDir] = useState(false);

  const handleSuggestDirection = useCallback(async () => {
    if (!narrative) return;
    setSuggestingDir(true);
    try {
      const result = await suggestAutoDirection(narrative, state.resolvedEntryKeys, state.currentSceneIndex);
      onDirectionChange(result);
      setUseStoryDir(false);
    } catch (err) {
      console.error('[guidance] suggest direction failed:', err);
    } finally {
      setSuggestingDir(false);
    }
  }, [narrative, state.resolvedEntryKeys, state.currentSceneIndex, onDirectionChange]);

  return (
    <div className="flex flex-col gap-3">
      {/* Direction */}
      <Field
        label="Direction"
        storyValue={storyDir}
        useStory={useStoryDir}
        onToggleStory={(checked) => { setUseStoryDir(checked); onDirectionChange(checked ? storyDir : ''); }}
        suggesting={suggestingDir}
        onSuggest={!hideSuggest ? handleSuggestDirection : undefined}
      >
        <textarea
          value={direction}
          onChange={(e) => { onDirectionChange(e.target.value); setUseStoryDir(false); }}
          placeholder="What should the narrative focus on?"
          className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[11px] text-text-primary w-full h-14 resize-none outline-none placeholder:text-text-dim focus:border-white/16 transition"
        />
      </Field>

      {/* Constraints */}
      <Field
        label="Constraints"
        storyValue={storyCon}
        useStory={useStoryCon}
        onToggleStory={(checked) => { setUseStoryCon(checked); onConstraintsChange(checked ? storyCon : ''); }}
      >
        <textarea
          value={constraints}
          onChange={(e) => { onConstraintsChange(e.target.value); setUseStoryCon(false); }}
          placeholder="What should NOT happen..."
          className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[11px] text-text-primary w-full h-12 resize-none outline-none placeholder:text-text-dim focus:border-white/16 transition"
        />
      </Field>
    </div>
  );
}

/** Single field with optional story-settings checkbox and suggest button */
function Field({ label, storyValue, useStory, onToggleStory, suggesting, onSuggest, children }: {
  label: string;
  storyValue: string;
  useStory: boolean;
  onToggleStory: (checked: boolean) => void;
  suggesting?: boolean;
  onSuggest?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-text-dim">{label}</span>
        {onSuggest && !useStory && (
          <button type="button" disabled={suggesting} onClick={onSuggest}
            className="text-[9px] text-text-dim hover:text-text-secondary transition disabled:opacity-30 uppercase tracking-wider">
            {suggesting ? 'Thinking...' : 'Suggest'}
          </button>
        )}
      </div>
      {useStory && storyValue ? (
        <p className="text-[11px] text-text-dim leading-snug whitespace-pre-wrap px-1">{storyValue}</p>
      ) : (
        children
      )}
      {storyValue && (
        <div className="flex justify-end mt-1">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input type="checkbox" checked={useStory} onChange={(e) => onToggleStory(e.target.checked)}
              className="accent-white/50 w-2.5 h-2.5" />
            <span className="text-[9px] text-text-dim">Use story settings</span>
          </label>
        </div>
      )}
    </div>
  );
}
