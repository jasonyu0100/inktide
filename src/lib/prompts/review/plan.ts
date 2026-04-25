/**
 * Plan Quality Review Prompt
 *
 * Continuity review of beat plans — verifies beats are internally consistent,
 * cross-scene continuous, and deliver the declared deltas.
 */

export const PLAN_REVIEW_SYSTEM =
  'You are a continuity editor reviewing scene beat plans. For each scene check beat-to-delta alignment, cross-plan continuity, internal beat logic, character knowledge, and spatial/temporal consistency. Assign verdict ok|edit per scene with precise issue references (cite beat numbers). Return ONLY valid JSON matching the schema in the user prompt.';

export interface PlanReviewPromptParams {
  title: string;
  threadBlock: string;
  charBlock: string;
  sceneCount: number;
  sceneBlocks: string;
  /** Fully-formatted guidance block, possibly empty (includes leading newline). */
  guidanceBlock: string;
  guidance?: string;
}

export function buildPlanReviewPrompt(p: PlanReviewPromptParams): string {
  return `<inputs>
  <branch title="${p.title}" />
${p.guidanceBlock ? `  <guidance>\n${p.guidanceBlock}\n  </guidance>` : ''}
  <threads>
${p.threadBlock}
  </threads>
  <character-knowledge>
${p.charBlock || '(none tracked yet)'}
  </character-knowledge>
  <scenes-with-beat-plans count="${p.sceneCount}">
${p.sceneBlocks}
  </scenes-with-beat-plans>
</inputs>

<instructions>
  <step name="check" hint="For each scene, walk these five checks.">
    <check name="beat-to-delta-alignment">Do the beats actually show what the declared deltas claim? If a thread delta says T-03 escalates, which specific beat delivers that escalation? If no beat does, flag it.</check>
    <check name="cross-plan-continuity">Does this plan's opening beats follow logically from the previous plan's closing beats? Character positions, emotional states, knowledge, injuries.</check>
    <check name="internal-beat-logic">Do beats within the plan follow causally? Does beat 5 depend on something beat 3 established?</check>
    <check name="character-knowledge">Does any beat have a character act on information they haven't learned yet in prior scenes or earlier beats?</check>
    <check name="spatial-temporal">Are characters where they should be? Can all beats plausibly occur in one scene?</check>
  </step>
  <step name="assign-verdict">
    <verdict name="ok">Beats are consistent, deltas are earned by specific beats.</verdict>
    <verdict name="edit">Issues found. Each issue must reference a specific beat number and what's wrong.</verdict>
  </step>
  <step name="precision">Be precise: "Beat 4 declares Fang Yuan recognises the seal pattern, but no prior beat or scene establishes he has seen this pattern before" — not "continuity error."</step>
${p.guidance?.trim() ? `  <step name="author-guidance-reminder">The author asked you to address: "${p.guidance.trim()}".</step>` : ''}
</instructions>

<output-format>
Return JSON:
{
  "overall": "2-3 paragraph analysis focused on beat quality and delta alignment.",
  "sceneEvals": [
    { "sceneId": "S-001", "verdict": "ok|edit", "issues": ["Beat N: specific issue"] }
  ],
  "patterns": ["recurring issue across multiple plans"]
}
Every scene with a plan must appear.
</output-format>`;
}
