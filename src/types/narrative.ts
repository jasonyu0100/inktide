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

export type Scene = {
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
  commits: Commit[];
  relationships: RelationshipEdge[];
  worldSummary: string;
  controlMode: ControlMode;
  activeForces: ForceSnapshot;
  createdAt: number;
  updatedAt: number;
};

export type NarrativeEntry = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  sceneCount: number;
  coverThread: string;
};

// ── App State ────────────────────────────────────────────────────────────────
export type InspectorContext =
  | { type: 'scene'; sceneId: string }
  | { type: 'character'; characterId: string }
  | { type: 'location'; locationId: string }
  | { type: 'thread'; threadId: string };

export type WizardStep = 'premise' | 'world-gen' | 'thread-selection' | 'confirm';

export type AppState = {
  narratives: NarrativeEntry[];
  activeNarrativeId: string | null;
  activeNarrative: NarrativeState | null;
  controlMode: ControlMode;
  isPlaying: boolean;
  currentSceneIndex: number;
  inspectorContext: InspectorContext | null;
  wizardOpen: boolean;
  wizardStep: WizardStep;
  selectedKnowledgeEntity: string | null;
  autoTimer: number;
};
