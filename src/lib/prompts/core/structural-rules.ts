/**
 * Structural Rules Prompt — XML block injected into user prompts.
 *
 * Combines: anti-repetition, thread collision, character arc discipline, pacing density.
 * This is the ONE place these rules are stated — no duplication elsewhere.
 */

export const PROMPT_STRUCTURAL_RULES = `<structural-rules hint="Defaults that protect against filler. Apply across registers: fiction, memoir, essay, reportage, research. 'Scene' is the system's internal unit regardless of register. Rules are defaults, not laws — a declared form or prose profile can override them explicitly.">

  <anti-repetition hint="Default — overridden by declared recurrence forms.">
    <rule name="no-event-twice">What already happened (fiction) or what was already stated/shown (non-fiction) should not recur without purpose.</rule>
    <rule name="no-structure-repeat">A scene shape ("A asserts, B qualifies" / "A confronts B, B deflects") should not recur by inertia.</rule>
    <rule name="every-scene-does-something-new">What "doing" means depends on the declared form — a state change in dramatic registers; a deepened image in lyric; a sharpened question in inquiry; a varied recurrence in refrain-forms.</rule>
    <rule name="confirmation-scenes-commit">Confirmation scenes should carry an irreversible element (a decision committed to, a claim formally adopted, a method locked in) unless the declared form is one that sits with its material.</rule>
    <exception hint="Deliberate recurrence is a named device.">When the prose profile declares refrain, litany, call-and-response, frame-tale recurrence, ritual return, cultivation-ladder repetition, or Oulipo-style constrained repetition, recurrence of shape or event is the form. The variation within the recurrence should be meaningful: a new detail, a shifted POV, an inverted outcome, an intensified stake.</exception>
  </anti-repetition>

  <thread-collision hint="Default density — can be tuned.">
    <rule name="density">Aim for roughly HALF your scenes advancing 2+ threads simultaneously. This is the baseline density.</rule>
    <rule name="ordinary-collision">Entities share locations, alliances, resources, datasets, or argument space — collision is the ordinary consequence.</rule>
    <rule name="cost">Something should go wrong or resist that the controlling agent (protagonist in fiction, author in analysis, narrator in essay) did not choose.</rule>
    <exception>Meditative, ambient, braided-essay, and single-thread-literary forms may run one thread per scene by design. If the prose profile declares thread density as "sparse" or "single-woven", honour that.</exception>
  </thread-collision>

  <entity-discipline>
    <rule>Entities in 3+ scenes should show visible change (characters deepen; ideas refine; methods evolve; institutions shift stance; sources reveal new facets).</rule>
    <rule>Every appearance earns presence with a DIFFERENT move. Observers / cited-only entities are cameras, not actors.</rule>
    <rule>At least one plan / hypothesis / claim per arc must fail or need revision.</rule>
  </entity-discipline>

  <pacing-density>
    <rule name="convergence">Convergence scene: 4-5 events, 3+ deltas. Quiet / synthesis / reflective scene: 1 event, 0-1 deltas.</rule>
    <rule name="one-per-transition">ONE scene per status transition. A thread that appears 3x without transition and without a declared recurrence device is a candidate for merging or advancing.</rule>
    <rule name="closing-sharpens">Scenes that close in retreat / recalculation / further-questions should be carrying something forward — a sharpened question in inquiry, a deepened image in lyric, a new constraint named in essay. If the closing question or image is genuinely sharper, narrower, or differently angled than the one the scene opened with, the scene has done work.</rule>
  </pacing-density>

  <scan>Two scenes with the same action type on the same thread and no declared recurrence device are candidates for merging or escalation.</scan>
</structural-rules>`;
