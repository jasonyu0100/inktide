/**
 * Delta Guidelines Prompt
 *
 * Direct inputs to force formulas. Every delta must be EARNED by prose.
 */

export const PROMPT_DELTAS = `
DELTAS — direct inputs to force formulas. Every delta EARNED by prose.

FORMULAS: F = Σ √arcs × stageWeight × (1 + log(1 + investment)) | W = ΔN_c + √ΔE_c | S = ΔN + √ΔE

ALL NODE CONTENT: 15-25 words, PRESENT TENSE, specific and concrete.

DENSITY TARGETS (21/25 at reference — fate 1.5, world 12, system 3):
  Breather:  0 transitions, 6-8 world, 0-1 system
  Typical:   0-1 transitions, 10-14 world, 2-4 system + edges
  Climactic: 1-2 transitions, 16-20+ world, 4-6 system + edges
  Lore dump: modest world (6-10), heavy system (5-10)
Variance required — peaks and valleys, not flatline.

threadDeltas — Threads are COMPELLING QUESTIONS that shape fate.
  A compelling question has STAKES, UNCERTAINTY, and INVESTMENT.
  BAD: "Will Bob succeed?" GOOD: "Can Marcus protect his daughter from the cult that killed his wife?"
  Thread logs track incremental ANSWERS to these questions over time.
  TWO AXES:
  STATUS (from/to): latent | seeded | active | escalating | critical | resolved | subverted | abandoned
    "pulse" is NOT a status. Transitions move ONE step. 0-1 transitions per scene.
  LOG TYPE: pulse | transition | setup | escalation | payoff | twist | callback | resistance | stall

  COMMITMENT: escalating = point of no return (must resolve/subvert).
  Threads below escalating CAN be abandoned. Prune stale threads (5+ scenes without transition).
  Keep thread count lean — 10+ threads = noise.

worldDeltas — Entity's PRESENT TENSE facts (traits, beliefs, capabilities, wounds).
  GOOD: "Harry has a lightning-bolt scar from surviving the killing curse."
  BAD: "Harry discovered..." (event → thread log)
  2-4 nodes per entity. Node ORDER matters (auto-chains).

systemDeltas — How the WORLD WORKS. General rules, no specific characters.
  GOOD: "Magic near underage wizards is attributed to them regardless of caster."
  REUSE existing IDs. Types: principle, system, concept, tension, constraint.
  Edges: enables, governs, opposes, extends, constrains.

relationshipDeltas — Only SHIFTS. valenceDelta: ±0.1 subtle, ±0.3 meaningful, ±0.5 dramatic.
events — 2-4 word tags, 2-4 per scene.
artifactUsages — When artifact delivers utility. ownershipDeltas — Changing hands.
characterMovements — Location CHANGES only.
`;
