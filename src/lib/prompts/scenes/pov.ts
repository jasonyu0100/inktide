/**
 * POV Discipline Prompt — XML block injected into user prompts.
 */

export const PROMPT_POV = `<pov-discipline hint="Applies to any register that carries a named perspective — fiction, memoir, research logs, essay, reportage.">
  <rule name="streaks">2-4 consecutive scenes before switching perspective. Prefer AAABBA or AAABBCCC.</rule>
  <rule name="arc-anchor">Within an arc, anchor on 1-2 POV entities — the *narrative voice*. In fiction this is typically a protagonist; in research or essay it is the lead author or cited authority; in oral / collective forms it may be a chorus or tradition-bearer. Switch only when a different perspective unlocks something.</rule>
  <rule name="single-pov-strongest">Single POV for an entire arc is often strongest.</rule>
  <rule name="implicit-author">In purely analytical or expository work where there is no named observer, treat POV as the implicit authorial voice — the povId is the document's lead author if one exists, otherwise the canonical anchor entity. Do not manufacture a protagonist where the source has none; conversely, do not flatten a multi-voiced source (dialogic, polyphonic, call-and-response) into a single narrator.</rule>
</pov-discipline>`;
