/**
 * Delta Guidelines Prompt — shared text block (used in both system and user
 * prompt contexts; kept plain text so it works in either).
 *
 * Delta field shapes + emission discipline. Force formulas and floors live
 * in forces.ts — this file doesn't restate them.
 */

import { FORCE_BANDS, fmtBand } from '@/lib/narrative-utils';

const W = FORCE_BANDS.world;
const S = FORCE_BANDS.system;

export const PROMPT_DELTAS = `DELTAS — inputs to force formulas. Earn from prose; never invent. Under-tagging is the dominant failure.

ALL NODE CONTENT: 15-25 words, PRESENT TENSE, specific and concrete.

DENSITY TIERS (above the per-scene floor in forces.ts):
- Breather:  0 transitions, ${fmtBand(W.quiet)} world, ${fmtBand(S.quiet)} system.
- Typical:   0-1 transitions, ${fmtBand(W.typical)} world, ${fmtBand(S.typical)} system + edges.
- Climactic: 1-2 transitions, ${fmtBand(W.climax, true)} world, ${fmtBand(S.climax)} system + edges.
- Theory / lore dump: 6-10 world, 6-12 system.

INITIALIZATION FLOOR — zero-node entities / empty threads are invalid:
- Every new character / location / artifact must have ≥1 node in its world.nodes at creation.
- Every new thread must declare ≥2 named outcomes and open with a threadDelta carrying evidence on at least one outcome (logType "setup").

THREAD DELTAS — Threads are PREDICTION MARKETS over named outcomes.
  Question shape:
    BAD (too plain to carry an arc): "Will Bob succeed?"
    GOOD (fiction, binary): "Can Ayesha clear her grandfather's name before the tribunal ends?" → outcomes: ["yes", "no"].
    GOOD (fiction, multi): "Who claims the throne?" → outcomes: ["Stark", "Lannister", "Targaryen", "nobody"].
    GOOD (argument): "Does the proposed mechanism explain anomalies the prior model cannot?" → outcomes: ["yes", "no"].
    Picaresque / ironic / open-inquiry forms may use a deliberately simple recurring question as their spine — register must earn it.

  Each threadDelta carries:
    updates[]      per-outcome { outcome: string, evidence: number in [-4, +4] — decimals encouraged (e.g. +1.5, +2.7, −0.8); rounded to one decimal place }.
    logType        one of { pulse, transition, setup, escalation, payoff, twist, callback, resistance, stall }.
    volumeDelta    integer — change to attention on this thread (typically 0..+2, negative only when deliberately quieted).
    rationale      ONE prose sentence grounded in the scene. Describe what HAPPENED in natural language — what the reader witnesses and what it implies for the thread's question. DO NOT quote outcome identifiers (they're technical names like "yes_with_great_cost"), DO NOT reference logType or evidence numbers. Write as if annotating a novel's margin, not a database column.
    addOutcomes[]  (rare, optional) — names of NEW outcomes to add to the market mid-story.

  OUTCOME EXPANSION (addOutcomes) — reserved for scenes that GENUINELY open new possibilities: a reveal introduces a third contender, a new faction enters the field, a character realises an option no one had considered. New outcomes join the market at neutral prior (logit=0 — equally likely as the current best outcome before this scene's evidence). Then same-scene evidence shifts the new outcome's position.
    DO expand: "A third cousin's claim to the throne surfaces during the audit" → addOutcomes: ["cousin"]; updates: [{outcome:"cousin", evidence:+2}].
    DON'T expand: "Harry suspects Snape might be the thief" — that's evidence on an existing outcome, not a new one.
    Most arcs open 0 outcomes. Arcs that open 1 do so once or twice total. Opening 2+ in one scene is a sign of overloading the market.

  EVIDENCE SCALE (real number, decimals allowed for calibrated partial nudges; matches game-theory stake deltas):
    ±0..1   pulse / minor shift.
    ±1..2   setup / resistance.
    ±2..3   escalation / twist.
    ±3..4   payoff / reversal (closes the market).

  Most scenes emit |evidence| ≤ 2. +4 is reserved for THE biggest moment so far on a thread — check the trajectory.
  logType must AGREE with evidence magnitude (setup at +0..+1, escalation at +2..+3, payoff at +3..+4, twist at ±3 against prior trend).
  EVIDENCE ≠ VOLUME: does the scene shift BELIEF (evidence) or ATTENTION (volumeDelta)? A pulse has volumeDelta=+1 and evidence=0.
  CORRELATION: one reveal can move multiple threads; each rationale cites its specific driving sentence.

  MULTI-OUTCOME UPDATES — when a market has 3+ outcomes, a single scene often moves several of them in different directions and by different magnitudes. Treat each outcome as a separate lever, weighted by how much the scene's evidence actually implies about that outcome.
    - A decisive reveal for one outcome usually SUPPRESSES its rivals. Example on {Stark, Lannister, Targaryen}: news that a Stark heir was secretly raised = updates: [{Stark, +3}, {Lannister, −1}, {Targaryen, 0}]. The rival that was actively contending gets squeezed; the unrelated option barely moves.
    - Related outcomes on a spectrum can move in LOCKSTEP at different magnitudes. Example on {fails, partial, succeeds, triumphant}: protagonist clears the first test but reveals a weakness → updates: [{partial, +2}, {succeeds, +1}, {triumphant, −1}, {fails, −1}]. Partial rises most; clean success rises a little; the ceiling and the floor both shrink.
    - Absence of evidence on an outcome is not the same as evidence against it. If the scene simply doesn't touch an option, omit it from updates (no entry ≠ evidence=0 — pass-through preserves its relative standing when the rival moves).
    - Treat evidence as a zero-sum pull within the market only when the scene genuinely forces a trade-off. Otherwise let shifts be independent; softmax renormalises anyway.
  Two-outcome markets: mirror evidence by default (e.g. {yes+2, no-1} for a clear but not decisive shift). Pure one-sided nudges (e.g. {yes+1} alone) imply the rival is unchanged — legitimate for ambient reinforcement.
  CLOSURE: market auto-closes when margin ≥ τ_effective AND logType is payoff/twist with |evidence| ≥ 3. τ_effective scales with accumulated volume — high-attention threads demand proportionally more decisive resolutions.
  ABANDONMENT: volume decays per scene untouched; thread leaves focus when volume < floor. Reopen via volumeDelta ≥ 2.
  2–6 threads per scene. Focus-window threads have priority. Don't emit zero-evidence zero-volume entries.

WORLD DELTAS — Entity's PRESENT-TENSE facts. By entity type:
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

SYSTEM DELTAS — How the WORLD / DOMAIN WORKS. Rules, principles, mechanisms — not things, not events.
  GOOD (fiction): "Magic near underage wizards is attributed to them regardless of caster."
  GOOD (fiction): "Cross-check protocols in major sects require concurrence from three elders to ratify a hostile identification."
  GOOD (non-fiction): "Delivery is computed as the equal-weighted mean of z-score-normalised force values."
  BAD: "Magic" (too vague), "Fang Yuan's plan" (specific not general), "They met in the chamber" (event not rule).
  NAME the implicit mechanic — a cross-check bypassed surfaces the cross-check structure; an artifact humming surfaces its behaviour class; a deduction surfaces the pattern detected. Never emit \`systemDeltas: {}\`.
  Types: principle | system | concept | tension | constraint.
  Edges: enables | governs | opposes | extends | constrains.

RELATIONSHIP DELTAS — SHIFTS only. valenceDelta: ±0.1 subtle, ±0.3 meaningful, ±0.5 dramatic.
EVENTS — 2-4 word tags, 2-4 per scene.
ARTIFACT USAGES — when an artifact / tool delivers utility. Every usage has a wielder.
OWNERSHIP DELTAS — artifact changes hands.
CHARACTER MOVEMENTS — physical location changes only.`;
