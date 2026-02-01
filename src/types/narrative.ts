// ── Thread ───────────────────────────────────────────────────────────────────
export type ThreadStatus = string;

export type ThreadAnchor = {
  id: string;
  type: 'character' | 'location';
};

export type Thread = {
  id: string;
  anchors: ThreadAnchor[];
  description: string;
  status: ThreadStatus;
  openedAt: string;
  dependents: string[];
};

// ── Character ────────────────────────────────────────────────────────────────
export type CharacterRole = 'anchor' | 'recurring' | 'transient';

export type KnowledgeNodeType = string;
export type KnowledgeEdgeType = string;

export type KnowledgeNode = {
  id: string;
  type: KnowledgeNodeType;
  content: string;
};

export type KnowledgeEdge = {
  from: string;
  to: string;
  type: KnowledgeEdgeType;
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type Character = {
  id: string;
  name: string;
  role: CharacterRole;
  knowledge: KnowledgeGraph;
  threadIds: string[];
};

// ── Location ─────────────────────────────────────────────────────────────────
export type Location = {
  id: string;
  name: string;
  parentId: string | null;
  threadIds: string[];
  knowledge: KnowledgeGraph;
};

export type RelationshipEdge = {
  from: string;
  to: string;
  type: string;
  valence: number;
};

// ── Scene & Arc ─────────────────────────────────────────────────────────────
export type ThreadMutation = {
  threadId: string;
  from: string;
  to: string;
};

export type KnowledgeMutation = {
  characterId: string;
  nodeId: string;
  action: 'added' | 'removed';
  content: string;
  /** LLM-suggested type describing this specific knowledge (e.g. "tactical_insight", "betrayal_discovered") */
  nodeType?: string;
};

export type RelationshipMutation = {
  from: string;
  to: string;
  type: string;
  valenceDelta: number;
};

export type ForceSnapshot = {
  pressure: number;
  momentum: number;
  flux: number;
};

// ── Narrative Cube (§3.2 The Eight Narrative Extremes) ──────────────────────
// The three forces (P·M·F) define a cube. Each corner is a recognisable state.
export type CubeCornerKey =
  | 'HHH' | 'HHL' | 'HLH' | 'HLL'
  | 'LHH' | 'LHL' | 'LLH' | 'LLL';

export type CubeCorner = {
  key: CubeCornerKey;
  name: string;
  description: string;
  forces: ForceSnapshot;
};

export const NARRATIVE_CUBE: Record<CubeCornerKey, CubeCorner> = {
  HHH: {
    key: 'HHH',
    name: 'Peak Crisis',
    description: 'All forces at maximum. High stakes discharging at full pace in unstable conditions. Climactic sequences in unfamiliar territory.',
    forces: { pressure: 1, momentum: 1, flux: 1 },
  },
  HHL: {
    key: 'HHL',
    name: 'Climax',
    description: 'High stakes and high pace on stable, familiar ground. The archetypal payoff scene — maximum reader investment with clear orientation.',
    forces: { pressure: 1, momentum: 1, flux: 0 },
  },
  HLH: {
    key: 'HLH',
    name: 'Slow Burn',
    description: 'High pressure with low pace in uncertain conditions. Stakes are present but action is withheld — tension through restraint and ambiguity.',
    forces: { pressure: 1, momentum: 0, flux: 1 },
  },
  HLL: {
    key: 'HLL',
    name: 'Locked In',
    description: 'High pressure, low pace, stable world. Everything is loaded but static — characters endure, suppress, or wait. Pre-climactic tension.',
    forces: { pressure: 1, momentum: 0, flux: 0 },
  },
  LHH: {
    key: 'LHH',
    name: 'Exploration',
    description: 'Fast pace through unstable new territory with low stakes. Discovery-driven sequences — world-building arcs, early adventure, open possibility space.',
    forces: { pressure: 0, momentum: 1, flux: 1 },
  },
  LHL: {
    key: 'LHL',
    name: 'Cruise',
    description: 'High pace, low stakes, stable ground. Routine action among known elements — training, travel, episodic sequences. Efficient narrative throughput.',
    forces: { pressure: 0, momentum: 1, flux: 0 },
  },
  LLH: {
    key: 'LLH',
    name: 'Liminal',
    description: 'Low pace and low stakes in unfamiliar conditions. Contemplative or transitional — characters in new environments without clear direction.',
    forces: { pressure: 0, momentum: 0, flux: 1 },
  },
  LLL: {
    key: 'LLL',
    name: 'Rest',
    description: 'All forces at minimum. Familiar world, no pressure, no urgency. Recovery and seed-planting — necessary breathing room after high-intensity sequences.',
    forces: { pressure: 0, momentum: 0, flux: 0 },
  },
};

export type ExpansionManifest = {
  characterIds: string[];
  locationIds: string[];
  threadIds: string[];
  relationshipCount: number;
};

export type Scene = {
  kind: 'scene';
  id: string;
  arcId: string;
  locationId: string;
  participantIds: string[];
  /** Characters who move in this scene — characterId → new locationId. Only include deltas. */
  characterMovements?: Record<string, string>;
  events: string[];
  threadMutations: ThreadMutation[];
  knowledgeMutations: KnowledgeMutation[];
  relationshipMutations: RelationshipMutation[];
  forceSnapshot: ForceSnapshot;
  prose: string;
  summary: string;
};

export type WorldBuildCommit = {
  kind: 'world_build';
  id: string;
  summary: string;
  expansionManifest: ExpansionManifest;
};

/** A timeline entry is either a narrative scene or a world-building commit */
export type TimelineEntry = Scene | WorldBuildCommit;

export function isScene(entry: TimelineEntry): entry is Scene {
  return entry.kind === 'scene';
}

export function isWorldBuild(entry: TimelineEntry): entry is WorldBuildCommit {
  return entry.kind === 'world_build';
}

export type Arc = {
  id: string;
  name: string;
  sceneIds: string[];
  develops: string[];
  /** Locations this arc focuses on — determines the spatial graph shown */
  locationIds: string[];
  /** Characters active in this arc — determined by location + thread anchors */
  activeCharacterIds: string[];
  /** Starting positions — characterId → locationId. Established at arc start. */
  initialCharacterLocations: Record<string, string>;
};

// ── Branch ───────────────────────────────────────────────────────────────────
export type Branch = {
  id: string;
  name: string;
  parentBranchId: string | null;
  /** Entry where this branch diverges from its parent (null for root) */
  forkEntryId: string | null;
  /** Ordered timeline entry IDs (scenes + world builds) owned by this branch */
  entryIds: string[];
  createdAt: number;
};

// ── Commit ───────────────────────────────────────────────────────────────────
export type Commit = {
  id: string;
  parentId: string | null;
  sceneId: string;
  arcId: string;
  diffName: string;
  threadMutations: ThreadMutation[];
  knowledgeMutations: KnowledgeMutation[];
  relationshipMutations: RelationshipMutation[];
  forceDeltas: ForceSnapshot;
  authorOverride: string | null;
  createdAt: number;
};

// ── Narrative State ──────────────────────────────────────────────────────────
export type ControlMode = 'auto' | 'manual';

export type NarrativeState = {
  id: string;
  title: string;
  description: string;
  characters: Record<string, Character>;
  locations: Record<string, Location>;
  threads: Record<string, Thread>;
  arcs: Record<string, Arc>;
  scenes: Record<string, Scene>;
  worldBuilds: Record<string, WorldBuildCommit>;
  branches: Record<string, Branch>;
  commits: Commit[];
  relationships: RelationshipEdge[];
  worldSummary: string;
  controlMode: ControlMode;
  activeForces: ForceSnapshot;
  createdAt: number;
  updatedAt: number;
};

/** Look up a timeline entry (scene or world build) by ID */
export function resolveEntry(n: NarrativeState, id: string): TimelineEntry | null {
  return n.scenes[id] ?? n.worldBuilds[id] ?? null;
}

export type NarrativeEntry = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  sceneCount: number;
  coverThread: string;
};

// ── Auto Mode ───────────────────────────────────────────────────────────────

export type AutoEndCondition =
  | { type: 'scene_count'; target: number }
  | { type: 'all_threads_resolved' }
  | { type: 'arc_count'; target: number }
  | { type: 'manual_stop' };

export type AutoAction =
  | 'generate_arc'
  | 'expand_world'
  | 'resolve_thread'
  | 'escalate_toward_climax'
  | 'introduce_complication'
  | 'quiet_interlude';

export type AutoActionWeight = {
  action: AutoAction;
  score: number;
  reason: string;
};

export type PacingProfile = 'deliberate' | 'balanced' | 'urgent' | 'chaotic';

export type WorldBuildMode = 'off' | 'light' | 'moderate' | 'heavy';

export type AutoConfig = {
  endConditions: AutoEndCondition[];
  pacingProfile: PacingProfile;
  minArcLength: number;
  maxArcLength: number;
  worldBuildMode: WorldBuildMode;
  maxActiveThreads: number;
  threadStagnationThreshold: number;
  arcDirectionPrompt: string;
  toneGuidance: string;
  narrativeConstraints: string;
  characterRotationEnabled: boolean;
  minScenesBetweenCharacterFocus: number;
};

export type AutoRunLog = {
  cycle: number;
  timestamp: number;
  action: AutoAction;
  reason: string;
  scenesGenerated: number;
  worldExpanded: boolean;
  endConditionMet: AutoEndCondition | null;
};

export type AutoRunState = {
  isRunning: boolean;
  isPaused: boolean;
  currentCycle: number;
  totalScenesGenerated: number;
  totalWorldExpansions: number;
  log: AutoRunLog[];
};

// ── App State ────────────────────────────────────────────────────────────────
export type InspectorContext =
  | { type: 'scene'; sceneId: string }
  | { type: 'character'; characterId: string }
  | { type: 'location'; locationId: string }
  | { type: 'thread'; threadId: string }
  | { type: 'arc'; arcId: string };

export type WizardStep = 'premise' | 'world-gen' | 'thread-selection' | 'confirm';

export type GraphViewMode = 'scene' | 'overview';

export type AppState = {
  narratives: NarrativeEntry[];
  activeNarrativeId: string | null;
  activeNarrative: NarrativeState | null;
  controlMode: ControlMode;
  isPlaying: boolean;
  currentSceneIndex: number;
  activeBranchId: string | null;
  /** Resolved scene keys for the active branch (inherited + own) */
  resolvedSceneKeys: string[];
  inspectorContext: InspectorContext | null;
  wizardOpen: boolean;
  wizardStep: WizardStep;
  selectedKnowledgeEntity: string | null;
  autoTimer: number;
  graphViewMode: GraphViewMode;
  autoConfig: AutoConfig;
  autoRunState: AutoRunState | null;
};
