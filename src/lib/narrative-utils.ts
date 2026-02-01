import type { Branch, NarrativeState, Scene, ThreadStatus, ForceSnapshot, CubeCornerKey, CubeCorner } from '@/types/narrative';
import { NARRATIVE_CUBE } from '@/types/narrative';

// ── Sequential ID generation ─────────────────────────────────────────────────

/**
 * Extract the numeric suffix from an entity ID (e.g., "C-01" → 1, "L-12" → 12, "S-003" → 3).
 * Handles various formats: "C-01", "C-1742000000-3", "S-GEN-1742000000-5", etc.
 * Returns the highest trailing number found, or 0 if none.
 */
function extractIdNumber(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Compute the next sequential ID for a given prefix by scanning existing IDs in the narrative.
 * Returns zero-padded IDs like "C-09", "L-12", "T-08", "S-016", "ARC-04".
 *
 * @param prefix - Entity prefix (e.g., "C", "L", "T", "S", "ARC", "WX", "K")
 * @param existingIds - Array of existing IDs to scan for the highest number
 * @param padWidth - Zero-padding width (default: 2 for most, 3 for scenes)
 */
export function nextId(prefix: string, existingIds: string[], padWidth = 2): string {
  let max = 0;
  for (const id of existingIds) {
    const n = extractIdNumber(id);
    if (n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(padWidth, '0')}`;
}

/**
 * Generate a batch of sequential IDs starting from the next available number.
 */
export function nextIds(prefix: string, existingIds: string[], count: number, padWidth = 2): string[] {
  let max = 0;
  for (const id of existingIds) {
    const n = extractIdNumber(id);
    if (n > max) max = n;
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + 1 + i).padStart(padWidth, '0')}`);
}

/**
 * Resolve the full entry sequence for a branch by walking up to root.
 * Root branch returns its own entryIds.
 * Child branch returns parent's resolved sequence up to forkEntryId (inclusive) + own entryIds.
 */
export function resolveSceneSequence(
  branches: Record<string, Branch>,
  branchId: string,
): string[] {
  const branch = branches[branchId];
  if (!branch) return [];

  // Root branch — just its own entries
  if (!branch.parentBranchId) return branch.entryIds;

  // Recursively resolve parent
  const parentSequence = resolveSceneSequence(branches, branch.parentBranchId);

  // Find the fork point in the parent sequence
  if (branch.forkEntryId) {
    const forkIdx = parentSequence.indexOf(branch.forkEntryId);
    if (forkIdx >= 0) {
      return [...parentSequence.slice(0, forkIdx + 1), ...branch.entryIds];
    }
  }

  // Fallback: append after full parent sequence
  return [...parentSequence, ...branch.entryIds];
}

/**
 * Compute thread statuses at a given scene index by replaying threadMutations.
 * Returns a map of threadId → current status.
 */
export function computeThreadStatuses(
  narrative: NarrativeState,
  sceneIndex: number,
  resolvedSceneKeys?: string[],
): Record<string, ThreadStatus> {
  // Start with the base statuses from thread definitions
  const statuses: Record<string, ThreadStatus> = {};
  for (const [id, thread] of Object.entries(narrative.threads)) {
    statuses[id] = thread.status;
  }

  // Replay mutations up to and including the current scene (skip world builds)
  const sceneKeys = resolvedSceneKeys ?? Object.keys(narrative.scenes);
  for (let i = 0; i <= sceneIndex && i < sceneKeys.length; i++) {
    const scene = narrative.scenes[sceneKeys[i]];
    if (!scene) continue;
    for (const tm of scene.threadMutations) {
      statuses[tm.threadId] = tm.to;
    }
  }

  return statuses;
}

// ── Narrative Cube detection ───────────────────────────────────────────────

/** Euclidean distance between two force snapshots */
function forceDistance(a: ForceSnapshot, b: ForceSnapshot): number {
  return Math.sqrt(
    (a.pressure - b.pressure) ** 2 +
    (a.momentum - b.momentum) ** 2 +
    (a.flux - b.flux) ** 2,
  );
}

/** Detect the nearest cube corner for a given force snapshot */
export function detectCubeCorner(forces: ForceSnapshot): CubeCorner {
  let best: CubeCorner = NARRATIVE_CUBE.LLL;
  let bestDist = Infinity;
  for (const corner of Object.values(NARRATIVE_CUBE)) {
    const d = forceDistance(forces, corner.forces);
    if (d < bestDist) {
      bestDist = d;
      best = corner;
    }
  }
  return best;
}

/** Returns the proximity (0-1) of forces to a specific cube corner. 1 = at the corner, 0 = maximally far. */
export function cubeCornerProximity(forces: ForceSnapshot, cornerKey: CubeCornerKey): number {
  const maxDist = 2 * Math.sqrt(3); // diagonal of cube from -1,-1,-1 to 1,1,1
  const d = forceDistance(forces, NARRATIVE_CUBE[cornerKey].forces);
  return 1 - d / maxDist;
}

// ── Deterministic Force Computation ─────────────────────────────────────────

// Thread status categories for force computation
const THREATENING_STATUSES = new Set(['escalating', 'critical', 'threatened', 'fractured']);
const STABILIZING_STATUSES = new Set(['resolved', 'done', 'closed', 'abandoned', 'subverted']);
const UNSTABLE_STATUSES = new Set(['surfacing', 'fractured', 'converging']);
const RESOLVING_STATUSES = new Set(['resolved', 'done', 'closed', 'subverted']);

/**
 * Compute a ForceSnapshot deterministically from a scene's structural data.
 *
 * The narrative is modeled as a point traveling inside the force cube [-1,+1]³.
 * Forces respond to the structural reality of the scene:
 *
 * - **Pressure** (stakes): low when threads are dormant/resolved, rises with threats
 * - **Momentum** (pace): low in establishing scenes, rises with mutation density
 * - **Flux** (instability): high in early scenes (new world), decays as things stabilize,
 *   spikes on disruptions and new knowledge
 *
 * A new story naturally starts near (-1, -1, +1) — low stakes, low pace, high uncertainty —
 * and the path through the cube traces the story's emotional shape.
 *
 * @param scene - The scene to compute forces for
 * @param threadStatuses - Map of threadId → current status (after applying this scene's mutations)
 * @param prevForce - Previous scene's force snapshot (for smoothing). Null for the first scene.
 * @param baselineMutations - Median mutation count across scenes so far (for momentum scaling)
 * @param sceneIndex - Zero-based index of this scene in the timeline (used for age-aware dynamics)
 */
export function computeForceSnapshot(
  scene: Scene,
  threadStatuses: Record<string, ThreadStatus>,
  prevForce: ForceSnapshot | null,
  baselineMutations: number,
  sceneIndex: number = 0,
): ForceSnapshot {
  const allStatuses = Object.values(threadStatuses);
  const totalThreads = allStatuses.length || 1;

  // Categorize threads
  let threatening = 0;
  let stabilizing = 0;
  let dormant = 0;
  let mid = 0;
  for (const status of allStatuses) {
    const s = status.toLowerCase();
    if (THREATENING_STATUSES.has(s)) threatening++;
    else if (STABILIZING_STATUSES.has(s)) stabilizing++;
    else if (s === 'dormant') dormant++;
    else mid++; // surfacing, converging, etc.
  }

  // ── Pressure: stakes/urgency ──────────────────────────────────────────
  // Base: ratio of threatening vs non-threatening threads
  // Dormant threads actively pull pressure negative (no stakes established)
  // Stabilizing threads also pull negative (resolved = safe)
  let pressureRaw = (threatening * 1.0 - dormant * 0.4 - stabilizing * 0.6 + mid * 0.15) / totalThreads;

  // Negative relationship mutations add pressure
  const negRelMutations = scene.relationshipMutations.filter((r) => r.valenceDelta < -0.1);
  pressureRaw += negRelMutations.length * 0.12;

  // This scene's thread mutations create spikes/dips
  for (const tm of scene.threadMutations) {
    if (THREATENING_STATUSES.has(tm.to.toLowerCase())) pressureRaw += 0.12;
    if (STABILIZING_STATUSES.has(tm.to.toLowerCase())) pressureRaw -= 0.15;
    // Dormant→surfacing is a subtle pressure increase
    if (tm.from.toLowerCase() === 'dormant' && !STABILIZING_STATUSES.has(tm.to.toLowerCase())) {
      pressureRaw += 0.05;
    }
  }

  // ── Momentum: pace of change ──────────────────────────────────────────
  const mutationCount = scene.threadMutations.length + scene.knowledgeMutations.length + scene.relationshipMutations.length;
  const baseline = Math.max(baselineMutations, 1);

  // Raw momentum from mutation density: 0 → -1, baseline → 0, 2x → +1
  let momentumRaw = (mutationCount - baseline) / baseline;

  // Early scenes have inherently low momentum (establishing the world)
  // This decays as the story picks up — after ~8 scenes the penalty is negligible
  const earlyPenalty = Math.max(0, 0.5 * Math.exp(-sceneIndex / 4));
  momentumRaw -= earlyPenalty;

  // Scenes with no thread mutations at all are very static
  if (scene.threadMutations.length === 0) {
    momentumRaw -= 0.2;
  }

  // ── Flux: instability/unpredictability ────────────────────────────────
  let fluxRaw = 0;

  // Early story = high flux (everything is new and unfamiliar)
  // Decays exponentially: strong for first ~6 scenes, fades by ~15
  const noveltyFlux = 0.7 * Math.exp(-sceneIndex / 5);
  fluxRaw += noveltyFlux;

  // Threads moving to unstable states increase flux
  for (const tm of scene.threadMutations) {
    if (UNSTABLE_STATUSES.has(tm.to.toLowerCase())) fluxRaw += 0.2;
    if (RESOLVING_STATUSES.has(tm.to.toLowerCase())) fluxRaw -= 0.3;
  }

  // New knowledge = new information disrupting the status quo
  const knowledgeAdded = scene.knowledgeMutations.filter((k) => k.action === 'added').length;
  fluxRaw += knowledgeAdded * 0.08;

  // Large relationship swings are destabilizing
  for (const rm of scene.relationshipMutations) {
    if (Math.abs(rm.valenceDelta) > 0.3) fluxRaw += 0.12;
  }

  // Background instability from thread states
  const unstableThreads = allStatuses.filter((s) => UNSTABLE_STATUSES.has(s.toLowerCase())).length;
  const resolvedRatio = stabilizing / totalThreads;
  fluxRaw += (unstableThreads * 0.2) / totalThreads;
  // Many resolved threads = stable world → pulls flux negative
  fluxRaw -= resolvedRatio * 0.4;

  // ── Clamp raw values to [-1, +1] ──
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const rawForce: ForceSnapshot = {
    pressure: clamp(pressureRaw),
    momentum: clamp(momentumRaw),
    flux: clamp(fluxRaw),
  };

  // ── Smooth with previous force (exponential smoothing) ──
  // Higher smoothing = more gradual curves. Lower = more responsive.
  const alpha = 0.55; // responsiveness to new values
  if (prevForce) {
    return {
      pressure: clamp(+(alpha * rawForce.pressure + (1 - alpha) * prevForce.pressure).toFixed(2)),
      momentum: clamp(+(alpha * rawForce.momentum + (1 - alpha) * prevForce.momentum).toFixed(2)),
      flux: clamp(+(alpha * rawForce.flux + (1 - alpha) * prevForce.flux).toFixed(2)),
    };
  }

  return {
    pressure: +rawForce.pressure.toFixed(2),
    momentum: +rawForce.momentum.toFixed(2),
    flux: +rawForce.flux.toFixed(2),
  };
}

/**
 * Compute the median mutation count across a list of scenes.
 * Used as the baseline for momentum calculation.
 */
export function computeBaselineMutations(scenes: Scene[]): number {
  if (scenes.length === 0) return 2; // sensible default
  const counts = scenes.map((s) =>
    s.threadMutations.length + s.knowledgeMutations.length + s.relationshipMutations.length,
  ).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  return counts.length % 2 === 0
    ? (counts[mid - 1] + counts[mid]) / 2
    : counts[mid];
}
