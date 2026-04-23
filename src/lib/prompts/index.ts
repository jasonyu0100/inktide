/**
 * Centralized Prompts
 *
 * Single source of truth for all LLM prompts, schemas, and prompt builders.
 * Organized by domain for maintainability.
 */

// ── Core Prompts ────────────────────────────────────────────────────────────
export { PROMPT_FORCE_STANDARDS, buildForceStandardsPrompt } from './core/forces';
export { PROMPT_STRUCTURAL_RULES } from './core/structural-rules';
export { PROMPT_DELTAS } from './core/deltas';
export { PROMPT_BEAT_TAXONOMY } from './core/beat-taxonomy';
export { PROMPT_ARC_STATE_GUIDANCE } from './core/game-state';

// ── Entity Prompts ──────────────────────────────────────────────────────────
export { PROMPT_ARTIFACTS } from './entities/artifacts';
export { PROMPT_LOCATIONS } from './entities/locations';
export { PROMPT_ENTITY_INTEGRATION } from './entities/integration';
export { PROMPT_WORLD } from './entities/continuity';

// ── Scene Prompts ───────────────────────────────────────────────────────────
export { PROMPT_POV } from './scenes/pov';
export { PROMPT_SUMMARY_REQUIREMENT } from './scenes/summary';
export {
  promptThreadLifecycle,
  buildThreadHealthPrompt,
  buildCompletedBeatsPrompt,
} from './scenes/thread-lifecycle';
export { buildScenePlanSystemPrompt } from './scenes/plan';
export { buildBeatAnalystSystemPrompt } from './scenes/analyze';
export { buildScenePlanEditSystemPrompt } from './scenes/edit';
export { PROMPT_PROPOSITION_TRANSMISSION } from './scenes/proposition-transmission';
export { buildSceneProseSystemPrompt } from './scenes/prose';
export type { SceneProseSystemPromptArgs } from './scenes/prose';

// (Legacy schemas/ directory removed — the lifecycle-based fragments were
// unused dead code that confused LLM output shape. Prompts now embed their
// own schema snippets with the current market-based contract.)

// ── Ingest Prompts ──────────────────────────────────────────────────────────
export {
  buildIngestRulesPrompt,
  buildIngestSystemsPrompt,
  buildIngestProseProfilePrompt,
  buildDeriveProseProfilePrompt,
} from './ingest';

// ── Premise Prompts ─────────────────────────────────────────────────────────
export {
  PREMISE_SYSTEM,
  PREMISE_SUGGEST_PROMPT,
  PHASE_GUIDANCE,
  SCHEMA_PREMISE_QUESTION,
} from './premise';

// ── Prose Prompts ───────────────────────────────────────────────────────────
export { FORMAT_INSTRUCTIONS } from './prose/format-instructions';

// ── Review Prompts ──────────────────────────────────────────────────────────
export {
  buildBranchReviewPrompt,
  buildProseReviewPrompt,
  buildPlanReviewPrompt,
} from './review';

// ── Report Prompts ──────────────────────────────────────────────────────────
export { REPORT_SYSTEM, REPORT_ANALYSIS_PROMPT, REPORT_SECTIONS } from './report';
export type { ReportSectionKey } from './report';

// ── Analysis Prompts ────────────────────────────────────────────────────────
export {
  SCENE_STRUCTURE_SYSTEM,
  buildSceneStructurePrompt,
  ARC_GROUPING_SYSTEM,
  buildArcGroupingPrompt,
  RECONCILE_ENTITIES_SYSTEM,
  buildReconcileEntitiesPrompt,
  RECONCILE_SEMANTIC_SYSTEM,
  buildReconcileSemanticPrompt,
  COALESCE_OUTCOMES_SYSTEM,
  buildCoalesceOutcomesPrompt,
  THREADING_SYSTEM,
  buildThreadingPrompt,
} from './analysis';
