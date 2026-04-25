/**
 * Beat Functions & Mechanisms Prompt
 *
 * Single source of truth for beat classification — used by plan generation,
 * reverse engineering, and prose generation.
 */

export const PROMPT_BEAT_TAXONOMY = `<beat-taxonomy hint="Register-neutral. In fiction a beat is a story move; in essay/reportage/research it is a move in the argument or inquiry. The same 10 functions + 8 mechanisms apply — only the substance shifts.">

  <functions count="10" hint="What the beat does.">
    <function name="breathe">Atmosphere, sensory grounding, scene establishment (in essay: setting the stage, framing).</function>
    <function name="inform">Someone learns something NOW (a character, a reader, or — in argument — the reader learns a fact/result).</function>
    <function name="advance">Forward motion: plot moves, goals pursued, claim pressed, evidence accumulates.</function>
    <function name="bond">Relationship shifts (between characters, or between author and reader, or between positions).</function>
    <function name="turn">Revelation, reversal, interruption, counterargument.</function>
    <function name="reveal">Underlying nature exposed through action/choice (character, system, data, source).</function>
    <function name="shift">Power dynamic inverts (between characters, between theories, between stakeholders).</function>
    <function name="expand">New rule, system, geography, mechanism, or citation introduced.</function>
    <function name="foreshadow">Plants information for LATER payoff (a seed that pays off as callback or as prediction tested).</function>
    <function name="resolve">Tension releases; question answered; claim settled; finding stated.</function>
  </functions>

  <mechanisms count="8" hint="How prose delivers. Read the register-appropriate sense.">
    <mechanism name="dialogue">Quoted speech (fiction); quoted source / interview excerpt / reported speech (non-fiction).</mechanism>
    <mechanism name="thought">POV internal monologue (fiction); authorial reasoning / evidentiary inference (non-fiction).</mechanism>
    <mechanism name="action">Physical movement, gesture (fiction); demonstrated operation, procedure, worked step (non-fiction).</mechanism>
    <mechanism name="environment">Setting, weather, sounds (fiction); scene-setting description of field, lab, archive, community.</mechanism>
    <mechanism name="narration">Narrator voice, exposition, time compression, signposting, synthesis.</mechanism>
    <mechanism name="memory">Flashback triggered by association (fiction); historical precedent, prior literature, case (non-fiction).</mechanism>
    <mechanism name="document">Embedded text (letter, sign, citation, table caption, figure, footnote, data excerpt).</mechanism>
    <mechanism name="comic">Humor, irony, absurdity, bathos, deliberate understatement.</mechanism>
  </mechanisms>

  <edge-cases>
    <case>Overhearing → environment.</case>
    <case>Thinking / reasoning internally → thought.</case>
    <case>Describing speech or paraphrasing a source → narration.</case>
    <case>Direct quotation of a source → dialogue or document (pick the closer fit).</case>
  </edge-cases>
</beat-taxonomy>`;
