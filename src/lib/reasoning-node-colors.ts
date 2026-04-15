/**
 * Shared colour language for reasoning-graph nodes.
 *
 * Three force families carry their base hues, but every type has its
 * own distinct hue+value so they're easy to tell apart at a glance:
 *
 *   Fate force     red
 *   World force    emerald / green / lime (character / location / artifact)
 *   System force   indigo
 *   Reasoning      cool slate (neutral)
 *   Pattern        bright teal (positive reinforcement agent)
 *   Warning        orange (alert agent)
 *   Chaos          vibrant magenta (outside-force agent)
 *
 * Plan-only spine types (peak / valley / moment) are defined alongside
 * the reasoning types in `REASONING_NODE_COLORS_PLAN` so the same swatch
 * dictionary powers every reasoning-graph surface in the app.
 */

export type ReasoningNodePalette = {
  fill: string;
  stroke: string;
  text: string;
};

export const REASONING_NODE_COLORS: {
  fate: ReasoningNodePalette;
  character: ReasoningNodePalette;
  location: ReasoningNodePalette;
  artifact: ReasoningNodePalette;
  system: ReasoningNodePalette;
  reasoning: ReasoningNodePalette;
  pattern: ReasoningNodePalette;
  warning: ReasoningNodePalette;
  chaos: ReasoningNodePalette;
} = {
  // Fate — red (bright, alert)
  fate: { fill: "#b91c1c", stroke: "#f87171", text: "#fee2e2" },
  // World entities — three distinct green hues so they don't blur together
  character: { fill: "#059669", stroke: "#34d399", text: "#d1fae5" },  // emerald
  location: { fill: "#16a34a", stroke: "#86efac", text: "#dcfce7" },   // green
  artifact: { fill: "#65a30d", stroke: "#bef264", text: "#ecfccb" },   // lime (gold-tinged, "precious")
  // System — indigo (distinct from valley's sky blue)
  system: { fill: "#4338ca", stroke: "#818cf8", text: "#e0e7ff" },
  // Reasoning — cool slate (neutral)
  reasoning: { fill: "#475569", stroke: "#94a3b8", text: "#f1f5f9" },
  // Pattern — bright teal (positive reinforcement agent)
  pattern: { fill: "#0891b2", stroke: "#22d3ee", text: "#cffafe" },
  // Warning — orange (alert agent; replaces rose for clearer differentiation)
  warning: { fill: "#ea580c", stroke: "#fb923c", text: "#ffedd5" },
  // Chaos — vibrant magenta (outside-force agent; distinct from system indigo
  // and deep purples used elsewhere)
  chaos: { fill: "#be185d", stroke: "#f472b6", text: "#fce7f3" },
};

/**
 * Extended palette that adds the plan-only spine types on top of the
 * reasoning-graph base.
 */
export const REASONING_NODE_COLORS_PLAN = {
  ...REASONING_NODE_COLORS,
  // Peak — amber (matches delivery-curve PEAK_COLOR; arc commits here)
  peak: { fill: "#d97706", stroke: "#fcd34d", text: "#fef3c7" },
  // Valley — sky blue (matches delivery-curve VALLEY_COLOR; arc pivots here)
  valley: { fill: "#2563eb", stroke: "#93c5fd", text: "#dbeafe" },
  // Moment — warm stone grey (plan-level beat; distinct from reasoning's cool slate)
  moment: { fill: "#57534e", stroke: "#a8a29e", text: "#f5f5f4" },
};

/** Fallback palette for unknown node types. */
export const REASONING_NODE_COLOR_UNKNOWN: ReasoningNodePalette = {
  fill: "#475569",
  stroke: "#94a3b8",
  text: "#f1f5f9",
};
