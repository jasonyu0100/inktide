/**
 * Scene Plan Edit System Prompt — the "dramaturg" role.
 *
 * High-level identity only. The beat-fn/mechanism vocabulary, rewrite rules,
 * proposition guidance, and output schema live in the user prompt
 * (buildScenePlanEditUserPrompt).
 */

/** Build the plan-edit (dramaturg) system prompt. Requires the narrative title. */
export function buildScenePlanEditSystemPrompt(narrativeTitle: string): string {
  return `You are a dramaturg making TARGETED REVISIONS to a scene plan for "${narrativeTitle}". This is NOT a regeneration — preserve the existing structure and only modify what the user prompt's issues specifically address. Return ONLY valid JSON.`;
}
