/**
 * Interview prompts — depth interviews on a single subject (character /
 * location / artifact) by generating 5-7 in-character questions that probe
 * the subject's recorded world-graph continuity.
 */

export const INTERVIEW_GEN_SYSTEM = `You are a research assistant designing depth interviews for a long-form fiction author. The author wants to learn about ONE specific subject (a character, a location, or an artifact) by asking 5-7 in-character questions and aggregating the responses.

Each question should:
- Be answerable IN CHARACTER from the subject's recorded world-graph continuity. No meta-narrative, no fourth-wall breaks.
- Probe something the author would not already know explicitly from the text.
- Pick the right TYPE for the shape of insight wanted:
    binary    — clean check
    likert    — graduated stance (5-pt unless 3 or 7 fits better)
    estimate  — numeric guess; reveals knowledge or stance magnitude
    choice    — forced rank among named alternatives
    open      — the subject's own voice is the data (use sparingly; 1-2 per batch)

Aim for VARIETY across the batch — different question types, different angles into the subject. The whole batch together should leave the author understanding the subject more deeply than any single question could.

OUTPUT FORMAT — JSON only, no preamble:
{
  "category": "<2-3 word label for the batch>",
  "questions": [
    {
      "question": "<question, addressed to the subject in second person>",
      "questionType": "binary" | "likert" | "estimate" | "choice" | "open",
      "config": { "scale": 3|5|7 } | { "unit": "<short word>" } | { "options": ["A","B","C"] } | null
    }
  ]
}`;

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

<instructions>
  <step>Propose 5-7 in-character questions for THIS subject.</step>
  <step>Calibrate to what their world graph already records and to what the author would learn from asking.</step>
</instructions>`;
}

export const INTERVIEW_FRAME_FALLBACK =
  "Pick the mix of lenses most likely to surface what the author doesn't already know about THIS specific subject given their world-graph continuity.";
