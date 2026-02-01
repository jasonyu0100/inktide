'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { AutoConfig, AutoEndCondition, PacingProfile } from '@/types/narrative';

type Tab = 'end' | 'pacing' | 'world' | 'tone';

const TABS: { label: string; value: Tab }[] = [
  { label: 'End', value: 'end' },
  { label: 'Pacing', value: 'pacing' },
  { label: 'World', value: 'world' },
  { label: 'Tone', value: 'tone' },
];

const PACING_PROFILES: { value: PacingProfile; label: string; desc: string }[] = [
  { value: 'deliberate', label: 'Deliberate', desc: 'Slow burn, deep world-building, measured escalation' },
  { value: 'balanced', label: 'Balanced', desc: 'Even mix of action, development, and world-building' },
  { value: 'urgent', label: 'Urgent', desc: 'Fast pace, rapid escalation, minimal downtime' },
  { value: 'chaotic', label: 'Chaotic', desc: 'Unpredictable twists, high flux, constant disruption' },
];


export function AutoSettingsPanel({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>('end');
  const [config, setConfig] = useState<AutoConfig>({ ...state.autoConfig });

  function update(partial: Partial<AutoConfig>) {
    setConfig((c) => ({ ...c, ...partial }));
  }

  function handleSave() {
    dispatch({ type: 'SET_AUTO_CONFIG', config });
  }

  function handleStart() {
    // Enforce at least one end condition
    if (config.endConditions.length === 0) return;
    dispatch({ type: 'SET_AUTO_CONFIG', config });
    onStart();
    onClose();
  }

  // End condition helpers
  const hasEndCondition = (type: string) => config.endConditions.some((c) => c.type === type);
  const getEndCondition = (type: string) => config.endConditions.find((c) => c.type === type);

  function toggleEndCondition(type: string, defaultCond: AutoEndCondition) {
    if (hasEndCondition(type)) {
      // Don't allow removing if it's the last one
      if (config.endConditions.length <= 1) return;
      update({ endConditions: config.endConditions.filter((c) => c.type !== type) });
    } else {
      update({ endConditions: [...config.endConditions, defaultCond] });
    }
  }

  function updateEndCondition(type: string, updater: (c: AutoEndCondition) => AutoEndCondition) {
    update({
      endConditions: config.endConditions.map((c) => (c.type === type ? updater(c) : c)),
    });
  }

  const noEndConditions = config.endConditions.length === 0;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="glass max-w-lg w-full rounded-2xl p-6 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-dim hover:text-text-primary text-lg leading-none"
        >
          &times;
        </button>

        <h2 className="text-sm font-semibold text-text-primary mb-1">Auto Mode Settings</h2>
        <p className="text-[10px] text-text-dim uppercase tracking-wider mb-3">
          Configure autonomous narrative generation
        </p>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-elevated rounded-lg p-0.5 mb-4 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors rounded-md uppercase tracking-wider ${
                tab === t.value
                  ? 'bg-bg-overlay text-text-primary'
                  : 'text-text-dim hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 min-h-0">
          {tab === 'end' && (
            <>
              <p className="text-[10px] text-text-dim leading-relaxed">
                At least one end condition is required. You can always stop manually.
              </p>

              {/* Scene count */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasEndCondition('scene_count')}
                  onChange={() => toggleEndCondition('scene_count', { type: 'scene_count', target: 50 })}
                  className="accent-text-primary"
                />
                <span className="text-xs text-text-secondary">Stop at scene count</span>
              </label>
              {hasEndCondition('scene_count') && (
                <div className="ml-6">
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={(getEndCondition('scene_count') as { type: 'scene_count'; target: number })?.target ?? 50}
                    onChange={(e) =>
                      updateEndCondition('scene_count', () => ({ type: 'scene_count', target: Number(e.target.value) }))
                    }
                    className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary w-20 outline-none"
                  />
                  <span className="text-[10px] text-text-dim ml-2">scenes</span>
                </div>
              )}

              {/* Arc count */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasEndCondition('arc_count')}
                  onChange={() => toggleEndCondition('arc_count', { type: 'arc_count', target: 10 })}
                  className="accent-text-primary"
                />
                <span className="text-xs text-text-secondary">Stop at arc count</span>
              </label>
              {hasEndCondition('arc_count') && (
                <div className="ml-6">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={(getEndCondition('arc_count') as { type: 'arc_count'; target: number })?.target ?? 10}
                    onChange={(e) =>
                      updateEndCondition('arc_count', () => ({ type: 'arc_count', target: Number(e.target.value) }))
                    }
                    className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary w-20 outline-none"
                  />
                  <span className="text-[10px] text-text-dim ml-2">arcs</span>
                </div>
              )}

              {/* All threads resolved */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasEndCondition('all_threads_resolved')}
                  onChange={() => toggleEndCondition('all_threads_resolved', { type: 'all_threads_resolved' })}
                  className="accent-text-primary"
                />
                <span className="text-xs text-text-secondary">Stop when all threads resolved</span>
              </label>

              {/* Manual stop (always available) */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasEndCondition('manual_stop')}
                  onChange={() => toggleEndCondition('manual_stop', { type: 'manual_stop' })}
                  className="accent-text-primary"
                />
                <span className="text-xs text-text-secondary">Manual stop only</span>
              </label>
            </>
          )}

          {tab === 'pacing' && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-2">
                  Pacing Profile
                </label>
                <div className="flex flex-col gap-2">
                  {PACING_PROFILES.map((p) => (
                    <label
                      key={p.value}
                      className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        config.pacingProfile === p.value ? 'bg-white/8' : 'hover:bg-white/4'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pacing"
                        checked={config.pacingProfile === p.value}
                        onChange={() => update({ pacingProfile: p.value })}
                        className="accent-text-primary mt-0.5"
                      />
                      <div>
                        <div className="text-xs text-text-primary font-medium">{p.label}</div>
                        <div className="text-[10px] text-text-dim">{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

            </>
          )}

          {tab === 'world' && (
            <>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.worldBuildInterval > 0}
                  onChange={(e) => update({ worldBuildInterval: e.target.checked ? 3 : 0 })}
                  className="accent-text-primary"
                />
                <span className="text-xs text-text-secondary">Enable world building</span>
              </label>

              {config.worldBuildInterval > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-2">
                    Interval
                  </label>
                  <p className="text-[10px] text-text-dim leading-relaxed mb-3">
                    Expand the world with new characters, locations, and threads at a regular interval.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Every</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.worldBuildInterval}
                      onChange={(e) => update({ worldBuildInterval: Math.max(1, Number(e.target.value)) })}
                      className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary w-16 outline-none text-center"
                    />
                    <span className="text-xs text-text-secondary">arcs</span>
                  </div>
                  <div className="text-[10px] text-text-dim mt-2">
                    A world expansion will occur every {config.worldBuildInterval} arc{config.worldBuildInterval !== 1 ? 's' : ''}.
                  </div>
                </div>
              )}

              {config.worldBuildInterval === 0 && (
                <p className="text-[10px] text-text-dim leading-relaxed">
                  World building is disabled — only existing elements will be used.
                </p>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={config.enforceWorldBuildUsage}
                  onChange={(e) => update({ enforceWorldBuildUsage: e.target.checked })}
                  className="accent-text-primary"
                />
                <span className="text-xs text-text-secondary">Enforce usage of world-building elements</span>
              </label>
              <p className="text-[10px] text-text-dim leading-relaxed ml-6">
                {config.enforceWorldBuildUsage
                  ? 'New arcs must incorporate unused world-building characters, locations, or threads.'
                  : 'New arcs will follow the natural flow of the story using existing elements.'}
              </p>
            </>
          )}

          {tab === 'tone' && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-1">
                  Direction Prompt
                </label>
                <textarea
                  value={config.arcDirectionPrompt}
                  onChange={(e) => update({ arcDirectionPrompt: e.target.value })}
                  placeholder="Guide the overall story direction, tone, and constraints..."
                  className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-full h-32 resize-none outline-none placeholder:text-text-dim"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 mt-4 border-t border-border shrink-0">
          <button
            onClick={handleStart}
            disabled={noEndConditions}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
              noEndConditions
                ? 'bg-white/4 text-text-dim cursor-not-allowed'
                : 'bg-white/12 text-text-primary hover:bg-white/16'
            }`}
          >
            Start Auto Mode
          </button>
        </div>
      </div>
    </div>
  );
}
