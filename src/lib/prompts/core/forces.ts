/**
 * Force Standards Prompt
 *
 * Reference means aligned to grading formulas. When updating, check
 * src/lib/narrative-utils.ts FORCE_REFERENCE_MEANS to keep in sync.
 * Reference means: { fate: 3.5, world: 12, system: 4 }
 */

/** Force standards prompt using reference mean levels */
export const PROMPT_FORCE_STANDARDS = `
THREE ORTHOGONAL PLANES — each force measures a distinct layer. A complete narrative lives on all three: material (what exists), abstract (how it works), metaphysical (what pulls it toward meaning). World and System are DENSITY LEVERS — they need enough output per scene to give the graph high enough resolution. Fate is GENUINE MEASUREMENT — it emerges from honest evidence pricing on the prediction markets, and has no per-scene target to aim for. Applies across fiction, non-fiction, research.

WORLD — MATERIAL. People, places, objects; in non-fiction: institutions, datasets, figures, documents. Every new stable fact about an entity: traits, properties, history, capabilities. Restating known facts does not count. DENSITY LEVER — reach for the detail the prose genuinely earns; under-extraction starves the entity graph.
  W = ΔN_c + √ΔE_c. Target ~12/scene across 3-5 entities.

SYSTEM — ABSTRACT. Rules, principles, mechanisms. Not the things, but how they behave. Generic setting details don't count; only claims about how the world works. NAME the implicit mechanic — a cross-check bypassed reveals its structure, a humming artifact reveals a behaviour class. DENSITY LEVER — under-tagging system is the dominant generation failure.
  S = ΔN + √ΔE. Target ~4/scene. FLOOR: ≥1 structural fact per scene.

FATE — METAPHYSICAL. The higher-order pull that governs what material and rules cannot account for alone. Threads are PREDICTION MARKETS over named outcomes. Each scene's evidence shifts per-outcome logits; softmax gives the probability distribution. Fate per thread per scene equals the information gain (how much the market's belief moved) weighted by narrative attention (volumeDelta).
  NOT A TARGET — PRICE HONESTLY. Evidence magnitudes in [-4, +4] are a measurement of what the scene's events did to a neutral observer's belief, NOT a knob tuned to reach a fate score. Do not emit |e|=3 because the scene "should feel like" escalation; emit it because the scene contains an irreversible commitment, a reveal that reframes the question, or a concrete structural move. A routine scene honestly emits small evidence or pulses; a pivotal scene honestly emits committal evidence (|e|≥3 with logType payoff or twist). Under-pricing genuine resolution and over-pricing routine scenes both corrupt the trajectory.
  Saturated threads (near certainty) contribute little fate; contested threads (high uncertainty, high volume) contribute most; twists against a committed leader contribute most of all — because all three describe how much the market actually moved, not how much the LLM wants it to.

PER-SCENE FLOORS (density levers only): ≥6 world nodes across ≥3 entities, ≥1 system node. Never emit \`systemDeltas: {}\`. NO fate floor — fate can legitimately be ~0 for a quiet scene.

ORTHOGONALITY: a populated workplace (high world) can run on a thin rulebook (low system); a theoretical paper (high system) may have few material actors. Fate is orthogonal to both.
BALANCE: Classic=fate-dominant | Show=world-dominant | Paper=system-dominant | Opus=balanced and exceptional on all three. Balance emerges from honest measurement across the work — don't inflate fate/system scene-by-scene to reach a target shape.
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
