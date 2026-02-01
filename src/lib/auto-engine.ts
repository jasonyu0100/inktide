import type {
  NarrativeState,
  AutoConfig,
  AutoAction,
  AutoActionWeight,
  AutoEndCondition,
  ForceSnapshot,
  Scene,
  CubeCornerKey,
} from '@/types/narrative';
import { isScene, NARRATIVE_CUBE } from '@/types/narrative';
import { detectCubeCorner } from '@/lib/narrative-utils';

// ── Terminal thread statuses ────────────────────────────────────────────────
const TERMINAL_STATUSES = new Set(['resolved', 'done', 'subverted', 'closed', 'abandoned']);
const ACTIVE_STATUSES = new Set(['surfacing', 'escalating', 'critical', 'fractured', 'converging', 'threatened']);

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toLowerCase());
}

function isActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status.toLowerCase());
}

// ── Pacing profile multipliers ──────────────────────────────────────────────
const PACING_MULTIPLIERS: Record<string, Record<AutoAction, number>> = {
  deliberate:  { generate_arc: 1.0, expand_world: 1.5, resolve_thread: 1.0, escalate_toward_climax: 0.6, introduce_complication: 0.8, quiet_interlude: 1.3 },
  balanced:    { generate_arc: 1.0, expand_world: 1.0, resolve_thread: 1.0, escalate_toward_climax: 1.0, introduce_complication: 1.0, quiet_interlude: 1.0 },
  urgent:      { generate_arc: 1.2, expand_world: 0.5, resolve_thread: 1.3, escalate_toward_climax: 1.5, introduce_complication: 1.0, quiet_interlude: 0.4 },
  chaotic:     { generate_arc: 1.0, expand_world: 1.3, resolve_thread: 0.4, escalate_toward_climax: 1.0, introduce_complication: 1.8, quiet_interlude: 0.6 },
};

// ── Composite tension from force snapshot ───────────────────────────────────
function compositeTension(f: ForceSnapshot): number {
  return f.pressure * 0.4 + f.momentum * 0.3 + f.flux * 0.3;
}

// ── Check end conditions ────────────────────────────────────────────────────
export function checkEndConditions(
  narrative: NarrativeState,
  resolvedKeys: string[],
  config: AutoConfig,
): AutoEndCondition | null {
  for (const cond of config.endConditions) {
    switch (cond.type) {
      case 'scene_count':
        if (resolvedKeys.length >= cond.target) return cond;
        break;
      case 'all_threads_resolved': {
        const threads = Object.values(narrative.threads);
        if (threads.length > 0 && threads.every((t) => isTerminal(t.status))) return cond;
        break;
      }
      case 'arc_count':
        if (Object.keys(narrative.arcs).length >= cond.target) return cond;
        break;
      case 'manual_stop':
        break; // only triggered by user
    }
  }
  return null;
}

// ── Decision engine ─────────────────────────────────────────────────────────
export function evaluateNarrativeState(
  narrative: NarrativeState,
  resolvedKeys: string[],
  _currentIndex: number,
  config: AutoConfig,
): AutoActionWeight[] {
  const scores: AutoActionWeight[] = [];
  const scenes = resolvedKeys.map((k) => narrative.scenes[k]).filter(Boolean).filter(isScene) as Scene[];
  const threads = Object.values(narrative.threads);
  const characters = Object.values(narrative.characters);
  const pacingMult = PACING_MULTIPLIERS[config.pacingProfile] ?? PACING_MULTIPLIERS.balanced;

  // ── Thread analysis ─────────────────────────────────────────────────────
  const activeThreads = threads.filter((t) => isActive(t.status));
  const dormantThreads = threads.filter((t) => t.status.toLowerCase() === 'dormant');

  // Thread stagnation: how many scenes since each active thread was last mutated
  const threadLastMutated: Record<string, number> = {};
  scenes.forEach((scene, idx) => {
    for (const tm of scene.threadMutations) {
      threadLastMutated[tm.threadId] = idx;
    }
  });

  const stagnantThreads = activeThreads.filter((t) => {
    const lastMut = threadLastMutated[t.id] ?? -1;
    return (scenes.length - 1 - lastMut) >= config.threadStagnationThreshold;
  });

  // ── Tension curve analysis ──────────────────────────────────────────────
  const recentWindow = scenes.slice(-5);
  const avgTension = recentWindow.length > 0
    ? recentWindow.reduce((sum, s) => sum + compositeTension(s.forceSnapshot), 0) / recentWindow.length
    : 0.5;

  const tensionTrend = recentWindow.length >= 3
    ? compositeTension(recentWindow[recentWindow.length - 1].forceSnapshot) -
      compositeTension(recentWindow[0].forceSnapshot)
    : 0;

  // ── Character coverage ──────────────────────────────────────────────────
  const anchorCharacters = characters.filter((c) => c.role === 'anchor');
  const recentSceneWindow = scenes.slice(-config.minScenesBetweenCharacterFocus);
  const recentParticipants = new Set(recentSceneWindow.flatMap((s) => s.participantIds));
  const neglectedAnchors = config.characterRotationEnabled
    ? anchorCharacters.filter((c) => !recentParticipants.has(c.id))
    : [];

  // ── World saturation ────────────────────────────────────────────────────
  const allParticipantIds = new Set(scenes.flatMap((s) => s.participantIds));
  const unusedCharacters = characters.filter((c) => !allParticipantIds.has(c.id));
  const allLocationIds = new Set(scenes.map((s) => s.locationId));
  const unusedLocations = Object.values(narrative.locations).filter((l) => !allLocationIds.has(l.id));
  const worldSaturated = unusedCharacters.length > 3 || unusedLocations.length > 3;

  // ── Intelligent tension thresholds (hardcoded defaults) ─────────────────
  const tensionFloor = 0.25;
  const tensionCeiling = 0.65;

  // ── Force drift detection ──────────────────────────────────────────────
  // Detect monotonic upward drift: if all 3 forces have been rising over the
  // last N scenes, the LLM is just escalating everything regardless of events
  const driftWindow = scenes.slice(-4);
  let upwardDriftCount = 0;
  if (driftWindow.length >= 3) {
    for (const key of ['pressure', 'momentum', 'flux'] as const) {
      let rising = true;
      for (let i = 1; i < driftWindow.length; i++) {
        if (driftWindow[i].forceSnapshot[key] < driftWindow[i - 1].forceSnapshot[key]) {
          rising = false;
          break;
        }
      }
      if (rising) upwardDriftCount++;
    }
  }
  const hasForceDrift = upwardDriftCount >= 2; // 2+ forces monotonically rising

  // ── High-force saturation detection ────────────────────────────────────
  const lastForce = scenes.length > 0 ? scenes[scenes.length - 1].forceSnapshot : { pressure: 0, momentum: 0, flux: 0 };
  const forceAvg = (lastForce.pressure + lastForce.momentum + lastForce.flux) / 3;
  const forcesHigh = forceAvg > 0.7;

  // ── World build interval tracking ──────────────────────────────────────
  // Count how many arcs have been generated since the last world expansion
  let arcsSinceLastWorldBuild = 0;
  if (config.worldBuildInterval > 0) {
    const allArcIds = Object.keys(narrative.arcs);
    // Walk arcs in reverse to find the last world build
    const lastWorldBuildIdx = resolvedKeys.findLastIndex((k) => narrative.worldBuilds[k] != null);
    if (lastWorldBuildIdx < 0) {
      // No world builds yet — count all arcs
      arcsSinceLastWorldBuild = allArcIds.length;
    } else {
      // Count arcs that started after the last world build
      const scenesAfter = resolvedKeys.slice(lastWorldBuildIdx + 1)
        .map((k) => narrative.scenes[k])
        .filter(Boolean);
      const arcIdsAfter = new Set(scenesAfter.map((s) => s.arcId));
      arcsSinceLastWorldBuild = arcIdsAfter.size;
    }
  }
  const worldBuildDue = config.worldBuildInterval > 0 && arcsSinceLastWorldBuild >= config.worldBuildInterval;

  // ── Denouement detection ────────────────────────────────────────────────
  // After a high-tension peak followed by a drop, shift to resolution
  const isPostClimax = recentWindow.length >= 3 &&
    compositeTension(recentWindow[0].forceSnapshot) > 0.75 &&
    tensionTrend < -0.15;

  // ── Score each action ───────────────────────────────────────────────────

  // 1. Generate arc (default continuation)
  {
    let score = 0.5;
    const reasons: string[] = [];

    // Boost if current arc is complete (last scene is in a finished arc)
    const lastScene = scenes[scenes.length - 1];
    if (lastScene) {
      const lastArc = narrative.arcs[lastScene.arcId];
      const lastArcSceneIds = lastArc?.sceneIds ?? [];
      if (lastArcSceneIds[lastArcSceneIds.length - 1] === lastScene.id) {
        score += 0.2;
        reasons.push('current arc complete');
      }
    }

    if (dormantThreads.length > 2) {
      score += 0.15;
      reasons.push(`${dormantThreads.length} dormant threads to surface`);
    }

    if (neglectedAnchors.length > 0) {
      score += 0.1;
      reasons.push(`${neglectedAnchors.length} anchor characters need screen time`);
    }

    scores.push({ action: 'generate_arc', score: score * pacingMult.generate_arc, reason: reasons.join('; ') || 'continue the story' });
  }

  // 2. Expand world (interval-based)
  {
    let score = 0;
    const reasons: string[] = [];

    if (config.worldBuildInterval === 0) {
      reasons.push('world building disabled');
    } else if (worldBuildDue) {
      score = 0.95; // Nearly guaranteed when interval is hit
      reasons.push(`${arcsSinceLastWorldBuild} arcs since last world build (interval: ${config.worldBuildInterval})`);
      if (worldSaturated) {
        score *= 0.5;
        reasons.push('but many unused world elements');
      }
    } else {
      reasons.push(`${arcsSinceLastWorldBuild}/${config.worldBuildInterval} arcs until next world build`);
    }

    scores.push({ action: 'expand_world', score, reason: reasons.join('; ') || 'enrich the world' });
  }

  // 3. Resolve thread
  {
    let score = 0.2;
    const reasons: string[] = [];

    if (activeThreads.length > config.maxActiveThreads) {
      score += 0.35;
      reasons.push(`${activeThreads.length} active threads exceeds cap of ${config.maxActiveThreads}`);
    }

    if (isPostClimax) {
      score += 0.4;
      reasons.push('post-climax: time to resolve');
    }

    if (stagnantThreads.length > 0) {
      score += 0.2;
      reasons.push(`${stagnantThreads.length} stagnant threads`);
    }

    scores.push({ action: 'resolve_thread', score: score * pacingMult.resolve_thread, reason: reasons.join('; ') || 'tie up loose ends' });
  }

  // 4. Escalate toward climax
  {
    let score = 0.3;
    const reasons: string[] = [];

    if (avgTension < tensionFloor) {
      score += 0.35;
      reasons.push(`tension ${avgTension.toFixed(2)} below floor`);
    }

    if (stagnantThreads.length > 0) {
      score += 0.15;
      reasons.push('stagnant threads need escalation');
    }

    if (isPostClimax) {
      score *= 0.2; // don't escalate after climax
    }

    // Suppress escalation when forces are already high or drifting up
    if (forcesHigh) {
      score *= 0.3;
      reasons.push(`forces already high (avg ${forceAvg.toFixed(2)})`);
    }
    if (hasForceDrift) {
      score *= 0.4;
      reasons.push('force drift: suppressing further escalation');
    }

    scores.push({ action: 'escalate_toward_climax', score: score * pacingMult.escalate_toward_climax, reason: reasons.join('; ') || 'build tension' });
  }

  // 5. Introduce complication
  {
    let score = 0.25;
    const reasons: string[] = [];

    if (avgTension < tensionFloor) {
      score += 0.2;
      reasons.push('tension too low');
    }

    if (dormantThreads.length > 0 && activeThreads.length < config.maxActiveThreads) {
      score += 0.15;
      reasons.push('room for new complications');
    }

    if (tensionTrend < -0.1 && !isPostClimax) {
      score += 0.2;
      reasons.push('tension declining — needs a twist');
    }

    if (isPostClimax) {
      score *= 0.1; // suppress post-climax
    }

    // Suppress complications when forces are already saturated
    if (forcesHigh) {
      score *= 0.4;
      reasons.push('forces already high — complication would over-saturate');
    }

    scores.push({ action: 'introduce_complication', score: score * pacingMult.introduce_complication, reason: reasons.join('; ') || 'shake things up' });
  }

  // 6. Quiet interlude
  {
    let score = 0.3;
    const reasons: string[] = [];

    if (avgTension > tensionCeiling) {
      score += 0.4;
      reasons.push(`tension ${avgTension.toFixed(2)} above ceiling`);
    }

    if (tensionTrend > 0.15) {
      score += 0.2;
      reasons.push('sustained tension spike needs relief');
    }

    if (neglectedAnchors.length > 0) {
      score += 0.1;
      reasons.push('good opportunity for character development');
    }

    if (hasForceDrift) {
      score += 0.35;
      reasons.push('force drift detected — forces rising monotonically, need correction');
    }

    if (forcesHigh) {
      score += 0.25;
      reasons.push(`forces saturated (avg ${forceAvg.toFixed(2)})`);
    }

    scores.push({ action: 'quiet_interlude', score: score * pacingMult.quiet_interlude, reason: reasons.join('; ') || 'breathing room' });
  }

  // Clamp scores to [0, 1] and sort descending
  return scores
    .map((s) => ({ ...s, score: Math.max(0, Math.min(1, s.score)) }))
    .sort((a, b) => b.score - a.score);
}

/** Pick the scene count for an auto-generated arc based on config and action type */
export function pickArcLength(config: AutoConfig, action: AutoAction): number {
  switch (action) {
    case 'quiet_interlude':
      return Math.min(2, config.minArcLength);
    case 'resolve_thread':
      return Math.min(3, config.maxArcLength);
    case 'escalate_toward_climax':
      return Math.max(config.minArcLength, Math.ceil((config.minArcLength + config.maxArcLength) / 2));
    case 'introduce_complication':
      return config.minArcLength;
    default:
      return Math.ceil((config.minArcLength + config.maxArcLength) / 2);
  }
}

/**
 * Pick the best cube corner to steer the narrative toward, based on:
 * - Current position in the force cube
 * - The chosen action type
 * - Pacing profile preferences
 *
 * Returns a CubeCornerKey that gets passed to generateScenes as the cubeGoal.
 */
export function pickCubeGoal(
  action: AutoAction,
  narrative: NarrativeState,
  resolvedKeys: string[],
  config: AutoConfig,
): CubeCornerKey {
  const scenes = resolvedKeys.map((k) => narrative.scenes[k]).filter(Boolean).filter(isScene) as Scene[];
  const lastScene = scenes[scenes.length - 1];
  const currentForce = lastScene?.forceSnapshot ?? { pressure: -0.5, momentum: -0.5, flux: 0.5 };
  const current = detectCubeCorner(currentForce);

  // Action-based preferred corners (ordered by priority)
  const actionPrefs: Record<AutoAction, CubeCornerKey[]> = {
    quiet_interlude:         ['LLL', 'LLH', 'LHL'],       // Rest, Liminal, Cruise
    resolve_thread:          ['HHL', 'HLL', 'LLL'],       // Climax, Locked In, Rest
    escalate_toward_climax:  ['HHH', 'HHL', 'HLH'],       // Peak Crisis, Climax, Slow Burn
    introduce_complication:  ['LHH', 'HLH', 'LLH'],       // Exploration, Slow Burn, Liminal
    generate_arc:            ['LHL', 'LHH', 'HLH'],       // Cruise, Exploration, Slow Burn
    expand_world:            ['LLH', 'LHH', 'LLL'],       // Liminal, Exploration, Rest
  };

  const prefs = actionPrefs[action] ?? ['LHL'];

  // Pacing profile adjustments — chaotic prefers distant corners, deliberate prefers gradual moves
  const distanceWeight = config.pacingProfile === 'chaotic' ? 0.6
    : config.pacingProfile === 'urgent' ? 0.3
    : config.pacingProfile === 'deliberate' ? -0.3
    : 0;

  // Score each candidate corner
  let bestKey: CubeCornerKey = prefs[0];
  let bestScore = -Infinity;

  for (const key of prefs) {
    const corner = NARRATIVE_CUBE[key];
    let score = 0;

    // Preference order bonus (first choice gets more weight)
    const prefIdx = prefs.indexOf(key);
    score += (prefs.length - prefIdx) * 0.3;

    // Avoid staying in the same corner (narrative variety)
    if (key === current.key) {
      score -= 0.8;
    }

    // Distance from current position — chaotic profiles prefer bigger jumps
    const dx = corner.forces.pressure - currentForce.pressure;
    const dy = corner.forces.momentum - currentForce.momentum;
    const dz = corner.forces.flux - currentForce.flux;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    score += dist * distanceWeight;

    // Post-climax: strongly prefer rest/liminal corners
    const tension = compositeTension(currentForce);
    if (tension > 0.6 && (key === 'LLL' || key === 'LLH' || key === 'LHL')) {
      score += 0.5;
    }

    // If forces are very low, prefer corners that raise at least one force
    if (tension < -0.3 && (key === 'HHH' || key === 'HHL' || key === 'LHH' || key === 'HLH')) {
      score += 0.4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

/** Build the action-specific direction hint injected into AI prompts */
export function buildActionDirective(
  action: AutoAction,
  narrative: NarrativeState,
  resolvedKeys: string[],
  config: AutoConfig,
): string {
  const threads = Object.values(narrative.threads);
  const activeThreads = threads.filter((t) => isActive(t.status));
  const stagnantThreads = activeThreads.filter((t) => {
    const scenes = resolvedKeys.map((k) => narrative.scenes[k]).filter(Boolean).filter(isScene) as Scene[];
    let lastMut = -1;
    scenes.forEach((s, idx) => {
      if (s.threadMutations.some((tm) => tm.threadId === t.id)) lastMut = idx;
    });
    return (scenes.length - 1 - lastMut) >= config.threadStagnationThreshold;
  });

  const toneClause = config.toneGuidance ? `\nTone: ${config.toneGuidance}` : '';
  const constraintClause = config.narrativeConstraints ? `\nConstraints: ${config.narrativeConstraints}` : '';
  const directionClause = config.arcDirectionPrompt ? `\nGeneral direction: ${config.arcDirectionPrompt}` : '';

  // Find world build elements that haven't been used in scenes yet
  const worldBuildSeed = buildWorldBuildSeedClause(narrative, resolvedKeys, config);

  switch (action) {
    case 'generate_arc':
      return `Continue the story naturally. Choose the most compelling next direction.${worldBuildSeed}${toneClause}${constraintClause}${directionClause}`;
    case 'escalate_toward_climax':
      return `ESCALATE the narrative toward a climax. Increase pressure and stakes dramatically. ${stagnantThreads.length > 0 ? `Force a crisis on these stagnant threads: ${stagnantThreads.map((t) => t.description).join(', ')}.` : 'Push the most critical thread toward a breaking point.'}${worldBuildSeed}${toneClause}${constraintClause}`;
    case 'introduce_complication':
      return `Introduce an unexpected COMPLICATION or twist. Surface a dormant threat, reveal a hidden truth, or create a new conflict that disrupts the current trajectory.${worldBuildSeed}${toneClause}${constraintClause}`;
    case 'resolve_thread': {
      const threadToResolve = stagnantThreads[0] ?? activeThreads[0];
      return `RESOLVE or bring to conclusion the thread: "${threadToResolve?.description ?? 'the most pressing thread'}". This arc should tie up this storyline definitively.${toneClause}${constraintClause}`;
    }
    case 'quiet_interlude':
      return `Create a QUIET INTERLUDE — a moment of calm between storms. Focus on character relationships, reflection, and planting seeds for future conflict. Keep tension low but introduce subtle foreshadowing.${worldBuildSeed}${toneClause}${constraintClause}`;
    case 'expand_world':
      return `Expand the world with new elements that serve the current narrative needs.${toneClause}${constraintClause}${directionClause}`;
  }
}

/** Build a clause that references unused world-build elements to weave into arcs */
function buildWorldBuildSeedClause(
  narrative: NarrativeState,
  resolvedKeys: string[],
  config: AutoConfig,
): string {
  const worldBuilds = Object.values(narrative.worldBuilds);
  if (worldBuilds.length === 0) return '';

  // Find characters/locations/threads introduced by world builds that haven't appeared in scenes yet
  const scenes = resolvedKeys.map((k) => narrative.scenes[k]).filter(Boolean).filter(isScene) as Scene[];
  const usedCharIds = new Set(scenes.flatMap((s) => s.participantIds));
  const usedLocIds = new Set(scenes.map((s) => s.locationId));
  const mutatedThreadIds = new Set(scenes.flatMap((s) => s.threadMutations.map((tm) => tm.threadId)));

  const unusedChars: string[] = [];
  const unusedLocs: string[] = [];
  const unusedThreads: string[] = [];

  for (const wb of worldBuilds) {
    for (const cid of wb.expansionManifest.characterIds) {
      if (!usedCharIds.has(cid)) {
        const c = narrative.characters[cid];
        if (c) unusedChars.push(`${c.name} (${c.role})`);
      }
    }
    for (const lid of wb.expansionManifest.locationIds) {
      if (!usedLocIds.has(lid)) {
        const l = narrative.locations[lid];
        if (l) unusedLocs.push(l.name);
      }
    }
    for (const tid of wb.expansionManifest.threadIds) {
      if (!mutatedThreadIds.has(tid)) {
        const t = narrative.threads[tid];
        if (t) unusedThreads.push(t.description);
      }
    }
  }

  if (unusedChars.length === 0 && unusedLocs.length === 0 && unusedThreads.length === 0) return '';

  const enforce = config.enforceWorldBuildUsage;
  const header = enforce
    ? '\nYou MUST incorporate at least one of these unused world-building elements into this arc:'
    : '\nConsider incorporating these unused world-building elements:';
  const parts: string[] = [header];
  if (unusedChars.length > 0) parts.push(`- Characters: ${unusedChars.slice(0, 4).join(', ')}`);
  if (unusedLocs.length > 0) parts.push(`- Locations: ${unusedLocs.slice(0, 3).join(', ')}`);
  if (unusedThreads.length > 0) parts.push(`- Threads: ${unusedThreads.slice(0, 3).join(', ')}`);

  return parts.join('\n');
}
