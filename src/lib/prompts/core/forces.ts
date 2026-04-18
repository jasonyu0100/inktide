/**
 * Force Standards Prompt
 *
 * Reference means aligned to grading formulas. When updating, check
 * src/lib/narrative-utils.ts FORCE_REFERENCE_MEANS to keep in sync.
 * Reference means: { fate: 3.5, world: 12, system: 4 }
 */

/** Force standards prompt using reference mean levels */
export const PROMPT_FORCE_STANDARDS = `
THREE ORTHOGONAL PLANES OF A WORLD — each force measures a distinct ontological layer. A complete narrative lives on all three at once: the material (what exists), the abstract (how it works), and the metaphysical (what governs its movement toward meaning). Computed from deltas, normalised by reference mean, graded on curve (21/25 at reference). Applies across fiction, non-fiction, research, and simulation.

WORLD — the MATERIAL plane. Tangible, concrete, embodied. People, places, objects; in non-fiction: institutions, datasets, figures, charts, embedded documents. Measures materiality: every lasting fact about a physical or quasi-physical entity — a trait a character reveals, a history a place carries, a property an artifact demonstrates, a value a table reports. Be GENEROUS but PRECISE: every new stable fact about an entity counts; restating what's already known does not.
  W = ΔN_c + √ΔE_c. Continuity nodes attach to entities.
  Target: ~12 per scene. A typical scene extracts something new from 3-5 entities in play — POV plus others, the location, any deployed artifacts — not just the POV character.

SYSTEM — the ABSTRACT plane. Rules, principles, mechanisms, laws. The scaffolding the world runs on — not the things themselves, but how they behave. In fiction: magic systems, physics, social order, institutional logic. In non-fiction: theorems, methods, constraints, theoretical framework. Measures RULE and KNOWLEDGE density — abstract structure that governs possibility. Generic setting details that don't constrain or enable action are NOT system; only claims about how the world works count.
  S = ΔN + √ΔE. Knowledge nodes expand or constrain what's possible; edges link rules into a structured body.
  Target: ~4 per scene in system-forward work. Don't inject lore / theory dumps where they don't belong.

FATE — the METAPHYSICAL plane. The higher-order force that governs what material and abstract alone cannot account for. Not the running of the world, but what pulls its running toward meaning. Fate is present when action or outcome exceeds what traits, circumstances, and rules would predict — when a vow is kept at cost the character-profile wouldn't forecast, when a coincidence ratifies itself into pattern, when an arc resolves because the story required it rather than because causation forced it. Low fate = the world runs on its own logic, threads close through ordinary cause-and-effect. High fate = the text cooperates with a deeper pull; characters are acted through as much as acting; arcs converge under something that does not live inside the system.
  BE SELECTIVE. Routine lifecycle movement of minor threads — a meeting happening, a letter arriving, a small-stakes plan proceeding — does NOT earn fate weight. Fate counts most when an arc-central thread advances against the system's local pull, an anchor makes a costly choice only the arc explains, or a promise / prophecy / vow ratifies itself across scenes.
  F = Σ √arcs × stageWeight × (1 + log(1 + investment)). Sustained arc-central threads earn superlinearly.
  Target: ~3.5 per scene in fate-forward work (Classic / Opus). Less in world-forward or system-forward work — those should reach their targets on world or system, not by inflating fate.

ORTHOGONALITY: a strong world is not a strong system and vice versa — a richly populated workplace (world) can run on a thin rulebook (low system); a dense theoretical paper (system) may have few material actors (low world). Fate is orthogonal to both — a world can be fully explained by its material and rules (low fate) or bend under a pull that exceeds them (high fate). The three planes are the lenses; the archetype tells you which is dominant.

BALANCE: Classic = fate-dominant | Show = world-dominant | Paper = system-dominant | Opus = balanced AND each plane is genuinely exceptional. Fate and system should NOT casually co-dominate a character-driven work — raise them only when the text truly earns it. The archetype of the source text determines the natural mixture.

SCALE: Beat ~100 words | Scene ~12 beats (~1200 words) | Arc ~4 scenes. Use "scene" for a unit of long-form text regardless of register (a chapter, a section of a paper, a log entry).
DENSITY: Earn deltas from the prose — never invent. REUSE existing node IDs.
`;

/**
 * Build force standards prompt using reference means.
 * @deprecated Use PROMPT_FORCE_STANDARDS directly. This function is kept for backwards compatibility.
 */
export function buildForceStandardsPrompt(): string {
  return PROMPT_FORCE_STANDARDS;
}
