"use client";

import type { ForcePreference } from "@/lib/ai";

// ── Force preference metadata ────────────────────────────────────────────────

export const FORCE_PREFERENCE_META: Record<
  ForcePreference,
  { label: string; color: string; description: string }
> = {
  balanced: {
    label: "Balanced",
    color: "#e5e7eb",
    description: "Let the content decide. No single force is biased.",
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
  label = "Reasoning",
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
