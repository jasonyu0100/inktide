import type { Branch, NarrativeState, ThreadStatus, ForceSnapshot, CubeCornerKey, CubeCorner } from '@/types/narrative';
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
  const maxDist = Math.sqrt(3); // diagonal of unit cube
  const d = forceDistance(forces, NARRATIVE_CUBE[cornerKey].forces);
  return 1 - d / maxDist;
}
