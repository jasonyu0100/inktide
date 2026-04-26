/**
 * Phase Graph prompt module — generates the working-model-of-reality graph
 * the narrative is currently operating under. Distinct from CRG (which
 * delivers per-arc causal reasoning); the Phase Graph captures the system's
 * current state and is consumed downstream by CRG / scene / plan / prose
 * generation as a working-state input.
 */

export {
  PHASE_GRAPH_SYSTEM,
  buildPhaseGraphPrompt,
} from "./generate";
export type { PhaseGraphPromptArgs } from "./generate";
