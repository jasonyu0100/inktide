/**
 * Delta Guidelines Prompt
 *
 * Direct inputs to force formulas. Every delta must be EARNED by prose.
 */

export const PROMPT_DELTAS = `
DELTAS — direct inputs to force formulas. Every delta EARNED by prose. Applies across fiction, non-fiction, research, simulation.

FORMULAS: F = Σ √arcs × stageWeight × (1 + log(1 + investment)) | W = ΔN_c + √ΔE_c | S = ΔN + √ΔE

ALL NODE CONTENT: 15-25 words, PRESENT TENSE, specific and concrete.

DENSITY TARGETS (21/25 at reference — fate 3.5, world 12, system 4):
  Breather:  0 transitions, 6-8 world, 1-2 system
  Typical:   0-1 transitions, 10-14 world, 3-5 system + edges
  Climactic: 1-2 transitions, 16-20+ world, 5-8 system + edges
  Theory / lore dump: modest world (6-10), heavy system (6-12)
FLOOR applied to every scene: ≥6 world nodes across ≥3 distinct entities, ≥1 system node. Variance required above the floor — peaks and valleys, not flatline.

INITIALIZATION FLOOR — zero-node entities and zero-log threads are invalid:
  - Every new character / location / artifact must have ≥1 node in its world.nodes at creation. Role/prominence/significance minimums (see below) are the target; 1 is the absolute floor.
  - Every new thread must be opened by a scene threadDelta carrying ≥1 addedNode (type "setup") that records the seed moment. A thread whose opening scene has no log entry is broken — the question has been posed with no record of it being posed.

threadDeltas — Threads are COMPELLING QUESTIONS. In fiction they shape fate; in non-fiction they shape the argument's or inquiry's trajectory. Either way: STAKES, UNCERTAINTY, INVESTMENT — in registers that call for them.
  BAD as a default: "Will Bob succeed?" / "Does the method work?" (too plain to carry a full arc)
  ACCEPTABLE when intentional: picaresque, satirical, ironic, or open-inquiry work may use a deliberately simple recurring question as its spine. The simplicity must be a choice, not a failure — the register must earn the flatness.
  GOOD (dramatic fiction): "Can Ayesha clear her grandfather's name before the tribunal ends?"
  GOOD (literary fiction, lyric register): "What does the river remember of the flood, and does the narrator want to know?"
  GOOD (argument): "Does the proposed mechanism explain the anomalies the prior model cannot, and at what cost?"
  GOOD (inquiry): "What role did diaspora networks play in the movement before digital coordination?"
  GOOD (memoir): "Can the narrator name the thing their mother refused to name?"
  GOOD (essayistic criticism): "Can poststructuralist close reading account for silence as resistance in this corpus?"
  Thread logs track incremental ANSWERS over time.
  STATUS (from/to): latent | seeded | active | escalating | critical | resolved | subverted | abandoned
    "pulse" is NOT a status. Transitions move ONE step. 0-1 transitions per scene.
  LOG TYPE: pulse | transition | setup | escalation | payoff | twist | callback | resistance | stall
  COMMITMENT: escalating = point of no return (must resolve / subvert / formally abandon).
  Prune stale threads (5+ scenes without transition). Keep thread count lean — 10+ threads = noise.

worldDeltas — Entity's PRESENT TENSE facts. Per entity TYPE:
  - CHARACTERS: new behaviours, beliefs, capabilities, states, wounds, goals, secrets. Inner movement that persists past this scene.
  - LOCATIONS: new history, properties, dangers, rules, atmospheric facts the scene reveals. A revisited location still earns deltas when the scene reveals something new about it.
  - ARTIFACTS: new capabilities, limitations, states, behaviours demonstrated through usage.
  GOOD (fiction): "Harry has a lightning-bolt scar from surviving the killing curse."
  GOOD (non-fiction): "The force grading formula is calibrated so published works score 85-92 on a 100-point curve."
  BAD: "Harry discovered..." / "The authors realised..." (events — belong in thread log or events).
  Node ORDER matters (auto-chains).

  ENTITIES ARE SPONGES — rich prose supports many nodes per entity; sparse prose supports few. No per-entity cap: emit as many 15-25-word nodes as the summary genuinely earns. A reflective POV character alone may carry 4-6 nodes (belief shift, state shift, goal shift, capability gained, secret kept); a location re-entered in a dense scene may carry 2-3 new properties; a quiet pass-through entity may carry one. UNDER-tagging a rich summary is the dominant failure mode — reread the summary and extract every stable claim it supports.

  SIDE-CHARACTER EVOLUTION IS THE NAME OF THE GAME:
  The world should feel alive around the protagonist — side characters making their own decisions, reacting to their own situations, evolving over arcs. Do NOT force a worldDelta on every participant; a character who was genuinely unchanged by the scene gets nothing. But when a secondary character was changed — suspected something, decided something, learned something, adjusted their plans — capture that shift, not as a reaction to the POV but as their OWN internal movement.
  "Meng Song suspects Fang Yuan is hiding something" is agency; "Meng Song is impressed by Fang Yuan" is a reaction (and a thin one). The former shows the character thinking; the latter shows them orbiting the POV. When in doubt, lean toward the agentic framing.

  OFF-SCREEN EVOLUTION — the world turns when the POV isn't looking:
  worldDeltas can target characters NOT in participantIds when the scene's events reach them through realistic channels — news, rumours, observed public acts, intelligence networks, faction responses. A rival receiving word of a visible action, a mentor hearing of an outcome, a council adjusting plans in response to a power shift — these are valid off-screen deltas that make the world feel alive.
  Use them when the plan implies a realistic ripple. Not every scene needs them; scenes that affect only the POV's private sphere don't warrant them. But across an arc, you should see side characters evolving independently — their own decisions accumulating over time, not waiting for the protagonist to act on them.

systemDeltas — How the WORLD / DOMAIN WORKS. General rules, not specific entities. In fiction: magic, physics, social order. In non-fiction: theorems, mechanisms, models, constraints, established principles.
  GOOD (fiction): "Magic near underage wizards is attributed to them regardless of caster."
  GOOD (fiction): "Cross-check protocols in major sects require concurrence from three elders to ratify a hostile identification."
  GOOD (non-fiction): "Delivery is computed as the equal-weighted mean of z-score-normalised force values."
  BAD: "Magic" (too vague — describe HOW it works), "Fang Yuan's plan" (specific, not general), "They met in the chamber" (event, not rule).

  EVERY SCENE SURFACES ≥1 STRUCTURAL FACT — every scene operates under rules, and the prose demonstrates them implicitly. This is NOT a lore dump; it is NAMING the mechanic the scene actually demonstrates. A character bypassing a sect's cross-checks surfaces the cross-check structure. An artifact humming persistently surfaces the artifact's behaviour class. A reflective deduction surfaces the pattern the character detected. Reread the summary and ask: what rule was at play here? Emit at minimum one addedNode per scene. NEVER emit \`systemDeltas: {}\` or an empty \`addedNodes\` array — every scene supports at least one structural observation.

  REUSE existing IDs. Types: principle, system, concept, tension, constraint.
  Edges: enables, governs, opposes, extends, constrains.

relationshipDeltas — Only SHIFTS between entities (interpersonal dynamics in fiction; inter-claim / inter-idea / inter-institution dynamics in non-fiction). valenceDelta: ±0.1 subtle, ±0.3 meaningful, ±0.5 dramatic.
events — 2-4 word tags, 2-4 per scene. Register-appropriate (see SYSTEM_PROMPT).
artifactUsages — When an artifact / tool / dataset / instrument delivers utility. ownershipDeltas — Changing hands / reassignment.
characterMovements — Location CHANGES only (physical location for fiction; venue / organisational context for non-fiction).
`;
