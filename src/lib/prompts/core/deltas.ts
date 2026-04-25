/**
 * Delta Guidelines Prompt — XML block injected into user prompts that emit
 * structural deltas. Field shapes + emission discipline. Force formulas and
 * floors live in forces.ts — this file doesn't restate them.
 */

import { FORCE_BANDS, fmtBand } from '@/lib/narrative-utils';

const W = FORCE_BANDS.world;
const S = FORCE_BANDS.system;

export const PROMPT_DELTAS = `<deltas hint="Inputs to force formulas. Earn from prose; never invent. Under-tagging is the dominant failure.">
  <node-content>15-25 words, PRESENT TENSE, specific and concrete.</node-content>

  <density-tiers hint="Above the per-scene floor in forces.ts.">
    <tier name="breather">0 transitions, ${fmtBand(W.quiet)} world, ${fmtBand(S.quiet)} system.</tier>
    <tier name="typical">0-1 transitions, ${fmtBand(W.typical)} world, ${fmtBand(S.typical)} system + edges.</tier>
    <tier name="climactic">1-2 transitions, ${fmtBand(W.climax, true)} world, ${fmtBand(S.climax)} system + edges.</tier>
    <tier name="theory-or-lore-dump">6-10 world, 6-12 system.</tier>
  </density-tiers>

  <initialization-floor hint="Zero-node entities / empty threads are invalid.">
    <rule>Every new character / location / artifact must have ≥1 node in its world.nodes at creation.</rule>
    <rule>Every new thread must declare ≥2 named outcomes and open with a threadDelta carrying evidence on at least one outcome (logType "setup").</rule>
  </initialization-floor>

  <thread-deltas hint="Threads are PREDICTION MARKETS over named outcomes.">
    <question-shape>
      <example type="bad" reason="too plain to carry an arc">"Will Bob succeed?"</example>
      <example type="good" register="fiction" shape="binary">"Can Ayesha clear her grandfather's name before the tribunal ends?" → outcomes: ["yes", "no"].</example>
      <example type="good" register="fiction" shape="multi">"Who claims the throne?" → outcomes: ["Stark", "Lannister", "Targaryen", "nobody"].</example>
      <example type="good" register="argument">"Does the proposed mechanism explain anomalies the prior model cannot?" → outcomes: ["yes", "no"].</example>
      <note>Picaresque / ironic / open-inquiry forms may use a deliberately simple recurring question as their spine — register must earn it.</note>
    </question-shape>

    <fields>
      <field name="updates[]">per-outcome { outcome: string, evidence: number in [-4, +4] — decimals encouraged (e.g. +1.5, +2.7, −0.8); rounded to one decimal place }.</field>
      <field name="logType">one of { pulse, transition, setup, escalation, payoff, twist, callback, resistance, stall }.</field>
      <field name="volumeDelta">integer — change to attention on this thread (typically 0..+2, negative only when deliberately quieted).</field>
      <field name="rationale">ONE prose sentence grounded in the scene. Describe what HAPPENED in natural language — what the reader witnesses and what it implies for the thread's question. DO NOT quote outcome identifiers (they're technical names like "yes_with_great_cost"), DO NOT reference logType or evidence numbers. Write as if annotating a novel's margin, not a database column.</field>
      <field name="addOutcomes[]" rare="true" optional="true">names of NEW outcomes to add to the market mid-story.</field>
    </fields>

    <outcome-expansion hint="Reserved for scenes that GENUINELY open new possibilities.">
      <when>A reveal introduces a third contender, a new faction enters the field, a character realises an option no one had considered.</when>
      <mechanic>New outcomes join the market at neutral prior (logit=0 — equally likely as the current best outcome before this scene's evidence). Then same-scene evidence shifts the new outcome's position.</mechanic>
      <example type="do">"A third cousin's claim to the throne surfaces during the audit" → addOutcomes: ["cousin"]; updates: [{outcome:"cousin", evidence:+2}].</example>
      <example type="dont">"Harry suspects Snape might be the thief" — that's evidence on an existing outcome, not a new one.</example>
      <discipline>Most arcs open 0 outcomes. Arcs that open 1 do so once or twice total. Opening 2+ in one scene is a sign of overloading the market.</discipline>
    </outcome-expansion>

    <evidence-scale hint="Real number, decimals allowed for calibrated partial nudges; matches game-theory stake deltas.">
      <band magnitude="±0..1">pulse / minor shift.</band>
      <band magnitude="±1..2">setup / resistance.</band>
      <band magnitude="±2..3">escalation / twist.</band>
      <band magnitude="±3..4">payoff / reversal (closes the market).</band>
      <discipline>Most scenes emit |evidence| ≤ 2. +4 is reserved for THE biggest moment so far on a thread — check the trajectory.</discipline>
      <discipline>logType must AGREE with evidence magnitude (setup at +0..+1, escalation at +2..+3, payoff at +3..+4, twist at ±3 against prior trend).</discipline>
      <discipline name="evidence-vs-volume">Does the scene shift BELIEF (evidence) or ATTENTION (volumeDelta)? A pulse has volumeDelta=+1 and evidence=0.</discipline>
      <discipline name="correlation">One reveal can move multiple threads; each rationale cites its specific driving sentence.</discipline>
    </evidence-scale>

    <multi-outcome-updates hint="When a market has 3+ outcomes, a single scene often moves several of them in different directions and by different magnitudes. Treat each outcome as a separate lever, weighted by how much the scene's evidence actually implies about that outcome.">
      <pattern name="reveal-suppresses-rivals">A decisive reveal for one outcome usually SUPPRESSES its rivals. Example on {Stark, Lannister, Targaryen}: news that a Stark heir was secretly raised = updates: [{Stark, +3}, {Lannister, −1}, {Targaryen, 0}]. The rival that was actively contending gets squeezed; the unrelated option barely moves.</pattern>
      <pattern name="lockstep-spectrum">Related outcomes on a spectrum can move in LOCKSTEP at different magnitudes. Example on {fails, partial, succeeds, triumphant}: protagonist clears the first test but reveals a weakness → updates: [{partial, +2}, {succeeds, +1}, {triumphant, −1}, {fails, −1}]. Partial rises most; clean success rises a little; the ceiling and the floor both shrink.</pattern>
      <pattern name="absence-vs-evidence-against">Absence of evidence on an outcome is not the same as evidence against it. If the scene simply doesn't touch an option, omit it from updates (no entry ≠ evidence=0 — pass-through preserves its relative standing when the rival moves).</pattern>
      <pattern name="zero-sum-discipline">Treat evidence as a zero-sum pull within the market only when the scene genuinely forces a trade-off. Otherwise let shifts be independent; softmax renormalises anyway.</pattern>
      <two-outcome-markets>Mirror evidence by default (e.g. {yes+2, no-1} for a clear but not decisive shift). Pure one-sided nudges (e.g. {yes+1} alone) imply the rival is unchanged — legitimate for ambient reinforcement.</two-outcome-markets>
    </multi-outcome-updates>

    <closure>Market auto-closes when margin ≥ τ_effective AND logType is payoff/twist with |evidence| ≥ 3. τ_effective scales with accumulated volume — high-attention threads demand proportionally more decisive resolutions.</closure>
    <abandonment>Volume decays per scene untouched; thread leaves focus when volume &lt; floor. Reopen via volumeDelta ≥ 2.</abandonment>
    <density>2–6 threads per scene. Focus-window threads have priority. Don't emit zero-evidence zero-volume entries.</density>
  </thread-deltas>

  <world-deltas hint="Entity's PRESENT-TENSE facts.">
    <by-entity-type>
      <type kind="characters">new behaviours, beliefs, capabilities, states, wounds, goals, secrets.</type>
      <type kind="locations">new history, properties, dangers, rules, atmospheric facts.</type>
      <type kind="artifacts">new capabilities, limitations, states demonstrated through use.</type>
    </by-entity-type>
    <example type="good" register="fiction">"Harry has a lightning-bolt scar from surviving the killing curse."</example>
    <example type="good" register="non-fiction">"The force grading formula is calibrated so published works score 85-92 on a 100-point curve."</example>
    <example type="bad" reason="events belong in thread log">"Harry discovered..." / "The authors realised..."</example>
    <rule name="node-order">Order matters (auto-chains).</rule>

    <tag-richly hint="Entities are SPONGES: rich prose supports many nodes per entity; sparse prose supports few. No per-entity cap.">
      <density-guide>A reflective POV character alone often carries 4-6 nodes (belief/state/goal/capability/secret shifts). A location re-entered in a dense scene carries 2-3 new properties. A quiet pass-through carries one. UNDER-tagging a rich summary is the failure.</density-guide>
      <discipline name="agency-over-orbit">"Meng Song suspects Fang Yuan is hiding something" (agency) beats "Meng Song is impressed" (orbit).</discipline>
      <discipline name="off-screen">Off-screen deltas are valid when news / rumour / faction intelligence would realistically reach them. Across an arc the cast evolves alongside the POV, not waiting on them.</discipline>
      <discipline name="no-padding">Participants who were unchanged get nothing. Don't pad.</discipline>
    </tag-richly>
  </world-deltas>

  <system-deltas hint="How the WORLD / DOMAIN WORKS. Rules, principles, mechanisms — not things, not events.">
    <example type="good" register="fiction">"Magic near underage wizards is attributed to them regardless of caster."</example>
    <example type="good" register="fiction">"Cross-check protocols in major sects require concurrence from three elders to ratify a hostile identification."</example>
    <example type="good" register="non-fiction">"Delivery is computed as the equal-weighted mean of z-score-normalised force values."</example>
    <example type="bad" reason="too vague">"Magic"</example>
    <example type="bad" reason="specific not general">"Fang Yuan's plan"</example>
    <example type="bad" reason="event not rule">"They met in the chamber"</example>
    <directive>NAME the implicit mechanic — a cross-check bypassed surfaces the cross-check structure; an artifact humming surfaces its behaviour class; a deduction surfaces the pattern detected. Never emit \`systemDeltas: {}\`.</directive>
    <types>principle | system | concept | tension | constraint.</types>
    <edges>enables | governs | opposes | extends | constrains.</edges>
  </system-deltas>

  <relationship-deltas>SHIFTS only. valenceDelta: ±0.1 subtle, ±0.3 meaningful, ±0.5 dramatic.</relationship-deltas>
  <events>2-4 word tags, 2-4 per scene.</events>
  <artifact-usages>When an artifact / tool delivers utility. Every usage has a wielder.</artifact-usages>
  <ownership-deltas>Artifact changes hands.</ownership-deltas>
  <character-movements>Physical location changes only.</character-movements>
</deltas>`;
