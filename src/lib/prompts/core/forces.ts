/**
 * Force Standards Prompt
 *
 * Reference means aligned to grading formulas. When updating, check
 * src/lib/narrative-utils.ts FORCE_REFERENCE_MEANS to keep in sync.
 * Current: { fate: 1.5, world: 12, system: 3 }
 */

export const PROMPT_FORCE_STANDARDS = `
THE THREE FORCES — computed from mutations, normalised by reference mean, graded on curve (21/25 at reference). Under-dense = 60s grade.

FATE — threads pulling toward resolution.
  F = Σ √arcs × stageWeight × (1 + log(1 + investment)). Sustained threads earn superlinearly.
  Reference: ~1.5 per scene. Once escalating, fate is COMMITTED — must resolve.

WORLD — entity transformation (characters, locations, artifacts).
  W = ΔN_c + √ΔE_c. Continuity nodes mark permanent changes: traits, beliefs, capabilities, wounds.
  Reference: ~12 per scene (10-14 typical, 16-20+ climactic, 6+ breather minimum).

SYSTEM — rules and structures.
  S = ΔN + √ΔE. Knowledge nodes expand or constrain what's possible. Edges link rules together.
  Reference: ~3 per scene (2-4 typical, 5-10 lore-heavy, 0-1 interpersonal).

BALANCE: Classic = fate-dominant | Show = world-dominant | Paper = system-dominant | Opus = balanced.

SCALE: Beat ~100 words | Scene ~12 beats (~1200 words) | Arc ~4 scenes.
DENSITY: Thin mutations = low grades. Earn mutations from prose — never invent. REUSE existing node IDs.
`;
