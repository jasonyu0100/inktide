/**
 * Beat Functions & Mechanisms Prompt — shared text block (used in both
 * system and user prompt contexts; kept plain text so it works in either).
 *
 * Single source of truth for beat classification — used by plan generation,
 * reverse engineering, and prose generation.
 */

export const PROMPT_BEAT_TAXONOMY = `BEAT TAXONOMY (register-neutral). In fiction a beat is a story move; in essay/reportage/research it is a move in the argument or inquiry. The same 10 functions + 8 mechanisms apply — only the substance shifts.

FUNCTIONS (10) — what the beat does:
- breathe — atmosphere, sensory grounding, scene establishment (in essay: setting the stage, framing).
- inform — someone learns something NOW (a character, a reader, or — in argument — the reader learns a fact/result).
- advance — forward motion: plot moves, goals pursued, claim pressed, evidence accumulates.
- bond — relationship shifts (between characters, or between author and reader, or between positions).
- turn — revelation, reversal, interruption, counterargument.
- reveal — underlying nature exposed through action/choice (character, system, data, source).
- shift — power dynamic inverts (between characters, between theories, between stakeholders).
- expand — new rule, system, geography, mechanism, or citation introduced.
- foreshadow — plants information for LATER payoff (a seed that pays off as callback or as prediction tested).
- resolve — tension releases; question answered; claim settled; finding stated.

MECHANISMS (8) — how prose delivers (read the register-appropriate sense):
- dialogue — quoted speech (fiction); quoted source / interview excerpt / reported speech (non-fiction).
- thought — POV internal monologue (fiction); authorial reasoning / evidentiary inference (non-fiction).
- action — physical movement, gesture (fiction); demonstrated operation, procedure, worked step (non-fiction).
- environment — setting, weather, sounds (fiction); scene-setting description of field, lab, archive, community.
- narration — narrator voice, exposition, time compression, signposting, synthesis.
- memory — flashback triggered by association (fiction); historical precedent, prior literature, case (non-fiction).
- document — embedded text (letter, sign, citation, table caption, figure, footnote, data excerpt).
- comic — humor, irony, absurdity, bathos, deliberate understatement.

EDGE CASES:
- Overhearing → environment.
- Thinking / reasoning internally → thought.
- Describing speech or paraphrasing a source → narration.
- Direct quotation of a source → dialogue or document (pick the closer fit).`;
