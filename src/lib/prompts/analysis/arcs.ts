/**
 * Arc Grouping Prompt
 *
 * For each arc (a narrative unit of ~4 scenes), name it and emit two metadata
 * fields alongside:
 *   - directionVector — forward-looking intent, single sentence
 *   - worldState — backward-looking compact state snapshot at arc end
 *
 * worldState is domain-adaptive — the corpus may be fiction, a chess game, a
 * poker hand, an academic paper, a stock log. The prompt forces the model to
 * identify the work type first, then emit state in that domain's native form.
 */

import { PROMPT_ARC_STATE_GUIDANCE } from '@/lib/prompts/core/game-state';

export const ARC_GROUPING_SYSTEM =
  'You are a narrative analyst. Name story arcs and emit arc metadata (direction + compact world state) based on scene summaries. Return only a JSON array of objects.';

export interface ArcGroup {
  sceneIndices: number[];
  summaries: string[];
}

export interface ArcGroupingOutput {
  name: string;
  directionVector: string;
  worldState: string;
}

export function buildArcGroupingPrompt(groups: ArcGroup[]): string {
  const block = groups
    .map((g, i) => {
      const first = g.sceneIndices[0] + 1;
      const last = g.sceneIndices[g.sceneIndices.length - 1] + 1;
      const scenes = g.summaries
        .map((s, j) => `  Scene ${g.sceneIndices[j] + 1}: ${s}`)
        .join('\n');
      return `ARC ${i + 1} (scenes ${first}-${last}):\n${scenes}`;
    })
    .join('\n\n');

  return `Name each arc and emit its metadata based on scene summaries. An arc is a narrative unit of ~4 scenes.

${block}

Return a JSON array (one object per arc, in order) with this exact shape:
[
  {
    "name": "2-5 word evocative name for the arc (e.g. 'The Betrayal at Dawn', not 'Events')",
    "directionVector": "Forward-looking intent — see ARC METADATA guidance below.",
    "worldState": "Backward-looking compact state snapshot as of the END of this arc — see ARC METADATA guidance below for domain-adaptive form."
  }
]
${PROMPT_ARC_STATE_GUIDANCE}
Rules:
- Each name captures the arc's thematic thrust in 2-5 words — evocative and specific, not generic.
- directionVector must read as forward intent for THIS arc, not a summary of what happened.
- worldState must be ground-truth only, 50-90 words, in the native compact form for the DETECTED domain (fiction, chess, poker, paper, stock log, etc).
- Output must be a JSON array with length exactly equal to the number of arcs above.`;
}
