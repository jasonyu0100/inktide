import { AUTO_STOP_CYCLE_LENGTH } from "@/lib/constants";
import {
  computeForceSnapshots,
  FORCE_WINDOW_SIZE,
} from "@/lib/narrative-utils";
import { logInfo } from "@/lib/system-logger";
import type {
  AutoConfig,
  AutoEndCondition,
  Character,
  ForceSnapshot,
  NarrativeState,
  Scene,
  Thread,
} from "@/types/narrative";
import {
  isScene,
  THREAD_ACTIVE_STATUSES,
  THREAD_TERMINAL_STATUSES,
} from "@/types/narrative";

// ── Constants ────────────────────────────────────────────────────────────────

const TERMINAL_SET = new Set<string>(THREAD_TERMINAL_STATUSES);
const ACTIVE_STATUSES = new Set<string>(
  THREAD_ACTIVE_STATUSES.filter((s) => s !== "latent"),
);
const PRIMED_STATUSES = new Set<string>(["escalating", "critical"]);

/** Threads without mutation for this many scenes are considered stale */
const STALE_THRESHOLD = 5;

/** Minimum continuity depth to consider an entity "developed" */
const DEVELOPED_THRESHOLD = 4;

/** Target active thread count - too many = chaos, too few = stagnant */
const IDEAL_ACTIVE_THREADS = { min: 2, max: 5 };

// ── Types ────────────────────────────────────────────────────────────────────

export type StoryPhase =
  | "setup"
  | "rising"
  | "midpoint"
  | "escalation"
  | "climax"
  | "resolution";

export type NarrativePressure = {
  /** Thread management pressure: stale threads, primed threads, density */
  threads: {
    stale: Thread[];
    primed: Thread[];
    activeCount: number;
    needsResolution: boolean;
    needsSeeding: boolean;
  };
  /** Entity development pressure: shallow characters, neglected anchors */
  entities: {
    shallow: Character[];
    neglected: Character[];
    recentGrowth: number;
  };
  /** World knowledge pressure: system growth rate */
  knowledge: {
    recentGrowth: number;
    isStagnant: boolean;
  };
  /** Overall balance */
  balance: {
    dominant: "fate" | "world" | "system" | "balanced";
    recommendation: string;
  };
};

export type AutoDirective = {
  phase: StoryPhase;
  progress: number;
  pressure: NarrativePressure;
  directive: string;
};

// ── Thread Analysis ──────────────────────────────────────────────────────────

function analyzeThreads(
  narrative: NarrativeState,
  scenes: Scene[],
): NarrativePressure["threads"] {
  const threads = Object.values(narrative.threads);
  const activeThreads = threads.filter((t) =>
    ACTIVE_STATUSES.has(t.status.toLowerCase()),
  );
  const primedThreads = threads.filter((t) =>
    PRIMED_STATUSES.has(t.status.toLowerCase()),
  );

  // Find stale threads (no mutation in recent scenes)
  const lastMutation: Record<string, number> = {};
  scenes.forEach((scene, idx) => {
    for (const tm of scene.threadMutations) {
      lastMutation[tm.threadId] = idx;
    }
  });

  const staleThreads = activeThreads.filter((t) => {
    const last = lastMutation[t.id] ?? -1;
    return scenes.length - 1 - last >= STALE_THRESHOLD;
  });

  return {
    stale: staleThreads,
    primed: primedThreads,
    activeCount: activeThreads.length,
    needsResolution: activeThreads.length > IDEAL_ACTIVE_THREADS.max,
    needsSeeding: activeThreads.length < IDEAL_ACTIVE_THREADS.min,
  };
}

// ── Entity Analysis ──────────────────────────────────────────────────────────

function analyzeEntities(
  narrative: NarrativeState,
  scenes: Scene[],
): NarrativePressure["entities"] {
  const characters = Object.values(narrative.characters);
  const anchors = characters.filter((c) => c.role === "anchor");

  // Find shallow characters (low continuity depth)
  const shallowChars = anchors.filter((c) => {
    const nodeCount = Object.keys(c.continuity.nodes).length;
    const edgeCount = c.continuity.edges.length;
    return nodeCount + Math.sqrt(edgeCount) < DEVELOPED_THRESHOLD;
  });

  // Find neglected anchors (not appearing in recent scenes)
  const recentScenes = scenes.slice(-FORCE_WINDOW_SIZE);
  const recentParticipants = new Set(
    recentScenes.flatMap((s) => s.participantIds),
  );
  const neglectedAnchors = anchors.filter(
    (c) => !recentParticipants.has(c.id),
  );

  // Calculate recent continuity growth
  const recentMutations = recentScenes.flatMap((s) => s.continuityMutations);
  const recentGrowth = recentMutations.reduce(
    (sum, m) => sum + m.addedNodes.length,
    0,
  );

  return {
    shallow: shallowChars,
    neglected: neglectedAnchors,
    recentGrowth,
  };
}

// ── Knowledge Analysis ───────────────────────────────────────────────────────

function analyzeKnowledge(
  narrative: NarrativeState,
  scenes: Scene[],
): NarrativePressure["knowledge"] {
  const recentScenes = scenes.slice(-FORCE_WINDOW_SIZE);

  // Calculate recent system growth from system mutations
  const recentGrowth = recentScenes.reduce((sum, s) => {
    const nodes = s.systemMutations?.addedNodes?.length ?? 0;
    const edges = s.systemMutations?.addedEdges?.length ?? 0;
    return sum + nodes + Math.sqrt(edges);
  }, 0);

  const avgGrowth = recentScenes.length > 0 ? recentGrowth / recentScenes.length : 0;

  return {
    recentGrowth,
    isStagnant: avgGrowth < 0.5,
  };
}

// ── Balance Analysis ─────────────────────────────────────────────────────────

function analyzeBalance(
  scenes: Scene[],
): NarrativePressure["balance"] {
  if (scenes.length < 3) {
    return { dominant: "balanced", recommendation: "Continue establishing the story." };
  }

  const forceMap = computeForceSnapshots(scenes);
  const recentScenes = scenes.slice(-FORCE_WINDOW_SIZE);
  const recentForces = recentScenes
    .map((s) => forceMap[s.id])
    .filter(Boolean) as ForceSnapshot[];

  if (recentForces.length === 0) {
    return { dominant: "balanced", recommendation: "Continue with current approach." };
  }

  // Average forces over recent window
  const avg = {
    fate: recentForces.reduce((s, f) => s + f.fate, 0) / recentForces.length,
    world: recentForces.reduce((s, f) => s + f.world, 0) / recentForces.length,
    system: recentForces.reduce((s, f) => s + f.system, 0) / recentForces.length,
  };

  // Find dominant force (if any is significantly higher)
  const max = Math.max(avg.fate, avg.world, avg.system);
  const min = Math.min(avg.fate, avg.world, avg.system);
  const spread = max - min;

  if (spread < 0.5) {
    return { dominant: "balanced", recommendation: "Good balance across all forces. Continue holistic storytelling." };
  }

  if (avg.fate === max) {
    return {
      dominant: "fate",
      recommendation: "Heavy on thread progression. Slow down — develop character inner worlds and ground the story in world details.",
    };
  }
  if (avg.world === max) {
    return {
      dominant: "world",
      recommendation: "Heavy on character development. Advance threads — create consequences and move toward resolution.",
    };
  }
  return {
    dominant: "system",
    recommendation: "Heavy on world-building. Ground it in character and story — use the rules to drive conflict, not just exposition.",
  };
}

// ── Story Phase ──────────────────────────────────────────────────────────────

const PHASE_RANGES: Record<StoryPhase, [number, number]> = {
  setup: [0, 0.15],
  rising: [0.15, 0.35],
  midpoint: [0.35, 0.5],
  escalation: [0.5, 0.75],
  climax: [0.75, 0.9],
  resolution: [0.9, 1.0],
};

const PHASE_GUIDANCE: Record<StoryPhase, string> = {
  setup: "Establish characters, world, and initial threads. Plant seeds — do not harvest them. Focus on world-building and character introduction.",
  rising: "Complications emerge. Threads should advance from seeded to active. Alternate tension with quieter character moments.",
  midpoint: "A significant shift — revelation, betrayal, or escalation. One thread should reach escalating or critical status.",
  escalation: "Building toward climax. Multiple threads should be escalating. Increase pressure but maintain breathing room.",
  climax: "Peak intensity. Resolve critical threads. Character inner worlds should pay off. Maximum convergence of all forces.",
  resolution: "Wind down. Resolve remaining threads. Focus on aftermath and character growth. Lower intensity.",
};

export function getStoryPhase(progress: number): StoryPhase {
  for (const [phase, [start, end]] of Object.entries(PHASE_RANGES) as [StoryPhase, [number, number]][]) {
    if (progress >= start && progress < end) return phase;
  }
  return "resolution";
}

// ── Progress Calculation ─────────────────────────────────────────────────────

export function computeStoryProgress(
  narrative: NarrativeState,
  resolvedKeys: string[],
  config: AutoConfig,
  startingSceneCount: number,
  startingArcCount: number,
): number {
  const hasManualOnly =
    config.endConditions.length === 1 &&
    config.endConditions[0].type === "manual_stop";

  if (hasManualOnly || config.endConditions.length === 0) {
    // Repeating seasonal cycle for open-ended stories
    const arcCount = Object.keys(narrative.arcs).length - startingArcCount;
    return (arcCount % AUTO_STOP_CYCLE_LENGTH) / AUTO_STOP_CYCLE_LENGTH;
  }

  let maxProgress = 0;
  for (const cond of config.endConditions) {
    let progress = 0;
    switch (cond.type) {
      case "scene_count": {
        const scenesThisRun = resolvedKeys.length - startingSceneCount;
        progress = Math.min(1, scenesThisRun / Math.max(cond.target, 1));
        break;
      }
      case "arc_count": {
        const arcsThisRun = Object.keys(narrative.arcs).length - startingArcCount;
        progress = Math.min(1, arcsThisRun / Math.max(cond.target, 1));
        break;
      }
    }
    maxProgress = Math.max(maxProgress, progress);
  }
  return maxProgress;
}

// ── End Condition Check ──────────────────────────────────────────────────────

export function checkEndConditions(
  narrative: NarrativeState,
  resolvedKeys: string[],
  config: AutoConfig,
  startingSceneCount = 0,
  startingArcCount = 0,
  activeBranchId?: string,
): AutoEndCondition | null {
  for (const cond of config.endConditions) {
    switch (cond.type) {
      case "scene_count": {
        const scenesThisRun = resolvedKeys.length - startingSceneCount;
        if (scenesThisRun >= cond.target) {
          logInfo(`Auto-play end condition met: scene_count`, {
            source: "auto-play",
            operation: "check-end-conditions",
            details: { type: "scene_count", target: cond.target, scenesGenerated: scenesThisRun },
          });
          return cond;
        }
        break;
      }
      case "all_threads_resolved": {
        const threads = Object.values(narrative.threads);
        if (threads.length > 0 && threads.every((t) => TERMINAL_SET.has(t.status.toLowerCase()))) {
          logInfo(`Auto-play end condition met: all_threads_resolved`, {
            source: "auto-play",
            operation: "check-end-conditions",
            details: { type: "all_threads_resolved", threadCount: threads.length },
          });
          return cond;
        }
        break;
      }
      case "arc_count": {
        const arcsThisRun = Object.keys(narrative.arcs).length - startingArcCount;
        if (arcsThisRun >= cond.target) return cond;
        break;
      }
      case "planning_complete": {
        const activeBranch = activeBranchId ? narrative.branches[activeBranchId] : undefined;
        const pq = activeBranch?.planningQueue;
        if (pq) {
          const allDone = pq.phases.every((p) => p.status === "completed");
          if (allDone) {
            logInfo(`Auto-play end condition met: planning_complete`, {
              source: "auto-play",
              operation: "check-end-conditions",
              details: { type: "planning_complete", phaseCount: pq.phases.length },
            });
            return cond;
          }
        }
        break;
      }
      case "manual_stop":
        break;
    }
  }
  return null;
}

// ── Main Evaluation ──────────────────────────────────────────────────────────

export function evaluateNarrativeState(
  narrative: NarrativeState,
  resolvedKeys: string[],
  _currentIndex: number,
  config: AutoConfig,
  startingSceneCount = 0,
  startingArcCount = 0,
): AutoDirective {
  const scenes = resolvedKeys
    .map((k) => narrative.scenes[k])
    .filter(Boolean)
    .filter(isScene) as Scene[];

  // Compute progress and phase
  const progress = computeStoryProgress(
    narrative,
    resolvedKeys,
    config,
    startingSceneCount,
    startingArcCount,
  );
  const phase = getStoryPhase(progress);

  // Analyze all three dimensions
  const pressure: NarrativePressure = {
    threads: analyzeThreads(narrative, scenes),
    entities: analyzeEntities(narrative, scenes),
    knowledge: analyzeKnowledge(narrative, scenes),
    balance: analyzeBalance(scenes),
  };

  // Build directive
  const directive = buildDirective(narrative, config, phase, pressure);

  logInfo(`Auto-play evaluation complete`, {
    source: "auto-play",
    operation: "evaluate-narrative-state",
    details: {
      phase,
      progress: Math.round(progress * 100),
      activeThreads: pressure.threads.activeCount,
      staleThreads: pressure.threads.stale.length,
      primedThreads: pressure.threads.primed.length,
      shallowCharacters: pressure.entities.shallow.length,
      neglectedAnchors: pressure.entities.neglected.length,
      balance: pressure.balance.dominant,
    },
  });

  return { phase, progress, pressure, directive };
}

// ── Directive Builder ────────────────────────────────────────────────────────

function buildDirective(
  narrative: NarrativeState,
  config: AutoConfig,
  phase: StoryPhase,
  pressure: NarrativePressure,
): string {
  const sections: string[] = [];

  // 1. Story phase
  sections.push(`## Story Phase: ${phase.toUpperCase()} (${Math.round(pressure.balance.dominant === "balanced" ? 50 : 0)}% through arc)`);
  sections.push(PHASE_GUIDANCE[phase]);

  // 2. Thread management
  sections.push("\n## Thread Management");
  if (pressure.threads.primed.length > 0) {
    const primedList = pressure.threads.primed
      .slice(0, 3)
      .map((t) => `- "${t.description}" [${t.status}]`)
      .join("\n");
    sections.push(`PRIMED FOR RESOLUTION — these threads are ready for payoff:\n${primedList}`);
  }
  if (pressure.threads.stale.length > 0) {
    const staleList = pressure.threads.stale
      .slice(0, 3)
      .map((t) => `- "${t.description}" [${t.status}]`)
      .join("\n");
    sections.push(`STALE THREADS — need advancement or resolution:\n${staleList}`);
  }
  if (pressure.threads.needsResolution) {
    sections.push(`TOO MANY ACTIVE THREADS (${pressure.threads.activeCount}) — focus on resolution, not seeding new threads.`);
  }
  if (pressure.threads.needsSeeding) {
    sections.push(`TOO FEW ACTIVE THREADS (${pressure.threads.activeCount}) — seed or activate new threads.`);
  }

  // 3. Character development
  sections.push("\n## Character Inner Worlds");
  if (pressure.entities.shallow.length > 0) {
    const shallowList = pressure.entities.shallow
      .slice(0, 3)
      .map((c) => `- ${c.name}`)
      .join("\n");
    sections.push(`UNDERDEVELOPED CHARACTERS — need continuity depth (beliefs, traits, history, goals):\n${shallowList}`);
  }
  if (pressure.entities.neglected.length > 0) {
    const neglectedList = pressure.entities.neglected
      .slice(0, 3)
      .map((c) => `- ${c.name}`)
      .join("\n");
    sections.push(`NEGLECTED ANCHORS — haven't appeared recently:\n${neglectedList}`);
  }
  if (pressure.entities.recentGrowth < 2) {
    sections.push("LOW CHARACTER DEVELOPMENT — recent scenes lack continuity mutations. Deepen character inner worlds.");
  }

  // 4. World knowledge
  sections.push("\n## World Knowledge");
  if (pressure.knowledge.isStagnant) {
    sections.push("WORLD-BUILDING STAGNANT — introduce new rules, systems, or concepts. Expand what we know about how this world works.");
  }

  // 5. Balance recommendation
  sections.push("\n## Balance");
  sections.push(pressure.balance.recommendation);

  // 6. User-provided guidance
  if (config.direction) {
    sections.push(`\n## Direction\n${config.direction}`);
  }
  if (config.toneGuidance) {
    sections.push(`\n## Tone\n${config.toneGuidance}`);
  }
  if (config.narrativeConstraints) {
    sections.push(`\n## Constraints\n${config.narrativeConstraints}`);
  }

  return sections.join("\n");
}

// ── Arc Length Selection ─────────────────────────────────────────────────────

export function pickArcLength(config: AutoConfig, pressure: NarrativePressure): number {
  // Primed threads ready for resolution → shorter, focused arcs
  if (pressure.threads.primed.length >= 2) {
    return config.minArcLength;
  }
  // Too many active threads → medium arcs to manage complexity
  if (pressure.threads.needsResolution) {
    return Math.ceil((config.minArcLength + config.maxArcLength) / 2);
  }
  // Character development needed → longer arcs for breathing room
  if (pressure.entities.shallow.length > 0 || pressure.entities.recentGrowth < 2) {
    return config.maxArcLength;
  }
  // Default to medium
  return Math.ceil((config.minArcLength + config.maxArcLength) / 2);
}

// ── Legacy exports for compatibility ─────────────────────────────────────────

export type DirectiveContext = {
  scenes: Scene[];
  storyProgress: number;
  storyPhase: { name: StoryPhase; description: string };
};

export function buildOutlineDirective(
  narrative: NarrativeState,
  config: AutoConfig,
  ctx: DirectiveContext,
): string {
  const scenes = ctx.scenes;
  const pressure: NarrativePressure = {
    threads: analyzeThreads(narrative, scenes),
    entities: analyzeEntities(narrative, scenes),
    knowledge: analyzeKnowledge(narrative, scenes),
    balance: analyzeBalance(scenes),
  };
  return buildDirective(narrative, config, ctx.storyPhase.name, pressure);
}
