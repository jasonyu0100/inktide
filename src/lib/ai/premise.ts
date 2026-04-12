/**
 * Premise suggestion for the creation wizard.
 * Generates random story ideas to help users get started.
 */

import { callGenerate, SYSTEM_PROMPT } from './api';
import { parseJson } from './json';

/**
 * Suggest a random narrative premise with title.
 * Used by the creation wizard to inspire story ideas.
 */
export async function suggestPremise(): Promise<{ title?: string; premise?: string }> {
  const prompt = `Generate an original, compelling story premise. Be specific and evocative — not generic.

Return JSON:
{
  "title": "A memorable title (2-5 words)",
  "premise": "A compelling setup in 2-3 sentences. Include: a specific protagonist with a flaw or tension, an inciting situation that demands action, and stakes that make us care. Ground it in a particular time, place, or world. Avoid generic fantasy/sci-fi tropes unless you subvert them."
}

Be original. Draw from any genre, time period, or culture. Surprise me.`;

  const raw = await callGenerate(prompt, SYSTEM_PROMPT, 500, 'suggestPremise');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = parseJson(raw, 'suggestPremise') as any;

  return {
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    premise: typeof parsed.premise === 'string' ? parsed.premise : undefined,
  };
}
