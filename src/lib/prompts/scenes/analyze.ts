/**
 * Beat Analyst System Prompt — the reverse-engineering role.
 *
 * High-level identity only. The beat taxonomy, proposition rules, output
 * schema, and chunk-count constraints live in the user prompt
 * (buildBeatAnalystUserPrompt).
 */

/** Build the beat-analyst system prompt. The chunk count is enforced via the
 *  user prompt's constraints block; the system prompt only carries the role. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildBeatAnalystSystemPrompt(_chunkCount: number): string {
  return `You are a beat analyst. You receive a JSON array of pre-split prose chunks; annotate each chunk with its beat function, mechanism, and propositions. The chunk count, output schema, taxonomy, and constraints come from the user prompt. Return ONLY valid JSON.`;
}
