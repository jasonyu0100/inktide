"use client";

import type { ForcePreference, ReasoningMode } from "@/lib/ai";
import { ThinkingAnimation } from "./ThinkingAnimation";

// ── Force preference metadata ────────────────────────────────────────────────

export const FORCE_PREFERENCE_META: Record<
  ForcePreference,
  { label: string; color: string; description: string }
> = {
  freeform: {
    label: "Freeform",
    color: "#f5f5f5",
    description: "No bias. Full toolbox, LLM picks the mix.",
  },
  fate: {
    label: "Fate",
    color: "#ef4444",
    description: "Thread-driven. Favour resolutions and internal pressure.",
  },
  world: {
    label: "World",
    color: "#22c55e",
    description: "Entity-driven. Deepen existing characters and places.",
  },
  system: {
    label: "System",
    color: "#3b82f6",
    description: "Mechanic-driven. Surface and test how the world works.",
  },
  chaos: {
    label: "Chaos",
    color: "#a855f7",
    description: "Extreme creativity. Inject new entities and new fates.",
  },
};

const PREFERENCE_ORDER: ForcePreference[] = [
  "freeform",
  "fate",
  "world",
  "system",
  "chaos",
];

// ── Force preference picker ──────────────────────────────────────────────────

type Props = {
  value: ForcePreference;
  onChange: (pref: ForcePreference) => void;
  label?: string;
};

export function ForcePreferencePicker({
  value,
  onChange,
  label = "Force",
}: Props) {
  const current = FORCE_PREFERENCE_META[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] uppercase tracking-widest text-text-dim">
          {label}
        </label>
        <span className="text-[10px] text-text-dim/60">
          {current.description}
        </span>
      </div>
      <div className="flex gap-0.5 rounded-md bg-white/4 p-0.5">
        {PREFERENCE_ORDER.map((pref) => {
          const meta = FORCE_PREFERENCE_META[pref];
          const selected = pref === value;
          return (
            <button
              key={pref}
              type="button"
              onClick={() => onChange(pref)}
              className="flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: selected ? "rgba(255,255,255,0.08)" : "transparent",
                color: selected ? meta.color : "rgba(255,255,255,0.5)",
              }}
              title={meta.description}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Reasoning-size picker ────────────────────────────────────────────────────

export type ReasoningSize = "small" | "medium" | "large";

const REASONING_SIZE_ORDER: ReasoningSize[] = ["small", "medium", "large"];

const REASONING_SIZE_META: Record<
  ReasoningSize,
  { label: string; description: string }
> = {
  small: {
    label: "Small",
    description: "Compact graph. Fewer reasoning nodes.",
  },
  medium: {
    label: "Medium",
    description: "Default graph density.",
  },
  large: {
    label: "Large",
    description: "Dense graph. More reasoning nodes.",
  },
};

export function ReasoningSizePicker({
  value,
  onChange,
  label = "Density",
}: {
  value: ReasoningSize;
  onChange: (size: ReasoningSize) => void;
  label?: string;
}) {
  const current = REASONING_SIZE_META[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] uppercase tracking-widest text-text-dim">
          {label}
        </label>
        <span className="text-[10px] text-text-dim/60">
          {current.description}
        </span>
      </div>
      <div className="flex gap-0.5 rounded-md bg-white/4 p-0.5">
        {REASONING_SIZE_ORDER.map((size) => {
          const meta = REASONING_SIZE_META[size];
          const selected = size === value;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onChange(size)}
              className="flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: selected ? "rgba(255,255,255,0.08)" : "transparent",
                color: selected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
              }}
              title={meta.description}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Reasoning-mode picker ────────────────────────────────────────────────────

const REASONING_MODE_ORDER: ReasoningMode[] = [
  "divergent",
  "deduction",
  "abduction",
  "induction",
];

const REASONING_MODE_META: Record<
  ReasoningMode,
  { label: string; color: string; description: string }
> = {
  divergent: {
    label: "Divergent",
    color: "#fbbf24",
    description: "What else could be true? Expands the space forward.",
  },
  deduction: {
    label: "Deduction",
    color: "#e5e7eb",
    description: "If the premise holds, what must follow? Forward necessity.",
  },
  abduction: {
    label: "Abduction",
    color: "#f472b6",
    description: "What prior best explains this outcome? Backward to a specific cause.",
  },
  induction: {
    label: "Induction",
    color: "#60a5fa",
    description: "What pattern explains these observations? Backward to a principle.",
  },
};

export function ReasoningModePicker({
  value,
  onChange,
  label = "Mode",
}: {
  value: ReasoningMode;
  onChange: (mode: ReasoningMode) => void;
  label?: string;
}) {
  const current = REASONING_MODE_META[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] uppercase tracking-widest text-text-dim">
          {label}
        </label>
        <span className="text-[10px] text-text-dim/60">
          {current.description}
        </span>
      </div>
      <div className="flex gap-0.5 rounded-md bg-white/4 p-0.5">
        {REASONING_MODE_ORDER.map((mode) => {
          const meta = REASONING_MODE_META[mode];
          const selected = mode === value;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className="flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: selected ? "rgba(255,255,255,0.08)" : "transparent",
                color: selected ? meta.color : "rgba(255,255,255,0.5)",
              }}
              title={meta.description}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Network-bias picker ──────────────────────────────────────────────────────

export type NetworkBias = "inside" | "outside" | "neutral";

const NETWORK_BIAS_ORDER: NetworkBias[] = ["inside", "neutral", "outside"];

const NETWORK_BIAS_META: Record<
  NetworkBias,
  { label: string; color: string; description: string }
> = {
  inside: {
    label: "Inside",
    color: "#ef4444",
    description: "Conventional. Lean into HOT entities and threads — deepen the gravitational centres.",
  },
  neutral: {
    label: "Neutral",
    color: "#e5e7eb",
    description: "Dynamic. Use what the arc needs — balanced across hot and cold.",
  },
  outside: {
    label: "Outside",
    color: "#22d3ee",
    description: "Unique. Reach for COLD or FRESH dormant matter — break the dominant pattern.",
  },
};

export function NetworkBiasPicker({
  value,
  onChange,
  label = "Network",
}: {
  value: NetworkBias;
  onChange: (bias: NetworkBias) => void;
  label?: string;
}) {
  const current = NETWORK_BIAS_META[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] uppercase tracking-widest text-text-dim">
          {label}
        </label>
        <span className="text-[10px] text-text-dim/60">
          {current.description}
        </span>
      </div>
      <div className="flex gap-0.5 rounded-md bg-white/4 p-0.5">
        {NETWORK_BIAS_ORDER.map((bias) => {
          const meta = NETWORK_BIAS_META[bias];
          const selected = bias === value;
          return (
            <button
              key={bias}
              type="button"
              onClick={() => onChange(bias)}
              className="flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: selected ? "rgba(255,255,255,0.08)" : "transparent",
                color: selected ? meta.color : "rgba(255,255,255,0.5)",
              }}
              title={meta.description}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Thinking settings wrapper ────────────────────────────────────────────────

/** Dropdown row — label on the left, native <select> on the right. All
 *  options rendered in a consistent near-white; the palette meaning is
 *  communicated by the animation, not the control. */
function DropdownRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: readonly { key: T; label: string; description?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="w-14 shrink-0 text-[8px] uppercase tracking-widest text-text-dim/70">
        {label}
      </span>
      <div className="relative flex-1 rounded-md border border-white/10 bg-white/4 hover:bg-white/6 transition-colors">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full bg-transparent text-[10px] font-medium text-text-primary cursor-pointer appearance-none outline-none px-2 py-1 pr-6"
        >
          {options.map((opt) => (
            <option
              key={opt.key}
              value={opt.key}
              className="bg-bg-panel text-text-primary"
              title={opt.description}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-dim/60 text-[8px]"
          aria-hidden
        >
          ▾
        </span>
      </div>
    </label>
  );
}

const MODE_OPTS = [
  { key: 'divergent' as ReasoningMode, label: 'Divergent', description: REASONING_MODE_META.divergent.description },
  { key: 'deduction' as ReasoningMode, label: 'Deduction', description: REASONING_MODE_META.deduction.description },
  { key: 'abduction' as ReasoningMode, label: 'Abduction', description: REASONING_MODE_META.abduction.description },
  { key: 'induction' as ReasoningMode, label: 'Induction', description: REASONING_MODE_META.induction.description },
] as const;

const FORCE_OPTS = [
  { key: 'freeform' as ForcePreference, label: 'Freeform', description: FORCE_PREFERENCE_META.freeform.description },
  { key: 'fate' as ForcePreference, label: 'Fate', description: FORCE_PREFERENCE_META.fate.description },
  { key: 'world' as ForcePreference, label: 'World', description: FORCE_PREFERENCE_META.world.description },
  { key: 'system' as ForcePreference, label: 'System', description: FORCE_PREFERENCE_META.system.description },
  { key: 'chaos' as ForcePreference, label: 'Chaos', description: FORCE_PREFERENCE_META.chaos.description },
] as const;

const SIZE_OPTS = [
  { key: 'small' as ReasoningSize, label: 'Small', description: 'Compact graph. Fewer reasoning nodes.' },
  { key: 'medium' as ReasoningSize, label: 'Medium', description: 'Default graph density.' },
  { key: 'large' as ReasoningSize, label: 'Large', description: 'Dense graph. More reasoning nodes.' },
] as const;

const BIAS_OPTS = [
  { key: 'inside' as NetworkBias, label: 'Inside (conventional)', description: 'Lean into HOT entities — deepen the gravitational centres.' },
  { key: 'neutral' as NetworkBias, label: 'Neutral (dynamic)', description: 'Use what the arc needs — balanced across hot and cold.' },
  { key: 'outside' as NetworkBias, label: 'Outside (unique)', description: 'Reach for COLD or FRESH dormant matter — break the dominant pattern.' },
] as const;

/**
 * Groups the four thinking-related dials (mode, force, density, network bias)
 * under a single `THINKING` header with a live animation preview. Dropdowns
 * keep the controls compact; the animation to the right tells the full
 * story — the existing network tiers, the causal graph the current mode
 * unfolds, and the tethers from each reasoning node back to the part of
 * the network the bias draws from.
 */
export function ThinkingSettings({
  mode, onModeChange,
  force, onForceChange,
  size, onSizeChange,
  networkBias, onNetworkBiasChange,
}: {
  mode: ReasoningMode;
  onModeChange: (m: ReasoningMode) => void;
  force: ForcePreference;
  onForceChange: (f: ForcePreference) => void;
  size: ReasoningSize;
  onSizeChange: (s: ReasoningSize) => void;
  networkBias: NetworkBias;
  onNetworkBiasChange: (b: NetworkBias) => void;
}) {
  const modeMeta = REASONING_MODE_META[mode];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/6 bg-white/2 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-text-dim/80 font-semibold">
          Thinking
        </div>
        <div className="text-[9px] text-text-dim/50 italic truncate ml-3">
          {modeMeta.description}
        </div>
      </div>
      <div className="flex gap-3 items-start">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <DropdownRow
            label="Mode"
            value={mode}
            options={MODE_OPTS}
            onChange={onModeChange}
          />
          <DropdownRow
            label="Force"
            value={force}
            options={FORCE_OPTS}
            onChange={onForceChange}
          />
          <DropdownRow
            label="Density"
            value={size}
            options={SIZE_OPTS}
            onChange={onSizeChange}
          />
          <DropdownRow
            label="Network"
            value={networkBias}
            options={BIAS_OPTS}
            onChange={onNetworkBiasChange}
          />
        </div>
        <div className="shrink-0">
          {/* key-based remount so every settings permutation plays a
              fresh animation from frame 0 — guarantees visibility of the
              change even mid-cycle. */}
          <ThinkingAnimation
            key={`${mode}-${force}-${size}-${networkBias}`}
            mode={mode}
            force={force}
            size={size}
            networkBias={networkBias}
            width={300}
            height={210}
          />
        </div>
      </div>
    </div>
  );
}
