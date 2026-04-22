/**
 * Force Standards Prompt
 *
 * Reference means aligned to grading formulas. When updating, check
 * src/lib/narrative-utils.ts FORCE_REFERENCE_MEANS to keep in sync.
 * Reference means: { fate: 3.5, world: 12, system: 4 }
 */

/** Force standards prompt using reference mean levels */
export const PROMPT_FORCE_STANDARDS = `
THREE ORTHOGONAL PLANES — each force measures a distinct layer. A complete narrative lives on all three: material (what exists), abstract (how it works), metaphysical (what pulls it toward meaning). Computed from deltas, z-normalised against reference means, graded on curve (21/25 at reference). Applies across fiction, non-fiction, research.

WORLD — MATERIAL. People, places, objects; in non-fiction: institutions, datasets, figures, documents. Every new stable fact about an entity: traits, properties, history, capabilities. Restating known facts does not count.
  W = ΔN_c + √ΔE_c. Target ~12/scene across 3-5 entities.

SYSTEM — ABSTRACT. Rules, principles, mechanisms. Not the things, but how they behave. Generic setting details don't count; only claims about how the world works. NAME the implicit mechanic — a cross-check bypassed reveals its structure, a humming artifact reveals a behaviour class. Under-tagging system is the dominant generation failure.
  S = ΔN + √ΔE. Target ~4/scene. FLOOR: ≥1 structural fact per scene.

FATE — METAPHYSICAL. The higher-order pull that governs what material and rules cannot account for alone. Fate fires when action exceeds what traits and rules would predict — a vow kept at cost, a coincidence ratifying into pattern, an arc resolving because the story required it. Routine movement (a letter arrives, a plan proceeds) earns NO fate weight.
  F = Σ √arcs × stageWeight × (1 + log(1 + investment)). Target ~3.5/scene in fate-forward work; less elsewhere.

PER-SCENE FLOORS: ≥6 world nodes across ≥3 entities, ≥1 system node. Never emit \`systemDeltas: {}\`.

ORTHOGONALITY: a populated workplace (high world) can run on a thin rulebook (low system); a theoretical paper (high system) may have few material actors. Fate is orthogonal to both.
BALANCE: Classic=fate-dominant | Show=world-dominant | Paper=system-dominant | Opus=balanced and exceptional on all three. Don't inflate fate/system on character-driven work.
SCALE: Beat ~100w | Scene ~12 beats (~1200w) | Arc ~4 scenes.
DENSITY: Earn deltas from prose — never invent. REUSE existing node IDs.
`;

/**
 * Build force standards prompt using reference means.
 * @deprecated Use PROMPT_FORCE_STANDARDS directly. This function is kept for backwards compatibility.
 */
export function buildForceStandardsPrompt(): string {
  return PROMPT_FORCE_STANDARDS;
}
