"use client";

import type { ForcePreference, ReasoningMode } from "@/lib/ai";

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
  balanced: {
    label: "Balanced",
    color: "#e5e7eb",
    description: "Explicit ~1/3 fate, ~1/3 world, ~1/3 system.",
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
  "balanced",
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

/**
 * Groups the four thinking-related dials (mode, force, density, network bias)
 * under a single `THINKING` header. Maximum control — none of the dials are
 * collapsed — but visually unified so they read as one control panel.
 */
export function ThinkingSettings({
  mode,
  onModeChange,
  force,
  onForceChange,
  size,
  onSizeChange,
  networkBias,
  onNetworkBiasChange,
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
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/6 bg-white/2 p-3">
      <div className="text-[10px] uppercase tracking-widest text-text-dim/80 font-semibold">
        Thinking
      </div>
      <ReasoningModePicker value={mode} onChange={onModeChange} />
      <ForcePreferencePicker value={force} onChange={onForceChange} />
      <ReasoningSizePicker value={size} onChange={onSizeChange} />
      <NetworkBiasPicker value={networkBias} onChange={onNetworkBiasChange} />
    </div>
  );
}
