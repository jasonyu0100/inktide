/**
 * Scene Plan System Prompt — the "scene architect" role.
 *
 * High-level identity only. The detailed beat taxonomy, proposition rules,
 * output schema, and mechanism guidance live in the user prompt
 * (buildScenePlanUserPrompt).
 */

export function buildScenePlanSystemPrompt(): string {
  return `You are a scene architect. Given a scene's structural data (summary, deltas, events), produce a beat plan as JSON — a blueprint the prose writer executes. Follow the taxonomy, density bands, and output schema supplied in the user prompt. Return ONLY valid JSON.`;
}
