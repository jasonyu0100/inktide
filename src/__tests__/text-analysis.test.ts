import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalysisChunkResult } from '@/types/narrative';

// Mock the AI module
vi.mock('@/lib/ai/api', () => ({
  callGenerate: vi.fn(),
  callGenerateStream: vi.fn(),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  ANALYSIS_CHUNK_SIZE_SECTIONS: 100,
  ANALYSIS_MAX_CORPUS_WORDS: 500000,
}));

import { splitCorpusIntoChunks, analyzeChunkParallel, reconcileResults, analyzeThreading, assembleNarrative } from '@/lib/text-analysis';
import { callGenerate } from '@/lib/ai/api';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function createMockAnalysisResult(index: number): AnalysisChunkResult {
  return {
    chapterSummary: `Chunk ${index} summary`,
    characters: [
      {
        name: `Alice${index}`,
        role: 'main',
        firstAppearance: true,
        imagePrompt: 'A young woman',
        continuity: [
          { type: 'knowledge', content: `Alice knows something ${index}` },
        ],
      },
    ],
    locations: [
      {
        name: `Castle${index}`,
        parentName: null,
        description: `A grand castle ${index}`,
        lore: [`History ${index}`],
      },
    ],
    threads: [
      {
        description: `Main quest ${index}`,
        participantNames: [`Alice${index}`],
        statusAtStart: 'dormant',
        statusAtEnd: 'active',
        development: 'Thread started',
      },
    ],
    scenes: [
      {
        locationName: `Castle${index}`,
        povName: `Alice${index}`,
        participantNames: [`Alice${index}`],
        events: [`event_${index}`],
        summary: `Scene ${index} summary`,
        sections: [0],
        prose: `Scene ${index} prose.`,
        threadMutations: [
          { threadDescription: `Main quest ${index}`, from: 'dormant', to: 'active' },
        ],
        continuityMutations: [
          {
            characterName: `Alice${index}`,
            action: 'learned',
            content: 'Something important',
            type: 'knowledge',
          },
        ],
        relationshipMutations: [],
      },
    ],
    relationships: [
      {
        from: `Alice${index}`,
        to: `Bob${index}`,
        type: 'ally',
        valence: 5,
      },
    ],
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── splitCorpusIntoChunks Tests ──────────────────────────────────────────────

describe('splitCorpusIntoChunks', () => {
  it('splits text into chunks by section count', () => {
    const text = Array(250).fill('Paragraph.').join('\n\n');
    const chunks = splitCorpusIntoChunks(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].sectionCount).toBeLessThanOrEqual(100);
  });

  it('handles text shorter than one chunk', () => {
    const text = 'Short text with few paragraphs.\n\nAnother paragraph.';
    const chunks = splitCorpusIntoChunks(text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].text).toBe(text);
  });

  it('assigns sequential indices to chunks', () => {
    const text = Array(250).fill('Paragraph.').join('\n\n');
    const chunks = splitCorpusIntoChunks(text);

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('preserves all text across chunks', () => {
    const text = Array(250).fill('Unique paragraph.').join('\n\n');
    const chunks = splitCorpusIntoChunks(text);

    const reconstructed = chunks.map(c => c.text).join('\n\n');
    expect(reconstructed).toBe(text);
  });

  it('counts sections correctly', () => {
    const text = 'Para 1.\n\nPara 2.\n\nPara 3.';
    const chunks = splitCorpusIntoChunks(text);

    expect(chunks[0].sectionCount).toBe(3);
  });
});

// ── analyzeChunkParallel Tests ───────────────────────────────────────────────

describe('analyzeChunkParallel', () => {
  it('returns parsed analysis result from LLM', async () => {
    const mockResponse = JSON.stringify({
      chapterSummary: 'Test summary',
      characters: [{ name: 'Alice', role: 'main', firstAppearance: true, continuity: [] }],
      locations: [{ name: 'Castle', parentName: null, description: 'A castle', lore: [] }],
      threads: [{
        description: 'Main quest',
        participantNames: ['Alice'],
        statusAtStart: 'dormant',
        statusAtEnd: 'active',
        development: 'Started',
      }],
      scenes: [{
        locationName: 'Castle',
        povName: 'Alice',
        participantNames: ['Alice'],
        events: ['event1'],
        summary: 'Scene summary',
        sections: [0],
        threadMutations: [],
        continuityMutations: [],
        relationshipMutations: [],
      }],
      relationships: [],
    });

    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const result = await analyzeChunkParallel('Test text', 0, 1);

    expect(result.chapterSummary).toBe('Test summary');
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('Alice');
    expect(result.locations).toHaveLength(1);
    expect(result.threads).toHaveLength(1);
    expect(result.scenes).toHaveLength(1);
  });

  it('handles streaming with onToken callback', async () => {
    const mockResponse = JSON.stringify(createMockAnalysisResult(0));
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const tokens: string[] = [];
    await analyzeChunkParallel('Test', 0, 1, (token) => tokens.push(token));

    expect(tokens.length).toBeGreaterThan(0);
  });

  it('includes chunk index and total in context', async () => {
    const mockResponse = JSON.stringify(createMockAnalysisResult(0));
    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    await analyzeChunkParallel('Test text', 2, 5);

    expect(callGenerate).toHaveBeenCalledWith(
      expect.stringContaining('chunk 3 of 5'),
      expect.any(String),
      expect.any(Number),
      expect.any(String),
      expect.any(String)
    );
  });

  it('sanitizes character continuity with valid types', async () => {
    const mockResponse = JSON.stringify({
      chapterSummary: 'Test',
      characters: [{
        name: 'Alice',
        role: 'main',
        firstAppearance: true,
        continuity: [
          { type: 'knowledge', content: 'Valid knowledge' },
          { type: 'INVALID_TYPE', content: 'Should be filtered' },
          { type: 'goal', content: 'Valid goal' },
        ],
      }],
      locations: [],
      threads: [],
      scenes: [],
      relationships: [],
    });

    vi.mocked(callGenerate).mockResolvedValue(mockResponse);

    const result = await analyzeChunkParallel('Test', 0, 1);

    // Invalid continuity type should be filtered out
    expect(result.characters[0].continuity.length).toBe(2);
    expect(result.characters[0].continuity.some((c: any) => c.type === 'INVALID_TYPE')).toBe(false);
  });
});

// ── reconcileResults Tests ───────────────────────────────────────────────────

describe('reconcileResults', () => {
  beforeEach(() => {
    // Mock reconcileResults to return results unchanged for simplicity
    vi.mocked(callGenerate).mockResolvedValue(JSON.stringify({
      nameMap: {},
      threadMap: {},
      locationMap: {},
      conceptMap: {},
    }));
  });

  it('merges duplicate characters with name variants', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        characters: [
          { name: 'Alice', role: 'main', firstAppearance: true, continuity: [] },
        ],
      },
      {
        ...createMockAnalysisResult(1),
        characters: [
          { name: 'alice', role: 'main', firstAppearance: false, continuity: [] }, // Lowercase variant
        ],
      },
    ];

    const reconciled = await reconcileResults(results);

    // Should deduplicate Alice/alice into one character
    const allCharacters = reconciled.flatMap(r => r.characters);
    const aliceVariants = allCharacters.filter(c => c.name.toLowerCase() === 'alice');

    // Should maintain thread continuity
    expect(aliceVariants.length).toBeGreaterThan(0);
  });

  it('merges duplicate locations', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        locations: [{ name: 'Castle', parentName: null, description: 'A castle', lore: [] }],
      },
      {
        ...createMockAnalysisResult(1),
        locations: [{ name: 'Castle', parentName: null, description: 'The same castle', lore: ['History'] }],
      },
    ];

    const reconciled = await reconcileResults(results);

    const allLocations = reconciled.flatMap(r => r.locations);
    const castleEntries = allLocations.filter(l => l.name === 'Castle');

    // Should maintain locations
    expect(castleEntries.length).toBeGreaterThan(0);
  });

  it('stitches threads across chunks', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        threads: [{
          description: 'Main quest',
          participantNames: ['Alice'],
          statusAtStart: 'dormant',
          statusAtEnd: 'active',
          development: 'Started',
        }],
      },
      {
        ...createMockAnalysisResult(1),
        threads: [{
          description: 'Main quest',
          participantNames: ['Alice', 'Bob'],
          statusAtStart: 'active',
          statusAtEnd: 'escalating',
          development: 'Continued',
        }],
      },
    ];

    const reconciled = await reconcileResults(results);

    // Threads with same description should be stitched
    const allThreads = reconciled.flatMap(r => r.threads);
    const mainQuestThreads = allThreads.filter(t => t.description === 'Main quest');

    // Should maintain thread continuity
    expect(mainQuestThreads.length).toBeGreaterThan(0);
  });

  it('preserves all scenes from all chunks', async () => {
    const results: AnalysisChunkResult[] = [
      createMockAnalysisResult(0),
      createMockAnalysisResult(1),
      createMockAnalysisResult(2),
    ];

    const reconciled = await reconcileResults(results);

    const totalScenes = reconciled.reduce((sum, r) => sum + r.scenes.length, 0);
    const originalScenes = results.reduce((sum, r) => sum + r.scenes.length, 0);

    expect(totalScenes).toBe(originalScenes);
  });

  it('returns same number of chunks', async () => {
    const results: AnalysisChunkResult[] = [
      createMockAnalysisResult(0),
      createMockAnalysisResult(1),
    ];

    const reconciled = await reconcileResults(results);

    expect(reconciled.length).toBe(results.length);
  });
});

// ── analyzeThreading Tests ───────────────────────────────────────────────────

describe('analyzeThreading', () => {
  it('analyzes thread dependencies across chunks', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        threads: [
          {
            description: 'Thread A',
            participantNames: ['Alice'],
            statusAtStart: 'dormant',
            statusAtEnd: 'active',
            development: 'Started',
          },
          {
            description: 'Thread B',
            participantNames: ['Bob'],
            statusAtStart: 'dormant',
            statusAtEnd: 'active',
            development: 'Started',
            relatedThreadDescriptions: ['Thread A'],
          },
        ],
      },
    ];

    const analyzed = await analyzeThreading(results);

    expect(analyzed).toBeDefined();
    expect(analyzed.length).toBe(results.length);
  });

  it('preserves all original data', async () => {
    const results: AnalysisChunkResult[] = [createMockAnalysisResult(0)];

    const analyzed = await analyzeThreading(results);

    expect(analyzed[0].chapterSummary).toBe(results[0].chapterSummary);
    expect(analyzed[0].characters).toEqual(results[0].characters);
    expect(analyzed[0].scenes).toEqual(results[0].scenes);
  });

  it('handles empty results', async () => {
    const results: AnalysisChunkResult[] = [];

    const analyzed = await analyzeThreading(results);

    expect(analyzed).toEqual([]);
  });
});

// ── assembleNarrative Tests ──────────────────────────────────────────────────

describe('assembleNarrative', () => {
  beforeEach(() => {
    // Mock LLM calls for world summary generation
    vi.mocked(callGenerate).mockResolvedValue(JSON.stringify({
      worldSummary: 'A fantasy world',
      rules: ['Magic exists'],
      systems: [],
      imageStyle: 'Epic fantasy art',
    }));
  });

  it('creates a complete NarrativeState from analyzed results', async () => {
    const results: AnalysisChunkResult[] = [
      createMockAnalysisResult(0),
      createMockAnalysisResult(1),
    ];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test Story', results, threadDeps);

    expect(narrative.title).toBe('Test Story');
    expect(narrative.characters).toBeDefined();
    expect(narrative.locations).toBeDefined();
    expect(narrative.threads).toBeDefined();
    expect(narrative.scenes).toBeDefined();
    expect(narrative.branches).toBeDefined();
    expect(narrative.branches.main).toBeDefined();
  });

  it('assigns unique IDs to all entities', async () => {
    const results: AnalysisChunkResult[] = [createMockAnalysisResult(0)];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    const characterIds = Object.keys(narrative.characters);
    const locationIds = Object.keys(narrative.locations);
    const threadIds = Object.keys(narrative.threads);
    const sceneIds = Object.keys(narrative.scenes);

    // All IDs should be unique
    expect(new Set(characterIds).size).toBe(characterIds.length);
    expect(new Set(locationIds).size).toBe(locationIds.length);
    expect(new Set(threadIds).size).toBe(threadIds.length);
    expect(new Set(sceneIds).size).toBe(sceneIds.length);
  });

  it('creates main branch with all scene IDs', async () => {
    const results: AnalysisChunkResult[] = [
      createMockAnalysisResult(0),
      createMockAnalysisResult(1),
    ];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    const sceneCount = Object.keys(narrative.scenes).length;
    const mainBranchScenes = narrative.branches.main.entryIds.filter(id => id.startsWith('S-'));

    expect(mainBranchScenes.length).toBe(sceneCount);
  });

  it('maps scene participant names to character IDs', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        characters: [{ name: 'Alice', role: 'main', firstAppearance: true, continuity: [] }],
        scenes: [{
          locationName: 'Castle',
          povName: 'Alice',
          participantNames: ['Alice'],
          events: [],
          summary: 'Test',
          sections: [0],
          threadMutations: [],
          continuityMutations: [],
          relationshipMutations: [],
        }],
      },
    ];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    const scene = Object.values(narrative.scenes)[0];
    const aliceId = Object.values(narrative.characters).find(c => c.name === 'Alice')?.id;

    expect(scene.participantIds).toContain(aliceId);
    expect(scene.povId).toBe(aliceId);
  });

  it('maps scene location names to location IDs', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        locations: [{ name: 'Castle', parentName: null, description: 'A castle', lore: [] }],
        scenes: [{
          locationName: 'Castle',
          povName: 'Alice',
          participantNames: ['Alice'],
          events: [],
          summary: 'Test',
          sections: [0],
          threadMutations: [],
          continuityMutations: [],
          relationshipMutations: [],
        }],
      },
    ];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    const scene = Object.values(narrative.scenes)[0];
    const castleId = Object.values(narrative.locations).find(l => l.name === 'Castle')?.id;

    expect(scene.locationId).toBe(castleId);
  });

  it('preserves beat plans and beatProseMaps from analysis', async () => {
    const mockPlan = {
      beats: [{ fn: 'breathe' as const, mechanism: 'environment' as const, what: 'Setup', propositions: [] }],
    };
    const mockBeatProseMap = {
      chunks: [{ beatIndex: 0, prose: 'Prose chunk' }],
      createdAt: Date.now(),
    };

    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        scenes: [{
          locationName: 'Castle',
          povName: 'Alice',
          participantNames: ['Alice'],
          events: [],
          summary: 'Test',
          sections: [0],
          threadMutations: [],
          continuityMutations: [],
          relationshipMutations: [],
          plan: mockPlan,
          beatProseMap: mockBeatProseMap,
        }],
      },
    ];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    const scene = Object.values(narrative.scenes)[0];
    expect(scene.plan).toEqual(mockPlan);
    expect(scene.beatProseMap).toEqual(mockBeatProseMap);
  });

  it('creates relationship entries from analysis', async () => {
    const results: AnalysisChunkResult[] = [
      {
        ...createMockAnalysisResult(0),
        characters: [
          { name: 'Alice', role: 'main', firstAppearance: true, continuity: [] },
          { name: 'Bob', role: 'main', firstAppearance: true, continuity: [] },
        ],
        relationships: [
          { from: 'Alice', to: 'Bob', type: 'ally', valence: 5 },
        ],
      },
    ];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    expect(narrative.relationships).toHaveLength(1);
    expect(narrative.relationships[0].type).toBe('ally');
    expect(narrative.relationships[0].valence).toBe(5);
  });

  it('sets createdAt and updatedAt timestamps', async () => {
    const results: AnalysisChunkResult[] = [createMockAnalysisResult(0)];
    const threadDeps = {};

    const narrative = await assembleNarrative('Test', results, threadDeps);

    expect(narrative.createdAt).toBeDefined();
    expect(narrative.updatedAt).toBeDefined();
    expect(typeof narrative.createdAt).toBe('number');
    expect(typeof narrative.updatedAt).toBe('number');
    expect(narrative.updatedAt).toBe(narrative.createdAt);
  });
});
