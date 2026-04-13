/**
 * Centralized Prompts
 *
 * Single source of truth for all LLM prompts, schemas, and prompt builders.
 * Organized by domain for maintainability.
 */

// ── Core Prompts ────────────────────────────────────────────────────────────
export { PROMPT_FORCE_STANDARDS, buildForceStandardsPrompt } from './core/forces';
export { PROMPT_STRUCTURAL_RULES } from './core/structural-rules';
export { PROMPT_DELTAS } from './core/mutations';
export { PROMPT_BEAT_TAXONOMY } from './core/beat-taxonomy';

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

// ── Schemas ─────────────────────────────────────────────────────────────────
export {
  // Generation schemas (ID-based)
  SCHEMA_THREAD_DELTAS,
  SCHEMA_WORLD_DELTAS,
  SCHEMA_RELATIONSHIP_DELTAS,
  SCHEMA_SYSTEM_DELTAS,
  SCHEMA_ARTIFACT_USAGES,
  SCHEMA_OWNERSHIP_DELTAS,
  SCHEMA_TIE_DELTAS,
  SCHEMA_CHARACTER_MOVEMENTS,
  SCHEMA_EVENTS,
  SCHEMA_SCENE_DELTAS,
  // Analysis schemas (name-based)
  SCHEMA_ANALYSIS_THREAD_DELTAS,
  SCHEMA_ANALYSIS_WORLD_DELTAS,
  SCHEMA_ANALYSIS_RELATIONSHIP_DELTAS,
  SCHEMA_ANALYSIS_ARTIFACT_USAGES,
  SCHEMA_ANALYSIS_OWNERSHIP_DELTAS,
  SCHEMA_ANALYSIS_TIE_DELTAS,
  SCHEMA_ANALYSIS_CHARACTER_MOVEMENTS,
  SCHEMA_ANALYSIS_SYSTEM_DELTAS,
} from './schemas/mutations';

export {
  // Entity creation schemas
  SCHEMA_CHARACTER_CREATION,
  SCHEMA_CHARACTER_WORLD_NODE,
  SCHEMA_LOCATION_CREATION,
  SCHEMA_LOCATION_WORLD_NODE,
  SCHEMA_ARTIFACT_CREATION,
  SCHEMA_ARTIFACT_WORLD_NODE,
  SCHEMA_THREAD_CREATION,
  SCHEMA_RELATIONSHIP_CREATION,
  // Analysis entity schemas
  SCHEMA_ANALYSIS_CHARACTER,
  SCHEMA_ANALYSIS_LOCATION,
  SCHEMA_ANALYSIS_ARTIFACT,
  SCHEMA_ANALYSIS_THREAD,
  SCHEMA_ANALYSIS_RELATIONSHIP,
} from './schemas/entities';

// ── Ingest Prompts ──────────────────────────────────────────────────────────
export {
  buildIngestRulesPrompt,
  buildIngestSystemsPrompt,
  buildIngestProseProfilePrompt,
} from './ingest';

// ── Premise Prompts ─────────────────────────────────────────────────────────
export {
  PREMISE_SYSTEM,
  PHASE_GUIDANCE,
  SCHEMA_PREMISE_QUESTION,
} from './premise';

// ── Prose Prompts ───────────────────────────────────────────────────────────
export { FORMAT_INSTRUCTIONS } from './prose/format-instructions';
