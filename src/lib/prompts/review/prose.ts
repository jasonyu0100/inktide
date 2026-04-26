/**
 * Prose Quality Review Prompt
 *
 * Evaluates written prose for voice consistency, craft, pacing,
 * continuity, repetition, and prose-profile compliance.
 */

export const PROSE_REVIEW_SYSTEM =
  'You are a prose editor evaluating the actual written prose of a serialized narrative. Score on voice consistency, craft, pacing, continuity, repetition, and prose-profile compliance. Quote specific lines and assign verdict ok|edit per scene with concrete actionable issues — never vague. Return ONLY valid JSON matching the schema in the user prompt.';

export interface ProseReviewPromptParams {
  title: string;
  sceneCount: number;
  sceneBlocks: string;
  /** Fully-formatted prose-profile block, possibly empty. */
  profileBlock: string;
  /** Fully-formatted guidance block, possibly empty (includes leading newline). */
  guidanceBlock: string;
  guidance?: string;
}

export function buildProseReviewPrompt(p: ProseReviewPromptParams): string {
  return `<inputs>
  <branch title="${p.title}" />
${p.guidanceBlock ? `  <guidance>\n${p.guidanceBlock}\n  </guidance>` : ''}
${p.profileBlock ? `  <prose-profile>\n${p.profileBlock}\n  </prose-profile>` : ''}
  <scenes-with-prose count="${p.sceneCount}">
${p.sceneBlocks}
  </scenes-with-prose>
</inputs>

<instructions>
  <step name="evaluate" hint="Score on six dimensions before assigning verdicts.">
    <dimension name="voice-consistency">Does the prose match the prose profile? Is the register, rhythm, and interiority consistent?</dimension>
    <dimension name="craft">Sentence quality, word choice, show-don't-tell, dialogue naturalism, sensory grounding.</dimension>
    <dimension name="pacing">Within-scene pacing. Are beats rushed or drawn out? Does the prose breathe?</dimension>
    <dimension name="continuity">Does the prose contradict established facts, character positions, or knowledge?</dimension>
    <dimension name="repetition">Repeated phrases, images, sentence structures, or verbal tics across scenes.</dimension>
    <dimension name="profile-compliance">If a prose profile is provided, does the prose follow its rules?</dimension>
  </step>
  <step name="assign-verdict">
    <verdict name="ok">Prose is strong, no changes needed.</verdict>
    <verdict name="edit">Prose needs revision. List specific, actionable issues.</verdict>
  </step>
  <step name="precision">Be specific in your issues. Not "dialogue feels off" but "Fang Yuan speaks in elaborate metaphors in lines 3-5, violating the 'plain, forgettable language' rule."</step>
${p.guidance?.trim() ? `  <step name="author-guidance-reminder">The author specifically asked you to address: "${p.guidance.trim()}". Your overall critique and scene verdicts MUST reflect this.</step>` : ''}
</instructions>

<output-format>
Return JSON:
{
  "overall": "2-4 paragraph prose quality critique. Name specific scenes and quote specific lines.",
  "sceneEvals": [
    { "sceneId": "S-001", "verdict": "ok|edit", "issues": ["specific issue 1", "specific issue 2"] }
  ],
  "patterns": ["recurring prose issue 1", "recurring prose issue 2"]
}
Every scene with prose must appear in sceneEvals. Use the exact scene IDs.
</output-format>`;
}
