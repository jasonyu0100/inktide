/**
 * Beat Functions & Mechanisms Prompt
 *
 * Single source of truth for beat classification — used by plan generation,
 * reverse engineering, and prose generation.
 */

export const PROMPT_BEAT_TAXONOMY = `
FUNCTIONS (10) — what the beat does:
  breathe    — Atmosphere, sensory grounding, scene establishment
  inform     — Character or reader learns something NOW
  advance    — Plot moves, goals pursued, tension rises
  bond       — Relationship shifts
  turn       — Revelation, reversal, interruption
  reveal     — Character nature exposed through action/choice
  shift      — Power dynamic inverts
  expand     — New rule, system, geography introduced
  foreshadow — Plants information for LATER payoff
  resolve    — Tension releases, question answered

MECHANISMS (8) — how prose delivers:
  dialogue    — Quoted speech
  thought     — POV internal monologue
  action      — Physical movement, gesture
  environment — Setting, weather, sounds
  narration   — Narrator voice, exposition, time compression
  memory      — Flashback triggered by association
  document    — Embedded text (letter, sign)
  comic       — Humor, irony, absurdity

EDGE CASES: Overhearing = environment | Thinking = thought | Describing speech = narration
`;
