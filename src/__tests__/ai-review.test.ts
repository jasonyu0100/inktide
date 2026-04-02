import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NarrativeState, Scene, PlanningPhase, Thread, Character, Location } from '@/types/narrative';
import { DEFAULT_STORY_SETTINGS } from '@/types/narrative';

// Mock the AI module
vi.mock('@/lib/ai/api', () => ({
  callGenerate: vi.fn(),
  SYSTEM_PROMPT: 'Test system prompt',
}));

// Mock context building
vi.mock('@/lib/ai/context', () => ({
  branchContext: vi.fn().mockReturnValue('Mock branch context'),
}));

// Mock prompts
vi.mock('@/lib/ai/prompts', () => ({
  buildThreadHealthPrompt: vi.fn().mockReturnValue('Mock thread health prompt'),
  buildCompletedBeatsPrompt: vi.fn().mockReturnValue('Mock completed beats prompt'),
}));

import { refreshDirection } from '@/lib/ai/review';
import { callGenerate } from '@/lib/ai/api';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function createScene(id: string, overrides: Partial<Scene> = {}): Scene {
  return {
    kind: 'scene',
    id,
    arcId: 'arc-1',
    povId: 'char-1',
    locationId: 'loc-1',
    participantIds: ['char-1'],
    summary: `Scene ${id} summary`,
    events: ['Event 1', 'Event 2'],
    threadMutations: [],
    continuityMutations: [],
    relationshipMutations: [],
    characterMovements: {},
    ...overrides,
  };
}

function createThread(id: string, overrides: Partial<Thread> = {}): Thread {
  return {
    id,
    description: `Thread ${id} description`,
    status: 'active',
    participants: [],
    dependents: [],
    openedAt: 's1',
    ...overrides,
  };
}

function createCharacter(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    name: `Character ${id}`,
    role: 'recurring',
    continuity: { nodes: [] },
    threadIds: [],
    ...overrides,
  };
}

function createLocation(id: string, overrides: Partial<Location> = {}): Location {
  return {
    id,
    name: `Location ${id}`,
    parentId: null,
    continuity: { nodes: [] },
    threadIds: [],
    ...overrides,
  };
}

function createMinimalNarrative(): NarrativeState {
  return {
    id: 'N-001',
    title: 'Test Narrative',
    description: 'A test story',
    characters: {
      'char-1': createCharacter('char-1', { name: 'Alice' }),
    },
    locations: {
      'loc-1': createLocation('loc-1', { name: 'Castle' }),
    },
    threads: {
      'T-001': createThread('T-001', { description: 'Main mystery' }),
    },
    artifacts: {},
    scenes: {},
    arcs: {},
    worldBuilds: {},
    branches: {
      main: {
        id: 'main',
        name: 'Main',
        parentBranchId: null,
        forkEntryId: null,
        entryIds: [],
        createdAt: Date.now(),
      },
    },
    relationships: [],
    worldKnowledge: { nodes: {}, edges: [] },
    worldSummary: '',
    rules: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createPlanningPhase(overrides: Partial<PlanningPhase> = {}): PlanningPhase {
  return {
    id: 'phase-1',
    name: 'Test Phase',
    objective: 'Test objective',
    status: 'active',
    sceneAllocation: 10,
    scenesCompleted: 4,
    constraints: 'No deaths',
    worldExpansionHints: '',
    direction: '',
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── refreshDirection Tests ───────────────────────────────────────────────────

describe('refreshDirection', () => {
  it('returns parsed direction and constraints from LLM response', async () => {
    const mockResponse = JSON.stringify({
      direction: 'New direction for the next arc',
      constraints: 'Do not kill the protagonist',
      sceneBudget: { 'T-001': 2, 'T-002': 1 },
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    expect(result.direction).toContain('New direction for the next arc');
    expect(result.constraints).toBe('Do not kill the protagonist');
    expect(result.sceneBudget).toEqual({ 'T-001': 2, 'T-002': 1 });
  });

  it('appends scene budget to direction', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Push the story forward',
      constraints: 'Constraints here',
      sceneBudget: { 'T-001': 3, 'T-002+T-003': 2 },
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    expect(result.direction).toContain('SCENE BUDGET');
    expect(result.direction).toContain('T-001: 3 scenes');
    expect(result.direction).toContain('T-002+T-003: 2 scenes');
  });

  it('handles singular scene in budget', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
      sceneBudget: { 'T-001': 1 },
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    expect(result.direction).toContain('T-001: 1 scene');
    expect(result.direction).not.toContain('1 scenes');
  });

  it('falls back to current direction/constraints on parse failure', async () => {
    vi.mocked(callGenerate).mockResolvedValue('Invalid JSON response');

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Fallback direction', 'Fallback constraints',
    );

    expect(result.direction).toBe('Fallback direction');
    expect(result.constraints).toBe('Fallback constraints');
    expect(result.sceneBudget).toBeUndefined();
  });

  it('uses source text mode when phase has sourceText', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Source-based direction',
      constraints: 'Source constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase({
      sourceText: 'Chapter 1: The hero begins their journey...',
    });

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('SOURCE MATERIAL');
    expect(promptArg).toContain('Chapter 1: The hero begins their journey');
  });

  it('uses analytical mode when phase has no sourceText', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Analytical direction',
      constraints: 'Analytical constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase({ sourceText: undefined });

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('THREAD COMPRESSION AUDIT');
    expect(promptArg).toContain('showrunner');
  });

  it('includes thread resolution speed in prompt', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    narrative.storySettings = { ...DEFAULT_STORY_SETTINGS, threadResolutionSpeed: 'fast' };
    const phase = createPlanningPhase();

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('PACING MODE: FAST');
    expect(promptArg).toContain('thriller');
  });

  it('includes moderate pacing by default', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('PACING MODE: BALANCED');
  });

  it('includes slow pacing mode', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    narrative.storySettings = { ...DEFAULT_STORY_SETTINGS, threadResolutionSpeed: 'slow' };
    const phase = createPlanningPhase();

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('PACING MODE: SLOW BURN');
  });

  it('includes phase constraints in prompt', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase({
      constraints: 'No character deaths before the climax',
    });

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('No character deaths before the climax');
  });

  it('includes structural rules in prompt', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase({
      structuralRules: 'Maintain protagonist gravity above 60%',
    });

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('STRUCTURAL RULES');
    expect(promptArg).toContain('protagonist gravity above 60%');
  });

  it('calculates scenes remaining correctly', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase({
      sceneAllocation: 20,
      scenesCompleted: 8,
    });

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('12 scenes left'); // 20 - 8
  });

  it('includes phase progress block when source text and scenes exist', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    narrative.scenes = {
      'S-001': createScene('S-001', { summary: 'Hero arrives at castle' }),
      'S-002': createScene('S-002', {
        summary: 'First encounter',
        threadMutations: [{ threadId: 'T-001', from: 'dormant', to: 'active' }],
      }),
    };
    const phase = createPlanningPhase({
      sourceText: 'Source material here',
      scenesCompleted: 2,
    });

    await refreshDirection(
      narrative, ['S-001', 'S-002'], 1, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    expect(promptArg).toContain('PHASE PROGRESS');
    expect(promptArg).toContain('Hero arrives at castle');
    expect(promptArg).toContain('CURRENT POSITION');
  });

  it('skips phase progress block when no scenes completed', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase({
      sourceText: 'Source material here',
      scenesCompleted: 0,
    });

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    const promptArg = vi.mocked(callGenerate).mock.calls[0][0];
    // Should not have the actual phase progress block (which starts with "PHASE PROGRESS — N of M scenes")
    expect(promptArg).not.toContain('PHASE PROGRESS — 0 of');
    expect(promptArg).not.toContain('ALREADY BEEN WRITTEN');
  });

  it('handles empty scene budget', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction without budget',
      constraints: 'Constraints',
      sceneBudget: {},
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    expect(result.direction).toBe('Direction without budget');
    expect(result.direction).not.toContain('SCENE BUDGET');
  });

  it('handles missing scene budget', async () => {
    const mockResponse = JSON.stringify({
      direction: 'Direction',
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    expect(result.direction).toBe('Direction');
    expect(result.sceneBudget).toBeUndefined();
  });

  it('coerces direction to string', async () => {
    const mockResponse = JSON.stringify({
      direction: ['Array', 'of', 'strings'],
      constraints: 'Constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    // String() on an array gives comma-separated values
    expect(typeof result.direction).toBe('string');
  });

  it('preserves current direction when parsed direction is falsy', async () => {
    const mockResponse = JSON.stringify({
      direction: '',
      constraints: 'New constraints',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Keep this direction', 'Old constraints',
    );

    expect(result.direction).toBe('Keep this direction');
    expect(result.constraints).toBe('New constraints');
  });

  it('preserves current constraints when parsed constraints is falsy', async () => {
    const mockResponse = JSON.stringify({
      direction: 'New direction',
      constraints: '',
    });
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    const result = await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Keep these constraints',
    );

    expect(result.direction).toContain('New direction');
    expect(result.constraints).toBe('Keep these constraints');
  });

  it('calls callGenerate with correct caller tag', async () => {
    vi.mocked(callGenerate).mockResolvedValue(JSON.stringify({
      direction: 'Dir',
      constraints: 'Con',
    }));

    const narrative = createMinimalNarrative();
    const phase = createPlanningPhase();

    await refreshDirection(
      narrative, [], 0, phase,
      'Old direction', 'Old constraints',
    );

    // Check the 4th argument (index 3) which is the caller tag
    // callGenerate(prompt, SYSTEM_PROMPT, maxTokens, 'refreshDirection', model, reasoningBudget)
    expect(vi.mocked(callGenerate).mock.calls[0][3]).toBe('refreshDirection');
  });
});
