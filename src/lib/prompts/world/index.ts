/**
 * World prompts — direction suggestions, expansion suggestions/execution,
 * full-narrative generation, and pattern detection. Re-exports of every
 * prompt builder used by `src/lib/ai/world.ts`.
 */

export {
  buildSuggestArcDirectionPrompt,
  buildSuggestAutoDirectionPrompt,
  ARC_DIRECTION_SYSTEM,
  NARRATIVE_DIRECTION_SYSTEM,
} from './direction';

export {
  buildSuggestWorldExpansionPrompt,
  EXPANSION_SUGGEST_SYSTEM,
} from './expansion-suggestion';
export type {
  ExpansionSizeConfig,
  SuggestWorldExpansionArgs,
  WorldExpansionSize,
} from './expansion-suggestion';

export {
  buildExpandWorldPrompt,
  EXPANSION_SIZE_CONFIG,
  EXPANSION_STRATEGY_PROMPTS,
  EXPAND_WORLD_SYSTEM,
} from './expand-world';
export type {
  ExpandWorldArgs,
  WorldExpansionStrategy,
} from './expand-world';

export {
  buildGenerateNarrativePrompt,
  GENERATE_NARRATIVE_SYSTEM,
  DETECT_PATTERNS_SYSTEM,
} from './generate-narrative';
export type { GenerateNarrativeArgs } from './generate-narrative';

export { buildDetectPatternsPrompt } from './detect-patterns';
export type { DetectPatternsArgs } from './detect-patterns';
