'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { GuidanceFields } from '@/components/generation/GuidanceFields';
import type { AutoConfig, AutoEndCondition, AutoMode } from '@/types/narrative';
import { AUTO_MODE_PRESETS } from '@/types/narrative';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/Modal';

type Tab = 'end' | 'direction' | 'pipeline';

const TABS: { label: string; value: Tab }[] = [
  { label: 'End', value: 'end' },
  { label: 'Pipeline', value: 'pipeline' },
  { label: 'Direction', value: 'direction' },
];

const MODE_DESC: Record<AutoMode, string> = {
  quick:
    'Skip the reasoning graph. Each cycle goes straight to scene generation — fastest path, useful when iterating on structure or when the CRG is producing diminishing returns.',
  extended:
    'Build a reasoning graph before each arc, then write scenes against it. Slower per cycle but produces structurally tighter arcs (current default).',
};


export function AutoSettingsPanel({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>('end');
  const hasCoordinationPlan = !!(state.activeNarrative?.branches && state.viewState.activeBranchId && state.activeNarrative.branches[state.viewState.activeBranchId]?.coordinationPlan);

  const [config, setConfig] = useState<AutoConfig>(() => {
    const base = { ...state.autoConfig };
    // When coordination plan is active, default to planning_complete instead of scene_count
    if (hasCoordinationPlan && !base.endConditions.some(c => c.type === 'planning_complete')) {
      base.endConditions = [{ type: 'planning_complete' }];
    }
    return base;
  });

  function update(partial: Partial<AutoConfig>) {
    setConfig((c) => ({ ...c, ...partial }));
  }

  function handleStart() {
    if (config.endConditions.length === 0) return;
    dispatch({ type: 'SET_AUTO_CONFIG', config });
    onStart();
    onClose();
  }

  // End condition helpers
  const hasEndCondition = (type: string) => config.endConditions.some((c) => c.type === type);
  const getEndCondition = (type: string) => config.endConditions.find((c) => c.type === type);

  // Pipeline mode → operations list (presets only; per-op toggles aren't exposed).
  const setMode = (mode: AutoMode) =>
    update({ mode, operations: AUTO_MODE_PRESETS[mode] });

  function toggleEndCondition(type: string, defaultCond: AutoEndCondition) {
    if (hasEndCondition(type)) {
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
    <Modal onClose={onClose} size="lg" maxHeight="85vh">
      <ModalHeader onClose={onClose}>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Auto Mode Settings</h2>
          <p className="text-[10px] text-text-dim uppercase tracking-wider">Configure autonomous narrative generation</p>
        </div>
      </ModalHeader>
      <ModalBody className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-bg-elevated rounded-lg p-0.5 shrink-0">
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

        <div className="flex flex-col gap-4">
          {tab === 'end' && (
            <>
              {!hasEndCondition('manual_stop') && (
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
                      className="accent-yellow-500"
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
                      className="accent-yellow-500"
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
                </>
              )}

              {/* Planning complete */}
              {hasCoordinationPlan && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasEndCondition('planning_complete')}
                    onChange={() => toggleEndCondition('planning_complete', { type: 'planning_complete' })}
                    className="accent-white/80"
                  />
                  <span className="text-xs text-text-secondary">Stop when coordination plan completes</span>
                </label>
              )}

              {/* Manual stop — warning zone */}
              <div className={`border border-amber-500/30 rounded-lg p-3 bg-amber-500/5 ${hasEndCondition('manual_stop') ? '' : 'mt-4'}`}>
                <p className="text-[10px] text-amber-400/80 uppercase tracking-widest font-semibold mb-2">Warning</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasEndCondition('manual_stop')}
                    onChange={() => {
                      if (hasEndCondition('manual_stop')) {
                        // Turning off manual stop — restore a default end condition
                        update({ endConditions: [{ type: 'scene_count', target: 50 }] });
                      } else {
                        // Turning on manual stop — clear all other conditions
                        update({ endConditions: [{ type: 'manual_stop' }] });
                      }
                    }}
                    className="accent-amber-500"
                  />
                  <span className="text-xs text-text-secondary">Manual stop only</span>
                </label>
                <p className="text-[10px] text-text-dim leading-relaxed mt-1 ml-6">
                  {hasEndCondition('manual_stop')
                    ? 'All automatic end conditions are disabled. Generation runs indefinitely until you manually stop it.'
                    : 'No automatic stopping — generation runs indefinitely until you manually stop it.'}
                </p>
              </div>
            </>
          )}

          {tab === 'direction' && (
            <>
              <p className="text-[10px] text-text-dim leading-relaxed">
                Direction and constraints guide every arc. Use the planning queue for long-form narrative structure.
              </p>

              {/* Direction + Constraints */}
              <GuidanceFields
                direction={config.direction}
                constraints={config.narrativeConstraints}
                onDirectionChange={(v) => update({ direction: v })}
                onConstraintsChange={(v) => update({ narrativeConstraints: v })}
              />
            </>
          )}

          {tab === 'pipeline' && (
            <>
              <p className="text-[10px] text-text-dim leading-relaxed">
                Pick how each auto-mode cycle generates an arc.
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {(['quick', 'extended'] as AutoMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`text-left rounded-lg border px-3 py-2.5 transition ${
                      config.mode === m
                        ? 'border-emerald-500/40 bg-emerald-500/8'
                        : 'border-white/8 bg-white/2 hover:border-white/16 hover:bg-white/5'
                    }`}
                  >
                    <div className={`text-[11px] font-medium capitalize ${config.mode === m ? 'text-emerald-200' : 'text-text-secondary'}`}>
                      {m}
                    </div>
                    <div className="text-[10px] text-text-dim leading-snug mt-0.5">{MODE_DESC[m]}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
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
      </ModalFooter>
    </Modal>
  );
}
