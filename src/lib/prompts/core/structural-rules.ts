/**
 * Structural Rules Prompt — XML block injected into user prompts.
 *
 * Combines: anti-repetition, thread collision, character arc discipline, pacing density.
 * This is the ONE place these rules are stated — no duplication elsewhere.
 */

export const PROMPT_STRUCTURAL_RULES = `<structural-rules hint="Defaults that protect against filler. 'Scene' is the system's unit of composition; the source's own register fills in what a scene contains — a dramatic exchange, an argued section, a wargame turn, a model step, an after-action note. Rules apply across all three first-class registers (fiction, non-fiction, simulation); they are defaults, not laws, and a declared form or prose profile can override them explicitly.">

  <anti-repetition hint="Default — overridden by declared recurrence forms.">
    <rule name="no-event-twice">Material the prose has already established should not recur without purpose.</rule>
    <rule name="no-structure-repeat">A scene shape ("A asserts, B qualifies" / "A confronts B, B deflects" / "rule fires, state updates, observer notes") should not recur by inertia.</rule>
    <rule name="every-scene-does-something-new">Each scene must move something — a committed state change, a sharpened question, a deepened image, an inverted recurrence, a rule-state shift, a parameter crossing. The source's register decides which.</rule>
    <rule name="confirmation-scenes-commit">Confirmation scenes should carry an irreversible element (a decision committed to, a claim formally adopted, a method locked in, a threshold crossed under the rule set) unless the declared form is one that sits with its material.</rule>
    <exception hint="Deliberate recurrence is a named device.">When the prose profile declares refrain, litany, call-and-response, frame-tale recurrence, ritual return, training-arc repetition, Oulipo-style constrained repetition, or simulation-native recurrence (turn structure, log cadence, regular model step), recurrence of shape or event is the form. The variation within the recurrence should be meaningful: a new detail, a shifted POV, an inverted outcome, an intensified stake, a rule-state shift.</exception>
  </anti-repetition>

  <thread-collision hint="Default density — can be tuned.">
    <rule name="density">Aim for roughly HALF your scenes advancing 2+ threads simultaneously. This is the baseline density.</rule>
    <rule name="ordinary-collision">Entities share locations, alliances, resources, datasets, or argument space — collision is the ordinary consequence.</rule>
    <rule name="cost">Something should go wrong or resist that the controlling agent — whoever the work has committed to as its driving reasoner — did not choose.</rule>
    <exception>Meditative, ambient, braided, and single-thread forms may run one thread per scene by design. If the prose profile declares thread density as "sparse" or "single-woven", honour that.</exception>
  </thread-collision>

  <entity-discipline>
    <rule>Entities recurring across 3+ scenes should show visible change — deeper traits, refined positions, evolved methods, shifted stances, new facets surfaced.</rule>
    <rule>Every appearance earns presence with a DIFFERENT move. Observer-only / cited-only entities are cameras, not actors.</rule>
    <rule>At least one plan, hypothesis, or claim per arc must fail or need revision.</rule>
  </entity-discipline>

  <pacing-density>
    <rule name="convergence">Convergence scene: 4-5 events, 3+ deltas. Quiet / synthesis / reflective scene: 1 event, 0-1 deltas.</rule>
    <rule name="one-per-transition">ONE scene per status transition. A thread that appears 3x without transition and without a declared recurrence device is a candidate for merging or advancing.</rule>
    <rule name="closing-sharpens">Scenes that close in retreat, recalculation, or further-questions should carry something forward — the closing question, image, or constraint should be sharper, narrower, or differently angled than the one the scene opened with.</rule>
  </pacing-density>

  <scan>Two scenes with the same action type on the same thread and no declared recurrence device are candidates for merging or escalation.</scan>
</structural-rules>`;
