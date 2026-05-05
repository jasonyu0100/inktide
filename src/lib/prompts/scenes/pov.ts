/**
 * POV Discipline Prompt — XML block injected into user prompts.
 */

export const PROMPT_POV = `<pov-discipline hint="Applies to any register that carries a named perspective.">
  <rule name="streaks">2-4 consecutive scenes before switching perspective. Prefer AAABBA or AAABBCCC.</rule>
  <rule name="arc-anchor">Within an arc, anchor on 1-2 POV entities — the *narrative voice* the source establishes. Switch only when a different perspective unlocks something the anchor cannot reach.</rule>
  <rule name="single-pov-strongest">Single POV for an entire arc is often strongest.</rule>
  <rule name="implicit-author">When the source has no named observer, treat POV as the implicit authorial voice — the canonical anchor entity. Do not manufacture a perspective the source does not establish; conversely, do not flatten a multi-voiced source (dialogic, polyphonic, call-and-response) into a single narrator.</rule>
</pov-discipline>`;
