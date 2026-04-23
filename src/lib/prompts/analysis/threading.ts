/**
 * Thread Dependency Analysis Prompt
 *
 * Given a canonical (post-merge) list of threads, identifies which threads
 * causally depend on which others.
 */

export const THREADING_SYSTEM =
  'You are a narrative structure analyst. Identify causal dependencies between story threads. Refer to threads by numeric ID — do not repeat descriptions in the output. Return only valid JSON.';

export function buildThreadingPrompt(canonicalThreads: string[]): string {
  return `You are analyzing narrative threads to identify causal dependencies.

CANONICAL THREADS (post-merge, deduplicated) — each prefixed with a numeric ID:
${canonicalThreads.map((d, i) => `${i + 1}. "${d}"`).join('\n')}

Identify which threads CAUSALLY DEPEND on other threads. A depends on B means:
- A's resolution is affected by B's trajectory
- B must progress or resolve for A to advance
- They converge at critical story moments

Return JSON. Use numeric IDs (as they appear in the list above) for both keys and array entries. Do not repeat thread descriptions in the output.

{
  "threadDependencies": {
    "<threadId>": [<dependentId>, <dependentId>, ...]
  }
}

Example: if thread 3 depends on threads 1 and 7, emit {"3": [1, 7]}.

RULES:
- Use ONLY the numeric IDs from the list above — do not invent IDs or emit descriptions.
- A thread can depend on multiple others; dependencies can be mutual (both {"3": [1]} and {"1": [3]} are valid if justified).
- Omit threads with no dependencies — don't emit empty arrays.
- NOT dependencies: threads that are merely thematic, or share characters without causal interaction.
- Focus on structural narrative connections, not surface-level similarities.
- If no dependencies exist, return { "threadDependencies": {} }`;
}
