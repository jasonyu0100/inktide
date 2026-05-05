/**
 * Interview prompts — depth interviews on a single subject (character /
 * location / artifact) by generating 5-7 in-character questions that probe
 * the subject's recorded world-graph continuity.
 */

/** High-level identity only. Question types, output format, and lens
 *  guidance live in the user prompt. */
export const INTERVIEW_GEN_SYSTEM =
  `You are a research assistant designing depth interviews for the author of a long-form work. The author wants to learn about ONE specific subject by asking 5-7 in-character questions and aggregating the responses. Subjects are entities — a character, a location, or an artifact — across any register (fiction, non-fiction, simulation). In simulation register, subjects are often agents responding under their decision rules (so answers are rule-constrained), locations carrying their scenario role (terrain, jurisdiction, modelled region), or artifacts carrying their parameter values and modelled effects. Follow the question-type guidance, lens, and output format supplied in the user prompt. Return ONLY the JSON requested.`;

export function buildInterviewUserPrompt(args: {
  narrativeContext: string;
  subjectBlock: string;
  category: string | undefined;
  categoryGuidance: string;
}): string {
  const { narrativeContext, subjectBlock, category, categoryGuidance } = args;
  return `<inputs>
  <narrative-continuity>
${narrativeContext}
  </narrative-continuity>
  <subject>
${subjectBlock}
  </subject>
  <interview-lens type="${category ?? 'open'}">${categoryGuidance}</interview-lens>
</inputs>

<question-discipline>
  <criterion>Be answerable IN CHARACTER from the subject's recorded world-graph continuity. No meta-narrative, no fourth-wall breaks. In simulation register the subject answers under its decision rules — questions can probe the rule itself ("under what condition would you commit your reserve?", "which parameter dominates your decision when supply drops below threshold?") and answers will be rule-constrained.</criterion>
  <criterion>Probe something the author would not already know explicitly from the text.</criterion>
  <criterion name="variety">Aim for VARIETY across the batch — different question types, different angles. The whole batch should leave the author understanding the subject more deeply than any single question could.</criterion>
</question-discipline>

<question-types hint="Pick the right TYPE for the shape of insight wanted.">
  <type name="binary">Clean check.</type>
  <type name="likert">Graduated stance (5-pt unless 3 or 7 fits better).</type>
  <type name="estimate">Numeric guess; reveals knowledge or stance magnitude.</type>
  <type name="choice">Forced rank among named alternatives.</type>
  <type name="open">The subject's own voice is the data — use sparingly; 1-2 per batch.</type>
</question-types>

<instructions>
  <step>Propose 5-7 in-character questions for THIS subject.</step>
  <step>Calibrate to what their world graph already records and to what the author would learn from asking.</step>
</instructions>

<output-format hint="JSON only, no preamble.">
{
  "category": "<2-3 word label for the batch>",
  "questions": [
    {
      "question": "<question, addressed to the subject in second person>",
      "questionType": "binary" | "likert" | "estimate" | "choice" | "open",
      "config": { "scale": 3|5|7 } | { "unit": "<short word>" } | { "options": ["A","B","C"] } | null
    }
  ]
}
</output-format>`;
}

export const INTERVIEW_FRAME_FALLBACK =
  "Pick the mix of lenses most likely to surface what the author doesn't already know about THIS specific subject given their world-graph continuity.";
