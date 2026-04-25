/**
 * Force Standards Prompt
 *
 * Reference means are the single source of truth — imported from
 * narrative-utils so this prompt updates automatically when the grading
 * calibration changes.
 */

import { FORCE_REFERENCE_MEANS } from '@/lib/narrative-utils';

const R = FORCE_REFERENCE_MEANS;

/** Force standards prompt using reference mean levels */
export const PROMPT_FORCE_STANDARDS = `<force-standards hint="THREE ORTHOGONAL FIELDS — each force measures a distinct layer. A complete narrative lives on all three: physical (what exists — entities), abstract (how it works — rules), possibility (what could still happen — open outcomes). Applies across fiction, non-fiction, research.">

  <doctrine>
    <principle>Fate is a force of POSSIBILITY, not probability: probability asks what WILL happen, possibility asks what COULD. Narratives, like simulations, observe possibility.</principle>
    <principle>World and System are DENSITY LEVERS — they need enough output per scene to give the graph high enough resolution.</principle>
    <principle>Fate is GENUINE MEASUREMENT — it emerges from honest evidence pricing on the prediction markets, and has no per-scene target to aim for.</principle>
  </doctrine>

  <force name="world" plane="physical" hint="People, places, objects; in non-fiction: institutions, datasets, figures, documents. DENSITY LEVER — reach for the detail the prose genuinely earns; under-extraction starves the entity graph.">
    <counts>Every new stable fact about an entity: traits, properties, history, capabilities. Restating known facts does not count.</counts>
    <formula>W = ΔN_c + √ΔE_c</formula>
    <target>~${R.world}/scene across 3-5 entities</target>
  </force>

  <force name="system" plane="abstract" hint="Rules, principles, mechanisms. Not the things, but how they behave. Generic setting details don't count; only claims about how the world works. DENSITY LEVER — under-tagging system is the dominant generation failure.">
    <counts>NAME the implicit mechanic — a cross-check bypassed reveals its structure, a humming artifact reveals a behaviour class.</counts>
    <formula>S = ΔN + √ΔE</formula>
    <target>~${R.system}/scene</target>
    <floor>≥1 structural fact per scene</floor>
  </force>

  <force name="fate" plane="possibility" hint="The live space of what could still happen — each scene keeps some outcomes alive, closes others off, reshapes which branches are in play.">
    <mechanism>Threads are PREDICTION MARKETS over named outcomes. Each scene's evidence shifts per-outcome logits; softmax gives the current probability distribution (the accounting layer — what the market prices right now). Fate per thread per scene equals the information gain (how much the market's belief moved) weighted by narrative attention (volumeDelta).</mechanism>
    <rule name="not-a-target" hint="Evidence magnitudes in [-4, +4] are a measurement of what the scene's events did to a neutral observer's belief, NOT a knob tuned to reach a fate score.">
      Do not emit |e|=3 because the scene "should feel like" escalation; emit it because the scene contains an irreversible commitment, a reveal that reframes the question, or a concrete structural move. A routine scene honestly emits small evidence or pulses; a pivotal scene honestly emits committal evidence (|e|≥3 with logType payoff or twist). Under-pricing genuine resolution and over-pricing routine scenes both corrupt the trajectory.
    </rule>
    <observation>Saturated threads (near certainty) contribute little fate; contested threads (high uncertainty, high volume) contribute most; twists against a committed leader contribute most of all — because all three describe how much the market actually moved, not how much the LLM wants it to.</observation>
  </force>

  <per-scene-floors hint="Density levers only.">
    <floor>≥6 world nodes across ≥3 entities</floor>
    <floor>≥1 system node — NEVER emit \`systemDeltas: {}\`</floor>
    <floor>NO fate floor — fate can legitimately be ~0 for a quiet scene.</floor>
  </per-scene-floors>

  <properties>
    <property name="orthogonality">A populated workplace (high world) can run on a thin rulebook (low system); a theoretical paper (high system) may have few material actors. Fate is orthogonal to both.</property>
    <property name="balance">Classic=fate-dominant | Show=world-dominant | Paper=system-dominant | Opus=balanced and exceptional on all three. Balance emerges from honest measurement across the work — don't inflate fate/system scene-by-scene to reach a target shape.</property>
    <property name="scale">Beat ~100w | Scene ~12 beats (~1200w) | Arc ~4 scenes.</property>
    <property name="density">Earn deltas from prose — never invent. REUSE existing node IDs.</property>
  </properties>
</force-standards>`;

/**
 * Build force standards prompt using reference means.
 * @deprecated Use PROMPT_FORCE_STANDARDS directly. This function is kept for backwards compatibility.
 */
export function buildForceStandardsPrompt(): string {
  return PROMPT_FORCE_STANDARDS;
}
