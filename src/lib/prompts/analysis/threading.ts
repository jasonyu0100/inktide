/**
 * Thread Dependency Analysis Prompt
 *
 * Given a canonical (post-merge) list of threads, identifies which threads
 * causally depend on which others.
 */

export const THREADING_SYSTEM =
  'You are a narrative structure analyst. Identify causal dependencies between story threads. Refer to threads by numeric ID — do not repeat descriptions in the output. Return only valid JSON.';

export function buildThreadingPrompt(canonicalThreads: string[]): string {
  return `<inputs>
  <canonical-threads hint="Post-merge, deduplicated. Each prefixed with a numeric ID.">
${canonicalThreads.map((d, i) => `    <thread id="${i + 1}">"${d}"</thread>`).join('\n')}
  </canonical-threads>
</inputs>

<task>Identify which threads CAUSALLY DEPEND on other threads.</task>

<dependency-criteria hint="A depends on B means:">
  <criterion>A's resolution is affected by B's trajectory.</criterion>
  <criterion>B must progress or resolve for A to advance.</criterion>
  <criterion>They converge at critical story moments.</criterion>
</dependency-criteria>

<rules>
  <rule>Use ONLY the numeric IDs from the list above — do not invent IDs or emit descriptions.</rule>
  <rule>A thread can depend on multiple others; dependencies can be mutual (both {"3": [1]} and {"1": [3]} are valid if justified).</rule>
  <rule>Omit threads with no dependencies — don't emit empty arrays.</rule>
  <rule name="not-dependencies">Threads that are merely thematic, or share characters without causal interaction.</rule>
  <rule>Focus on structural narrative connections, not surface-level similarities.</rule>
  <rule>If no dependencies exist, return { "threadDependencies": {} }.</rule>
</rules>

<output-format>
Return JSON. Use numeric IDs (as they appear in the list above) for both keys and array entries. Do not repeat thread descriptions in the output.
{
  "threadDependencies": {
    "<threadId>": [<dependentId>, <dependentId>, ...]
  }
}
Example: if thread 3 depends on threads 1 and 7, emit {"3": [1, 7]}.
</output-format>`;
}
