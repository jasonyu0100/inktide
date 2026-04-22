/**
 * Delta Guidelines Prompt
 *
 * Delta field shapes + emission discipline. Force formulas and floors live
 * in forces.ts — this file doesn't restate them.
 */

export const PROMPT_DELTAS = `
DELTAS — inputs to force formulas. Earn from prose; never invent. Under-tagging is the dominant failure.

ALL NODE CONTENT: 15-25 words, PRESENT TENSE, specific and concrete.

DENSITY TIERS (above the per-scene floor in forces.ts):
  Breather:  0 transitions, 6-8 world, 1-2 system
  Typical:   0-1 transitions, 10-14 world, 3-5 system + edges
  Climactic: 1-2 transitions, 16-20+ world, 5-8 system + edges
  Theory / lore dump: 6-10 world, 6-12 system

INITIALIZATION FLOOR — zero-node entities / zero-log threads are invalid:
  - Every new character / location / artifact must have ≥1 node in its world.nodes at creation.
  - Every new thread must open with a scene threadDelta carrying ≥1 addedNode (type "setup").

threadDeltas — Threads are COMPELLING QUESTIONS with stakes, uncertainty, investment.
  BAD (default): "Will Bob succeed?" — too plain to carry an arc.
  GOOD (fiction): "Can Ayesha clear her grandfather's name before the tribunal ends?"
  GOOD (argument): "Does the proposed mechanism explain anomalies the prior model cannot?"
  Picaresque / ironic / open-inquiry forms may use a deliberately simple recurring question as their spine — register must earn it.
  STATUS: latent | seeded | active | escalating | critical | resolved | subverted | abandoned. "pulse" is NOT a status.
  Transitions move ONE step. 0-1 transitions per scene.
  LOG TYPES: pulse | transition | setup | escalation | payoff | twist | callback | resistance | stall
  COMMITMENT: escalating = point of no return. Prune stale threads (5+ scenes without transition). 10+ threads = noise.

worldDeltas — Entity's PRESENT-TENSE facts. By entity type:
  - CHARACTERS: new behaviours, beliefs, capabilities, states, wounds, goals, secrets.
  - LOCATIONS: new history, properties, dangers, rules, atmospheric facts.
  - ARTIFACTS: new capabilities, limitations, states demonstrated through use.
  GOOD (fiction): "Harry has a lightning-bolt scar from surviving the killing curse."
  GOOD (non-fiction): "The force grading formula is calibrated so published works score 85-92 on a 100-point curve."
  BAD: "Harry discovered..." / "The authors realised..." (events — belong in thread log).
  Node ORDER matters (auto-chains).

TAG RICHLY — entities are SPONGES: rich prose supports many nodes per entity; sparse prose supports few. No per-entity cap. A reflective POV character alone often carries 4-6 nodes (belief/state/goal/capability/secret shifts). A location re-entered in a dense scene carries 2-3 new properties. A quiet pass-through carries one. UNDER-tagging a rich summary is the failure.
  AGENCY over ORBIT: "Meng Song suspects Fang Yuan is hiding something" (agency) beats "Meng Song is impressed" (orbit).
  OFF-SCREEN deltas are valid when news / rumour / faction intelligence would realistically reach them. Across an arc the cast evolves alongside the POV, not waiting on them.
  PARTICIPANTS who were unchanged get nothing. Don't pad.

systemDeltas — How the WORLD / DOMAIN WORKS. Rules, principles, mechanisms — not things, not events.
  GOOD (fiction): "Magic near underage wizards is attributed to them regardless of caster."
  GOOD (fiction): "Cross-check protocols in major sects require concurrence from three elders to ratify a hostile identification."
  GOOD (non-fiction): "Delivery is computed as the equal-weighted mean of z-score-normalised force values."
  BAD: "Magic" (too vague), "Fang Yuan's plan" (specific not general), "They met in the chamber" (event not rule).
  NAME the implicit mechanic — a cross-check bypassed surfaces the cross-check structure; an artifact humming surfaces its behaviour class; a deduction surfaces the pattern detected. Never emit \`systemDeltas: {}\`.
  Types: principle | system | concept | tension | constraint.
  Edges: enables | governs | opposes | extends | constrains.

relationshipDeltas — SHIFTS only. valenceDelta: ±0.1 subtle, ±0.3 meaningful, ±0.5 dramatic.
events — 2-4 word tags, 2-4 per scene.
artifactUsages — when an artifact / tool delivers utility. Every usage has a wielder.
ownershipDeltas — artifact changes hands.
characterMovements — physical location changes only.
`;
