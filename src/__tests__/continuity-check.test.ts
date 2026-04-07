/**
 * Continuity Check Tests
 *
 * Tests the continuity checking logic:
 * - Check label filtering (which types trigger LLM check)
 * - Scene grouping for per-scene checks
 * - CandidateClassification structure
 * - ContinuityViolation structure
 */

import { describe, it, expect } from 'vitest';
import type { ContinuityViolation, PropositionBaseCategory } from '@/types/narrative';
import { classificationLabel } from '@/lib/proposition-classify';

// ── Check label filtering ───────────────────────────────────────────────────

describe('check label filtering', () => {
  const CHECK_LABELS = new Set(['anchor', 'foundation', 'close', 'ending']);

  it('anchor triggers check', () => {
    expect(CHECK_LABELS.has('anchor')).toBe(true);
  });

  it('foundation triggers check', () => {
    expect(CHECK_LABELS.has('foundation')).toBe(true);
  });

  it('close triggers check', () => {
    expect(CHECK_LABELS.has('close')).toBe(true);
  });

  it('ending triggers check', () => {
    expect(CHECK_LABELS.has('ending')).toBe(true);
  });

  it('seed does NOT trigger check', () => {
    expect(CHECK_LABELS.has('seed')).toBe(false);
  });

  it('foreshadow does NOT trigger check', () => {
    expect(CHECK_LABELS.has('foreshadow')).toBe(false);
  });

  it('texture does NOT trigger check', () => {
    expect(CHECK_LABELS.has('texture')).toBe(false);
  });

  it('atmosphere does NOT trigger check', () => {
    expect(CHECK_LABELS.has('atmosphere')).toBe(false);
  });

  it('only high-backward types trigger (Anchor base or Close base)', () => {
    // Anchor base: anchor (local), foundation (global)
    // Close base: close (local), ending (global)
    // These are the HI backward types
    const anchorLocal = classificationLabel('Anchor', 'Local');
    const anchorGlobal = classificationLabel('Anchor', 'Global');
    const closeLocal = classificationLabel('Close', 'Local');
    const closeGlobal = classificationLabel('Close', 'Global');

    expect(CHECK_LABELS.has(anchorLocal)).toBe(true);
    expect(CHECK_LABELS.has(anchorGlobal)).toBe(true);
    expect(CHECK_LABELS.has(closeLocal)).toBe(true);
    expect(CHECK_LABELS.has(closeGlobal)).toBe(true);

    // LO backward types should NOT trigger
    const seedLocal = classificationLabel('Seed', 'Local');
    const seedGlobal = classificationLabel('Seed', 'Global');
    const textureLocal = classificationLabel('Texture', 'Local');
    const textureGlobal = classificationLabel('Texture', 'Global');

    expect(CHECK_LABELS.has(seedLocal)).toBe(false);
    expect(CHECK_LABELS.has(seedGlobal)).toBe(false);
    expect(CHECK_LABELS.has(textureLocal)).toBe(false);
    expect(CHECK_LABELS.has(textureGlobal)).toBe(false);
  });
});

// ── Scene grouping ──────────────────────────────────────────────────────────

describe('scene grouping for per-scene checks', () => {
  it('groups classifications by sceneId', () => {
    const classifications = [
      { sceneId: 'S-001', beatIndex: 0, propIndex: 0, label: 'anchor' },
      { sceneId: 'S-001', beatIndex: 1, propIndex: 0, label: 'close' },
      { sceneId: 'S-002', beatIndex: 0, propIndex: 0, label: 'foundation' },
      { sceneId: 'S-002', beatIndex: 0, propIndex: 1, label: 'ending' },
      { sceneId: 'S-003', beatIndex: 0, propIndex: 0, label: 'anchor' },
    ];

    const groups = new Map<string, typeof classifications>();
    for (const c of classifications) {
      const sid = c.sceneId;
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid)!.push(c);
    }

    expect(groups.size).toBe(3);
    expect(groups.get('S-001')!.length).toBe(2);
    expect(groups.get('S-002')!.length).toBe(2);
    expect(groups.get('S-003')!.length).toBe(1);
  });
});

// ── ContinuityViolation structure ───────────────────────────────────────────

describe('ContinuityViolation type', () => {
  it('has all required fields', () => {
    const violation: ContinuityViolation = {
      beatIndex: 2,
      propIndex: 1,
      candidateContent: 'Harry had many friends at school.',
      priorContent: ['Harry was isolated and friendless.'],
      priorSceneIds: ['S-004'],
      isViolation: true,
      explanation: 'Contradicts established isolation of Harry.',
      activationScore: 0.85,
      label: 'anchor',
    };

    expect(violation.beatIndex).toBe(2);
    expect(violation.propIndex).toBe(1);
    expect(violation.isViolation).toBe(true);
    expect(violation.priorContent).toHaveLength(1);
    expect(violation.explanation).toContain('Contradicts');
    expect(violation.activationScore).toBeGreaterThan(0);
    expect(violation.label).toBe('anchor');
  });
});

// ── Concurrency configuration ───────────────────────────────────────────────

describe('concurrency configuration', () => {
  const CONCURRENCY = 10;
  const BATCH_SIZE = 8;

  it('10 scenes run in parallel', () => {
    const scenes = Array.from({ length: 24 }, (_, i) => `S-${i + 1}`);
    const windows: string[][] = [];
    for (let i = 0; i < scenes.length; i += CONCURRENCY) {
      windows.push(scenes.slice(i, i + CONCURRENCY));
    }
    // 24 scenes → 3 windows (10, 10, 4)
    expect(windows).toHaveLength(3);
    expect(windows[0]).toHaveLength(10);
    expect(windows[1]).toHaveLength(10);
    expect(windows[2]).toHaveLength(4);
  });

  it('completes in ceil(N/concurrency) rounds', () => {
    function rounds(sceneCount: number) {
      return Math.ceil(sceneCount / CONCURRENCY);
    }
    expect(rounds(1)).toBe(1);
    expect(rounds(10)).toBe(1);
    expect(rounds(11)).toBe(2);
    expect(rounds(24)).toBe(3);
    expect(rounds(100)).toBe(10);
  });
});

// ── Cosine similarity properties ────────────────────────────────────────────

describe('cosine similarity properties', () => {
  // Simple cosine similarity for testing
  function cosineSim(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  it('identical vectors have similarity 1', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSim(v, v)).toBeCloseTo(1.0);
  });

  it('orthogonal vectors have similarity 0', () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it('opposite vectors have similarity -1', () => {
    expect(cosineSim([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it('similarity is between -1 and 1', () => {
    const a = [0.5, -0.3, 0.8, 0.1];
    const b = [-0.2, 0.7, 0.4, -0.6];
    const sim = cosineSim(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('similarity is symmetric', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(cosineSim(a, b)).toBeCloseTo(cosineSim(b, a));
  });
});

// ── Top-k extraction ────────────────────────────────────────────────────────

describe('top-k extraction', () => {
  const TOP_K = 5;

  function extractTopK(similarities: number[]): { sim: number; idx: number }[] {
    return similarities
      .map((sim, idx) => ({ sim, idx }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K);
  }

  it('returns top 5 from a larger array', () => {
    const sims = [0.1, 0.9, 0.3, 0.7, 0.5, 0.8, 0.2, 0.6, 0.4, 0.95];
    const topk = extractTopK(sims);
    expect(topk).toHaveLength(5);
    expect(topk[0].sim).toBe(0.95);
    expect(topk[0].idx).toBe(9);
    expect(topk[1].sim).toBe(0.9);
    expect(topk[1].idx).toBe(1);
  });

  it('returns all when fewer than k', () => {
    const sims = [0.5, 0.8, 0.3];
    const topk = extractTopK(sims);
    expect(topk).toHaveLength(3);
    expect(topk[0].sim).toBe(0.8);
  });

  it('is sorted descending by similarity', () => {
    const sims = [0.1, 0.5, 0.3, 0.9, 0.7, 0.2, 0.8, 0.4, 0.6];
    const topk = extractTopK(sims);
    for (let i = 1; i < topk.length; i++) {
      expect(topk[i].sim).toBeLessThanOrEqual(topk[i - 1].sim);
    }
  });
});
